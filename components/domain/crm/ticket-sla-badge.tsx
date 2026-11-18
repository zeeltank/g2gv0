/**
 * Sales & Marketing gap-closure, Wave 4 - shared SLA status badge, used by
 * both the Tickets list and the ticket detail page so the two can never
 * show different wording/colors for the same `slaStatus` value.
 *
 * Wave 6 adds the optional `escalatedAt` - same sharing rationale: a
 * breached ticket that has already been escalated must read the same way
 * everywhere it shows up, not just on the detail page.
 */

import { StatusBadge } from '@/components/ui/status-badge'
import type { CrmTicket } from '@/types/crm'

const LABEL: Record<CrmTicket['slaStatus'], string> = {
  no_policy: 'No SLA', within_sla: 'On Track', breached: 'SLA Breached', met: 'SLA Met',
}

const VARIANT: Record<CrmTicket['slaStatus'], 'default' | 'success' | 'warning' | 'error'> = {
  no_policy: 'default', within_sla: 'success', breached: 'error', met: 'success',
}

export function TicketSlaBadge({ status, dueAt, escalatedAt }: { status: CrmTicket['slaStatus']; dueAt: string | null; escalatedAt?: string | null }) {
  const escalated = status === 'breached' && !!escalatedAt
  const title = [dueAt ? `Due ${dueAt}` : null, escalated ? `Escalated ${escalatedAt}` : null].filter(Boolean).join(' · ') || undefined

  return (
    <StatusBadge variant={VARIANT[status]} title={title}>
      {LABEL[status]}{escalated ? ' · Escalated' : ''}
    </StatusBadge>
  )
}
