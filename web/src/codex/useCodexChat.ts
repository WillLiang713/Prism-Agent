import { useEffect, useMemo, useState } from 'react';

import {
  codexCancel,
  codexHealth,
  codexListThreads,
  codexRespondApproval,
  codexResumeSession,
  codexSendMessage,
  codexStartSession,
  codexArchiveThread,
  listenCodexEvents,
  type CodexReasoningEffort,
} from './client';
import {
  createSessionFromBootstrap,
  useCodexSessionStore,
} from './sessionStore';

const HEALTH_CHECK_TIMEOUT_MS = 5_000;
const BOOTSTRAP_CALL_TIMEOUT_MS = 8_000;
const MAX_HEALTH_RETRIES = 6;

export function useCodexChat() {
  const initialized = useCodexSessionStore((state) => state.initialized);
  const backendReady = useCodexSessionStore((state) => state.backendReady);
  const backendError = useCodexSessionStore((state) => state.backendError);
  const threadList = useCodexSessionStore((state) => state.threadList);
  const sessionOrder = useCodexSessionStore((state) => state.sessionOrder);
  const sessionsById = useCodexSessionStore((state) => state.sessionsById);
  const activeSessionId = useCodexSessionStore((state) => state.activeSessionId);
  const setInitialized = useCodexSessionStore((state) => state.setInitialized);
  const setBackendReady = useCodexSessionStore((state) => state.setBackendReady);
  const setThreadList = useCodexSessionStore((state) => state.setThreadList);
  const upsertSession = useCodexSessionStore((state) => state.upsertSession);
  const activateSession = useCodexSessionStore((state) => state.activateSession);
  const findSessionByThreadId = useCodexSessionStore((state) => state.findSessionByThreadId);
  const createPendingMessage = useCodexSessionStore((state) => state.createPendingMessage);
  const clearApproval = useCodexSessionStore((state) => state.clearApproval);
  const applyEvent = useCodexSessionStore((state) => state.applyEvent);
  const [workspaceRoot] = useState('');

  useEffect(() => {
    let disposed = false;
    let disposeEvents: null | (() => void) = null;

    async function bootstrap() {
      const maxRetries = MAX_HEALTH_RETRIES;
      let retries = 0;

      while (retries < maxRetries) {
        try {
          await withTimeout(codexHealth(), HEALTH_CHECK_TIMEOUT_MS, '后端健康检查超时');
          break;
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            if (!disposed) {
              setBackendReady(false, error instanceof Error ? error.message : String(error));
              setInitialized(true);
            }
            return;
          }
          // 等待一秒后重试
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (disposed) return;
        }
      }

      try {
        if (disposed) {
          return;
        }
        setBackendReady(true);

        const listener = await withTimeout(
          listenCodexEvents((event) => {
            applyEvent(event);
          }),
          BOOTSTRAP_CALL_TIMEOUT_MS,
          '监听后端事件超时',
        );
        if (disposed) {
          listener();
          return;
        }
        disposeEvents = listener;

        const threadResponse = await withTimeout(
          codexListThreads(),
          BOOTSTRAP_CALL_TIMEOUT_MS,
          '读取会话列表超时',
        );
        if (disposed) {
          return;
        }
        setThreadList(threadResponse.threads);

        if (threadResponse.threads[0]) {
          await resumeThread(threadResponse.threads[0].threadId, threadResponse.threads[0].cwd);
        } else {
          await createSession();
        }

        if (!disposed) {
          setInitialized(true);
        }
      } catch (error) {
        if (!disposed) {
          setBackendReady(false, error instanceof Error ? error.message : String(error));
          setInitialized(true);
        }
      }
    }

    async function createSession() {
      const bootstrap = await withTimeout(
        codexStartSession(workspaceRoot),
        BOOTSTRAP_CALL_TIMEOUT_MS,
        '创建会话超时',
      );
      if (disposed) {
        return;
      }
      const session = createSessionFromBootstrap(bootstrap, workspaceRoot);
      upsertSession(session);
      activateSession(session.sessionId);
    }

    async function resumeThread(threadId: string, cwd = workspaceRoot) {
      const bootstrap = await withTimeout(
        codexResumeSession(threadId, cwd),
        BOOTSTRAP_CALL_TIMEOUT_MS,
        '恢复会话超时',
      );
      if (disposed) {
        return;
      }
      const session = createSessionFromBootstrap(bootstrap, cwd);
      upsertSession(session);
      activateSession(session.sessionId);
    }

    void bootstrap();

    return () => {
      disposed = true;
      disposeEvents?.();
    };
  }, [
    activateSession,
    applyEvent,
    setBackendReady,
    setInitialized,
    setThreadList,
    upsertSession,
    workspaceRoot,
  ]);

  const activeSession = useMemo(
    () => (activeSessionId ? sessionsById[activeSessionId] || null : null),
    [activeSessionId, sessionsById],
  );

  async function startNewSession(customWorkspaceRoot?: string) {
    const root = customWorkspaceRoot || workspaceRoot;
    const bootstrap = await codexStartSession(root);
    const session = createSessionFromBootstrap(bootstrap, root);
    upsertSession(session);
    activateSession(session.sessionId);

    // 立即更新 threadList，使新会话在侧边栏即时显示
    if (bootstrap.thread) {
      setThreadList([bootstrap.thread, ...threadList.filter(t => t.threadId !== bootstrap.threadId)]);
    }
  }

  async function resumeThread(threadId: string, cwd = workspaceRoot) {
    const existingSessionId = findSessionByThreadId(threadId);
    if (existingSessionId) {
      activateSession(existingSessionId);
      return;
    }

    const bootstrap = await codexResumeSession(threadId, cwd);
    const session = createSessionFromBootstrap(bootstrap, cwd);
    upsertSession(session);
    activateSession(session.sessionId);
  }

  async function sendMessage(payload: {
    text: string;
    images: Array<{ name: string; mediaType: string; dataUrl: string }>;
    reasoningEffort: CodexReasoningEffort;
  }) {
    if (!activeSession) {
      return;
    }
    const requestId = crypto.randomUUID();
    createPendingMessage(activeSession.sessionId, payload.text, requestId);
    const response = await codexSendMessage({
      requestId,
      sessionId: activeSession.sessionId,
      text: payload.text,
      images: payload.images,
      reasoningEffort: payload.reasoningEffort,
    });
    if (response.requestId !== requestId) {
      console.warn('codex request id mismatch', { requestId, responseRequestId: response.requestId });
    }
  }

  async function stop() {
    if (!activeSession?.pendingRequestId) {
      return;
    }
    await codexCancel(activeSession.pendingRequestId);
  }

  async function respondApproval(approvalId: string, decision: 'allow' | 'deny') {
    clearApproval(approvalId);
    await codexRespondApproval(approvalId, decision);
  }

  return {
    initialized,
    backendReady,
    backendError,
    threadList,
    sessions: sessionOrder.map((sessionId) => sessionsById[sessionId]).filter(Boolean),
    activeSession,
    startNewSession,
    resumeThread,
    sendMessage,
    stop,
    respondApproval,
    archiveThread: async (threadId: string) => {
      // 乐观更新：立即在前端移除
      useCodexSessionStore.getState().removeThread(threadId);
      // 在后台异步通知后端，不阻塞 UI
      void codexArchiveThread(threadId).catch((err) => {
        console.error('Archive thread failed:', err);
      });
    },
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label}（${timeoutMs}ms）`));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}
