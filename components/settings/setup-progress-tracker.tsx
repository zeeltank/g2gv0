import * as React from 'react'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export interface SetupStep {
  id: string
  label: string
}

interface SetupProgressTrackerProps {
  currentStep: number
  steps: SetupStep[]
}

const stepIcons = {
  completed: '✓',
  current: '➜',
  upcoming: '○',
}

export function SetupProgressTracker({ currentStep, steps }: SetupProgressTrackerProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const completedCount = currentStep - 1

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        aria-label="Setup Progress"
      >
       <User className="size-4" />
      </button>
      <div
        className={cn(
          'absolute right-0 top-full mt-2 w-[340px] rounded-xl border border-border bg-card p-4 shadow-lg z-50 transition-all duration-200 ease-out',
          open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 pointer-events-none -translate-y-2',
        )}
        role="dialog"
      >
        <div className="mb-3">
          <p className="text-sm font-semibold text-foreground">
            {completedCount}/{steps.length} Steps Completed
          </p>
        </div>
        <Separator className="mb-3" />
        <div className="space-y-1">
          {steps.map((step, index) => {
            const stepNumber = index + 1
            const isCompleted = stepNumber < currentStep
            const isCurrent = stepNumber === currentStep
            const isUpcoming = stepNumber > currentStep

            return (
              <React.Fragment key={step.id}>
                <div
                  className={cn(
                    'flex w-full items-center gap-3 px-2 py-2 text-sm rounded-md',
                    isCompleted && 'text-success',
                    isCurrent && 'text-primary bg-primary/5',
                    isUpcoming && 'text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full text-xs font-semibold',
                      isCompleted && 'bg-success text-success-foreground',
                      isCurrent && 'bg-primary text-primary-foreground',
                      isUpcoming && 'border border-border text-muted-foreground',
                    )}
                  >
                    {isCompleted && stepIcons.completed}
                    {isCurrent && stepIcons.current}
                    {isUpcoming && stepIcons.upcoming}
                  </span>
                  <span className="font-medium">{step.label}</span>
                </div>
                {index < steps.length - 1 && <Separator />}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}