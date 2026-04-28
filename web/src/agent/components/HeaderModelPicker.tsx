import { useEffect, useMemo, useRef, useState } from 'react';

import { agentListModels } from '../client';
import { ModelPickerPopover } from '../../components/model/ModelPickerPopover';
import { resolveSelectedService, useConfigStore } from '../../store/configStore';
import { composerControlIcons } from './composerControlIcons';

const modelPickerTriggerClassName =
  'no-drag grid !h-8 !min-h-8 !max-h-8 min-w-[120px] max-w-[240px] shrink-0 cursor-pointer grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-2 overflow-hidden rounded-full border border-border bg-card px-3 !py-0 !text-[12px] font-medium leading-none text-foreground shadow-none transition-[background-color,border-color,color,box-shadow] hover:bg-muted focus-visible:ring-1 focus-visible:ring-foreground/20';

const modelPickerIconClassName =
  'h-4 w-4 shrink-0 justify-self-center text-mutedForeground';

const modelPickerChevronClassName =
  'h-3.5 w-3.5 shrink-0 justify-self-center text-mutedForeground';

export function HeaderModelPicker({ currentModel }: { currentModel: string }) {
  const ModelIcon = composerControlIcons.model;
  const services = useConfigStore((state) => state.services);
  const serviceManagerSelectedId = useConfigStore((state) => state.serviceManagerSelectedId);
  const upsertService = useConfigStore((state) => state.upsertService);

  const selectedService = resolveSelectedService(services, serviceManagerSelectedId);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedForServiceRef = useRef<string | null>(null);
  const modelGroups = useMemo(
    () => [
      {
        id: selectedService?.id ?? 'current',
        models: modelOptions,
      },
    ],
    [modelOptions, selectedService?.id],
  );

  useEffect(() => {
    setModelOptions([]);
    fetchedForServiceRef.current = null;
  }, [selectedService?.id]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  useEffect(() => {
    if (!selectedService) return;
    if (fetchedForServiceRef.current === selectedService.id) return;
    if (loading) return;
    if (!selectedService.model.apiKey || !selectedService.model.apiUrl) return;
    void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedService?.id,
    selectedService?.model.apiKey,
    selectedService?.model.apiUrl,
    open,
  ]);

  async function refreshList() {
    if (!selectedService) return;
    setLoading(true);
    try {
      const result = await agentListModels({
        providerSelection: selectedService.model.providerSelection,
        apiUrl: selectedService.model.apiUrl,
        apiKey: selectedService.model.apiKey,
      });
      setModelOptions(result.models.map((m) => m.id));
      fetchedForServiceRef.current = selectedService.id;
    } catch {
      setModelOptions([]);
    } finally {
      setLoading(false);
    }
  }

  function handlePick(modelId: string) {
    if (!selectedService) return;
    upsertService({
      id: selectedService.id,
      model: { ...selectedService.model, model: modelId },
    });
    setOpen(false);
  }

  if (!currentModel && !selectedService) {
    return null;
  }

  return (
    <ModelPickerPopover
      open={open}
      onOpenChange={setOpen}
      value={currentModel}
      placeholder="选择模型"
      groups={modelGroups}
      search={search}
      onSearchChange={setSearch}
      onSelect={(modelId) => handlePick(modelId)}
      onRefresh={() => void refreshList()}
      loading={loading}
      triggerAriaLabel={currentModel ? `当前模型：${currentModel}，点击切换` : '选择模型'}
      searchAriaLabel="搜索主模型"
      searchName="main-model-search"
      listAriaLabel="主模型"
      leadingIcon={<ModelIcon aria-hidden="true" className={modelPickerIconClassName} />}
      placement="top"
      offset={6}
      triggerClassName={modelPickerTriggerClassName}
      triggerIconClassName={modelPickerIconClassName}
      triggerChevronClassName={modelPickerChevronClassName}
      triggerValueClassName="!text-[12px] leading-none"
      inputClassName="text-[13px] leading-5"
      itemClassName="text-[13px] leading-5"
      contentClassName="w-[248px]"
    />
  );
}
