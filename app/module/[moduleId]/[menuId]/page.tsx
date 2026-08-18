'use client'

import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { ProtectedLayout } from '@/components/auth/protected-layout'

export default function ModuleMenuPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell />
    </ProtectedLayout>
  )
}
