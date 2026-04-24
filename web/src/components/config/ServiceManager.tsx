import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
    <div className="grid items-stretch gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
      <div className="flex flex-col space-y-3">
        <Button
          onClick={() => upsertService({ name: '新服务' })}
          variant="ghost"
          className="h-10 w-full justify-start gap-2 rounded-full border border-border bg-transparent px-3 py-2 text-sm font-medium text-foreground/85 hover:border-foreground/20 hover:bg-muted/60 hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          <span className="font-medium">新建服务</span>
        </Button>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-0.5">
            {services.map((service) => (
              <div
                key={service.id}
                role="button"
                tabIndex={0}
                onClick={() => setServiceManagerSelectedId(service.id)}
                className={`group relative flex w-full touch-manipulation flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20 ${
                  service.id === selectedService.id
                    ? 'bg-foreground/[0.08]'
                    : 'hover:bg-foreground/[0.05]'
                }`}
              >
                <div className="w-full truncate pr-6 text-sm font-medium text-foreground">
                  {service.name || '未命名服务'}
                </div>
                <div className="truncate text-[11px] text-mutedForeground/70">
                  {providerLabels[service.model.providerSelection]}
                </div>
                {services.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeService(service.id);
                    }}
                    className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md p-1.5 text-mutedForeground opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                    title="删除服务"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="space-y-5 border-t border-border/50 pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0">

        <div className="grid gap-2 text-xs">
          <span className="px-4 text-mutedForeground">名称</span>
          <Input
            className="bg-card border border-border"
            placeholder="输入服务名称"
            value={selectedService.name}
            onChange={(event) =>
              upsertService({
                id: selectedService.id,
                name: event.currentTarget.value,
              })
            }
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2 text-xs">
            <span className="px-4 text-mutedForeground">类型</span>
            <Select
              value={selectedService.model.providerSelection}
              onValueChange={(value) =>
                handleProviderSelectionChange(
                  value as typeof selectedService.model.providerSelection,
                )
              }
            >
              <SelectTrigger className="bg-card border border-border">
                <SelectValue placeholder="选择服务类型" />
              </SelectTrigger>
              <SelectContent className="border-0">
                <SelectItem value="openai_chat">OpenAI Chat</SelectItem>
                <SelectItem value="openai_responses">OpenAI Responses</SelectItem>
                <SelectItem value="anthropic">Anthropic Messages</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 text-xs">
            <span className="px-4 text-mutedForeground">地址</span>
            <Input
              className="bg-card border border-border"
              placeholder="输入 API 地址，如 https://api.openai.com"
              value={selectedService.model.apiUrl}
              onChange={(event) => handleServiceChange('apiUrl', event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2 text-xs">
            <span className="px-4 text-mutedForeground">Key</span>
            <div className="relative">
            <Input
              className="bg-card border border-border pr-10"
              type="text"
              placeholder="输入 API 密钥"
              style={showApiKey ? undefined : { WebkitTextSecurity: 'disc' } as React.CSSProperties}
              value={selectedService.model.apiKey}
              onChange={(event) => handleServiceChange('apiKey', event.currentTarget.value)}
            />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mutedForeground/60 transition-colors hover:text-foreground"
                title={showApiKey ? '隐藏密钥' : '显示密钥'}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        

      </div>
    </div>
  );
}
