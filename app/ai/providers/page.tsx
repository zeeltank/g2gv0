'use client'

/**
 * AI Providers — description, live rows, and the controls that change them.
 *
 * A static route, so it takes precedence over `app/ai/[capability]/page.tsx` for this
 * slug. Everything that page shows is still shown, by the shared `CapabilityShell`;
 * this file only adds the management section underneath.
 */

import { CapabilityShell } from '../_components/CapabilityShell'
import { ConfigurationManager } from '../_components/ConfigurationManager'

export default function AiProvidersPage() {
  return (
    <CapabilityShell slug="providers">
      <ConfigurationManager />
    </CapabilityShell>
  )
}
