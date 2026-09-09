'use client'

import { useCallback, useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ModuleCard, type Module } from '@/components/settings/module-card'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { moduleEnablementService } from '@/services/organization/module-enablement'
import { useQueryClient } from '@tanstack/react-query'

/**
 * WHICH MODULES THIS ORGANISATION USES — the screen itself, with no chrome.
 *
 * ── WHY IT IS SPLIT OUT ─────────────────────────────────────────────────────
 *
 * The same picker is needed in two places that want different frames around it:
 *
 *   /settings/module-configuration   a standalone page inside the app shell,
 *                                    with a breadcrumb and a Back button
 *   the setup wizard                 one step of several, inside the wizard rail
 *
 * The alternative - a second copy - is how the product ended up with two
 * Organization Profile screens and three different setup step lists. So the
 * component owns the modules, the loading, the saving and the copy; the host
 * owns the surroundings and decides what happens after a save.
 *
 * ── DESCRIPTIONS ARE THE ONLY THING AUTHORED HERE ───────────────────────────
 *
 * The names, the counts, which modules exist and which are on all come from the
 * server, which derives them from `tblmenumaster_g2g` and the tenant's real
 * rights rows. `tblmenumaster_g2g` has no description column, and a sentence
 * explaining what Talent Management is for is copy rather than data - so it
 * lives here, keyed by menu id, and a module without one shows no description
 * rather than an invented one.
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

export type ModuleConfigurationHandle = {
  /** Persist the current selection. Resolves false when it could not be saved. */
  save: () => Promise<boolean>
  /** True while modules are still loading, so a host can disable its footer. */
  loading: boolean
  /** True while a save is in flight. */
  saving: boolean
  /** How many are currently on, for a host that wants to say so. */
  enabledCount: number
}

type ModuleConfigurationProps = {
  /** Handed the imperative API, so the host's own footer can drive the save. */
  onReady?: (handle: ModuleConfigurationHandle) => void
  /** Called after a successful save, with the number of enabled modules. */
  onSaved?: (enabled: number) => void
}

