import { useEffect, useState } from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import { Bot, Monitor, Server, X } from 'lucide-react';

import { isDesktopRuntime } from '../../lib/runtime';
import { useConfigStore } from '../../store/configStore';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import { ServiceManager } from './ServiceManager';

type SettingsSectionId = 'services' | 'runtime' | 'desktop';

type SettingsSectionMeta = {
  id: SettingsSectionId;
  title: string;
  icon: React.ElementType;
};

const FOLLOW_CURRENT_SERVICE_VALUE = '__follow_current_service__';

function SettingsNavButton({
  active,
  title,
  onClick,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center rounded-full px-4 py-2.5 transition-colors focus-visible:outline-none ${
        active
          ? 'bg-background/90 text-foreground dark:bg-background/70'
          : 'bg-transparent text-mutedForeground hover:bg-background/65 hover:text-foreground dark:hover:bg-background/45'
      }`}
    >
      <span className="text-sm font-medium">{title}</span>
    </button>
  );
}

function SettingsSectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 rounded-xl bg-card p-6">
      <div className="space-y-1.5">
        <h3 className="font-display text-lg font-medium tracking-tight text-foreground">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const runtimeModelConfig = useConfigStore((state) => state.runtimeModelConfig);
  const desktop = useConfigStore((state) => state.desktop);
  const services = useConfigStore((state) => state.services);
  const serviceManagerSelectedId = useConfigStore((state) => state.serviceManagerSelectedId);
  const updateRuntimeModelConfig = useConfigStore((state) => state.updateRuntimeModelConfig);
  const updateDesktopConfig = useConfigStore((state) => state.updateDesktopConfig);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('services');

  const isDesktop = isDesktopRuntime();
  const hasTitleServiceOverride = services.some(
    (service) => service.id === runtimeModelConfig.titleModelServiceId,
  );
  const fallbackServiceName =
    services.find((service) => service.id === serviceManagerSelectedId)?.name ||
    services[0]?.name ||
    '未命名服务';
  const titleServiceValue = hasTitleServiceOverride
    ? runtimeModelConfig.titleModelServiceId
    : FOLLOW_CURRENT_SERVICE_VALUE;

  const sections: SettingsSectionMeta[] = [
    {
      id: 'services',
      title: '服务',
      icon: Server,
    },
    {
      id: 'runtime',
      title: '常规',
      icon: Bot,
    },
  ];

  if (isDesktop) {
    sections.push({
      id: 'desktop',
      title: '桌面',
      icon: Monitor,
    });
  }

  useEffect(() => {
    if (!isDesktop && activeSection === 'desktop') {
      setActiveSection('services');
    }
  }, [activeSection, isDesktop]);

  const currentSection = sections.find((section) => section.id === activeSection) || sections[0];

  function renderRuntimeSection() {
    return (
      <div className="space-y-8">
        <SettingsSectionCard title="模型服务">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs">
              <span className="text-mutedForeground">标题模型服务</span>
              <Select
                value={titleServiceValue}
                onValueChange={(value) =>
                  updateRuntimeModelConfig({
                    titleModelServiceId: value === FOLLOW_CURRENT_SERVICE_VALUE ? '' : value,
                  })
                }
              >
                <SelectTrigger className="border-0 bg-muted shadow-none">
                  <SelectValue placeholder="选择标题模型服务" />
                </SelectTrigger>
                <SelectContent className="border-0">
                  <SelectItem value={FOLLOW_CURRENT_SERVICE_VALUE}>
                    跟随当前服务（{fallbackServiceName}）
                  </SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name || '未命名服务'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
        </SettingsSectionCard>

        <SettingsSectionCard title="系统提示词">
          <label className="grid gap-2 text-xs">
            <span className="text-mutedForeground">提示词内容</span>
            <Textarea
              name="runtime-system-prompt"
              autoComplete="off"
              value={runtimeModelConfig.systemPrompt}
              placeholder="例如：始终先给结论，再给步骤…"
              onChange={(event) =>
                updateRuntimeModelConfig({ systemPrompt: event.currentTarget.value })
              }
              rows={7}
              className="rounded-xl border-0 bg-muted"
            />
          </label>
        </SettingsSectionCard>
      </div>
    );
  }

  function renderDesktopSection() {
    return (
      <div className="space-y-8">
        <SettingsSectionCard title="窗口行为">
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-muted px-6 py-5 text-xs hover:bg-card">
            <span className="space-y-1">
              <span className="block font-normal text-foreground">关闭时最小化到托盘</span>
              <span className="block text-mutedForeground">
                开启后，点击关闭按钮不会直接退出应用。
              </span>
            </span>
            <Checkbox
              checked={desktop.closeToTrayOnClose}
              aria-label="关闭时最小化到托盘"
              className="border-0"
              onCheckedChange={(checked) =>
                updateDesktopConfig({ closeToTrayOnClose: checked === true })
              }
            />
          </label>
        </SettingsSectionCard>
      </div>
    );
  }

  function renderSectionContent() {
    if (activeSection === 'runtime') {
      return renderRuntimeSection();
    }

    if (activeSection === 'desktop') {
      return renderDesktopSection();
    }

    return <ServiceManager />;
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[min(900px,92vh)] w-[min(1280px,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-background/95 p-6 backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Dialog.Title className="font-display text-lg font-medium tracking-tight text-foreground">
                设置
              </Dialog.Title>
            </div>

            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label="关闭设置" className="shrink-0">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-6 grid min-h-0 flex-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="grid content-start gap-3 rounded-xl bg-muted/85 p-3 dark:bg-card/95">
              {sections.map((section) => (
                <SettingsNavButton
                  key={section.id}
                  active={section.id === activeSection}
                  title={section.title}
                  onClick={() => setActiveSection(section.id)}
                />
              ))}
            </aside>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-muted/80 dark:bg-card/95">
              <ScrollArea className="min-h-0 flex-1 px-8 py-8">
                <div className="space-y-8 pb-4">{renderSectionContent()}</div>
              </ScrollArea>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
