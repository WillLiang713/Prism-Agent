export type DiffRowKind = 'context' | 'modified' | 'added' | 'removed';

export interface ParsedDiffRow {
  id: string;
  kind: DiffRowKind;
  leftLineNumber: number | null;
  rightLineNumber: number | null;
  leftText: string;
  rightText: string;
}

export interface ParsedDiffHunk {
  id: string;
  header: string;
  rows: ParsedDiffRow[];
}

export interface ParsedDiffFile {
  id: string;
  oldPath: string | null;
  newPath: string | null;
  additions: number;
  deletions: number;
  hunks: ParsedDiffHunk[];
}

export interface ParsedRenderedDiffLine {
  id: string;
  kind: 'context' | 'added' | 'removed' | 'ellipsis';
  lineNumber: string;
  text: string;
}

export type DiffChangeSummaryKind = 'added' | 'removed' | 'modified';

export interface DiffChangeSummary {
  id: string;
  kind: DiffChangeSummaryKind;
  lineNumber: number | string | null;
  text: string;
  nextText?: string;
  fileLabel?: string;
}

export interface DiffOverview {
  label: string;
  fullLabel: string;
  fileCount: number;
  additions: number;
  deletions: number;
  changes: DiffChangeSummary[];
  hiddenChangeCount: number;
}

type PendingDiffLine = {
  lineNumber: number;
  text: string;
};

const DIFF_OVERVIEW_CHANGE_LIMIT = 4;

function createParsedDiffFile(index: number): ParsedDiffFile {
  return {
    id: `diff-file-${index}`,
    oldPath: null,
    newPath: null,
    additions: 0,
    deletions: 0,
    hunks: [],
  };
}

function normalizeDiffPath(rawValue: string) {
  const value = rawValue.replace(/^(---|\+\+\+)\s+/, '').split('\t')[0]?.trim() ?? '';
  if (!value || value === '/dev/null') {
    return null;
  }
  return value.replace(/^[ab]\//, '');
}

export function getCompactPathLabel(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '').trim();
  if (!normalized) {
    return 'diff';
  }

  const parts = normalized.split('/').filter(Boolean);
  return parts.at(-1) ?? normalized;
}

function parseHunkHeader(line: string) {
  const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
  if (!match) {
    return null;
  }

  return {
    oldLineNumber: Number(match[1]),
    newLineNumber: Number(match[2]),
  };
}

function pushPendingRows(
  hunk: ParsedDiffHunk | null,
  removedLines: PendingDiffLine[],
  addedLines: PendingDiffLine[],
) {
  if (!hunk || (removedLines.length === 0 && addedLines.length === 0)) {
    removedLines.length = 0;
    addedLines.length = 0;
    return;
  }

  const pairCount = Math.max(removedLines.length, addedLines.length);

  for (let index = 0; index < pairCount; index += 1) {
    const removedLine = removedLines[index];
    const addedLine = addedLines[index];
    const kind: DiffRowKind = removedLine && addedLine ? 'modified' : removedLine ? 'removed' : 'added';

    hunk.rows.push({
      id: `${hunk.id}-row-${hunk.rows.length}`,
      kind,
      leftLineNumber: removedLine?.lineNumber ?? null,
      rightLineNumber: addedLine?.lineNumber ?? null,
      leftText: removedLine?.text ?? '',
      rightText: addedLine?.text ?? '',
    });
  }

  removedLines.length = 0;
  addedLines.length = 0;
}

