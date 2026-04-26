import { Component, lazy, memo, Suspense, type ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { parseRenderedDiffLines, type ParsedRenderedDiffLine } from './codeDiff';

const DiffsCodeDiffView = lazy(() => import('./DiffsCodeDiffView'));

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
        'overflow-x-auto whitespace-pre-wrap break-all rounded-sm border border-border/60 bg-background/35 px-1.5 py-1.5 font-mono text-xs leading-5 text-foreground',
        className,
      )}
    >
      {diff}
    </pre>
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

  return (
    <DiffRenderErrorBoundary fallback={fallback} resetKey={rendererDiff}>
      <Suspense fallback={fallback}>
        <DiffsCodeDiffView diff={rendererDiff} className={className} fallback={fallback} />
      </Suspense>
    </DiffRenderErrorBoundary>
  );
});
