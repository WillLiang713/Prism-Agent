import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { AgentSession, DefaultResourceLoader } from '@mariozechner/pi-coding-agent';

import type {
  AgentSessionMessage,
  AgentThreadMeta,
  AgentUsage,
  SessionBootstrapResult,
  SkillStatusItem,
  SkillsSnapshot,
} from './types.js';

export interface PersistedSessionSnapshot {
  sessionId: string;
  threadId: string;
  workspaceRoot: string;
  sessionFile: string | null;
  messages: AgentSessionMessage[];
  skills: SkillsSnapshot;
  createdAt: number;
  updatedAt: number;
  preview: string;
  name: string | null;
  status: string;
  modelProvider: string;
  lastUsage?: AgentUsage;
}

export interface RuntimeSessionRecord {
  sessionId: string;
  threadId: string;
  workspaceRoot: string;
  session: AgentSession;
  loader: DefaultResourceLoader;
  snapshot: PersistedSessionSnapshot;
  currentRequestId: string | null;
  currentAssistantMessageId: string | null;
  cancelledRequestIds: Set<string>;
}

export class SessionRegistry {
  private runtimeSessions = new Map<string, RuntimeSessionRecord>();
  private snapshotDir: string;
  private indexPath: string;

  constructor(private dataDir: string) {
    this.snapshotDir = path.join(this.dataDir, 'snapshots');
    this.indexPath = path.join(this.dataDir, 'session-index.json');
  }

  async ensureReady() {
    await fs.mkdir(this.snapshotDir, { recursive: true });
  }

  createWorkspaceSessionDir(workspaceRoot: string) {
    const key = createHash('sha1').update(path.resolve(workspaceRoot)).digest('hex').slice(0, 16);
    return path.join(this.dataDir, 'pi-sessions', key);
  }

  createSnapshot(input: {
    threadId: string;
    workspaceRoot: string;
    sessionFile: string | null;
    skills: SkillsSnapshot;
    modelProvider?: string;
  }): PersistedSessionSnapshot {
    const now = Date.now();
    return {
      sessionId: randomUUID(),
      threadId: input.threadId,
      workspaceRoot: input.workspaceRoot,
      sessionFile: input.sessionFile,
      messages: [],
      skills: input.skills,
      createdAt: now,
      updatedAt: now,
      preview: '',
      name: null,
      status: 'idle',
      modelProvider: input.modelProvider || 'pi',
    };
  }

  registerRuntime(record: Omit<RuntimeSessionRecord, 'currentRequestId' | 'currentAssistantMessageId' | 'cancelledRequestIds'>) {
    const runtimeRecord: RuntimeSessionRecord = {
      ...record,
      currentRequestId: null,
      currentAssistantMessageId: null,
      cancelledRequestIds: new Set<string>(),
    };
    this.runtimeSessions.set(runtimeRecord.sessionId, runtimeRecord);
    return runtimeRecord;
  }

  getRuntimeSession(sessionId: string) {
    const record = this.runtimeSessions.get(sessionId);
    if (!record) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    return record;
  }

  getRuntimeSessionByThreadId(threadId: string) {
    return [...this.runtimeSessions.values()].find((session) => session.threadId === threadId) ?? null;
  }

  listRuntimeSessions() {
    return [...this.runtimeSessions.values()];
  }

  markRequestStarted(sessionId: string, requestId: string, userText: string) {
    const session = this.getRuntimeSession(sessionId);
    const assistantMessageId = `assistant-${requestId}`;
    session.currentRequestId = requestId;
    session.currentAssistantMessageId = assistantMessageId;
    session.snapshot.status = 'running';
    session.snapshot.updatedAt = Date.now();
    session.snapshot.messages.push({
      id: `user-${requestId}`,
      role: 'user',
      text: userText,
      createdAt: Date.now(),
    });
    session.snapshot.messages.push({
      id: assistantMessageId,
      role: 'assistant',
      text: '',
      thinking: '',
      createdAt: Date.now(),
      toolEvents: [],
    });
    this.refreshPreview(session.snapshot);
    return assistantMessageId;
  }

  markRequestCancelled(requestId: string) {
    for (const session of this.runtimeSessions.values()) {
      if (session.currentRequestId === requestId) {
        session.cancelledRequestIds.add(requestId);
      }
    }
  }

