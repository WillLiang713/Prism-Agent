import { Component, lazy, memo, Suspense, type ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { parseRenderedDiffLines, type ParsedRenderedDiffLine } from './codeDiff';

const DiffsCodeDiffView = lazy(() => import('./DiffsCodeDiffView'));

const DIFF_LOADING_ROWS = [
  { tone: 'bg-[hsl(var(--diff-remove-bg)/0.38)]', width: 'w-[74%]' },
  { tone: 'bg-muted/45', width: 'w-[82%]' },
  { tone: 'bg-[hsl(var(--diff-add-bg)/0.38)]', width: 'w-[68%]' },
  { tone: 'bg-muted/38', width: 'w-[88%]' },
  { tone: 'bg-[hsl(var(--diff-add-bg)/0.34)]', width: 'w-[58%]' },
] as const;

class DiffRenderErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetKey: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Failed to render diff with @pierre/diffs.', error);
  }

  componentDidUpdate(previousProps: { resetKey: string }) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return <>{this.props.fallback}</>;
    }

    return this.props.children;
  }
}

function PlainDiffFallback({
  diff,
  className,
}: {
  diff: string;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        'overflow-x-auto whitespace-pre-wrap break-all rounded-sm border border-border/60 bg-background/35 px-1.5 py-1.5 font-mono text-[13px] leading-5 text-foreground',
        className,
      )}
    >
      {diff}
    </pre>
  );
}

function CodeDiffLoadingFallback({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading diff"
      className={cn(
        'max-h-[min(46vh,360px)] max-w-[min(100%,820px)] overflow-hidden rounded-sm border border-border/70 bg-card/85',
        className,
      )}
    >
      <div className="flex h-9 min-w-0 items-center gap-2 border-b border-border/55 bg-muted/34 px-2">
        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 animate-pulse rounded-[3px] bg-mutedForeground/20 motion-reduce:animate-none"
        />
        <span
          aria-hidden="true"
          className="h-2.5 w-36 max-w-[42%] animate-pulse rounded-sm bg-mutedForeground/18 motion-reduce:animate-none"
        />
        <span
          aria-hidden="true"
          className="ml-auto h-2.5 w-14 shrink-0 animate-pulse rounded-sm bg-mutedForeground/14 motion-reduce:animate-none"
        />
      </div>
      <div className="space-y-px p-1.5">
        {DIFF_LOADING_ROWS.map((row, index) => (
          <div
            key={`${row.width}-${index}`}
            aria-hidden="true"
            className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2 rounded-[2px] px-1.5 py-1"
          >
            <span className="h-2.5 w-8 rounded-sm bg-mutedForeground/12" />
            <span
              className={cn(
                'h-2.5 animate-pulse rounded-sm motion-reduce:animate-none',
                row.tone,
                row.width,
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function sanitizeRenderedDiffFileLabel(fileLabel?: string) {
  const normalized = fileLabel?.replace(/\r\n/g, '\n').split('\n')[0]?.trim();
  return normalized || 'diff';
}

function getRenderedLineNumber(line: ParsedRenderedDiffLine) {
  const value = Number.parseInt(line.lineNumber, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatUnifiedHunkHeader(
  startLineNumber: number,
  oldLineCount: number,
  newLineCount: number,
) {
  return `@@ -${startLineNumber},${oldLineCount} +${startLineNumber},${newLineCount} @@`;
}

function createRenderedDiffPatch(lines: ParsedRenderedDiffLine[], fileLabel?: string) {
  const hunks: string[] = [];
  let currentHunkLines: string[] = [];
  let currentStartLineNumber: number | null = null;
  let currentOldLineCount = 0;
  let currentNewLineCount = 0;

  const closeCurrentHunk = () => {
    if (currentHunkLines.length === 0 || currentStartLineNumber === null) {
      currentHunkLines = [];
      currentStartLineNumber = null;
      currentOldLineCount = 0;
      currentNewLineCount = 0;
      return;
    }

    hunks.push(
      [
        formatUnifiedHunkHeader(currentStartLineNumber, currentOldLineCount, currentNewLineCount),
        ...currentHunkLines,
      ].join('\n'),
    );
    currentHunkLines = [];
    currentStartLineNumber = null;
    currentOldLineCount = 0;
    currentNewLineCount = 0;
  };

  for (const line of lines) {
    if (line.kind === 'ellipsis') {
      closeCurrentHunk();
      continue;
    }

    const lineNumber = getRenderedLineNumber(line);
    if (currentStartLineNumber === null && lineNumber !== null) {
      currentStartLineNumber = lineNumber;
    }

    if (line.kind === 'added') {
      currentNewLineCount += 1;
      currentHunkLines.push(`+${line.text}`);
      continue;
    }

    if (line.kind === 'removed') {
      currentOldLineCount += 1;
      currentHunkLines.push(`-${line.text}`);
      continue;
    }

    currentOldLineCount += 1;
    currentNewLineCount += 1;
    currentHunkLines.push(` ${line.text}`);
  }

  closeCurrentHunk();

  if (hunks.length === 0) {
    return null;
  }

  const path = sanitizeRenderedDiffFileLabel(fileLabel);
  return [`--- a/${path}`, `+++ b/${path}`, ...hunks].join('\n');
}

function getRendererDiff(diff: string, fileLabel?: string) {
  const renderedDiffLines = parseRenderedDiffLines(diff);
  if (renderedDiffLines.length === 0) {
    return diff;
  }

  return createRenderedDiffPatch(renderedDiffLines, fileLabel) ?? diff;
}

export const CodeDiffView = memo(function CodeDiffView({
  diff,
  className,
  fileLabel,
}: {
  diff: string;
  className?: string;
  fileLabel?: string;
}) {
  const rendererDiff = getRendererDiff(diff, fileLabel);
  const fallback = <PlainDiffFallback diff={diff} className={className} />;
  const loadingFallback = <CodeDiffLoadingFallback className={className} />;

  return (
    <DiffRenderErrorBoundary fallback={fallback} resetKey={rendererDiff}>
      <Suspense fallback={loadingFallback}>
        <DiffsCodeDiffView diff={rendererDiff} className={className} fallback={fallback} />
      </Suspense>
    </DiffRenderErrorBoundary>
  );
});
