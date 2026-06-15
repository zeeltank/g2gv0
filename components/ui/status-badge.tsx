import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
  {
    variants: {
      variant: {
        default:
          'border border-border bg-background text-foreground',
        active: 'border border-success/30 bg-success/10 text-success',
        inactive:
          'border border-muted-foreground/30 bg-muted text-muted-foreground',
        pending:
          'border border-warning/30 bg-warning/10 text-warning',
        error:
          'border border-destructive/30 bg-destructive/10 text-destructive',
        processing:
          'border border-primary/30 bg-primary/10 text-primary',
      },
      size: {
        sm: 'text-xs px-2 py-0.5',
        default: 'text-xs px-2.5 py-1',
        lg: 'text-sm px-3 py-1.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  icon?: React.ReactNode
  status?: 'Active' | 'Inactive' | 'Draft'
}

const statusVariantMap: Record<NonNullable<StatusBadgeProps['status']>, VariantProps<typeof statusBadgeVariants>['variant']> = {
  Active: 'active',
  Inactive: 'inactive',
  Draft: 'pending',
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ className, variant, status, size, icon, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(statusBadgeVariants({ variant: status ? statusVariantMap[status] : variant, size, className }))}
      {...props}
    >
      {icon && <span>{icon}</span>}
      {children}
    </div>
  ),
)
StatusBadge.displayName = 'StatusBadge'

export { StatusBadge, statusBadgeVariants }
