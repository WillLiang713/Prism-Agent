import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import type {
  AgentEvent,
  AgentRuntimeConfig,
  CancelParams,
  ListModelsParams,
  OuterMethods,
  RespondApprovalParams,
  ResumeSessionParams,
  SendMessageParams,
  StartSessionParams,
  TitleModelPayload,
} from './types.js';

type AgentMethods = {
  health: (params?: unknown) => Promise<OuterMethods['health']>;
  startSession: (params?: StartSessionParams) => Promise<OuterMethods['startSession']>;
  resumeSession: (params?: ResumeSessionParams) => Promise<OuterMethods['resumeSession']>;
  sendMessage: (params?: SendMessageParams) => Promise<OuterMethods['sendMessage']>;
  validateConfig: (params?: { config?: AgentRuntimeConfig }) => Promise<OuterMethods['validateConfig']>;
  cancel: (params?: CancelParams) => Promise<OuterMethods['cancel']>;
  respondApproval: (params?: RespondApprovalParams) => Promise<OuterMethods['respondApproval']>;
  listThreads: () => Promise<OuterMethods['listThreads']>;
  archiveThread: (params?: { threadId: string }) => Promise<OuterMethods['archiveThread']>;
  renameThread: (params?: { threadId: string; name: string }) => Promise<OuterMethods['renameThread']>;
  regenerateThreadTitle: (
    params?: { threadId: string; titleModel?: TitleModelPayload },
  ) => Promise<OuterMethods['regenerateThreadTitle']>;
  listModels: (params?: ListModelsParams) => Promise<OuterMethods['listModels']>;
};

type HttpServerOptions = {
  host: string;
  port: number;
  token: string;
  methods: AgentMethods;
  subscribe: (listener: (event: AgentEvent) => void) => () => void;
};

type RouteMatch =
  | { route: 'health' }
  | { route: 'validate_config' }
  | { route: 'list_models' }
  | { route: 'threads' }
  | { route: 'archive_thread'; threadId: string }
  | { route: 'rename_thread'; threadId: string }
  | { route: 'regenerate_thread_title'; threadId: string }
  | { route: 'start_session' }
  | { route: 'resume_session' }
  | { route: 'send_message' }
  | { route: 'cancel_request'; requestId: string }
  | { route: 'respond_approval'; approvalId: string }
  | null;

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:5283',
  'http://localhost:5283',
  'http://127.0.0.1:5284',
  'http://localhost:5284',
  'http://tauri.localhost',
  'https://tauri.localhost',
  'tauri://localhost',
  'app://localhost',
]);

const CONFIGURED_ALLOWED_ORIGINS_ENV = 'PRISM_ALLOWED_ORIGINS';

