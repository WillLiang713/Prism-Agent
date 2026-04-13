import { useEffect, useMemo, useState } from 'react';

import {
  agentArchiveThread,
  agentCancel,
  agentHealth,
  agentListThreads,
  agentRespondApproval,
  agentResumeSession,
  agentSendMessage,
  agentStartSession,
  agentValidateConfig,
  type AgentRuntimeConfig,
  type AgentRuntimeStatus,
  listenAgentEvents,
  type AgentReasoningEffort,
} from './client';
import {
  createSessionFromBootstrap,
  useAgentSessionStore,
} from './sessionStore';
import { resolveRuntimeRequestConfig, useConfigStore } from '../store/configStore';

const HEALTH_CHECK_TIMEOUT_MS = 5_000;
const BOOTSTRAP_CALL_TIMEOUT_MS = 8_000;
const MAX_HEALTH_RETRIES = 6;

export function useAgentChat() {
  const initialized = useAgentSessionStore((state) => state.initialized);
  const backendReady = useAgentSessionStore((state) => state.backendReady);
  const backendError = useAgentSessionStore((state) => state.backendError);
  const threadList = useAgentSessionStore((state) => state.threadList);
  const sessionOrder = useAgentSessionStore((state) => state.sessionOrder);
  const sessionsById = useAgentSessionStore((state) => state.sessionsById);
  const activeSessionId = useAgentSessionStore((state) => state.activeSessionId);
  const setInitialized = useAgentSessionStore((state) => state.setInitialized);
  const setBackendReady = useAgentSessionStore((state) => state.setBackendReady);
  const setThreadList = useAgentSessionStore((state) => state.setThreadList);
  const upsertSession = useAgentSessionStore((state) => state.upsertSession);
  const activateSession = useAgentSessionStore((state) => state.activateSession);
  const findSessionByThreadId = useAgentSessionStore((state) => state.findSessionByThreadId);
  const createPendingMessage = useAgentSessionStore((state) => state.createPendingMessage);
  const clearApproval = useAgentSessionStore((state) => state.clearApproval);
  const applyEvent = useAgentSessionStore((state) => state.applyEvent);
  const services = useConfigStore((state) => state.services);
  const runtimeModelConfig = useConfigStore((state) => state.runtimeModelConfig);
  const serviceManagerSelectedId = useConfigStore((state) => state.serviceManagerSelectedId);
  const [workspaceRoot] = useState('');
  const [agentRuntimeStatus, setAgentRuntimeStatus] = useState<AgentRuntimeStatus>({
    configured: false,
    ready: false,
    reason: '正在检查模型配置…',
  });
  const [agentConfigValidating, setAgentConfigValidating] = useState(false);

  const agentRuntimeConfig = useMemo<AgentRuntimeConfig>(() => {
    const runtimeRequestConfig = resolveRuntimeRequestConfig(
      services,
      runtimeModelConfig,
      serviceManagerSelectedId,
      'main',
    );

    return {
      provider: runtimeRequestConfig.provider,
      model: runtimeRequestConfig.model,
      apiKey: runtimeRequestConfig.apiKey,
      apiUrl: runtimeRequestConfig.apiUrl,
      systemPrompt: runtimeRequestConfig.systemPrompt,
      serviceName: runtimeRequestConfig.serviceName,
    };
  }, [runtimeModelConfig, serviceManagerSelectedId, services]);

  useEffect(() => {
    let disposed = false;
    let disposeEvents: null | (() => void) = null;

    async function bootstrap() {
      const maxRetries = MAX_HEALTH_RETRIES;
      let retries = 0;

      while (retries < maxRetries) {
        try {
          await withTimeout(agentHealth(), HEALTH_CHECK_TIMEOUT_MS, '后端健康检查超时');
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
          listenAgentEvents((event) => {
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
          agentListThreads(),
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
        agentStartSession(workspaceRoot),
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
        agentResumeSession(threadId, cwd),
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

  useEffect(() => {
    let disposed = false;

    async function validateRuntimeConfig() {
      if (!backendReady) {
        setAgentConfigValidating(false);
        setAgentRuntimeStatus({
          configured: false,
          ready: false,
          reason: '后端尚未就绪。',
        });
        return;
      }

      setAgentConfigValidating(true);
      try {
        const status = await agentValidateConfig(agentRuntimeConfig);
        if (!disposed) {
          setAgentRuntimeStatus(status);
        }
      } catch (error) {
        if (!disposed) {
          setAgentRuntimeStatus({
            configured: false,
            ready: false,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        if (!disposed) {
          setAgentConfigValidating(false);
        }
      }
    }

    void validateRuntimeConfig();

    return () => {
      disposed = true;
    };
  }, [
    agentRuntimeConfig.apiKey,
    agentRuntimeConfig.apiUrl,
    agentRuntimeConfig.model,
    agentRuntimeConfig.provider,
    agentRuntimeConfig.serviceName,
    agentRuntimeConfig.systemPrompt,
    backendReady,
  ]);

  const activeSession = useMemo(
    () => (activeSessionId ? sessionsById[activeSessionId] || null : null),
    [activeSessionId, sessionsById],
  );

  async function startNewSession(customWorkspaceRoot?: string) {
    const root = customWorkspaceRoot || workspaceRoot;
    const bootstrap = await agentStartSession(root);
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

    const bootstrap = await agentResumeSession(threadId, cwd);
    const session = createSessionFromBootstrap(bootstrap, cwd);
    upsertSession(session);
    activateSession(session.sessionId);
  }

  async function sendMessage(payload: {
    text: string;
    images: Array<{ name: string; mediaType: string; dataUrl: string }>;
    reasoningEffort: AgentReasoningEffort;
  }) {
    if (!activeSession || !agentRuntimeStatus.ready) {
      return;
    }

    const requestId = crypto.randomUUID();
    createPendingMessage(activeSession.sessionId, payload.text, requestId);
    try {
      const response = await agentSendMessage({
        requestId,
        sessionId: activeSession.sessionId,
        text: payload.text,
        images: payload.images,
        reasoningEffort: payload.reasoningEffort,
        config: agentRuntimeConfig,
      });
      if (response.requestId !== requestId) {
        console.warn('agent request id mismatch', { requestId, responseRequestId: response.requestId });
      }
    } catch (error) {
      applyEvent({
        type: 'error',
        requestId,
        sessionId: activeSession.sessionId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function stop() {
    if (!activeSession?.pendingRequestId) {
      return;
    }
    await agentCancel(activeSession.pendingRequestId);
  }

  async function respondApproval(approvalId: string, decision: 'allow' | 'deny') {
    clearApproval(approvalId);
    await agentRespondApproval(approvalId, decision);
  }

  return {
    initialized,
    backendReady,
    backendError,
    threadList,
    sessions: sessionOrder.map((sessionId) => sessionsById[sessionId]).filter(Boolean),
    activeSession,
    agentRuntimeStatus,
    agentConfigValidating,
    startNewSession,
    resumeThread,
    sendMessage,
    stop,
    respondApproval,
    archiveThread: async (threadId: string) => {
      // 乐观更新：立即在前端移除
      useAgentSessionStore.getState().removeThread(threadId);
      // 在后台异步通知后端，不阻塞 UI
      void agentArchiveThread(threadId).catch((err) => {
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
