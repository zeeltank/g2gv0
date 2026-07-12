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
        success: 'border border-success/30 bg-success/10 text-success',
        inactive:
          'border border-muted-foreground/30 bg-muted text-muted-foreground',
        pending:
          'border border-warning/30 bg-warning/10 text-warning',
        warning:
          'border border-warning/30 bg-warning/10 text-warning',
        error:
          'border border-destructive/30 bg-destructive/10 text-destructive',
        processing:
          'border border-primary/30 bg-primary/10 text-primary',
        primary: 'border border-primary/30 bg-primary/10 text-primary',
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
  status?: string
  label?: string
}

/**
 * Maps common status strings to variant values.
 * For domain-specific statuses, use a helper function that returns the appropriate variant.
 */
const statusVariantMap: Record<string, VariantProps<typeof statusBadgeVariants>['variant']> = {
  Active: 'active',
  active: 'active',
  Enabled: 'active',
  enabled: 'active',
  Published: 'active',
  published: 'active',
  Approved: 'active',
  approved: 'active',
  Complete: 'active',
  complete: 'active',
  Completed: 'active',
  completed: 'active',
  Verified: 'active',
  verified: 'active',
  Confirmed: 'active',
  confirmed: 'active',
  Inactive: 'inactive',
  inactive: 'inactive',
  Disabled: 'inactive',
  disabled: 'inactive',
  Archived: 'inactive',
  archived: 'inactive',
  Deleted: 'inactive',
  deleted: 'inactive',
  Pending: 'pending',
  pending: 'pending',
  Draft: 'pending',
  draft: 'pending',
  'On Leave': 'pending',
  'on-leave': 'pending',
  OnHold: 'pending',
  'on-hold': 'pending',
  Processing: 'pending',
  processing: 'pending',
  Submitted: 'pending',
  submitted: 'pending',
  AwaitingReview: 'pending',
  'awaiting-review': 'pending',
  AwaitingApproval: 'pending',
  'awaiting-approval': 'pending',
  Rejected: 'error',
  rejected: 'error',
  Failed: 'error',
  failed: 'error',
  Error: 'error',
  error: 'error',
  Cancelled: 'error',
  cancelled: 'error',
  Expired: 'error',
  expired: 'error',
  InProgress: 'processing',
  'in-progress': 'processing',
  'In Progress': 'processing',
  in_progress: 'processing',
  Ongoing: 'processing',
  ongoing: 'processing',
  Scheduled: 'processing',
  scheduled: 'processing',
  review: 'pending',
  blocked: 'error',
  present: 'active',
  late: 'pending',
  absent: 'error',
  'half-day': 'pending',
  leave: 'default',
  Live: 'active',
  live: 'active',
  'sent-back': 'processing',
  'Verbal Warning': 'default',
  'Written Warning': 'warning',
  Suspension: 'error',
  'Training Assigned': 'processing',
  'Final Warning': 'error',
  'Escalated to HR': 'error',
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ className, variant, status, label, size, icon, children, ...props }, ref) => {
    const activeVariant = status ? (statusVariantMap[status] || variant || 'default') : variant;
    
    return (
      <div
        ref={ref}
        className={cn(statusBadgeVariants({ variant: activeVariant, size, className }))}
        {...props}
      >
        {icon && <span>{icon}</span>}
        {children || label || (status ? status.replace(/-/g, ' ') : null)}
      </div>
    )
  },
)
StatusBadge.displayName = 'StatusBadge'

export { StatusBadge, statusBadgeVariants, statusVariantMap }
