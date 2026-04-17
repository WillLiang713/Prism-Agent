import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type http from 'node:http';

import {
  AuthStorage,
  createAgentSession,
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  type ToolCallEvent,
  type ToolResultEvent,
} from '@mariozechner/pi-coding-agent';

import { classifyCommandRisk, classifyPathRisk, shouldAutoApproveCommand } from './approval.js';
import { createBridge } from './bridge.js';
import { createHttpServer } from './http.js';
import { SessionRegistry, type PersistedSessionSnapshot, type RuntimeSessionRecord } from './sessions.js';
import type {
  AgentApprovalMode,
  AgentEvent,
  AgentReasoningEffort,
  AgentRuntimeConfig,
  AgentRuntimeStatus,
  AgentSessionToolEvent,
  CancelParams,
  ListModelsParams,
  ListModelsResult,
  OuterMethods,
  RespondApprovalParams,
  ResumeSessionParams,
  SendMessageParams,
  SidecarHealth,
  SkillStatusItem,
  StartSessionParams,
} from './types.js';

const SIDECAR_VERSION = '0.3.0';
const AGENT_VERSION = '0.66.1';
const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;

type PendingApproval = {
  sessionId: string;
  requestId: string;
  resolve: (decision: 'allow' | 'deny') => void;
};

type RuntimeOptions = {
  transport: 'http' | 'stdio';
  host: string;
  port: number;
  token: string;
};

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const pendingApprovals = new Map<string, PendingApproval>();
const requestApprovalModes = new Map<string, AgentApprovalMode>();
const sessionRegistry = new SessionRegistry(resolveDataDir());
const eventSubscribers = new Set<(event: AgentEvent) => void>();
const servers: http.Server[] = [];

const methods = {
  async health() {
    await sessionRegistry.ensureReady();
    return {
      sidecarVersion: SIDECAR_VERSION,
      agentVersion: AGENT_VERSION,
      loggedIn: authStorage.list().length > 0,
    } satisfies SidecarHealth;
  },

  async startSession(params?: StartSessionParams) {
    const workspaceRoot = params?.workspaceRoot ?? '';
    const runtime = await createRuntimeSession({
      workspaceRoot,
    });
    return sessionRegistry.toBootstrap(runtime.snapshot) satisfies OuterMethods['startSession'];
  },

  async resumeSession(params?: ResumeSessionParams) {
    const workspaceRoot = params?.workspaceRoot ?? '';
    const threadId = params?.threadId ?? '';
    const existing = sessionRegistry.getRuntimeSessionByThreadId(threadId);
    if (existing) {
      return sessionRegistry.toBootstrap(existing.snapshot) satisfies OuterMethods['resumeSession'];
    }

    const snapshot = await sessionRegistry.loadSnapshot(threadId);
    const runtime = await createRuntimeSession({
      workspaceRoot: workspaceRoot || snapshot.workspaceRoot,
      existingSnapshot: snapshot,
    });
    return sessionRegistry.toBootstrap(runtime.snapshot) satisfies OuterMethods['resumeSession'];
  },

  async sendMessage(params?: SendMessageParams) {
    if (!params) {
      throw new Error('缺少请求参数。');
    }

    const runtime = sessionRegistry.getRuntimeSession(params.sessionId);
    const requestId = params.requestId || randomUUID();
    requestApprovalModes.set(requestId, normalizeApprovalMode(params.approvalMode));
    sessionRegistry.markRequestStarted(runtime.sessionId, requestId, params.text);
    await sessionRegistry.saveSnapshot(runtime.snapshot);

    void runPrompt(runtime, requestId, { ...params, requestId }).catch((error) => {
      emit({
        type: 'error',
        requestId,
        sessionId: runtime.sessionId,
        message: error instanceof Error ? error.message : String(error),
      });
    });

    return {
      requestId,
    } satisfies OuterMethods['sendMessage'];
  },

  async validateConfig(params?: { config?: AgentRuntimeConfig }) {
    return resolveRuntimeConfigStatus(params?.config) satisfies OuterMethods['validateConfig'];
  },

  async cancel(params?: CancelParams) {
    const requestId = params?.requestId ?? '';
    requestApprovalModes.delete(requestId);
    for (const [approvalId, approval] of pendingApprovals.entries()) {
      if (approval.requestId === requestId) {
        pendingApprovals.delete(approvalId);
        approval.resolve('deny');
      }
    }

    for (const runtime of getRuntimeSessions()) {
      if (runtime.currentRequestId === requestId) {
        sessionRegistry.markRequestCancelled(requestId);
        await runtime.session.abort();
      }
    }
    return null;
  },

  async respondApproval(params?: RespondApprovalParams) {
    const approvalId = params?.approvalId ?? '';
    const pending = pendingApprovals.get(approvalId);
    if (!pending) {
      throw new Error(`Unknown approval: ${approvalId}`);
    }

    pendingApprovals.delete(approvalId);
    pending.resolve(params?.decision ?? 'deny');
    return null;
  },

  async listThreads() {
    const threads = await sessionRegistry.listThreads();
    return {
      threads,
    } satisfies OuterMethods['listThreads'];
  },

  async archiveThread(params?: { threadId: string }) {
    const threadId = params?.threadId ?? '';
    await sessionRegistry.archiveThread(threadId);
    return null;
  },

  async listModels(params?: ListModelsParams) {
    if (!params?.providerSelection) {
      throw new Error('缺少服务类型。');
    }
    return (await fetchProviderModels(params)) satisfies OuterMethods['listModels'];
  },
};

