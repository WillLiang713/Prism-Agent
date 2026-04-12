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

  const statusTitle = isThinking ? '思考中...' : elapsedSec > 0 ? '思考完成，用时' : '思考过程';
  const statusTime = isThinking ? `${elapsedSec}秒` : elapsedSec > 0 ? `${elapsedSec}秒` : '';

  return (
    <>
      <style>{`
        @keyframes custom-shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        .animate-custom-shimmer {
          animation: custom-shimmer 2.5s linear infinite;
        }
      `}</style>
      <details className="group text-sm text-mutedForeground">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 font-medium text-mutedForeground/80 transition-colors hover:text-foreground">
          <span
            className={
              isThinking
                ? 'animate-custom-shimmer inline-block bg-[length:200%_100%] bg-clip-text text-transparent bg-gradient-to-r from-mutedForeground/60 via-foreground/90 to-mutedForeground/60'
                : ''
            }
          >
            {statusTitle}
          </span>
          {statusTime ? (
            <span className="font-normal text-mutedForeground/70">{statusTime}</span>
          ) : null}
          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        </summary>
        <div className="prose prose-sm prose-neutral mt-2 max-w-none text-mutedForeground prose-pre:rounded-xl prose-pre:border prose-pre:border-border prose-pre:bg-[#111111] prose-pre:text-[#fafafa] [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-all break-words [&_pre]:px-4 [&_pre]:py-4 dark:prose-invert">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{text}</ReactMarkdown>
        </div>
      </details>
    </>
  );
}
