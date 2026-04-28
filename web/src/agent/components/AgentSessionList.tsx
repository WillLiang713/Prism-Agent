import { MoreHorizontal, Plus, Folder, PencilLine, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react/button';
import { ListBox } from '@heroui/react/list-box';
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
  'bg-transparent',
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
        <Button
          type="button"
          variant="ghost"
          onPress={() => onCreate(currentWorkspaceRoot || undefined)}
          aria-label={createButtonLabel}
          className="group h-8 min-h-8 w-full cursor-pointer justify-start gap-2 rounded-xl border border-transparent bg-transparent px-2.5 py-1.5 text-mutedForeground/90 shadow-none transition-[background-color,border-color,color,box-shadow] hover:border-border/55 hover:bg-muted/55 hover:text-foreground focus-visible:border-foreground/20 focus-visible:bg-muted/60 focus-visible:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/20"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-card/45 text-mutedForeground transition-[background-color,color] group-hover:bg-card group-hover:text-foreground">
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 truncate text-[13px] font-medium leading-none">新会话</span>
        </Button>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    aria-label={`在 ${group.basename} 中新建任务`}
                    onPress={() => {
                      onCreate(group.cwd);
                    }}
                    className="h-6 min-h-6 w-6 min-w-6 cursor-pointer rounded-md bg-transparent p-0 text-mutedForeground/80 opacity-0 shadow-none transition-[opacity,background-color,color,box-shadow] hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-foreground/20 group-hover/dir:opacity-100"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                  </Button>

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
                        <ListBox
                          aria-label="目录操作"
                          className="!p-0"
                          onAction={(key) => {
                            if (key !== 'unpin-directory') return;
                            unpinDirectory(group.cwd);
                            setOpenDirectoryMenu(null);
                          }}
                        >
                          <ListBox.Item
                            id="unpin-directory"
                            textValue="移除目录"
                            className={sessionMenuDangerItemClassName}
                          >
                            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>移除目录</span>
                          </ListBox.Item>
                        </ListBox>
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
                      className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-xl transition-colors ${
                        active ? 'bg-muted text-foreground' : 'text-foreground/90 hover:bg-muted/60 hover:text-foreground'
                      }`}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        fullWidth
                        onPress={() => onResume(thread.threadId, thread.cwd)}
                        aria-label={`打开任务：${label}`}
                        className="h-auto min-h-0 w-full min-w-0 justify-start rounded-xl bg-transparent px-2.5 py-2 pl-8 text-left text-inherit shadow-none hover:bg-transparent focus-visible:ring-1 focus-visible:ring-foreground/20"
                      >
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <Tooltip delay={900} closeDelay={100} trigger="hover">
                            <Tooltip.Trigger
                              className={`block w-fit max-w-full truncate text-sm font-medium leading-tight ${
                                isRegenerating ? 'thinking-title-shimmer' : ''
                              }`}
                              data-shimmer-text={isRegenerating ? label : undefined}
                            >
                              {label}
                            </Tooltip.Trigger>
                            <Tooltip.Content
                              placement="bottom start"
                              offset={6}
                              className="z-50 max-w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border/60 bg-muted px-3 py-2 text-sm font-medium leading-snug text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.20)]"
                            >
                              <span className="block whitespace-normal break-words">{label}</span>
                            </Tooltip.Content>
                          </Tooltip>
                        </span>
                      </Button>
                      <div className="flex items-center gap-0.5 shrink-0 pr-2.5">
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
                              <ListBox
                                aria-label="任务操作"
                                className="!p-0"
                                disabledKeys={regenerateDisabled ? ['regenerate-title'] : []}
                                onAction={(key) => {
                                  if (key === 'regenerate-title') {
                                    if (regenerateDisabled) return;
                                    setOpenThreadMenu(null);
                                    void handleRegenerate(thread.threadId);
                                    return;
                                  }
                                  if (key === 'delete-thread') {
                                    setOpenThreadMenu(null);
                                    onDelete(thread.threadId);
                                  }
                                }}
                              >
                                <ListBox.Item
                                  id="regenerate-title"
                                  textValue={isRegenerating ? '生成中' : '生成标题'}
                                  className={sessionMenuGenerateItemClassName}
                                >
                                  <span className="block w-full text-center">
                                    {isRegenerating ? '生成中…' : '生成标题'}
                                  </span>
                                </ListBox.Item>
                                <ListBox.Item
                                  id="delete-thread"
                                  textValue="删除任务"
                                  className={sessionThreadMenuDangerItemClassName}
                                >
                                  <span className="block w-full text-center">删除任务</span>
                                </ListBox.Item>
                              </ListBox>
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
