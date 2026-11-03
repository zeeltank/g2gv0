'use client'

import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { ProtectedLayout } from '@/components/auth/protected-layout'

// The screen itself comes from the content map (hooks/content-map-crm.ts), found by this route's menu row.
export default function CrmSignalReviewPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell />
    </ProtectedLayout>
  )
}
