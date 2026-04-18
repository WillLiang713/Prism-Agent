import type { AgentThreadMeta } from '../client';

function getBasename(path: string) {
  if (!path) return '通用任务';
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length === 0) return path;
  return parts[parts.length - 1];
}

export function buildSessionGroups(threadList: AgentThreadMeta[], pinnedDirectories: string[]) {
  return pinnedDirectories
    .map((cwd) => ({
      cwd,
      basename: getBasename(cwd),
      threads: threadList
        .filter((thread) => (thread.cwd || '') === cwd)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    }))
    .sort((a, b) => a.basename.localeCompare(b.basename));
}
