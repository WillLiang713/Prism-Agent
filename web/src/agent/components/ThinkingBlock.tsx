import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Disclosure } from '@heroui/react/disclosure';

import { cn } from '../../lib/utils';
import { MarkdownContent } from './MarkdownContent';

const THINKING_PANEL_CLASS =
  'mt-1.5 min-w-0 break-words text-left';
const THINKING_MARKDOWN_CLASS =
  `${THINKING_PANEL_CLASS} text-[14px] leading-[23px] text-mutedForeground/95 [&_blockquote]:my-2 [&_h1]:mb-1.5 [&_h1]:mt-2 [&_h1]:text-[14px] [&_h1]:leading-[23px] [&_h2]:mb-1.5 [&_h2]:mt-2 [&_h2]:text-[14px] [&_h2]:leading-[23px] [&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-[14px] [&_h3]:leading-[23px] [&_h4]:mb-1.5 [&_h4]:mt-2 [&_h4]:text-[14px] [&_h4]:leading-[23px] [&_ol]:my-2 [&_p]:my-2 [&_p]:leading-[23px] [&_pre]:my-2 [&_pre]:text-[13px] [&_pre]:text-foreground [&_ul]:my-2`;

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
    <Disclosure
      isExpanded={isOpen}
      onExpandedChange={setIsOpen}
      className="group text-left text-[13px] text-mutedForeground"
    >
      <Disclosure.Heading className="contents">
        <Disclosure.Trigger className="flex w-fit max-w-full cursor-pointer items-center gap-1.5 rounded-sm bg-transparent p-0 leading-5 text-mutedForeground/80 hover:text-foreground focus-visible:outline-none focus-visible:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/20">
          <span
            className={cn(status === 'streaming' && 'thinking-title-shimmer')}
            data-shimmer-text={status === 'streaming' ? label : undefined}
          >
            {label}
          </span>
          <Disclosure.Indicator
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-mutedForeground/70 opacity-0 transition-[opacity,transform] duration-200 group-hover:opacity-85 group-focus-within:opacity-85 data-[expanded=true]:rotate-180 data-[expanded=true]:opacity-100"
          >
            <ChevronDown />
          </Disclosure.Indicator>
        </Disclosure.Trigger>
      </Disclosure.Heading>
      {isOpen ? (
        <Disclosure.Content className="min-w-0 p-0">
          {text.trim() ? (
            status === 'streaming' ? (
              <div className={cn(THINKING_PANEL_CLASS, 'whitespace-pre-wrap break-words text-[14px] leading-[23px] text-mutedForeground/95')}>
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
          )}
        </Disclosure.Content>
      ) : null}
    </Disclosure>
  );
}

function resolveElapsedSec(startedAt: number) {
  return Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
}
