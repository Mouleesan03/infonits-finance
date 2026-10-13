'use client';

import * as React from 'react';
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

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="local-modal-layer" role="presentation" onMouseDown={onClose}>
      <section
        className={cn('local-modal ui-form-modal', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            {icon ? <span className="local-modal-icon">{icon}</span> : null}
            <div>
              <h2 id={titleId}>{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
