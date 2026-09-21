'use client'

/**
 * The frame every AI & Intelligence screen sits in.
 *
 * WHY THESE ARE REAL ROUTES AND NOT MODULE-SHELL SCREENS
 *
 * Almost every screen in G2G is reached through `/module/{moduleId}/{menuId}/{submenuId}`,
 * resolved from `tblmenumaster_g2g` and gated by that profile's rights rows. AI &
 * Intelligence deliberately is not, for the same reason "Create an organisation" is
 * not in `gtg-user-menu.tsx`: the menu catalogue is the CUSTOMER'S navigation, and
 * these are platform administration screens that configure the AI every module then
 * uses. Putting them in the catalogue would also mean nobody could open one until
 * rights rows had been written for every profile on the estate.
 *
 * They still get the product's chrome — sidebar, header, breadcrumb — from
 * `GtgPageShell`, so this does not feel like a second application bolted on.
 *
 * `initialActive` names no module on purpose. These pages are outside the module
 * tree, so nothing in the sidebar should light up as though one of them were open,
 * and the breadcrumb is supplied explicitly rather than resolved from a tree that
 * does not contain this page.
 */

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedLayout>
      <GtgPageShell
        initialActive={{ moduleId: '', menuId: '', submenuId: '' }}
        breadcrumbItems={[
          { label: 'Home', href: '/' },
          { label: 'AI & Intelligence', href: '/ai' },
        ]}
      >
        {children}
      </GtgPageShell>
    </ProtectedLayout>
  )
}
