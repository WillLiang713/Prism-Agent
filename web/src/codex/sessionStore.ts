import { create } from 'zustand';

import type {
  CodexEvent,
  CodexSessionBootstrap,
  CodexThreadMeta,
  CodexUsage,
} from './client';

export interface CodexToolEvent {
  id: string;
  name: string;
  status: string;
  args: unknown;
  output: string;
  ok: boolean | null;
}

export interface CodexApproval {
  approvalId: string;
  requestId: string;
  toolCallId: string;
  command: string;
  risk: 'low' | 'high';
  reason?: string;
}

export interface CodexMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thinking: string;
  createdAt: number;
  toolEvents: CodexToolEvent[];
  error?: string;
}

export interface CodexSession {
  sessionId: string;
  threadId: string;
  workspaceRoot: string;
  messages: CodexMessage[];
  approvals: CodexApproval[];
  isStreaming: boolean;
  pendingRequestId: string | null;
  lastUsage?: CodexUsage;
  lastError?: string;
}

type RequestBinding = {
  sessionId: string;
  assistantMessageId: string;
};

type CodexSessionState = {
  initialized: boolean;
  backendReady: boolean;
  backendError: string;
  threadList: CodexThreadMeta[];
  sessionOrder: string[];
  sessionsById: Record<string, CodexSession>;
  activeSessionId: string | null;
  requestBindings: Record<string, RequestBinding>;
  setInitialized: (initialized: boolean) => void;
  setBackendReady: (ready: boolean, error?: string) => void;
  setThreadList: (threads: CodexThreadMeta[]) => void;
  activateSession: (sessionId: string) => void;
  upsertSession: (session: CodexSession) => void;
  findSessionByThreadId: (threadId: string) => string | null;
  createPendingMessage: (sessionId: string, text: string, requestId: string) => void;
  clearApproval: (approvalId: string) => void;
  applyEvent: (event: CodexEvent) => void;
  removeThread: (threadId: string) => void;
};

function createAssistantMessage(id: string): CodexMessage {
  return {
    id,
    role: 'assistant',
    text: '',
    thinking: '',
    createdAt: Date.now(),
    toolEvents: [],
  };
}

function normalizeBootstrapMessages(messages: CodexSessionBootstrap['messages']): CodexMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    text: message.text,
    thinking: '',
    createdAt: message.createdAt || Date.now(),
    toolEvents: [],
  }));
}