process.on('SIGINT', () => {
  void shutdown(0);
});

process.on('SIGTERM', () => {
  void shutdown(0);
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await sessionRegistry.ensureReady();

  if (options.transport === 'stdio') {
    startStdioTransport();
    return;
  }

  const server = await createHttpServer({
    host: options.host,
    port: options.port,
    token: options.token,
    methods,
    subscribe,
  });
  servers.push(server);
  console.error(
    `[agent-sidecar] http listening on http://${options.host}:${options.port}/api/agent`,
  );
}

function startStdioTransport() {
  const bridge = createBridge(
    methods as unknown as Record<string, (params?: unknown) => Promise<unknown>>,
    (payload) => {
      process.stdout.write(`${JSON.stringify(payload)}\n`);
    },
  );
  subscribe((event) => bridge.emit(event));
}

function subscribe(listener: (event: AgentEvent) => void) {
  eventSubscribers.add(listener);
  return () => {
    eventSubscribers.delete(listener);
  };
}

async function shutdown(exitCode: number) {
  for (const server of servers) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
  disposeAll();
  process.exit(exitCode);
}

function parseArgs(argv: string[]): RuntimeOptions {
  let transport: RuntimeOptions['transport'] = 'stdio';
  let host = '127.0.0.1';
  let port = 33200;
  let token = '';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--transport' && argv[index + 1]) {
      transport = argv[index + 1] === 'http' ? 'http' : 'stdio';
      index += 1;
      continue;
    }
    if (arg.startsWith('--transport=')) {
      transport = arg.slice('--transport='.length) === 'http' ? 'http' : 'stdio';
      continue;
    }
    if (arg === '--host' && argv[index + 1]) {
      host = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--host=')) {
      host = arg.slice('--host='.length);
      continue;
    }
    if (arg === '--port' && argv[index + 1]) {
      port = Number.parseInt(argv[index + 1], 10) || port;
      index += 1;
      continue;
    }
    if (arg.startsWith('--port=')) {
      port = Number.parseInt(arg.slice('--port='.length), 10) || port;
      continue;
    }
    if (arg === '--token' && argv[index + 1]) {
      token = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--token=')) {
      token = arg.slice('--token='.length);
    }
  }

  return {
    transport,
    host,
    port,
    token,
  };
}

