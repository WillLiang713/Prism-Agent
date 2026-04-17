import { MoreHorizontal, Trash2, FolderOpen, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { Button } from '../../components/ui/button';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { isDesktopRuntime } from '../../lib/runtime';
import type { AgentThreadMeta } from '../client';
import type { AgentSession } from '../sessionStore';

function previewLabel(thread: AgentThreadMeta) {
  return thread.name || thread.preview || '未命名任务';
}

function getBasename(path: string) {
  if (!path) return '未归类';
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length === 0) return path;
  return parts[parts.length - 1];
}

export function AgentSessionList({
  sessions,
  threadList,
  activeSessionId,
  activeThreadId,
  onCreate,
  onResume,
  onDelete,
}: {
  sessions: AgentSession[];
  threadList: AgentThreadMeta[];
  activeSessionId: string | null;
  activeThreadId: string | null;
  onCreate: (workspaceRoot?: string) => void;
  onResume: (threadId: string, cwd: string) => void;
  onDelete: (threadId: string) => void;
}) {
  const activeCwd = useMemo(() => {
    const thread = threadList.find((t) => t.threadId === activeThreadId);
    if (thread) return thread.cwd;
    const session = sessions.find((s) => s.sessionId === activeSessionId);
    if (session) return session.workspaceRoot;
    return undefined;
  }, [activeThreadId, activeSessionId, threadList, sessions]);

  const sortedThreads = useMemo(
    () => [...threadList].sort((a, b) => b.updatedAt - a.updatedAt),
    [threadList],
  );

  const handleCreateNew = () => {
    onCreate(activeCwd);
  };

  const handleOpenDirectory = async () => {
    if (!isDesktopRuntime()) {
      const selected = window.prompt('输入要打开的工作目录路径');
      if (selected?.trim()) {
        onCreate(selected.trim());
      }
      return;
    }

    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择工作目录',
    });
    if (typeof selected === 'string') {
      onCreate(selected);
    }
  };

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col bg-background">
      <div className="flex items-center gap-1 p-2">
        <Button
          type="button"
          variant="ghost"
          onClick={handleCreateNew}
          aria-label="新建任务"
          className="h-9 flex-1 justify-start gap-2 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-muted/60"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          <span>新任务</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleOpenDirectory}
          aria-label="选择其他目录"
          className="h-9 w-9 shrink-0 rounded-lg p-0 text-mutedForeground hover:bg-muted/60 hover:text-foreground"
        >
          <FolderOpen aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5 pb-4">
          {sortedThreads.map((thread) => {
            const loadedSession = sessions.find((session) => session.threadId === thread.threadId);
            const active =
              (loadedSession && loadedSession.sessionId === activeSessionId) ||
              thread.threadId === activeThreadId;

            const label = previewLabel(thread);
            const dirLabel = getBasename(thread.cwd);

            return (
              <div
                key={thread.threadId}
                className={`group grid w-full grid-cols-[1fr_auto] items-center gap-1 rounded-lg px-3 py-2 transition-colors ${
                  active ? 'bg-foreground/[0.08]' : 'hover:bg-muted/60'
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onResume(thread.threadId, thread.cwd)}
                  className="min-w-0 cursor-pointer flex flex-col gap-0.5"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onResume(thread.threadId, thread.cwd);
                    }
                  }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="truncate text-sm font-medium leading-tight w-fit max-w-full">
                        {label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start" sideOffset={4}>
                      <div className="font-medium">{label}</div>
                      <div className="mt-0.5 text-[11px] text-mutedForeground break-all">
                        {thread.cwd}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  {dirLabel && dirLabel !== '未归类' && (
                    <div className="truncate text-[11px] text-mutedForeground/60">
                      {dirLabel}
                    </div>
                  )}
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
                              onDelete(thread.threadId);
                            }}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger outline-none transition-colors hover:bg-danger/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>删除对话</span>
                          </button>
                        </PopoverPrimitive.Close>
                      </PopoverPrimitive.Content>
                    </PopoverPrimitive.Portal>
                  </PopoverPrimitive.Root>
                </div>
              </div>
            );
          })}
          {sortedThreads.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-mutedForeground/50">
              暂无记录
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </aside>
  );
}
