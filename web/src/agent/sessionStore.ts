import { create } from 'zustand';

import type {
  AgentEvent,
  AgentSessionBootstrap,
  AgentThreadMeta,
  AgentTimelineItem,
  AgentToolTimelineItem,
  AgentUsage,
} from './client';

export type AgentToolStatus = 'running' | 'done' | 'error' | 'blocked';

export interface AgentToolEvent extends AgentToolTimelineItem {}

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
  createdAt: number;
  timeline: AgentTimelineItem[];
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
    createdAt: Date.now(),
    timeline: [],
  };
}

function createUserMessage(id: string, text: string): AgentMessage {
  return {
    id,
    role: 'user',
    text,
    createdAt: Date.now(),
    timeline: [],
  };
}

function findAssistantMessageIndex(messages: AgentMessage[], assistantMessageId?: string) {
  if (assistantMessageId) {
    return messages.findIndex((message) => message.id === assistantMessageId);
  }
  return messages.length - 1;
}

function createThinkingTimelineItem(options?: {
  id?: string;
  text?: string;
  status?: 'streaming' | 'done' | 'aborted';
  startedAt?: number;
  endedAt?: number;
  durationSec?: number;
}) {
  const startedAt = options?.startedAt ?? Date.now();
  return {
    id: options?.id ?? `thinking-${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'thinking' as const,
    text: options?.text ?? '',
    status: options?.status ?? 'streaming',
    startedAt,
    endedAt: options?.endedAt,
    durationSec: options?.durationSec,
  };
}

function normalizeToolStatus(status?: string): AgentToolStatus {
  switch (status) {
    case 'done':
    case 'completed':
      return 'done';
    case 'error':
      return 'error';
    case 'blocked':
      return 'blocked';
    default:
      return 'running';
  }
}

function createToolTimelineItem(seed: {
  id: string;
  toolCallId?: string;
  name: string;
  status?: string;
  args: unknown;
  output: string;
  ok: boolean | null;
  diff?: string;
  exitCode?: number | null;
  summary?: string;
  skillName?: string | null;
}): AgentToolTimelineItem {
  return {
    id: seed.id,
    type: 'tool',
    toolCallId: seed.toolCallId ?? seed.id,
    name: seed.name,
    status: normalizeToolStatus(seed.status),
    args: seed.args,
    output: seed.output,
    ok: seed.ok,
    diff: seed.diff,
    exitCode: seed.exitCode,
    summary: seed.summary,
    skillName: seed.skillName,
  };
}

function resolveDurationSec(startedAt: number | undefined, endedAt: number, durationSec?: number) {
  if (typeof durationSec === 'number' && durationSec > 0) {
    return durationSec;
  }
  if (!startedAt) {
    return undefined;
  }
  return Math.max(1, Math.round((endedAt - startedAt) / 1000));
}

function findOpenThinkingIndex(timeline: AgentTimelineItem[]) {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const item = timeline[index];
    if (item.type === 'thinking' && item.status === 'streaming') {
      return index;
    }
  }
  return -1;
}

function closeOpenThinkingItem(
  message: AgentMessage,
  options: { status: 'done' | 'aborted'; endedAt?: number; durationSec?: number },
) {
  const openIndex = findOpenThinkingIndex(message.timeline);
  if (openIndex === -1) {
    return message;
  }

  const endedAt = options.endedAt ?? Date.now();
  const current = message.timeline[openIndex];
  if (current.type !== 'thinking') {
    return message;
  }

  const nextTimeline = [...message.timeline];
  nextTimeline[openIndex] = {
    ...current,
    status: options.status,
    endedAt,
    durationSec: resolveDurationSec(current.startedAt, endedAt, options.durationSec),
  };

  return {
    ...message,
    timeline: nextTimeline,
  };
}

function startThinkingItem(message: AgentMessage, startedAt: number) {
  const closedMessage = closeOpenThinkingItem(message, {
    status: 'aborted',
    endedAt: startedAt,
  });

  return {
    ...closedMessage,
    timeline: [
      ...closedMessage.timeline,
      createThinkingTimelineItem({
        startedAt,
      }),
    ],
  };
}

function appendThinkingDelta(message: AgentMessage, text: string, startedAt = Date.now()) {
  const openIndex = findOpenThinkingIndex(message.timeline);
  if (openIndex === -1) {
    return {
      ...message,
      timeline: [
        ...message.timeline,
        createThinkingTimelineItem({
          startedAt,
          text,
        }),
      ],
    };
  }

  const current = message.timeline[openIndex];
  if (current.type !== 'thinking') {
    return message;
  }

  const nextTimeline = [...message.timeline];
  nextTimeline[openIndex] = {
    ...current,
    text: current.text + text,
  };

  return {
    ...message,
    timeline: nextTimeline,
  };
}

function appendToolCall(
  message: AgentMessage,
  event: Extract<AgentEvent, { type: 'tool_call' }>,
) {
  const closedMessage = closeOpenThinkingItem(message, { status: 'done' });
  return {
    ...closedMessage,
    timeline: [
      ...closedMessage.timeline,
      createToolTimelineItem({
        id: event.toolCallId,
        toolCallId: event.toolCallId,
        name: event.name,
        status: 'running',
        args: event.args,
        output: '',
        ok: null,
        summary: event.summary,
        skillName: event.skillName,
      }),
    ],
  };
}

function applyToolResult(
  message: AgentMessage,
  event: Extract<AgentEvent, { type: 'tool_result' }>,
) {
  const toolIndex = message.timeline.findIndex(
    (item) => item.type === 'tool' && item.toolCallId === event.toolCallId,
  );

  if (toolIndex === -1) {
    return {
      ...message,
      timeline: [
        ...message.timeline,
        createToolTimelineItem({
          id: event.toolCallId,
          toolCallId: event.toolCallId,
          name: 'tool',
          status: event.status,
          args: {},
          output: event.output,
          ok: event.ok,
          diff: event.diff,
          exitCode: event.exitCode,
          summary: event.summary,
          skillName: event.skillName,
        }),
      ],
    };
  }

  const current = message.timeline[toolIndex];
  if (current.type !== 'tool') {
    return message;
  }

  const nextTimeline = [...message.timeline];
  nextTimeline[toolIndex] = {
    ...current,
    status: normalizeToolStatus(event.status),
    output: event.output,
    ok: event.ok,
    diff: event.diff,
    exitCode: event.exitCode,
    summary: event.summary,
    skillName: event.skillName,
  };

  return {
    ...message,
    timeline: nextTimeline,
  };
}

function finalizeTimeline(message: AgentMessage, outcome: 'done' | 'aborted') {
  const nextMessage = closeOpenThinkingItem(message, { status: outcome });
  const nextTimeline: AgentTimelineItem[] = nextMessage.timeline.map((item) => {
    if (item.type !== 'tool' || item.status !== 'running') {
      return item;
    }
    return {
      ...item,
      status: outcome === 'done' ? ('done' as const) : ('error' as const),
    };
  });

  if (nextTimeline === nextMessage.timeline) {
    return nextMessage;
  }

  return {
    ...nextMessage,
    timeline: nextTimeline,
  };
}

function normalizeBootstrapTimeline(message: AgentSessionBootstrap['messages'][number]) {
  if (message.timeline?.length) {
    return message.timeline.map((item) => {
      if (item.type === 'thinking') {
        return createThinkingTimelineItem({
          id: item.id,
          text: item.text,
          status: item.status,
          startedAt: item.startedAt,
          endedAt: item.endedAt,
          durationSec: item.durationSec,
        });
      }

      return createToolTimelineItem({
        id: item.id,
        toolCallId: item.toolCallId,
        name: item.name,
        status: item.status,
        args: item.args,
        output: item.output,
        ok: item.ok,
        diff: item.diff,
        exitCode: item.exitCode,
        summary: item.summary,
        skillName: item.skillName,
      });
    });
  }

  const timeline: AgentTimelineItem[] = [];
  if (message.thinking || message.thinkingStartedAt || message.thinkingDurationSec) {
    timeline.push(
      createThinkingTimelineItem({
        id: `${message.id}-thinking`,
        text: message.thinking || '',
        status: 'done',
        startedAt: message.thinkingStartedAt ?? message.createdAt ?? Date.now(),
        durationSec: message.thinkingDurationSec,
        endedAt:
          message.thinkingStartedAt && message.thinkingDurationSec
            ? message.thinkingStartedAt + message.thinkingDurationSec * 1000
            : undefined,
      }),
    );
  }

  for (const event of message.toolEvents || []) {
    timeline.push(
      createToolTimelineItem({
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
      }),
    );
  }

  return timeline;
}

function normalizeBootstrapMessages(messages: AgentSessionBootstrap['messages']): AgentMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    text: message.text,
    createdAt: message.createdAt || Date.now(),
    timeline: normalizeBootstrapTimeline(message),
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
              createUserMessage(`user-${requestId}`, text),
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

      const updateAssistantMessage = (updater: (message: AgentMessage) => AgentMessage) => {
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
            ? appendThinkingDelta(message, event.text)
            : { ...message, text: message.text + event.text },
        );
      }

      if (event.type === 'thinking_start') {
        updateAssistantMessage((message) => startThinkingItem(message, event.startedAt));
      }

      if (event.type === 'thinking_delta') {
        updateAssistantMessage((message) => appendThinkingDelta(message, event.text));
      }

      if (event.type === 'thinking_end') {
        updateAssistantMessage((message) =>
          closeOpenThinkingItem(message, {
            status: event.status,
            endedAt: event.endedAt,
            durationSec: event.durationSec,
          }),
        );
      }

      if (event.type === 'tool_call') {
        updateAssistantMessage((message) => appendToolCall(message, event));
      }

      if (event.type === 'tool_result') {
        updateAssistantMessage((message) => applyToolResult(message, event));
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
        updateAssistantMessage((message) => finalizeTimeline(message, 'done'));
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
        updateAssistantMessage((message) => {
          const nextMessage = finalizeTimeline(message, 'aborted');
          if (nextMessage.text.trim()) {
            return nextMessage;
          }
          return {
            ...nextMessage,
            error: event.message,
          };
        });

        nextSession = {
          ...nextSession,
          isStreaming: false,
          pendingRequestId: null,
          lastError: event.message,
          approvals: nextSession.approvals.filter((approval) => approval.requestId !== event.requestId),
        };

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
        threadList: state.threadList.filter((thread) => thread.threadId !== threadId),
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
