'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface RadioGroupProps extends React.ComponentPropsWithoutRef<'div'> {
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, children, ...props }, ref) => {
    const enhanceChildren = (children: React.ReactNode): React.ReactNode => {
      return React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) {
          return child;
        }

        // If the child is a RadioGroupItem, enhance it
        if (child.type === RadioGroupItem) {
          return React.cloneElement(child as React.ReactElement<any>, {
            checked: child.props.value === value,
            onCheckedChange: () => onValueChange?.(child.props.value),
          });
        }

        // If the child has children, recursively enhance them
        if (child.props.children) {
          return React.cloneElement(child as React.ReactElement<any>, {
            children: enhanceChildren(child.props.children),
          });
        }

        return child;
      });
    };

    return (
      <div
        ref={ref}
        className={cn('flex gap-4', className)}
        role="radiogroup"
        {...props}
      >
        {enhanceChildren(children)}
      </div>
    );
  },
);
RadioGroup.displayName = 'RadioGroup';

interface RadioGroupItemProps
  extends Omit<React.ComponentPropsWithoutRef<'button'>, 'value'> {
  value: string;
  checked?: boolean;
  onCheckedChange?: () => void;
}

const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ className, value, checked, onCheckedChange, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={checked}
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full border border-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        onClick={onCheckedChange}
        {...props}
      >
        {checked && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </button>
    );
  },
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
