import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { FileDiff, type FileDiffMetadata, type FileDiffProps } from '@pierre/diffs/react';
import { parsePatchFiles } from '@pierre/diffs';

import { cn } from '../../lib/utils';

type AppThemeType = 'light' | 'dark';
type DiffsHostStyle = CSSProperties & Record<`--${string}`, string>;

const DIFFS_UNSAFE_CSS = `
:host {
  overflow: hidden;
  border-radius: inherit;
}

[data-diffs-header='default'] {
  border-bottom: 1px solid hsl(var(--border) / 0.55);
  background: hsl(var(--muted) / 0.34);
  box-shadow: none;
}

[data-diffs-header='default'] svg {
  width: 12px;
  height: 12px;
}

[data-header-content] {
  min-width: 0;
}

[data-header-content] [data-title],
[data-header-content] [data-prev-name] {
  font-size: 11.5px;
  font-weight: 650;
}

[data-diffs-header='default'] [data-metadata] {
  font-size: 10.5px;
  gap: 0.55ch;
}

[data-diffs-header='default'] [data-additions-count],
[data-diffs-header='default'] [data-deletions-count] {
  font-weight: 650;
}

[data-diff-type='split'] {
  min-width: 560px;
}

[data-line],
[data-column-number],
[data-no-newline] {
  padding-block: 0;
}

[data-code] {
  scrollbar-gutter: stable;
}

[data-column-number] {
  font-variant-numeric: tabular-nums;
}

[data-diff-span] {
  box-shadow: none;
}

[data-gutter-buffer='buffer'],
[data-content-buffer] {
  opacity: 0.72;
}
`;

const DIFFS_HOST_STYLE: DiffsHostStyle = {
  '--diffs-light-bg': 'hsl(var(--card))',
  '--diffs-dark-bg': 'hsl(var(--card))',
  '--diffs-light': 'hsl(var(--foreground))',
  '--diffs-dark': 'hsl(var(--foreground))',
  '--diffs-font-family': 'var(--font-mono)',
  '--diffs-header-font-family': 'var(--font-body)',
  '--diffs-font-size': '11.5px',
  '--diffs-line-height': '18px',
  '--diffs-font-features': '"tnum" 1, "liga" 0, "calt" 0',
  '--diffs-gap-inline': '6px',
  '--diffs-gap-block': '5px',
  '--diffs-tab-size': '2',
  '--diffs-fg-number-override': 'hsl(var(--muted-foreground) / 0.78)',
  '--diffs-addition-color-override': 'hsl(var(--diff-add-fg))',
  '--diffs-deletion-color-override': 'hsl(var(--diff-remove-fg))',
  '--diffs-modified-color-override': 'hsl(var(--muted-foreground))',
  '--diffs-bg-addition-override': 'hsl(var(--diff-add-bg) / 0.46)',
  '--diffs-bg-addition-number-override': 'hsl(var(--diff-add-bg) / 0.58)',
  '--diffs-bg-addition-hover-override': 'hsl(var(--diff-add-bg) / 0.62)',
  '--diffs-bg-addition-emphasis-override': 'hsl(var(--diff-add-bg) / 0.7)',
  '--diffs-bg-deletion-override': 'hsl(var(--diff-remove-bg) / 0.46)',
  '--diffs-bg-deletion-number-override': 'hsl(var(--diff-remove-bg) / 0.58)',
  '--diffs-bg-deletion-hover-override': 'hsl(var(--diff-remove-bg) / 0.62)',
  '--diffs-bg-deletion-emphasis-override': 'hsl(var(--diff-remove-bg) / 0.7)',
  '--diffs-bg-hover-override': 'hsl(var(--muted) / 0.46)',
  '--diffs-bg-separator-override': 'hsl(var(--muted) / 0.5)',
};

const DIFFS_BASE_OPTIONS = {
  theme: {
    dark: 'pierre-dark',
    light: 'pierre-light',
  },
  diffStyle: 'split',
  diffIndicators: 'bars',
  hunkSeparators: 'line-info',
  lineDiffType: 'word-alt',
  overflow: 'scroll',
  tokenizeMaxLineLength: 1200,
  unsafeCSS: DIFFS_UNSAFE_CSS,
} satisfies NonNullable<FileDiffProps<undefined>['options']>;

const DIFFS_METRICS = {
  hunkLineCount: 42,
  lineHeight: 18,
  diffHeaderHeight: 36,
  hunkSeparatorHeight: 26,
  fileGap: 6,
} satisfies NonNullable<FileDiffProps<undefined>['metrics']>;

function getAppThemeType(): AppThemeType {
  if (typeof document === 'undefined') {
    return 'light';
  }

  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function useAppThemeType() {
  const [themeType, setThemeType] = useState<AppThemeType>(() => getAppThemeType());

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return;
    }

    const syncTheme = () => setThemeType(getAppThemeType());
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return themeType;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function parseDiffFiles(diff: string): FileDiffMetadata[] | null {
  try {
    const cacheKeyPrefix = `agent-diff-${hashText(diff)}`;
    return parsePatchFiles(diff, cacheKeyPrefix, true).flatMap((patch) => patch.files);
  } catch (error) {
    console.warn('Failed to render diff with @pierre/diffs.', error);
    return null;
  }
}

function getFileKey(file: FileDiffMetadata, index: number) {
  return file.cacheKey ?? `${index}:${file.prevName ?? ''}->${file.name}:${file.splitLineCount}`;
}

export interface DiffsCodeDiffViewProps {
  diff: string;
  className?: string;
  fallback: ReactNode;
}

const DiffsCodeDiffView = memo(function DiffsCodeDiffView({
  diff,
  className,
  fallback,
}: DiffsCodeDiffViewProps) {
  const themeType = useAppThemeType();
  const files = useMemo(() => parseDiffFiles(diff), [diff]);
  const options = useMemo(
    () => ({
      ...DIFFS_BASE_OPTIONS,
      themeType,
    }),
    [themeType],
  );

  if (!files || files.length === 0) {
    return <>{fallback}</>;
  }

  return (
    <div
      className={cn(
        'max-h-[min(46vh,360px)] max-w-[min(100%,820px)] overflow-auto rounded-sm border border-border/70 bg-card/85',
        className,
      )}
    >
      {files.map((file, index) => (
        <FileDiff
          key={getFileKey(file, index)}
          fileDiff={file}
          options={options}
          metrics={DIFFS_METRICS}
          style={DIFFS_HOST_STYLE}
          className={cn('block min-w-0', index > 0 && 'border-t border-border/55')}
          disableWorkerPool
        />
      ))}
    </div>
  );
});

export default DiffsCodeDiffView;
