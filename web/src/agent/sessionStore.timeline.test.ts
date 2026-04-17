import test from 'node:test';
import assert from 'node:assert/strict';

import { createSessionFromBootstrap, useAgentSessionStore } from './sessionStore';

function resetStore() {
  useAgentSessionStore.setState({
    initialized: false,
    backendReady: false,
    backendError: '',
    threadList: [],
    sessionOrder: [],
    sessionsById: {},
    activeSessionId: null,
    requestBindings: {},
  });
}

function createBootstrapWithLegacyFields() {
  return {
    sessionId: 'session-1',
    threadId: 'thread-1',
    messages: [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: '最终回答',
        createdAt: 100,
        thinking: '第一段思考',
        thinkingStartedAt: 90,
        thinkingDurationSec: 2,
        toolEvents: [
          {
            id: 'tool-1',
            name: 'bash',
            status: 'completed',
            args: { command: 'echo hello' },
            output: 'hello',
            ok: true,
            summary: 'echo hello',
          },
        ],
      },
    ],
    skills: {
      items: [],
      diagnostics: [],
    },
  };
}

function getAssistantMessage(sessionId: string) {
  const session = useAgentSessionStore.getState().sessionsById[sessionId] as any;
  return session.messages.find((message: any) => message.role === 'assistant');
}

test('createSessionFromBootstrap converts legacy thinking and tool events into timeline items', () => {
  const session = createSessionFromBootstrap(createBootstrapWithLegacyFields() as any, 'C:/workspace') as any;
  const [message] = session.messages;

  assert.equal(message.timeline.length, 2);
  assert.deepEqual(
    message.timeline.map((item: any) => item.type),
    ['thinking', 'tool'],
  );
  assert.equal(message.timeline[0].text, '第一段思考');
  assert.equal(message.timeline[0].status, 'done');
  assert.equal(message.timeline[1].name, 'bash');
});

test('applyEvent creates separate thinking items around tool calls in timeline order', () => {
  resetStore();
  const session = createSessionFromBootstrap(
    {
      sessionId: 'session-1',
      threadId: 'thread-1',
      messages: [],
      skills: {
        items: [],
        diagnostics: [],
      },
    } as any,
    'C:/workspace',
  );

  useAgentSessionStore.getState().upsertSession(session);
  useAgentSessionStore.getState().createPendingMessage('session-1', '帮我执行命令', 'request-1');

  useAgentSessionStore.getState().applyEvent({
    type: 'thinking_start',
    requestId: 'request-1',
    sessionId: 'session-1',
    itemId: 'assistant-request-1',
    startedAt: 1000,
  } as any);
  useAgentSessionStore.getState().applyEvent({
    type: 'thinking_delta',
    requestId: 'request-1',
    sessionId: 'session-1',
    itemId: 'assistant-request-1',
    text: '先分析一下',
  } as any);
  useAgentSessionStore.getState().applyEvent({
    type: 'tool_call',
    requestId: 'request-1',
    sessionId: 'session-1',
    toolCallId: 'tool-1',
    name: 'bash',
    args: { command: 'pwd' },
    status: 'started',
    summary: 'pwd',
  });
  useAgentSessionStore.getState().applyEvent({
    type: 'tool_result',
    requestId: 'request-1',
    sessionId: 'session-1',
    toolCallId: 'tool-1',
    ok: true,
    output: 'C:/workspace',
    status: 'completed',
    summary: 'pwd',
  });
  useAgentSessionStore.getState().applyEvent({
    type: 'thinking_start',
    requestId: 'request-1',
    sessionId: 'session-1',
    itemId: 'assistant-request-1',
    startedAt: 2000,
  } as any);
  useAgentSessionStore.getState().applyEvent({
    type: 'thinking_delta',
    requestId: 'request-1',
    sessionId: 'session-1',
    itemId: 'assistant-request-1',
    text: '再总结一下',
  } as any);

  const assistantMessage = getAssistantMessage('session-1');

  assert.deepEqual(
    assistantMessage.timeline.map((item: any) => item.type),
    ['thinking', 'tool', 'thinking'],
  );
  assert.equal(assistantMessage.timeline[0].text, '先分析一下');
  assert.equal(assistantMessage.timeline[0].status, 'done');
  assert.equal(assistantMessage.timeline[1].status, 'done');
  assert.equal(assistantMessage.timeline[2].status, 'streaming');
  assert.equal(assistantMessage.timeline[2].text, '再总结一下');
});

test('applyEvent closes an open thinking item as aborted when the request errors', () => {
  resetStore();
  const session = createSessionFromBootstrap(
    {
      sessionId: 'session-2',
      threadId: 'thread-2',
      messages: [],
      skills: {
        items: [],
        diagnostics: [],
      },
    } as any,
    'C:/workspace',
  );

  useAgentSessionStore.getState().upsertSession(session);
  useAgentSessionStore.getState().createPendingMessage('session-2', '这次会失败', 'request-2');

  useAgentSessionStore.getState().applyEvent({
    type: 'thinking_start',
    requestId: 'request-2',
    sessionId: 'session-2',
    itemId: 'assistant-request-2',
    startedAt: 3000,
  } as any);
  useAgentSessionStore.getState().applyEvent({
    type: 'thinking_delta',
    requestId: 'request-2',
    sessionId: 'session-2',
    itemId: 'assistant-request-2',
    text: '正在推理',
  } as any);
  useAgentSessionStore.getState().applyEvent({
    type: 'error',
    requestId: 'request-2',
    sessionId: 'session-2',
    message: '请求失败',
  });

  const assistantMessage = getAssistantMessage('session-2');

  assert.equal(assistantMessage.timeline.length, 1);
  assert.equal(assistantMessage.timeline[0].status, 'aborted');
  assert.equal(assistantMessage.timeline[0].text, '正在推理');
  assert.equal(assistantMessage.error, '请求失败');
});
