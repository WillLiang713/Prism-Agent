import type { AgentSkillsSnapshot } from '../sessionStore';
import { useMemo } from 'react';
import { ScrollShadow } from '@heroui/react/scroll-shadow';
import { Tooltip } from '@heroui/react/tooltip';

import { cn } from '../../lib/utils';

const skillChipClassName =
  'inline-flex h-6 max-w-[150px] shrink-0 cursor-default select-none items-center rounded-full border px-2 text-[12px] font-medium leading-none transition-[border-color,background-color,color]';

const skillTooltipClassName =
  'z-50 flex max-w-[min(22rem,calc(100vw-2rem))] flex-col gap-1 rounded-xl border border-border/60 bg-muted px-3 py-2 text-[13px] text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.20)]';

function diagnosticMentionsSkill(diagnostic: string, skillName: string) {
  return (
    diagnostic.includes(`"${skillName}"`) ||
    diagnostic.includes(`'${skillName}'`) ||
    diagnostic.toLowerCase().includes(skillName.toLowerCase())
  );
}

export function SkillsDisplay({ skills }: { skills: AgentSkillsSnapshot }) {
  const skillsWithMetadata = useMemo(() => {
    return skills.items.map((skill) => {
      const relatedDiagnostics = skills.diagnostics.filter(
        (diagnostic) => diagnosticMentionsSkill(diagnostic, skill.name),
      );

      return {
        ...skill,
        relatedDiagnostics,
        hasIssue: relatedDiagnostics.length > 0 || skill.status === 'error',
      };
    });
  }, [skills]);

  if (skills.items.length === 0 && skills.diagnostics.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0">
      <div className="flex min-h-8 items-center gap-2 rounded-xl border border-border/40 bg-card/55 px-2 py-1">
        <span className="inline-flex h-6 shrink-0 select-none items-center rounded-full bg-muted/45 px-2 text-[12px] font-medium leading-none text-mutedForeground">
          技能 {skills.items.length}
        </span>

        {skills.diagnostics.length > 0 ? (
          <Tooltip delay={400} closeDelay={100} trigger="hover">
            <Tooltip.Trigger className="inline-flex h-6 shrink-0 cursor-default select-none items-center gap-1.5 rounded-full border border-warm/45 bg-warm/5 px-2 text-[12px] font-medium leading-none text-warm">
              <span className="h-1.5 w-1.5 rounded-full bg-warm" aria-hidden="true" />
              诊断 {skills.diagnostics.length}
            </Tooltip.Trigger>
            <Tooltip.Content
              placement="top start"
              offset={6}
              className={cn(skillTooltipClassName, 'max-h-[16rem] overflow-y-auto')}
            >
              <div className="text-[13px] font-semibold text-foreground">技能诊断</div>
              {skills.diagnostics.map((diagnostic, index) => (
                <div key={`${diagnostic}-${index}`} className="text-[12px] leading-relaxed text-warm/95">
                  {diagnostic}
                </div>
              ))}
            </Tooltip.Content>
          </Tooltip>
        ) : null}

        {skillsWithMetadata.length > 0 ? (
          <ScrollShadow
            orientation="horizontal"
            className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap"
            size={18}
          >
            <div className="flex w-max items-center gap-1.5 pr-1">
              {skillsWithMetadata.map((skill) => (
                <Tooltip key={skill.id} delay={400} closeDelay={100} trigger="hover">
                  <Tooltip.Trigger
                    className={cn(
                      skillChipClassName,
                      skill.hasIssue
                        ? 'border-warm/50 bg-warm/5 text-warm'
                        : 'border-border/45 bg-muted/25 text-mutedForeground hover:border-border/70 hover:text-foreground',
                    )}
                  >
                    <span className="min-w-0 truncate" translate="no">{skill.name}</span>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="top" offset={6} className={skillTooltipClassName}>
                    <div className="text-[13px] font-semibold text-foreground" translate="no">{skill.name}</div>
                    <div className="text-[12px] leading-relaxed text-mutedForeground">{skill.description}</div>
                    <div className="mt-1 font-mono text-[11px] leading-snug text-mutedForeground/60" translate="no">
                      {skill.source}
                    </div>
                    {skill.relatedDiagnostics.length > 0 ? (
                      <div className="mt-1.5 flex flex-col gap-1 border-t border-border/40 pt-1.5">
                        {skill.relatedDiagnostics.map((diagnostic, index) => (
                          <div
                            key={`${diagnostic}-${index}`}
                            className="text-[11px] leading-relaxed text-warm/95"
                          >
                            {diagnostic}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Tooltip.Content>
                </Tooltip>
              ))}
            </div>
          </ScrollShadow>
        ) : null}
      </div>
    </div>
  );
}
