import { AgentSkillsSnapshot } from '../sessionStore';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export function SkillsDisplay({ skills }: { skills: AgentSkillsSnapshot }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (skills.items.length === 0 && skills.diagnostics.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 flex flex-col gap-1.5 px-1">
      <div 
        className="flex cursor-pointer items-center gap-2 text-sm text-mutedForeground/80 hover:text-mutedForeground transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-1.5">
          <span>已加载 {skills.items.length} 个技能</span>
          {skills.diagnostics.length > 0 && (
            <span className="flex items-center gap-1 text-danger/70">
              <span className="h-1 w-1 rounded-full bg-danger animate-pulse" />
              {skills.diagnostics.length} 条诊断
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </div>
      
      {isExpanded && (
        <div className="flex flex-wrap gap-2">
          {skills.items.map((skill) => (
            <span
              key={skill.id}
              className="rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1 text-[12px] text-mutedForeground transition-colors hover:border-border hover:bg-muted/50"
              title={`${skill.description}\n${skill.source}`}
            >
              {skill.name}
            </span>
          ))}
          {skills.diagnostics.length > 0 && (
            <div className="w-full whitespace-pre-wrap break-words rounded-lg bg-danger/5 p-3 text-[12px] leading-5 text-danger/70 border border-danger/10">
              {skills.diagnostics.join('\n')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
