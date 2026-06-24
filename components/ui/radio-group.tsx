import * as React from 'react'
import { cn } from '@/lib/utils'

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, disabled, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="radiogroup"
        className={cn('flex flex-col gap-3', className)}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              ...child.props,
              checked: child.props.value === value,
              onChange: () => onValueChange?.(child.props.value),
              disabled: disabled || child.props.disabled,
            } as any)
          }
          return child
        })}
      </div>
    )
  },
)
RadioGroup.displayName = 'RadioGroup'

interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  size?: 'sm' | 'default' | 'lg'
  label?: React.ReactNode
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, size = 'default', label, ...props }, ref) => {
    const sizeClass = {
      sm: 'size-4',
      default: 'size-5',
      lg: 'size-6',
    }[size]

    const dotSize = {
      sm: 'size-1.5',
      default: 'size-2',
      lg: 'size-2.5',
    }[size]

    return (
      <div className="flex items-center gap-2">
        <div className="relative inline-flex">
          <input
            ref={ref}
            type="radio"
            className={cn(
              'peer appearance-none cursor-pointer rounded-full border border-input bg-background transition-all duration-200 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:border-primary dark:checked:border-primary',
              sizeClass,
              className,
            )}
            {...props}
          />
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground opacity-0 peer-checked:opacity-100',
              dotSize,
            )}
          />
        </div>
        {label && (
          <label className="cursor-pointer text-sm text-foreground">
            {label}
          </label>
        )}
      </div>
    )
  },
)
Radio.displayName = 'Radio'

export { RadioGroup, Radio }
