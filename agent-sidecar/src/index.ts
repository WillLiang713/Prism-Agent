import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { AppServerClient } from './appServer.js';
import { classifyCommandRisk, classifyFileChangeRisk, shouldAutoApproveCommand } from './approval.js';
import { createBridge } from './bridge.js';
import { SessionRegistry } from './sessions.js';
import type {
  AppServerNotification,
  AppServerServerRequest,
  AppServerThread,
  CodexEvent,
  CodexSessionMessage,
  CodexThreadMeta,
  CodexUsage,
  OuterMethods,
  RespondApprovalParams,
  SendMessageImagePayload,
  SendMessageParams,
  StartSessionParams,
} from './types.js';

type PendingApproval = {
  resolve: (decision: 'allow' | 'deny') => void;
};

const sessionRegistry = new SessionRegistry();
const pendingApprovals = new Map<string, PendingApproval>();

const bridge = createBridge(
  {
    async health() {
      await appServer.waitUntilReady();
      const auth = await appServer.call<{ authMethod: string | null }>('getAuthStatus', {});
      return {
        sidecarVersion: '0.1.0',
        codexVersion: await appServer.codexVersion(),
        loggedIn: appServer.isLoggedIn() || Boolean(auth.authMethod),
      } satisfies OuterMethods['health'];
    },

    async startSession(params) {
      const { workspaceRoot } = params as StartSessionParams;
      const resolvedWorkspaceRoot = resolveWorkspaceRoot(workspaceRoot);
      const response = await appServer.call<{
        thread: AppServerThread;
      }>('thread/start', {
        cwd: resolvedWorkspaceRoot,
        approvalPolicy: 'untrusted',
        sandbox: 'workspace-write',
        experimentalRawEvents: false,
        persistExtendedHistory: true,
      });

      const session = sessionRegistry.createSession(response.thread.id, resolvedWorkspaceRoot);
      return {
        sessionId: session.sessionId,
        threadId: response.thread.id,
        messages: [] satisfies CodexSessionMessage[],
        thread: toThreadMeta(response.thread),
      } satisfies OuterMethods['startSession'];
    },

    async resumeSession(params) {
      const { workspaceRoot, threadId } = params as { workspaceRoot: string; threadId: string };
      const resolvedWorkspaceRoot = resolveWorkspaceRoot(workspaceRoot);
      const response = await appServer.call<{
        thread: AppServerThread;
      }>('thread/resume', {
        threadId,
        cwd: resolvedWorkspaceRoot,
        approvalPolicy: 'untrusted',
        sandbox: 'workspace-write',
        persistExtendedHistory: true,
      });

      const session = sessionRegistry.createSession(response.thread.id, resolvedWorkspaceRoot);
      return {
        sessionId: session.sessionId,
        threadId: response.thread.id,
        messages: sessionRegistry.toMessages(response.thread),
        thread: toThreadMeta(response.thread),
      } satisfies OuterMethods['resumeSession'];
    },

    async sendMessage(params) {
      const payload = params as SendMessageParams;
      const session = sessionRegistry.getSession(payload.sessionId);
      const input = await buildInput(payload.text, payload.images ?? []);
      const response = await appServer.call<{
        turn: {
          id: string;
        };
      }>('turn/start', {
        threadId: session.threadId,
        input,
        cwd: session.workspaceRoot,
        approvalPolicy: 'untrusted',
        sandboxPolicy: {
          type: 'workspaceWrite',
          writableRoots: [session.workspaceRoot],
          readOnlyAccess: { type: 'fullAccess' },
          networkAccess: false,
          excludeTmpdirEnvVar: false,
          excludeSlashTmp: false,
        },
        effort: normalizeEffort(payload.reasoningEffort),
      });

      const request = sessionRegistry.createRequest(
        session.sessionId,
        session.threadId,
        response.turn.id,
        payload.requestId,
      );
      return {
        requestId: request.requestId,
      } satisfies OuterMethods['sendMessage'];
    },

    async cancel(params) {
      const payload = params as { requestId: string };
      const request = sessionRegistry.getRequestByRequestId(payload.requestId);
      if (!request) {
        return null;
      }
      await appServer.call('turn/interrupt', {
        threadId: request.threadId,
        turnId: request.turnId,
      });
      return null;
    },

    async respondApproval(params) {
      const payload = params as RespondApprovalParams;
      const pending = pendingApprovals.get(payload.approvalId);
      if (!pending) {
        throw new Error(`Unknown approval: ${payload.approvalId}`);
      }
      pendingApprovals.delete(payload.approvalId);
      pending.resolve(payload.decision);
      return null;
    },

    async listThreads() {
      const response = await appServer.call<{ data: AppServerThread[] }>('thread/list', {
        limit: 20,
        archived: false,
      });

      return {
        threads: response.data
          .map(toThreadMeta)
          .sort((left, right) => right.updatedAt - left.updatedAt),
      } satisfies OuterMethods['listThreads'];
    },

    async archiveThread(params) {
      const { threadId } = params as { threadId: string };
      await appServer.call('thread/archive', { threadId });
      return null;
    },
  },
  (payload) => {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  },
);

