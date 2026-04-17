import { Plus, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { agentListModels } from '../../agent/client';
import { useConfigStore } from '../../store/configStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Combobox } from '../ui/combobox';
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

  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelListLoading, setModelListLoading] = useState(false);
  const [modelListError, setModelListError] = useState<string | null>(null);

  useEffect(() => {
    setModelOptions([]);
    setModelListError(null);
    if (selectedService?.model.apiKey && selectedService?.model.apiUrl) {
      void refreshModelList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService?.id]);

  async function refreshModelList() {
    if (!selectedService) return;
    setModelListLoading(true);
    setModelListError(null);
    try {
      const result = await agentListModels({
        providerSelection: selectedService.model.providerSelection,
        apiUrl: selectedService.model.apiUrl,
        apiKey: selectedService.model.apiKey,
      });
      setModelOptions(result.models.map((m) => m.id));
    } catch (error) {
      setModelListError(error instanceof Error ? error.message : String(error));
      setModelOptions([]);
    } finally {
      setModelListLoading(false);
    }
  }

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
    <div className="grid items-stretch gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="flex min-h-[520px] flex-col space-y-3">
        <Button
          onClick={() => upsertService({ name: '新服务' })}
          variant="ghost"
          className="h-10 w-full justify-start gap-2 rounded-lg text-sm text-mutedForeground hover:bg-muted/60 hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          <span className="font-medium">新建服务</span>
        </Button>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-0.5">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => setServiceManagerSelectedId(service.id)}
                className={`group flex w-full touch-manipulation flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20 ${
                  service.id === selectedService.id
                    ? 'bg-muted'
                    : 'hover:bg-muted/60'
                }`}
              >
                <div className="w-full truncate text-sm font-medium text-foreground">
                  {service.name || '未命名服务'}
                </div>
                <div className="truncate text-[11px] text-mutedForeground/70">
                  {providerLabels[service.model.providerSelection]}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="min-h-[520px] space-y-5 border-l border-border/50 pl-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">当前</h3>
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
          <div className="grid gap-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-mutedForeground">模型</span>
              <div className="flex min-w-0 items-center gap-2">
                {modelListError ? (
                  <span
                    className="max-w-[140px] truncate text-[11px] text-danger/80"
                    title={modelListError}
                  >
                    {modelListError}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => refreshModelList()}
                  disabled={modelListLoading}
                  className="flex shrink-0 items-center gap-1 text-[11px] text-mutedForeground/80 hover:text-foreground disabled:opacity-50"
                  title="从端点获取模型列表"
                >
                  <RefreshCw className={`h-3 w-3 ${modelListLoading ? 'animate-spin' : ''}`} />
                  {modelListLoading ? '获取中' : '获取'}
                </button>
              </div>
            </div>
            <Combobox
              value={selectedService.model.model}
              onValueChange={(next) => handleServiceChange('model', next)}
              options={modelOptions}
              placeholder="选择或输入模型…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
