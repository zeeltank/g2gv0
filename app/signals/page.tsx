'use client'

import { PremiumPage } from '@/components/domain/signals/premium-page'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { SignalsPageContent } from '@/components/domain/signals/signals-page-content'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'

export default function SignalsPage() {
  const { parseRoutePath } = useSidebarNavigation()
  const activeNav = parseRoutePath('/signals') ?? undefined

  return (
    <ProtectedLayout>
      <GtgAppShell initialActive={activeNav}>
        <PremiumPage>
          <SignalsPageContent />
        </PremiumPage>
      </GtgAppShell>
    </ProtectedLayout>
  )
}
