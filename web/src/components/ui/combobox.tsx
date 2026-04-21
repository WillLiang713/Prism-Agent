import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { ChevronDown } from 'lucide-react';

import { cn } from '../../lib/utils';

export interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  allowCustom?: boolean;
  mono?: boolean;
  dropdownWidth?: 'trigger' | 'compact' | number;
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = '选择或输入…',
  emptyText = '无匹配项',
  disabled,
  className,
  allowCustom = true,
  mono = true, // Default to true as currently only used for models
  dropdownWidth = 'trigger',
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const displayValue = value || '';
  const triggerWidth = triggerRef.current?.offsetWidth;
  const resolvedDropdownWidth =
    typeof dropdownWidth === 'number'
      ? dropdownWidth
      : dropdownWidth === 'compact'
        ? Math.min(Math.max(triggerWidth ?? 220, 220), 240)
        : triggerWidth;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
            className,
          )}
        >
          <span
            className={cn(
              'truncate',
              !displayValue && 'text-mutedForeground',
              displayValue && mono && 'font-mono lowercase tracking-tight',
            )}
          >
            {displayValue || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          style={resolvedDropdownWidth ? { width: resolvedDropdownWidth } : undefined}
          className="z-50 overflow-hidden rounded-xl border border-border bg-muted p-1 text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
        >
          <Command shouldFilter={true} className="flex flex-col">
            <Command.Input
              value={search}
              onValueChange={(next) => {
                setSearch(next);
                if (allowCustom) onValueChange(next);
              }}
              placeholder="搜索模型…"
              className="h-8 w-full rounded-md bg-transparent px-2 text-sm text-foreground placeholder:text-mutedForeground outline-none"
            />
            <Command.List
              className="mt-1 max-h-64 overflow-y-auto"
              onWheel={(event) => {
                event.currentTarget.scrollTop += event.deltaY;
              }}
            >
              <Command.Empty className="py-3 text-center text-xs text-mutedForeground">
                {emptyText}
              </Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option}
                  value={option}
                  onSelect={(selected) => {
                    onValueChange(selected);
                    setOpen(false);
                  }}
                  className="flex w-full cursor-pointer select-none items-center justify-center rounded-full px-3 py-2 text-center text-sm text-foreground outline-none transition-colors hover:bg-card data-[selected=true]:bg-card"
                >
                  <span className={cn('block w-full truncate text-center', mono && 'font-mono lowercase tracking-tight')}>
                    {option}
                  </span>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
