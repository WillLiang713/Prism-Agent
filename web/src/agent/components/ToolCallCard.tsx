import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CodeDiffView } from './CodeDiffView';
import { MarkdownContent } from './MarkdownContent';
import type { AgentToolEvent } from '../sessionStore';

type ToolHeaderParts = {
  title: string;
  detail: string | null;
  isMonospace: boolean;
  fullText: string;
};

const TOOL_AUTO_COLLAPSE_DELAY_MS = 2200;

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
        ? `${shortenText(pattern, 20)} in ${shortenText(genericPath, 32)}`
        : shortenText(pattern, 44)
      : genericPath
        ? shortenText(genericPath, 44)
        : null;
    return {
      title: toolName,
      detail,
      isMonospace: true,
      fullText: detail ? `${toolName} ${detail}` : toolName,
    };
  }

  const query = extractFirstStringField(event.args, ['query', 'q', 'name']);
  const detail = genericPath || query;

  return {
    title: toolName,
    detail: detail ? shortenText(detail, 44) : null,
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
  return normalizedToolName === 'grep' || normalizedToolName === 'find' || normalizedToolName === 'ls';
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

function getInlineResultLabel(status: AgentToolEvent['status']) {
  if (status === 'error' || status === 'blocked') {
    return '错误:';
  }
  if (status === 'running') {
    return '进行中:';
  }
  return '结果:';
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

export function ToolCallCard({
  event,
  autoExpandEnabled,
}: {
  event: AgentToolEvent;
  autoExpandEnabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const collapseTimeoutRef = useRef<number | null>(null);
  const hasMountedRef = useRef(false);
  const userInteractedRef = useRef(false);
  const autoManagedRef = useRef(false);
  const previousSnapshotRef = useRef<{
    status: AgentToolEvent['status'];
    ok: AgentToolEvent['ok'];
    output: string;
    diff?: string;
    exitCode?: number | null;
    summary?: string;
  } | null>(null);

  const commandText = useMemo(() => extractCommand(event.args), [event.args]);
  const header = useMemo(() => buildToolHeader(event, commandText), [event, commandText]);
  const compactTitle = useMemo(() => buildCompactTitle(event, commandText), [event, commandText]);
  const toolName = event.name.toLowerCase();
  const isCommandLike = header.isMonospace || toolName.includes('bash');
  const isPlainTextOutput = shouldUsePlainTextOutput(event.name);
  const inlineOutput = isInlineOutput(event.output, event.diff) ? formatInlineOutput(event.output) : null;
  const normalizedSummary = normalizeComparableText(event.summary);
  const summaryRepeatsHeader =
    normalizedSummary.length === 0 ||
    normalizedSummary === normalizeComparableText(header.title) ||
    normalizedSummary === normalizeComparableText(header.fullText) ||
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
    return () => {
      if (collapseTimeoutRef.current !== null) {
        window.clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const previous = previousSnapshotRef.current;
    const previousWasAutoManaged = autoManagedRef.current;
    const isErrorState = event.ok === false || event.status === 'error' || event.status === 'blocked';
    const isSuccessfulDone = event.status === 'done' && event.ok !== false;
    const canAutoManage = hasExpandableContent && autoExpandEnabled && !userInteractedRef.current;
    const shouldOpenOnInitialRunning =
      !hasMountedRef.current && canAutoManage && event.status === 'running';
    const contentChanged =
      previous !== null &&
      (previous.output !== event.output ||
        previous.diff !== event.diff ||
        previous.exitCode !== event.exitCode ||
        previous.summary !== event.summary ||
        previous.ok !== event.ok);
    const statusChanged = previous !== null && previous.status !== event.status;
    const shouldAutoReveal =
      hasMountedRef.current &&
      ((canAutoManage && event.status === 'running' && (statusChanged || contentChanged)) ||
        (hasExpandableContent &&
          !userInteractedRef.current &&
          previousWasAutoManaged &&
          previous?.status === 'running' &&
          event.status === 'done'));

    if (collapseTimeoutRef.current !== null) {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }

    if (isErrorState) {
      setIsOpen(true);
    } else if (shouldOpenOnInitialRunning || shouldAutoReveal) {
      setIsOpen(true);
      if (isSuccessfulDone) {
        collapseTimeoutRef.current = window.setTimeout(() => {
          setIsOpen(false);
        }, TOOL_AUTO_COLLAPSE_DELAY_MS);
      }
    }

    autoManagedRef.current = event.status === 'running' ? canAutoManage : false;

    previousSnapshotRef.current = {
      status: event.status,
      ok: event.ok,
      output: event.output,
      diff: event.diff,
      exitCode: event.exitCode,
      summary: event.summary,
    };
    hasMountedRef.current = true;
  }, [
    event.status,
    event.ok,
    event.output,
    event.diff,
    event.exitCode,
    event.summary,
    hasExpandableContent,
    autoExpandEnabled,
  ]);

  return (
    <details
      className="group min-w-0 text-sm text-mutedForeground"
      open={isOpen}
      onToggle={(event) => setIsOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary
        className="flex w-fit max-w-full list-none items-center gap-1.5 text-mutedForeground/80 hover:text-foreground"
        onClick={(summaryEvent) => {
          if (!hasExpandableContent) {
            summaryEvent.preventDefault();
            return;
          }
          userInteractedRef.current = true;
          if (collapseTimeoutRef.current !== null) {
            window.clearTimeout(collapseTimeoutRef.current);
            collapseTimeoutRef.current = null;
          }
        }}
      >
        <span
          className={`min-w-0 truncate ${hasExpandableContent ? 'cursor-pointer' : 'cursor-default'} ${
            isCommandLike ? 'font-mono text-[13px] leading-5' : 'text-sm'
          }`}
        >
          <span className="shrink-0">{header.title}</span>
          {header.detail ? (
            <span className="ml-1.5 min-w-0 truncate text-mutedForeground/70">
              {header.detail}
            </span>
          ) : null}
        </span>
        {hasExpandableContent ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-mutedForeground/70 opacity-0 transition-all duration-200 group-hover:opacity-85 group-focus-within:opacity-85 group-open:rotate-180 group-open:opacity-100" />
        ) : null}
      </summary>
      {isOpen ? (
        <div className="mt-1.5 min-w-0 space-y-2 pl-0.5">
          {shouldRenderSummaryBody ? (
            <div className="break-words text-xs leading-6 text-foreground/90">
              {event.summary}
            </div>
          ) : null}
          {inlineOutput ? (
            <div className={`min-w-0 text-xs leading-6 ${getInlineResultTone(event.status)}`}>
              <span className="mr-1 text-mutedForeground/65">{getInlineResultLabel(event.status)}</span>
              <span className="break-words">{inlineOutput}</span>
            </div>
          ) : null}
          {!isCommandLike ? (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-xs leading-6 text-mutedForeground font-mono">
              {renderArgs(event.args)}
            </pre>
          ) : null}
          {event.diff ? <CodeDiffView diff={event.diff} /> : null}
          {event.output && !inlineOutput ? (
            isPlainTextOutput ? (
              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-xs leading-6 text-foreground font-mono">
                {formattedOutput}
              </pre>
            ) : (
              <MarkdownContent
                text={formattedOutput}
                className="min-w-0 text-sm leading-6 [&_pre]:rounded-lg [&_pre]:border-border/60 [&_pre]:bg-background/50 [&_pre]:px-3 [&_pre]:py-2.5 [&_pre]:text-xs"
              />
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