async function createRuntimeSession(options: {
  workspaceRoot: string;
  existingSnapshot?: PersistedSessionSnapshot;
}) {
  const resolvedWorkspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  await sessionRegistry.ensureReady();

  const provisionalSessionId = options.existingSnapshot?.sessionId || randomUUID();
  const context = {
    sessionId: provisionalSessionId,
    threadId: options.existingSnapshot?.threadId || provisionalSessionId,
  };

  const loader = new DefaultResourceLoader({
    cwd: resolvedWorkspaceRoot,
    extensionFactories: [createBridgeExtension(context)],
  });
  await loader.reload();

  const sessionDir = sessionRegistry.createWorkspaceSessionDir(resolvedWorkspaceRoot);
  const sessionManager = options.existingSnapshot?.sessionFile
    ? SessionManager.open(options.existingSnapshot.sessionFile, sessionDir, resolvedWorkspaceRoot)
    : SessionManager.create(resolvedWorkspaceRoot, sessionDir);

  const { session } = await createAgentSession({
    cwd: resolvedWorkspaceRoot,
    authStorage,
    modelRegistry,
    resourceLoader: loader,
    sessionManager,
    tools: [
      createReadTool(resolvedWorkspaceRoot),
      createBashTool(resolvedWorkspaceRoot),
      createEditTool(resolvedWorkspaceRoot),
      createWriteTool(resolvedWorkspaceRoot),
      createGrepTool(resolvedWorkspaceRoot),
      createFindTool(resolvedWorkspaceRoot),
      createLsTool(resolvedWorkspaceRoot),
    ],
  });
  await session.bindExtensions({});

  const skills = collectSkills(loader);
  const snapshot =
    options.existingSnapshot ??
    sessionRegistry.createSnapshot({
      threadId: session.sessionId,
      workspaceRoot: resolvedWorkspaceRoot,
      sessionFile: session.sessionFile ?? null,
      skills,
      modelProvider: session.model?.provider || 'pi',
    });

  if (!options.existingSnapshot) {
    snapshot.threadId = session.sessionId;
  }
  context.threadId = snapshot.threadId;
  snapshot.sessionId = provisionalSessionId;
  snapshot.workspaceRoot = resolvedWorkspaceRoot;
  snapshot.sessionFile = session.sessionFile ?? snapshot.sessionFile;
  snapshot.skills = skills;
  snapshot.modelProvider = session.model?.provider || snapshot.modelProvider || 'pi';

  const runtime = sessionRegistry.registerRuntime({
    sessionId: snapshot.sessionId,
    threadId: snapshot.threadId,
    workspaceRoot: resolvedWorkspaceRoot,
    session,
    loader,
    snapshot,
    baseSystemPrompt: session.agent.state.systemPrompt,
  });
  bindSessionEvents(runtime);
  await sessionRegistry.saveSnapshot(snapshot);
  emit({
    type: 'skills_snapshot',
    sessionId: runtime.sessionId,
    skills,
  });
  return runtime;
}

