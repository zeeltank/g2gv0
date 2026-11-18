'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { CustomersView } from '@/components/domain/gtm/customers-view'

export default function GtmCustomersPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <CustomersView />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