export const useCodexSessionStore = create<CodexSessionState>((set, get) => ({
  initialized: false,
  backendReady: false,
  backendError: '',
  threadList: [],
  sessionOrder: [],
  sessionsById: {},
  activeSessionId: null,
  requestBindings: {},
  setInitialized: (initialized) => set({ initialized }),
  setBackendReady: (backendReady, error = '') => set({ backendReady, backendError: error }),
  setThreadList: (threadList) => set({ threadList }),
  activateSession: (activeSessionId) => set({ activeSessionId }),
  upsertSession: (session) =>
    set((state) => {
      const nextOrder = state.sessionOrder.includes(session.sessionId)
        ? state.sessionOrder
        : [session.sessionId, ...state.sessionOrder];
      return {
        sessionsById: {
          ...state.sessionsById,
          [session.sessionId]: session,
        },
        sessionOrder: nextOrder,
        activeSessionId: state.activeSessionId || session.sessionId,
      };
    }),
  findSessionByThreadId: (threadId) => {
    const sessions = Object.values(get().sessionsById);
    return sessions.find((session) => session.threadId === threadId)?.sessionId || null;
  },
  createPendingMessage: (sessionId, text, requestId) =>
    set((state) => {
      const session = state.sessionsById[sessionId];
      if (!session) {
        return state;
      }

      const assistantMessageId = `assistant-${requestId}`;
      return {
        sessionsById: {
          ...state.sessionsById,
          [sessionId]: {
            ...session,
            isStreaming: true,
            pendingRequestId: requestId,
            lastError: undefined,
            messages: [
              ...session.messages,
              {
                id: `user-${requestId}`,
                role: 'user',
                text,
                thinking: '',
                createdAt: Date.now(),
                toolEvents: [],
              },
              createAssistantMessage(assistantMessageId),
            ],
          },
        },
        requestBindings: {
          ...state.requestBindings,
          [requestId]: {
            sessionId,
            assistantMessageId,
          },
        },
      };
    }),
  clearApproval: (approvalId) =>
    set((state) => {
      const nextSessions = Object.fromEntries(
        Object.entries(state.sessionsById).map(([sessionId, session]) => [
          sessionId,
          {
            ...session,
            approvals: session.approvals.filter((approval) => approval.approvalId !== approvalId),
          },
        ]),
      );
      return {
        sessionsById: nextSessions,
      };
    }),
  applyEvent: (event) =>
    set((state) => {
      const binding = state.requestBindings[event.requestId];
      const sessionId = binding?.sessionId || event.sessionId;
      const session = state.sessionsById[sessionId];
      if (!session) {
        return state;
      }

      const assistantMessageId = binding?.assistantMessageId;
      const nextSessions = { ...state.sessionsById };
      const nextBindings = { ...state.requestBindings };
      const nextSession: CodexSession = {
        ...session,
        approvals: [...session.approvals],
        messages: session.messages.map((message) => ({
          ...message,
          toolEvents: [...message.toolEvents],
        })),
      };
      nextSessions[sessionId] = nextSession;

      const assistantMessage = assistantMessageId
        ? nextSession.messages.find((message) => message.id === assistantMessageId)
        : nextSession.messages[nextSession.messages.length - 1];

      if (event.type === 'delta' && assistantMessage) {
        if (event.kind === 'thinking') {
          assistantMessage.thinking += event.text;
        } else {
          assistantMessage.text += event.text;
        }
      }

      if (event.type === 'tool_call' && assistantMessage) {
        assistantMessage.toolEvents.push({
          id: event.toolCallId,
          name: event.name,
          status: 'started',
          args: event.args,
          output: '',
          ok: null,
        });
      }

      if (event.type === 'tool_result' && assistantMessage) {
        const existing = assistantMessage.toolEvents.find((tool) => tool.id === event.toolCallId);
        if (existing) {
          existing.status = event.status;
          existing.output = event.output;
          existing.ok = event.ok;
        } else {
          assistantMessage.toolEvents.push({
            id: event.toolCallId,
            name: 'tool',
            status: event.status,
            args: {},
            output: event.output,
            ok: event.ok,
          });
        }
      }

      if (event.type === 'approval_request') {
        nextSession.approvals.push({
          approvalId: event.approvalId,
          requestId: event.requestId,
          toolCallId: event.toolCallId,
          command: event.command,
          risk: event.risk,
          reason: event.reason,
        });
      }

      if (event.type === 'done') {
        nextSession.isStreaming = false;
        nextSession.pendingRequestId = null;
        nextSession.threadId = event.threadId;
        nextSession.lastUsage = event.usage;
        nextSession.approvals = nextSession.approvals.filter(
          (approval) => approval.requestId !== event.requestId,
        );
        delete nextBindings[event.requestId];
      }

      if (event.type === 'error') {
        nextSession.isStreaming = false;
        nextSession.pendingRequestId = null;
        nextSession.lastError = event.message;
        nextSession.approvals = nextSession.approvals.filter(
          (approval) => approval.requestId !== event.requestId,
        );
        if (assistantMessage && !assistantMessage.text.trim()) {
          assistantMessage.error = event.message;
        }
        delete nextBindings[event.requestId];
      }

      return {
        sessionsById: nextSessions,
        requestBindings: nextBindings,
      };
    }),
  removeThread: (threadId) =>
    set((state) => {
      const sessionId = state.findSessionByThreadId(threadId);
      const nextSessionsById = { ...state.sessionsById };
      let nextSessionOrder = [...state.sessionOrder];
      let nextActiveSessionId = state.activeSessionId;

      if (sessionId) {
        delete nextSessionsById[sessionId];
        nextSessionOrder = nextSessionOrder.filter((id) => id !== sessionId);
        if (nextActiveSessionId === sessionId) {
          nextActiveSessionId = nextSessionOrder[0] || null;
        }
      }

      return {
        threadList: state.threadList.filter((t) => t.threadId !== threadId),
        sessionsById: nextSessionsById,
        sessionOrder: nextSessionOrder,
        activeSessionId: nextActiveSessionId,
      };
    }),
}));

export function createSessionFromBootstrap(
  bootstrap: CodexSessionBootstrap,
  workspaceRoot: string,
): CodexSession {
  return {
    sessionId: bootstrap.sessionId,
    threadId: bootstrap.threadId,
    workspaceRoot,
    messages: normalizeBootstrapMessages(bootstrap.messages),
    approvals: [],
    isStreaming: false,
    pendingRequestId: null,
  };
}
