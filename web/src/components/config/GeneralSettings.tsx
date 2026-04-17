import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { agentListModels } from '../../agent/client';
import { resolveSelectedService, useConfigStore } from '../../store/configStore';
import { Combobox } from '../ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const FOLLOW_CURRENT_SERVICE_VALUE = '__follow_current_service__';

function SettingsSectionCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4">
      {title && <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">{title}</h3>}
      {children}
    </section>
  );
}

export function GeneralSettings() {
  const runtimeModelConfig = useConfigStore((state) => state.runtimeModelConfig);
  const services = useConfigStore((state) => state.services);
  const serviceManagerSelectedId = useConfigStore((state) => state.serviceManagerSelectedId);
  const updateRuntimeModelConfig = useConfigStore((state) => state.updateRuntimeModelConfig);

  const hasTitleServiceOverride = services.some(
    (service) => service.id === runtimeModelConfig.titleModelServiceId,
  );
  const fallbackServiceName =
    services.find((service) => service.id === serviceManagerSelectedId)?.name ||
    services[0]?.name ||
    '未命名服务';
  const titleServiceValue = hasTitleServiceOverride
    ? runtimeModelConfig.titleModelServiceId
    : FOLLOW_CURRENT_SERVICE_VALUE;

  const effectiveTitleService = hasTitleServiceOverride
    ? services.find((s) => s.id === runtimeModelConfig.titleModelServiceId) || null
    : resolveSelectedService(services, serviceManagerSelectedId);

  const [titleModelOptions, setTitleModelOptions] = useState<string[]>([]);
  const [titleModelLoading, setTitleModelLoading] = useState(false);
  const [titleModelError, setTitleModelError] = useState<string | null>(null);
  const [titleModelSuccess, setTitleModelSuccess] = useState<string | null>(null);

  useEffect(() => {
    setTitleModelOptions([]);
    setTitleModelError(null);
    setTitleModelSuccess(null);
    if (effectiveTitleService?.model.apiKey && effectiveTitleService?.model.apiUrl) {
      void refreshTitleModelList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTitleService?.id]);

  async function refreshTitleModelList(options: { silent?: boolean } = {}) {
    if (!effectiveTitleService) return;
    if (!options.silent) setTitleModelLoading(true);
    setTitleModelError(null);
    setTitleModelSuccess(null);
    try {
      const result = await agentListModels({
        providerSelection: effectiveTitleService.model.providerSelection,
        apiUrl: effectiveTitleService.model.apiUrl,
        apiKey: effectiveTitleService.model.apiKey,
      });
      setTitleModelOptions(result.models.map((m) => m.id));
      if (!options.silent) {
        setTitleModelSuccess(`已获取 ${result.models.length} 个模型`);
        setTimeout(() => setTitleModelSuccess(null), 3000);
      }
    } catch (error) {
      setTitleModelError(error instanceof Error ? error.message : String(error));
      setTitleModelOptions([]);
    } finally {
      if (!options.silent) setTitleModelLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <SettingsSectionCard>
        <div className="grid items-end gap-4 md:grid-cols-2">
          <div className="grid gap-2 text-xs">
            <span className="px-4 text-mutedForeground">标题模型服务</span>
            <Select
              value={titleServiceValue}
              onValueChange={(value) =>
                updateRuntimeModelConfig({
                  titleModelServiceId: value === FOLLOW_CURRENT_SERVICE_VALUE ? '' : value,
                })
              }
            >
              <SelectTrigger className="bg-card border border-border">
                <SelectValue placeholder="选择标题模型服务" />
              </SelectTrigger>
              <SelectContent className="border-0">
                <SelectItem value={FOLLOW_CURRENT_SERVICE_VALUE}>
                  跟随当前服务（{fallbackServiceName}）
                </SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name || '未命名服务'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 text-xs">
            <div className="flex items-center justify-between gap-2 px-4">
              <span className="text-mutedForeground">标题模型</span>
              <div className="flex min-w-0 items-center gap-2">
                {titleModelError ? (
                  <span
                    className="max-w-[160px] truncate text-[11px] text-danger/80"
                    title={titleModelError}
                  >
                    {titleModelError}
                  </span>
                ) : titleModelSuccess ? (
                  <span
                    className="max-w-[160px] truncate text-[11px] text-success/80 dark:text-success"
                    title={titleModelSuccess}
                  >
                    {titleModelSuccess}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => refreshTitleModelList()}
                  disabled={titleModelLoading || !effectiveTitleService}
                  className="flex shrink-0 items-center gap-1 text-[11px] text-mutedForeground/80 hover:text-foreground disabled:opacity-50"
                  title="从端点获取模型列表"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${titleModelLoading ? 'animate-spin' : ''}`}
                  />
                  {titleModelLoading ? '获取中' : '获取'}
                </button>
              </div>
            </div>
            <Combobox
              value={runtimeModelConfig.titleModel}
              onValueChange={(next) => updateRuntimeModelConfig({ titleModel: next })}
              options={titleModelOptions}
              placeholder={
                effectiveTitleService?.model.titleModel ||
                effectiveTitleService?.model.model ||
                '跟随服务默认模型'
              }
            />
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
