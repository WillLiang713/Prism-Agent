import { AgentSkillsSnapshot } from '../sessionStore';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export function SkillsDisplay({ skills }: { skills: AgentSkillsSnapshot }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (skills.items.length === 0 && skills.diagnostics.length === 0) {
    return null;
  }

  return (
    <section className="mb-3 rounded-[12px] border border-border bg-card px-4 py-2 text-sm text-mutedForeground transition-all">
      <div 
        className="flex cursor-pointer items-center justify-between py-1"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">Skills</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
            {skills.items.length} 已加载
          </span>
          {skills.diagnostics.length > 0 ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-danger">
              {skills.diagnostics.length} 条诊断
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-2 space-y-3 pb-2 border-t border-border pt-3">
          {skills.items.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {skills.items.map((skill) => (
                <span
                  key={skill.id}
                  className="rounded-full border border-border bg-background/50 px-2 py-0.5 text-[11px] text-foreground"
                  title={`${skill.description}\n${skill.source}`}
                >
                  {skill.name}
                </span>
              ))}
            </div>
          )}
          {skills.diagnostics.length > 0 && (
            <div className="whitespace-pre-wrap break-words rounded bg-danger/5 p-2 text-[11px] leading-5 text-danger/80">
              {skills.diagnostics.join('\n')}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