const appServer = new AppServerClient({
  onNotification: handleNotification,
  onServerRequest: handleServerRequest,
});

process.on('SIGINT', () => {
  void appServer.shutdown().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void appServer.shutdown().finally(() => process.exit(0));
});

async function buildInput(text: string, images: SendMessageImagePayload[]) {
  const input: Array<Record<string, unknown>> = [];
  if (text.trim()) {
    input.push({
      type: 'text',
      text,
      text_elements: [],
    });
  }

  for (const image of images) {
    input.push({
      type: 'localImage',
      path: await persistImage(image),
    });
  }

  return input;
}

async function persistImage(image: SendMessageImagePayload) {
  const [header, base64] = image.dataUrl.split(',', 2);
  if (!header || !base64) {
    throw new Error(`Invalid image payload: ${image.name}`);
  }

  const extension = mimeToExtension(image.mediaType);
  const imageDir = path.join(os.tmpdir(), 'prism-codex-images');
  await fs.mkdir(imageDir, { recursive: true });
  const filePath = path.join(
    imageDir,
    `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`,
  );
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
  return filePath;
}

function mimeToExtension(mediaType: string) {
  if (mediaType === 'image/jpeg') return '.jpg';
  if (mediaType === 'image/webp') return '.webp';
  if (mediaType === 'image/gif') return '.gif';
  return '.png';
}

function resolveWorkspaceRoot(workspaceRoot: string) {
  return workspaceRoot.trim() || process.cwd();
}

function normalizeEffort(effort: SendMessageParams['reasoningEffort']) {
  if (!effort || effort === 'none') {
    return 'medium';
  }
  return effort;
}

function toThreadMeta(thread: AppServerThread): CodexThreadMeta {
  return {
    threadId: thread.id,
    preview: thread.preview,
    name: thread.name,
    cwd: thread.cwd,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    status: thread.status.type,
    modelProvider: thread.modelProvider,
    path: thread.path,
  };
}

function emit(event: CodexEvent) {
  bridge.emit(event);
}

function handleNotification(notification: AppServerNotification) {
  const params = notification.params;
  const threadId = String(params.threadId ?? '');
  const turnId = getTurnId(params);
  const request = turnId ? sessionRegistry.getRequestByTurnId(turnId) : null;

  switch (notification.method) {
    case 'item/agentMessage/delta': {
      if (!request) return;
      emit({
        type: 'delta',
        requestId: request.requestId,
        sessionId: request.sessionId,
        itemId: String(params.itemId),
        kind: 'text',
        text: String(params.delta ?? ''),
      });
      return;
    }
    case 'item/reasoning/textDelta':
    case 'item/reasoning/summaryTextDelta': {
      if (!request) return;
      emit({
        type: 'delta',
        requestId: request.requestId,
        sessionId: request.sessionId,
        itemId: String(params.itemId),
        kind: 'thinking',
        text: String(params.delta ?? ''),
      });
      return;
    }
    case 'item/started': {
      if (!request) return;
      const item = params.item as Record<string, unknown>;
      const type = String(item.type ?? '');
      if (!isToolLikeItem(type)) {
        return;
      }
      emit({
        type: 'tool_call',
        requestId: request.requestId,
        sessionId: request.sessionId,
        toolCallId: String(item.id),
        name: type,
        args: item,
        status: 'started',
      });
      return;
    }
    case 'item/completed': {
      if (!request) return;
      const item = params.item as Record<string, unknown>;
      const type = String(item.type ?? '');
      if (type === 'agentMessage' || type === 'reasoning') {
        return;
      }
      if (isToolLikeItem(type)) {
        emit({
          type: 'tool_result',
          requestId: request.requestId,
          sessionId: request.sessionId,
          toolCallId: String(item.id),
          ok: !['failed', 'declined'].includes(String(item.status ?? '')),
          output: summarizeToolItem(item),
          status: String(item.status ?? ''),
        });
      }
      return;
    }
    case 'thread/tokenUsage/updated': {
      if (!turnId) return;
      sessionRegistry.updateUsage(turnId, toUsage(params.tokenUsage as Record<string, unknown>));
      return;
    }
    case 'turn/completed': {
      if (!request) return;
      const finished = sessionRegistry.finishRequest(turnId) ?? request;
      emit({
        type: 'done',
        requestId: finished.requestId,
        sessionId: finished.sessionId,
        threadId,
        usage: finished.usage,
      });
      return;
    }
    case 'error': {
      if (!request) return;
      const error = params.error as Record<string, unknown> | undefined;
      emit({
        type: 'error',
        requestId: request.requestId,
        sessionId: request.sessionId,
        message: String(error?.message ?? 'Unknown Codex error'),
      });
      return;
    }
    default:
      return;
  }
}