function bindSessionEvents(runtime: RuntimeSessionRecord) {
  runtime.session.subscribe((event) => {
    const requestId = runtime.currentRequestId;
    if (!requestId) {
      return;
    }

    const assistantMessage = sessionRegistry.getAssistantMessage(runtime.sessionId);
    switch (event.type) {
      case 'message_update': {
        if (!assistantMessage) {
          return;
        }
        if (event.assistantMessageEvent.type === 'thinking_start') {
          assistantMessage.thinkingStartedAt = Date.now();
          assistantMessage.thinkingDurationSec = undefined;
        }
        if (event.assistantMessageEvent.type === 'text_delta') {
          assistantMessage.text += event.assistantMessageEvent.delta;
          emit({
            type: 'delta',
            requestId,
            sessionId: runtime.sessionId,
            itemId: assistantMessage.id,
            kind: 'text',
            text: event.assistantMessageEvent.delta,
          });
        }
        if (event.assistantMessageEvent.type === 'thinking_delta') {
          assistantMessage.thinking = `${assistantMessage.thinking || ''}${event.assistantMessageEvent.delta}`;
          emit({
            type: 'delta',
            requestId,
            sessionId: runtime.sessionId,
            itemId: assistantMessage.id,
            kind: 'thinking',
            text: event.assistantMessageEvent.delta,
          });
        }
        if (event.assistantMessageEvent.type === 'thinking_end') {
          finalizeAssistantThinking(assistantMessage);
        }
        persistSnapshot(runtime);
        return;
      }
      case 'tool_execution_start': {
        ensureToolEvent(runtime, {
          id: event.toolCallId,
          name: event.toolName,
          status: 'running',
          args: event.args,
          output: '',
          ok: null,
          summary: summarizeTool(event.toolName, event.args),
        });
        emit({
          type: 'tool_call',
          requestId,
          sessionId: runtime.sessionId,
          toolCallId: event.toolCallId,
          name: event.toolName,
          args: event.args,
          status: 'started',
          summary: summarizeTool(event.toolName, event.args),
        });
        persistSnapshot(runtime);
        return;
      }
      case 'tool_execution_update': {
        const existing = ensureToolEvent(runtime, {
          id: event.toolCallId,
          name: event.toolName,
          status: 'running',
          args: event.args,
          output: '',
          ok: null,
          summary: summarizeTool(event.toolName, event.args),
        });
        existing.status = 'running';
        existing.output = mergeToolOutput(existing.output, stringifyUnknown(event.partialResult));
        emit({
          type: 'tool_result',
          requestId,
          sessionId: runtime.sessionId,
          toolCallId: event.toolCallId,
          ok: true,
          output: existing.output,
          status: 'running',
          summary: existing.summary,
        });
        persistSnapshot(runtime);
        return;
      }
      default:
        return;
    }
  });
}

async function runPrompt(runtime: RuntimeSessionRecord, requestId: string, payload: SendMessageParams) {
  try {
    await applyRuntimeConfig(runtime, payload.config);
    runtime.session.setThinkingLevel(normalizeThinking(payload.reasoningEffort));
    await runtime.session.prompt(payload.text, {
      images: normalizeImages(payload.images ?? []),
    });

    if (!sessionRegistry.isCancelled(runtime.sessionId, requestId)) {
      emit({
        type: 'done',
        requestId,
        sessionId: runtime.sessionId,
        threadId: runtime.threadId,
        usage: runtime.snapshot.lastUsage,
      });
    } else {
      emit({
        type: 'done',
        requestId,
        sessionId: runtime.sessionId,
        threadId: runtime.threadId,
      });
    }
  } catch (error) {
    if (!sessionRegistry.isCancelled(runtime.sessionId, requestId)) {
      runtime.snapshot.status = 'error';
      persistSnapshot(runtime);
      emit({
        type: 'error',
        requestId,
        sessionId: runtime.sessionId,
        message: error instanceof Error ? error.message : String(error),
      });
    } else {
      emit({
        type: 'done',
        requestId,
        sessionId: runtime.sessionId,
        threadId: runtime.threadId,
      });
    }
  } finally {
    const assistantMessage = sessionRegistry.getLatestAssistantMessage(runtime.sessionId);
    if (assistantMessage) {
      finalizeAssistantThinking(assistantMessage);
    }
    requestApprovalModes.delete(requestId);
    sessionRegistry.clearRequest(runtime.sessionId, requestId);
    await sessionRegistry.saveSnapshot(runtime.snapshot);
  }
}

