import { ChevronDown } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { cn } from '../../lib/utils';
import { CodeDiffView } from './CodeDiffView';
import { buildDiffOverview, getCompactPathLabel, type DiffOverview } from './codeDiff';
import { MarkdownContent } from './MarkdownContent';
import type { AgentToolEvent } from '../sessionStore';

type ToolHeaderParts = {
  title: string;
  detail: string | null;
  rawDetail: string | null;
  isMonospace: boolean;
  fullText: string;
};

const PLAIN_TEXT_OUTPUT_TOOLS = new Set(['bash', 'edit', 'find', 'grep', 'ls', 'read', 'write']);
const READ_OUTPUT_PREVIEW_LINES = 10;
const NUMBER_FORMATTER = new Intl.NumberFormat('zh-CN');
const TOOL_OUTPUT_PANEL_CLASS = 'overflow-hidden rounded-sm border border-border/55 bg-background/35';
const TOOL_OUTPUT_PANEL_HEADER_CLASS =
  'flex min-w-0 items-center justify-between gap-2 border-b border-border/45 bg-muted/14 px-2 py-1';
const TOOL_OUTPUT_PRE_CLASS =
  'overflow-auto whitespace-pre-wrap break-words px-2 py-1.5 font-mono text-xs leading-5';

type ReadOutputSummary = {
  normalizedOutput: string;
  previewText: string;
  lineCount: number;
  characterCount: number;
  hiddenLineCount: number;
};

function normalizeArgs(args: unknown) {
  if (typeof args !== 'string') {
    return args;
  }

  try {
    return JSON.parse(args);
  } catch {
    return args;
  }
}

function renderArgs(args: unknown) {
  const normalized = normalizeArgs(args);
  if (typeof normalized === 'string') {
    return normalized;
  }
  return JSON.stringify(normalized, null, 2);
}

function extractCommand(args: unknown) {
  const normalized = normalizeArgs(args);
  if (typeof normalized === 'string') {
    return normalized.trim() || null;
  }

  if (normalized && typeof normalized === 'object') {
    const candidate = normalized as Record<string, unknown>;
    const commandFields = ['command', 'cmd', 'script', 'bash'];
    for (const field of commandFields) {
      if (typeof candidate[field] === 'string' && candidate[field].trim()) {
        return candidate[field].trim();
      }
    }
  }

  return null;
}

function extractPattern(args: unknown) {
  const normalized = normalizeArgs(args);
  if (normalized && typeof normalized === 'object') {
    const candidate = normalized as Record<string, unknown>;
    if (typeof candidate.pattern === 'string' && candidate.pattern.trim()) {
      return candidate.pattern.trim();
    }
  }
  return null;
}

