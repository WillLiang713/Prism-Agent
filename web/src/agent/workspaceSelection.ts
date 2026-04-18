import type { AgentThreadMeta } from './client';

export function resolveWorkspaceSelection(selectedWorkspace: string, threadList: AgentThreadMeta[]) {
  const matchingThread = threadList
    .filter((thread) => (thread.cwd || '') === selectedWorkspace)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  if (matchingThread) {
    return {
      mode: 'resume' as const,
      threadId: matchingThread.threadId,
      cwd: selectedWorkspace,
    };
  }

  return {
    mode: 'create' as const,
    cwd: selectedWorkspace,
  };
}
