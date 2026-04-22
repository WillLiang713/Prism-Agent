import { Fragment, memo, type CSSProperties } from 'react';

import { cn } from '../../lib/utils';
import {
  getDiffFileLabel,
  getDiffFileStatus,
  parseRenderedDiffLines,
  parseUnifiedDiff,
  type DiffRowKind,
  type ParsedDiffRow,
} from './codeDiff';

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

function getCodeCellClass(kind: DiffRowKind, side: 'left' | 'right') {
  if (kind === 'removed' && side === 'left') {
    return 'bg-[hsl(var(--diff-remove-bg))] text-[hsl(var(--diff-remove-fg))]';
  }

  if (kind === 'added' && side === 'right') {
    return 'bg-[hsl(var(--diff-add-bg))] text-[hsl(var(--diff-add-fg))]';
  }

  if (kind === 'modified') {
    return side === 'left'
      ? 'bg-[hsl(var(--diff-remove-bg))] text-[hsl(var(--diff-remove-fg))]'
      : 'bg-[hsl(var(--diff-add-bg))] text-[hsl(var(--diff-add-fg))]';
  }

  if (kind === 'removed' || kind === 'added') {
    return 'bg-muted/24 text-mutedForeground/32';
  }

  return 'bg-background/15 text-foreground/88';
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

function getCodeCellStyle(kind: DiffRowKind, side: 'left' | 'right'): CSSProperties | undefined {
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

  return undefined;
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

function renderDiffRowCell(
  row: ParsedDiffRow,
  side: 'left' | 'right',
  key: string,
) {
  const isLeft = side === 'left';
  const lineNumber = isLeft ? row.leftLineNumber : row.rightLineNumber;
  const text = isLeft ? row.leftText : row.rightText;

  return (
    <>
      <td
        key={`${key}-line`}
        className={cn(
          'w-9 px-1 py-px text-right align-top font-mono text-[9.5px] leading-4',
          getLineNumberCellClass(row.kind, side),
        )}
        style={getLineNumberCellStyle(row.kind, side)}
      >
        {lineNumber ?? ''}
      </td>
      <td
        key={`${key}-code`}
        className={cn(
          'px-1.5 py-px align-top font-mono text-[10px] leading-4',
          getCodeCellClass(row.kind, side),
        )}
        style={getCodeCellStyle(row.kind, side)}
      >
        <div className="flex min-w-0 items-start gap-0.5" translate="no">
          <span
            className="w-2 shrink-0 select-none text-center opacity-80"
            style={getMarkerStyle(row.kind, side)}
          >
            {getMarker(row.kind, side)}
          </span>
          <span className="min-w-0 whitespace-pre text-inherit">{text || ' '}</span>
        </div>
      </td>
    </>
  );
}

export const CodeDiffView = memo(function CodeDiffView({ diff }: { diff: string }) {
  const files = parseUnifiedDiff(diff);
  const renderedDiffLines = files.length === 0 ? parseRenderedDiffLines(diff) : [];

  if (files.length === 0 && renderedDiffLines.length === 0) {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-sm border border-border/60 bg-background/35 px-1.5 py-1 text-[10px] leading-4 text-foreground font-mono">
        {diff}
      </pre>
    );
  }

  if (files.length === 0) {
    return (
      <div className="overflow-hidden rounded-sm border border-border/60 bg-background/35">
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
                      className="px-1 py-px text-right align-top font-mono text-[9.5px] leading-4"
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
                      className="px-1.5 py-px align-top font-mono text-[10px] leading-4 text-foreground/86"
                      style={
                        isAdded
                          ? {
                              backgroundColor: 'hsl(var(--diff-add-bg) / 0.92)',
                              color: 'hsl(var(--diff-add-fg))',
                              boxShadow: 'inset 2px 0 0 hsl(var(--diff-add-border))',
                            }
                          : isRemoved
                            ? {
                                backgroundColor: 'hsl(var(--diff-remove-bg) / 0.92)',
                                color: 'hsl(var(--diff-remove-fg))',
                                boxShadow: 'inset 2px 0 0 hsl(var(--diff-remove-border))',
                              }
                            : undefined
                      }
                    >
                      <div className="flex min-w-0 items-start gap-0.5" translate="no">
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
                        <span className="min-w-0 whitespace-pre text-inherit">{line.text || ' '}</span>
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
    <div className="overflow-hidden rounded-sm border border-border/60 bg-background/35">
      {files.map((file, fileIndex) => {
        const status = getDiffFileStatus(file);

        return (
          <section
            key={file.id}
            className={cn(fileIndex > 0 && 'pt-1')}
          >
            <div className="flex items-center justify-between gap-1 bg-muted/18 px-1.5 py-0.5">
              <div
                className="min-w-0 truncate font-mono text-[10px] leading-4 text-foreground/88"
                translate="no"
              >
                {getDiffFileLabel(file)}
              </div>
              <div className="flex shrink-0 items-center gap-0.5 font-mono text-[9px] leading-4">
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
                          className="px-1.5 py-px font-mono text-[9px] leading-4 text-mutedForeground/62"
                          translate="no"
                        >
                          {hunk.header}
                        </td>
                      </tr>
                      {hunk.rows.map((row) => (
                        <tr key={row.id}>
                          {renderDiffRowCell(row, 'left', `${row.id}-left`)}
                          {renderDiffRowCell(row, 'right', `${row.id}-right`)}
                        </tr>
                      ))}
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
