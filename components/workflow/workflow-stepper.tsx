'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const stepVariants = cva('relative flex items-center', {
  variants: {
    status: {
      completed: 'text-success',
      current: 'text-primary',
      upcoming: 'text-muted-foreground',
    },
  },
  defaultVariants: {
    status: 'upcoming',
  },
})

interface Step {
  id: string
  label: string
  description?: string
  status: 'completed' | 'current' | 'upcoming'
  onClick?: () => void
}

interface WorkflowStepperProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: Step[]
  orientation?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md' | 'lg'
}

const sizeConfig = {
  sm: { circle: 'w-6 h-6', icon: 'text-xs', label: 'text-xs' },
  md: { circle: 'w-8 h-8', icon: 'text-sm', label: 'text-sm' },
  lg: { circle: 'w-10 h-10', icon: 'text-base', label: 'text-base' },
}

const statusIcons = {
  completed: '✓',
  current: '●',
  upcoming: '○',
}

const WorkflowStepper = React.forwardRef<HTMLDivElement, WorkflowStepperProps>(
  (
    { steps, orientation = 'horizontal', size = 'md', className, ...props },
    ref,
  ) => {
    const isVertical = orientation === 'vertical'
    const config = sizeConfig[size]

    return (
      <div
        ref={ref}
        className={cn(
          'w-full',
          isVertical ? 'flex flex-col' : 'flex flex-row items-center justify-between',
          className,
        )}
        {...props}
      >
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step */}
            <button
              onClick={step.onClick}
              disabled={!step.onClick}
              className={cn(
                'flex items-center gap-2 cursor-pointer transition-colors',
                isVertical ? 'flex-col items-start w-full mb-4' : '',
                step.status === 'current' && 'opacity-100',
                step.status !== 'current' && 'opacity-75 hover:opacity-100',
              )}
            >
              {/* Circle */}
              <div
                className={cn(
                  'flex items-center justify-center rounded-full border-2 font-semibold',
                  config.circle,
                  config.icon,
                  step.status === 'completed' && 'bg-success border-success text-success-foreground',
                  step.status === 'current' && 'bg-primary border-primary text-primary-foreground',
                  step.status === 'upcoming' && 'bg-muted border-border text-muted-foreground',
                )}
              >
                {step.status === 'completed' && statusIcons.completed}
                {step.status === 'current' && statusIcons.current}
                {step.status === 'upcoming' && statusIcons.upcoming}
              </div>

              {/* Label & Description */}
              <div className={cn('text-left', isVertical ? 'ml-0' : 'hidden sm:block')}>
                <p
                  className={cn(
                    config.label,
                    'font-semibold',
                    step.status === 'completed' && 'text-success',
                    step.status === 'current' && 'text-primary',
                    step.status === 'upcoming' && 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                )}
              </div>
            </button>

            {/* Connector */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'bg-border',
                  isVertical
                    ? 'w-0.5 h-8 ml-3 bg-gradient-to-b'
                    : 'flex-1 h-0.5 mx-2 bg-gradient-to-r',
                  index < steps.findIndex((s) => s.status === 'upcoming')
                    ? 'bg-success opacity-100'
                    : 'opacity-30',
                )}
                style={{
                  background: `linear-gradient(${isVertical ? 'to bottom' : 'to right'}, ${
                    index < steps.findIndex((s) => s.status === 'upcoming')
                      ? 'hsl(143 65% 30%)'
                      : 'hsl(219 39% 91%)'
                  }, ${index < steps.findIndex((s) => s.status === 'upcoming') ? 'hsl(143 65% 30%)' : 'hsl(219 39% 91%)'})`,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    )
  },
)
WorkflowStepper.displayName = 'WorkflowStepper'

export { WorkflowStepper, type WorkflowStepperProps, type Step }
