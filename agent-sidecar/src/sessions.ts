import { randomUUID } from 'node:crypto';

import type {
  AppServerThread,
  AppServerThreadItem,
  AppServerTurn,
  CodexSessionMessage,
  CodexSessionToolEvent,
  CodexUsage,
} from './types.js';

type ToolLikeThreadItem =
  | Extract<AppServerThreadItem, { type: 'commandExecution' }>
  | Extract<AppServerThreadItem, { type: 'fileChange' }>
  | Extract<AppServerThreadItem, { type: 'mcpToolCall' }>
  | Extract<AppServerThreadItem, { type: 'dynamicToolCall' }>;

export interface SessionRecord {
  sessionId: string;
  threadId: string;
  workspaceRoot: string;
}

export interface RequestRecord {
  requestId: string;
  sessionId: string;
  threadId: string;
  turnId: string;
  usage?: CodexUsage;
}

export class SessionRegistry {
  private sessions = new Map<string, SessionRecord>();
  private requestsByTurnId = new Map<string, RequestRecord>();
  private requestsByRequestId = new Map<string, RequestRecord>();

  createSession(threadId: string, workspaceRoot: string) {
    const sessionId = randomUUID();
    const session = {
      sessionId,
      threadId,
      workspaceRoot,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    return session;
  }

  createRequest(
    sessionId: string,
    threadId: string,
    turnId: string,
    requestId: string = randomUUID(),
  ) {
    const request = {
      requestId,
      sessionId,
      threadId,
      turnId,
    };
    this.requestsByTurnId.set(turnId, request);
    this.requestsByRequestId.set(requestId, request);
    return request;
  }

  getRequestByTurnId(turnId: string) {
    return this.requestsByTurnId.get(turnId) ?? null;
  }

  getRequestByRequestId(requestId: string) {
    return this.requestsByRequestId.get(requestId) ?? null;
  }

  updateUsage(turnId: string, usage: CodexUsage) {
    const request = this.requestsByTurnId.get(turnId);
    if (request) {
      request.usage = usage;
    }
  }

  finishRequest(turnId: string) {
    const request = this.requestsByTurnId.get(turnId) ?? null;
    if (!request) {
      return null;
    }
    this.requestsByTurnId.delete(turnId);
    this.requestsByRequestId.delete(request.requestId);
    return request;
  }

  toMessages(thread: AppServerThread): CodexSessionMessage[] {
    const messages: CodexSessionMessage[] = [];

    for (const turn of thread.turns ?? []) {
      messages.push(...this.turnToMessages(turn));
    }

    return messages;
  }

  private turnToMessages(turn: AppServerTurn) {
    const messages: CodexSessionMessage[] = [];
    const toolEvents: CodexSessionToolEvent[] = [];
    const thinkingParts: string[] = [];
    const assistantTextParts: string[] = [];

    for (const item of turn.items ?? []) {
      if (item.type === 'userMessage') {
        const content = Array.isArray((item as { content?: unknown }).content)
          ? ((item as { content: Array<{ type: string; text?: string }> }).content ?? [])
          : [];
        const text = content
          .filter(
            (
              content,
            ): content is {
              type: 'text';
              text: string;
            } => content.type === 'text',
          )
          .map((content) => content.text)
          .join('\n\n');
        messages.push({
          id: item.id,
          role: 'user',
          text,
          createdAt: Date.now(),
        });
      } else if (item.type === 'reasoning') {
        const fragments = [
          ...(Array.isArray(item.summary) ? item.summary : []),
          ...(Array.isArray(item.content) ? item.content : []),
        ]
          .map((part) => String(part || '').trim())
          .filter(Boolean);
        if (fragments.length > 0) {
          thinkingParts.push(fragments.join('\n\n'));
        }
      } else if (isAgentMessage(item)) {
        if (item.text.trim()) {
          assistantTextParts.push(item.text);
        }
      } else if (isToolLikeItem(item)) {
        toolEvents.push({
          id: item.id,
          name: item.type,
          status: readToolStatus(item),
          args: extractToolArgs(item),
          output: summarizeToolItem(item),
          ok: inferToolOk(item),
        });
      }
    }

    if (thinkingParts.length > 0 || assistantTextParts.length > 0 || toolEvents.length > 0) {
      messages.push({
        id: `assistant-${turn.id}`,
        role: 'assistant',
        text: assistantTextParts.join('\n\n'),
        thinking: thinkingParts.join('\n\n'),
        createdAt: Date.now(),
        toolEvents,
      });
    }

    return messages;
  }
}

function isAgentMessage(
  item: AppServerThreadItem,
): item is Extract<AppServerThreadItem, { type: 'agentMessage' }> {
  return item.type === 'agentMessage';
}

function isToolLikeItem(
  item: AppServerThreadItem,
): item is ToolLikeThreadItem {
  return ['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall'].includes(item.type);
}

function readToolStatus(item: ToolLikeThreadItem) {
  return item.status;
}

function extractToolArgs(item: ToolLikeThreadItem) {
  if (item.type === 'commandExecution') {
    return {
      command: item.command,
      cwd: item.cwd,
      exitCode: item.exitCode,
      commandActions: item.commandActions ?? [],
    };
  }

  if (item.type === 'fileChange') {
    return {
      changes: item.changes,
    };
  }

  if (item.type === 'mcpToolCall') {
    return {
      server: item.server,
      tool: item.tool,
      arguments: item.arguments,
    };
  }

  if (item.type === 'dynamicToolCall') {
    return {
      tool: item.tool,
      arguments: item.arguments,
    };
  }

  return item;
}

function inferToolOk(item: ToolLikeThreadItem) {
  if (item.type === 'commandExecution' || item.type === 'fileChange' || item.type === 'mcpToolCall') {
    return !['failed', 'declined'].includes(readToolStatus(item));
  }

  if (item.type === 'dynamicToolCall') {
    return typeof item.success === 'boolean' ? item.success : !['failed', 'declined'].includes(readToolStatus(item));
  }

  return null;
}

function summarizeToolItem(item: ToolLikeThreadItem) {
  if (item.type === 'commandExecution' && typeof item.aggregatedOutput === 'string' && item.aggregatedOutput.trim()) {
    return item.aggregatedOutput;
  }

  if (item.type === 'fileChange') {
    return item.changes
      .map((change: { path: string; diff?: string }) => {
        const header = `--- ${change.path}\n+++ ${change.path}`;
        return `${header}\n${change.diff || '(no changes)'}`;
      })
      .join('\n\n');
  }

  if (item.type === 'mcpToolCall') {
    if (item.result) {
      return typeof item.result === 'string' ? item.result : JSON.stringify(item.result, null, 2);
    }
    if (item.error) {
      return typeof item.error === 'string' ? item.error : JSON.stringify(item.error, null, 2);
    }
  }

  if (item.type === 'dynamicToolCall') {
    if (Array.isArray(item.contentItems) && item.contentItems.length > 0) {
      return JSON.stringify(item.contentItems, null, 2);
    }
  }

  return '';
}
