'use client'

import { Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SETTINGS_SECTIONS, type SettingsSectionId } from '@/lib/settings-sections'

/**
 * THE FALLBACK, and no longer a "coming soon" page.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE SHRANK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It used to describe five unbuilt sections — what each would change, and where
 * that setting lived in the meantime. Every one of them has since shipped: Email
 * & SMS, Organisation defaults, Roles & access, Security policy and Audit.
 *
 * So the copy went with them. A "not built yet" page for a section that IS built
 * is its own dead control — it looks informative and is simply wrong, and the
 * person reading it would go looking for the thing it says is missing.
 *
 * What is left is the case that should never happen: a section id the shell
 * cannot render. That is a bug rather than a roadmap, and it reads as one.
 *
 * ── THE `soon` MECHANISM STAYS ──────────────────────────────────────────────
 *
 * Nothing sets it today. It is kept because the next section to be planned will
 * want it, and because rebuilding the honest-labelling machinery from scratch is
 * how a product ends up shipping the unlabelled version instead.
 */
export function ComingSoonSection({ id }: { id: SettingsSectionId | undefined }) {
  const section = SETTINGS_SECTIONS.find((entry) => entry.id === id)

  if (!section) {
    return (
      <Alert>
        <Info className="size-4" aria-hidden="true" />
        <AlertDescription>Pick a section from the list to get started.</AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert>
      <Info className="size-4" aria-hidden="true" />
      <AlertDescription>
        <strong>{section.label}</strong> could not be opened. Every section in this list is built,
        so this is a fault rather than something missing — please report it, and try another
        section in the meantime.
      </AlertDescription>
    </Alert>
  )
}
