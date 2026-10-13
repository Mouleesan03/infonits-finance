import * as React from 'react';
import { cn } from '@/lib/utils';

export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn('ui-select', className)} {...props} />
  ),
);

Select.displayName = 'Select';
