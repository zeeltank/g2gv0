'use client'

/**
 * Outreach Approval Queue — lists messages awaiting human review before
 * they are sent. Supports Pending | Approved | Rejected | All filter tabs.
 * Approve/reject actions are gated here; only after approval can the message
 * be marked sent via markOutreachSent().
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, MessageSquareWarning, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { OutreachApproval, OutreachApprovalStatus } from '@/types/crm'

type FilterTab = OutreachApprovalStatus | 'all'

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
]

function statusVariant(status: OutreachApprovalStatus): 'pending' | 'success' | 'error' | 'default' {
  if (status === 'pending') return 'pending'
  if (status === 'approved' || status === 'sent') return 'success'
  if (status === 'rejected') return 'error'
  return 'default'
}

function statusLabel(status: OutreachApprovalStatus): string {
  if (status === 'sent') return 'Sent'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDate(raw: string | null): string {
  if (!raw) return '—'
  return new Date(raw.replace(' ', 'T')).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

interface RejectDialogState {
  approvalId: string
  reason: string
}

export function OutreachApprovalQueue() {
  const context = useMemo(() => getLaravelContext(), [])

  const [tab, setTab] = useState<FilterTab>('pending')
  const [items, setItems] = useState<OutreachApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectDialog, setRejectDialog] = useState<RejectDialogState | null>(null)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await crmService.getOutreachApprovals(context, tab === 'all' ? undefined : tab)
      setItems(res.data.items)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load approvals.')
    } finally {
      setLoading(false)
    }
  }, [context, tab])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const handleApprove = async (id: string) => {
    if (!isLaravelContextReady(context)) return
    setBusyId(id)
    setError('')
    try {
      await crmService.approveOutreach(context, id)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to approve.')
    } finally {
      setBusyId(null)
    }
  }

  const handleRejectConfirm = async () => {
    if (!rejectDialog || !isLaravelContextReady(context)) return
    const { approvalId, reason } = rejectDialog
    if (!reason.trim()) return
    setBusyId(approvalId)
    setRejectDialog(null)
    setError('')
    try {
      await crmService.rejectOutreach(context, approvalId, reason.trim())
      await load()
    } catch (reason2) {
      setError(reason2 instanceof Error ? reason2.message : 'Unable to reject.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Reject reason dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Reject Message</h2>
            <p className="text-xs text-muted-foreground">Provide a reason so the requester knows what to fix.</p>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={3}
              placeholder="Rejection reason…"
              value={rejectDialog.reason}
              onChange={(e) => setRejectDialog((prev) => prev ? { ...prev, reason: e.target.value } : null)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRejectDialog(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!rejectDialog.reason.trim() || busyId === rejectDialog.approvalId}
                onClick={() => void handleRejectConfirm()}
              >
                {busyId === rejectDialog.approvalId
                  ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                  : <XCircle className="mr-1.5 size-3.5" aria-hidden="true" />}
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Outreach Approvals</h2>
        <Button variant="outline" size="sm" onClick={() => void load()}>Refresh</Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {FILTER_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading approvals…
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <EmptyState
          icon={<MessageSquareWarning className="size-8" aria-hidden="true" />}
          title="No messages here"
          description={tab === 'pending' ? 'No messages are waiting for your review.' : `No ${tab} messages.`}
        />
      )}

      {!loading && items.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border">
          {items.map((item) => {
            const isExpanded = expandedId === item.id
            const isBusy = busyId === item.id
            return (
              <div key={item.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {item.subject || '(No subject)'}
                      </p>
                      <StatusBadge variant={statusVariant(item.status)}>
                        {statusLabel(item.status)}
                      </StatusBadge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {item.campaignName && <span>Campaign: <strong>{item.campaignName}</strong></span>}
                      {item.targetName && <span>To: <strong>{item.targetName}</strong>{item.targetType ? ` (${item.targetType})` : ''}</span>}
                      {item.channel && item.channel !== 'email' && <span>Channel: <strong>{item.channel}</strong></span>}
                      <span>Requested: {formatDate(item.createdAt)}</span>
                      {item.requestedByName && <span>by <strong>{item.requestedByName}</strong></span>}
                    </div>
                    {item.rejectionReason && (
                      <p className="mt-1 text-xs text-destructive">Rejected: {item.rejectionReason}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId((prev) => prev === item.id ? null : item.id)}
                    >
                      {isExpanded ? 'Hide' : 'Preview'}
                    </Button>
                    {item.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void handleApprove(item.id)}
                          className="bg-success/90 hover:bg-success text-white border-0"
                        >
                          {isBusy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 size-3.5" />}
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => setRejectDialog({ approvalId: item.id, reason: '' })}
                        >
                          <XCircle className="mr-1.5 size-3.5" aria-hidden="true" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && item.body && (
                  <div className="rounded-md border border-border/70 bg-muted/40 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                    {item.body}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
