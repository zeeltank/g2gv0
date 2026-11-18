'use client'

import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { ProtectedLayout } from '@/components/auth/protected-layout'

export default function CrmPriceBooksPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell />
    </ProtectedLayout>
  )
}
