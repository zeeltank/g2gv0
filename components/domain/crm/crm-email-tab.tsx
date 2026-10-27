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

import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, Loader2, Mail, Send } from 'lucide-react'
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
    case 'Received': return 'success'
    case 'Failed': return 'error'
    case 'Queued':
    case 'Sending': return 'pending'
    default: return 'default'
  }
}

export function CrmEmailTab({ emails, loading, onCompose }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

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
          {emails.map((row) => {
            const isInbound = row.direction === 'inbound' || row.status === 'Received'
            const isExpanded = expandedId === row.id

            return (
              <div
                key={row.id}
                className="cursor-pointer space-y-1.5 p-3.5 transition-colors hover:bg-muted/30"
                onClick={() => toggleExpand(row.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpand(row.id) }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isInbound ? (
                      <span className="flex size-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400" title="Inbound Reply">
                        <ArrowDownLeft className="size-3.5" />
                      </span>
                    ) : (
                      <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" title="Outbound Outreach">
                        <ArrowUpRight className="size-3.5" />
                      </span>
                    )}
                    <p className="text-sm font-semibold text-foreground">{row.subject}</p>
                    <span className="text-xs text-muted-foreground">#{row.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge variant={statusVariant(row.status)}>{row.status ?? 'Draft'}</StatusBadge>
                    {isExpanded ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {isInbound ? (
                    <span><strong>From:</strong> {row.fromAddress || 'Prospect'}</span>
                  ) : (
                    <span><strong>To:</strong> {row.toAddress}</span>
                  )}
                  {isInbound && <span><strong>To:</strong> {row.toAddress}</span>}
                  <span>&middot;</span>
                  <span>{row.createdByName || (isInbound ? 'Customer' : 'Scholar Clone')}</span>
                  <span>&middot;</span>
                  <span>{row.sentAt || row.createdAt}</span>
                </div>

                {row.status === 'Failed' && row.failureReason && (
                  <p className="text-xs text-destructive">{row.failureReason}</p>
                )}

                {/* Expanded Email Body Preview */}
                {isExpanded && row.body && (
                  <div className="mt-2.5 rounded-md border border-border/70 bg-muted/40 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                    {row.body}
                  </div>
                )}
                {!isExpanded && row.body && (
                  <p className="line-clamp-1 text-xs text-muted-foreground italic">
                    {row.body.replace(/\n+/g, ' ')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}
