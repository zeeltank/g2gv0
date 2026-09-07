'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { SetupWizardLayout } from '@/components/settings/setup-wizard-layout'
import type { SetupStep } from '@/components/settings/setup-progress-tracker'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import {
  setupStatusService,
  type SetupStepStatus,
} from '@/services/organization/setup-status'

/**
 * ORGANISATION SETUP — what is done, what is left, and where to do it.
 *
 * ── WHAT THIS REPLACES ──────────────────────────────────────────────────────
 *
 * 561 lines of fiction, plus six step components. It was unreachable, and had
 * it been reachable it was not real:
 *
 *   - `['admin','hr'].includes(user.role)` gated it, while `user.role` holds
 *     role KEYS - 'administrator', 'hr_manager'. Neither string is a member, so
 *     the condition was always false and EVERY user, administrator included,
 *     saw Access Denied.
 *   - The organisation was prefilled "ABC Technologies Pvt. Ltd.", the employee
 *     list was three invented people, and the sister companies came from a
 *     fixture.
 *   - `importEmployees()` never read the uploaded file - it discarded the File
 *     and set the three samples.
 *   - `deleteSisterCompany(id)` never used its `id`; it reset state instead.
 *   - Every save went to `updateOnboarding()` and stopped there: an in-memory
 *     Map in the Next.js process. Not one Laravel call in the whole file.
 *
 * ── WHY THIS IS A CHECKLIST AND NOT A WIZARD ────────────────────────────────
 *
 * A wizard owns its own progress, and that progress can disagree with the
 * product - which is exactly how the old one could report a finished setup for
 * an organisation with no departments. Here every step's state is COUNTED on
 * the server from the tables the rest of the product uses, so:
 *
 *   - it cannot claim anything the product would contradict;
 *   - an organisation that set itself up through the ordinary screens, never
 *     opening this page, is already ticked;
 *   - it is resumable by anyone, on any device, because there is no local state
 *     to lose - the old flow kept "we went live" in one person's localStorage;
 *   - and it is just as useful to the twelve organisations already on live,
 *     none of which ever saw a setup flow. It tells them what is missing.
 *
 * Each step links to the REAL screen for that job rather than reimplementing
 * it, so there is one department form in the product, not two.
 */

/** Mirrors the tracker rail. The steps themselves come from the server. */
const SETUP_STEPS: SetupStep[] = [
  { id: 'profile', label: 'Organisation profile' },
  { id: 'roles', label: 'Standard roles' },
  { id: 'modules', label: 'Modules' },
  { id: 'departments', label: 'Departments' },
  { id: 'people', label: 'People' },
  { id: 'capability', label: 'Capability framework' },
]

export default function OrganizationSetupPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { resolveAccessLink } = useSidebarNavigation()

  const [steps, setSteps] = useState<SetupStepStatus[]>([])
  const [done, setDone] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyStep, setBusyStep] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) return

    setLoading(true)

    try {
      const response = await setupStatusService.get(context)
      setSteps(response.data?.steps ?? [])
      setDone(response.data?.done ?? 0)
      setError(null)
    } catch (reason) {
      setSteps([])
      setError(reason instanceof Error ? reason.message : 'Could not load your setup status.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  /**
   * The one step that finishes here rather than elsewhere.
   *
   * Afterwards the status is reloaded rather than assumed - the server is the
   * thing that decides whether a step is done, and this screen should not start
   * keeping its own opinion the moment it becomes inconvenient.
   */
  async function createRoles() {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) return

    setBusyStep('roles')
    setNotice(null)
    setError(null)

    try {
      const response = await setupStatusService.createRoles(context)
      setNotice(response.message)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The roles could not be created.')
    } finally {
      setBusyStep(null)
    }
  }

  /*
   * Menu links are resolved through the sidebar, not hardcoded. A link to a
   * screen this role cannot reach would be a dead end, and resolveAccessLink
   * returns '/dashboard' for anything not in their navigation.
   */
  function go(link: string) {
    router.push(link.startsWith('/module/') ? resolveAccessLink(link) : link)
  }

  const total = steps.length || SETUP_STEPS.length
  const completedIds = new Set(steps.filter((step) => step.done).map((step) => step.key))
  const firstOutstanding = steps.findIndex((step) => !step.done)

  return (
    <ProtectedLayout>
      <SetupWizardLayout
        currentStep={firstOutstanding === -1 ? total : firstOutstanding + 1}
        steps={SETUP_STEPS}
        completedSteps={completedIds}
      >
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Set up your organisation
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {loading
              ? 'Checking what is already set up…'
              : `${done} of ${total} done. Everything below is read from your own data, so it stays right whether you finish here or in the screens themselves.`}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <Info className="size-4" aria-hidden="true" />
            <AlertTitle>Could not load your setup status</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert variant="info" className="mb-4">
            <Check className="size-4" aria-hidden="true" />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {steps.map((step) => (
              <li
                key={step.key}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border/70 bg-card p-4"
              >
                <span
                  className={
                    step.done
                      ? 'flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success'
                      : 'flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground'
                  }
                  aria-hidden="true"
                >
                  {step.done ? <Check className="size-4" /> : null}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">{step.label}</span>
                  {/* The server's own sentence, with the real numbers in it. */}
                  <span className="text-xs leading-snug text-muted-foreground">{step.detail}</span>
                </div>

                {step.inline_action === 'create-roles' ? (
                  <Button
                    size="sm"
                    variant={step.done ? 'outline' : 'default'}
                    disabled={step.done || busyStep === 'roles'}
                    onClick={createRoles}
                  >
                    {busyStep === 'roles' && (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    )}
                    {step.done ? 'Done' : step.action}
                  </Button>
                ) : step.link ? (
                  <Button
                    size="sm"
                    variant={step.done ? 'outline' : 'default'}
                    onClick={() => go(step.link as string)}
                  >
                    {step.done ? 'Review' : step.action}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ol>
        )}

        {!loading && steps.length > 0 && (
          <Alert variant="info" className="mt-6">
            <Info className="size-4" aria-hidden="true" />
            <AlertTitle>You can leave and come back</AlertTitle>
            <AlertDescription>
              Nothing on this page is a saved checklist — each line is counted from your
              organisation&rsquo;s own records every time you open it. Work through it in any
              order, or do it from the screens themselves; this will keep up either way.
            </AlertDescription>
          </Alert>
        )}
      </SetupWizardLayout>
    </ProtectedLayout>
  )
}