function createBridgeExtension(context: { sessionId: string; threadId: string }) {
  return (pi: any) => {
    pi.on('tool_call', async (event: ToolCallEvent) => {
      const runtime = sessionRegistry.getRuntimeSession(context.sessionId);
      const requestId = runtime.currentRequestId;
      if (!requestId) {
        return undefined;
      }

      if (event.toolName === 'bash') {
        const command = typeof event.input.command === 'string' ? event.input.command : '';
        const approvalMode = requestApprovalModes.get(requestId) ?? 'manual';
        const shouldSkipApproval = approvalMode === 'auto'
          ? true
          : shouldAutoApproveCommand(command, runtime.workspaceRoot);
        if (shouldSkipApproval) {
          return undefined;
        }

        const approvalId = randomUUID();
        emit({
          type: 'approval_request',
          requestId,
          sessionId: runtime.sessionId,
          approvalId,
          toolCallId: event.toolCallId,
          command,
          risk: classifyCommandRisk(command, runtime.workspaceRoot),
          reason: '命令执行需要确认',
        });

        const decision = await waitForApproval(runtime.sessionId, requestId, approvalId);
        if (decision === 'deny') {
          finalizeToolEvent(runtime, event.toolCallId, event.toolName, {
            ok: false,
            output: '已拒绝执行该命令。',
            status: 'blocked',
            summary: summarizeTool(event.toolName, event.input),
          });
          emit({
            type: 'tool_result',
            requestId,
            sessionId: runtime.sessionId,
            toolCallId: event.toolCallId,
            ok: false,
            output: '已拒绝执行该命令。',
            status: 'blocked',
            summary: summarizeTool(event.toolName, event.input),
          });
          persistSnapshot(runtime);
          return {
            block: true,
            reason: 'Blocked by user',
          };
        }
      }

      if (event.toolName === 'edit' || event.toolName === 'write') {
        const targetPath = typeof event.input.path === 'string' ? event.input.path : '';
        const approvalId = randomUUID();
        emit({
          type: 'approval_request',
          requestId,
          sessionId: runtime.sessionId,
          approvalId,
          toolCallId: event.toolCallId,
          command: targetPath || '文件修改',
          risk: classifyPathRisk(targetPath, runtime.workspaceRoot),
          reason: '文件修改需要确认',
        });
        const decision = await waitForApproval(runtime.sessionId, requestId, approvalId);
        if (decision === 'deny') {
          finalizeToolEvent(runtime, event.toolCallId, event.toolName, {
            ok: false,
            output: '已拒绝应用文件修改。',
            status: 'blocked',
            summary: summarizeTool(event.toolName, event.input),
          });
          emit({
            type: 'tool_result',
            requestId,
            sessionId: runtime.sessionId,
            toolCallId: event.toolCallId,
            ok: false,
            output: '已拒绝应用文件修改。',
            status: 'blocked',
            summary: summarizeTool(event.toolName, event.input),
          });
          persistSnapshot(runtime);
          return {
            block: true,
            reason: 'Blocked by user',
          };
        }
      }

      return undefined;
    });

    pi.on('tool_result', (event: ToolResultEvent) => {
      const runtime = sessionRegistry.getRuntimeSession(context.sessionId);
      const requestId = runtime.currentRequestId;
      if (!requestId) {
        return;
      }

      const output = contentToText(event.content);
      const diff = extractDiff(event.toolName, event.details);
      const exitCode = extractExitCode(event.details);
      finalizeToolEvent(runtime, event.toolCallId, event.toolName, {
        ok: !event.isError,
        output,
        status: event.isError ? 'error' : 'completed',
        diff,
        exitCode,
        summary: summarizeTool(event.toolName, event.input),
      });

      emit({
        type: 'tool_result',
        requestId,
        sessionId: runtime.sessionId,
        toolCallId: event.toolCallId,
        ok: !event.isError,
        output,
        status: event.isError ? 'error' : 'completed',
        diff,
        exitCode,
        summary: summarizeTool(event.toolName, event.input),
      });
      persistSnapshot(runtime);
    });
  };
}

