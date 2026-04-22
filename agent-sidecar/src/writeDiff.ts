export interface WriteDiffSeed {
  path: string;
  existed: boolean;
  previousContent: string | null;
}

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, '\n');
}

function splitDiffLines(value: string) {
  const normalized = normalizeLineEndings(value);
  if (normalized === '') {
    return [];
  }

  if (!normalized.endsWith('\n')) {
    return normalized.split('\n');
  }

  const withoutTrailingNewline = normalized.slice(0, -1);
  return withoutTrailingNewline === '' ? [''] : withoutTrailingNewline.split('\n');
}

function normalizeDiffPath(filePath: string) {
  return filePath.replace(/\\/g, '/');
}

function buildHunkHeader(oldLines: string[], newLines: string[]) {
  const oldCount = oldLines.length;
  const newCount = newLines.length;
  const oldStart = oldCount === 0 ? 0 : 1;
  const newStart = newCount === 0 ? 0 : 1;
  return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
}

export function createWriteUnifiedDiff(seed: WriteDiffSeed, nextContent: string) {
  const previousContent = seed.previousContent ?? '';
  const normalizedPrevious = normalizeLineEndings(previousContent);
  const normalizedNext = normalizeLineEndings(nextContent);

  if (normalizedPrevious === normalizedNext) {
    return undefined;
  }

  const diffPath = normalizeDiffPath(seed.path);
  const oldPath = seed.existed ? `a/${diffPath}` : '/dev/null';
  const newPath = `b/${diffPath}`;
  const oldLines = splitDiffLines(normalizedPrevious);
  const newLines = splitDiffLines(normalizedNext);

  const diffLines = [
    `diff --git ${oldPath} ${newPath}`,
    `--- ${oldPath}`,
    `+++ ${newPath}`,
    buildHunkHeader(oldLines, newLines),
    ...oldLines.map((line) => `-${line}`),
    ...newLines.map((line) => `+${line}`),
  ];

  return diffLines.join('\n');
}
