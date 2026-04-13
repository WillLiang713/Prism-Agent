import { Trash2, Check, X } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';

import { Button } from '../../components/ui/button';
import { ScrollArea } from '../../components/ui/scroll-area';
import type { AgentThreadMeta } from '../client';
import type { AgentSession } from '../sessionStore';

function previewLabel(thread: AgentThreadMeta) {
  return thread.name || thread.preview || '未命名会话';
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

  const groupedThreads = useMemo(() => {
    const groups: Record<string, AgentThreadMeta[]> = {};
    threadList.forEach((thread) => {
      const key = thread.cwd || '';
      if (!groups[key]) groups[key] = [];
      groups[key].push(thread);
    });

    return Object.entries(groups)
      .map(([cwd, threads]) => ({
        cwd,
        label: getBasename(cwd),
        threads: threads.sort((a, b) => b.updatedAt - a.updatedAt),
        latestUpdate: Math.max(...threads.map((t) => t.updatedAt)),
      }))
      .sort((a, b) => b.latestUpdate - a.latestUpdate);
  }, [threadList]);

  const handleCreateNew = () => {
    onCreate(activeCwd);
  };

  const handleOpenDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择工作目录',
    });
    if (typeof selected === 'string') {
      onCreate(selected);
    }
  };

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<string | null>(null);

  useEffect(() => {
    const handleClick = () => {
      setPendingDeleteId(null);
      setPendingDeleteGroup(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleDeleteThread = (threadId: string) => {
    setPendingDeleteId(null);
    onDelete(threadId);
  };

  const handleDeleteGroup = (threads: AgentThreadMeta[]) => {
    setPendingDeleteGroup(null);
    threads.forEach((t) => onDelete(t.threadId));
  };

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col bg-muted/30">
      <div className="p-4 pb-2 flex flex-col gap-2">
        <Button
          type="button"
          variant="surface"
          onClick={handleCreateNew}
          className="h-10 w-full justify-center rounded-xl text-sm"
        >
          <span>新会话</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleOpenDirectory}
          className="h-10 w-full justify-center rounded-xl border border-dashed border-border/70 bg-muted/70 text-sm text-foreground hover:bg-muted hover:border-border"
        >
          <span>添加目录</span>
        </Button>
      </div>

      <ScrollArea className="mt-2 flex-1 px-3">
        <div className="pb-4 pt-2">
          {groupedThreads.map((group) => (
            <div key={group.cwd} className="mb-5 last:mb-0">
              <div className="group/header mb-1.5 grid grid-cols-[1fr_auto] items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-widest text-mutedForeground/40">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate" title={group.cwd}>{group.label}</span>
                </div>
                {pendingDeleteGroup === group.cwd ? (
                  <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(group.threads);
                      }}
                      className="p-1 hover:bg-success/20 text-success rounded-md transition-all"
                      title="确认清空"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteGroup(null);
                      }}
                      className="p-1 hover:bg-muted text-mutedForeground rounded-md transition-all"
                      title="取消"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteGroup(group.cwd);
                    }}
                    className="opacity-0 group-hover/header:opacity-100 p-1 hover:bg-danger/10 hover:text-danger rounded-md transition-all shrink-0 text-mutedForeground/80"
                    title="清空此目录下的会话"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="space-y-0.5">
                {group.threads.map((thread) => {
                  const loadedSession = sessions.find((session) => session.threadId === thread.threadId);
                  const active =
                    (loadedSession && loadedSession.sessionId === activeSessionId) ||
                    thread.threadId === activeThreadId;

                  const label = previewLabel(thread);

                  return (
                    <div
                      key={thread.threadId}
                      className={`group grid w-full grid-cols-[1fr_auto] items-center gap-1 rounded-xl border px-2 py-1.5 transition-colors ${
                        active
                          ? 'border-border/70 bg-muted'
                          : 'border-transparent hover:border-border/40 hover:bg-foreground/[0.04]'
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onResume(thread.threadId, thread.cwd)}
                        title={`${label}\n${thread.cwd}`}
                        className="min-w-0 cursor-pointer flex flex-col gap-0.5 px-1 py-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onResume(thread.threadId, thread.cwd);
                          }
                        }}
                      >
                        <div className="truncate text-sm font-medium leading-tight">
                          {label}
                        </div>
                        {thread.cwd.replace(group.cwd, '').replace(/^[/\\]/, '') && (
                          <div className="line-clamp-1 w-full text-[11px] opacity-40 font-mono">
                            {thread.cwd.replace(group.cwd, '').replace(/^[/\\]/, '')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {pendingDeleteId === thread.threadId ? (
                          <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteThread(thread.threadId);
                              }}
                              className="p-1 hover:bg-success/20 text-success rounded-md transition-all"
                              title="确认删除"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDeleteId(null);
                              }}
                              className="p-1 hover:bg-muted text-mutedForeground rounded-md transition-all"
                              title="取消"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteId(thread.threadId);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-danger/10 hover:text-danger rounded-md transition-all text-mutedForeground/80"
                            title="归档此会话"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
