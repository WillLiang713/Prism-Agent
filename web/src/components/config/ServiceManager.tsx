import { Plus } from 'lucide-react';
import { useConfigStore } from '../../store/configStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const providerLabels = {
  openai_chat: 'OpenAI Chat',
  openai_responses: 'OpenAI Responses',
  anthropic: 'Anthropic Messages',
  gemini: 'Google Gemini',
} as const;

import { ScrollArea } from '../ui/scroll-area';

export function ServiceManager() {
  const services = useConfigStore((state) => state.services);
  const serviceManagerSelectedId = useConfigStore((state) => state.serviceManagerSelectedId);
  const setServiceManagerSelectedId = useConfigStore((state) => state.setServiceManagerSelectedId);
  const upsertService = useConfigStore((state) => state.upsertService);
  const removeService = useConfigStore((state) => state.removeService);
  const selectedService =
    services.find((service) => service.id === serviceManagerSelectedId) || services[0];

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
    <div className="grid items-stretch gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex min-h-[520px] flex-col space-y-5 rounded-2xl border border-border/60 bg-background/68 p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] dark:bg-background/24">
        <div>
          <Button
            onClick={() => upsertService({ name: '新服务' })}
            className="h-12 w-full gap-2 rounded-2xl border-0 bg-background/70 text-sm text-foreground transition-colors hover:bg-background/85 dark:bg-background/35 dark:hover:bg-background/45"
          >
            <Plus className="h-4 w-4" />
            <span className="font-medium">新建服务</span>
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => setServiceManagerSelectedId(service.id)}
                className={`inline-flex min-h-[88px] w-full touch-manipulation justify-start rounded-2xl border border-border/60 px-5 py-5 text-left transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20 ${
                  service.id === selectedService.id
                    ? 'border-border/80 bg-background/92 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] dark:bg-background/52'
                    : 'bg-background/76 shadow-[0_1px_0_rgba(255,255,255,0.02)_inset] hover:border-border/75 hover:bg-background/88 dark:bg-background/34 dark:hover:bg-background/42'
                }`}
              >
                <div className="flex w-full min-w-0 flex-col items-start gap-1.5">
                  <div className="w-full truncate text-[15px] font-medium text-foreground">
                    {service.name || '未命名服务'}
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <div
                      className={`truncate rounded-full px-2.5 py-1 text-xs font-normal text-mutedForeground ${
                        service.id === selectedService.id
                          ? 'bg-background'
                          : 'bg-background/80 dark:bg-background/55'
                      }`}
                    >
                      {providerLabels[service.model.providerSelection]}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="min-h-[520px] space-y-5 rounded-2xl border border-border/60 bg-background/70 p-6 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] dark:bg-background/30">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold tracking-tight text-foreground">当前</h3>
          {services.length > 1 ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => removeService(selectedService.id)}
              className="shrink-0"
            >
              删除
            </Button>
          ) : null}
        </div>
        <label className="grid gap-2 text-xs">
          <span className="text-mutedForeground">名称</span>
          <Input
            className="border-0 bg-muted/90 dark:bg-muted/75"
            value={selectedService.name}
            onChange={(event) =>
              upsertService({
                id: selectedService.id,
                name: event.currentTarget.value,
              })
            }
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-xs">
            <span className="text-mutedForeground">类型</span>
            <Select
              value={selectedService.model.providerSelection}
              onValueChange={(value) =>
                handleProviderSelectionChange(
                  value as typeof selectedService.model.providerSelection,
                )
              }
            >
              <SelectTrigger className="border-0 bg-muted/90 shadow-none dark:bg-muted/75">
                <SelectValue placeholder="选择服务类型" />
              </SelectTrigger>
              <SelectContent className="border-0">
                <SelectItem value="openai_chat">OpenAI Chat</SelectItem>
                <SelectItem value="openai_responses">OpenAI Responses</SelectItem>
                <SelectItem value="anthropic">Anthropic Messages</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-2 text-xs">
            <span className="text-mutedForeground">地址</span>
            <Input
              className="border-0 bg-muted/90 dark:bg-muted/75"
              value={selectedService.model.apiUrl}
              onChange={(event) => handleServiceChange('apiUrl', event.currentTarget.value)}
            />
          </label>
          <label className="grid gap-2 text-xs">
            <span className="text-mutedForeground">Key</span>
            <Input
              className="border-0 bg-muted/90 dark:bg-muted/75"
              type="password"
              value={selectedService.model.apiKey}
              onChange={(event) => handleServiceChange('apiKey', event.currentTarget.value)}
            />
          </label>
          <label className="grid gap-2 text-xs">
            <span className="text-mutedForeground">模型</span>
            <Input
              className="border-0 bg-muted/90 dark:bg-muted/75"
              value={selectedService.model.model}
              onChange={(event) => handleServiceChange('model', event.currentTarget.value)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
