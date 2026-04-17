import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/utils';
import { MarkdownContent } from './MarkdownContent';

export function ThinkingBlock({
  text,
  isGenerating,
  hasText,
  durationSec,
}: {
  text: string;
  isGenerating?: boolean;
  hasText?: boolean;
  durationSec?: number;
}) {
  const isThinking = isGenerating && !hasText;
  const startTimeRef = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isThinking && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      setElapsedSec(1);
    }

    if (isThinking) {
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSec(Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000)));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isThinking]);

  if (!isThinking && !text.trim()) {
    return null;
  }

  const resolvedDurationSec = durationSec ?? elapsedSec;
  const statusTitle = isThinking ? '思考中' : resolvedDurationSec > 0 ? '思考完成，用时' : '思考过程';
  const statusSeconds = isThinking ? elapsedSec : resolvedDurationSec > 0 ? resolvedDurationSec : null;
  const thinkingStatusLabel = statusSeconds !== null ? `${statusTitle} ${statusSeconds} 秒` : statusTitle;

  return (
    <details
      className="group text-sm text-mutedForeground"
      onToggle={(event) => setIsOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 font-medium text-mutedForeground/80 hover:text-foreground">
        {isThinking ? (
          <span className={cn('inline-block', 'thinking-title-shimmer')}>{thinkingStatusLabel}</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span>{statusTitle}</span>
            {statusSeconds !== null ? (
              <span className="inline-flex items-center gap-1">
                <span>{statusSeconds}</span>
                <span>秒</span>
              </span>
            ) : null}
          </span>
        )}
        <ChevronRight className="h-4 w-4 group-open:rotate-90" />
      </summary>
      {isOpen ? (
        isThinking ? (
          <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-[1.8] text-mutedForeground">
            {text}
          </div>
        ) : (
          <MarkdownContent
            text={text}
            className="mt-2 text-sm leading-[1.8] text-mutedForeground [&_pre]:text-foreground"
          />
        )
      ) : null}
    </details>
  );
}