export function createHttpServer(options: HttpServerOptions) {
  const server = http.createServer((request, response) => {
    void handleRequest(options, request, response);
  });

  return new Promise<http.Server>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

async function handleRequest(
  options: HttpServerOptions,
  request: IncomingMessage,
  response: ServerResponse,
) {
  const origin = String(request.headers.origin || '').trim();
  const allowOrigin = resolveAllowedOrigin(origin);

  if (request.method === 'OPTIONS') {
    writeCorsHeaders(response, allowOrigin);
    response.statusCode = 204;
    response.end();
    return;
  }

  if (origin && !allowOrigin) {
    writeJson(response, 403, { message: 'Origin 不被允许。' });
    return;
  }

  writeCorsHeaders(response, allowOrigin);

  if (!isAuthorized(request, options.token)) {
    writeJson(response, 401, { message: '缺少有效的授权信息。' });
    return;
  }

  const match = matchRoute(request);
  if (!match) {
    writeJson(response, 404, { message: '请求路径不存在。' });
    return;
  }

  try {
    switch (match.route) {
      case 'health': {
        writeJson(response, 200, await options.methods.health());
        return;
      }
      case 'validate_config': {
        const body = await readJsonBody<{ config?: AgentRuntimeConfig }>(request);
        writeJson(response, 200, await options.methods.validateConfig({ config: body.config }));
        return;
      }
      case 'list_models': {
        const body = await readJsonBody<ListModelsParams>(request);
        writeJson(response, 200, await options.methods.listModels(body));
        return;
      }
      case 'threads': {
        writeJson(response, 200, await options.methods.listThreads());
        return;
      }
      case 'archive_thread': {
        await options.methods.archiveThread({ threadId: match.threadId });
        writeJson(response, 200, { ok: true });
        return;
      }
      case 'rename_thread': {
        const body = await readJsonBody<{ name?: string }>(request);
        const result = await options.methods.renameThread({
          threadId: match.threadId,
          name: body.name ?? '',
        });
        writeJson(response, 200, result);
        return;
      }
      case 'regenerate_thread_title': {
        const body = await readJsonBody<{ titleModel?: TitleModelPayload }>(request);
        const result = await options.methods.regenerateThreadTitle({
          threadId: match.threadId,
          titleModel: body.titleModel,
        });
        writeJson(response, 200, result);
        return;
      }
      case 'start_session': {
        const body = await readJsonBody<StartSessionParams>(request);
        writeJson(response, 200, await options.methods.startSession(body));
        return;
      }
      case 'resume_session': {
        const body = await readJsonBody<ResumeSessionParams>(request);
        writeJson(response, 200, await options.methods.resumeSession(body));
        return;
      }
      case 'cancel_request': {
        await options.methods.cancel({ requestId: match.requestId });
        writeJson(response, 200, { ok: true });
        return;
      }
      case 'respond_approval': {
        const body = await readJsonBody<{ decision: 'allow' | 'deny' }>(request);
        await options.methods.respondApproval({
          approvalId: match.approvalId,
          decision: body.decision,
        });
        writeJson(response, 200, { ok: true });
        return;
      }
      case 'send_message': {
        const body = await readJsonBody<SendMessageParams>(request);
        await streamAgentResponse(options, request, response, body);
        return;
      }
      default: {
        writeJson(response, 404, { message: '请求路径不存在。' });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (response.headersSent) {
      tryWriteEvent(response, {
        type: 'error',
        requestId: 'unknown',
        sessionId: '',
        message,
      });
      response.end();
      return;
    }

    writeJson(response, 500, { message });
  }
}

async function streamAgentResponse(
  options: HttpServerOptions,
  request: IncomingMessage,
  response: ServerResponse,
  payload: SendMessageParams,
) {
  const requestId = payload.requestId?.trim() || randomUUID();
  const sessionId = payload.sessionId;
  let completed = false;

  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();

  const unsubscribe = options.subscribe((event) => {
    if (!('requestId' in event) || event.requestId !== requestId) {
      return;
    }

    tryWriteEvent(response, event);
    if (event.type === 'done' || event.type === 'error') {
      completed = true;
      unsubscribe();
      response.end();
    }
  });

  // IncomingMessage 'close' fires when the request body has been fully read,
  // which is too early for streaming responses. Watch the response instead.
  response.once('close', () => {
    unsubscribe();
    if (!completed) {
      void options.methods.cancel({ requestId }).catch(() => undefined);
    }
  });

  try {
    await options.methods.sendMessage({
      ...payload,
      requestId,
    });
  } catch (error) {
    unsubscribe();
    tryWriteEvent(response, {
      type: 'error',
      requestId,
      sessionId,
      message: error instanceof Error ? error.message : String(error),
    });
    response.end();
  }
}

function matchRoute(request: IncomingMessage): RouteMatch {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method || 'GET';

  if (method === 'GET' && pathname === '/api/agent/health') {
    return { route: 'health' };
  }
  if (method === 'POST' && pathname === '/api/agent/config/validate') {
    return { route: 'validate_config' };
  }
  if (method === 'POST' && pathname === '/api/agent/models/list') {
    return { route: 'list_models' };
  }
  if (method === 'GET' && pathname === '/api/agent/threads') {
    return { route: 'threads' };
  }
  if (method === 'DELETE' && pathname.startsWith('/api/agent/threads/')) {
    return {
      route: 'archive_thread',
      threadId: decodeURIComponent(pathname.replace('/api/agent/threads/', '')),
    };
  }
  if (
    method === 'POST' &&
    pathname.startsWith('/api/agent/threads/') &&
    pathname.endsWith('/regenerate-title')
  ) {
    const rest = pathname.replace('/api/agent/threads/', '').replace(/\/regenerate-title$/, '');
    return {
      route: 'regenerate_thread_title',
      threadId: decodeURIComponent(rest),
    };
  }
  if (method === 'PATCH' && pathname.startsWith('/api/agent/threads/')) {
    return {
      route: 'rename_thread',
      threadId: decodeURIComponent(pathname.replace('/api/agent/threads/', '')),
    };
  }
  if (method === 'POST' && pathname === '/api/agent/sessions') {
    return { route: 'start_session' };
  }
  if (method === 'POST' && pathname === '/api/agent/sessions/resume') {
    return { route: 'resume_session' };
  }
  if (method === 'POST' && pathname === '/api/agent/requests') {
    return { route: 'send_message' };
  }
  if (method === 'POST' && pathname.endsWith('/cancel') && pathname.startsWith('/api/agent/requests/')) {
    return {
      route: 'cancel_request',
      requestId: decodeURIComponent(
        pathname.replace('/api/agent/requests/', '').replace(/\/cancel$/, ''),
      ),
    };
  }
  if (method === 'POST' && pathname.startsWith('/api/agent/approvals/')) {
    return {
      route: 'respond_approval',
      approvalId: decodeURIComponent(pathname.replace('/api/agent/approvals/', '')),
    };
  }
  return null;
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {} as T;
  }

  return JSON.parse(raw) as T;
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function tryWriteEvent(response: ServerResponse, event: AgentEvent) {
  if (response.destroyed || response.writableEnded) {
    return;
  }
  response.write(`${JSON.stringify(event)}\n`);
}

function writeCorsHeaders(response: ServerResponse, origin: string | null) {
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
  }
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
}

function resolveAllowedOrigin(origin: string) {
  if (!origin) {
    return null;
  }
  if (DEFAULT_ALLOWED_ORIGINS.has(origin) || getConfiguredAllowedOrigins().has(origin)) {
    return origin;
  }
  return null;
}

function getConfiguredAllowedOrigins() {
  return new Set(
    String(process.env[CONFIGURED_ALLOWED_ORIGINS_ENV] || '')
      .split(/[,\s]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function isAuthorized(request: IncomingMessage, token: string) {
  if (!token) {
    return true;
  }

  const header = String(request.headers.authorization || '').trim();
  return header === `Bearer ${token}`;
}
