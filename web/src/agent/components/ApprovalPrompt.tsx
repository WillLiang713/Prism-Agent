import { Button } from '../../components/ui/button';
import type { AgentApproval } from '../sessionStore';

export function ApprovalPrompt({
  approval,
  onDecision,
}: {
  approval: AgentApproval;
  onDecision: (decision: 'allow' | 'deny') => void;
}) {
  return (
    <section
      aria-live="polite"
      aria-label="待确认操作"
      className="rounded-[18px] bg-muted/70 px-4 py-3.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)]"
    >
      <div className="min-w-0">
        <h2 className="text-xs font-medium tracking-[0.02em] text-mutedForeground">
          待确认操作
        </h2>
      </div>

      <div className="mt-3 min-w-0">
        <p className="text-[11px] leading-4 text-mutedForeground">目标文件</p>
        <pre
          translate="no"
          className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[14px] font-medium leading-6 text-foreground"
        >
          {approval.command}
        </pre>
      </div>

      <div className="mt-3.5 flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onDecision('deny')}
          className="focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-muted"
        >
          拒绝
        </Button>
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => onDecision('allow')}
          className="focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-muted"
        >
          允许一次
        </Button>
      </div>
    </section>
  );
}
