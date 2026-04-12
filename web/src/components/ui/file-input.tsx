import * as React from 'react';

import { cn } from '../../lib/utils';

export const FileInput = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type = 'file', ...props }, ref) => {
    return <input ref={ref} type={type} className={cn('hidden', className)} {...props} />;
  },
);

FileInput.displayName = 'FileInput';
