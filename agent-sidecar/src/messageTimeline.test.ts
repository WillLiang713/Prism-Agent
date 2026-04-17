import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendThinkingDelta,
  closeOpenThinking,
  createAssistantSessionMessage,
  ensureToolTimelineItem,
  finalizeRunningTools,
  startThinking,
} from './messageTimeline.js';

test('tool timeline item is appended after closing the active thinking block', () => {
  const message = createAssistantSessionMessage('assistant-1', 100);

  startThinking(message, 1000);
  appendThinkingDelta(message, '先分析', 1000);
  closeOpenThinking(message, { status: 'done', endedAt: 2100 });
  ensureToolTimelineItem(message, {
    id: 'tool-1',
    name: 'bash',
    status: 'running',
    args: { command: 'pwd' },
    output: '',
    ok: null,
    summary: 'pwd',
  });

  assert.deepEqual(
    message.timeline?.map((item) => item.type),
    ['thinking', 'tool'],
  );
  assert.equal(message.timeline?.[0]?.type, 'thinking');
  assert.equal(message.timeline?.[0]?.status, 'done');
  assert.equal(message.timeline?.[1]?.type, 'tool');
  assert.equal(message.timeline?.[1]?.status, 'running');
});

test('finalizeRunningTools and closeOpenThinking settle aborted requests', () => {
  const message = createAssistantSessionMessage('assistant-2', 100);

  startThinking(message, 1000);
  appendThinkingDelta(message, '正在推理', 1000);
  ensureToolTimelineItem(message, {
    id: 'tool-2',
    name: 'bash',
    status: 'running',
    args: { command: 'ls' },
    output: '',
    ok: null,
    summary: 'ls',
  });

  const thinking = closeOpenThinking(message, {
    status: 'aborted',
    endedAt: 2400,
  });
  finalizeRunningTools(message, 'error');

  assert.equal(thinking?.status, 'aborted');
  assert.equal(thinking?.durationSec, 1);
  assert.equal(message.timeline?.[1]?.type, 'tool');
  assert.equal(message.timeline?.[1]?.status, 'error');
});
