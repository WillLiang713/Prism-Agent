import { useEffect, useState } from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import { Bot, RefreshCw, Server, X } from 'lucide-react';

import { agentListModels } from '../../agent/client';
import { resolveSelectedService, useConfigStore } from '../../store/configStore';
import { Button } from '../ui/button';
import { Combobox } from '../ui/combobox';
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

type SettingsSectionId = 'services' | 'runtime';

type SettingsSectionMeta = {
  id: SettingsSectionId;
  title: string;
  icon: React.ElementType;
};

const FOLLOW_CURRENT_SERVICE_VALUE = '__follow_current_service__';

function SettingsNavButton({
  active,
  title,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full touch-manipulation items-center gap-3 rounded-full px-4 py-3 text-left transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20 ${
        active
          ? 'bg-background/80 text-foreground shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] dark:bg-background/55'
          : 'bg-transparent text-mutedForeground hover:bg-background/55 hover:text-foreground dark:hover:bg-background/36'
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 transition-colors ${
          active ? 'text-foreground' : 'text-mutedForeground'
        }`}
        aria-hidden="true"
      />
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
    <section className="grid gap-4">
      <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h3>
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
  const services = useConfigStore((state) => state.services);
  const serviceManagerSelectedId = useConfigStore((state) => state.serviceManagerSelectedId);
  const updateRuntimeModelConfig = useConfigStore((state) => state.updateRuntimeModelConfig);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('services');

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

  const effectiveTitleService = hasTitleServiceOverride
    ? services.find((s) => s.id === runtimeModelConfig.titleModelServiceId) || null
    : resolveSelectedService(services, serviceManagerSelectedId);

  const [titleModelOptions, setTitleModelOptions] = useState<string[]>([]);
  const [titleModelLoading, setTitleModelLoading] = useState(false);
  const [titleModelError, setTitleModelError] = useState<string | null>(null);

  useEffect(() => {
    setTitleModelOptions([]);
    setTitleModelError(null);
    if (effectiveTitleService?.model.apiKey && effectiveTitleService?.model.apiUrl) {
      void refreshTitleModelList({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTitleService?.id]);

  async function refreshTitleModelList(options: { silent?: boolean } = {}) {
    if (!effectiveTitleService) return;
    if (!options.silent) setTitleModelLoading(true);
    setTitleModelError(null);
    try {
      const result = await agentListModels({
        providerSelection: effectiveTitleService.model.providerSelection,
        apiUrl: effectiveTitleService.model.apiUrl,
        apiKey: effectiveTitleService.model.apiKey,
      });
      setTitleModelOptions(result.models.map((m) => m.id));
    } catch (error) {
      setTitleModelError(error instanceof Error ? error.message : String(error));
      setTitleModelOptions([]);
    } finally {
      if (!options.silent) setTitleModelLoading(false);
    }
  }

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
                <SelectTrigger className="border-0 bg-muted/90 shadow-none dark:bg-muted/75">
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
            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-mutedForeground">标题模型</span>
                <div className="flex min-w-0 items-center gap-2">
                  {titleModelError ? (
                    <span
                      className="max-w-[160px] truncate text-[11px] text-danger/80"
                      title={titleModelError}
                    >
                      {titleModelError}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => refreshTitleModelList()}
                    disabled={titleModelLoading || !effectiveTitleService}
                    className="flex shrink-0 items-center gap-1 text-[11px] text-mutedForeground/80 hover:text-foreground disabled:opacity-50"
                    title="从端点获取模型列表"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${titleModelLoading ? 'animate-spin' : ''}`}
                    />
                    {titleModelLoading ? '获取中' : '获取'}
                  </button>
                </div>
              </div>
              <Combobox
                value={runtimeModelConfig.titleModel}
                onValueChange={(next) => updateRuntimeModelConfig({ titleModel: next })}
                options={titleModelOptions}
                placeholder={
                  effectiveTitleService?.model.titleModel ||
                  effectiveTitleService?.model.model ||
                  '跟随服务默认模型'
                }
              />
            </div>
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
              className="rounded-2xl border-0 bg-muted/90 dark:bg-muted/75"
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

    return <ServiceManager />;
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[min(900px,92vh)] w-[min(1160px,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[20px] border border-border/60 bg-card/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
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

          <div className="mt-4 grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[200px_minmax(0,1fr)]">
            <aside className="grid content-start gap-1 py-2 pr-2">
              {sections.map((section) => (
                <SettingsNavButton
                  key={section.id}
                  active={section.id === activeSection}
                  title={section.title}
                  icon={section.icon}
                  onClick={() => setActiveSection(section.id)}
                />
              ))}
            </aside>

            <div className="flex min-h-0 flex-col overflow-hidden border-l border-border/50">
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-8 px-8 py-6 pb-10">
                  {renderSectionContent()}
                </div>
              </ScrollArea>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
