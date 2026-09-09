'use client'

import { Check, CircleDashed, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * THE STEP RAIL — one component, vertical or horizontal.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * Three screens each carried their own step list and their own rendering, and
 * the three disagreed: module configuration declared 8 steps, portal review 6,
 * and the setup checklist 6 different ones. "STEP 2 OF 8" on one screen became
 * "5 of 6" on the next, describing the same setup.
 *
 * The old renderer also hid the rail behind a `<User />` icon in the top bar -
 * a person icon, opening a popover, to show setup progress - so in practice
 * nobody saw their progress at all.
 *
 * ── STATUS IS NEVER CARRIED BY COLOUR ALONE ─────────────────────────────────
 *
 * Every state pairs a hue with a distinct MARK and a text label: a tick for
 * done, the step number for current and upcoming, a dashed ring for skipped, a
 * warning triangle for blocked. Colourblind readers, printed pages and
 * forced-colors mode all still read correctly, and `aria-current="step"` carries
 * it to a screen reader.
 *
 * ── GEOMETRY ────────────────────────────────────────────────────────────────
 *
 * 26px marker, 2px ring, 2px connector, the connector turning accent behind
 * completed steps. The vertical connector is inset 12px from the left - the
 * marker's centre line, (26 - 2) / 2 - and runs from the bottom of one marker to
 * the top of the next, so the rail is one continuous line rather than a column
 * of dashes.
 */

export type StepState = 'complete' | 'current' | 'upcoming' | 'skipped' | 'blocked'

export type StepperStep = {
  key: string
  label: string
  /** The real numbers — "49 departments", "3 of 9 exist". Optional. */
  detail?: string
  state: StepState
}

type SetupStepperProps = {
  steps: StepperStep[]
  orientation?: 'vertical' | 'horizontal'
  /** Given when a step can be jumped to. Without it the rail is display-only. */
  onSelect?: (key: string) => void
  className?: string
}

const MARKER: Record<StepState, string> = {
  complete: 'border-primary bg-primary text-primary-foreground',
  current: 'border-primary bg-surface text-primary',
  upcoming: 'border-border bg-surface text-muted-foreground',
  skipped: 'border-dashed border-border bg-surface text-muted-foreground',
  blocked: 'border-warning bg-warning/10 text-warning',
}

const LABEL: Record<StepState, string> = {
  complete: 'font-medium text-foreground',
  current: 'font-semibold text-foreground',
  upcoming: 'font-normal text-muted-foreground',
  skipped: 'font-normal text-muted-foreground',
  blocked: 'font-medium text-foreground',
}

/** The word a screen reader hears. Status is never colour alone. */
const STATE_LABEL: Record<StepState, string> = {
  complete: 'Done',
  current: 'In progress',
  upcoming: 'Not started',
  skipped: 'Skipped',
  blocked: 'Needs attention',
}

function Marker({ state, index }: { state: StepState; index: number }) {
  return (
    <span
      className={cn(
        'relative z-10 flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums',
        MARKER[state],
      )}
      aria-hidden="true"
    >
      {state === 'complete' ? (
        <Check className="size-3.5" strokeWidth={3} />
      ) : state === 'blocked' ? (
        <TriangleAlert className="size-3.5" />
      ) : state === 'skipped' ? (
        <CircleDashed className="size-3.5" />
      ) : (
        index + 1
      )}
    </span>
  )
}

export function SetupStepper({
  steps,
  orientation = 'vertical',
  onSelect,
  className,
}: SetupStepperProps) {
  const vertical = orientation === 'vertical'

  return (
    <ol
      className={cn(vertical ? 'flex flex-col' : 'flex flex-row items-start gap-1', className)}
      aria-label="Setup progress"
    >
      {steps.map((step, index) => {
        const last = index === steps.length - 1

        const body = (
          <>
            <Marker state={step.state} index={index} />
            <span className={cn('flex min-w-0 flex-col gap-0.5', vertical ? 'pt-0.5' : 'pt-1')}>
              <span className={cn('text-sm leading-snug', LABEL[step.state])}>{step.label}</span>
              {step.detail && (
                <span className="text-xs leading-snug text-muted-foreground">{step.detail}</span>
              )}
              <span className="sr-only">{STATE_LABEL[step.state]}</span>
            </span>
          </>
        )

        return (
          <li
            key={step.key}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={cn(
              'relative',
              vertical ? 'flex' : 'flex flex-1 flex-col',
              vertical && !last && 'pb-6',
            )}
          >
            {/*
              The connector turns accent BEHIND a completed step, so the rail
              shows how far the line has been walked rather than only where you
              are standing.
            */}
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute rounded-full',
                  vertical
                    ? 'bottom-0 left-[12px] top-[26px] w-0.5'
                    : 'left-[26px] right-0 top-[12px] h-0.5',
                  step.state === 'complete' ? 'bg-primary' : 'bg-border',
                )}
              />
            )}

            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(step.key)}
                className={cn(
                  'flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  vertical ? '-m-1 p-1 hover:bg-muted/50' : 'flex-col gap-2 p-1',
                )}
              >
                {body}
              </button>
            ) : (
              <span
                className={cn('flex min-w-0 flex-1 items-start gap-3', !vertical && 'flex-col gap-2')}
              >
                {body}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
