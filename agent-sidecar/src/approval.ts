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

function hasSensitivePath(value: string) {
  return /(~\/\.ssh|~\/\.aws|~\/\.pi\/agent|\/\.ssh\b|\/\.aws\b|\/\.pi\/agent\b)/.test(value);
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
    /\b(cat|sed\s+-n|head|tail|pwd|ls|find|rg|grep|git\s+status|git\s+diff|git\s+show)\b/.test(command) &&
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

export function classifyPathRisk(targetPath: string, workspaceRoot: string): 'low' | 'high' {
  if (!targetPath) {
    return 'high';
  }
  if (!isPathInside(workspaceRoot, targetPath)) {
    return 'high';
  }
  if (hasSensitivePath(targetPath)) {
    return 'high';
  }
  return 'low';
}

export function shouldAutoApproveCommand(command: string, workspaceRoot: string) {
  return classifyCommandRisk(command, workspaceRoot) === 'low';
}
