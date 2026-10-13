import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatusSelectProps = React.ComponentProps<'select'> & {
  tone?: string;
};

export const StatusSelect = React.forwardRef<HTMLSelectElement, StatusSelectProps>(
  ({ className, tone, children, value, defaultValue, onChange, disabled, ...props }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? '');
    const selectedValue = value ?? uncontrolledValue;
    const selectedOption = React.Children.toArray(children).find(
      (child) =>
        React.isValidElement<{ value?: string | number; children?: React.ReactNode }>(child) &&
        String(child.props.value ?? child.props.children) === String(selectedValue),
    );
    const label = React.isValidElement<{ children?: React.ReactNode }>(selectedOption)
      ? selectedOption.props.children
      : selectedValue;

    return (
      <span
        className={cn('ui-status-select', tone, className)}
        data-status-control
        data-disabled={disabled ? 'true' : undefined}
      >
        <span className="ui-status-label" aria-hidden="true">
          {label}
        </span>
        <ChevronDown className="ui-status-chevron" size={16} aria-hidden="true" />
        <select
          ref={ref}
          className="ui-status-native"
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          onChange={(event) => {
            if (value === undefined) setUncontrolledValue(event.target.value);
            onChange?.(event);
          }}
          {...props}
        >
          {children}
        </select>
      </span>
    );
  },
);

StatusSelect.displayName = 'StatusSelect';
