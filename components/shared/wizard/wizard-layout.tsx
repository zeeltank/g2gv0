'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GtgBrandMark } from '@/components/shell/gtg-brand-mark'
import { SetupStepper, type StepperStep } from './setup-stepper'
import { cn } from '@/lib/utils'

/**
 * A FOCUSED WIZARD SHELL: rail on the left, one step on the right.
 *
 * ── WHAT IT REPLACES, AND WHY THAT ONE WAS A TRAP ───────────────────────────
 *
 * `setup-wizard-layout.tsx` was a full-screen `h-screen` shell with no sidebar,
 * no breadcrumb, and exactly three controls in its header: a brand mark that was
 * not a link, a progress popover hidden behind a `<User />` icon, and
 *
 *     <a href="#">Need Help?</a>
 *
 * So once a person reached module configuration or the setup checklist, THE ONLY
 * WAY OUT WAS THE BROWSER BACK BUTTON. A wizard is allowed to take over the
 * screen - that focus is the point - but it has to offer a door.
 *
 * ── WHY THE RAIL IS VISIBLE AND NOT IN A POPOVER ────────────────────────────
 *
 * Progress is the one thing a person setting up an organisation keeps wanting to
 * know: how much is left, and can they stop. Hiding it behind an icon answered
 * neither, and the icon chosen was a person.
 *
 * ── THE CONTENT PANE HAS A FLOOR ────────────────────────────────────────────
 *
 * `min-h-[26rem]` so the footer does not leap up the screen between a step with
 * two fields and a step with a table. Cheap, and it is most of the difference
 * between a wizard that feels built and one that feels generated.
 */

type WizardLayoutProps = {
  /** The organisation being set up. Its real name, never a placeholder. */
  title: string
  subtitle?: string
  steps: StepperStep[]
  onSelectStep?: (key: string) => void
  /** Where "Exit" goes. The dashboard unless a caller knows better. */
  exitHref?: string
  exitLabel?: string
  /** Optional right-hand column: what the wizard has found so far. */
  aside?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}

export function WizardLayout({
  title,
  subtitle,
  steps,
  onSelectStep,
  exitHref = '/dashboard',
  exitLabel = 'Exit setup',
  aside,
  children,
  footer,
}: WizardLayoutProps) {
  const router = useRouter()

  const done = steps.filter((step) => step.state === 'complete').length

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 sm:px-6">
        <GtgBrandMark />

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
            {done} of {steps.length} done
          </span>
          {/*
            A real exit, replacing the dead `href="#"` help link. Setup is
            resumable - every step is measured from the organisation's own
            records - so leaving costs nothing and the label says so.
          */}
          <Button variant="ghost" size="sm" onClick={() => router.push(exitHref)}>
            <X className="size-4" aria-hidden="true" />
            {exitLabel}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-10">
        <aside className="lg:w-64 lg:shrink-0">
          <div className="mb-4">
            <h1 className="text-lg font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {/*
            Horizontal on narrow screens so the rail does not eat the page, and
            it scrolls rather than wrapping into an unreadable grid.
          */}
          <SetupStepper
            steps={steps}
            orientation="vertical"
            onSelect={onSelectStep}
            className="hidden lg:flex"
          />
          <div className="-mx-4 overflow-x-auto px-4 pb-1 lg:hidden">
            <SetupStepper
              steps={steps}
              orientation="horizontal"
              onSelect={onSelectStep}
              className="min-w-[34rem]"
            />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div
            className={cn(
              'flex min-h-[26rem] flex-1 flex-col gap-6',
              aside && 'xl:flex-row xl:gap-8',
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col">{children}</div>

            {aside && <div className="xl:w-72 xl:shrink-0">{aside}</div>}
          </div>

          {footer}
        </main>
      </div>
    </div>
  )
}
