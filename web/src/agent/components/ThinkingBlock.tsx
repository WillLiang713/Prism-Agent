import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '../../lib/utils';
import { MarkdownContent } from './MarkdownContent';

const THINKING_MARKDOWN_CLASS =
  'mt-2 border-l border-border/70 pl-3 text-sm leading-6 text-mutedForeground/95 [&_blockquote]:my-2 [&_h1]:mb-1.5 [&_h1]:mt-2 [&_h1]:text-sm [&_h1]:leading-6 [&_h2]:mb-1.5 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:leading-6 [&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:leading-6 [&_h4]:mb-1.5 [&_h4]:mt-2 [&_h4]:text-sm [&_h4]:leading-6 [&_ol]:my-2 [&_p]:my-2 [&_p]:leading-6 [&_pre]:my-2 [&_pre]:text-xs [&_pre]:text-foreground [&_ul]:my-2';

export function ThinkingBlock({
  text,
  status,
  startedAt,
  durationSec,
}: {
  text: string;
  status: 'streaming' | 'done' | 'aborted';
  startedAt: number;
  durationSec?: number;
}) {
  const [elapsedSec, setElapsedSec] = useState(() => resolveElapsedSec(startedAt));
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (status !== 'streaming') {
      setElapsedSec(resolveElapsedSec(startedAt));
      return;
    }

    setElapsedSec(resolveElapsedSec(startedAt));
    const interval = window.setInterval(() => {
      setElapsedSec(resolveElapsedSec(startedAt));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt, status]);

  const label = useMemo(() => {
    if (status === 'aborted') {
      return '思考已中断';
    }

    const seconds = durationSec ?? elapsedSec;
    if (status === 'streaming') {
      return `思考中 ${seconds} 秒`;
    }

    return `已思考 ${seconds} 秒`;
  }, [durationSec, elapsedSec, status]);

  return (
    <details
      className="group text-xs text-mutedForeground"
      onToggle={(event) => setIsOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 leading-5 text-mutedForeground/80 hover:text-foreground">
        <span className={cn(status === 'streaming' && 'thinking-title-shimmer')}>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-mutedForeground/70 opacity-0 transition-all duration-200 group-hover:opacity-85 group-focus-within:opacity-85 group-open:rotate-180 group-open:opacity-100" />
      </summary>
      {isOpen ? (
        text.trim() ? (
          status === 'streaming' ? (
            <div className="mt-2 whitespace-pre-wrap break-words border-l border-border/70 pl-3 text-sm leading-6 text-mutedForeground/95">
              {text}
            </div>
          ) : (
            <MarkdownContent
              text={text}
              className={THINKING_MARKDOWN_CLASS}
            />
          )
        ) : (
          <div className="mt-1.5" />
        )
      ) : null}
    </details>
  );
}

function resolveElapsedSec(startedAt: number) {
  return Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
}
