import * as React from 'react';

import { cn } from '../../lib/utils';

export const ContentImage = React.forwardRef<
  HTMLImageElement,
  React.ComponentProps<'img'>
>(({ className, alt, loading = 'lazy', decoding = 'async', ...props }, ref) => {
  return (
    <img
      ref={ref}
      alt={alt}
      loading={loading}
      decoding={decoding}
      className={cn('block max-w-full object-cover', className)}
      {...props}
    />
  );
});

ContentImage.displayName = 'ContentImage';
