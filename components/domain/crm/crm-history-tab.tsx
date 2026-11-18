'use client'

import { History as HistoryIcon, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionCard } from '@/components/shared/business/shared'
import type { CrmAuditEntry } from '@/types/crm'

interface Props {
  entries: CrmAuditEntry[]
  loading: boolean
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

/** snake_case/camelCase column name -> a readable label, same spirit as every detail page's own ReadField labels. */
function fieldLabel(field: string): string {
  const spaced = field.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Generic "who changed what, when" tab - presentational only, no fetching of
 * its own. The host detail page owns loading `CrmAuditEntry[]` from its own
 * `GET .../{id}/history` endpoint (the trait every backend controller in
 * this phase mixes in) and passes it straight through here, same division
 * of responsibility every other narrower xxx-history tab in this codebase
 * already uses (e.g. QuoteDetailPage's own Stage History block loads then
 * renders inline) - this one is just reusable across 9 entities instead of
 * living inline in one page.
 *
 * Deliberately NOT used by Opportunity/Quote/SalesOrder/PurchaseOrder/
 * Invoice/Ticket - each already has its own narrower stage/status-history
 * tab, and showing both would answer the same "what happened here" question
 * twice on one page. Also not used by PriceBook, which has no tab system at
 * all yet (see this phase's integration report for that one).
 */
export function CrmHistoryTab({ entries, loading }: Props) {
  return (
    <SectionCard title="History" description="Every change recorded against this record, newest first.">
      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading history…
        </div>
      )}
      {!loading && entries.length === 0 && (
        <EmptyState
          icon={<HistoryIcon className="size-8" aria-hidden="true" />}
          title="No history recorded yet"
          description="Changes made to this record will show up here."
        />
      )}
      {!loading && entries.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border">
          {entries.map((entry) => (
            <div key={entry.id} className="space-y-2 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-foreground">{entry.actorName ?? 'System'}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{entry.occurredAt}</span>
              </div>
              {entry.changes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No field-level changes recorded.</p>
              ) : (
                <ul className="space-y-1">
                  {entry.changes.map((change, index) => (
                    <li key={index} className="text-foreground">
                      <span className="font-medium">{fieldLabel(change.field)}</span>
                      {': '}
                      <span className="text-muted-foreground line-through">{formatValue(change.oldValue)}</span>
                      {' → '}
                      <span>{formatValue(change.newValue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}