function collectSkills(loader: DefaultResourceLoader) {
  const skillResult = loader.getSkills();
  const items: SkillStatusItem[] = skillResult.skills.map((skill) => ({
    id: skill.name,
    name: skill.name,
    description: skill.description || '',
    status: 'loaded',
    source: skill.filePath,
  }));
  return sessionRegistry.buildSkillsSnapshot(
    items,
    skillResult.diagnostics
      .map((diagnostic) => String((diagnostic as { message?: unknown }).message ?? ''))
      .filter(Boolean),
  );
}

function normalizeImages(images: SendMessageParams['images']) {
  return (images ?? []).map((image) => {
    const [, base64 = ''] = image.dataUrl.split(',', 2);
    return {
      type: 'image' as const,
      data: base64,
      mimeType: image.mediaType,
    };
  });
}

function normalizeThinking(reasoning: AgentReasoningEffort | undefined) {
  if (!reasoning || reasoning === 'none') {
    return 'off';
  }
  return reasoning;
}

function normalizeApprovalMode(mode: AgentApprovalMode | undefined) {
  return mode === 'auto' ? 'auto' : 'manual';
}

function normalizeRuntimeConfig(config?: AgentRuntimeConfig | null) {
  if (!config) {
    return null;
  }

  const provider = config.provider?.trim() || '';
  const model = config.model?.trim() || '';
  const apiKey = config.apiKey?.trim() || '';
  const apiUrl = config.apiUrl?.trim() || '';
  const systemPrompt = config.systemPrompt?.trim() || '';
  const serviceName = config.serviceName?.trim() || '';

  if (!provider && !model && !apiKey && !apiUrl && !systemPrompt && !serviceName) {
    return null;
  }

  return {
    provider,
    model,
    apiKey,
    apiUrl,
    systemPrompt,
    serviceName,
  };
}

function resetProviderOverrides() {
  for (const provider of SUPPORTED_PROVIDERS) {
    authStorage.removeRuntimeApiKey(provider);
    modelRegistry.unregisterProvider(provider);
  }
  modelRegistry.refresh();
}

function applyProviderOverrides(config: NonNullable<ReturnType<typeof normalizeRuntimeConfig>>) {
  resetProviderOverrides();

  if (!config.apiKey && !config.apiUrl) {
    return;
  }

  if (config.apiKey) {
    authStorage.setRuntimeApiKey(config.provider, config.apiKey);
  }

  modelRegistry.registerProvider(config.provider, {
    baseUrl: config.apiUrl || undefined,
    apiKey: config.apiKey || undefined,
  });
}

function resolveRuntimeConfigStatus(config?: AgentRuntimeConfig | null): AgentRuntimeStatus {
  const normalized = normalizeRuntimeConfig(config);
  if (!normalized?.provider) {
    resetProviderOverrides();
    return {
      configured: false,
      ready: false,
      reason: '未配置主模型服务，请前往设置进行配置。',
    };
  }

  if (!SUPPORTED_PROVIDERS.includes(normalized.provider as (typeof SUPPORTED_PROVIDERS)[number])) {
    resetProviderOverrides();
    return {
      configured: true,
      ready: false,
      reason: `当前 agent 暂不支持 ${normalized.provider} 提供方。`,
      provider: normalized.provider,
      serviceName: normalized.serviceName || undefined,
    };
  }

  if (!normalized.model) {
    applyProviderOverrides(normalized);
    return {
      configured: false,
      ready: false,
      reason: '未指定主模型，请在设置中选择或输入模型名称。',
      provider: normalized.provider,
      serviceName: normalized.serviceName || undefined,
    };
  }

  applyProviderOverrides(normalized);
  const model = modelRegistry.find(normalized.provider, normalized.model);
  if (!model) {
    return {
      configured: true,
      ready: false,
      reason: `找不到模型 ${normalized.provider}/${normalized.model}。`,
      provider: normalized.provider,
      model: normalized.model,
      serviceName: normalized.serviceName || undefined,
    };
  }

  if (!modelRegistry.hasConfiguredAuth(model)) {
    return {
      configured: true,
      ready: false,
      reason: '当前服务缺少可用的 API Key 或登录态。',
      provider: model.provider,
      model: model.id,
      serviceName: normalized.serviceName || undefined,
    };
  }

  return {
    configured: true,
    ready: true,
    reason: '',
    provider: model.provider,
    model: model.id,
    serviceName: normalized.serviceName || undefined,
  };
}

