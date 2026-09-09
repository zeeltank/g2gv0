'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Check, Info, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { WizardLayout } from '@/components/shared/wizard/wizard-layout'
import { WizardFooter } from '@/components/shared/wizard/wizard-footer'
import {
  ModuleConfiguration,
  type ModuleConfigurationHandle,
} from '@/components/settings/module-configuration'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { firstOutstanding, REVIEW_STEP_KEY, toStepperSteps } from '@/lib/onboarding-steps'
import { setupStatusService, type SetupStepStatus } from '@/services/organization/setup-status'

/**
 * SET UP YOUR ORGANISATION — a rail, a pane, and a way back.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT CAME BEFORE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * First 561 lines of fiction: a hardcoded "ABC Technologies Pvt. Ltd.", three
 * invented employees, a CSV import that discarded the uploaded file, a delete
 * that ignored its own id, and every save going to a `Map` in the Next.js
 * process. It was also gated on `['admin','hr'].includes(user.role)` while
 * `user.role` holds role KEYS, so the condition was always false and every user
 * saw Access Denied.
 *
 * Then a checklist that was honest but flat: no rail, no Back, no way to do
 * anything without leaving the page.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * STILL MEASURED, NOW NAVIGABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every step's state is COUNTED server-side from the tables the rest of the
 * product writes, so this screen cannot claim anything the product would
 * contradict, and an organisation that set itself up through the ordinary
 * screens - never opening this one - is already ticked. That has not changed.
 *
 * What is new is that it behaves like a wizard: a visible rail you can click,
 * a step at a time, Back and Skip on every one, and the module picker embedded
 * rather than linked away to.
 *
 * ── WHY "FINISH" STORES NOTHING ─────────────────────────────────────────────
 *
 * There is no "we went live" flag, and there was one: the screen this replaces
 * wrote `localStorage.setItem('gtg-portal-live', 'true')` - per browser, per
 * device, read by absolutely nothing.
 *
 * A stored flag would be a second version of a truth the product already holds.
 * `GET /api/organization/setup-status` returns `complete`, counted. Finishing is
 * therefore not an event to record; it is a person deciding they are done for
 * now, and the correct response to that is to take them to their dashboard.
 */

/** Steps whose work happens on this screen rather than another one. */
const INLINE_STEPS = new Set(['roles', 'modules'])

