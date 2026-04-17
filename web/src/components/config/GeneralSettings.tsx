import { useEffect, useRef, useState } from 'react';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronDown, RefreshCw } from 'lucide-react';

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
  const triggerRef = useRef<HTMLButtonElement>(null);

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
      <div className="grid gap-2 text-xs">
        <div className="flex items-center justify-between gap-2 px-4">
          <span className="text-mutedForeground">标题模型</span>
          <div className="flex min-w-0 items-center gap-2">
            {error ? (
              <span
                className="max-w-[160px] truncate text-[11px] text-danger/80"
                title={error}
              >
                {error}
              </span>
            ) : success ? (
              <span
                className="max-w-[160px] truncate text-[11px] text-success/80 dark:text-success"
                title={success}
              >
                {success}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => refreshAllModels()}
              disabled={loading}
              className="flex shrink-0 items-center gap-1 text-[11px] text-mutedForeground/80 hover:text-foreground disabled:opacity-50"
              title="从所有服务获取模型列表"
            >
              <RefreshCw
                className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}
              />
              {loading ? '获取中' : '获取'}
            </button>
          </div>
        </div>

        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
          <PopoverPrimitive.Trigger asChild>
            <button
              ref={triggerRef}
              type="button"
              className="flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors"
            >
              <span
                className={cn(
                  'truncate',
                  !displayModel && 'text-mutedForeground',
                  displayModel && 'font-mono lowercase tracking-tight',
                )}
              >
                {displayModel || placeholder}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="start"
              sideOffset={4}
              style={{ width: triggerRef.current?.offsetWidth }}
              className="z-50 overflow-hidden rounded-xl border border-border bg-muted p-1 text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
            >
              <Command shouldFilter={true} className="flex flex-col">
                <Command.Input
                  value={search}
                  onValueChange={(next) => {
                    setSearch(next);
                    updateRuntimeModelConfig({ titleModel: next, titleModelServiceId: '' });
                  }}
                  placeholder="搜索模型…"
                  className="h-8 w-full rounded-md bg-transparent px-2 text-sm text-foreground placeholder:text-mutedForeground outline-none"
                />
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
                      heading={group.serviceName}
                      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-mutedForeground/60"
                    >
                      {group.models.map((model) => (
                        <Command.Item
                          key={`${group.serviceId}:${model}`}
                          value={`${group.serviceName} ${model}`}
                          onSelect={() => handleSelectModel(group.serviceId, model)}
                          className="relative flex w-full cursor-pointer select-none items-center rounded-full py-2 pl-8 pr-3 text-sm text-foreground outline-none transition-colors hover:bg-card data-[selected=true]:bg-card"
                        >
                          <span className="absolute left-3 flex h-3.5 w-3.5 items-center justify-center">
                            {runtimeModelConfig.titleModel === model &&
                              selectedServiceId === group.serviceId && (
                                <Check className="h-4 w-4" />
                              )}
                          </span>
                          <span className="truncate font-mono lowercase tracking-tight">
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
  );
}
