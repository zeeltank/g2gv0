'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { ModuleCard, type Module } from '@/components/settings/module-card'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { SetupWizardIllustration } from '@/shared/illustration/setup-wizard-illustration'
import { SetupWizardLayout } from '@/components/settings/setup-wizard-layout'
import type { SetupStep } from '@/components/settings/setup-progress-tracker'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { moduleEnablementService } from '@/services/organization/module-enablement'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ORG_PROFILE_ACCESS_LINK } from '@/lib/gtg-navigation'

const SETUP_STEPS: SetupStep[] = [
  { id: 'profile', label: 'Profile Setup' },
  { id: 'modules', label: 'Module Selection' },
  { id: 'organization', label: 'Organization Details' },
  { id: 'department', label: 'Department Setup' },
  { id: 'employee', label: 'Employee Import' },
  { id: 'additional', label: 'Additional Module Setup' },
  { id: 'review', label: 'Portal Review' },
  { id: 'golive', label: 'Go Live' },
]

/**
 * Descriptions for the modules the catalogue does not describe.
 *
 * The NAMES, the COUNTS and which modules exist at all now come from the
 * server. Only these sentences are authored here, because tblmenumaster_g2g has
 * no description column - and a sentence explaining what Talent Management is
 * for is copy, not data. Keyed by menu id, and a module without one simply
 * shows no description rather than a made-up one.
 */
const MODULE_BLURBS: Record<number, string> = {
  300: 'The landing screen every role sees when they sign in.',
  1: 'Organization profile, departments, users, roles and compliance.',
  2: 'Competency frameworks, capability libraries and skill mapping.',
  3: 'Recruitment, onboarding, performance, succession and offboarding.',
  4: 'Courses, learning paths, assessments and certificates.',
  5: 'Attendance, leave, payroll and the HR service desk.',
  204: 'Projects, workstreams, task assignment and tracking.',
  186: 'AI agents, runs and analytics.',
}