async function applyRuntimeConfig(runtime: RuntimeSessionRecord, config?: AgentRuntimeConfig | null) {
  const normalized = normalizeRuntimeConfig(config);
  const status = resolveRuntimeConfigStatus(normalized);
  if (!status.ready || !status.provider || !status.model) {
    throw new Error(status.reason || '模型配置不可用。');
  }

  const model = modelRegistry.find(status.provider, status.model);
  if (!model) {
    throw new Error(`找不到模型 ${status.provider}/${status.model}。`);
  }

  if (
    !runtime.session.model ||
    runtime.session.model.provider !== model.provider ||
    runtime.session.model.id !== model.id
  ) {
    await runtime.session.setModel(model);
  }

  runtime.session.agent.state.systemPrompt = normalized?.systemPrompt || runtime.baseSystemPrompt;
  runtime.snapshot.modelProvider = runtime.session.model?.provider || status.provider;
}

function ensureToolEvent(runtime: RuntimeSessionRecord, seed: AgentSessionToolEvent) {
  const assistantMessage =
    sessionRegistry.getAssistantMessage(runtime.sessionId) ??
    sessionRegistry.getLatestAssistantMessage(runtime.sessionId);
  if (!assistantMessage) {
    throw new Error('No assistant message available for tool event.');
  }

  assistantMessage.toolEvents = assistantMessage.toolEvents || [];
  let existing = assistantMessage.toolEvents.find((event) => event.id === seed.id);
  if (!existing) {
    existing = { ...seed };
    assistantMessage.toolEvents.push(existing);
  }
  return existing;
}

function finalizeToolEvent(
  runtime: RuntimeSessionRecord,
  toolCallId: string,
  toolName: string,
  result: {
    ok: boolean;
    output: string;
    status: string;
    diff?: string;
    exitCode?: number | null;
    summary?: string;
  },
) {
  const existing = ensureToolEvent(runtime, {
    id: toolCallId,
    name: toolName,
    status: result.status,
    args: {},
    output: result.output,
    ok: result.ok,
    diff: result.diff,
    exitCode: result.exitCode,
    summary: result.summary,
  });
  existing.status = result.status;
  existing.output = result.output;
  existing.ok = result.ok;
  existing.diff = result.diff;
  existing.exitCode = result.exitCode;
  existing.summary = result.summary;
}

function summarizeTool(toolName: string, args: unknown) {
  if (toolName === 'bash' && typeof args === 'object' && args && 'command' in args) {
    return String((args as { command?: unknown }).command ?? '');
  }
  if (
    (toolName === 'edit' || toolName === 'write' || toolName === 'read') &&
    typeof args === 'object' &&
    args &&
    'path' in args
  ) {
    return String((args as { path?: unknown }).path ?? '');
  }
  if ((toolName === 'grep' || toolName === 'find') && typeof args === 'object' && args && 'pattern' in args) {
    return String((args as { pattern?: unknown }).pattern ?? '');
  }
  return toolName;
}

