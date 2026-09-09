'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import {
  ModuleConfiguration,
  type ModuleConfigurationHandle,
} from '@/components/settings/module-configuration'

/**
 * MODULE CONFIGURATION as a standalone settings page.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT CHANGED, AND WHY EACH ONE MATTERED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── IT HAS A WAY BACK ───────────────────────────────────────────────────────
 *
 * There was exactly one button on the page - "Save and continue" - and it always
 * pushed to `/organization/setup`, whether or not that is where you came from.
 * No Back, no Cancel, no breadcrumb, and the old wizard shell replaced the app
 * shell entirely, so the browser Back button was the only exit from a settings
 * screen reached from the avatar menu.
 *
 * Back now returns to where you actually came from: `?from=` when a caller says
 * so, otherwise the dashboard. `router.back()` is deliberately not used - it is
 * used nowhere in this product, and after a redirect it walks somebody back into
 * the page that redirected them.
 *
 * ── IT SITS INSIDE THE APP SHELL ────────────────────────────────────────────
 *
 * Sidebar, header and breadcrumb, like every other settings screen. The wizard
 * chrome belongs to the wizard; this is a page you visit to change your mind
 * about a module six months later.
 *
 * ── ITS COPY NO LONGER PROMISES THINGS THAT DO NOT EXIST ────────────────────
 *
 * It said "You can complete, skip, or mark modules as not needed" and, at the
 * bottom, "You can skip any module in the next step". There was no skip control
 * and no next step. It also announced "STEP 2 OF 8" from a step list belonging
 * to a wizard that had been deleted.
 *
 * ── SAVING SAYS WHAT HAPPENED ───────────────────────────────────────────────
 *
 * The old flow set a `modulesCompleted` flag and navigated away two lines later,
 * so the state could never be observed and the person never saw a confirmation -
 * they just found themselves on a different screen.
 */
export function ModuleConfigurationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  /*
   * STATE, NOT A REF - the same hole ModulesSection had.
   *
   * `ModuleConfiguration` publishes its handle on mount, while `loading` is
   * still true and the module list is still empty, and a ref does not re-render
   * this page when that flips. So Save was live from the first paint, and the
   * payload it sends is the COMPLETE set of modules that should be on: an early
   * click sent an empty set and switched every optional module off for the whole
   * organisation.
   */
  const [handle, setHandle] = useState<ModuleConfigurationHandle | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<number | null>(null)

  const ready = handle !== null && !handle.loading && !handle.saving

  // A caller that knows where it sent somebody can say so. Anything not starting
  // with '/' is ignored - a `from` a person can type must not become an open
  // redirect.
  const from = searchParams.get('from')
  const backHref = from?.startsWith('/') ? from : '/dashboard'

  async function save() {
    if (!handle || !ready) return

    setBusy(true)
    // The confirmation comes from onSaved, which the child fires with the count
    // it actually persisted - reading the count back out here would be reading
    // it from a render that may already have moved on.
    setSaved(null)
    await handle.save()
    setBusy(false)
  }

  return (
    <ProtectedLayout>
      <GtgPageShell
        breadcrumbItems={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Settings' },
          { label: 'Modules' },
        ]}
      >
        <GtgBreadcrumbFromContext />

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">
              Modules
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Switching a module on adds its screens to the administrator&rsquo;s navigation.
              Switching one off hides them; nothing is deleted, and you can turn it back on here
              at any time.
            </p>
          </div>

          <Button variant="outline" onClick={() => router.push(backHref)} className="shrink-0">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
        </div>

        {saved !== null && (
          <Alert variant="success" className="mb-5">
            <Check className="size-4" aria-hidden="true" />
            <AlertDescription>
              Saved. {saved} {saved === 1 ? 'module is' : 'modules are'} on, and the navigation has
              been updated.
            </AlertDescription>
          </Alert>
        )}

        <ModuleConfiguration onReady={setHandle} onSaved={setSaved} />

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => router.push(backHref)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !ready}>
            {busy ? 'Saving…' : handle?.loading ? 'Loading…' : 'Save modules'}
          </Button>
        </div>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
