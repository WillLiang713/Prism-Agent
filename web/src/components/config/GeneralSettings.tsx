import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { ListBox } from '@heroui/react/list-box';
import { Popover } from '@heroui/react/popover';
import { ScrollShadow } from '@heroui/react/scroll-shadow';
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentService = resolveSelectedService(services, serviceManagerSelectedId);
  const displayModel = runtimeModelConfig.titleModel || '';
  const placeholder =
    currentService?.model.titleModel ||
    currentService?.model.model ||
    '跟随服务默认模型';
  const filteredServiceModelGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return serviceModelGroups;
    }

    return serviceModelGroups
      .map((group) => ({
        ...group,
        models: group.models.filter((model) => model.toLowerCase().includes(keyword)),
      }))
      .filter((group) => group.models.length > 0);
  }, [search, serviceModelGroups]);

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

  return (
    <div className="min-w-0 space-y-5 pt-6 md:pt-0">
      <div className="grid min-w-0 gap-2 text-xs">
        <div className="flex min-w-0 items-center justify-between gap-2 px-4">
          <span className="shrink-0 text-mutedForeground">标题模型</span>
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
              className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-mutedForeground/80 hover:text-foreground disabled:cursor-default disabled:opacity-50"
              title="从所有服务获取模型列表"
            >
              <RefreshCw
                className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {loading ? '获取中…' : '获取'}
            </button>
          </div>
        </div>

        <Popover isOpen={open} onOpenChange={setOpen}>
          <Button
            ref={triggerRef}
            type="button"
            variant="secondary"
            className="flex h-11 min-w-0 w-full cursor-pointer items-center justify-between gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors hover:bg-muted"
          >
            <span
              className={cn(
                'min-w-0 truncate',
                !displayModel && 'text-mutedForeground',
                displayModel && 'font-mono lowercase',
              )}
            >
              {displayModel || placeholder}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
          </Button>
          <Popover.Content
            placement="bottom start"
            offset={4}
            style={{ width: triggerRef.current?.offsetWidth }}
            className="z-50 overflow-hidden rounded-xl border border-border bg-muted !p-0 text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
          >
            <Popover.Dialog className="!p-0 outline-none">
              <Input
                aria-label="搜索标题模型"
                value={search}
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  setSearch(next);
                  updateRuntimeModelConfig({ titleModel: next, titleModelServiceId: '' });
                }}
                placeholder="搜索模型…"
                autoComplete="off"
                spellCheck={false}
                className="!h-10 !w-full !rounded-none !border-0 !bg-transparent !px-4 !py-0 !text-sm !text-foreground !shadow-none placeholder:!text-mutedForeground outline-none focus:!bg-transparent"
              />
              <ScrollShadow className="max-h-64 overflow-y-auto border-t border-border/40" size={16}>
                {filteredServiceModelGroups.length === 0 ? (
                  <div className="py-8 text-center text-xs text-mutedForeground">
                    无匹配项
                  </div>
                ) : (
                  filteredServiceModelGroups.map((group) => (
                    <div key={group.serviceId}>
                      <div className="px-3 py-1.5 text-[11px] font-medium uppercase text-mutedForeground/60">
                        {group.serviceName}
                      </div>
                      <ListBox
                        aria-label={`${group.serviceName} 模型`}
                        onAction={(key) => handleSelectModel(group.serviceId, String(key))}
                        className="p-1"
                      >
                        {group.models.map((model) => (
                          <ListBox.Item
                            key={`${group.serviceId}:${model}`}
                            id={model}
                            textValue={model}
                            className="flex w-full cursor-pointer select-none items-center justify-center rounded-full px-3 py-2 text-center text-sm text-foreground outline-none transition-colors hover:bg-card data-[focused]:bg-card"
                          >
                            <span className="block w-full truncate text-center font-mono lowercase">
                              {model}
                            </span>
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </div>
                  ))
                )}
              </ScrollShadow>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>
    </div>
  );
}
