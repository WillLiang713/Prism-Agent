import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { isDesktopRuntime } from '../lib/runtime';

export type CodexReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface CodexHealth {
  sidecarVersion: string;
  codexVersion: string;
  loggedIn: boolean;
}

export interface CodexSessionMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
}

export interface CodexSessionBootstrap {
  sessionId: string;
  threadId: string;
  messages: CodexSessionMessage[];
  thread?: CodexThreadMeta;
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

export interface CodexUsage {
  input: number;
  output: number;
  cachedInput?: number;
  reasoningOutput?: number;
  total?: number;
}

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

export interface UploadImagePayload {
  name: string;
  mediaType: string;
  dataUrl: string;
}

function assertDesktopRuntime() {
  if (!isDesktopRuntime()) {
    throw new Error('Codex backend 仅支持桌面模式');
  }
}

export async function codexHealth() {
  assertDesktopRuntime();
  return invoke<CodexHealth>('codex_health');
}

export async function codexStartSession(workspaceRoot = '') {
  assertDesktopRuntime();
  return invoke<CodexSessionBootstrap>('codex_start_session', {
    payload: { workspaceRoot },
  });
}

export async function codexResumeSession(threadId: string, workspaceRoot = '') {
  assertDesktopRuntime();
  return invoke<CodexSessionBootstrap>('codex_resume_session', {
    payload: { threadId, workspaceRoot },
  });
}

export async function codexSendMessage(payload: {
  requestId: string;
  sessionId: string;
  text: string;
  images: UploadImagePayload[];
  reasoningEffort: CodexReasoningEffort;
}) {
  assertDesktopRuntime();
  return invoke<{ requestId: string }>('codex_send_message', {
    payload,
  });
}

export async function codexCancel(requestId: string) {
  assertDesktopRuntime();
  return invoke('codex_cancel', {
    payload: { requestId },
  });
}

export async function codexRespondApproval(approvalId: string, decision: 'allow' | 'deny') {
  assertDesktopRuntime();
  return invoke('codex_respond_approval', {
    payload: { approvalId, decision },
  });
}

export async function codexListThreads() {
  assertDesktopRuntime();
  return invoke<{ threads: CodexThreadMeta[] }>('codex_list_threads');
}

export async function codexArchiveThread(threadId: string) {
  assertDesktopRuntime();
  return invoke('codex_archive_thread', {
    payload: { threadId },
  });
}

export async function listenCodexEvents(callback: (event: CodexEvent) => void) {
  assertDesktopRuntime();
  return listen<CodexEvent>('codex://event', (event) => callback(event.payload));
}
