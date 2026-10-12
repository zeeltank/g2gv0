'use client'

/** Cross-link to the already-shipped SMS Notifier screen (built under Sales) - same component, a second access_link/menu entry, no new business logic. */

import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { ProtectedLayout } from '@/components/auth/protected-layout'

export default function CrmSupportSmsNotifierPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell />
    </ProtectedLayout>
  )
}
