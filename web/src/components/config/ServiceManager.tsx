import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { ListBox } from '@heroui/react/list-box';
import { ScrollShadow } from '@heroui/react/scroll-shadow';
import { Select } from '@heroui/react/select';
import { ChevronDown, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useState, type CSSProperties } from 'react';

import { useConfigStore } from '../../store/configStore';
import { cn } from '../../lib/utils';

const providerLabels = {
  openai_chat: 'OpenAI Chat',
  openai_responses: 'OpenAI Responses',
  anthropic: 'Anthropic Messages',
  gemini: 'Google Gemini',
} as const;

const providerOptions = Object.entries(providerLabels).map(([value, label]) => ({
  value,
  label,
}));

const settingsInputClassName =
  '!h-11 !min-h-11 !w-full !min-w-0 !rounded-full !border !border-border !bg-card !px-4 !py-0 !text-sm !text-foreground !shadow-none placeholder:!text-mutedForeground/35 hover:!bg-muted/35 focus:!border-foreground/25 focus:!bg-card focus-visible:!ring-1 focus-visible:!ring-foreground/20';

const settingsSelectTriggerClassName =
  'flex !h-11 !min-h-11 !w-full !min-w-0 cursor-pointer items-center !rounded-full !border !border-border !bg-card !px-4 !py-0 !pr-10 !text-sm !text-foreground !shadow-none outline-none transition-colors hover:!bg-muted/35 focus-visible:!border-foreground/25 focus-visible:!bg-card focus-visible:!ring-1 focus-visible:!ring-foreground/20';

const settingsSelectValueClassName =
  '!block !min-w-0 !flex-1 !truncate !text-left !text-sm !font-medium !text-foreground';

const settingsSelectIndicatorClassName =
  '!right-4 !size-4 !text-mutedForeground/65';

const settingsSelectPopoverClassName =
  'z-50 !min-w-[var(--trigger-width)] overflow-hidden !rounded-xl border border-border !bg-muted !p-1 text-foreground !shadow-[0_18px_40px_rgba(0,0,0,0.22)]';

const settingsSelectListBoxClassName = 'max-h-72 overflow-y-auto !p-0';

const settingsSelectItemStateClassName =
  'transition-colors hover:!bg-foreground/[0.06] focus-visible:!bg-foreground/[0.06] data-[hovered=true]:!bg-foreground/[0.06] data-[focused]:!bg-foreground/[0.06] data-[focus-visible=true]:!bg-foreground/[0.06] data-[selected=true]:!bg-foreground/[0.08] aria-[selected=true]:!bg-foreground/[0.08]';

const settingsSelectItemClassName = cn(
  'flex w-full cursor-pointer select-none items-center justify-start rounded-lg px-3 py-2 text-left text-sm text-foreground outline-none',
  settingsSelectItemStateClassName,
);

