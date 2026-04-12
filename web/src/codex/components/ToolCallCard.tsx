import { Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

import type { CodexToolEvent } from '../sessionStore';

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

export function ToolCallCard({ event }: { event: CodexToolEvent }) {
  const isDiff = event.name === 'fileChange';
  const formattedOutput = isDiff ? `\`\`\`diff\n${event.output}\n\`\`\`` : event.output;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-mutedForeground w-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 font-mono">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <Terminal className="h-4 w-4" />
          <span>{event.name}</span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide">
          {event.status}
        </span>
      </div>
      <div className="mt-2 space-y-2 min-w-0">
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-background/50 px-4 py-4 text-xs leading-6 text-mutedForeground w-full min-w-0 font-mono">
          {renderArgs(event.args)}
        </pre>
        {event.output ? (
          <div className="prose prose-sm prose-neutral max-w-none dark:prose-invert [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:bg-background/80 [&_pre]:px-4 [&_pre]:py-4 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-all break-words min-w-0">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{formattedOutput}</ReactMarkdown>
          </div>
        ) : null}
      </div>
    </div>
  );
}
