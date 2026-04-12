import { History, Plus, FolderOpen, Folder, Trash2, Check, X } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { open, ask } from '@tauri-apps/plugin-dialog';

import { Button } from '../../components/ui/button';
import { ScrollArea } from '../../components/ui/scroll-area';
import type { CodexThreadMeta } from '../client';
import type { CodexSession } from '../sessionStore';

function previewLabel(thread: CodexThreadMeta) {
  return thread.name || thread.preview || '未命名会话';
}

function getBasename(path: string) {
  if (!path) return '未归类';
  // 针对不同平台处理路径分隔符
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length === 0) return path;
  return parts[parts.length - 1];
}

export function CodexSessionList({
  sessions,
  threadList,
  activeSessionId,
  activeThreadId,
  onCreate,
  onResume,
  onDelete,
}: {
  sessions: CodexSession[];
  threadList: CodexThreadMeta[];
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
    const groups: Record<string, CodexThreadMeta[]> = {};
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

  // 点击外部重置确认状态
  useEffect(() => {
    const handleClick = () => {
      setPendingDeleteId(null);
      setPendingDeleteGroup(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleDeleteThread = (threadId: string) => {
    // 设置状态为 null 必须在调用业务逻辑之前或之后尽快完成
    setPendingDeleteId(null);
    onDelete(threadId);
  };

  const handleDeleteGroup = (threads: CodexThreadMeta[]) => {
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
          className="h-10 w-full justify-center gap-2 rounded-xl text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>新会话</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleOpenDirectory}
          className="h-10 w-full justify-center gap-2 rounded-xl text-sm border border-dashed border-border/60 hover:border-border"
        >
          <FolderOpen className="h-4 w-4" />
          <span>添加目录</span>
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2 px-5 text-[10px] font-bold uppercase tracking-[0.15em] text-mutedForeground/60">
        <History className="h-3 w-3" />
        历史记录
      </div>

      <ScrollArea className="mt-2 flex-1 px-3">
        <div className="pb-4 pt-2">
          {groupedThreads.map((group) => (
            <div key={group.cwd} className="mb-5 last:mb-0">
              <div className="group/header mb-1.5 grid grid-cols-[1fr_auto] items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-widest text-mutedForeground/40">
                <div className="flex min-w-0 items-center gap-2">
                  <Folder className="h-3.5 w-3.5 opacity-70 group-hover/header:opacity-100 shrink-0" />
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
                      className={`group grid w-full grid-cols-[1fr_auto] items-center gap-1 rounded-lg px-2 py-1.5 transition-all ${
                        active ? 'bg-card shadow-sm' : 'hover:bg-muted/50'
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
              暂无历史记录
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </aside>
  );
}