function getTurnId(params: Record<string, unknown>) {
  if (typeof params.turnId === 'string' && params.turnId) {
    return params.turnId;
  }

  const turn = params.turn as Record<string, unknown> | undefined;
  if (typeof turn?.id === 'string' && turn.id) {
    return turn.id;
  }

  return '';
}

async function handleServerRequest(request: AppServerServerRequest) {
  if (
    request.method !== 'item/commandExecution/requestApproval' &&
    request.method !== 'item/fileChange/requestApproval'
  ) {
    throw new Error(`Unsupported server request: ${request.method}`);
  }

  const params = request.params;
  const turnId = String(params.turnId ?? '');
  const requestRecord = sessionRegistry.getRequestByTurnId(turnId);
  if (!requestRecord) {
    return { decision: 'decline' };
  }
  const session = sessionRegistry.getSession(requestRecord.sessionId);

  if (request.method === 'item/commandExecution/requestApproval') {
    const command = String(params.command ?? '');
    if (shouldAutoApproveCommand(command, session.workspaceRoot)) {
      return {
        decision: 'accept',
      };
    }

    const approvalId = String(request.id);
    emit({
      type: 'approval_request',
      requestId: requestRecord.requestId,
      sessionId: requestRecord.sessionId,
      approvalId,
      toolCallId: String(params.itemId ?? approvalId),
      command,
      risk: classifyCommandRisk(command, session.workspaceRoot),
      reason: params.reason ? String(params.reason) : undefined,
    });

    const decision = await waitForApproval(approvalId);
    return {
      decision: decision === 'allow' ? 'accept' : 'decline',
    };
  }

  const approvalId = String(request.id);
  const changes = [
    {
      path: String(params.grantRoot ?? session.workspaceRoot),
    },
  ];

  emit({
    type: 'approval_request',
    requestId: requestRecord.requestId,
    sessionId: requestRecord.sessionId,
    approvalId,
    toolCallId: String(params.itemId ?? approvalId),
    command: params.reason ? String(params.reason) : '文件改动审批',
    risk: classifyFileChangeRisk(changes, session.workspaceRoot),
    reason: params.reason ? String(params.reason) : undefined,
  });

  const decision = await waitForApproval(approvalId);
  return {
    decision: decision === 'allow' ? 'accept' : 'decline',
  };
}

function waitForApproval(approvalId: string) {
  return new Promise<'allow' | 'deny'>((resolve) => {
    pendingApprovals.set(approvalId, { resolve });
  });
}

function isToolLikeItem(type: string) {
  return ['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall'].includes(type);
}

function summarizeToolItem(item: Record<string, unknown>) {
  if (typeof item.aggregatedOutput === 'string' && item.aggregatedOutput.trim()) {
    return item.aggregatedOutput;
  }

  if (item.type === 'fileChange' && Array.isArray(item.changes)) {
    return item.changes
      .map((change: any) => {
        const header = `--- ${change.path}\n+++ ${change.path}`;
        return `${header}\n${change.diff || '(no changes)'}`;
      })
      .join('\n\n');
  }

  if (Array.isArray(item.changes) && item.changes.length > 0) {
    return JSON.stringify(item.changes);
  }

  if (item.result) {
    return typeof item.result === 'string' ? item.result : JSON.stringify(item.result);
  }

  if (item.error) {
    return typeof item.error === 'string' ? item.error : JSON.stringify(item.error);
  }

  return JSON.stringify(item);
}

function toUsage(tokenUsage: Record<string, unknown>): CodexUsage {
  const total = tokenUsage.total as Record<string, unknown> | undefined;
  return {
    input: Number(total?.inputTokens ?? 0),
    output: Number(total?.outputTokens ?? 0),
    cachedInput: Number(total?.cachedInputTokens ?? 0),
    reasoningOutput: Number(total?.reasoningOutputTokens ?? 0),
    total: Number(total?.totalTokens ?? 0),
  };
}
