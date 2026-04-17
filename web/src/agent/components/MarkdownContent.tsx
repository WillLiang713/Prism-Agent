import { memo, type HTMLAttributes } from 'react';
import type { Components, ExtraProps } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { cn } from '../../lib/utils';
import { MARKDOWN_BODY_CLASS } from './MarkdownContent.styles';

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS_WITH_HIGHLIGHT = [rehypeHighlight];
const REHYPE_PLUGINS_PLAIN: [] = [];

type MarkdownElementProps = HTMLAttributes<HTMLElement> & ExtraProps;

const markdownComponents: Components = {
  a: ({ node: _node, className, ...props }) => (
    <a
      {...props}
      className={cn(
        'text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground/80',
        className,
      )}
    />
  ),
  hr: ({ node: _node, className, ...props }) => (
    <div className="my-6">
      <hr
        {...props}
        className={cn(
          'h-px w-full rounded-full bg-gradient-to-r from-transparent via-border/80 to-transparent',
          className,
        )}
      />
    </div>
  ),
  table: ({ node: _node, className, children, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-border/70 bg-background/35">
      <table
        {...props}
        className={cn('min-w-full border-collapse text-left text-sm leading-6', className)}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ node: _node, className, ...props }) => (
    <thead {...props} className={cn('bg-muted/35 text-foreground/92', className)} />
  ),
  th: ({ node: _node, className, ...props }) => (
    <th
      {...props}
      className={cn(
        'border-b border-border/70 px-3 py-2 font-medium tracking-[-0.01em]',
        className,
      )}
    />
  ),
  td: ({ node: _node, className, ...props }) => (
    <td {...props} className={cn('border-t border-border/50 px-3 py-2 align-top', className)} />
  ),
  blockquote: ({ node: _node, className, ...props }) => (
    <blockquote
      {...props}
      className={cn('my-4 border-l border-border/80 pl-4 text-mutedForeground', className)}
    />
  ),
  p: ({ node: _node, className, ...props }) => <p {...props} className={cn('my-4', className)} />,
  ul: ({ node: _node, className, ...props }) => (
    <ul {...props} className={cn('my-4 list-disc space-y-1.5 pl-6', className)} />
  ),
  ol: ({ node: _node, className, ...props }) => (
    <ol {...props} className={cn('my-4 list-decimal space-y-1.5 pl-6', className)} />
  ),
  li: ({ node: _node, className, ...props }) => <li {...props} className={cn('pl-1', className)} />,
  pre: ({ node: _node, className, ...props }: MarkdownElementProps) => (
    <pre
      {...props}
      className={cn(
        'my-4 overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-border/70 bg-muted/45 px-4 py-4 text-foreground',
        className,
      )}
    />
  ),
  code: ({ node: _node, className, ...props }: MarkdownElementProps) => (
    <code
      {...props}
      className={cn(
        'rounded-md bg-muted/55 px-1.5 py-0.5 font-mono text-[0.92em]',
        className,
      )}
    />
  ),
};

export const MarkdownBlock = memo(function MarkdownBlock({
  text,
  highlight = true,
}: {
  text: string;
  highlight?: boolean;
}) {
  return (
    <ReactMarkdown
      components={markdownComponents}
      rehypePlugins={highlight ? REHYPE_PLUGINS_WITH_HIGHLIGHT : REHYPE_PLUGINS_PLAIN}
      remarkPlugins={REMARK_PLUGINS}
    >
      {text}
    </ReactMarkdown>
  );
});

export const MarkdownContent = memo(function MarkdownContent({
  text,
  className,
  highlight = true,
}: {
  text: string;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(MARKDOWN_BODY_CLASS, className)}>
      <MarkdownBlock text={text} highlight={highlight} />
    </div>
  );
});
