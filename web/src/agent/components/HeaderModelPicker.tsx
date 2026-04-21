import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { agentListModels } from '../client';
import { resolveSelectedService, useConfigStore } from '../../store/configStore';
import { cn } from '../../lib/utils';
import { composerControlIcons } from './composerControlIcons';

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
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className="no-drag inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
        >
          <ModelIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-mutedForeground" />
          <span className="truncate">{currentModel || '选择模型'}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-mutedForeground" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="center"
          side="top"
          sideOffset={6}
          className="z-50 w-[248px] overflow-hidden rounded-xl border border-border bg-muted p-1 text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
        >
          <Command shouldFilter={true} className="flex flex-col">
            <div className="flex items-center gap-1 px-1">
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="搜索模型…"
                className="h-8 w-full rounded-md bg-transparent px-2 text-sm text-foreground placeholder:text-mutedForeground outline-none"
              />
              <button
                type="button"
                onClick={() => void refreshList()}
                disabled={loading}
                title="获取模型列表"
                className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-mutedForeground/80 hover:bg-card hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
            </div>
            <Command.List
              className="mt-1 max-h-72 overflow-y-auto"
              onWheel={(event) => {
                event.currentTarget.scrollTop += event.deltaY;
              }}
            >
              <Command.Empty className="py-3 text-center text-xs text-mutedForeground">
                {loading ? '获取中…' : modelOptions.length === 0 ? '点击右上角获取模型列表' : '无匹配项'}
              </Command.Empty>
              {modelOptions.map((option) => (
                <Command.Item
                  key={option}
                  value={option}
                  onSelect={() => handlePick(option)}
                  className="flex cursor-pointer select-none items-center justify-center rounded-md px-2 py-1.5 text-center text-sm text-foreground outline-none transition-colors data-[selected=true]:bg-card"
                >
                  <span className="block w-full truncate text-center font-mono font-normal lowercase">{option}</span>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
