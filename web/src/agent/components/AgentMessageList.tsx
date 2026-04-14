import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

import { ToolCallCard } from './ToolCallCard';
import { ThinkingBlock } from './ThinkingBlock';
import type { AgentMessage } from '../sessionStore';

export function AgentMessageList({
  messages,
  isStreaming,
}: {
  messages: AgentMessage[];
  isStreaming: boolean;
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-8 pb-10">
      {messages.map((message, index) => {
        const generating = isStreaming && index === messages.length - 1;
        if (message.role === 'user') {
          return (
            <article key={message.id} className="space-y-2">
              <div className="ml-auto w-fit max-w-[90%] rounded-full border border-border bg-accent px-4 py-2.5 text-sm leading-7 text-accentForeground">
                <div className="whitespace-pre-wrap break-words">{message.text}</div>
              </div>
            </article>
          );
        }

        return (
          <article key={message.id} className="space-y-4 min-w-0 overflow-hidden">
            <ThinkingBlock text={message.thinking} isGenerating={generating} hasText={message.text.trim().length > 0} />
            {message.toolEvents.length > 0 ? (
              <div className="space-y-2 min-w-0">
                {message.toolEvents.map((event) => (
                  <ToolCallCard key={event.id} event={event} />
                ))}
              </div>
            ) : null}
            {message.text.trim() ? (
              <div className="prose prose-sm prose-neutral max-w-none text-[15px] text-foreground leading-7 [&_p]:my-0 [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/50 [&_pre]:text-foreground [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-all break-words [&_pre]:px-4 [&_pre]:py-4 min-w-0 dark:prose-invert">
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {generating ? message.text + ' \u2503' : message.text}
                </ReactMarkdown>
              </div>
            ) : null}
            {message.error ? (
              <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-mutedForeground">
                {message.error}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
