import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

export function ThinkingBlock({
  text,
  isGenerating,
  hasText,
}: {
  text: string;
  isGenerating?: boolean;
  hasText?: boolean;
}) {
  const isThinking = isGenerating && !hasText;
  const startTimeRef = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isThinking && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    if (isThinking) {
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isThinking]);

  if (!text.trim()) {
    return null;
  }

  const statusTitle = isThinking ? '思考中' : elapsedSec > 0 ? '思考完成，用时' : '思考过程';
  const statusTime = isThinking ? `${elapsedSec}秒` : elapsedSec > 0 ? `${elapsedSec}秒` : '';

  return (
    <details
      className="group text-sm text-mutedForeground"
      onToggle={(event) => setIsOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 font-medium text-mutedForeground/80 hover:text-foreground">
        <span>{statusTitle}</span>
        {isThinking ? <span aria-hidden="true" className="text-mutedForeground/50">...</span> : null}
        {statusTime ? (
          <span className="font-normal text-mutedForeground/70">{statusTime}</span>
        ) : null}
        <ChevronRight className="h-4 w-4 group-open:rotate-90" />
      </summary>
      {isOpen ? (
        isThinking ? (
          <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-[1.8] text-mutedForeground">
            {text}
          </div>
        ) : (
          <div className="prose prose-sm prose-neutral mt-2 max-w-none text-mutedForeground prose-pre:rounded-xl prose-pre:border prose-pre:border-border prose-pre:bg-muted/50 prose-pre:text-foreground [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-all break-words [&_pre]:px-4 [&_pre]:py-4 dark:prose-invert">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{text}</ReactMarkdown>
          </div>
        )
      ) : null}
    </details>
  );
}
