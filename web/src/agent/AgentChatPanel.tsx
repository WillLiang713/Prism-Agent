import { AlertCircle, ArrowDown } from 'lucide-react';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Button } from '@heroui/react/button';
import { ScrollShadow } from '@heroui/react/scroll-shadow';

import { ApprovalPrompt } from './components/ApprovalPrompt';
import { AgentChatInput } from './components/AgentChatInput';
import { AgentMessageList } from './components/AgentMessageList';
import { SkillsDisplay } from './components/SkillsDisplay';
import type { AgentApprovalMode, AgentRuntimeStatus } from './client';
import type { AgentSession } from './sessionStore';

const CHAT_SIDE_PADDING = 'calc(1.5rem + 10px)';
const CHAT_PANEL_MAX_WIDTH = '900px';
const BOTTOM_STICK_THRESHOLD_PX = 160;
const SCROLL_BUTTON_THRESHOLD_PX = 48;
const SUPPRESSED_RUNTIME_REASON = '未指定主模型，请在设置中选择或输入模型名称。';
const AUTO_SCROLL_MAX_FRAMES = 4;

function getScrollViewport(root: HTMLDivElement | null) {
  return root;
}

function getDistanceToBottom(viewport: HTMLDivElement) {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
}

function isPinnedToBottom(viewport: HTMLDivElement) {
  return getDistanceToBottom(viewport) <= BOTTOM_STICK_THRESHOLD_PX;
}

function shouldShowScrollToBottom(viewport: HTMLDivElement) {
  return getDistanceToBottom(viewport) > SCROLL_BUTTON_THRESHOLD_PX;
}

