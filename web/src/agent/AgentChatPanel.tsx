import { MessageSquarePlus, Loader2, AlertCircle } from 'lucide-react';
import { useEffect, useEffectEvent, useMemo, useRef } from 'react';

import { ScrollArea } from '../components/ui/scroll-area';
import { ApprovalDialog } from './components/ApprovalDialog';
import { AgentChatInput } from './components/AgentChatInput';
import { AgentMessageList } from './components/AgentMessageList';
import { SkillsDisplay } from './components/SkillsDisplay';
import type { AgentApprovalMode, AgentRuntimeStatus } from './client';
import type { AgentSession } from './sessionStore';

const CHAT_SIDE_PADDING = 'calc(1.5rem + 10px)';
const BOTTOM_STICK_THRESHOLD_PX = 160;
const SUPPRESSED_RUNTIME_REASON = '未指定主模型，请在设置中选择或输入模型名称。';

export function AgentChatPanel({
  initialized,
  backendReady,
  backendError,
  activeSession,
  approvalMode,
  agentRuntimeStatus,
  agentConfigValidating,
  onApprovalModeChange,
  onOpenSettings,
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
  onOpenSettings: () => void;
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
  const activeApproval = useMemo(() => activeSession?.approvals[0] || null, [activeSession]);
  const inputDisabled = !backendReady || !activeSession;
  const submitDisabled = inputDisabled || agentConfigValidating || !agentRuntimeStatus.ready;
  const runtimeStatusMessage = agentConfigValidating
    ? '正在检查模型配置…'
    : agentRuntimeStatus.reason === SUPPRESSED_RUNTIME_REASON
      ? ''
      : agentRuntimeStatus.reason;

  const cancelScheduledScroll = useEffectEvent(() => {
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
  });

  const scheduleScrollToBottom = useEffectEvent(() => {
    if (!stickToBottomRef.current || scrollFrameRef.current !== null) {
      return;
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const root = scrollRef.current;
      const viewport = root?.querySelector('[data-radix-scroll-area-viewport]');
      if (!(viewport instanceof HTMLDivElement) || !stickToBottomRef.current) {
        return;
      }
      viewport.scrollTop = viewport.scrollHeight;
    });
  });

  useEffect(() => {
    const root = scrollRef.current;
    const viewport = root?.querySelector('[data-radix-scroll-area-viewport]');
    if (!(viewport instanceof HTMLDivElement)) {
      return;
    }

    const syncStickState = () => {
      stickToBottomRef.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
        BOTTOM_STICK_THRESHOLD_PX;
    };

    syncStickState();
    viewport.addEventListener('scroll', syncStickState, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', syncStickState);
      cancelScheduledScroll();
    };
  }, [activeSession?.sessionId]);

  useEffect(() => {
    const root = scrollRef.current;
    const viewport = root?.querySelector('[data-radix-scroll-area-viewport]');
    const content = viewport?.firstElementChild;
    if (!(viewport instanceof HTMLDivElement) || !(content instanceof HTMLElement)) {
      return;
    }

    const observer = new ResizeObserver(() => {
      scheduleScrollToBottom();
    });
    observer.observe(content);

    return () => observer.disconnect();
  }, [activeSession?.sessionId]);

  useEffect(() => {
    const root = scrollRef.current;
    const viewport = root?.querySelector('[data-radix-scroll-area-viewport]');
    if (!(viewport instanceof HTMLDivElement)) {
      return;
    }

    cancelScheduledScroll();
    viewport.scrollTop = viewport.scrollHeight;
    stickToBottomRef.current = true;
  }, [activeSession?.sessionId]);

  useEffect(() => {
    if (!activeSession?.sessionId) {
      return;
    }

    scheduleScrollToBottom();
  }, [activeSession?.isStreaming, activeSession?.messages, activeSession?.sessionId]);

  useEffect(() => () => cancelScheduledScroll(), []);

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
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-mutedForeground" />
            </div>
          ) : !activeSession ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="flex w-full max-w-xl flex-col items-center gap-6 rounded-[28px] bg-background px-10 py-12 text-center">
                <div className="rounded-full bg-background p-6">
                  <MessageSquarePlus className="h-10 w-10 text-mutedForeground" />
                </div>
                <h3 className="text-lg font-medium">开始新的对话</h3>
              </div>
            </div>
          ) : (
            <ScrollArea ref={scrollRef} className="h-full">
              <div className="flex min-h-full py-8" style={{ paddingInline: CHAT_SIDE_PADDING }}>
                <div className="mx-auto flex min-h-full w-full max-w-4xl">
                  <AgentMessageList
                    messages={activeSession?.messages || []}
                    isStreaming={activeSession?.isStreaming || false}
                  />
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
        
        <div className="py-5" style={{ paddingInline: CHAT_SIDE_PADDING }}>
          <div className="mx-auto max-w-3xl">
            {activeSession?.skills && (
              <SkillsDisplay skills={activeSession.skills} />
            )}
            {activeSession && runtimeStatusMessage && submitDisabled ? (
              <div
                aria-live="polite"
                className="mb-3 flex items-center justify-between gap-1 px-1 text-sm text-amber-500 font-medium"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{runtimeStatusMessage}</span>
                </div>
                {!agentConfigValidating && !agentRuntimeStatus.configured && (
                  <button
                    onClick={onOpenSettings}
                    className="underline underline-offset-4 hover:opacity-80 transition-opacity"
                  >
                    前往设置
                  </button>
                )}
              </div>
            ) : null}
            {activeSession && (
              <AgentChatInput
                inputDisabled={inputDisabled}
                submitDisabled={submitDisabled}
                submitHint={runtimeStatusMessage}
                isStreaming={activeSession?.isStreaming || false}
                approvalMode={approvalMode}
                onApprovalModeChange={onApprovalModeChange}
                onStop={onStop}
                onSubmit={onSendMessage}
              />
            )}
          </div>
        </div>
      </div>

      <ApprovalDialog
        approval={activeApproval}
        open={Boolean(activeApproval)}
        onDecision={(decision) => {
          if (!activeApproval) {
            return;
          }
          onRespondApproval(activeApproval.approvalId, decision);
        }}
      />
    </div>
  );
}
