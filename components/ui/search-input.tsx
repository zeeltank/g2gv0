import * as React from 'react'
import { cn } from '@/lib/utils'

interface SearchInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  size?: 'sm' | 'default' | 'lg'
  icon?: React.ReactNode
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, size = 'default', icon, ...props }, ref) => {
    const sizeClass = {
      sm: 'h-7 px-2.5 text-xs',
      default: 'h-8 px-3 text-sm',
      lg: 'h-9 px-3.5 text-base',
    }[size]

    return (
      <div className="relative inline-block w-full">
        <input
          ref={ref}
          type="search"
          className={cn(
            'flex w-full rounded-lg border border-input bg-transparent text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50',
            sizeClass,
            icon && 'pl-9',
            className,
          )}
          {...props}
        />
        {icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50">
            {icon}
          </div>
        )}
      </div>
    )
  },
)
SearchInput.displayName = 'SearchInput'

export { SearchInput }
