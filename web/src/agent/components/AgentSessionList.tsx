import { MoreHorizontal, Sparkles, Trash2, Plus, Folder } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAgentSessionStore } from '../sessionStore';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { ScrollArea } from '../../components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import type { AgentThreadMeta } from '../client';
import type { AgentSession } from '../sessionStore';
import { buildSessionGroups } from './sessionGroups';

function previewLabel(thread: AgentThreadMeta) {
  return thread.name || thread.preview || '新任务';
}

export function AgentSessionList({
  sessions,
  threadList,
  activeSessionId,
  activeThreadId,
  onCreate,
  onResume,
  onDelete,
  onRegenerateTitle,
}: {
  sessions: AgentSession[];
  threadList: AgentThreadMeta[];
  activeSessionId: string | null;
  activeThreadId: string | null;
  onCreate: (workspaceRoot?: string) => void;
  onResume: (threadId: string, cwd: string) => void;
  onDelete: (threadId: string) => void;
  onRegenerateTitle: (threadId: string) => Promise<unknown>;
}) {
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(() => new Set());

  const handleRegenerate = async (threadId: string) => {
    setRegeneratingIds((prev) => {
      const next = new Set(prev);
      next.add(threadId);
      return next;
    });
    try {
      await onRegenerateTitle(threadId);
    } catch {
    } finally {
      setRegeneratingIds((prev) => {
        if (!prev.has(threadId)) return prev;
        const next = new Set(prev);
        next.delete(threadId);
        return next;
      });
    }
  };

  const pinnedDirectories = useAgentSessionStore((state) => state.pinnedDirectories);
  const unpinDirectory = useAgentSessionStore((state) => state.unpinDirectory);
  
  const groupedThreads = useMemo(
    () => buildSessionGroups(threadList, pinnedDirectories),
    [threadList, pinnedDirectories],
  );

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col bg-background">
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-4 pb-4">
          {groupedThreads.map((group) => (
            <div key={group.cwd} className="mb-4 last:mb-0">
              <div className="group/dir px-3 pt-2 pb-1.5 flex items-center justify-between text-[12px] font-semibold text-mutedForeground/70">
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate" title={group.cwd}>
                    {group.basename}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreate(group.cwd);
                        }}
                        className="cursor-pointer opacity-0 group-hover/dir:opacity-100 p-1 hover:bg-muted rounded-md transition-all text-mutedForeground/80 hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" />
                      </button>

                  <PopoverPrimitive.Root>
                    <PopoverPrimitive.Trigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="目录操作"
                        className="cursor-pointer opacity-0 group-hover/dir:opacity-100 data-[state=open]:opacity-100 p-1 hover:bg-muted rounded-md transition-all text-mutedForeground/80 hover:text-foreground"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                    </PopoverPrimitive.Trigger>
                    <PopoverPrimitive.Portal>
                      <PopoverPrimitive.Content
                        side="right"
                        align="start"
                        sideOffset={6}
                        collisionPadding={8}
                        onClick={(e) => e.stopPropagation()}
                        className="z-50 min-w-[140px] overflow-hidden rounded-xl border border-border bg-muted p-1 text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
                      >
                        <PopoverPrimitive.Close asChild>
                          <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                unpinDirectory(group.cwd);
                              }}
                              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-[rgba(239,68,68,0.16)] hover:text-danger focus-visible:bg-[rgba(239,68,68,0.16)] focus-visible:text-danger"
                            >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>移除目录</span>
                          </button>
                        </PopoverPrimitive.Close>
                      </PopoverPrimitive.Content>
                    </PopoverPrimitive.Portal>
                  </PopoverPrimitive.Root>
                </div>
              </div>
              <div className="space-y-0.5">
                {group.threads.map((thread) => {
                  const loadedSession = sessions.find((session) => session.threadId === thread.threadId);
                  const active =
                    (loadedSession && loadedSession.sessionId === activeSessionId) ||
                    thread.threadId === activeThreadId;

                  const label = previewLabel(thread);
                  const isRegenerating = regeneratingIds.has(thread.threadId);
                  const canRegenerateTitle =
                    (loadedSession?.messages.length ?? thread.messageCount) >= 2;
                  const regenerateDisabled = isRegenerating || !canRegenerateTitle;

                  return (
                    <div
                      key={thread.threadId}
                      role="button"
                      tabIndex={0}
                      onClick={() => onResume(thread.threadId, thread.cwd)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onResume(thread.threadId, thread.cwd);
                        }
                      }}
                      className={`group grid w-full grid-cols-[1fr_auto] items-center gap-1 rounded-lg px-3 py-2 transition-colors cursor-pointer ${
                        active ? 'bg-foreground/[0.08]' : 'hover:bg-muted/60'
                      }`}
                    >
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={`truncate text-sm font-medium leading-tight w-fit max-w-full ${
                                isRegenerating ? 'thinking-title-shimmer' : ''
                              }`}
                            >
                              {label}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start" sideOffset={4}>
                            <div className="font-medium">{label}</div>
                            <div className="mt-0.5 text-[12px] text-mutedForeground break-all">
                              {thread.cwd}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <PopoverPrimitive.Root>
                          <PopoverPrimitive.Trigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="更多操作"
                              className="cursor-pointer opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 p-1.5 hover:bg-muted rounded-md transition-all text-mutedForeground/80 hover:text-foreground"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </PopoverPrimitive.Trigger>
                          <PopoverPrimitive.Portal>
                            <PopoverPrimitive.Content
                              side="right"
                              align="start"
                              sideOffset={6}
                              collisionPadding={8}
                              onClick={(e) => e.stopPropagation()}
                              className="z-50 min-w-[140px] overflow-hidden rounded-xl border border-border bg-muted p-1 text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
                            >
                              <PopoverPrimitive.Close asChild>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (regenerateDisabled) return;
                                    void handleRegenerate(thread.threadId);
                                  }}
                                  disabled={regenerateDisabled}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-card disabled:cursor-not-allowed disabled:text-mutedForeground/45 disabled:hover:bg-transparent"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>{isRegenerating ? '生成中…' : '生成标题'}</span>
                                </button>
                              </PopoverPrimitive.Close>
                              <PopoverPrimitive.Close asChild>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(thread.threadId);
                                  }}
                                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-[rgba(239,68,68,0.16)] hover:text-danger focus-visible:bg-[rgba(239,68,68,0.16)] focus-visible:text-danger"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>删除任务</span>
                                </button>
                              </PopoverPrimitive.Close>
                            </PopoverPrimitive.Content>
                          </PopoverPrimitive.Portal>
                        </PopoverPrimitive.Root>
                      </div>
                    </div>
                  );
                })}
                {group.threads.length === 0 && (
                  <div className="px-8 py-2 text-[12px] text-mutedForeground/50">
                    无任务
                  </div>
                )}
              </div>
            </div>
          ))}
          {groupedThreads.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-mutedForeground/50">
              暂无记录
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </aside>
  );
}
