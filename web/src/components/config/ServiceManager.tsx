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
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="pr-3">
          <Button
            onClick={() => upsertService({ name: '新服务' })}
            className="h-11 w-full gap-2 rounded-xl border-0 bg-muted/80 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            <span className="font-medium">新建服务</span>
          </Button>
        </div>
        <ScrollArea className="max-h-[360px] pr-3">
          <div className="space-y-2">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => setServiceManagerSelectedId(service.id)}
                className={`inline-flex h-auto w-full touch-manipulation justify-start rounded-xl px-4 py-4 text-left focus-visible:outline-none ${
                  service.id === selectedService.id
                    ? 'bg-foreground/[0.08]'
                    : 'bg-foreground/[0.045] shadow-[0_1px_0_rgba(255,255,255,0.02)_inset] transition-colors hover:bg-foreground/[0.06]'
                }`}
              >
                <div className="flex w-full min-w-0 flex-col items-start gap-1.5">
                  <div className="w-full truncate text-sm font-normal text-foreground">
                    {service.name || '未命名服务'}
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <div
                      className={`truncate rounded-full px-2 py-0.5 text-xs font-normal text-mutedForeground ${
                        service.id === selectedService.id
                          ? 'bg-background/85'
                          : 'bg-background/65'
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

      <div className="space-y-5 rounded-xl bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-medium tracking-tight text-foreground">当前</h3>
          {services.length > 1 ? (
            <Button variant="ghost" size="xs" onClick={() => removeService(selectedService.id)} className="shrink-0">
              删除
            </Button>
          ) : null}
        </div>
        <label className="grid gap-2 text-xs">
          <span className="text-mutedForeground">名称</span>
          <Input
            className="border-0 bg-muted"
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
              <SelectTrigger className="border-0 bg-muted shadow-none">
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
              className="border-0 bg-muted"
              value={selectedService.model.apiUrl}
              onChange={(event) => handleServiceChange('apiUrl', event.currentTarget.value)}
            />
          </label>
          <label className="grid gap-2 text-xs">
            <span className="text-mutedForeground">Key</span>
            <Input
              className="border-0 bg-muted"
              type="password"
              value={selectedService.model.apiKey}
              onChange={(event) => handleServiceChange('apiKey', event.currentTarget.value)}
            />
          </label>
          <label className="grid gap-2 text-xs">
            <span className="text-mutedForeground">模型</span>
            <Input
              className="border-0 bg-muted"
              value={selectedService.model.model}
              onChange={(event) => handleServiceChange('model', event.currentTarget.value)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
