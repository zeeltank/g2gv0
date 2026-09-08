'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { nextStepsService, type NextStep } from '@/services/onboarding/next-steps'

/**
 * WHAT TO DO NEXT — the first thing a person sees on the dashboard, and only
 * while there is something to say.
 *
 * ── IT RENDERS NOTHING WHEN THERE IS NOTHING ────────────────────────────────
 *
 * No skeleton, no "you're all set" banner, no empty card taking up the top of
 * the screen forever. A finished organisation's dashboard looks exactly as it
 * did before this component existed. THE PANEL IS THE MESSAGE; when there is no
 * message there is no panel.
 *
 * That is also why it is above the role switch rather than inside HrDashboard:
 * an employee's next step is as real as an administrator's, and the server
 * decides which they get from the token's owner.
 *
 * ── WHY EVERY WORD COMES FROM THE SERVER ────────────────────────────────────
 *
 * Titles, the sentence under each one, the button label and the destination are
 * all measured server-side against the tenant's own tables and filtered by what
 * this profile may actually open. Nothing here is authored in the frontend, so
 * this panel cannot tell somebody to create departments they already have, and
 * cannot link them to a screen that would refuse them.
 *
 * ── DISMISSAL IS SERVER-SIDE, ON PURPOSE ────────────────────────────────────
 *
 * The screens this replaces kept their progress in `localStorage` and in a Map
 * in the Next.js process — per browser, per device, lost on redeploy. Hiding a
 * step writes a `user_onboarding_status` row instead, so it stays hidden on the
 * person's phone as well as their laptop, and survives a deploy.
 */
export function NextStepsPanel() {
  const router = useRouter()
  const { user } = useAuth()
  const { resolveAccessLink } = useSidebarNavigation()

  const [steps, setSteps] = useState<NextStep[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) return

    try {
      const response = await nextStepsService.get(context)
      setSteps(response.data?.steps ?? [])
    } catch {
      // A dashboard must not break because its guidance could not load. There
      // is no error state here by design: guidance is an extra, and a red box
      // where a hint should be is worse than no hint.
      setSteps([])
    } finally {
      setLoaded(true)
    }
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function dismiss(key: string) {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) return

    setBusy(key)

    // Removed locally first so the card goes as soon as it is clicked; `load()`
    // then re-reads the server, which is what actually decides.
    setSteps((current) => current.filter((step) => step.key !== key))

    try {
      await nextStepsService.dismiss(context, key)
      await load()
    } finally {
      setBusy(null)
    }
  }

  function go(step: NextStep) {
    // A menu-routed step goes through the sidebar resolver, the same as every
    // other link in the product. The one step with no menu id is an application
    // route and is pushed as-is.
    router.push(step.menu_id === null ? step.link : resolveAccessLink(step.link))
  }

  // THE WHOLE POINT: nothing outstanding, nothing rendered. Also nothing while
  // the first request is in flight, so the dashboard never jumps.
  if (!loaded || steps.length === 0) return null

  return (
    <section
      data-testid="next-steps-panel"
      className="mb-6 rounded-xl border border-border/70 bg-card p-4 sm:p-5"
      aria-label="What to do next"
    >
      <header className="mb-3 flex items-center gap-2">
        <Check className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">What to do next</h2>
        <span className="text-xs text-muted-foreground">
          {steps.length} {steps.length === 1 ? 'item' : 'items'}
        </span>
      </header>

      <ul className="flex flex-col gap-2">
        {steps.map((step) => (
          <li
            key={step.key}
            data-testid={`next-step-${step.key}`}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-background p-3"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{step.title}</span>
              {/* The server's own sentence, with this organisation's numbers in it. */}
              <span className="text-xs leading-snug text-muted-foreground">{step.detail}</span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="default" onClick={() => go(step)}>
                {step.action}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                disabled={busy === step.key}
                onClick={() => dismiss(step.key)}
                aria-label={`Hide "${step.title}"`}
                title="Hide this"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
