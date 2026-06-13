import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const progressVariants = cva(
  'relative h-2 w-full overflow-hidden rounded-full bg-muted',
  {
    variants: {
      variant: {
        default: '[&>div]:bg-primary',
        success: '[&>div]:bg-success',
        warning: '[&>div]:bg-warning',
        destructive: '[&>div]:bg-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
  value?: number
  max?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, variant, value = 0, max = 100, ...props }, ref) => {
    const percentage = Math.min((value / max) * 100, 100)

    return (
      <div
        ref={ref}
        className={cn(progressVariants({ variant, className }))}
        {...props}
      >
        <div
          className="h-full w-full bg-primary transition-all"
          style={{ transform: `translateX(${percentage - 100}%)` }}
        />
      </div>
    )
  },
)
Progress.displayName = 'Progress'

export { Progress, progressVariants }
