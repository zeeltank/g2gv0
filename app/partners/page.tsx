'use client'

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
        <PartnersView context={context} canManage={canManage} />
      </GtgPageShell>
    </ProtectedLayout>
  )
}

