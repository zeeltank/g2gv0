'use client'

import { Check } from 'lucide-react'
import { useMemo } from 'react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface SetupStep {
  id: string
  label: string
}

interface SetupProgressRailProps {
  activeStep: string
  completed: Record<string, boolean>
  steps: SetupStep[]
}

export function SetupProgressRail({
  activeStep,
  completed,
  steps,
}: SetupProgressRailProps) {
  const completedCount = steps.filter((step) => completed[step.id]).length
  const progress = Math.round((completedCount / steps.length) * 100)

  return (
    <aside className="flex h-full flex-col rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-5">
        <p className="text-sm font-semibold text-foreground">Setup Progress</p>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{progress}% Complete</span>
          <span>
            {completedCount}/{steps.length} steps
          </span>
        </div>
        <Progress value={progress} className="mt-2" />
      </div>

      <div className="space-y-0">
        {steps.map((step, index) => {
          const isCompleted = completed[step.id]
          const isCurrent = step.id === activeStep && !isCompleted
          const status = isCompleted
            ? 'Completed'
            : isCurrent
              ? 'In Progress'
              : 'Pending'

          return (
            <div key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px',
                    isCompleted ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
              <div
                className={cn(
                  'z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                  isCompleted &&
                    'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-primary/10 text-primary',
                  !isCompleted &&
                    !isCurrent &&
                    'border-border bg-background text-muted-foreground',
                )}
              >
                {isCompleted ? <Check className="size-4" /> : index + 1}
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-foreground">
                  {step.label}
                </p>
                <p
                  className={cn(
                    'mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                    isCompleted && 'bg-success/10 text-success',
                    isCurrent && 'bg-primary/10 text-primary',
                    !isCompleted &&
                      !isCurrent &&
                      'bg-muted text-muted-foreground',
                  )}
                >
                  {status}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
