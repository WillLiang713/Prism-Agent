import { useState } from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { ServiceManager } from './ServiceManager';
import { GeneralSettings } from './GeneralSettings';

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<'services' | 'general'>('services');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[min(560px,80vh)] w-[min(960px,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[20px] border border-border/60 bg-card/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Dialog.Title className="font-display text-lg font-semibold tracking-tight text-foreground">
                设置
              </Dialog.Title>
            </div>

            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label="关闭设置" className="shrink-0">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setActiveTab('services')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'services'
                  ? 'bg-foreground/[0.08] text-foreground'
                  : 'text-mutedForeground hover:bg-foreground/[0.05] hover:text-foreground'
              }`}
            >
              服务
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'general'
                  ? 'bg-foreground/[0.08] text-foreground'
                  : 'text-mutedForeground hover:bg-foreground/[0.05] hover:text-foreground'
              }`}
            >
              常规
            </button>
          </div>

          <div className="mt-6 flex min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="min-h-0 flex-1">
              <div className="px-2 pb-10 flex flex-col space-y-10">
                {activeTab === 'services' && (
                  <div className="flex-1">
                    <ServiceManager />
                  </div>
                )}
                {activeTab === 'general' && (
                  <div className="flex-1">
                    <GeneralSettings />
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
