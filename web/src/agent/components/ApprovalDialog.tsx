import * as Dialog from '@radix-ui/react-dialog';

import { Button } from '../../components/ui/button';
import type { AgentApproval } from '../sessionStore';

export function ApprovalDialog({
  approval,
  open,
  onDecision,
}: {
  approval: AgentApproval | null;
  open: boolean;
  onDecision: (decision: 'allow' | 'deny') => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onDecision('deny')}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/18 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 shadow-none">
          <Dialog.Title className="font-display text-2xl font-medium text-foreground">
            操作审批
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-7 text-mutedForeground">
            {approval?.reason || '请求执行以下操作。'}
          </Dialog.Description>
          <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm text-mutedForeground">风险等级</span>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground">
                {approval?.risk === 'high' ? '高' : '低'}
              </span>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
              {approval?.command || ''}
            </pre>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onDecision('deny')}
            >
              拒绝
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => onDecision('allow')}
            >
              允许一次
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
