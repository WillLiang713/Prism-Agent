import { useEffect, useMemo, useState } from 'react';

import { agentListModels } from '../../agent/client';
import { composerControlIcons } from '../../agent/components/composerControlIcons';
import { ModelPickerPopover, type ModelPickerGroup } from '../model/ModelPickerPopover';
import { resolveSelectedService, useConfigStore } from '../../store/configStore';

interface ServiceModelGroup {
  serviceId: string;
  serviceName: string;
  models: string[];
}

type TitleModelGroup = ModelPickerGroup & {
  serviceId: string;
};

const modelPickerIconClassName =
  'h-4 w-4 shrink-0 text-mutedForeground/65 transition-colors group-hover:text-foreground/70';

const modelPickerTriggerClassName =
  'group h-11 min-h-11 w-full border-border/80 bg-background/35 px-4 py-0 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)] hover:border-foreground/20 hover:bg-muted/35 focus-visible:border-foreground/25 focus-visible:bg-card';

const modelPickerValueClassName =
  'self-center text-left text-sm font-medium leading-none';

export function GeneralSettings() {
  const ModelIcon = composerControlIcons.model;
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
  const titleModelGroups = useMemo<TitleModelGroup[]>(
    () =>
      serviceModelGroups.map((group) => ({
        id: group.serviceId,
        serviceId: group.serviceId,
        label: group.serviceName,
        models: group.models,
      })),
    [serviceModelGroups],
  );

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
      <div className="grid min-w-0 max-w-[24rem] gap-2 text-xs">
        <div className="flex min-w-0 items-center gap-2 px-4">
          <span className="shrink-0 text-mutedForeground">标题模型</span>
          {error ? (
            <span
              aria-live="polite"
              className="min-w-0 truncate text-[11px] text-danger/80"
              title={error}
            >
              {error}
            </span>
          ) : success ? (
            <span
              aria-live="polite"
              className="min-w-0 truncate text-[11px] text-success/80 dark:text-success"
              title={success}
            >
              {success}
            </span>
          ) : null}
        </div>

        <ModelPickerPopover
          open={open}
          onOpenChange={setOpen}
          value={displayModel}
          placeholder={placeholder}
          groups={titleModelGroups}
          search={search}
          onSearchChange={(next) => {
            setSearch(next);
            updateRuntimeModelConfig({ titleModel: next, titleModelServiceId: '' });
          }}
          onSelect={(model, group) => handleSelectModel((group as TitleModelGroup).serviceId, model)}
          onRefresh={() => void refreshAllModels()}
          loading={loading}
          triggerAriaLabel={displayModel ? `当前标题模型：${displayModel}，点击切换` : '选择标题模型'}
          searchAriaLabel="搜索标题模型"
          searchName="title-model-search"
          listAriaLabel="模型"
          leadingIcon={<ModelIcon aria-hidden="true" className={modelPickerIconClassName} />}
          placement="bottom start"
          offset={4}
          triggerClassName={modelPickerTriggerClassName}
          triggerIconClassName={modelPickerIconClassName}
          triggerValueClassName={modelPickerValueClassName}
          contentClassName="w-[min(24rem,calc(100vw-1.5rem))]"
        />
      </div>
    </div>
  );
}
