import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

import { ToolCallCard } from './ToolCallCard';
import { ThinkingBlock } from './ThinkingBlock';
import type { AgentMessage, AgentSkillsSnapshot } from '../sessionStore';

export function AgentMessageList({
  messages,
  isStreaming,
  skills,
}: {
  messages: AgentMessage[];
  isStreaming: boolean;
  skills: AgentSkillsSnapshot;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex min-h-full w-full flex-1 flex-col items-center pt-12">
        {skills.items.length > 0 || skills.diagnostics.length > 0 ? (
          <div className="mb-12 w-full max-w-3xl">
            <section className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-mutedForeground">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">Skills</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
                  {skills.items.length} 已加载
                </span>
                {skills.diagnostics.length > 0 ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">
                    {skills.diagnostics.length} 条诊断
                  </span>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
        <div className="max-w-md text-center">
          <h2 className="font-display text-3xl font-medium tracking-tight text-foreground">
            想做什么？
          </h2>
          <p className="mt-3 text-sm leading-7 text-mutedForeground">
            输入需求、发送图片或恢复历史记录。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-10">
      {skills.items.length > 0 || skills.diagnostics.length > 0 ? (
        <section className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-mutedForeground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">Skills</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
              {skills.items.length} 已加载
            </span>
            {skills.diagnostics.length > 0 ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">
                {skills.diagnostics.length} 条诊断
              </span>
            ) : null}
          </div>
          {skills.items.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.items.map((skill) => (
                <span
                  key={skill.id}
                  className="rounded-full border border-border px-3 py-1 text-[11px] text-foreground"
                  title={`${skill.description}\n${skill.source}`}
                >
                  {skill.name}
                </span>
              ))}
            </div>
          ) : null}
          {skills.diagnostics.length > 0 ? (
            <div className="mt-3 whitespace-pre-wrap break-words text-xs leading-6">
              {skills.diagnostics.join('\n')}
            </div>
          ) : null}
        </section>
      ) : null}
      {messages.map((message, index) => {
        const generating = isStreaming && index === messages.length - 1;
        if (message.role === 'user') {
          return (
            <article key={message.id} className="space-y-2">
              <div className="ml-auto w-fit max-w-[90%] rounded-full border border-border bg-accent px-5 py-3 text-base leading-[1.8] text-accentForeground">
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
              <div className="prose prose-neutral max-w-none text-foreground leading-[1.8] [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:bg-[#111111] [&_pre]:text-[#fafafa] [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-all break-words [&_pre]:px-4 [&_pre]:py-4 min-w-0">
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {generating ? message.text + ' \u2503' : message.text}
                </ReactMarkdown>
              </div>
            ) : generating ? (
              <div className="flex items-center gap-2 text-sm text-mutedForeground animate-pulse">
                <div className="h-1.5 w-1.5 rounded-full bg-mutedForeground/60" />
                正在生成回复...
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
