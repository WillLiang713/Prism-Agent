import { MoreHorizontal, Plus, Folder, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Popover } from '@heroui/react/popover';
import { ScrollShadow } from '@heroui/react/scroll-shadow';
import { Tooltip } from '@heroui/react/tooltip';

import { useAgentSessionStore } from '../sessionStore';

import { cn } from '../../lib/utils';
import type { AgentThreadMeta } from '../client';
import type { AgentSession } from '../sessionStore';
import { buildSessionGroups } from './sessionGroups';

const sessionMenuContentClassName =
  'z-50 min-w-24 w-max overflow-hidden rounded-xl border border-border bg-muted p-1 text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.22)]';

const sessionMenuItemClassName =
  'flex h-8 w-full cursor-pointer select-none items-center justify-start gap-2 whitespace-nowrap rounded-lg px-2.5 text-sm text-foreground outline-none transition-colors hover:bg-card focus-visible:bg-card disabled:cursor-not-allowed disabled:text-mutedForeground/45 disabled:hover:bg-transparent';

const sessionMenuDangerItemClassName = cn(
  sessionMenuItemClassName,
  'hover:bg-danger/10 hover:text-danger focus-visible:bg-danger/10 focus-visible:text-danger',
);

const sessionMenuGenerateItemClassName = cn(
  sessionMenuItemClassName,
  'relative bg-transparent before:absolute before:left-1 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-foreground/18',
  'hover:bg-card focus-visible:bg-card',
  'dark:before:bg-foreground/24',
  'disabled:before:bg-transparent',
);

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
  onPickWorkspace,
}: {
  sessions: AgentSession[];
  threadList: AgentThreadMeta[];
  activeSessionId: string | null;
  activeThreadId: string | null;
  onCreate: (workspaceRoot?: string) => void;
  onResume: (threadId: string, cwd: string) => void;
  onDelete: (threadId: string) => void;
  onRegenerateTitle: (threadId: string) => Promise<unknown>;
  onPickWorkspace: () => void;
}) {
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(() => new Set());
  const [openDirectoryMenu, setOpenDirectoryMenu] = useState<string | null>(null);
  const [openThreadMenu, setOpenThreadMenu] = useState<string | null>(null);

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
      <div className="px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={onPickWorkspace}
          className="group flex w-full cursor-pointer items-center justify-center rounded-full border border-border bg-transparent px-3 py-2 text-sm font-medium text-foreground/85 transition-colors hover:border-foreground/20 hover:bg-muted/60 hover:text-foreground"
        >
          <span className="truncate text-center">载入</span>
        </button>
      </div>
      <ScrollShadow className="flex-1 overflow-y-auto px-2" size={24}>
        <div className="space-y-4 pb-4">
          {groupedThreads.map((group) => (
            <div key={group.cwd} className="mb-4 last:mb-0">
              <div className="group/dir px-3 pt-2 pb-1.5 flex items-center justify-between text-[12px] font-semibold text-mutedForeground/70">
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate" title={group.cwd}>
                    {group.basename}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    aria-label={`在 ${group.basename} 中新建任务`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreate(group.cwd);
                    }}
                    className="cursor-pointer rounded-md p-1 text-mutedForeground/80 opacity-0 outline-none transition-[opacity,background-color,color,box-shadow] hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-foreground/20 group-hover/dir:opacity-100"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                  </button>

                  <Popover
                    isOpen={openDirectoryMenu === group.cwd}
                    onOpenChange={(nextOpen) => setOpenDirectoryMenu(nextOpen ? group.cwd : null)}
                  >
                    <Popover.Trigger
                      onClick={(e) => e.stopPropagation()}
                      aria-label="目录操作"
                      className={`cursor-pointer rounded-md p-1 text-mutedForeground/80 opacity-0 outline-none transition-[opacity,background-color,color,box-shadow] hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-foreground/20 group-hover/dir:opacity-100 ${
                        openDirectoryMenu === group.cwd ? 'opacity-100' : ''
                      }`}
                    >
                      <MoreHorizontal className="h-3 w-3" aria-hidden="true" />
                    </Popover.Trigger>
                    <Popover.Content
                      placement="bottom end"
                      offset={4}
                      className={sessionMenuContentClassName}
                    >
                      <Popover.Dialog
                        className="outline-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            unpinDirectory(group.cwd);
                            setOpenDirectoryMenu(null);
                          }}
                          className={sessionMenuDangerItemClassName}
                        >
                          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>移除目录</span>
                        </button>
                      </Popover.Dialog>
                    </Popover.Content>
                  </Popover>
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
                          <Tooltip.Trigger
                            className={`w-fit max-w-full truncate text-sm font-medium leading-tight ${
                              isRegenerating ? 'thinking-title-shimmer' : ''
                            }`}
                          >
                            {label}
                          </Tooltip.Trigger>
                          <Tooltip.Content
                            placement="bottom start"
                            offset={4}
                            className="z-50 max-w-xs rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-xs text-cardForeground shadow-lg"
                          >
                            <div className="font-medium">{label}</div>
                            <div className="mt-0.5 text-[12px] text-mutedForeground break-all">
                              {thread.cwd}
                            </div>
                          </Tooltip.Content>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Popover
                          isOpen={openThreadMenu === thread.threadId}
                          onOpenChange={(nextOpen) => setOpenThreadMenu(nextOpen ? thread.threadId : null)}
                        >
                          <Popover.Trigger
                            onClick={(e) => e.stopPropagation()}
                            aria-label="更多操作"
                            className={`cursor-pointer rounded-md p-1.5 text-mutedForeground/80 opacity-0 outline-none transition-[opacity,background-color,color,box-shadow] hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-foreground/20 group-hover:opacity-100 ${
                              openThreadMenu === thread.threadId ? 'opacity-100' : ''
                            }`}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                          </Popover.Trigger>
                          <Popover.Content
                            placement="bottom end"
                            offset={4}
                            className={sessionMenuContentClassName}
                          >
                            <Popover.Dialog
                              className="outline-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (regenerateDisabled) return;
                                  setOpenThreadMenu(null);
                                  void handleRegenerate(thread.threadId);
                                }}
                                disabled={regenerateDisabled}
                                className={sessionMenuGenerateItemClassName}
                              >
                                <span>{isRegenerating ? '生成中…' : '生成标题'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenThreadMenu(null);
                                  onDelete(thread.threadId);
                                }}
                                className={sessionMenuDangerItemClassName}
                              >
                                <span>删除任务</span>
                              </button>
                            </Popover.Dialog>
                          </Popover.Content>
                        </Popover>
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
              暂无目录，点击上方「载入」开始
            </div>
          ) : null}
        </div>
      </ScrollShadow>
    </aside>
  );
}
