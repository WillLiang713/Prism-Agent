import { Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

import type { AgentToolEvent } from '../sessionStore';

function renderArgs(args: unknown) {
  if (typeof args !== 'string') {
    return JSON.stringify(args, null, 2);
  }
  try {
    const parsed = JSON.parse(args);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return args;
  }
}

export function ToolCallCard({ event }: { event: AgentToolEvent }) {
  const formattedOutput = event.diff
    ? `\`\`\`diff\n${event.diff}\n\`\`\`${event.output ? `\n\n${event.output}` : ''}`
    : event.output;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-mutedForeground w-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 font-mono">
        <div className="flex min-w-0 items-center gap-2 text-foreground font-medium">
          <Terminal className="h-4 w-4" />
          <span className="truncate">{event.name}</span>
          {event.skillName ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] normal-case text-mutedForeground">
              {event.skillName}
            </span>
          ) : null}
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide">
          {event.status}
        </span>
      </div>
      <div className="mt-2 space-y-2 min-w-0">
        {event.summary ? (
          <div className="break-words rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-xs text-foreground">
            {event.summary}
          </div>
        ) : null}
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-background/50 px-4 py-4 text-xs leading-6 text-mutedForeground w-full min-w-0 font-mono">
          {renderArgs(event.args)}
        </pre>
        {event.output || event.diff ? (
          <div className="prose prose-sm prose-neutral max-w-none dark:prose-invert [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:bg-background/80 [&_pre]:px-4 [&_pre]:py-4 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-all break-words min-w-0">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{formattedOutput}</ReactMarkdown>
          </div>
        ) : null}
        {typeof event.exitCode === 'number' ? (
          <div className="text-xs font-mono text-mutedForeground">
            exit code: {event.exitCode}
          </div>
        ) : null}
      </div>
    </div>
  );
}
