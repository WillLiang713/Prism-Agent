import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '../../lib/utils';
import { MarkdownContent } from './MarkdownContent';

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
            <div className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-6 text-mutedForeground">
              {text}
            </div>
          ) : (
            <MarkdownContent
              text={text}
              className="mt-1.5 text-xs leading-6 text-mutedForeground [&_pre]:text-foreground [&_pre]:text-xs"
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
