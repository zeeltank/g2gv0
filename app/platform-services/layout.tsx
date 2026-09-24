'use client'

/**
 * The frame every Platform Services screen sits in.
 *
 * WHY THESE ARE REAL ROUTES AND NOT MODULE-SHELL SCREENS
 *
 * Almost every screen in G2G is reached through `/module/{moduleId}/{menuId}/{submenuId}`,
 * resolved from `tblmenumaster_g2g` and gated by that profile's rights rows. Platform
 * Services deliberately is not, for the same reason AI & Intelligence is not and
 * "Create an organisation" is not: the menu catalogue is the CUSTOMER'S navigation, and
 * these are platform administration screens that configure what every module then uses.
 * Putting them in the catalogue would also mean nobody could open one until rights rows
 * had been written for every profile on the estate.
 *
 * They still get the product's chrome — sidebar, header, breadcrumb — from
 * `GtgPageShell`, so this does not feel like a second application bolted on.
 *
 * `initialActive` names no module on purpose. These pages are outside the module tree,
 * so nothing in the sidebar should light up as though one of them were open, and the
 * breadcrumb is supplied explicitly rather than resolved from a tree that does not
 * contain this page.
 *
 * ── WHY `/platform-services` AND NOT `/platform` ────────────────────────────
 *
 * `/platform/organizations/new` already exists. It brings its own `ProtectedLayout` and
 * deliberately carries NO role check — its note explains that `platform.owner` on the
 * endpoint is the control, and that a second copy of that rule in the frontend is the
 * kind that drifts. A layout at `app/platform/` would wrap that page in a second
 * `ProtectedLayout` and hand an internal operator's screen a "Platform Services"
 * breadcrumb it does not belong under. Two trees, kept apart.
 */

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'

export default function PlatformServicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedLayout>
      <GtgPageShell
        initialActive={{ moduleId: '', menuId: '', submenuId: '' }}
        breadcrumbItems={[
          { label: 'Home', href: '/' },
          { label: 'Platform Services', href: '/platform-services' },
        ]}
      >
        {children}
      </GtgPageShell>
    </ProtectedLayout>
  )
}
