import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer touch-manipulation items-center justify-center rounded-full text-lg font-normal focus-visible:outline-none disabled:pointer-events-none disabled:cursor-default disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary px-6 py-2.5 text-primaryForeground hover:bg-primary/92',
        secondary:
          'border border-border bg-card px-6 py-2.5 text-foreground hover:bg-muted',
        surface:
          'border border-border bg-muted px-6 py-2.5 text-foreground hover:bg-border',
        ghost: 'px-6 py-2.5 text-mutedForeground hover:bg-muted hover:text-foreground',
        danger: 'border border-border bg-card px-6 py-2.5 text-foreground hover:bg-muted',
        inverse: 'bg-foreground px-6 py-2.5 text-background hover:bg-foreground/88',
      },
      size: {
        xs: 'px-3 py-1 text-xs',
        sm: 'px-4 py-1.5 text-sm',
        md: '',
        icon: 'h-10 w-10 px-0 py-0',
        iconSm: 'h-6 w-6 px-0 py-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
