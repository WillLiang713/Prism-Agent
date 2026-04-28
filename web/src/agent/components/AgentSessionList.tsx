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
  'z-50 min-w-24 w-max overflow-hidden !rounded-xl border border-border !bg-muted !p-1 text-foreground !shadow-[0_18px_40px_rgba(0,0,0,0.22)]';

const sessionMenuItemStateClassName =
  'transition-colors hover:!bg-foreground/[0.06] focus-visible:!bg-foreground/[0.06] data-[hovered=true]:!bg-foreground/[0.06] data-[focused]:!bg-foreground/[0.06] data-[focus-visible=true]:!bg-foreground/[0.06] data-[selected=true]:!bg-foreground/[0.08] aria-[selected=true]:!bg-foreground/[0.08] disabled:hover:!bg-transparent disabled:focus-visible:!bg-transparent';

const sessionMenuItemClassName = cn(
  'flex h-8 w-full cursor-pointer select-none items-center justify-start gap-2 whitespace-nowrap rounded-lg px-2.5 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:text-mutedForeground/45',
  sessionMenuItemStateClassName,
);

const sessionMenuDangerToneClassName =
  'hover:!text-danger focus-visible:!text-danger data-[hovered=true]:!text-danger data-[focused]:!text-danger data-[focus-visible=true]:!text-danger disabled:!text-mutedForeground/45';

const sessionMenuDangerItemClassName = cn(sessionMenuItemClassName, sessionMenuDangerToneClassName);

const sessionThreadMenuItemClassName = cn(
  sessionMenuItemClassName,
  'justify-center gap-0 px-3 text-center',
);

const sessionThreadMenuDangerItemClassName = cn(
  sessionThreadMenuItemClassName,
  sessionMenuDangerToneClassName,
);

const sessionMenuGenerateItemClassName = cn(
  sessionThreadMenuItemClassName,
  'relative bg-transparent before:absolute before:left-1 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-foreground/18',
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
  currentWorkspaceRoot,
  onCreate,
  onResume,
  onDelete,
  onRegenerateTitle,
}: {
  sessions: AgentSession[];
  threadList: AgentThreadMeta[];
  activeSessionId: string | null;
  activeThreadId: string | null;
  currentWorkspaceRoot?: string;
  onCreate: (workspaceRoot?: string) => void;
  onResume: (threadId: string, cwd: string) => void;
  onDelete: (threadId: string) => void;
  onRegenerateTitle: (threadId: string) => Promise<unknown>;
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
  const currentWorkspaceName = currentWorkspaceRoot?.split(/[\\/]/).filter(Boolean).pop();
  const createButtonLabel = currentWorkspaceName
    ? `在 ${currentWorkspaceName} 中新建会话`
    : '新建会话';

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col bg-background">
      <div className="px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={() => onCreate(currentWorkspaceRoot || undefined)}
          aria-label={createButtonLabel}
          title={currentWorkspaceRoot ? `新建会话：${currentWorkspaceRoot}` : '新建会话'}
          className="group flex h-10 w-full cursor-pointer items-center justify-center rounded-full border border-border bg-transparent px-3 py-2 text-foreground/85 outline-none transition-[background-color,border-color,color,box-shadow] hover:border-foreground/20 hover:bg-muted/60 hover:text-foreground focus-visible:border-foreground/20 focus-visible:bg-muted/60 focus-visible:ring-1 focus-visible:ring-foreground/20"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ScrollShadow className="flex-1 overflow-y-auto px-2" size={24}>
        <div className="space-y-3 pb-4">
          {groupedThreads.map((group) => (
            <div key={group.cwd} className="rounded-2xl border border-border/45 bg-card/45 p-1">
              <div className="group/dir flex h-8 items-center justify-between rounded-xl px-2.5 text-[12px] font-semibold text-mutedForeground/75">
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
                        className="!p-0 outline-none"
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
              <div className="space-y-1">
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
                      className={`group grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-1 rounded-xl px-2.5 py-2 pl-8 transition-colors ${
                        active ? 'bg-muted text-foreground' : 'text-foreground/90 hover:bg-muted/60 hover:text-foreground'
                      }`}
                    >
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <Tooltip>
                          <Tooltip.Trigger
                            className={`w-fit max-w-full truncate text-sm font-medium leading-tight ${
                              isRegenerating ? 'thinking-title-shimmer' : ''
                            }`}
                            data-shimmer-text={isRegenerating ? label : undefined}
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
                              className="!p-0 outline-none"
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
                                <span className="block w-full text-center">
                                  {isRegenerating ? '生成中…' : '生成标题'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenThreadMenu(null);
                                  onDelete(thread.threadId);
                                }}
                                className={sessionThreadMenuDangerItemClassName}
                              >
                                <span className="block w-full text-center">删除任务</span>
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
              暂无会话，点击上方「新建」开始
            </div>
          ) : null}
        </div>
      </ScrollShadow>
    </aside>
  );
}