function extractFirstStringField(args: unknown, fields: string[]) {
  const normalized = normalizeArgs(args);
  if (!normalized || typeof normalized !== 'object') {
    return null;
  }

  const candidate = normalized as Record<string, unknown>;
  for (const field of fields) {
    const value = candidate[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (Array.isArray(value)) {
      const strings = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      if (strings.length > 0) {
        return strings.length > 1 ? `${strings[0].trim()} +${strings.length - 1}` : strings[0].trim();
      }
    }
  }

  return null;
}

function shortenText(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function formatPathLikeDetail(value: string | null) {
  if (!value) {
    return null;
  }

  const countSuffixMatch = /^(.*?)( \+\d+)$/.exec(value);
  if (countSuffixMatch) {
    return `${getCompactPathLabel(countSuffixMatch[1])}${countSuffixMatch[2]}`;
  }

  return getCompactPathLabel(value);
}

function normalizeComparableText(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function tokenizeCommand(command: string) {
  return command.match(/"[^"]*"|'[^']*'|[^\s]+/g)?.map((token) => token.replace(/^['"]|['"]$/g, '')) ?? [];
}

function extractCommandHeader(commandText: string): ToolHeaderParts {
  const tokens = tokenizeCommand(commandText);
  if (tokens.length === 0) {
    return {
      title: 'bash',
      detail: null,
      rawDetail: null,
      isMonospace: true,
      fullText: 'bash',
    };
  }

  const [commandName, ...rest] = tokens;
  const normalizedName = commandName.toLowerCase();
  const positionalArgs = rest.filter((token) => token && !token.startsWith('-') && !['|', '&&', ';'].includes(token));

  let detail: string | null = null;
  if (normalizedName === 'rg' || normalizedName === 'grep' || normalizedName === 'select-string') {
    const [pattern, target] = positionalArgs;
    if (pattern && target) {
      detail = `${shortenText(pattern, 20)} in ${shortenText(target, 32)}`;
    } else if (pattern) {
      detail = shortenText(pattern, 44);
    }
  } else if (
    normalizedName === 'ls' ||
    normalizedName === 'dir' ||
    normalizedName === 'get-childitem' ||
    normalizedName === 'cat' ||
    normalizedName === 'type' ||
    normalizedName === 'head' ||
    normalizedName === 'tail'
  ) {
    detail = positionalArgs[0] ? shortenText(positionalArgs[0], 44) : null;
  } else if (normalizedName === 'git') {
    detail = rest.length > 0 ? shortenText(rest.join(' '), 44) : null;
  } else {
    detail = rest.length > 0 ? shortenText(rest.join(' '), 44) : null;
  }

  const fullText = detail ? `${commandName} ${detail}` : commandName;
  return {
    title: commandName,
    detail,
    rawDetail: detail,
    isMonospace: true,
    fullText,
  };
}

function buildToolHeader(event: AgentToolEvent, commandText: string | null): ToolHeaderParts {
  if (commandText) {
    return extractCommandHeader(commandText);
  }

  const toolName = event.name.trim() || 'tool';
  const normalizedToolName = toolName.toLowerCase();
  const genericPath = extractFirstStringField(event.args, [
    'path',
    'paths',
    'dir',
    'directory',
    'cwd',
    'target',
    'targets',
    'file',
    'files',
    'uri',
  ]);

  if (normalizedToolName === 'grep' || normalizedToolName === 'find') {
    const pattern = extractPattern(event.args);
    const detail = pattern
      ? genericPath
        ? `${shortenText(pattern, 20)} in ${shortenText(formatPathLikeDetail(genericPath) ?? genericPath, 32)}`
        : shortenText(pattern, 44)
      : genericPath
        ? shortenText(formatPathLikeDetail(genericPath) ?? genericPath, 44)
        : null;
    const rawDetail = pattern
      ? genericPath
        ? `${pattern} in ${genericPath}`
        : pattern
      : genericPath;
    return {
      title: toolName,
      detail,
      rawDetail,
      isMonospace: true,
      fullText: detail ? `${toolName} ${detail}` : toolName,
    };
  }

  const query = extractFirstStringField(event.args, ['query', 'q', 'name']);
  const rawDetail = genericPath || query;
  const detail = genericPath ? formatPathLikeDetail(genericPath) : query;

  return {
    title: toolName,
    detail: detail ? shortenText(detail, 44) : null,
    rawDetail,
    isMonospace: ['ls', 'read', 'write', 'edit', 'bash'].includes(normalizedToolName),
    fullText: detail ? `${toolName} ${shortenText(detail, 44)}` : toolName,
  };
}

function buildCompactTitle(event: AgentToolEvent, commandText: string | null) {
  const header = buildToolHeader(event, commandText);
  if (header.fullText.trim()) {
    return header.fullText;
  }

  if (event.summary?.trim()) {
    return event.summary.trim();
  }

  return event.name;
}

function shouldUsePlainTextOutput(toolName: string) {
  const normalizedToolName = toolName.toLowerCase();
  return PLAIN_TEXT_OUTPUT_TOOLS.has(normalizedToolName);
}

function normalizeOutputText(output: string) {
  return output.replace(/\r\n/g, '\n').trim();
}

function isInlineOutput(output: string, diff?: string) {
  if (diff) {
    return false;
  }

  const normalized = normalizeOutputText(output);
  if (!normalized) {
    return false;
  }

  const lines = normalized.split('\n');
  return lines.length <= 2 && normalized.length <= 160;
}

function formatInlineOutput(output: string) {
  return normalizeOutputText(output).split('\n').join('  ');
}

function summarizeReadOutput(output: string): ReadOutputSummary {
  const normalizedOutput = output.replace(/\r\n/g, '\n').trimEnd();
  const lines = normalizedOutput ? normalizedOutput.split('\n') : [];
  const previewLines = lines.slice(0, READ_OUTPUT_PREVIEW_LINES);

  return {
    normalizedOutput,
    previewText: previewLines.join('\n'),
    lineCount: lines.length,
    characterCount: normalizedOutput.length,
    hiddenLineCount: Math.max(0, lines.length - previewLines.length),
  };
}

function getInlineResultLabel(status: AgentToolEvent['status']) {
  if (status === 'error' || status === 'blocked') {
    return '错误:';
  }
  if (status === 'running') {
    return '进行中:';
  }
  return null;
}

function getInlineResultTone(status: AgentToolEvent['status']) {
  if (status === 'error' || status === 'blocked') {
    return 'text-danger/90';
  }
  if (status === 'running') {
    return 'text-warm/90';
  }
  return 'text-foreground/88';
}

function ToolDiffStats({ overview }: { overview: DiffOverview }) {
  if (overview.additions === 0 && overview.deletions === 0) {
    return null;
  }

  return (
    <span className="ml-0.5 inline-flex shrink-0 items-center gap-0.5 font-mono text-[11px] leading-5">
      {overview.additions > 0 ? (
        <span className="text-[hsl(var(--diff-add-fg)/0.9)]">+{overview.additions}</span>
      ) : null}
      {overview.deletions > 0 ? (
        <span className="text-[hsl(var(--diff-remove-fg)/0.9)]">-{overview.deletions}</span>
      ) : null}
    </span>
  );
}

function ToolOutputPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(TOOL_OUTPUT_PANEL_CLASS, className)}>
      {children}
    </div>
  );
}