export function ServiceManager() {
  const services = useConfigStore((state) => state.services);
  const serviceManagerSelectedId = useConfigStore((state) => state.serviceManagerSelectedId);
  const setServiceManagerSelectedId = useConfigStore((state) => state.setServiceManagerSelectedId);
  const upsertService = useConfigStore((state) => state.upsertService);
  const removeService = useConfigStore((state) => state.removeService);
  const selectedService =
    services.find((service) => service.id === serviceManagerSelectedId) || services[0];

  const [showApiKey, setShowApiKey] = useState(false);

  function handleServiceChange<K extends keyof typeof selectedService.model>(
    field: K,
    value: (typeof selectedService.model)[K],
  ) {
    upsertService({
      id: selectedService.id,
      model: {
        ...selectedService.model,
        [field]: value,
      },
    });
  }

  function handleProviderSelectionChange(selection: typeof selectedService.model.providerSelection) {
    const nextConfig =
      selection === 'anthropic'
        ? { provider: 'anthropic' as const, endpointMode: 'chat_completions' as const }
        : selection === 'gemini'
        ? { provider: 'gemini' as const, endpointMode: 'chat_completions' as const }
        : selection === 'openai_responses'
        ? { provider: 'openai' as const, endpointMode: 'responses' as const }
        : { provider: 'openai' as const, endpointMode: 'chat_completions' as const };

    upsertService({
      id: selectedService.id,
      model: {
        ...selectedService.model,
        providerSelection: selection,
        provider: nextConfig.provider,
        endpointMode: nextConfig.endpointMode,
      },
    });
  }

  return (
    <div className="grid min-w-0 items-stretch gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col space-y-3">
        <Button
          type="button"
          onPress={() => upsertService({ name: '新服务' })}
          variant="ghost"
          aria-label="新建服务"
          className="h-10 w-full justify-start gap-2 rounded-full border border-border bg-transparent px-3 py-2 text-sm font-medium text-foreground/85 hover:border-foreground/20 hover:bg-muted/60 hover:text-foreground"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium">新建服务</span>
        </Button>
        <ScrollShadow className="min-h-0 flex-1 overflow-y-auto" size={20}>
          <div className="space-y-0.5">
            {services.map((service) => (
              <div key={service.id} className="group relative min-w-0">
                <button
                  type="button"
                  onClick={() => setServiceManagerSelectedId(service.id)}
                  className={`flex w-full touch-manipulation flex-col items-start gap-1 rounded-lg px-3 py-2.5 pr-10 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20 ${
                    service.id === selectedService.id
                      ? 'bg-foreground/[0.08]'
                      : 'hover:bg-foreground/[0.05]'
                  }`}
                >
                  <span className="w-full truncate text-sm font-medium text-foreground">
                    {service.name || '未命名服务'}
                  </span>
                  <span className="w-full truncate text-[11px] text-mutedForeground/70">
                    {providerLabels[service.model.providerSelection]}
                  </span>
                </button>
                {services.length > 1 && (
                  <button
                    type="button"
                    aria-label={`删除服务 ${service.name || '未命名服务'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeService(service.id);
                    }}
                    className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md p-1.5 text-mutedForeground opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                    title="删除服务"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </ScrollShadow>
      </div>

      <div className="min-w-0 space-y-5 border-t border-border/50 pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <div className="grid min-w-0 gap-2 text-xs">
          <label htmlFor="service-name" className="px-4 text-mutedForeground">名称</label>
          <Input
            id="service-name"
            name="service-name"
            autoComplete="off"
            fullWidth
            className={settingsInputClassName}
            placeholder="输入服务名称…"
            value={selectedService.name}
            onChange={(event) =>
              upsertService({
                id: selectedService.id,
                name: event.currentTarget.value,
              })
            }
          />
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="grid min-w-0 gap-2 text-xs">
            <label id="service-provider-label" className="px-4 text-mutedForeground">类型</label>
            <Select
              aria-labelledby="service-provider-label"
              fullWidth
              selectedKey={selectedService.model.providerSelection}
              onSelectionChange={(key) => {
                if (key) {
                  handleProviderSelectionChange(
                    String(key) as typeof selectedService.model.providerSelection,
                  );
                }
              }}
            >
              <Select.Trigger className={settingsSelectTriggerClassName}>
                <Select.Value className={settingsSelectValueClassName}>
                  {providerLabels[selectedService.model.providerSelection]}
                </Select.Value>
                <Select.Indicator className={settingsSelectIndicatorClassName}>
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Select.Indicator>
              </Select.Trigger>
              <Select.Popover className={settingsSelectPopoverClassName}>
                <ListBox aria-label="服务类型" className={settingsSelectListBoxClassName}>
                  {providerOptions.map((option) => (
                    <ListBox.Item
                      key={option.value}
                      id={option.value}
                      textValue={option.label}
                      className={settingsSelectItemClassName}
                    >
                      <span className="block w-full truncate text-left">{option.label}</span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <div className="grid min-w-0 gap-2 text-xs">
            <label htmlFor="service-api-url" className="px-4 text-mutedForeground">地址</label>
            <Input
              id="service-api-url"
              name="service-api-url"
              autoComplete="off"
              fullWidth
              className={settingsInputClassName}
              placeholder="输入 API 地址，例如 https://api.openai.com…"
              value={selectedService.model.apiUrl}
              onChange={(event) => handleServiceChange('apiUrl', event.currentTarget.value)}
            />
          </div>
          <div className="grid min-w-0 gap-2 text-xs">
            <label htmlFor="service-api-key" className="px-4 text-mutedForeground">Key</label>
            <div className="relative min-w-0">
              <Input
                id="service-api-key"
                name="service-api-key"
                autoComplete="off"
                spellCheck={false}
                fullWidth
                className={`${settingsInputClassName} !pr-10`}
                type="text"
                placeholder="输入 API 密钥…"
                style={showApiKey ? undefined : ({ WebkitTextSecurity: 'disc' } as CSSProperties)}
                value={selectedService.model.apiKey}
                onChange={(event) => handleServiceChange('apiKey', event.currentTarget.value)}
              />
              <button
                type="button"
                aria-label={showApiKey ? '隐藏密钥' : '显示密钥'}
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-mutedForeground/60 transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/20"
                title={showApiKey ? '隐藏密钥' : '显示密钥'}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
