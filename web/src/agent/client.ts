import { buildApiUrl, runtimeConfig } from '../lib/runtime';

export type AgentReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
export type AgentApprovalMode = 'manual' | 'auto';

export interface AgentHealth {
  sidecarVersion: string;
  agentVersion: string;
  loggedIn: boolean;
}

export interface AgentRuntimeConfig {
  provider: string;
  model: string;
  providerSelection?: 'openai_chat' | 'openai_responses' | 'anthropic' | 'gemini';
  apiKey?: string;
  apiUrl?: string;
  systemPrompt?: string;
  serviceName?: string;
}

export interface AgentRuntimeStatus {
  configured: boolean;
  ready: boolean;
  reason: string;
  provider?: string;
  model?: string;
  serviceName?: string;
}

export interface AgentThinkingTimelineItem {
  id: string;
  type: 'thinking';
  text: string;
  status: 'streaming' | 'done' | 'aborted';
  startedAt: number;
  endedAt?: number;
  durationSec?: number;
}

export interface AgentToolTimelineItem {
  id: string;
  type: 'tool';
  toolCallId: string;
  name: string;
  status: 'running' | 'done' | 'error' | 'blocked';
  args: unknown;
  output: string;
  ok: boolean | null;
  diff?: string;
  exitCode?: number | null;
  summary?: string;
  skillName?: string | null;
}

export type AgentTimelineItem = AgentThinkingTimelineItem | AgentToolTimelineItem;

export interface AgentSessionMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  timeline?: AgentTimelineItem[];
  thinking?: string;
  thinkingStartedAt?: number;
  thinkingDurationSec?: number;
  toolEvents?: Array<{
    id: string;
    name: string;
    status: string;
    args: unknown;
    output: string;
    ok: boolean | null;
    diff?: string;
    exitCode?: number | null;
    summary?: string;
    skillName?: string | null;
  }>;
}

export interface AgentSessionBootstrap {
  sessionId: string;
  threadId: string;
  messages: AgentSessionMessage[];
  thread?: AgentThreadMeta;
  skills: {
    items: Array<{
      id: string;
      name: string;
      description: string;
      status: 'loaded' | 'error';
      source: string;
    }>;
    diagnostics: string[];
  };
}

export interface AgentThreadMeta {
  threadId: string;
  preview: string;
  name: string | null;
  cwd: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  status: string;
  modelProvider: string;
  path: string | null;
}

export interface AgentUsage {
  input: number;
  output: number;
  cachedInput?: number;
  reasoningOutput?: number;
  total?: number;
}

export type AgentEvent =
  | {
      type: 'delta';
      requestId: string;
      sessionId: string;
      itemId: string;
      kind: 'text' | 'thinking';
      text: string;
    }
  | {
      type: 'thinking_start';
      requestId: string;
      sessionId: string;
      itemId: string;
      startedAt: number;
    }
  | {
      type: 'thinking_delta';
      requestId: string;
      sessionId: string;
      itemId: string;
      text: string;
    }
  | {
      type: 'thinking_end';
      requestId: string;
      sessionId: string;
      itemId: string;
      endedAt: number;
      durationSec: number;
      status: 'done' | 'aborted';
    }
  | {
      type: 'tool_call';
      requestId: string;
      sessionId: string;
      toolCallId: string;
      name: string;
      args: unknown;
      status: 'started';
      summary?: string;
      skillName?: string | null;
    }
  | {
      type: 'tool_result';
      requestId: string;
      sessionId: string;
      toolCallId: string;
      ok: boolean;
      output: string;
      status: string;
      diff?: string;
      exitCode?: number | null;
      summary?: string;
      skillName?: string | null;
    }
  | {
      type: 'skills_snapshot';
      sessionId: string;
      skills: AgentSessionBootstrap['skills'];
    }
  | {
      type: 'approval_request';
      requestId: string;
      sessionId: string;
      approvalId: string;
      toolCallId: string;
      command: string;
      risk: 'low' | 'high';
      reason?: string;
    }
  | {
      type: 'done';
      requestId: string;
      sessionId: string;
      threadId: string;
      usage?: AgentUsage;
    }
  | {
      type: 'error';
      requestId: string;
      sessionId: string;
      message: string;
    }
  | {
      type: 'thread_name_updated';
      requestId: string;
      sessionId: string;
      threadId: string;
      name: string;
    };