  clearRequest(sessionId: string, requestId: string) {
    const session = this.getRuntimeSession(sessionId);
    if (session.currentRequestId === requestId) {
      session.currentRequestId = null;
      session.currentAssistantMessageId = null;
    }
    session.cancelledRequestIds.delete(requestId);
    session.snapshot.status = 'idle';
    session.snapshot.updatedAt = Date.now();
  }

  isCancelled(sessionId: string, requestId: string) {
    return this.getRuntimeSession(sessionId).cancelledRequestIds.has(requestId);
  }

  getAssistantMessage(sessionId: string) {
    const session = this.getRuntimeSession(sessionId);
    const messageId = session.currentAssistantMessageId;
    if (!messageId) {
      return null;
    }
    return session.snapshot.messages.find((message) => message.id === messageId) ?? null;
  }

  getLatestAssistantMessage(sessionId: string) {
    const session = this.getRuntimeSession(sessionId);
    for (let index = session.snapshot.messages.length - 1; index >= 0; index--) {
      const message = session.snapshot.messages[index];
      if (message.role === 'assistant') {
        return message;
      }
    }
    return null;
  }

  async saveSnapshot(snapshot: PersistedSessionSnapshot) {
    await this.ensureReady();
    snapshot.updatedAt = Date.now();
    this.refreshPreview(snapshot);
    const filePath = path.join(this.snapshotDir, `${snapshot.threadId}.json`);
    await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
    await this.writeIndexEntry(snapshot);
  }

  async loadSnapshot(threadId: string) {
    await this.ensureReady();
    const filePath = path.join(this.snapshotDir, `${threadId}.json`);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as PersistedSessionSnapshot;
  }

  async listThreads(): Promise<AgentThreadMeta[]> {
    await this.ensureReady();
    const index = await this.readIndex();
    return Object.values(index)
      .map((snapshot) => this.toThreadMeta(snapshot))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async archiveThread(threadId: string) {
    await this.ensureReady();
    const index = await this.readIndex();
    const existing = index[threadId];
    if (existing) {
      delete index[threadId];
      await this.writeIndex(index);
    }
    const snapshotPath = path.join(this.snapshotDir, `${threadId}.json`);
    await fs.rm(snapshotPath, { force: true });
    if (existing?.sessionFile) {
      await fs.rm(existing.sessionFile, { force: true });
    }

    const runtimeSession = this.getRuntimeSessionByThreadId(threadId);
    if (runtimeSession) {
      runtimeSession.session.dispose();
      this.runtimeSessions.delete(runtimeSession.sessionId);
    }
  }

  disposeAll() {
    for (const runtime of this.runtimeSessions.values()) {
      runtime.session.dispose();
    }
    this.runtimeSessions.clear();
  }

  toBootstrap(snapshot: PersistedSessionSnapshot): SessionBootstrapResult {
    return {
      sessionId: snapshot.sessionId,
      threadId: snapshot.threadId,
      messages: snapshot.messages,
      thread: this.toThreadMeta(snapshot),
      skills: snapshot.skills,
    };
  }

  toThreadMeta(snapshot: PersistedSessionSnapshot): AgentThreadMeta {
    return {
      threadId: snapshot.threadId,
      preview: snapshot.preview,
      name: snapshot.name,
      cwd: snapshot.workspaceRoot,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      status: snapshot.status,
      modelProvider: snapshot.modelProvider,
      path: snapshot.sessionFile,
    };
  }

  buildSkillsSnapshot(items: SkillStatusItem[], diagnostics: string[]): SkillsSnapshot {
    return {
      items,
      diagnostics,
    };
  }

  private refreshPreview(snapshot: PersistedSessionSnapshot) {
    const candidates = [...snapshot.messages].reverse();
    const previewSource = candidates.find((message) => message.text.trim())?.text ?? '';
    snapshot.preview = previewSource.trim().replace(/\s+/g, ' ').slice(0, 120);
  }

  private async writeIndexEntry(snapshot: PersistedSessionSnapshot) {
    const index = await this.readIndex();
    index[snapshot.threadId] = snapshot;
    await this.writeIndex(index);
  }

  private async readIndex() {
    try {
      const content = await fs.readFile(this.indexPath, 'utf8');
      return JSON.parse(content) as Record<string, PersistedSessionSnapshot>;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  private async writeIndex(index: Record<string, PersistedSessionSnapshot>) {
    await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf8');
  }
}
