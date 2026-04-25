import { useEffect, useState } from 'react';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { ChevronDown, RefreshCw } from 'lucide-react';

import { agentListModels } from '../../agent/client';
import { cn } from '../../lib/utils';
import { resolveSelectedService, useConfigStore } from '../../store/configStore';

interface ServiceModelGroup {
  serviceId: string;
  serviceName: string;
  models: string[];
}

export function GeneralSettings() {
  const runtimeModelConfig = useConfigStore((state) => state.runtimeModelConfig);
  const services = useConfigStore((state) => state.services);
  const serviceManagerSelectedId = useConfigStore((state) => state.serviceManagerSelectedId);
  const updateRuntimeModelConfig = useConfigStore((state) => state.updateRuntimeModelConfig);

  const [serviceModelGroups, setServiceModelGroups] = useState<ServiceModelGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const currentService = resolveSelectedService(services, serviceManagerSelectedId);
  const displayModel = runtimeModelConfig.titleModel || '';
  const placeholder =
    currentService?.model.titleModel ||
    currentService?.model.model ||
    '跟随服务默认模型';

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  useEffect(() => {
    const hasConfigured = services.some((s) => s.model.apiKey && s.model.apiUrl);
    if (hasConfigured) {
      void refreshAllModels({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services.length]);

  async function refreshAllModels(options: { silent?: boolean } = {}) {
    if (!options.silent) setLoading(true);
    setError(null);
    setSuccess(null);

    const groups: ServiceModelGroup[] = [];
    let totalModels = 0;

    try {
      const results = await Promise.allSettled(
        services
          .filter((s) => s.model.apiKey && s.model.apiUrl)
          .map(async (service) => {
            const result = await agentListModels({
              providerSelection: service.model.providerSelection,
              apiUrl: service.model.apiUrl,
              apiKey: service.model.apiKey,
            });
            return {
              serviceId: service.id,
              serviceName: service.name || '未命名服务',
              models: result.models.map((m) => m.id),
            };
          }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          groups.push(result.value);
          totalModels += result.value.models.length;
        }
      }

      setServiceModelGroups(groups);

      if (!options.silent) {
        setSuccess(`已获取 ${totalModels} 个模型`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  function handleSelectModel(serviceId: string, model: string) {
    updateRuntimeModelConfig({
      titleModelServiceId: serviceId,
      titleModel: model,
    });
    setOpen(false);
  }

  const selectedServiceId = runtimeModelConfig.titleModelServiceId;

  return (
    <div className="space-y-5 pt-6 md:pt-0">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)] md:items-center">
        <div className="space-y-1">
          <span className="text-xs font-medium text-foreground">标题模型</span>
          <p className="max-w-md text-[11px] leading-5 text-mutedForeground">
            用于生成会话标题；留空时跟随当前服务的默认模型
          </p>
        </div>
        <div className="min-w-0">
          <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              className="relative flex h-11 w-full cursor-pointer items-center overflow-hidden rounded-full border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-foreground/20"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'invisible block max-w-full truncate px-6',
                  !displayModel && 'text-mutedForeground',
                  displayModel && 'font-mono lowercase tracking-tight',
                )}
              >
                {displayModel || placeholder}
              </span>
              <span
                className={cn(
                  'pointer-events-none absolute left-1/2 top-1/2 max-w-[calc(100%-3.5rem)] -translate-x-1/2 -translate-y-1/2 truncate text-center',
                  !displayModel && 'text-mutedForeground',
                  displayModel && 'font-mono lowercase tracking-tight',
                )}
              >
                {displayModel || placeholder}
              </span>
              <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
            </button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="start"
              sideOffset={4}
              collisionPadding={12}
              className="z-50 w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-muted p-1 text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
            >
              <Command shouldFilter={true} className="flex flex-col">
                <div className="flex items-center gap-1 border-b border-border/50 px-2 py-1">
                  <Command.Input
                    aria-label="搜索标题模型"
                    name="title-model-search"
                    autoComplete="off"
                    value={search}
                    onValueChange={(next) => {
                      setSearch(next);
                      updateRuntimeModelConfig({ titleModel: next, titleModelServiceId: '' });
                    }}
                    placeholder="搜索模型…"
                    className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm text-foreground placeholder:text-mutedForeground outline-none"
                  />
                  {error ? (
                    <span
                      aria-live="polite"
                      className="shrink-0 truncate text-[11px] text-danger/80"
                      title={error}
                    >
                      {error}
                    </span>
                  ) : success ? (
                    <span
                      aria-live="polite"
                      className="shrink-0 truncate text-[11px] text-success/80 dark:text-success"
                      title={success}
                    >
                      {success}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => refreshAllModels()}
                    disabled={loading}
                    className="flex shrink-0 items-center justify-center rounded-md p-1 text-mutedForeground/80 outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/20 disabled:opacity-50"
                    title="从所有服务获取模型列表"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>
                <Command.List
                  className="mt-1 max-h-64 overflow-y-auto"
                  onWheel={(e) => {
                    e.currentTarget.scrollTop += e.deltaY;
                  }}
                >
                  <Command.Empty className="py-3 text-center text-xs text-mutedForeground">
                    无匹配项
                  </Command.Empty>
                  {serviceModelGroups.map((group) => (
                    <Command.Group
                      key={group.serviceId}
                    >
                      {group.models.map((model) => (
                        <Command.Item
                          key={`${group.serviceId}:${model}`}
                          value={`${group.serviceName} ${model}`}
                          onSelect={() => handleSelectModel(group.serviceId, model)}
                          className="flex w-full cursor-pointer select-none items-center rounded-full px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-card data-[selected=true]:bg-card"
                        >
                          <span className="block w-full truncate font-mono lowercase tracking-tight">
                            {model}
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ))}
                </Command.List>
              </Command>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
          </div>
        </div>
      </div>
    );
  }