export default function OrganizationSetupPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { resolveAccessLink } = useSidebarNavigation()

  const [steps, setSteps] = useState<SetupStepStatus[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const moduleHandle = useRef<ModuleConfigurationHandle | null>(null)

  const load = useCallback(
    async (keepStep = true) => {
      const context = getLaravelContext(user)

      if (!isLaravelContextReady(context)) return

      try {
        const response = await setupStatusService.get(context)
        const next = response.data?.steps ?? []
        setSteps(next)
        setError(null)

        // On first load, open at the first thing still outstanding rather than
        // making somebody click past four ticks to find their work.
        setCurrent((existing) => (keepStep && existing ? existing : firstOutstanding(next)))
      } catch (reason) {
        setSteps([])
        setError(reason instanceof Error ? reason.message : 'Could not load your setup status.')
      } finally {
        setLoading(false)
      }
    },
    [user],
  )

  useEffect(() => {
    queueMicrotask(() => {
      void load(false)
    })
  }, [load])

  const railSteps = useMemo(() => toStepperSteps(steps, current), [steps, current])

  const order = useMemo(() => [...steps.map((step) => step.key), REVIEW_STEP_KEY], [steps])
  const index = current ? order.indexOf(current) : -1
  const step = steps.find((item) => item.key === current) ?? null
  const onReview = current === REVIEW_STEP_KEY
  const outstanding = steps.filter((item) => !item.done)

  function goTo(key: string) {
    setNotice(null)
    setCurrent(key)
  }

  /** The one step completed in place: create the roles this organisation lacks. */
  async function createRoles() {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) return

    setBusy(true)
    setNotice(null)
    setError(null)

    try {
      const response = await setupStatusService.createRoles(context)
      setNotice(response.message)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The roles could not be created.')
    } finally {
      setBusy(false)
    }
  }

  async function saveModules() {
    if (!moduleHandle.current) return true

    setBusy(true)
    const ok = await moduleHandle.current.save()
    setBusy(false)

    if (ok) {
      // Re-read rather than assume: the server decides whether the step is done,
      // and this screen should not start keeping its own opinion the moment it
      // becomes convenient.
      await load()
    }

    return ok
  }

  async function advance() {
    if (current === 'modules') {
      const ok = await saveModules()
      if (!ok) return
    }

    if (index >= 0 && index < order.length - 1) {
      goTo(order[index + 1])
      return
    }

    router.push('/dashboard')
  }

  const onModuleReady = useCallback((handle: ModuleConfigurationHandle) => {
    moduleHandle.current = handle
  }, [])

  return (
    <ProtectedLayout>
      <WizardLayout
        title="Set up your organisation"
        subtitle={
          loading
            ? 'Checking what is already set up…'
            : 'Every line is counted from your own records, so it stays right whether you finish here or in the screens themselves.'
        }
        steps={railSteps}
        onSelectStep={goTo}
        exitLabel="Save & exit"
        footer={
          <WizardFooter
            onBack={index > 0 ? () => goTo(order[index - 1]) : undefined}
            onSkip={
              // Nothing to skip on Review, and nothing to skip on a step already
              // done - "Skip" on a finished step would be a lie about what the
              // button does.
              !onReview && index >= 0 && index < order.length - 1 && !step?.done
                ? () => goTo(order[index + 1])
                : undefined
            }
            onNext={advance}
            nextLabel={
              onReview
                ? 'Finish and go to the dashboard'
                : current === 'modules'
                  ? 'Save modules & continue'
                  : step?.done
                    ? 'Continue'
                    : 'Continue'
            }
            busy={busy}
            note={
              onReview
                ? 'Nothing is stored when you finish — this checklist is measured from your records every time you open it, so you can come back to it whenever you like.'
                : undefined
            }
          />
        }
      >
        {error && (
          <Alert variant="destructive" className="mb-5">
            <Info className="size-4" aria-hidden="true" />
            <AlertTitle>Could not load your setup status</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert variant="success" className="mb-5">
            <Check className="size-4" aria-hidden="true" />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        ) : onReview ? (
          <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-6">
            <header>
              <h2 className="text-base font-semibold text-foreground">Where you have got to</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {outstanding.length === 0
                  ? 'Everything on this list is done.'
                  : `${steps.length - outstanding.length} of ${steps.length} done. What is left is below, and none of it blocks you from using the product.`}
              </p>
            </header>

            <ul className="flex flex-col divide-y divide-border/60">
              {steps.map((item) => (
                <li key={item.key} className="flex items-start gap-3 py-3">
                  <span
                    className={
                      item.done
                        ? 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success'
                        : 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-border'
                    }
                    aria-hidden="true"
                  >
                    {item.done ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    {/* The server's own sentence, with the real numbers in it. */}
                    <span className="text-xs leading-snug text-muted-foreground">{item.detail}</span>
                  </span>
                  {!item.done && (
                    <Button size="sm" variant="ghost" onClick={() => goTo(item.key)}>
                      Open
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            <Alert variant="info">
              <Info className="size-4" aria-hidden="true" />
              <AlertTitle>You can leave and come back</AlertTitle>
              <AlertDescription>
                Nothing here is a saved checklist — each line is counted from your organisation&rsquo;s
                own records every time you open it. Work through it in any order, or do it from the
                screens themselves; this will keep up either way.
              </AlertDescription>
            </Alert>
          </section>
        ) : step ? (
          <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">{step.label}</h2>
                {/* The real numbers, from the server. */}
                <p className="mt-0.5 text-sm text-muted-foreground">{step.detail}</p>
              </div>

              {step.done && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                  <Check className="size-3.5" aria-hidden="true" />
                  Done
                </span>
              )}
            </header>

            {step.key === 'modules' ? (
              <ModuleConfiguration onReady={onModuleReady} />
            ) : step.key === 'roles' ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  These nine roles are the platform&rsquo;s own vocabulary — permissions, approval
                  routing and reporting all key on them. Creating them assigns nobody and grants no
                  access; both of those are decisions for a person.
                </p>
                <Button onClick={createRoles} disabled={step.done || busy}>
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {step.done ? 'All nine exist' : step.action}
                </Button>
              </div>
            ) : (
              /*
               * Every other step happens on the screen that owns it. Linking
               * rather than reimplementing is what keeps ONE department form in
               * the product instead of two that drift.
               */
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This is done on the {step.label.toLowerCase()} screen. It opens in place; come
                  back here whenever you like — this list re-reads your records every time.
                </p>
                {step.link && (
                  <Button
                    variant={step.done ? 'outline' : 'default'}
                    onClick={() =>
                      router.push(
                        step.link!.startsWith('/module/')
                          ? resolveAccessLink(step.link!)
                          : step.link!,
                      )
                    }
                  >
                    {step.done ? 'Review' : step.action}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            )}

            {!INLINE_STEPS.has(step.key) && !step.done && (
              <p className="text-xs text-muted-foreground">
                Nothing on this step is required to move on — you can come back to it.
              </p>
            )}
          </section>
        ) : null}
      </WizardLayout>
    </ProtectedLayout>
  )
}