function InlineOutputBlock({
  output,
  label,
  status,
}: {
  output: string;
  label: string | null;
  status: AgentToolEvent['status'];
}) {
  return (
    <ToolOutputPanel className="px-2 py-1.5">
      <div className={cn('min-w-0 text-xs leading-5', getInlineResultTone(status))}>
        {label ? (
          <span className="mr-1 text-mutedForeground/65">{label}</span>
        ) : null}
        <span className="break-words">{output}</span>
      </div>
    </ToolOutputPanel>
  );
}

function PlainTextOutputBlock({
  text,
  tone = 'text-foreground/90',
}: {
  text: string;
  tone?: string;
}) {
  return (
    <ToolOutputPanel>
      <pre
        className={cn(TOOL_OUTPUT_PRE_CLASS, 'max-h-[min(48vh,460px)]', tone)}
        translate="no"
      >
        {text}
      </pre>
    </ToolOutputPanel>
  );
}

function ReadOutputPreview({
  output,
  label,
  fullLabel,
}: {
  output: string;
  label: string | null;
  fullLabel?: string;
}) {
  const [isFullOpen, setIsFullOpen] = useState(false);
  const summary = useMemo(() => summarizeReadOutput(output), [output]);
  const title = fullLabel || label || '读取内容';
  const canExpand = summary.hiddenLineCount > 0;

  return (
    <ToolOutputPanel>
      <div className={TOOL_OUTPUT_PANEL_HEADER_CLASS}>
        <span className="min-w-0 truncate font-mono text-[11px] leading-5 text-foreground/84" title={title} translate="no">
          {label || '读取内容'}
        </span>
        <span className="shrink-0 text-[11px] leading-5 text-mutedForeground/68">
          {NUMBER_FORMATTER.format(summary.lineCount)} 行
          <span className="mx-1 text-mutedForeground/38">/</span>
          {NUMBER_FORMATTER.format(summary.characterCount)} 字符
        </span>
      </div>
      {!isFullOpen ? (
        <pre
          className={cn(TOOL_OUTPUT_PRE_CLASS, 'whitespace-pre text-foreground/90')}
          translate="no"
        >
          {summary.previewText || '空文件'}
        </pre>
      ) : null}
      {canExpand ? (
        <div className="border-t border-border/45 px-2 py-1">
          <button
            type="button"
            aria-expanded={isFullOpen}
            onClick={() => setIsFullOpen((current) => !current)}
            className="inline-flex max-w-full touch-manipulation items-center gap-1.5 rounded-sm text-xs leading-5 text-mutedForeground/72 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/20"
          >
            <span>
              {isFullOpen
                ? '收起完整内容'
                : `查看完整内容，剩余 ${NUMBER_FORMATTER.format(summary.hiddenLineCount)} 行`}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isFullOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      ) : null}
      {isFullOpen ? (
        <pre
          className="max-h-[min(56vh,520px)] overflow-auto border-t border-border/45 bg-background/28 px-2 py-1.5 font-mono text-xs leading-5 text-foreground/90"
          translate="no"
        >
          {summary.normalizedOutput}
        </pre>
      ) : null}
    </ToolOutputPanel>
  );
}

