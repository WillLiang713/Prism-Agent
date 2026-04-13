import { MessageSquarePlus, Loader2, AlertCircle } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { ScrollArea } from '../components/ui/scroll-area';
import { ApprovalDialog } from './components/ApprovalDialog';
import { AgentChatInput } from './components/AgentChatInput';
import { AgentMessageList } from './components/AgentMessageList';
import { AgentSessionList } from './components/AgentSessionList';
import { SkillsDisplay } from './components/SkillsDisplay';
import { Button } from '../components/ui/button';
import type { AgentRuntimeStatus, AgentThreadMeta } from './client';
import type { AgentSession } from './sessionStore';

const CHAT_SIDE_PADDING = 'calc(1.5rem + 10px)';

export function AgentChatPanel({
  initialized,
  backendReady,
  backendError,
  threadList,
  sessions,
  activeSession,
  agentRuntimeStatus,
  agentConfigValidating,
  onOpenSettings,
  onCreateSession,
  onResumeThread,
  onSendMessage,
  onStop,
  onRespondApproval,
  onDeleteThread,
}: {
  initialized: boolean;
  backendReady: boolean;
  backendError: string;
  threadList: AgentThreadMeta[];
  sessions: AgentSession[];
  activeSession: AgentSession | null;
  agentRuntimeStatus: AgentRuntimeStatus;
  agentConfigValidating: boolean;
  onOpenSettings: () => void;
  onCreateSession: (workspaceRoot?: string) => void;
  onResumeThread: (threadId: string, cwd: string) => void;
  onSendMessage: (payload: {
    text: string;
    images: Array<{ name: string; mediaType: string; dataUrl: string }>;
    reasoningEffort: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  }) => void;
  onStop: () => void;
  onRespondApproval: (approvalId: string, decision: 'allow' | 'deny') => void;
  onDeleteThread: (threadId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeApproval = useMemo(() => activeSession?.approvals[0] || null, [activeSession]);
  const inputDisabled = !backendReady || !activeSession;
  const submitDisabled = inputDisabled || agentConfigValidating || !agentRuntimeStatus.ready;
  const runtimeStatusMessage = agentConfigValidating
    ? '正在检查模型配置…'
    : agentRuntimeStatus.reason;

  useEffect(() => {
    const root = scrollRef.current;
    const viewport = root?.querySelector('[data-radix-scroll-area-viewport]');
    if (!(viewport instanceof HTMLDivElement)) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [activeSession?.messages, activeSession?.isStreaming]);

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <AgentSessionList
        sessions={sessions}
        threadList={threadList}
        activeSessionId={activeSession?.sessionId || null}
        activeThreadId={activeSession?.threadId || null}
        onCreate={onCreateSession}
        onResume={onResumeThread}
        onDelete={onDeleteThread}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {!backendReady && backendError ? (
          <div className="flex items-center gap-2 bg-danger/5 px-6 py-3 text-sm text-danger">
            <AlertCircle className="h-4 w-4" />
            <span>后端服务异常: {backendError}</span>
          </div>
        ) : null}
        
        <div className="flex-1 overflow-hidden">
          {!initialized ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-mutedForeground" />
              <p className="text-sm text-mutedForeground">正在启动后端服务...</p>
            </div>
          ) : !activeSession ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
              <div className="rounded-full bg-muted p-6">
                <MessageSquarePlus className="h-10 w-10 text-mutedForeground" />
              </div>
              <div className="max-w-sm space-y-2">
                <h3 className="text-lg font-medium">开始新的对话</h3>
                <p className="text-sm text-mutedForeground">
                  选择左侧的历史会话，或点击下方按钮开启一个新的任务。
                </p>
              </div>
              <Button onClick={() => onCreateSession()} variant="primary" className="h-11 px-8 rounded-full">
                开启新会话
              </Button>
            </div>
          ) : (
            <ScrollArea ref={scrollRef} className="h-full">
              <div className="flex min-h-full py-8" style={{ paddingInline: CHAT_SIDE_PADDING }}>
                <div className="mx-auto flex min-h-full w-full max-w-3xl">
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
            {runtimeStatusMessage && submitDisabled ? (
              <div
                aria-live="polite"
                className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm leading-6 text-amber-500/90"
              >
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{runtimeStatusMessage}</span>
                </div>
                {!agentConfigValidating && !agentRuntimeStatus.configured && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onOpenSettings}
                    className="h-7 rounded-lg bg-amber-500/10 px-3 text-[11px] font-medium text-amber-500 hover:bg-amber-500/20"
                  >
                    前往设置
                  </Button>
                )}
              </div>
            ) : null}
            <AgentChatInput
              inputDisabled={inputDisabled}
              submitDisabled={submitDisabled}
              submitHint={runtimeStatusMessage}
              isStreaming={activeSession?.isStreaming || false}
              onStop={onStop}
              onSubmit={onSendMessage}
            />
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
