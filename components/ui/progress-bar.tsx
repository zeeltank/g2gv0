'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const progressBarVariants = cva('h-full rounded-full transition-all duration-300', {
  variants: {
    variant: {
      default: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
      destructive: 'bg-destructive',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface ProgressBarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof progressBarVariants> {
  value: number // 0-100
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  trackClassName?: string
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2',
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ 
    className, 
    trackClassName,
    value, 
    variant, 
    showLabel = false, 
    size = 'md',
    ...props 
  }, ref) => {
    const clampedValue = Math.min(100, Math.max(0, value))

    return (
      <div className={cn('flex items-center gap-2', className)} ref={ref} {...props}>
        <div className={cn(
          'flex-1 bg-muted rounded-full overflow-hidden',
          sizeClasses[size]
        , trackClassName)}>
          <div 
            className={cn(progressBarVariants({ variant }))}
            style={{ width: `${clampedValue}%` }}
            role="progressbar"
            aria-valuenow={clampedValue}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        {showLabel && (
          <span className="text-xs font-bold tabular-nums">{clampedValue}%</span>
        )}
      </div>
    )
  },
)
ProgressBar.displayName = 'ProgressBar'

export { ProgressBar, progressBarVariants }