export function parseUnifiedDiff(diffText: string) {
  const normalized = diffText.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const files: ParsedDiffFile[] = [];
  const lines = normalized.split('\n');

  let currentFile: ParsedDiffFile | null = null;
  let currentHunk: ParsedDiffHunk | null = null;
  let oldLineNumber = 0;
  let newLineNumber = 0;
  const pendingRemoved: PendingDiffLine[] = [];
  const pendingAdded: PendingDiffLine[] = [];

  const ensureFile = () => {
    if (!currentFile) {
      currentFile = createParsedDiffFile(files.length);
    }
    return currentFile;
  };

  const closeCurrentHunk = () => {
    pushPendingRows(currentHunk, pendingRemoved, pendingAdded);
    currentHunk = null;
  };

  const closeCurrentFile = () => {
    closeCurrentHunk();
    if (currentFile && currentFile.hunks.length > 0) {
      files.push(currentFile);
    }
    currentFile = null;
  };

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      closeCurrentFile();
      currentFile = createParsedDiffFile(files.length);

      const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
      if (match) {
        currentFile.oldPath = match[1];
        currentFile.newPath = match[2];
      }
      continue;
    }

    if (line.startsWith('--- ')) {
      ensureFile().oldPath = normalizeDiffPath(line);
      continue;
    }

    if (line.startsWith('+++ ')) {
      ensureFile().newPath = normalizeDiffPath(line);
      continue;
    }

    if (line.startsWith('@@ ')) {
      const parsedHeader = parseHunkHeader(line);
      if (!parsedHeader) {
        continue;
      }

      const file = ensureFile();
      closeCurrentHunk();

      currentHunk = {
        id: `${file.id}-hunk-${file.hunks.length}`,
        header: line,
        rows: [],
      };
      file.hunks.push(currentHunk);
      oldLineNumber = parsedHeader.oldLineNumber;
      newLineNumber = parsedHeader.newLineNumber;
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    if (line === '\\ No newline at end of file') {
      continue;
    }

    if (line.startsWith('-')) {
      pendingRemoved.push({
        lineNumber: oldLineNumber,
        text: line.slice(1),
      });
      ensureFile().deletions += 1;
      oldLineNumber += 1;
      continue;
    }

    if (line.startsWith('+')) {
      pendingAdded.push({
        lineNumber: newLineNumber,
        text: line.slice(1),
      });
      ensureFile().additions += 1;
      newLineNumber += 1;
      continue;
    }

    if (line.startsWith(' ')) {
      pushPendingRows(currentHunk, pendingRemoved, pendingAdded);
      currentHunk.rows.push({
        id: `${currentHunk.id}-row-${currentHunk.rows.length}`,
        kind: 'context',
        leftLineNumber: oldLineNumber,
        rightLineNumber: newLineNumber,
        leftText: line.slice(1),
        rightText: line.slice(1),
      });
      oldLineNumber += 1;
      newLineNumber += 1;
    }
  }

  closeCurrentFile();
  return files;
}

export function getDiffFileLabel(file: ParsedDiffFile) {
  if (file.oldPath && file.newPath && file.oldPath !== file.newPath) {
    return `${file.oldPath} -> ${file.newPath}`;
  }

  if (file.newPath && !file.oldPath) {
    return file.newPath;
  }

  if (file.oldPath && !file.newPath) {
    return file.oldPath;
  }

  return file.newPath ?? file.oldPath ?? 'diff';
}

export function getCompactDiffFileLabel(file: ParsedDiffFile) {
  if (file.oldPath && file.newPath && file.oldPath !== file.newPath) {
    return `${getCompactPathLabel(file.oldPath)} -> ${getCompactPathLabel(file.newPath)}`;
  }

  return getCompactPathLabel(getDiffFileLabel(file));
}

export function getDiffFileStatus(file: ParsedDiffFile) {
  if (file.newPath && !file.oldPath) {
    return 'new file';
  }

  if (file.oldPath && !file.newPath) {
    return 'deleted file';
  }

  if (file.oldPath && file.newPath && file.oldPath !== file.newPath) {
    return 'renamed';
  }

  return null;
}

function getUnifiedDiffTotals(files: ParsedDiffFile[]) {
  return files.reduce(
    (totals, file) => ({
      additions: totals.additions + file.additions,
      deletions: totals.deletions + file.deletions,
    }),
    { additions: 0, deletions: 0 },
  );
}

function createUnifiedDiffChange(
  row: ParsedDiffRow,
  fileLabel: string | undefined,
): DiffChangeSummary | null {
  if (row.kind === 'context') {
    return null;
  }

  if (row.kind === 'added') {
    return {
      id: `${row.id}-summary`,
      kind: 'added',
      lineNumber: row.rightLineNumber,
      text: row.rightText,
      fileLabel,
    };
  }

  if (row.kind === 'removed') {
    return {
      id: `${row.id}-summary`,
      kind: 'removed',
      lineNumber: row.leftLineNumber,
      text: row.leftText,
      fileLabel,
    };
  }

  return {
    id: `${row.id}-summary`,
    kind: 'modified',
    lineNumber: row.leftLineNumber ?? row.rightLineNumber,
    text: row.leftText,
    nextText: row.rightText,
    fileLabel,
  };
}

