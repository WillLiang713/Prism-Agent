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
  codexVersion: string;
  loggedIn: boolean;
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
  reasoningEffort?: CodexReasoningEffort;
}

export interface CancelParams {
  requestId: string;
}

export interface RespondApprovalParams {
  approvalId: string;
  decision: 'allow' | 'deny';
}

export interface CodexUsage {
  input: number;
  output: number;
  cachedInput?: number;
  reasoningOutput?: number;
  total?: number;
}

export interface CodexThreadMeta {
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

export interface CodexSessionMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
}

export interface SessionBootstrapResult {
  sessionId: string;
  threadId: string;
  messages: CodexSessionMessage[];
  thread?: CodexThreadMeta;
}

export type CodexReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'none';

export type CodexEvent =
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
    }
  | {
      type: 'tool_result';
      requestId: string;
      sessionId: string;
      toolCallId: string;
      ok: boolean;
      output: string;
      status: string;
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
      usage?: CodexUsage;
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
  cancel: null;
  respondApproval: null;
  listThreads: { threads: CodexThreadMeta[] };
  archiveThread: null;
}

export interface AppServerThread {
  id: string;
  preview: string;
  name: string | null;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  path: string | null;
  modelProvider: string;
  status: { type: string };
  turns: AppServerTurn[];
}

export interface AppServerTurn {
  id: string;
  status: string;
  items: AppServerThreadItem[];
}

export type AppServerThreadItem =
  | {
      type: 'userMessage';
      id: string;
      content: Array<{ type: 'text'; text: string }>;
    }
  | {
      type: 'agentMessage';
      id: string;
      text: string;
    }
  | {
      type: 'reasoning';
      id: string;
      summary?: string[];
      content?: string[];
    }
  | {
      type: 'commandExecution';
      id: string;
      command: string;
      cwd: string;
      status: string;
      aggregatedOutput: string | null;
      exitCode: number | null;
      commandActions?: unknown[];
    }
  | {
      type: 'fileChange';
      id: string;
      status: string;
      changes: Array<{
        path: string;
        kind: unknown;
        diff?: string;
      }>;
    }
  | {
      type: 'mcpToolCall';
      id: string;
      server: string;
      tool: string;
      status: string;
      arguments: unknown;
      result?: unknown;
      error?: { message?: string } | null;
    }
  | {
      type: 'dynamicToolCall';
      id: string;
      tool: string;
      status: string;
      arguments: unknown;
      success?: boolean | null;
      contentItems?: unknown[] | null;
    }
  | {
      type: string;
      id: string;
      [key: string]: unknown;
    };

export interface AppServerNotification {
  method: string;
  params: Record<string, unknown>;
}

export interface AppServerServerRequest {
  method: string;
  id: number;
  params: Record<string, unknown>;
}
