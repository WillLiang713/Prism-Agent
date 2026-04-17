import { AgentSkillsSnapshot } from '../sessionStore';
import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { ScrollArea, ScrollBar } from '../../components/ui/scroll-area';

export function SkillsDisplay({ skills }: { skills: AgentSkillsSnapshot }) {
  // 建立技能与诊断的相关性
  const skillsWithMetadata = useMemo(() => {
    return skills.items.map((skill) => {
      const relatedDiagnostics = skills.diagnostics.filter(
        (d) =>
          d.includes(`"${skill.name}"`) ||
          d.includes(`'${skill.name}'`) ||
          d.toLowerCase().includes(skill.name.toLowerCase()),
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

  // 计算未关联到特定技能的通用诊断
  const orphanDiagnostics = skills.diagnostics.filter(
    (d) =>
      !skills.items.some(
        (skill) =>
          d.includes(`"${skill.name}"`) ||
          d.includes(`'${skill.name}'`) ||
          d.toLowerCase().includes(skill.name.toLowerCase()),
      ),
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[12px] text-mutedForeground/80 select-none px-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">已加载 {skills.items.length} 个技能</span>
          {skills.diagnostics.length > 0 && (
            <span className="flex items-center gap-1.5 text-warm">
              <span className="h-1 w-1 rounded-full bg-warm" />
              {skills.diagnostics.length} 条诊断
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {/* 技能标签区域 - 水平滚动 */}
        <div 
          className="relative"
          style={{ 
            maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent)',
            WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent)'
          }}
        >
          <ScrollArea className="w-full whitespace-nowrap group" orientation="horizontal">
            <div className="flex w-max gap-2 pb-2 px-1">
              {skillsWithMetadata.map((skill) => (
                <Tooltip key={skill.id}>
                  <TooltipTrigger asChild>
                    <span
                      className={`cursor-default select-none rounded-md border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                        skill.hasIssue
                          ? 'border-warm/50 bg-warm/5 text-warm'
                          : 'border-border/40 bg-muted/20 text-mutedForeground hover:border-border/60 hover:text-mutedForeground/90'
                      }`}
                    >
                      {skill.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="flex flex-col gap-1 p-2">
                    <div className="text-[12px] font-semibold text-foreground/90">{skill.name}</div>
                    <div className="text-[11px] text-mutedForeground/80">{skill.description}</div>
                    <div className="text-[10px] text-mutedForeground/50 font-mono mt-1 opacity-80">
                      {skill.source}
                    </div>
                    {skill.relatedDiagnostics.length > 0 && (
                      <div className="mt-1.5 border-t border-border/40 pt-1.5 flex flex-col gap-1">
                        {skill.relatedDiagnostics.map((d, i) => (
                          <div key={i} className="text-[10px] text-warm/90 leading-relaxed italic">
                            {d}
                          </div>
                        ))}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </ScrollArea>
        </div>

        {/* 通用诊断区域 - 垂直滚动限高 */}
        {orphanDiagnostics.length > 0 && (
          <ScrollArea className="max-h-[100px] w-full rounded-md border border-border/30 bg-muted/5 mx-1">
            <div className="flex flex-col gap-1 p-2 text-[11px] leading-relaxed text-mutedForeground/70">
              {orphanDiagnostics.map((diag, idx) => (
                <div key={idx} className="flex gap-2">
                  <span>{diag}</span>
                </div>
              ))}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