export interface TitleModelPayload {
  providerSelection?: string;
  provider?: string;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface UploadImagePayload {
  name: string;
  mediaType: string;
  dataUrl: string;
}

function assertBackendConfigured() {
  if (!runtimeConfig.apiBase) {
    throw new Error(runtimeConfig.startupError || '当前未配置可用的 Agent 后端。');
  }
}

function createHeaders(contentType = true) {
  const headers = new Headers();
  if (contentType) {
    headers.set('Content-Type', 'application/json');
  }
  if (runtimeConfig.authToken) {
    headers.set('Authorization', `Bearer ${runtimeConfig.authToken}`);
  }
  return headers;
}

async function requestJson<T>(input: string, init: RequestInit = {}) {
  assertBackendConfigured();
  const response = await fetch(buildApiUrl(input), {
    ...init,
    headers: init.headers ?? createHeaders(init.body !== undefined),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message || `请求失败（${response.status}）`;
  } catch {
    return `请求失败（${response.status}）`;
  }
}

export async function agentHealth() {
  return requestJson<AgentHealth>('/api/agent/health', {
    headers: createHeaders(false),
  });
}

export async function agentStartSession(workspaceRoot = '') {
  return requestJson<AgentSessionBootstrap>('/api/agent/sessions', {
    method: 'POST',
    body: JSON.stringify({ workspaceRoot }),
  });
}

export async function agentResumeSession(threadId: string, workspaceRoot = '') {
  return requestJson<AgentSessionBootstrap>('/api/agent/sessions/resume', {
    method: 'POST',
    body: JSON.stringify({ threadId, workspaceRoot }),
  });
}

export async function agentSendMessage(
  payload: {
    requestId: string;
    sessionId: string;
    text: string;
    images: UploadImagePayload[];
    reasoningEffort: AgentReasoningEffort;
    approvalMode: AgentApprovalMode;
    config: AgentRuntimeConfig;
    titleModel?: TitleModelPayload;
  },
  onEvent: (event: AgentEvent) => void,
) {
  assertBackendConfigured();
  const response = await fetch(buildApiUrl('/api/agent/requests'), {
    method: 'POST',
    headers: createHeaders(true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (!response.body) {
    throw new Error('后端未返回流式响应。');
  }

  await readNdjsonStream(response.body, onEvent);
  return { requestId: payload.requestId };
}

export async function agentValidateConfig(config: AgentRuntimeConfig) {
  return requestJson<AgentRuntimeStatus>('/api/agent/config/validate', {
    method: 'POST',
    body: JSON.stringify({ config }),
  });
}

export async function agentCancel(requestId: string) {
  await requestJson(`/api/agent/requests/${encodeURIComponent(requestId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function agentRespondApproval(approvalId: string, decision: 'allow' | 'deny') {
  await requestJson(`/api/agent/approvals/${encodeURIComponent(approvalId)}`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}

export async function agentListThreads() {
  return requestJson<{ threads: AgentThreadMeta[] }>('/api/agent/threads', {
    headers: createHeaders(false),
  });
}

export type ListModelsProviderSelection =
  | 'openai_chat'
  | 'openai_responses'
  | 'anthropic'
  | 'gemini';

export async function agentListModels(payload: {
  providerSelection: ListModelsProviderSelection;
  apiUrl?: string;
  apiKey?: string;
}) {
  return requestJson<{ models: Array<{ id: string }> }>('/api/agent/models/list', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function agentArchiveThread(threadId: string) {
  await requestJson(`/api/agent/threads/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
    headers: createHeaders(false),
  });
}

export async function agentRenameThread(threadId: string, name: string) {
  return requestJson<{ thread: AgentThreadMeta | null }>(
    `/api/agent/threads/${encodeURIComponent(threadId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    },
  );
}

export async function agentRegenerateThreadTitle(
  threadId: string,
  titleModel: TitleModelPayload | undefined,
) {
  return requestJson<{ thread: AgentThreadMeta | null; name: string | null }>(
    `/api/agent/threads/${encodeURIComponent(threadId)}/regenerate-title`,
    {
      method: 'POST',
      body: JSON.stringify({ titleModel }),
    },
  );
}

async function readNdjsonStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: AgentEvent) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          onEvent(JSON.parse(line) as AgentEvent);
        }
        newlineIndex = buffer.indexOf('\n');
      }
    }

    const trailing = buffer.trim();
    if (trailing) {
      onEvent(JSON.parse(trailing) as AgentEvent);
    }
  } finally {
    reader.releaseLock();
  }
}
