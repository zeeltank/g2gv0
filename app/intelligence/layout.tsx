'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { IntelligenceProvider } from '@/components/domain/intelligence'

/**
 * The frame of every Intelligence route (/intelligence, a domain, an area, a finding). It stays mounted while a person moves between them, so the
 * shell is not rebuilt and the provider's one load (the detectors this person may see and every open insight) is shared: drilling down is instant.
 * The provider sits inside the sign-in check, so nothing is requested before the session is known. The server decides what this person may see; the
 * pages show a clear state when it says no.
 */
export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <IntelligenceProvider>{children}</IntelligenceProvider>
      </GtgAppShell>
    </ProtectedLayout>
  )
}