function getOverviewLabel(files: ParsedDiffFile[], fallbackLabel?: string | null) {
  if (files.length === 0) {
    return fallbackLabel ? getCompactPathLabel(fallbackLabel) : 'diff';
  }

  const firstLabel = getCompactDiffFileLabel(files[0]);
  return files.length === 1 ? firstLabel : `${firstLabel} +${files.length - 1} 文件`;
}

function getOverviewFullLabel(files: ParsedDiffFile[], fallbackFullLabel?: string | null) {
  if (files.length === 0) {
    return fallbackFullLabel || 'diff';
  }

  return files.map(getDiffFileLabel).join(', ');
}

export function buildDiffOverview(
  diffText: string,
  fallbackLabel?: string | null,
  fallbackFullLabel?: string | null,
): DiffOverview | null {
  const files = parseUnifiedDiff(diffText);

  if (files.length > 0) {
    const totals = getUnifiedDiffTotals(files);
    const changes: DiffChangeSummary[] = [];
    let changeCount = 0;

    for (const file of files) {
      const fileLabel = files.length > 1 ? getCompactDiffFileLabel(file) : undefined;
      for (const hunk of file.hunks) {
        for (const row of hunk.rows) {
          const change = createUnifiedDiffChange(row, fileLabel);
          if (!change) {
            continue;
          }

          changeCount += 1;
          if (changes.length < DIFF_OVERVIEW_CHANGE_LIMIT) {
            changes.push(change);
          }
        }
      }
    }

    return {
      label: getOverviewLabel(files, fallbackLabel),
      fullLabel: getOverviewFullLabel(files, fallbackFullLabel),
      fileCount: files.length,
      additions: totals.additions,
      deletions: totals.deletions,
      changes,
      hiddenChangeCount: Math.max(0, changeCount - changes.length),
    };
  }

  const renderedLines = parseRenderedDiffLines(diffText);
  if (renderedLines.length === 0) {
    return null;
  }

  const additions = renderedLines.filter((line) => line.kind === 'added').length;
  const deletions = renderedLines.filter((line) => line.kind === 'removed').length;
  const changedLines = renderedLines.filter(
    (line): line is ParsedRenderedDiffLine & { kind: 'added' | 'removed' } =>
      line.kind === 'added' || line.kind === 'removed',
  );

  return {
    label: fallbackLabel ? getCompactPathLabel(fallbackLabel) : 'diff',
    fullLabel: fallbackFullLabel || fallbackLabel || 'diff',
    fileCount: fallbackLabel ? 1 : 0,
    additions,
    deletions,
    changes: changedLines.slice(0, DIFF_OVERVIEW_CHANGE_LIMIT).map((line) => ({
      id: `${line.id}-summary`,
      kind: line.kind,
      lineNumber: line.lineNumber || null,
      text: line.text,
    })),
    hiddenChangeCount: Math.max(0, changedLines.length - DIFF_OVERVIEW_CHANGE_LIMIT),
  };
}

export function parseRenderedDiffLines(diffText: string): ParsedRenderedDiffLine[] {
  const normalized = diffText.replace(/\r\n/g, '\n').trimEnd();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split('\n');
  const parsed = lines.map<ParsedRenderedDiffLine | null>((line, index) => {
    if (/^\s+\.\.\.\s*$/.test(line)) {
      return {
        id: `rendered-diff-line-${index}`,
        kind: 'ellipsis',
        lineNumber: '',
        text: '...',
      };
    }

    const contextMatch = /^(\d+)\s?(.*)$/.exec(line.trimStart());
    if (contextMatch) {
      return {
        id: `rendered-diff-line-${index}`,
        kind: 'context',
        lineNumber: contextMatch[1],
        text: contextMatch[2] ?? '',
      };
    }

    const match = /^([ +\-])(\s*\d+|\s+)\s?(.*)$/.exec(line);
    if (!match) {
      return null;
    }

    const marker = match[1];
    const rawLineNumber = match[2];
    const text = match[3] ?? '';

    return {
      id: `rendered-diff-line-${index}`,
      kind: marker === '+' ? 'added' : marker === '-' ? 'removed' : 'context',
      lineNumber: rawLineNumber.trim(),
      text,
    };
  });

  if (parsed.some((line) => line === null)) {
    return [];
  }

  return parsed as ParsedRenderedDiffLine[];
}
