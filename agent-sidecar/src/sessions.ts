import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { AgentSession, DefaultResourceLoader } from '@mariozechner/pi-coding-agent';

import { createAssistantSessionMessage } from './messageTimeline.js';
import type {
  AgentSessionMessage,
  AgentThreadMeta,
  AgentUsage,
  SessionBootstrapResult,
  SkillStatusItem,
  SkillsSnapshot,
} from './types.js';

const SNAPSHOT_SAVE_DEBOUNCE_MS = 120;

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
  baseSystemPrompt: string;
  currentRequestId: string | null;
  currentAssistantMessageId: string | null;
  cancelledRequestIds: Set<string>;
}

export class SessionRegistry {
  private runtimeSessions = new Map<string, RuntimeSessionRecord>();
  private snapshotDir: string;
  private indexPath: string;
  private persistenceQueue: Promise<void> = Promise.resolve();
  private scheduledSnapshotSaves = new Map<
    string,
    {
      timer: NodeJS.Timeout;
      snapshot: PersistedSessionSnapshot;
    }
  >();

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
    session.snapshot.messages.push(createAssistantSessionMessage(assistantMessageId));
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
    this.cancelScheduledSnapshotSave(snapshot.threadId);
    await this.enqueuePersistence(async () => {
      await this.ensureReady();
      snapshot.updatedAt = Date.now();
      this.refreshPreview(snapshot);
      const persistedSnapshot = structuredClone(snapshot);
      const filePath = path.join(this.snapshotDir, `${snapshot.threadId}.json`);
      await this.writeJsonAtomic(filePath, persistedSnapshot);
      await this.writeIndexEntry(persistedSnapshot);
    });
  }

  scheduleSnapshotSave(snapshot: PersistedSessionSnapshot, delayMs = SNAPSHOT_SAVE_DEBOUNCE_MS) {
    this.cancelScheduledSnapshotSave(snapshot.threadId);
    const timer = setTimeout(() => {
      const pending = this.scheduledSnapshotSaves.get(snapshot.threadId);
      if (!pending || pending.timer !== timer) {
        return;
      }
      this.scheduledSnapshotSaves.delete(snapshot.threadId);
      void this.saveSnapshot(pending.snapshot).catch((error) => {
        console.error('Failed to persist scheduled session snapshot:', error);
      });
    }, delayMs);
    timer.unref?.();
    this.scheduledSnapshotSaves.set(snapshot.threadId, {
      timer,
      snapshot,
    });
  }

  async loadSnapshot(threadId: string) {
    await this.ensureReady();
    await this.waitForPendingPersistence([threadId]);
    const filePath = path.join(this.snapshotDir, `${threadId}.json`);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as PersistedSessionSnapshot;
  }

  async listThreads(): Promise<AgentThreadMeta[]> {
    await this.ensureReady();
    await this.waitForPendingPersistence();
    const index = await this.readIndex();
    return Object.values(index)
      .map((snapshot) => this.toThreadMeta(snapshot))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async getThreadMessages(threadId: string): Promise<AgentSessionMessage[]> {
    const runtime = this.getRuntimeSessionByThreadId(threadId);
    if (runtime) return runtime.snapshot.messages;
    try {
      const snapshot = await this.loadSnapshot(threadId);
      return snapshot.messages;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') return [];
      throw error;
    }
  }

  async renameThread(threadId: string, name: string): Promise<AgentThreadMeta | null> {
    await this.ensureReady();
    const trimmed = name.trim().slice(0, 60);
    const finalName = trimmed || null;

    const runtime = this.getRuntimeSessionByThreadId(threadId);
    if (runtime) {
      runtime.snapshot.name = finalName;
      runtime.snapshot.updatedAt = Date.now();
      await this.saveSnapshot(runtime.snapshot);
      return this.toThreadMeta(runtime.snapshot);
    }

    let resultMeta: AgentThreadMeta | null = null;
    await this.enqueuePersistence(async () => {
      const index = await this.readIndex();
      const entry = index[threadId];
      if (!entry) return;
      entry.name = finalName;
      entry.updatedAt = Date.now();
      await this.writeIndex(index);
      const filePath = path.join(this.snapshotDir, `${threadId}.json`);
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const snapshot = JSON.parse(raw) as PersistedSessionSnapshot;
        snapshot.name = finalName;
        snapshot.updatedAt = entry.updatedAt;
        await this.writeJsonAtomic(filePath, snapshot);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'ENOENT') throw error;
      }
      resultMeta = this.toThreadMeta(entry);
    });
    return resultMeta;
  }

  async archiveThread(threadId: string) {
    await this.ensureReady();
    this.cancelScheduledSnapshotSave(threadId);
    await this.enqueuePersistence(async () => {
      const index = await this.readIndex();
      const entry = index[threadId];
      if (entry) {
        delete index[threadId];
        await this.writeIndex(index);
      }
      const snapshotPath = path.join(this.snapshotDir, `${threadId}.json`);
      await fs.rm(snapshotPath, { force: true });
      if (entry?.sessionFile) {
        await fs.rm(entry.sessionFile, { force: true });
      }
    });

    const runtimeSession = this.getRuntimeSessionByThreadId(threadId);
    if (runtimeSession) {
      runtimeSession.session.dispose();
      this.runtimeSessions.delete(runtimeSession.sessionId);
    }
  }

  disposeAll() {
    for (const { timer } of this.scheduledSnapshotSaves.values()) {
      clearTimeout(timer);
    }
    this.scheduledSnapshotSaves.clear();
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
      messageCount: snapshot.messages.length,
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
      if (!content.trim()) {
        return {};
      }
      return JSON.parse(content) as Record<string, PersistedSessionSnapshot>;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return {};
      }
      if (error instanceof SyntaxError) {
        const rebuiltIndex = await this.rebuildIndexFromSnapshots();
        await this.writeIndex(rebuiltIndex);
        return rebuiltIndex;
      }
      throw error;
    }
  }

  private async writeIndex(index: Record<string, PersistedSessionSnapshot>) {
    await this.writeJsonAtomic(this.indexPath, index);
  }

  private async rebuildIndexFromSnapshots() {
    await fs.mkdir(this.snapshotDir, { recursive: true });
    const entries = await fs.readdir(this.snapshotDir, { withFileTypes: true });
    const index: Record<string, PersistedSessionSnapshot> = {};

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }

      const filePath = path.join(this.snapshotDir, entry.name);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        if (!content.trim()) {
          continue;
        }
        const snapshot = JSON.parse(content) as PersistedSessionSnapshot;
        if (snapshot.threadId) {
          index[snapshot.threadId] = snapshot;
        }
      } catch (snapshotError) {
        console.warn('Failed to rebuild index entry from snapshot:', filePath, snapshotError);
      }
    }

    return index;
  }

  private async enqueuePersistence<T>(task: () => Promise<T>) {
    const run = this.persistenceQueue.catch(() => undefined).then(task);
    this.persistenceQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async waitForPendingPersistence(threadIds?: string[]) {
    const targets = threadIds ?? [...this.scheduledSnapshotSaves.keys()];
    await Promise.all(targets.map((threadId) => this.flushScheduledSnapshotSave(threadId)));
    await this.persistenceQueue.catch(() => undefined);
  }

  private cancelScheduledSnapshotSave(threadId: string) {
    const pending = this.scheduledSnapshotSaves.get(threadId);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.scheduledSnapshotSaves.delete(threadId);
  }

  private async flushScheduledSnapshotSave(threadId: string) {
    const pending = this.scheduledSnapshotSaves.get(threadId);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.scheduledSnapshotSaves.delete(threadId);
    await this.saveSnapshot(pending.snapshot);
  }

  private async writeJsonAtomic(targetPath: string, value: unknown) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
      await fs.rename(tempPath, targetPath);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
