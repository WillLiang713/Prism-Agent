import { create } from 'zustand';

import type {
  AgentEvent,
  AgentSessionBootstrap,
  AgentThreadMeta,
  AgentUsage,
} from './client';

export interface AgentToolEvent {
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

export interface AgentSkillsSnapshot {
  items: Array<{
    id: string;
    name: string;
    description: string;
    status: 'loaded' | 'error';
    source: string;
  }>;
  diagnostics: string[];
}

export interface AgentApproval {
  approvalId: string;
  requestId: string;
  toolCallId: string;
  command: string;
  risk: 'low' | 'high';
  reason?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thinking: string;
  createdAt: number;
  thinkingStartedAt?: number;
  thinkingDurationSec?: number;
  toolEvents: AgentToolEvent[];
  error?: string;
}

export interface AgentSession {
  sessionId: string;
  threadId: string;
  workspaceRoot: string;
  messages: AgentMessage[];
  skills: AgentSkillsSnapshot;
  approvals: AgentApproval[];
  isStreaming: boolean;
  pendingRequestId: string | null;
  lastUsage?: AgentUsage;
  lastError?: string;
}

type RequestBinding = {
  sessionId: string;
  assistantMessageId: string;
};

type AgentSessionState = {
  initialized: boolean;
  backendReady: boolean;
  backendError: string;
  threadList: AgentThreadMeta[];
  sessionOrder: string[];
  sessionsById: Record<string, AgentSession>;
  activeSessionId: string | null;
  requestBindings: Record<string, RequestBinding>;
  setInitialized: (initialized: boolean) => void;
  setBackendReady: (ready: boolean, error?: string) => void;
  setThreadList: (threads: AgentThreadMeta[]) => void;
  activateSession: (sessionId: string) => void;
  upsertSession: (session: AgentSession) => void;
  findSessionByThreadId: (threadId: string) => string | null;
  createPendingMessage: (sessionId: string, text: string, requestId: string) => void;
  clearApproval: (approvalId: string) => void;
  applyEvent: (event: AgentEvent) => void;
  removeThread: (threadId: string) => void;
};

function createAssistantMessage(id: string): AgentMessage {
  return {
    id,
    role: 'assistant',
    text: '',
    thinking: '',
    createdAt: Date.now(),
    thinkingStartedAt: undefined,
    thinkingDurationSec: undefined,
    toolEvents: [],
  };
}

function findAssistantMessageIndex(messages: AgentMessage[], assistantMessageId?: string) {
  if (assistantMessageId) {
    return messages.findIndex((message) => message.id === assistantMessageId);
  }
  return messages.length - 1;
}

function normalizeBootstrapMessages(messages: AgentSessionBootstrap['messages']): AgentMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    text: message.text,
    thinking: message.thinking || '',
    createdAt: message.createdAt || Date.now(),
    thinkingStartedAt: message.thinkingStartedAt,
    thinkingDurationSec: message.thinkingDurationSec,
    toolEvents: (message.toolEvents || []).map((event) => ({
      id: event.id,
      name: event.name,
      status: event.status,
      args: event.args,
      output: event.output,
      ok: event.ok,
      diff: event.diff,
      exitCode: event.exitCode,
      summary: event.summary,
      skillName: event.skillName,
    })),
  }));
}