export function ModuleConfiguration({ onReady, onSaved }: ModuleConfigurationProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  /** The server's own sentence about what enabling does. Rendered verbatim. */
  const [note, setNote] = useState('')
  /*
   * TWO ERRORS, NOT ONE.
   *
   * `loadError` replaces the whole component with "Modules cannot be configured
   * from this account" - correct, because a failed load is almost always the
   * `profile:admin` guard refusing.
   *
   * `saveError` is shown ABOVE the grid, which stays visible. Sharing one state
   * meant any save failure - a dropped connection, a 500 - told a genuine
   * administrator they were not an administrator and wiped the grid they had
   * just been editing, losing their selections with it.
   */
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) return

    let active = true

    queueMicrotask(() => {
      // setLoading lives INSIDE the microtask, not in the effect body.
      // A synchronous setState in an effect triggers a second render pass
      // before the browser paints - react-hooks/set-state-in-effect catches
      // exactly this. `loading` already starts true, so the only job here is
      // re-arming it when the signed-in user changes.
      if (active) setLoading(true)

      moduleEnablementService
        .list(context)
        .then((response) => {
          if (!active) return

          setModules(
            (response.data?.modules ?? []).map((module) => ({
              id: String(module.id),
              title: module.name,
              // "Always on" means what the server enforces, not a label
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
           * The avatar menu shows "Module Configuration" to EVERY role while the
           * endpoint is admin-only, so a non-admin arriving here is an ordinary
           * event, not a bug, and deserves a sentence rather than a blank screen.
           */
          setError(reason instanceof Error ? reason.message : 'Could not load your modules.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    })

    return () => {
      active = false
    }
  }, [user])

  const toggle = (id: string) => {
    setModules((prev) =>
      prev.map((module) =>
        // The server refuses to switch these off, and the card no longer offers
        // a control for them - this is the second line of defence, not the only
        // one.
        module.id === id && !module.mandatory
          ? { ...module, selected: !module.selected }
          : module,
      ),
    )
  }

  const save = useCallback(async () => {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) {
      setSaveError('Your session is unavailable. Sign in again.')
      return false
    }

    /*
     * ═══════════════════════════════════════════════════════════════════════
     * REFUSE TO SAVE A LIST THAT HAS NOT LOADED
     * ═══════════════════════════════════════════════════════════════════════
     *
     * This send is a COMPLETE SET, not a delta - the server switches off
     * anything absent from it. So saving before the fetch resolves sends an
     * empty array, and the server reads that as "turn every optional module
     * off" for the whole tenant. One click, on a screen that had not finished
     * drawing, and every module the organisation uses disappears from every
     * administrator's navigation.
     *
     * The host's footer is supposed to prevent this - `loading` is on the
     * handle precisely so it can - but both hosts held the handle in a ref, so
     * they never re-rendered when it flipped and their buttons stayed live.
     * Those are fixed too; this guard is here because a host that gets it wrong
     * must not be able to cause data loss.
     */
    if (loading || modules.length === 0) {
      return false
    }

    setSaving(true)
    setSaveError(null)

    try {
      const enabled = modules.filter((module) => module.selected)

      /*
       * The COMPLETE set that should be on. The server switches off anything
       * absent, which is why this sends every selected id rather than a delta.
       */
      await moduleEnablementService.save(
        context,
        enabled.map((module) => Number(module.id)),
      )

      /*
       * The sidebar is built from the very rights this just wrote, so its cache
       * has to be dropped or the admin enables a module and does not see it
       * until they reload. Same invalidation use-role-permissions performs after
       * saving the rights matrix, and for the same reason.
       */
      await queryClient.invalidateQueries({ queryKey: ['sidebar-navigation'] })

      onSaved?.(enabled.length)

      return true
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Your modules could not be saved.')
      return false
    } finally {
      setSaving(false)
    }
  }, [loading, modules, onSaved, queryClient, user])

  const enabledCount = modules.filter((module) => module.selected).length

  // The host's footer needs to drive the save, and it needs to know when the
  // save is possible. Handing the API up on every relevant change keeps the two
  // in step without the host reaching into this component's state.
  useEffect(() => {
    onReady?.({ save, loading, saving, enabledCount })
  }, [onReady, save, loading, saving, enabledCount])

  // A failed LOAD is almost always the profile:admin guard refusing, so it
  // replaces the screen and explains the rule.
  if (error) {
    return (
      <Alert variant="destructive">
        <Info className="size-4" aria-hidden="true" />
        <AlertTitle>Modules cannot be configured from this account</AlertTitle>
        <AlertDescription>
          {error} Only an administrator can turn modules on or off. This entry appears in the menu
          for every role, which is why you were able to reach it.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/*
        A failed SAVE sits above the grid, which stays exactly as it was. The
        person's selections are still on screen and still theirs to retry - the
        opposite of replacing the page and losing them.
      */}
      {saveError && (
        <Alert variant="destructive">
          <Info className="size-4" aria-hidden="true" />
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : modules.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-muted-foreground">
          No modules are available to configure.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map((module) => (
            <ModuleCard key={module.id} module={module} onToggle={toggle} />
          ))}
        </div>
      )}

      {!loading && modules.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {/*
            The legend used to print "Mandatory / Required Module" and
            "Optional / Optional Module" - the same word twice, in two columns.
            Three states, each named once, each matching what the cards render.
          */}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" />
            On
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-sm border border-border" aria-hidden="true" />
            Off
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-sm border border-border bg-surface-muted" aria-hidden="true" />
            Always on — cannot be switched off
          </span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {enabledCount} of {modules.length} on
          </span>
        </div>
      )}

      {note && (
        <Alert variant="info">
          <Info className="size-4" aria-hidden="true" />
          <AlertTitle>What switching a module on does</AlertTitle>
          <AlertDescription>
            {/* The server's own sentence, rendered rather than paraphrased, so
                the screen cannot drift from what the endpoint actually does. */}
            {note} Main Dashboard and Organizational Management stay on, because they hold the
            screens you would need to turn anything back on.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
