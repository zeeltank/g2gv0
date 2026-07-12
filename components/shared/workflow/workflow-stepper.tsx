'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// CVA for container orientation
const stepperVariants = cva('w-full', {
  variants: {
    orientation: {
      horizontal: 'flex flex-row items-center justify-between',
      vertical: 'flex flex-col',
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
  },
})

// CVA for step circle sizing
const circleVariants = cva(
  'flex items-center justify-center rounded-full border-2 font-semibold transition-colors',
  {
    variants: {
      size: {
        sm: 'w-6 h-6 text-xs',
        md: 'w-8 h-8 text-sm',
        lg: 'w-10 h-10 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

// CVA for circle status styling
const circleStatusVariants = cva('', {
  variants: {
    status: {
      completed: 'bg-success border-success text-success-foreground',
      current: 'bg-primary border-primary text-primary-foreground',
      upcoming: 'bg-muted border-border text-muted-foreground',
    },
  },
  defaultVariants: {
    status: 'upcoming',
  },
})

// CVA for step label styling
const labelVariants = cva('font-semibold', {
  variants: {
    size: {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    },
  },
  defaultVariants: {
    size: 'md',
  },
})

// CVA for label status styling
const labelStatusVariants = cva('', {
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

interface WorkflowStepperProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stepperVariants> {
  steps: Step[]
  size?: 'sm' | 'md' | 'lg'
}

const statusIcons = {
  completed: '✓',
  current: '●',
  upcoming: '○',
}

const WorkflowStepper = React.forwardRef<HTMLDivElement, WorkflowStepperProps>(
  ({ steps, orientation = 'horizontal', size = 'md', className, ...props }, ref) => {
    const isVertical = orientation === 'vertical'

    return (
      <div
        ref={ref}
        className={cn(stepperVariants({ orientation }), className)}
        {...props}
      >
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step */}
            <button
              onClick={step.onClick}
              disabled={!step.onClick}
              className={cn(
                'flex items-center gap-2 cursor-pointer transition-opacity',
                isVertical ? 'flex-col items-start w-full mb-4' : '',
                step.status === 'current' ? 'opacity-100' : 'opacity-75 hover:opacity-100',
              )}
            >
              {/* Circle */}
              <div
                className={cn(
                  circleVariants({ size }),
                  circleStatusVariants({ status: step.status }),
                )}
              >
                {statusIcons[step.status]}
              </div>

              {/* Label & Description */}
              <div className={cn('text-left', isVertical ? 'ml-0' : 'hidden sm:block')}>
                <p
                  className={cn(
                    labelVariants({ size }),
                    labelStatusVariants({ status: step.status }),
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
                  isVertical ? 'w-0.5 h-8 ml-3' : 'flex-1 h-0.5 mx-2',
                  index < steps.findIndex((s) => s.status === 'upcoming')
                    ? 'bg-success opacity-100'
                    : 'bg-border opacity-30',
                )}
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
