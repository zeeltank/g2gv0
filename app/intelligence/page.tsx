'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { IntelligenceOverview } from '@/components/domain/intelligence'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'

/**
 * /intelligence - a separate, additive page. It is not in the sidebar (that tree is stored in tblmenumaster_g2g and
 * changing it is a data and rights decision); it is reached from the panel on the HR Home dashboard or by URL.
 * Access is enforced by the API (`profile:admin,hr`), not by this file.
 */
export default function IntelligencePage() {
  return (
    <ProtectedLayout>
      <GtgAppShell initialActive={{ moduleId: 'intelligence', menuId: 'intelligence', submenuId: 'intelligence' }}>
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <IntelligenceOverview />
        </div>
      </GtgAppShell>
    </ProtectedLayout>
  )
}
