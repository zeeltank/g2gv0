'use client'

/**
 * Reusable "Emails" tab body - wired onto Lead/Contact/Organization/
 * Opportunity/Ticket detail pages (see this phase's own integration report
 * for the exact splice block each of those 5 hot files needs). Purely
 * presentational: data loading and the compose dialog's open/close state are
 * both owned by the wrapping detail page, same convention
 * ticket-detail-page.tsx's own inline Comments tab already uses - this
 * component just renders what it is given and asks its parent to open
 * SendEmailDialog.
 *
 * NOT a copy of ticket-detail-page.tsx's Comments tab (that stays untouched,
 * per this phase's own ground rules) - a CRM Email is a real send attempt
 * against an external address (status Queued/Sending/Sent/Failed), not a
 * plain internal note, so this renders a status badge and a failure reason
 * instead of a flat comment bubble.
 */

import { Loader2, Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { SectionCard } from '@/components/shared/business/shared'
import type { CrmEmailLinkEntry } from '@/types/crm'

interface Props {
  emails: CrmEmailLinkEntry[]
  loading: boolean
  onCompose: () => void
}

function statusVariant(status: string | null): 'success' | 'error' | 'pending' | 'default' {
  switch (status) {
    case 'Sent': return 'success'
    case 'Failed': return 'error'
    case 'Queued':
    case 'Sending': return 'pending'
    default: return 'default'
  }
}

export function CrmEmailTab({ emails, loading, onCompose }: Props) {
  return (
    <SectionCard
      title="Emails"
      description="Every email composed against this record, whether or not it was actually sent - see each row's own status."
      actions={(
        <Button size="sm" onClick={onCompose}>
          <Send className="mr-1.5 size-4" aria-hidden="true" />
          Compose Email
        </Button>
      )}
    >
      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading emails…
        </div>
      )}
      {!loading && emails.length === 0 && (
        <EmptyState
          icon={<Mail className="size-8" aria-hidden="true" />}
          title="No emails yet"
          description="Compose an email to reach this record directly."
          action={(
            <Button size="sm" onClick={onCompose}>
              <Send className="mr-1.5 size-4" aria-hidden="true" />
              Compose Email
            </Button>
          )}
        />
      )}
      {!loading && emails.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border">
          {emails.map((row) => (
            <div key={row.id} className="space-y-1.5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-foreground">{row.subject}</p>
                <StatusBadge variant={statusVariant(row.status)}>{row.status ?? 'Draft'}</StatusBadge>
              </div>
              <p className="truncate text-xs text-muted-foreground">To {row.toAddress}</p>
              {row.status === 'Failed' && row.failureReason && (
                <p className="text-xs text-destructive">{row.failureReason}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {row.createdByName || 'Unknown'} · {row.sentAt || row.createdAt}
              </p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}
