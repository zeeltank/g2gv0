import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  size?: 'sm' | 'default' | 'lg'
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size = 'default', ...props }, ref) => {
    const sizeClass = {
      sm: 'h-7 px-2.5 text-xs',
      default: 'h-8 px-3 text-sm',
      lg: 'h-9 px-3.5 text-base',
    }[size]

    return (
      <div className="relative inline-block w-full">
        <select
          ref={ref}
          className={cn(
            'flex w-full rounded-lg border border-input bg-transparent py-1.5 text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 appearance-none',
            sizeClass,
            'pr-8',
            className,
          )}
          {...props}
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground opacity-50" />
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select }