export const useAgentSessionStore = create<AgentSessionState>((set, get) => ({
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
      if (event.type === 'skills_snapshot') {
        const session = state.sessionsById[event.sessionId];
        if (!session) {
          return state;
        }

        return {
          sessionsById: {
            ...state.sessionsById,
            [event.sessionId]: {
              ...session,
              skills: event.skills,
            },
          },
        };
      }

      const binding = state.requestBindings[event.requestId];
      const sessionId = binding?.sessionId || event.sessionId;
      const session = state.sessionsById[sessionId];
      if (!session) {
        return state;
      }

      const assistantMessageId = binding?.assistantMessageId;
      const assistantMessageIndex = findAssistantMessageIndex(session.messages, assistantMessageId);
      let nextSession = session;
      let nextBindings = state.requestBindings;

      const updateAssistantMessage = (
        updater: (message: AgentMessage) => AgentMessage,
      ) => {
        if (assistantMessageIndex < 0) {
          return;
        }

        const currentMessage = nextSession.messages[assistantMessageIndex];
        const nextMessage = updater(currentMessage);
        if (nextMessage === currentMessage) {
          return;
        }

        const nextMessages = [...nextSession.messages];
        nextMessages[assistantMessageIndex] = nextMessage;
        nextSession = {
          ...nextSession,
          messages: nextMessages,
        };
      };

      if (event.type === 'delta') {
        updateAssistantMessage((message) =>
          event.kind === 'thinking'
            ? { ...message, thinking: message.thinking + event.text }
            : { ...message, text: message.text + event.text },
        );
      }

      if (event.type === 'tool_call') {
        updateAssistantMessage((message) => ({
          ...message,
          toolEvents: [
            ...message.toolEvents,
            {
              id: event.toolCallId,
              name: event.name,
              status: 'started',
              args: event.args,
              output: '',
              ok: null,
              summary: event.summary,
              skillName: event.skillName,
            },
          ],
        }));
      }

      if (event.type === 'tool_result') {
        updateAssistantMessage((message) => {
          const toolIndex = message.toolEvents.findIndex((tool) => tool.id === event.toolCallId);
          if (toolIndex === -1) {
            return {
              ...message,
              toolEvents: [
                ...message.toolEvents,
                {
                  id: event.toolCallId,
                  name: 'tool',
                  status: event.status,
                  args: {},
                  output: event.output,
                  ok: event.ok,
                  diff: event.diff,
                  exitCode: event.exitCode,
                  summary: event.summary,
                  skillName: event.skillName,
                },
              ],
            };
          }

          const currentTool = message.toolEvents[toolIndex];
          const nextToolEvents = [...message.toolEvents];
          nextToolEvents[toolIndex] = {
            ...currentTool,
            status: event.status,
            output: event.output,
            ok: event.ok,
            diff: event.diff,
            exitCode: event.exitCode,
            summary: event.summary,
            skillName: event.skillName,
          };
          return {
            ...message,
            toolEvents: nextToolEvents,
          };
        });
      }

      if (event.type === 'approval_request') {
        nextSession = {
          ...nextSession,
          approvals: [
            ...nextSession.approvals,
            {
              approvalId: event.approvalId,
              requestId: event.requestId,
              toolCallId: event.toolCallId,
              command: event.command,
              risk: event.risk,
              reason: event.reason,
            },
          ],
        };
      }

      if (event.type === 'done') {
        nextSession = {
          ...nextSession,
          isStreaming: false,
          pendingRequestId: null,
          threadId: event.threadId,
          lastUsage: event.usage,
          approvals: nextSession.approvals.filter((approval) => approval.requestId !== event.requestId),
        };

        if (event.requestId in state.requestBindings) {
          nextBindings = { ...state.requestBindings };
          delete nextBindings[event.requestId];
        }
      }

      if (event.type === 'error') {
        nextSession = {
          ...nextSession,
          isStreaming: false,
          pendingRequestId: null,
          lastError: event.message,
          approvals: nextSession.approvals.filter((approval) => approval.requestId !== event.requestId),
        };

        updateAssistantMessage((message) => {
          if (message.text.trim()) {
            return message;
          }
          return {
            ...message,
            error: event.message,
          };
        });

        if (event.requestId in state.requestBindings) {
          nextBindings = { ...state.requestBindings };
          delete nextBindings[event.requestId];
        }
      }

      if (nextSession === session && nextBindings === state.requestBindings) {
        return state;
      }

      return {
        sessionsById: {
          ...state.sessionsById,
          [sessionId]: nextSession,
        },
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
  bootstrap: AgentSessionBootstrap,
  workspaceRoot: string,
): AgentSession {
  return {
    sessionId: bootstrap.sessionId,
    threadId: bootstrap.threadId,
    workspaceRoot,
    messages: normalizeBootstrapMessages(bootstrap.messages),
    skills: bootstrap.skills,
    approvals: [],
    isStreaming: false,
    pendingRequestId: null,
  };
}
