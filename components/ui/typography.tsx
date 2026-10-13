import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function PageTitle({ className, ...props }: ComponentProps<'h1'>) {
  return <h1 className={cn('ui-page-title', className)} {...props} />;
}

export function SectionTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('ui-section-title', className)} {...props} />;
}

export function BodyText({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('ui-body', className)} {...props} />;
}

export function FieldLabel({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('ui-label', className)} {...props} />;
}
