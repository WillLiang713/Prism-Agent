import { Fragment, memo, type CSSProperties } from 'react';

import { cn } from '../../lib/utils';
import {
  getCompactDiffFileLabel,
  getDiffFileLabel,
  getDiffFileStatus,
  parseRenderedDiffLines,
  parseUnifiedDiff,
  type DiffChangeSummary,
  type DiffOverview,
  type DiffRowKind,
  type ParsedDiffRow,
} from './codeDiff';

function DiffStatPills({ additions, deletions }: { additions: number; deletions: number }) {
  if (additions === 0 && deletions === 0) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5 font-mono text-[10px] leading-5">
      {additions > 0 ? (
        <span
          className="rounded-sm border px-1 py-px"
          style={{
            borderColor: 'hsl(var(--diff-add-border) / 0.62)',
            backgroundColor: 'hsl(var(--diff-add-bg) / 0.46)',
            color: 'hsl(var(--diff-add-fg) / 0.94)',
          }}
        >
          +{additions}
        </span>
      ) : null}
      {deletions > 0 ? (
        <span
          className="rounded-sm border px-1 py-px"
          style={{
            borderColor: 'hsl(var(--diff-remove-border) / 0.62)',
            backgroundColor: 'hsl(var(--diff-remove-bg) / 0.46)',
            color: 'hsl(var(--diff-remove-fg) / 0.94)',
          }}
        >
          -{deletions}
        </span>
      ) : null}
    </div>
  );
}

function getFileStatusBadgeStyle(status: string): CSSProperties {
  if (status === 'new file') {
    return {
      borderColor: 'hsl(var(--diff-add-border) / 0.7)',
      backgroundColor: 'hsl(var(--diff-add-bg) / 0.58)',
      color: 'hsl(var(--diff-add-fg) / 0.92)',
    };
  }

  if (status === 'deleted file') {
    return {
      borderColor: 'hsl(var(--diff-remove-border) / 0.7)',
      backgroundColor: 'hsl(var(--diff-remove-bg) / 0.58)',
      color: 'hsl(var(--diff-remove-fg) / 0.92)',
    };
  }

  return {
    borderColor: 'hsl(var(--border) / 0.75)',
    backgroundColor: 'hsl(var(--muted) / 0.4)',
    color: 'hsl(var(--muted-foreground) / 0.9)',
  };
}

function getLineNumberCellClass(kind: DiffRowKind, side: 'left' | 'right') {
  if (kind === 'removed' && side === 'left') {
    return 'bg-[hsl(var(--diff-remove-bg))] text-[hsl(var(--diff-remove-fg)/0.78)]';
  }

  if (kind === 'added' && side === 'right') {
    return 'bg-[hsl(var(--diff-add-bg))] text-[hsl(var(--diff-add-fg)/0.78)]';
  }

  if (kind === 'modified') {
    return side === 'left'
      ? 'bg-[hsl(var(--diff-remove-bg))] text-[hsl(var(--diff-remove-fg)/0.78)]'
      : 'bg-[hsl(var(--diff-add-bg))] text-[hsl(var(--diff-add-fg)/0.78)]';
  }

  return 'bg-background/35 text-mutedForeground/72';
}

function getCodeTextClass(kind: DiffRowKind, side: 'left' | 'right') {
  if (kind === 'removed' && side === 'left') {
    return 'text-[hsl(var(--diff-remove-fg))]';
  }

  if (kind === 'added' && side === 'right') {
    return 'text-[hsl(var(--diff-add-fg))]';
  }

  if (kind === 'modified') {
    return side === 'left' ? 'text-[hsl(var(--diff-remove-fg))]' : 'text-[hsl(var(--diff-add-fg))]';
  }

  if (kind === 'removed' || kind === 'added') {
    return 'text-mutedForeground/32';
  }

  return 'text-foreground/88';
}

