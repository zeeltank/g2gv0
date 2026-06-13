import * as React from 'react'
import { cn } from '@/lib/utils'

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  size?: 'sm' | 'default' | 'lg'
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, size = 'default', ...props }, ref) => {
    const sizeClass = {
      sm: 'h-5 w-9 [&:after]:size-3.5',
      default: 'h-6 w-11 [&:after]:size-5',
      lg: 'h-7 w-12 [&:after]:size-5.5',
    }[size]

    return (
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        className={cn(
          'peer relative inline-flex cursor-pointer appearance-none rounded-full border-2 border-border bg-background transition-all before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:size-3 before:rounded-full before:bg-muted-foreground before:transition-all before:content-[""] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:border-primary checked:bg-primary checked:before:left-5 dark:checked:border-primary dark:checked:bg-primary',
          sizeClass,
          className,
        )}
        {...props}
      />
    )
  },
)
Switch.displayName = 'Switch'

export { Switch }
