'use client'

import { Shield } from 'lucide-react'

export function ConsentListView() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center px-6">
      <Shield className="size-10 text-muted-foreground/40" />
      <h2 className="text-lg font-semibold">Consent &amp; Preferences</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Manage communication consent and channel preferences for leads and contacts. Full UI coming soon.
      </p>
    </div>
  )
}