function getLineNumberCellStyle(kind: DiffRowKind, side: 'left' | 'right'): CSSProperties | undefined {
  if (kind === 'removed' && side === 'left') {
    return {
      backgroundColor: 'hsl(var(--diff-remove-bg) / 0.78)',
      color: 'hsl(var(--diff-remove-fg) / 0.92)',
    };
  }

  if (kind === 'added' && side === 'right') {
    return {
      backgroundColor: 'hsl(var(--diff-add-bg) / 0.78)',
      color: 'hsl(var(--diff-add-fg) / 0.92)',
    };
  }

  if (kind === 'modified') {
    return side === 'left'
      ? {
          backgroundColor: 'hsl(var(--diff-remove-bg) / 0.8)',
          color: 'hsl(var(--diff-remove-fg) / 0.94)',
        }
      : {
          backgroundColor: 'hsl(var(--diff-add-bg) / 0.8)',
          color: 'hsl(var(--diff-add-fg) / 0.94)',
        };
  }

  return undefined;
}

function getCodeContentStyle(kind: DiffRowKind, side: 'left' | 'right'): CSSProperties | undefined {
  if (kind === 'removed' && side === 'left') {
    return {
      backgroundColor: 'hsl(var(--diff-remove-bg) / 0.92)',
      color: 'hsl(var(--diff-remove-fg))',
      boxShadow: 'inset 2px 0 0 hsl(var(--diff-remove-border))',
    };
  }

  if (kind === 'added' && side === 'right') {
    return {
      backgroundColor: 'hsl(var(--diff-add-bg) / 0.92)',
      color: 'hsl(var(--diff-add-fg))',
      boxShadow: 'inset 2px 0 0 hsl(var(--diff-add-border))',
    };
  }

  if (kind === 'modified') {
    return side === 'left'
      ? {
          backgroundColor: 'hsl(var(--diff-remove-bg) / 0.92)',
          color: 'hsl(var(--diff-remove-fg))',
          boxShadow: 'inset 2px 0 0 hsl(var(--diff-remove-border))',
        }
      : {
          backgroundColor: 'hsl(var(--diff-add-bg) / 0.92)',
          color: 'hsl(var(--diff-add-fg))',
          boxShadow: 'inset 2px 0 0 hsl(var(--diff-add-border))',
        };
  }

  if (kind === 'removed' || kind === 'added') {
    return {
      backgroundColor: 'hsl(var(--muted) / 0.24)',
    };
  }

  return {
    backgroundColor: 'hsl(var(--background) / 0.15)',
  };
}

function getMarkerStyle(kind: DiffRowKind, side: 'left' | 'right'): CSSProperties | undefined {
  if ((kind === 'removed' || kind === 'modified') && side === 'left') {
    return {
      color: 'hsl(var(--diff-remove-fg))',
      fontWeight: 700,
      opacity: 1,
    };
  }

  if ((kind === 'added' || kind === 'modified') && side === 'right') {
    return {
      color: 'hsl(var(--diff-add-fg))',
      fontWeight: 700,
      opacity: 1,
    };
  }

  return undefined;
}

function getMarker(kind: DiffRowKind, side: 'left' | 'right') {
  if ((kind === 'removed' || kind === 'modified') && side === 'left') {
    return '-';
  }

  if ((kind === 'added' || kind === 'modified') && side === 'right') {
    return '+';
  }

  return ' ';
}

function getChangeLabel(change: DiffChangeSummary) {
  if (change.kind === 'added') {
    return '新增';
  }
  if (change.kind === 'removed') {
    return '删除';
  }
  return '修改';
}

function getChangeBadgeStyle(kind: DiffChangeSummary['kind']): CSSProperties {
  if (kind === 'added') {
    return {
      borderColor: 'hsl(var(--diff-add-border) / 0.58)',
      backgroundColor: 'hsl(var(--diff-add-bg) / 0.36)',
      color: 'hsl(var(--diff-add-fg) / 0.94)',
    };
  }

  if (kind === 'removed') {
    return {
      borderColor: 'hsl(var(--diff-remove-border) / 0.58)',
      backgroundColor: 'hsl(var(--diff-remove-bg) / 0.36)',
      color: 'hsl(var(--diff-remove-fg) / 0.94)',
    };
  }

  return {
    borderColor: 'hsl(var(--border) / 0.72)',
    backgroundColor: 'hsl(var(--muted) / 0.36)',
    color: 'hsl(var(--foreground) / 0.84)',
  };
}

