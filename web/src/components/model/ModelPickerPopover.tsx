import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { ListBox } from '@heroui/react/list-box';
import { Popover } from '@heroui/react/popover';
import { ScrollShadow } from '@heroui/react/scroll-shadow';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { useMemo, type ComponentProps, type ReactNode } from 'react';

import { cn } from '../../lib/utils';

export interface ModelPickerGroup {
  id: string;
  label?: string;
  models: string[];
}

interface ModelPickerPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  placeholder: string;
  groups: ModelPickerGroup[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (model: string, group: ModelPickerGroup) => void;
  onRefresh: () => void;
  loading: boolean;
  triggerAriaLabel: string;
  searchAriaLabel: string;
  searchName: string;
  listAriaLabel: string;
  leadingIcon?: ReactNode;
  placement?: ComponentProps<typeof Popover.Content>['placement'];
  offset?: ComponentProps<typeof Popover.Content>['offset'];
  triggerClassName?: string;
  triggerIconClassName?: string;
  triggerValueClassName?: string;
  contentClassName?: string;
  inputClassName?: string;
  itemClassName?: string;
  emptyLabel?: string;
  noMatchLabel?: string;
}

const defaultTriggerClassName =
  'grid min-w-0 cursor-pointer grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-2 overflow-hidden rounded-full border border-border bg-card text-sm font-medium text-foreground shadow-none transition-[background-color,border-color,color,box-shadow] hover:bg-muted focus-visible:ring-1 focus-visible:ring-foreground/20';

const defaultTriggerIconSlotClassName =
  'flex h-4 w-4 shrink-0 items-center justify-center justify-self-center text-mutedForeground [&>svg]:block [&>svg]:h-4 [&>svg]:w-4';

const defaultTriggerIconClassName =
  'block h-4 w-4 shrink-0 justify-self-center text-mutedForeground';

const defaultContentClassName =
  'z-50 w-[var(--trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-muted p-1 text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.22)]';

const defaultInputClassName =
  'h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm text-foreground placeholder:text-mutedForeground outline-none';

const defaultItemClassName =
  'flex cursor-pointer select-none items-center justify-center rounded-md px-2 py-1.5 text-center text-sm text-foreground outline-none transition-colors hover:bg-card data-[focused]:bg-card';

export function ModelPickerPopover({
  open,
  onOpenChange,
  value,
  placeholder,
  groups,
  search,
  onSearchChange,
  onSelect,
  onRefresh,
  loading,
  triggerAriaLabel,
  searchAriaLabel,
  searchName,
  listAriaLabel,
  leadingIcon,
  placement = 'top',
  offset = 6,
  triggerClassName,
  triggerIconClassName,
  triggerValueClassName,
  contentClassName,
  inputClassName,
  itemClassName,
  emptyLabel = '点击右上角获取模型列表',
  noMatchLabel = '无匹配项',
}: ModelPickerPopoverProps) {
  const normalizedSearch = search.trim().toLowerCase();
  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          models: normalizedSearch
            ? group.models.filter((model) => model.toLowerCase().includes(normalizedSearch))
            : group.models,
        }))
        .filter((group) => group.models.length > 0),
    [groups, normalizedSearch],
  );
  const modelCount = useMemo(
    () => groups.reduce((total, group) => total + group.models.length, 0),
    [groups],
  );
  const showGroupLabels = groups.length > 1 || groups.some((group) => group.label);
  const emptyText = loading ? '获取中…' : modelCount === 0 ? emptyLabel : noMatchLabel;

  return (
    <Popover isOpen={open} onOpenChange={onOpenChange}>
      <Button
        type="button"
        variant="secondary"
        aria-label={triggerAriaLabel}
        className={cn(defaultTriggerClassName, triggerClassName)}
      >
        <span
          className={cn(defaultTriggerIconSlotClassName, triggerIconClassName)}
          aria-hidden={!leadingIcon}
        >
          {leadingIcon}
        </span>
        <span
          className={cn(
            'min-w-0 truncate text-center leading-none transition-colors',
            !value && 'text-mutedForeground',
            value && 'font-mono lowercase',
            triggerValueClassName,
          )}
        >
          {value || placeholder}
        </span>
        <ChevronDown
          className={cn(defaultTriggerIconClassName, triggerIconClassName)}
          aria-hidden="true"
        />
      </Button>
      <Popover.Content
        placement={placement}
        offset={offset}
        className={cn(defaultContentClassName, contentClassName)}
      >
        <Popover.Dialog className="flex flex-col outline-none">
          <div className="flex items-center gap-1 px-1">
            <Input
              aria-label={searchAriaLabel}
              name={searchName}
              value={search}
              onChange={(event) => onSearchChange(event.currentTarget.value)}
              placeholder="搜索模型…"
              autoComplete="off"
              spellCheck={false}
              className={cn(defaultInputClassName, inputClassName)}
            />
            <button
              type="button"
              onClick={() => onRefresh()}
              disabled={loading}
              title="获取模型列表"
              aria-label="获取模型列表"
              className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-mutedForeground/80 transition-colors hover:bg-card hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/20 disabled:opacity-50"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
                aria-hidden="true"
              />
            </button>
          </div>
          <ScrollShadow className="mt-1 max-h-72 overflow-y-auto" size={16}>
            {visibleGroups.length === 0 ? (
              <div className="py-3 text-center text-xs text-mutedForeground">
                {emptyText}
              </div>
            ) : (
              visibleGroups.map((group) => (
                <div key={group.id}>
                  {showGroupLabels && group.label ? (
                    <div className="px-3 py-1.5 text-[11px] font-medium uppercase text-mutedForeground/60">
                      {group.label}
                    </div>
                  ) : null}
                  <ListBox
                    aria-label={group.label ? `${group.label} ${listAriaLabel}` : listAriaLabel}
                    onAction={(key) => onSelect(String(key), group)}
                    className="p-1"
                  >
                    {group.models.map((model) => (
                      <ListBox.Item
                        key={`${group.id}:${model}`}
                        id={model}
                        textValue={model}
                        className={cn(defaultItemClassName, itemClassName)}
                      >
                        <span className="block w-full truncate text-center font-mono font-normal lowercase">
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
  );
}
