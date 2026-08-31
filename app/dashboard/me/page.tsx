'use client'

import { lazy, Suspense } from 'react'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { MeDashboard } from '@/components/domain/main-dashboard/me/me-dashboard'
import { HOME_NAV } from '@/hooks/use-navigation'

const LazyGtgAppShell = lazy(() =>
  import('@/components/shell/gtg-app-shell').then((module) => ({ default: module.GtgAppShell })),
)

/**
 * /dashboard/me — THE EMPLOYEE'S OWN DASHBOARD, ALWAYS.
 *
 * The destination behind tblmenumaster_g2g row 302, "My Dashboard".
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS WHEN /dashboard ALREADY RENDERS IT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * /dashboard is a ROLE SWITCH: admins and HR get the organisation dashboard,
 * everyone else gets this one. The switch reads `user.role`, which
 * mapProfileNameToRole() derives by substring-matching a tenant-editable
 * profile NAME — main-dashboard.tsx says in its own comment that this is unfit
 * as a security boundary.
 *
 * That made the employee dashboard reachable but not addressable: nothing could
 * link to it, no menu could carry it, and an administrator could not see their
 * own tasks and capability at all, because the switch always sent them to the
 * organisation view.
 *
 * This route is unconditional. No role is consulted, because none is needed:
 * /api/dashboard/me/* accepts NO subject parameter and resolves the caller from
 * the token, so this page shows the signed-in person their own data and there
 * is no id anywhere on it that could ask for anybody else's.
 *
 * NO GUARD, AND THAT IS THE DESIGN. Every authenticated employee may see their
 * own dashboard; there is nothing here to protect. The menu row controls
 * whether it is OFFERED — the endpoint controls what is SERVED, and it always
 * serves the caller.
 */
export default function MyDashboardPage() {
  return (
    <ProtectedLayout>
      <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
        {/* initialActive pins the shell to the dashboard entry, exactly as
            /dashboard does, so the sidebar highlights correctly on a cold load
            instead of waiting for the menu tree to arrive. */}
        <LazyGtgAppShell initialActive={HOME_NAV}>
          <MeDashboard />
        </LazyGtgAppShell>
      </Suspense>
    </ProtectedLayout>
  )
}