function formatChangeLineNumber(lineNumber: DiffChangeSummary['lineNumber']) {
  return lineNumber === null || lineNumber === '' ? '变更' : `第 ${lineNumber} 行`;
}

function formatChangedText(change: DiffChangeSummary) {
  const text = change.text || '空行';
  if (change.kind !== 'modified') {
    return text;
  }

  return `${text} -> ${change.nextText || '空行'}`;
}

function renderOverviewChange(change: DiffChangeSummary) {
  return (
    <div key={change.id} className="flex min-w-0 items-baseline gap-1.5 text-xs leading-5">
      <span
        className="shrink-0 rounded-sm border px-1 py-px text-[10px] leading-4"
        style={getChangeBadgeStyle(change.kind)}
      >
        {getChangeLabel(change)}
      </span>
      <span className="shrink-0 text-mutedForeground/68">
        {formatChangeLineNumber(change.lineNumber)}
      </span>
      {change.fileLabel ? (
        <span className="min-w-0 max-w-28 truncate font-mono text-[11px] text-mutedForeground/64" title={change.fileLabel}>
          {change.fileLabel}
        </span>
      ) : null}
      <span className="min-w-0 truncate font-mono text-[11px] text-foreground/88" translate="no" title={formatChangedText(change)}>
        {formatChangedText(change)}
      </span>
    </div>
  );
}

function getDiffLineNumberProps(
  kind: DiffRowKind,
  side: 'left' | 'right',
  lineNumber: number | null,
) {
  return {
    className: cn(
      'w-9 px-1 py-0.5 text-right align-top font-mono text-[10.5px] leading-5',
      getLineNumberCellClass(kind, side),
    ),
    style: getLineNumberCellStyle(kind, side),
    lineNumber: lineNumber ?? '',
  };
}

function getSplitDividerStyle(side: 'left' | 'right'): CSSProperties | undefined {
  if (side !== 'right') {
    return undefined;
  }

  return {
    boxShadow: 'inset 1px 0 0 hsl(var(--border) / 0.4)',
  };
}

function getSingleSidedRowShellStyle(kind: 'added' | 'removed'): CSSProperties {
  return {
    backgroundColor:
      kind === 'added' ? 'hsl(var(--diff-add-bg) / 0.18)' : 'hsl(var(--diff-remove-bg) / 0.18)',
    boxShadow:
      kind === 'added'
        ? 'inset 0 1px 0 hsl(var(--diff-add-border) / 0.22), inset 0 -1px 0 hsl(var(--diff-add-border) / 0.22)'
        : 'inset 0 1px 0 hsl(var(--diff-remove-border) / 0.22), inset 0 -1px 0 hsl(var(--diff-remove-border) / 0.22)',
  };
}

function renderDiffCodeContent(
  kind: DiffRowKind,
  side: 'left' | 'right',
  text: string,
) {
  return (
    <div
      className="inline-flex min-w-full w-max items-start gap-0.5 px-1.5 py-0.5"
      style={getCodeContentStyle(kind, side)}
      translate="no"
    >
      <span
        className="w-2 shrink-0 select-none text-center opacity-80"
        style={getMarkerStyle(kind, side)}
      >
        {getMarker(kind, side)}
      </span>
      <span className="whitespace-pre text-inherit">{text || ' '}</span>
    </div>
  );
}

function renderDiffRowCell(
  row: ParsedDiffRow,
  side: 'left' | 'right',
  key: string,
) {
  const isLeft = side === 'left';
  const lineNumber = isLeft ? row.leftLineNumber : row.rightLineNumber;
  const text = isLeft ? row.leftText : row.rightText;
  const lineNumberProps = getDiffLineNumberProps(row.kind, side, lineNumber);

  return (
    <>
      <td
        key={`${key}-line`}
        className={lineNumberProps.className}
        style={{
          ...lineNumberProps.style,
          ...getSplitDividerStyle(side),
        }}
      >
        {lineNumberProps.lineNumber}
      </td>
      <td
        key={`${key}-code`}
        className={cn(
          'p-0 align-top font-mono text-xs leading-5',
          getCodeTextClass(row.kind, side),
        )}
      >
        {renderDiffCodeContent(row.kind, side, text)}
      </td>
    </>
  );
}

