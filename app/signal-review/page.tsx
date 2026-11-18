'use client'

import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { ProtectedLayout } from '@/components/auth/protected-layout'

// The menu row's access link is /signal-review, so the sidebar sends people here; the screen comes from the content map (hooks/content-map-crm.ts).
export default function SignalReviewPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell />
    </ProtectedLayout>
  )
}
