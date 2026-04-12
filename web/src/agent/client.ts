import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { isDesktopRuntime } from '../lib/runtime';

export type AgentReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface AgentHealth {
  sidecarVersion: string;
  agentVersion: string;
  loggedIn: boolean;
}

export interface AgentSessionMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  thinking?: string;
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
    };

export interface UploadImagePayload {
  name: string;
  mediaType: string;
  dataUrl: string;
}

function assertDesktopRuntime() {
  if (!isDesktopRuntime()) {
    throw new Error('Agent backend 仅支持桌面模式');
  }
}

export async function agentHealth() {
  assertDesktopRuntime();
  return invoke<AgentHealth>('agent_health');
}

export async function agentStartSession(workspaceRoot = '') {
  assertDesktopRuntime();
  return invoke<AgentSessionBootstrap>('agent_start_session', {
    payload: { workspaceRoot },
  });
}

export async function agentResumeSession(threadId: string, workspaceRoot = '') {
  assertDesktopRuntime();
  return invoke<AgentSessionBootstrap>('agent_resume_session', {
    payload: { threadId, workspaceRoot },
  });
}

export async function agentSendMessage(payload: {
  requestId: string;
  sessionId: string;
  text: string;
  images: UploadImagePayload[];
  reasoningEffort: AgentReasoningEffort;
}) {
  assertDesktopRuntime();
  return invoke<{ requestId: string }>('agent_send_message', {
    payload,
  });
}

export async function agentCancel(requestId: string) {
  assertDesktopRuntime();
  return invoke('agent_cancel', {
    payload: { requestId },
  });
}

export async function agentRespondApproval(approvalId: string, decision: 'allow' | 'deny') {
  assertDesktopRuntime();
  return invoke('agent_respond_approval', {
    payload: { approvalId, decision },
  });
}

export async function agentListThreads() {
  assertDesktopRuntime();
  return invoke<{ threads: AgentThreadMeta[] }>('agent_list_sessions');
}

export async function agentArchiveThread(threadId: string) {
  assertDesktopRuntime();
  return invoke('agent_delete_session', {
    payload: { threadId },
  });
}

export async function listenAgentEvents(callback: (event: AgentEvent) => void) {
  assertDesktopRuntime();
  return listen<AgentEvent>('agent://event', (event) => callback(event.payload));
}
