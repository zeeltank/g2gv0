'use client'

import { SETTINGS_SECTIONS, type SettingsSectionId } from '@/lib/settings-sections'
import { SectionEmpty, SectionError } from './section-primitives'

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

  /*
   * TWO STATES, TWO PRIMITIVES — NOT TWO IDENTICAL ALERTS.
   *
   * Both branches rendered the same `<Alert>` with the same `Info` icon, so a
   * prompt ("pick a section") and a fault ("this one could not be opened") were
   * visually indistinguishable. One is the normal first frame of a fresh visit;
   * the other means something is broken.
   *
   * `SectionEmpty` and `SectionError` are the product's own vocabulary for
   * exactly this distinction, and both were sitting unused in
   * `section-primitives.tsx` while this file hand-rolled the ambiguous version.
   */
  if (!section) {
    return (
      <SectionEmpty
        title="Nothing selected"
        description="Pick a section from the list to get started."
      />
    )
  }

  return (
    <SectionError
      title={`${section.label} could not be opened`}
      description="Every section in this list is built, so this is a fault rather than something missing. Please report it, and try another section in the meantime."
    />
  )
}
