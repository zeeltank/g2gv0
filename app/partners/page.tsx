'use client'

import { PremiumPage } from '@/components/domain/signals/premium-page'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { getLaravelContext } from '@/lib/laravel-context'
import { PartnersView } from '@/components/domain/portfolio/partners-view'

export default function PartnerNetworkPage() {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const canManage = user?.role === 'administrator' || user?.role === 'hr_manager' || user?.role === 'executive'

  return (
    <ProtectedLayout>
      <GtgPageShell>
        <PremiumPage>
          <PartnersView context={context} canManage={canManage} />
        </PremiumPage>
      </GtgPageShell>
    </ProtectedLayout>
  )
}

