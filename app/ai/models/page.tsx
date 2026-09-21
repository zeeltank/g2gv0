'use client'

/**
 * Model Management — the catalogue every model dropdown reads.
 *
 * A static route, so it takes precedence over `app/ai/[capability]/page.tsx` for this
 * slug. The registry description and the live panel are unchanged, by the shared
 * `CapabilityShell`; the catalogue table and its Add/Edit controls are added below.
 */

import { CapabilityShell } from '../_components/CapabilityShell'
import { ModelManager } from '../_components/ModelManager'

export default function AiModelsPage() {
  return (
    <CapabilityShell slug="models">
      <ModelManager />
    </CapabilityShell>
  )
}