export function ModuleConfigurationPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { resolveAccessLink } = useSidebarNavigation()
  const queryClient = useQueryClient()
  const [modules, setModules] = useState<Module[]>([])
  const [modulesCompleted, setModulesCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  /** The server's own sentence about what enabling does. Rendered verbatim. */
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const completedSteps = modulesCompleted ? new Set(['profile', 'modules']) : new Set(['profile'])
  const currentStep = modulesCompleted ? 3 : 2

  /*
   * ── REAL MODULES, FROM THE MENU CATALOGUE ────────────────────────────────
   *
   * This screen used to render five hardcoded modules with invented counts
   * ("15 screens", "48 features", "5-7 mins") and load the selection from
   * /api/onboarding - a Map in the Next.js process, keyed by USER rather than
   * tenant and wiped on every redeploy. Two admins of one organisation saw
   * different answers, and neither answer reached the product.
   *
   * The list, the counts and the current state now come from the server, which
   * derives them from tblmenumaster_g2g and the tenant's actual rights rows.
   */
  useEffect(() => {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) return

    let active = true
    setLoading(true)

    queueMicrotask(() => {
      moduleEnablementService
        .list(context)
        .then((response) => {
          if (!active) return

          setModules(
            (response.data?.modules ?? []).map((module) => ({
              id: String(module.id),
              title: module.name,
              // "Mandatory" now means what the server enforces, not a label
              // somebody typed: these are the modules it refuses to switch off.
              mandatory: module.always_on,
              screens: module.screens,
              selected: module.enabled,
              description: MODULE_BLURBS[module.id] ?? '',
            })),
          )
          setNote(response.data?.note ?? '')
          setError(null)
        })
        .catch((reason) => {
          if (!active) return
          setModules([])
          /*
           * The avatar menu shows "Module Configuration" to EVERY role, with no
           * gate, while the endpoint is admin-only. So a non-admin arriving here
           * is an ordinary event, not a bug, and deserves a sentence rather than
           * a blank screen.
           */
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load your modules.',
          )
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    })

    return () => {
      active = false
    }
  }, [user])

  const handleToggle = (id: string) => {
    setModules((prev) =>
      prev.map((module) =>
        // The server refuses to switch these off; the UI must not pretend
        // otherwise by letting the box move and then silently reverting.
        module.id === id && !module.mandatory
          ? { ...module, selected: !module.selected }
          : module,
      ),
    )
  }

  const handleViewOrganization = () => {
    router.push(resolveAccessLink(ORG_PROFILE_ACCESS_LINK))
  }

  return (
    <ProtectedLayout>
      <SetupWizardLayout currentStep={currentStep} steps={SETUP_STEPS} completedSteps={completedSteps}>
        <div className="mb-7 flex flex-col gap-4 sm:mb-6 sm:gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            {/*
              * Was "STEP 1 OF 5" while SETUP_STEPS below lists eight and the
              * layout is passed currentStep={2} - three different counts on one
              * screen. Derived from the list now, so it cannot drift again.
              */}
            <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
              STEP {currentStep} OF {SETUP_STEPS.length}
            </span>

            {/* The emoji here was mojibake in the source - it rendered as
                garbage characters in the browser. */}
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Choose the modules your organisation will use
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Let&apos;s set up your portal step by step. You can complete, skip, or mark modules as not needed.
              You can always come back and update them anytime.
            </p>

            <div className="mt-6">
              <h2 className="text-lg font-semibold text-foreground">Select Modules to Setup</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose the modules you want to set up now.</p>
            </div>
          </div>

          <div
            className="aspect-[960/604] w-56 shrink-0 overflow-hidden rounded-lg bg-white sm:w-72 md:w-96"
            aria-hidden="true"
          >
            <SetupWizardIllustration />
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <Info className="size-4" aria-hidden="true" />
            <AlertTitle>Modules cannot be configured from this account</AlertTitle>
            <AlertDescription>
              {error} Only an administrator can turn modules on or off. This entry
              appears in the menu for every role, which is why you were able to
              reach it.
            </AlertDescription>
          </Alert>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        ) : modules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-muted-foreground">
            No modules are available to configure.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-5">
            {modules.map((mod) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                onToggle={handleToggle}
                // The Organizational Management module row, by menu id.
                onViewOrganization={mod.id === '1' ? handleViewOrganization : undefined}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-6 sm:gap-y-3">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-border" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Not selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex size-2.5 items-center justify-center">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            </span>
            <span className="text-xs text-muted-foreground">Mandatory</span>
            <span className="text-xs text-muted-foreground">Required Module</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex size-2.5 items-center justify-center">
              <span className="size-2 rounded-full bg-muted-foreground/50" aria-hidden="true" />
            </span>
            <span className="text-xs text-muted-foreground">Optional</span>
            <span className="text-xs text-muted-foreground">Optional Module</span>
          </div>
        </div>

        {note && (
          <Alert variant="info" className="mt-4 sm:mt-6">
            <Info className="size-4" aria-hidden="true" />
            <AlertTitle>What switching a module on does</AlertTitle>
            <AlertDescription>
              {/* The server's own sentence, rendered rather than paraphrased, so
                  the screen cannot drift from what the endpoint actually does. */}
              {note} Main Dashboard and Organizational Management stay on, because
              they hold the screens you would need to turn anything back on.
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <Button
            size="lg"
            disabled={loading || saving || modules.length === 0}
            onClick={async () => {
              const context = getLaravelContext(user)

              if (!isLaravelContextReady(context)) {
                setError('Your session is unavailable. Please sign in again.')
                return
              }

              setSaving(true)
              setError(null)

              try {
                /*
                 * The COMPLETE set that should be on. The server switches off
                 * anything absent, which is why this sends every selected id
                 * rather than a delta - see the service.
                 */
                await moduleEnablementService.save(
                  context,
                  modules.filter((module) => module.selected).map((module) => Number(module.id)),
                )

                setModulesCompleted(true)

                /*
                 * The sidebar is built from the very rights this just wrote, so
                 * its cache has to be dropped or the admin enables a module and
                 * does not see it until they reload the page. Same invalidation
                 * use-role-permissions performs after saving the rights matrix,
                 * and for the same reason.
                 */
                await queryClient.invalidateQueries({ queryKey: ['sidebar-navigation'] })

                router.push('/organization/setup')
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : 'Your modules could not be saved.',
                )
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Saving…' : 'Save and continue'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground sm:text-right">You can skip any module in the next step.</p>
      </SetupWizardLayout>
    </ProtectedLayout>
  )
}
