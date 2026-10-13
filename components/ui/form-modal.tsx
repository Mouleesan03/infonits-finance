'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type FormModalProps = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  onClose: () => void;
};

export function FormModal({ title, subtitle, icon, className, children, onClose }: FormModalProps) {
  const titleId = React.useId();

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="local-modal-layer" />
        <DialogPrimitive.Content
          className={cn('local-modal ui-form-modal', className)}
          aria-labelledby={titleId}
        >
          <header>
            <div>
              {icon ? <span className="local-modal-icon">{icon}</span> : null}
              <div>
                <DialogPrimitive.Title id={titleId}>{title}</DialogPrimitive.Title>
                {subtitle ? (
                  <DialogPrimitive.Description>{subtitle}</DialogPrimitive.Description>
                ) : null}
              </div>
            </div>
            <DialogPrimitive.Close asChild>
              <button type="button" aria-label={`Close ${title}`}>
                <X size={19} />
              </button>
            </DialogPrimitive.Close>
          </header>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
