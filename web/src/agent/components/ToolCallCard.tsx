import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { MarkdownContent } from './MarkdownContent';
import type { AgentToolEvent } from '../sessionStore';

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

export function ToolCallCard({ event }: { event: AgentToolEvent }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (event.ok === false) {
      setIsOpen(true);
    }
  }, [event.ok]);

  const commandText = useMemo(() => extractCommand(event.args), [event.args]);
  const isCommandLike = Boolean(commandText) || event.name.toLowerCase().includes('bash');
  const compactTitle = commandText || event.summary || event.name;

  const formattedOutput = event.diff
    ? `\`\`\`diff\n${event.diff}\n\`\`\`${event.output ? `\n\n${event.output}` : ''}`
    : event.output;

  return (
    <details
      className="group min-w-0 text-sm text-mutedForeground"
      open={isOpen}
      onToggle={(event) => setIsOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex w-fit max-w-full cursor-pointer list-none items-center gap-1.5 text-mutedForeground/80 hover:text-foreground">
        <span className={`truncate ${isCommandLike ? 'font-mono text-xs' : 'text-sm'}`}>{compactTitle}</span>
        <ChevronRight className="h-4 w-4 shrink-0 group-open:rotate-90" />
      </summary>
      {isOpen ? (
        <div className="mt-2 space-y-2 min-w-0">
          {event.summary ? (
            <div className="break-words text-xs leading-6 text-foreground/90">
              {event.summary}
            </div>
          ) : null}
          {!isCommandLike ? (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-xs leading-6 text-mutedForeground font-mono">
              {renderArgs(event.args)}
            </pre>
          ) : null}
          {event.output || event.diff ? (
            <MarkdownContent
              text={formattedOutput}
              className="min-w-0 text-sm leading-6 [&_pre]:rounded-lg [&_pre]:border-border/60 [&_pre]:bg-background/50 [&_pre]:px-3 [&_pre]:py-2.5 [&_pre]:text-xs"
            />
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
