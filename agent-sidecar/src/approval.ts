import path from 'node:path';

function normalizePath(value: string) {
  return path.resolve(value);
}

function isPathInside(root: string, target: string) {
  const normalizedRoot = normalizePath(root);
  const normalizedTarget = normalizePath(target);
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)
  );
}

function hasSensitivePath(command: string) {
  return /(~\/\.ssh|~\/\.aws|~\/\.codex\/auth\.json|\/\.ssh\b|\/\.aws\b|\/\.codex\/auth\.json\b)/.test(
    command,
  );
}

function hasDangerousShellPattern(command: string) {
  return /(rm\s+-rf\b|sudo\b|git\s+push\s+--force\b|curl\b[^|]*\|\s*sh\b|wget\b[^|]*\|\s*sh\b)/.test(
    command,
  );
}

export function classifyCommandRisk(command: string, workspaceRoot: string): 'low' | 'high' {
  if (hasSensitivePath(command) || hasDangerousShellPattern(command)) {
    return 'high';
  }

  if (
    /\b(cat|sed\s+-n|head|tail|pwd|ls|find|rg|git\s+status|git\s+diff|git\s+show)\b/.test(command) &&
    !/\b(>|>>|tee|mv|cp|rm|touch|mkdir|chmod|chown)\b/.test(command)
  ) {
    return 'low';
  }

  const pathMatches = command.match(/(?:\/[^\s'"]+)+/g) ?? [];
  if (pathMatches.length > 0 && pathMatches.every((target) => isPathInside(workspaceRoot, target))) {
    return 'low';
  }

  return 'high';
}

export function classifyFileChangeRisk(
  changes: Array<{ path: string }>,
  workspaceRoot: string,
): 'low' | 'high' {
  if (changes.length === 0) {
    return 'high';
  }

  if (
    changes.every((change) => isPathInside(workspaceRoot, change.path)) &&
    changes.every((change) => !hasSensitivePath(change.path))
  ) {
    return 'low';
  }

  return 'high';
}

export function shouldAutoApproveCommand(command: string, workspaceRoot: string) {
  return classifyCommandRisk(command, workspaceRoot) === 'low';
}
