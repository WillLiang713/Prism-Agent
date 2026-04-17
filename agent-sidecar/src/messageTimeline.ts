import type {
  AgentSessionMessage,
  AgentSessionToolEvent,
  AgentToolTimelineItem,
  AgentTimelineItem,
} from './types.js';

type FinalThinkingStatus = 'done' | 'aborted';

export function createAssistantSessionMessage(id: string, createdAt = Date.now()): AgentSessionMessage {
  return {
    id,
    role: 'assistant',
    text: '',
    createdAt,
    timeline: [],
  };
}

export function startThinking(message: AgentSessionMessage, startedAt = Date.now()) {
  closeOpenThinking(message, { status: 'aborted', endedAt: startedAt });
  ensureTimeline(message).push({
    id: `thinking-${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'thinking',
    text: '',
    status: 'streaming',
    startedAt,
  });
}

export function appendThinkingDelta(
  message: AgentSessionMessage,
  text: string,
  startedAt = Date.now(),
) {
  const openItem = getOpenThinkingItem(message);
  if (!openItem) {
    startThinking(message, startedAt);
  }

  const current = getOpenThinkingItem(message);
  if (!current) {
    return;
  }
  current.text += text;
}

export function closeOpenThinking(
  message: AgentSessionMessage,
  options: { status: FinalThinkingStatus; endedAt?: number; durationSec?: number },
) {
  const current = getOpenThinkingItem(message);
  if (!current) {
    return null;
  }

  const endedAt = options.endedAt ?? Date.now();
  current.status = options.status;
  current.endedAt = endedAt;
  current.durationSec = resolveDurationSec(current.startedAt, endedAt, options.durationSec);
  return current;
}

export function ensureToolTimelineItem(message: AgentSessionMessage, seed: AgentSessionToolEvent) {
  const timeline = ensureTimeline(message);
  const existing = timeline.find(
    (item): item is AgentToolTimelineItem => item.type === 'tool' && item.toolCallId === seed.id,
  );
  if (existing) {
    return existing;
  }

  const created: AgentToolTimelineItem = {
    id: seed.id,
    type: 'tool',
    toolCallId: seed.id,
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
  timeline.push(created);
  return created;
}

export function finalizeRunningTools(message: AgentSessionMessage, outcome: 'done' | 'error') {
  for (const item of ensureTimeline(message)) {
    if (item.type === 'tool' && item.status === 'running') {
      item.status = outcome === 'done' ? 'done' : 'error';
    }
  }
}

export function normalizeToolStatus(status?: string): AgentToolTimelineItem['status'] {
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

function ensureTimeline(message: AgentSessionMessage) {
  if (!message.timeline) {
    message.timeline = [];
  }
  return message.timeline;
}

function getOpenThinkingItem(message: AgentSessionMessage) {
  const timeline = ensureTimeline(message);
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const item = timeline[index];
    if (item.type === 'thinking' && item.status === 'streaming') {
      return item;
    }
  }
  return null;
}

function resolveDurationSec(startedAt: number, endedAt: number, durationSec?: number) {
  if (typeof durationSec === 'number' && durationSec > 0) {
    return durationSec;
  }
  return Math.max(1, Math.round((endedAt - startedAt) / 1000));
}
