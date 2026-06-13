import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  retry?: () => void
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  ({
    className,
    icon,
    title,
    description,
    action,
    retry,
    ...props
  }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-16 text-center',
        className,
      )}
      {...props}
    >
      {icon || <AlertCircle className="mb-4 size-8 text-destructive" />}
      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mb-4 text-sm text-muted-foreground max-w-xs">
          {description}
        </p>
      )}
      {(action || retry) && (
        <div className="mt-4 flex gap-2">
          {retry && (
            <button
              onClick={retry}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Retry
            </button>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
    </div>
  ),
)
ErrorState.displayName = 'ErrorState'

export { ErrorState }
