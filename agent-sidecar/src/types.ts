export interface JsonRpcRequest<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: T;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface SidecarHealth {
  sidecarVersion: string;
  agentVersion: string;
  loggedIn: boolean;
}

export interface AgentRuntimeConfig {
  provider: string;
  model: string;
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

export interface StartSessionParams {
  workspaceRoot: string;
}

export interface ResumeSessionParams {
  workspaceRoot: string;
  threadId: string;
}

export interface SendMessageImagePayload {
  name: string;
  mediaType: string;
  dataUrl: string;
}

export interface SendMessageParams {
  requestId: string;
  sessionId: string;
  text: string;
  images?: SendMessageImagePayload[];
  reasoningEffort?: AgentReasoningEffort;
  approvalMode?: AgentApprovalMode;
  config?: AgentRuntimeConfig;
}

export interface CancelParams {
  requestId: string;
}

export interface RespondApprovalParams {
  approvalId: string;
  decision: 'allow' | 'deny';
}

export type ProviderSelection = 'openai_chat' | 'openai_responses' | 'anthropic' | 'gemini';

export interface ListModelsParams {
  providerSelection: ProviderSelection;
  apiUrl?: string;
  apiKey?: string;
}

export interface ListModelsResult {
  models: Array<{ id: string }>;
}

export interface SkillStatusItem {
  id: string;
  name: string;
  description: string;
  status: 'loaded' | 'error';
  source: string;
}

export interface SkillsSnapshot {
  items: SkillStatusItem[];
  diagnostics: string[];
}

export interface AgentUsage {
  input: number;
  output: number;
  cachedInput?: number;
  reasoningOutput?: number;
  total?: number;
}

export interface AgentThreadMeta {
  threadId: string;
  preview: string;
  name: string | null;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  status: string;
  modelProvider: string;
  path: string | null;
}

export interface AgentSessionToolEvent {
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
}

export interface AgentSessionMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  thinking?: string;
  thinkingStartedAt?: number;
  thinkingDurationSec?: number;
  toolEvents?: AgentSessionToolEvent[];
}

export interface SessionBootstrapResult {
  sessionId: string;
  threadId: string;
  messages: AgentSessionMessage[];
  thread?: AgentThreadMeta;
  skills: SkillsSnapshot;
}

export type AgentReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'none';
export type AgentApprovalMode = 'manual' | 'auto';

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
      skills: SkillsSnapshot;
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
    };

export interface OuterMethods {
  health: SidecarHealth;
  startSession: SessionBootstrapResult;
  resumeSession: SessionBootstrapResult;
  sendMessage: { requestId: string };
  validateConfig: AgentRuntimeStatus;
  cancel: null;
  respondApproval: null;
  listThreads: { threads: AgentThreadMeta[] };
  archiveThread: null;
  listModels: ListModelsResult;
}