export function ToolCallCard({
  event,
}: {
  event: AgentToolEvent;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const commandText = useMemo(() => extractCommand(event.args), [event.args]);
  const header = useMemo(() => buildToolHeader(event, commandText), [event, commandText]);
  const diffOverview = useMemo(
    () => (event.diff ? buildDiffOverview(event.diff, header.detail, header.rawDetail ?? header.detail) : null),
    [event.diff, header.detail, header.rawDetail],
  );
  const compactTitle = useMemo(() => buildCompactTitle(event, commandText), [event, commandText]);
  const displayDetail = diffOverview?.label ?? header.detail;
  const displayDetailTitle = diffOverview?.fullLabel ?? header.rawDetail ?? header.detail ?? undefined;
  const toolName = event.name.toLowerCase();
  const isCommandLike = header.isMonospace || toolName.includes('bash');
  const isPlainTextOutput = shouldUsePlainTextOutput(event.name);
  const inlineOutput = isInlineOutput(event.output, event.diff) ? formatInlineOutput(event.output) : null;
  const inlineResultLabel = getInlineResultLabel(event.status);
  const shouldRenderReadOutputPreview =
    toolName === 'read' &&
    event.ok !== false &&
    event.status !== 'error' &&
    event.status !== 'blocked';
  const shouldSuppressRedundantDiffOutput =
    Boolean(event.diff && isPlainTextOutput && event.status === 'done' && event.ok !== false);
  const shouldRenderOutput = Boolean(event.output && !inlineOutput && !shouldSuppressRedundantDiffOutput);
  const shouldRenderPlainOutputWithDiff = Boolean(event.diff && shouldRenderOutput && isPlainTextOutput);
  const isRunning = event.status === 'running';
  const normalizedSummary = normalizeComparableText(event.summary);
  const summaryRepeatsHeader =
    normalizedSummary.length === 0 ||
    normalizedSummary === normalizeComparableText(header.title) ||
    normalizedSummary === normalizeComparableText(header.fullText) ||
    normalizedSummary === normalizeComparableText(header.rawDetail) ||
    normalizedSummary === normalizeComparableText(header.rawDetail ? `${header.title} ${header.rawDetail}` : null) ||
    normalizedSummary === normalizeComparableText(displayDetail) ||
    normalizedSummary === normalizeComparableText(diffOverview?.fullLabel) ||
    normalizedSummary === normalizeComparableText(compactTitle) ||
    (header.detail !== null && normalizedSummary === normalizeComparableText(header.detail));
  const shouldRenderSummaryBody =
    typeof event.summary === 'string' &&
    event.summary.trim().length > 0 &&
    !summaryRepeatsHeader;
  const hasExpandableContent =
    shouldRenderSummaryBody ||
    Boolean(inlineOutput) ||
    !isCommandLike ||
    Boolean(event.output) ||
    Boolean(event.diff) ||
    typeof event.exitCode === 'number';

  const formattedOutput = event.output;

  useEffect(() => {
    const isErrorState = event.ok === false || event.status === 'error' || event.status === 'blocked';
    if (isErrorState && hasExpandableContent) {
      setIsOpen(true);
    }
  }, [event.ok, event.status, hasExpandableContent]);

  return (
    <details
      className="group min-w-0 text-sm text-mutedForeground"
      open={isOpen}
      onToggle={(event) => setIsOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary
        className="flex w-fit max-w-full list-none items-center gap-1.5 rounded-sm text-mutedForeground/80 hover:text-foreground focus-visible:outline-none focus-visible:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/20"
        aria-label={isRunning ? `正在调用工具 ${compactTitle}` : compactTitle}
        onClick={(summaryEvent) => {
          if (!hasExpandableContent) {
            summaryEvent.preventDefault();
            return;
          }
        }}
      >
        <span
          className={`min-w-0 truncate ${hasExpandableContent ? 'cursor-pointer' : 'cursor-default'} ${
            isCommandLike ? 'font-mono text-[13px] leading-5' : 'text-sm'
          }`}
        >
          {isRunning ? (
            <span
              role="status"
              aria-live="polite"
              className="thinking-title-shimmer mr-1.5 shrink-0 text-[11px] leading-5 text-mutedForeground/62"
              data-shimmer-text="正在调用"
            >
              正在调用
            </span>
          ) : null}
          <span className="shrink-0">{header.title}</span>
          {displayDetail ? (
            <span className="ml-1.5 min-w-0 truncate text-mutedForeground/70" title={displayDetailTitle}>
              {displayDetail}
            </span>
          ) : null}
          {diffOverview ? <ToolDiffStats overview={diffOverview} /> : null}
        </span>
        {hasExpandableContent ? (
          <ChevronDown
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-mutedForeground/70 opacity-0 transition-[opacity,transform] duration-200 group-hover:opacity-85 group-focus-within:opacity-85 group-open:rotate-180 group-open:opacity-100"
          />
        ) : null}
      </summary>
      {isOpen ? (
        <div className="mt-1.5 min-w-0 space-y-2 pl-0.5">
          {shouldRenderSummaryBody ? (
            <ToolOutputPanel className="px-2 py-1.5">
              <div className="break-words text-xs leading-5 text-foreground/90">
              {event.summary}
              </div>
            </ToolOutputPanel>
          ) : null}
          {inlineOutput ? (
            <InlineOutputBlock
              output={inlineOutput}
              label={inlineResultLabel}
              status={event.status}
            />
          ) : null}
          {!isCommandLike ? (
            <PlainTextOutputBlock text={renderArgs(event.args)} tone="text-mutedForeground" />
          ) : null}
          {event.diff ? (
            <div className="min-w-0 space-y-1.5">
              <CodeDiffView diff={event.diff} fileLabel={displayDetailTitle ?? displayDetail ?? undefined} />
              {shouldRenderPlainOutputWithDiff ? (
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-sm border border-border/60 bg-background/32 px-3 py-2 text-xs leading-6 text-foreground/88 font-mono">
                  {formattedOutput}
                </pre>
              ) : null}
            </div>
          ) : null}
          {shouldRenderOutput && !shouldRenderPlainOutputWithDiff ? (
            shouldRenderReadOutputPreview ? (
              <ReadOutputPreview
                output={formattedOutput}
                label={displayDetail}
                fullLabel={displayDetailTitle}
              />
            ) : isPlainTextOutput ? (
              <PlainTextOutputBlock text={formattedOutput} />
            ) : (
              <ToolOutputPanel className="px-2 py-1.5">
                <MarkdownContent
                  text={formattedOutput}
                  className="min-w-0 text-sm leading-6 [&_pre]:rounded-sm [&_pre]:border-border/60 [&_pre]:bg-background/50 [&_pre]:px-2 [&_pre]:py-1.5 [&_pre]:text-xs"
                />
              </ToolOutputPanel>
            )
          ) : null}
          {typeof event.exitCode === 'number' ? (
            <div className="text-xs font-mono text-mutedForeground">
              exit code: {event.exitCode}
            </div>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
