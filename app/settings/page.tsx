'use client'

import { Suspense } from 'react'
import { SettingsShell } from '@/components/settings/settings-shell'

/**
 * `/settings` — a hub, at last.
 *
 * It used to be `redirect('/settings/module-configuration')`, and before that
 * `redirect('/settings/portal-review')`, which made the default settings landing
 * page a screen whose every number was hardcoded to zero.
 *
 * ── WHY THE Suspense BOUNDARY ───────────────────────────────────────────────
 *
 * `SettingsShell` reads `?s=` with `useSearchParams`, which Next requires to sit
 * inside one. Without it the whole route opts out of static generation and the
 * build warns.
 */
export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-[70vh] rounded-2xl bg-muted/40" />}>
      <SettingsShell />
    </Suspense>
  )
}