function contentToText(content: unknown) {
  if (!Array.isArray(content)) {
    return stringifyUnknown(content);
  }
  return content
    .map((item) => {
      if (item && typeof item === 'object' && 'type' in item && item.type === 'text' && 'text' in item) {
        return String((item as { text?: unknown }).text ?? '');
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function stringifyUnknown(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function mergeToolOutput(current: string, next: string) {
  if (!next.trim()) {
    return current;
  }
  if (!current.trim()) {
    return next;
  }
  return `${current}\n${next}`;
}

function extractDiff(toolName: string, details: unknown) {
  if (toolName !== 'edit') {
    return undefined;
  }
  if (details && typeof details === 'object' && 'diff' in details) {
    return String((details as { diff?: unknown }).diff ?? '');
  }
  return undefined;
}

function extractExitCode(details: unknown) {
  if (!details || typeof details !== 'object') {
    return null;
  }
  if ('exitCode' in details) {
    const value = (details as { exitCode?: unknown }).exitCode;
    return typeof value === 'number' ? value : null;
  }
  return null;
}

function waitForApproval(sessionId: string, requestId: string, approvalId: string) {
  return new Promise<'allow' | 'deny'>((resolve) => {
    pendingApprovals.set(approvalId, {
      sessionId,
      requestId,
      resolve,
    });
  });
}

function emit(event: AgentEvent) {
  for (const listener of eventSubscribers) {
    listener(event);
  }
}

function resolveWorkspaceRoot(workspaceRoot: string) {
  return workspaceRoot.trim() || process.cwd();
}

function resolveDataDir() {
  return process.env.PRISM_AGENT_DATA_DIR?.trim() || path.join(os.homedir(), '.prism-agent');
}

function persistSnapshot(runtime: RuntimeSessionRecord) {
  sessionRegistry.scheduleSnapshotSave(runtime.snapshot);
}

function finalizeAssistantThinking(assistantMessage: { thinking?: string; thinkingStartedAt?: number; thinkingDurationSec?: number }) {
  if (assistantMessage.thinkingDurationSec !== undefined) {
    return;
  }
  if (!assistantMessage.thinking?.trim() || !assistantMessage.thinkingStartedAt) {
    return;
  }
  assistantMessage.thinkingDurationSec = Math.max(
    1,
    Math.round((Date.now() - assistantMessage.thinkingStartedAt) / 1000),
  );
}

function getRuntimeSessions() {
  return sessionRegistry.listRuntimeSessions();
}

function disposeAll() {
  sessionRegistry.disposeAll();
}

async function fetchProviderModels(params: ListModelsParams): Promise<ListModelsResult> {
  const apiUrl = (params.apiUrl || '').trim().replace(/\/+$/, '');
  const apiKey = (params.apiKey || '').trim();

  if (!apiKey) {
    throw new Error('缺少 API Key，无法获取模型列表。');
  }

  if (!apiUrl) {
    throw new Error('缺少 API 地址，无法获取模型列表。');
  }

  const selection = params.providerSelection;

  if (selection === 'openai_chat' || selection === 'openai_responses') {
    const url = `${apiUrl}/models`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => res.statusText)}`);
    const body = (await res.json()) as { data?: Array<{ id?: string }> };
    return { models: normalizeModelIds(body.data?.map((m) => m.id)) };
  }

  if (selection === 'anthropic') {
    const url = `${apiUrl}/v1/models`;
    const res = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => res.statusText)}`);
    const body = (await res.json()) as { data?: Array<{ id?: string }> };
    return { models: normalizeModelIds(body.data?.map((m) => m.id)) };
  }

  if (selection === 'gemini') {
    const url = `${apiUrl}/models?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => res.statusText)}`);
    const body = (await res.json()) as { models?: Array<{ name?: string }> };
    const ids = body.models?.map((m) => (m.name || '').replace(/^models\//, ''));
    return { models: normalizeModelIds(ids) };
  }

  throw new Error(`不支持的服务类型：${selection}`);
}

function normalizeModelIds(ids: Array<string | undefined> | undefined) {
  const unique = new Set<string>();
  for (const id of ids || []) {
    const trimmed = (id || '').trim();
    if (trimmed) unique.add(trimmed);
  }
  return Array.from(unique)
    .sort()
    .map((id) => ({ id }));
}

void main().catch(async (error) => {
  console.error(`[agent-sidecar] ${error instanceof Error ? error.message : String(error)}`);
  await shutdown(1);
});
