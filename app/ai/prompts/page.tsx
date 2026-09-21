'use client'

/**
 * Template Management — the listing.
 *
 * A static route, so it takes precedence over `app/ai/[capability]/page.tsx` for this
 * slug. View and Edit are their own routes — `/ai/prompts/[id]` and
 * `/ai/prompts/[id]/edit` — rather than panels rendered under the table, so a
 * template can be linked to and a half-finished edit survives a reload.
 *
 * WHY THE ROUTE IS `prompts` AND THE LABEL IS "Template Management"
 *
 * The capability's slug is its identifier, not its label. Renaming the capability is
 * a label change in the registry; renaming the slug would be a route change and a
 * dead bookmark for anyone who already had one.
 */

import { CapabilityShell } from '../_components/CapabilityShell'
import { TemplateList } from '../_components/TemplateList'

export default function AiTemplatesPage() {
  return (
    <CapabilityShell slug="prompts">
      <TemplateList />
    </CapabilityShell>
  )
}
