import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { ListBox } from '@heroui/react/list-box';
import { Popover } from '@heroui/react/popover';
import { ScrollShadow } from '@heroui/react/scroll-shadow';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { agentListModels } from '../client';
import { resolveSelectedService, useConfigStore } from '../../store/configStore';
import { cn } from '../../lib/utils';
import { composerControlIcons } from './composerControlIcons';

const modelPickerTriggerClassName =
  'no-drag grid !h-8 !min-h-8 !max-h-8 min-w-[120px] max-w-[240px] shrink-0 cursor-pointer grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-2 overflow-hidden rounded-full border border-border bg-card px-3 !py-0 text-xs font-medium leading-none text-foreground shadow-none transition-[background-color,border-color,color,box-shadow] hover:bg-muted focus-visible:ring-1 focus-visible:ring-foreground/20';

const modelPickerIconClassName =
  'h-4 w-4 shrink-0 justify-self-center text-mutedForeground';

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fetchedForServiceRef = useRef<string | null>(null);
  const filteredModelOptions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return modelOptions;
    }
    return modelOptions.filter((option) => option.toLowerCase().includes(keyword));
  }, [modelOptions, search]);

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
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        className={modelPickerTriggerClassName}
      >
        <ModelIcon aria-hidden="true" className={modelPickerIconClassName} />
        <span className="min-w-0 truncate text-center">
          {currentModel || '选择模型'}
        </span>
        <ChevronDown className={modelPickerIconClassName} aria-hidden="true" />
      </Button>
      <Popover.Content
        placement="top"
        offset={6}
        className="z-50 w-[248px] overflow-hidden rounded-xl border border-border bg-muted p-1 text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
      >
        <Popover.Dialog className="flex flex-col outline-none">
          <div className="flex items-center gap-1 px-1">
            <Input
              aria-label="搜索主模型"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="搜索模型…"
              autoComplete="off"
              spellCheck={false}
              className="h-8 w-full rounded-md bg-transparent px-2 text-sm text-foreground placeholder:text-mutedForeground outline-none"
            />
            <button
              type="button"
              onClick={() => void refreshList()}
              disabled={loading}
              title="获取模型列表"
              aria-label="获取模型列表"
              className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-mutedForeground/80 hover:bg-card hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>
          <ScrollShadow className="mt-1 max-h-72 overflow-y-auto" size={16}>
            {filteredModelOptions.length === 0 ? (
              <div className="py-3 text-center text-xs text-mutedForeground">
                {loading ? '获取中…' : modelOptions.length === 0 ? '点击右上角获取模型列表' : '无匹配项'}
              </div>
            ) : (
              <ListBox
                aria-label="主模型"
                onAction={(key) => handlePick(String(key))}
                className="p-1"
              >
                {filteredModelOptions.map((option) => (
                  <ListBox.Item
                    key={option}
                    id={option}
                    textValue={option}
                    className="flex cursor-pointer select-none items-center justify-center rounded-md px-2 py-1.5 text-center text-sm text-foreground outline-none transition-colors hover:bg-card data-[focused]:bg-card"
                  >
                    <span className="block w-full truncate text-center font-mono font-normal lowercase">{option}</span>
                  </ListBox.Item>
                ))}
              </ListBox>
            )}
          </ScrollShadow>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
