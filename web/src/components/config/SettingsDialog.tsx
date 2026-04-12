import { useEffect, useState } from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import { Bot, Monitor, Search, Server, X } from 'lucide-react';

import { isDesktopRuntime } from '../../lib/runtime';
import { webSearchSelectLabels, type WebSearchSelectValue } from '../../lib/configOptions';
import { useConfigStore } from '../../store/configStore';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
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

type SettingsSectionId = 'services' | 'runtime' | 'search' | 'desktop';

type SettingsSectionMeta = {
  id: SettingsSectionId;
  title: string;
  icon: React.ElementType;
};

const FOLLOW_MAIN_SERVICE_VALUE = '__follow_main_service__';

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
      className={`group flex w-full items-center rounded-full border px-4 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        active
          ? 'border-border bg-card text-foreground'
          : 'border-transparent bg-transparent text-mutedForeground hover:bg-muted hover:text-foreground'
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
    <section className="grid gap-5 rounded-xl border border-border bg-card p-6">
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
  const webSearch = useConfigStore((state) => state.webSearch);
  const desktop = useConfigStore((state) => state.desktop);
  const services = useConfigStore((state) => state.services);
  const serviceManagerSelectedId = useConfigStore((state) => state.serviceManagerSelectedId);
  const updateRuntimeModelConfig = useConfigStore((state) => state.updateRuntimeModelConfig);
  const updateWebSearch = useConfigStore((state) => state.updateWebSearch);
  const updateDesktopConfig = useConfigStore((state) => state.updateDesktopConfig);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('services');

  const isDesktop = isDesktopRuntime();
  const hasTitleServiceOverride = services.some(
    (service) => service.id === runtimeModelConfig.titleModelServiceId,
  );
  const titleServiceValue = hasTitleServiceOverride
    ? runtimeModelConfig.titleModelServiceId
    : FOLLOW_MAIN_SERVICE_VALUE;

  const sections: SettingsSectionMeta[] = [
    {
      id: 'services',
      title: '服务',
      icon: Server,
    },
    {
      id: 'runtime',
      title: '模型与提示词',
      icon: Bot,
    },
    {
      id: 'search',
      title: '搜索',
      icon: Search,
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
        <SettingsSectionCard title="模型来源">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs">
              <span className="text-mutedForeground">标题模型服务</span>
              <Select
                value={titleServiceValue}
                onValueChange={(value) =>
                  updateRuntimeModelConfig({
                    titleModelServiceId: value === FOLLOW_MAIN_SERVICE_VALUE ? '' : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择标题模型服务" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FOLLOW_MAIN_SERVICE_VALUE}>跟随主模型服务</SelectItem>
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

        <SettingsSectionCard title="模型覆盖">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs">
              <span className="text-mutedForeground">主模型</span>
              <Input
                name="runtime-main-model"
                autoComplete="off"
                value={runtimeModelConfig.model}
                placeholder={services[0]?.model.model || '例如 gpt-5.1…'}
                onChange={(event) =>
                  updateRuntimeModelConfig({ model: event.currentTarget.value })
                }
              />
            </label>

            <label className="grid gap-2 text-xs">
              <span className="text-mutedForeground">标题模型</span>
              <Input
                name="runtime-title-model"
                autoComplete="off"
                value={runtimeModelConfig.titleModel}
                placeholder="例如 gpt-5.1-mini…"
                onChange={(event) =>
                  updateRuntimeModelConfig({ titleModel: event.currentTarget.value })
                }
              />
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
              className="rounded-xl"
            />
          </label>
        </SettingsSectionCard>
      </div>
    );
  }

  function renderSearchSection() {
    return (
      <div className="space-y-8">
        <SettingsSectionCard title="联网搜索状态">
          <Select
            value={webSearch.enabled ? webSearch.toolMode : 'off'}
            onValueChange={(value: string) => {
              if (value === 'off') {
                updateWebSearch({ enabled: false });
                return;
              }
              updateWebSearch({
                enabled: true,
                toolMode: value as typeof webSearch.toolMode,
                provider: value === 'builtin' ? 'tavily' : value,
              });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择联网状态或引擎" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(webSearchSelectLabels) as Array<[WebSearchSelectValue, string]>).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </SettingsSectionCard>

        {webSearch.toolMode === 'tavily' ? (
          <SettingsSectionCard title="Tavily">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-xs md:col-span-2">
                <span className="text-mutedForeground">API Key</span>
                <Input
                  name="tavily-api-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={webSearch.tavilyApiKey}
                  placeholder="tvly-…"
                  onChange={(event) =>
                    updateWebSearch({ tavilyApiKey: event.currentTarget.value })
                  }
                />
              </label>

              <label className="grid gap-2 text-xs">
                <span className="text-mutedForeground">最大结果数</span>
                <Input
                  name="tavily-max-results"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  autoComplete="off"
                  value={String(webSearch.maxResults)}
                  onChange={(event) => {
                    const nextValue = Number.parseInt(event.currentTarget.value, 10);
                    updateWebSearch({
                      maxResults: Number.isFinite(nextValue)
                        ? Math.min(10, Math.max(1, nextValue))
                        : 5,
                    });
                  }}
                />
              </label>

              <label className="grid gap-2 text-xs">
                <span className="text-mutedForeground">搜索深度</span>
                <Select
                  value={webSearch.searchDepth}
                  onValueChange={(value) => updateWebSearch({ searchDepth: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择搜索深度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
          </SettingsSectionCard>
        ) : null}

        {webSearch.toolMode === 'exa' ? (
          <SettingsSectionCard title="Exa">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-xs md:col-span-2">
                <span className="text-mutedForeground">API Key</span>
                <Input
                  name="exa-api-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={webSearch.exaApiKey}
                  placeholder="exa-…"
                  onChange={(event) => updateWebSearch({ exaApiKey: event.currentTarget.value })}
                />
              </label>

              <label className="grid gap-2 text-xs">
                <span className="text-mutedForeground">最大结果数</span>
                <Input
                  name="exa-max-results"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  autoComplete="off"
                  value={String(webSearch.maxResults)}
                  onChange={(event) => {
                    const nextValue = Number.parseInt(event.currentTarget.value, 10);
                    updateWebSearch({
                      maxResults: Number.isFinite(nextValue)
                        ? Math.min(10, Math.max(1, nextValue))
                        : 5,
                    });
                  }}
                />
              </label>

              <label className="grid gap-2 text-xs">
                <span className="text-mutedForeground">搜索类型</span>
                <Select
                  value={webSearch.exaSearchType}
                  onValueChange={(value) => updateWebSearch({ exaSearchType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择搜索类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="keyword">Keyword</SelectItem>
                    <SelectItem value="neural">Neural</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
          </SettingsSectionCard>
        ) : null}

        {webSearch.toolMode === 'builtin' ? (
          <SettingsSectionCard title="模型原生搜索">
            <div className="rounded-xl border border-border bg-muted px-6 py-5 text-xs text-mutedForeground">
              如果当前使用的模型接口（如 Gemini、Anthropic、OpenAI Responses）本身自带联网搜索能力，Prism 会自动在发请求时带上它。不需要在此处配置任何外部密钥。
            </div>
          </SettingsSectionCard>
        ) : null}
      </div>
    );
  }

  function renderDesktopSection() {
    return (
      <div className="space-y-8">
        <SettingsSectionCard title="窗口行为">
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-muted px-6 py-5 text-xs hover:bg-card">
            <span className="space-y-1">
              <span className="block font-normal text-foreground">关闭时最小化到托盘</span>
              <span className="block text-mutedForeground">
                开启后，点击关闭按钮不会直接退出应用。
              </span>
            </span>
            <Checkbox
              checked={desktop.closeToTrayOnClose}
              aria-label="关闭时最小化到托盘"
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

    if (activeSection === 'search') {
      return renderSearchSection();
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[min(900px,92vh)] w-[min(1280px,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background/95 p-6 backdrop-blur-2xl">
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

          <div className="mt-6 grid min-h-0 flex-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="grid content-start gap-3">
              {sections.map((section) => (
                <SettingsNavButton
                  key={section.id}
                  active={section.id === activeSection}
                  title={section.title}
                  onClick={() => setActiveSection(section.id)}
                />
              ))}
            </aside>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
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
