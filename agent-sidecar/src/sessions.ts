import { randomUUID } from 'node:crypto';

import type {
  AppServerThread,
  AppServerThreadItem,
  AppServerTurn,
  CodexSessionMessage,
  CodexUsage,
} from './types.js';

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
      } else if (isAgentMessage(item)) {
        messages.push({
          id: item.id,
          role: 'assistant',
          text: item.text,
          createdAt: Date.now(),
        });
      }
    }
    return messages;
  }
}

function isAgentMessage(
  item: AppServerThreadItem,
): item is Extract<AppServerThreadItem, { type: 'agentMessage' }> {
  return item.type === 'agentMessage';
}