function renderSingleSidedDiffRow(row: ParsedDiffRow) {
  const kind = row.kind === 'removed' ? 'removed' : 'added';
  const side = kind === 'removed' ? 'left' : 'right';
  const lineNumber = side === 'left' ? row.leftLineNumber : row.rightLineNumber;
  const text = side === 'left' ? row.leftText : row.rightText;
  const lineNumberProps = getDiffLineNumberProps(kind, side, lineNumber);

  return (
    <tr key={row.id}>
      <td colSpan={4} className="p-0 align-top">
        <div className="inline-flex min-w-full w-max" style={getSingleSidedRowShellStyle(kind)}>
          <div className={cn(lineNumberProps.className, 'shrink-0')} style={lineNumberProps.style}>
            {lineNumberProps.lineNumber}
          </div>
          <div
            className={cn(
              'min-w-0 flex-1 p-0 align-top font-mono text-xs leading-5',
              getCodeTextClass(kind, side),
            )}
          >
            {renderDiffCodeContent(kind, side, text)}
          </div>
        </div>
      </td>
    </tr>
  );
}

export function CodeDiffSummary({
  overview,
  className,
}: {
  overview: DiffOverview;
  className?: string;
}) {
  return (
    <div
      className={cn('rounded-sm border border-border/55 bg-background/30 px-2 py-1.5', className)}
      title={overview.fullLabel}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0 truncate font-mono text-[11px] leading-5 text-foreground/84" translate="no">
          {overview.label}
        </div>
        <DiffStatPills additions={overview.additions} deletions={overview.deletions} />
      </div>
      {overview.changes.length > 0 ? (
        <div className="mt-1 space-y-0.5">
          {overview.changes.map(renderOverviewChange)}
          {overview.hiddenChangeCount > 0 ? (
            <div className="text-xs leading-5 text-mutedForeground/62">
              还有 {overview.hiddenChangeCount} 处变更
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const CodeDiffView = memo(function CodeDiffView({
  diff,
  className,
}: {
  diff: string;
  className?: string;
}) {
  const files = parseUnifiedDiff(diff);
  const renderedDiffLines = files.length === 0 ? parseRenderedDiffLines(diff) : [];

  if (files.length === 0 && renderedDiffLines.length === 0) {
    return (
      <pre
        className={cn(
          'overflow-x-auto whitespace-pre-wrap break-all rounded-sm border border-border/60 bg-background/35 px-1.5 py-1.5 text-xs leading-5 text-foreground font-mono',
          className,
        )}
      >
        {diff}
      </pre>
    );
  }

  if (files.length === 0) {
    return (
      <div className={cn('overflow-hidden rounded-sm border border-border/60 bg-background/35', className)}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse table-fixed">
            <colgroup>
              <col className="w-9" />
              <col />
            </colgroup>
            <tbody>
              {renderedDiffLines.map((line) => {
                const isAdded = line.kind === 'added';
                const isRemoved = line.kind === 'removed';
                const isEllipsis = line.kind === 'ellipsis';

                return (
                  <tr key={line.id}>
                    <td
                      className="px-1 py-0.5 text-right align-top font-mono text-[10.5px] leading-5"
                      style={
                        isAdded
                          ? {
                              backgroundColor: 'hsl(var(--diff-add-bg) / 0.78)',
                              color: 'hsl(var(--diff-add-fg) / 0.92)',
                            }
                          : isRemoved
                            ? {
                                backgroundColor: 'hsl(var(--diff-remove-bg) / 0.78)',
                                color: 'hsl(var(--diff-remove-fg) / 0.92)',
                              }
                            : undefined
                      }
                    >
                      {line.lineNumber}
                    </td>
                    <td
                      className={cn(
                        'p-0 align-top font-mono text-xs leading-5',
                        isAdded
                          ? 'text-[hsl(var(--diff-add-fg))]'
                          : isRemoved
                            ? 'text-[hsl(var(--diff-remove-fg))]'
                            : 'text-foreground/86',
                      )}
                    >
                      <div
                        className="inline-flex min-w-full w-max items-start gap-0.5 px-1.5 py-0.5"
                        style={
                          isAdded
                            ? {
                                backgroundColor: 'hsl(var(--diff-add-bg) / 0.92)',
                                boxShadow: 'inset 2px 0 0 hsl(var(--diff-add-border))',
                              }
                            : isRemoved
                              ? {
                                  backgroundColor: 'hsl(var(--diff-remove-bg) / 0.92)',
                                  boxShadow: 'inset 2px 0 0 hsl(var(--diff-remove-border))',
                                }
                              : undefined
                        }
                        translate="no"
                      >
                        <span
                          className="w-2 shrink-0 select-none text-center"
                          style={
                            isAdded
                              ? { color: 'hsl(var(--diff-add-fg))', fontWeight: 700 }
                              : isRemoved
                                ? { color: 'hsl(var(--diff-remove-fg))', fontWeight: 700 }
                                : { opacity: isEllipsis ? 0.5 : 0.72 }
                          }
                        >
                          {isAdded ? '+' : isRemoved ? '-' : ' '}
                        </span>
                        <span className="whitespace-pre text-inherit">{line.text || ' '}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-sm border border-border/60 bg-background/35', className)}>
      {files.map((file, fileIndex) => {
        const status = getDiffFileStatus(file);
        const fullLabel = getDiffFileLabel(file);

        return (
          <section
            key={file.id}
            className={cn(fileIndex > 0 && 'pt-1')}
          >
            <div className="flex items-center justify-between gap-1 bg-muted/18 px-1.5 py-0.5">
              <div
                className="min-w-0 truncate font-mono text-[11px] leading-5 text-foreground/88"
                translate="no"
                title={fullLabel}
              >
                {getCompactDiffFileLabel(file)}
              </div>
              <div className="flex shrink-0 items-center gap-0.5 font-mono text-[10px] leading-5">
                {status ? (
                  <span
                    className="rounded-sm border px-1 py-px"
                    style={getFileStatusBadgeStyle(status)}
                  >
                    {status}
                  </span>
                ) : null}
                <span
                  className="rounded-sm border px-1 py-px"
                  style={{
                    borderColor: 'hsl(var(--diff-add-border) / 0.72)',
                    backgroundColor: 'hsl(var(--diff-add-bg) / 0.72)',
                    color: 'hsl(var(--diff-add-fg))',
                  }}
                >
                  +{file.additions}
                </span>
                <span
                  className="rounded-sm border px-1 py-px"
                  style={{
                    borderColor: 'hsl(var(--diff-remove-border) / 0.72)',
                    backgroundColor: 'hsl(var(--diff-remove-bg) / 0.72)',
                    color: 'hsl(var(--diff-remove-fg))',
                  }}
                >
                  -{file.deletions}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] border-collapse table-fixed">
                <caption className="sr-only">Code diff</caption>
                <colgroup>
                  <col className="w-9" />
                  <col />
                  <col className="w-9" />
                  <col />
                </colgroup>
                <tbody>
                  {file.hunks.map((hunk) => (
                    <Fragment key={hunk.id}>
                      <tr className="bg-muted/12">
                        <td
                          colSpan={4}
                          className="px-1.5 py-0.5 font-mono text-[10px] leading-5 text-mutedForeground/62"
                          translate="no"
                        >
                          {hunk.header}
                        </td>
                      </tr>
                      {hunk.rows.map((row) =>
                        row.kind === 'added' || row.kind === 'removed' ? (
                          renderSingleSidedDiffRow(row)
                        ) : (
                          <tr key={row.id}>
                            {renderDiffRowCell(row, 'left', `${row.id}-left`)}
                            {renderDiffRowCell(row, 'right', `${row.id}-right`)}
                          </tr>
                        ),
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
});