export function AgentChatPanel({
  initialized,
  backendReady,
  backendError,
  activeSession,
  approvalMode,
  agentRuntimeStatus,
  agentConfigValidating,
  onApprovalModeChange,
  onSelectWorkspace,
  onSendMessage,
  onStop,
  onRespondApproval,
}: {
  initialized: boolean;
  backendReady: boolean;
  backendError: string;
  activeSession: AgentSession | null;
  approvalMode: AgentApprovalMode;
  agentRuntimeStatus: AgentRuntimeStatus;
  agentConfigValidating: boolean;
  onApprovalModeChange: (mode: AgentApprovalMode) => void;
  onSelectWorkspace: (cwd: string) => void;
  onSendMessage: (payload: {
    text: string;
    images: Array<{ name: string; mediaType: string; dataUrl: string }>;
    reasoningEffort: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
    approvalMode: AgentApprovalMode;
  }) => void;
  onStop: () => void;
  onRespondApproval: (approvalId: string, decision: 'allow' | 'deny') => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const scrollFrameBudgetRef = useRef(0);
  const showScrollToBottomRef = useRef(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const activeApproval = useMemo(() => activeSession?.approvals[0] || null, [activeSession]);
  const inputDisabled = !backendReady;
  const submitDisabled = inputDisabled || !agentRuntimeStatus.ready;
  const isWelcomeState = !activeSession || (activeSession?.messages.length || 0) === 0;
  const runtimeStatusMessage = agentConfigValidating
    ? agentRuntimeStatus.ready
      ? ''
      : '正在检查模型配置'
    : agentRuntimeStatus.reason === SUPPRESSED_RUNTIME_REASON
      ? ''
      : agentRuntimeStatus.reason;

  const setScrollToBottomButtonVisible = useCallback((visible: boolean) => {
    if (showScrollToBottomRef.current === visible) {
      return;
    }

    showScrollToBottomRef.current = visible;
    setShowScrollToBottom(visible);
  }, []);

  const syncScrollState = useCallback(
    (viewport: HTMLDivElement) => {
      stickToBottomRef.current = isPinnedToBottom(viewport);
      setScrollToBottomButtonVisible(shouldShowScrollToBottom(viewport));
    },
    [setScrollToBottomButtonVisible],
  );

  const cancelScrollFrame = useCallback(() => {
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
    scrollFrameBudgetRef.current = 0;
  }, []);

  const cancelScheduledScroll = useEffectEvent(() => {
    cancelScrollFrame();
  });

  const scheduleScrollToBottom = useEffectEvent(() => {
    if (!stickToBottomRef.current || scrollFrameRef.current !== null) {
      return;
    }

    scrollFrameBudgetRef.current = AUTO_SCROLL_MAX_FRAMES;

    const runScrollFrame = () => {
      scrollFrameRef.current = null;
      const viewport = getScrollViewport(scrollRef.current);
      if (!(viewport instanceof HTMLDivElement) || !stickToBottomRef.current) {
        return;
      }

      viewport.scrollTop = viewport.scrollHeight;
      setScrollToBottomButtonVisible(false);
      scrollFrameBudgetRef.current -= 1;

      const distanceToBottom = getDistanceToBottom(viewport);
      if (distanceToBottom > 1 && scrollFrameBudgetRef.current > 0) {
        scrollFrameRef.current = requestAnimationFrame(runScrollFrame);
      }
    };

    scrollFrameRef.current = requestAnimationFrame(runScrollFrame);
  });

  useEffect(() => {
    const viewport = getScrollViewport(scrollRef.current);
    if (!viewport) {
      setScrollToBottomButtonVisible(false);
      return;
    }

    const syncStickState = () => {
      syncScrollState(viewport);
    };

    syncStickState();
    viewport.addEventListener('scroll', syncStickState, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', syncStickState);
      cancelScheduledScroll();
    };
  }, [activeSession?.sessionId, isWelcomeState, setScrollToBottomButtonVisible, syncScrollState]);

  useEffect(() => {
    const viewport = getScrollViewport(scrollRef.current);
    const content = viewport?.firstElementChild;
    if (!viewport || !(content instanceof HTMLElement)) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      if (stickToBottomRef.current) {
        scheduleScrollToBottom();
      } else {
        syncScrollState(viewport);
      }
    });
    resizeObserver.observe(content);

    const mutationObserver = new MutationObserver(() => {
      if (stickToBottomRef.current) {
        scheduleScrollToBottom();
      } else {
        syncScrollState(viewport);
      }
    });
    mutationObserver.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['open'],
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [activeSession?.sessionId, isWelcomeState, syncScrollState]);

  useEffect(() => {
    const viewport = getScrollViewport(scrollRef.current);
    if (!viewport) {
      setScrollToBottomButtonVisible(false);
      return;
    }

    cancelScheduledScroll();
    viewport.scrollTop = viewport.scrollHeight;
    stickToBottomRef.current = true;
    setScrollToBottomButtonVisible(false);
  }, [activeSession?.sessionId, isWelcomeState, setScrollToBottomButtonVisible]);

  useEffect(() => {
    if (!activeSession?.sessionId) {
      return;
    }

    scheduleScrollToBottom();
  }, [activeSession?.isStreaming, activeSession?.messages, activeSession?.sessionId]);

  useEffect(() => () => cancelScheduledScroll(), []);

  const handleScrollToBottom = useCallback(() => {
    const viewport = getScrollViewport(scrollRef.current);
    if (!(viewport instanceof HTMLDivElement)) {
      return;
    }

    cancelScrollFrame();
    stickToBottomRef.current = true;
    setScrollToBottomButtonVisible(false);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [cancelScrollFrame, setScrollToBottomButtonVisible]);

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {!backendReady && backendError ? (
          <div className="flex items-center gap-2 bg-danger/5 px-6 py-3 text-sm text-danger">
            <AlertCircle className="h-4 w-4" />
            <span>后端服务异常: {backendError}</span>
          </div>
        ) : null}
        
        <div className="flex-1 overflow-hidden">
          {!initialized ? (
            <div
              role="status"
              aria-live="polite"
              className="flex h-full flex-col items-center justify-center p-8 text-center text-sm leading-6 text-mutedForeground"
            >
              <span className="thinking-title-shimmer" data-shimmer-text="正在连接后端">
                正在连接后端
              </span>
            </div>
          ) : isWelcomeState ? (
            <div className="flex h-full items-center justify-center" style={{ paddingInline: CHAT_SIDE_PADDING }}>
              <div className="mx-auto flex w-full flex-col gap-4" style={{ maxWidth: CHAT_PANEL_MAX_WIDTH }}>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-medium text-foreground">
                    准备好开始了吗？
                  </h1>
                  <p className="max-w-[34rem] text-sm leading-6 text-mutedForeground">
                    把你想做的事告诉我，我们一起把它理清楚
                  </p>
                </div>
                {activeSession?.skills && (
                  <SkillsDisplay skills={activeSession.skills} />
                )}
                {activeApproval && (
                  <ApprovalPrompt
                    approval={activeApproval}
                    onDecision={(decision) => {
                      onRespondApproval(activeApproval.approvalId, decision);
                    }}
                  />
                )}
                <AgentChatInput
                  inputDisabled={inputDisabled}
                  submitDisabled={submitDisabled}
                  submitHint={runtimeStatusMessage}
                  isStreaming={activeSession?.isStreaming || false}
                  approvalMode={approvalMode}
                  fallbackModel={agentRuntimeStatus.model}
                  workspaceRoot={activeSession?.workspaceRoot}
                  onApprovalModeChange={onApprovalModeChange}
                  onSelectWorkspace={onSelectWorkspace}
                  onStop={onStop}
                  onSubmit={onSendMessage}
                />
              </div>
            </div>
          ) : (
            <div className="relative h-full">
              <ScrollShadow ref={scrollRef} className="h-full overflow-y-auto" size={32}>
                <div className="flex min-h-full py-8" style={{ paddingInline: CHAT_SIDE_PADDING }}>
                  <div className="mx-auto flex min-h-full w-full" style={{ maxWidth: CHAT_PANEL_MAX_WIDTH }}>
                    <AgentMessageList
                      messages={activeSession?.messages || []}
                      isStreaming={activeSession?.isStreaming || false}
                    />
                  </div>
                </div>
              </ScrollShadow>
              {showScrollToBottom ? (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-4 z-20"
                  style={{ paddingInline: CHAT_SIDE_PADDING }}
                >
                  <div className="mx-auto flex w-full justify-center" style={{ maxWidth: CHAT_PANEL_MAX_WIDTH }}>
                    <span className="pointer-events-auto inline-flex">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        isIconOnly
                        aria-label="滚动到底部"
                        onPress={handleScrollToBottom}
                        className="h-9 min-h-9 w-9 min-w-9 touch-manipulation rounded-full border border-border/70 bg-background/95 p-0 text-mutedForeground shadow-[0_12px_28px_rgba(0,0,0,0.18)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] hover:border-foreground/25 hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/25 data-[pressed=true]:scale-95"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {!isWelcomeState && (
          <div className="py-5" style={{ paddingInline: CHAT_SIDE_PADDING }}>
            <div className="mx-auto w-full flex flex-col gap-4" style={{ maxWidth: CHAT_PANEL_MAX_WIDTH }}>
              {activeSession?.skills && (
                <SkillsDisplay skills={activeSession.skills} />
              )}
              {activeApproval && (
                <ApprovalPrompt
                  approval={activeApproval}
                  onDecision={(decision) => {
                    onRespondApproval(activeApproval.approvalId, decision);
                  }}
                />
              )}
              {activeSession && (
                <AgentChatInput
                  inputDisabled={inputDisabled}
                  submitDisabled={submitDisabled}
                  submitHint={runtimeStatusMessage}
                  isStreaming={activeSession?.isStreaming || false}
                  approvalMode={approvalMode}
                  fallbackModel={agentRuntimeStatus.model}
                  workspaceRoot={activeSession?.workspaceRoot}
                  onApprovalModeChange={onApprovalModeChange}
                  onSelectWorkspace={onSelectWorkspace}
                  onStop={onStop}
                  onSubmit={onSendMessage}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
