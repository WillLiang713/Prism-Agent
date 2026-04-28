import { useState } from 'react';

import { Modal } from '@heroui/react/modal';
import { Tabs } from '@heroui/react/tabs';
import { ScrollShadow } from '@heroui/react/scroll-shadow';
import { X } from 'lucide-react';

import { ServiceManager } from './ServiceManager';
import { GeneralSettings } from './GeneralSettings';

const settingsTabsListClassName =
  '*:h-9 *:px-4 *:text-sm *:font-medium *:text-mutedForeground/45 *:!opacity-100 *:transition-colors *:data-[focus-visible=true]:text-foreground *:data-[selected=true]:font-semibold *:data-[selected=true]:!text-foreground';

const settingsTabIndicatorClassName = '!bg-foreground/35 dark:!bg-foreground/45';

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<'services' | 'general'>('services');

  return (
    <Modal isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Backdrop variant="blur" className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm">
        <Modal.Container placement="center" className="fixed inset-0 z-50 flex min-w-0 !w-full items-center justify-center !p-4">
          <Modal.Dialog className="flex h-[min(560px,80vh)] min-w-0 w-full !max-w-[960px] flex-col overflow-hidden rounded-[20px] border border-border/60 bg-card/95 !p-6 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.2)] outline-none backdrop-blur-2xl">
            <Modal.Header className="flex items-start justify-between gap-4 p-0">
              <div className="flex-1">
                <Modal.Heading className="font-display text-lg font-semibold text-foreground">
                  设置
                </Modal.Heading>
              </div>

              <Modal.CloseTrigger
                aria-label="关闭设置"
                className="!absolute !right-6 !top-6 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Modal.CloseTrigger>
            </Modal.Header>

            <Tabs 
              variant="secondary" 
              className="mt-4 flex min-h-0 flex-1 flex-col"
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as 'services' | 'general')}
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label="设置选项" className={settingsTabsListClassName}>
                  <Tabs.Tab id="services">
                    服务
                    <Tabs.Indicator className={settingsTabIndicatorClassName} />
                  </Tabs.Tab>
                  <Tabs.Tab id="general">
                    常规
                    <Tabs.Indicator className={settingsTabIndicatorClassName} />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>

              <Modal.Body className="mt-6 flex min-h-0 min-w-0 flex-1 overflow-hidden p-0">
                <ScrollShadow className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto" size={24}>
                  <div className="flex min-w-0 flex-col space-y-10 px-2 pb-10">
                    <Tabs.Panel id="services" className="min-w-0 flex-1 p-0">
                      <ServiceManager />
                    </Tabs.Panel>
                    <Tabs.Panel id="general" className="min-w-0 flex-1 p-0">
                      <GeneralSettings />
                    </Tabs.Panel>
                  </div>
                </ScrollShadow>
              </Modal.Body>
            </Tabs>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
