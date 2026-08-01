'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Check, ExternalLink, Layers, ListChecks, Network, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useApprovalQueue } from '@/hooks/use-competency-approvals'
import type { ApprovalRequest, ApprovalStatus, ApprovalSubjectType } from '@/services/competency'

const STATUSES: ApprovalStatus[] = ['pending', 'approved', 'rejected']

const SUBJECT_META: Record<
  ApprovalSubjectType,
  { label: string; icon: typeof BookOpen; submenu: string }
> = {
  competency: { label: 'Competency', icon: BookOpen, submenu: 'cm-competency-library' },
  framework: { label: 'Framework', icon: Layers, submenu: 'cm-framework-mapping' },
  'role-mapping': { label: 'Role Mapping', icon: Network, submenu: 'cm-framework-mapping' },
}

const FILTERS: { label: string; value: ApprovalSubjectType | 'all' }[] = [
  { label: 'Everything', value: 'all' },
  { label: 'Competencies', value: 'competency' },
  { label: 'Frameworks', value: 'framework' },
  { label: 'Role Mappings', value: 'role-mapping' },
]

/**
 * The module's approval inbox.
 *
 * Competencies and frameworks are actioned here. Role-mapping reviews are shown
 * for completeness but keep their own approve/reject in Framework & Role
 * Mapping, which carries the per-competency change detail a reviewer needs.
 */
export function ApprovalQueue() {
  const router = useRouter()

  const [status, setStatus] = useState<ApprovalStatus>('pending')
  const [subject, setSubject] = useState<ApprovalSubjectType | 'all'>('all')
  const [rejecting, setRejecting] = useState<ApprovalRequest | null>(null)
  const [note, setNote] = useState('')

  const {
    items, counts, loading, error, saving,
    actionMessage, actionError, retry, decide, bulkApprove, clearMessages,
  } = useApprovalQueue(status, subject === 'all' ? undefined : subject)

  const actionable = items.filter((item) => item.source === 'approval' && item.status === 'pending')

  const openSubject = (item: ApprovalRequest) => {
    const meta = SUBJECT_META[item.subject_type]
    if (!meta) return
    const params =
      item.subject_type === 'competency'
        ? `?${new URLSearchParams({ competency_id: String(item.subject_id) }).toString()}`
        : ''
    router.push(`/module/m2/${meta.submenu}/${meta.submenu}${params}`)
  }

  const confirmReject = async () => {
    if (!rejecting) return
    const result = await decide(rejecting.id, 'reject', note.trim() || undefined)
    if (result.ok) {
      setRejecting(null)
      setNote('')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status + subject filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-muted p-1">
            {STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-bold capitalize transition-colors',
                  status === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                {value} ({counts[value]})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSubject(filter.value)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                  subject === filter.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent',
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          disabled={saving || actionable.length === 0}
          onClick={() => bulkApprove(actionable.map((item) => item.id))}
          className="h-9 gap-2 font-semibold"
        >
          <ListChecks className="h-4 w-4" /> Approve All ({actionable.length})
        </Button>
      </div>

      {(actionMessage || actionError) && (
        <div
          className={cn(
            'flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-medium',
            actionError
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600',
          )}
        >
          <span>{actionError || actionMessage}</span>
          <button onClick={clearMessages} className="text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {error ? (
        <ErrorState title="Couldn't load the approval queue" description={error} retry={retry} />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          className="border-0"
          icon={<ListChecks className="h-10 w-10" />}
          title={`Nothing ${status}`}
          description={
            status === 'pending'
              ? 'Competencies and frameworks submitted for approval land here.'
              : `No ${status} requests yet.`
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const meta = SUBJECT_META[item.subject_type]
            const Icon = meta?.icon ?? BookOpen
            const canAct = item.source === 'approval' && item.status === 'pending'

            return (
              <div
                key={`${item.source}-${item.id}`}
                className="flex flex-col rounded-xl border border-border bg-background p-5 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-foreground">
                        {item.subject_name || 'Untitled'}
                      </h3>
                      <p className="text-xs text-muted-foreground">{meta?.label ?? item.subject_type}</p>
                    </div>
                  </div>
                  <StatusBadge status={item.status} label={item.status} size="sm" />
                </div>

                <div className="mb-4 flex-1 space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Submitted by</span>
                    <span className="truncate font-medium text-foreground">{item.submitted_by_name || 'System'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Submitted</span>
                    <span className="font-medium text-foreground">{item.submitted_at || '—'}</span>
                  </div>
                  {item.changes_count !== null && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Modifications</span>
                      <span className="font-bold text-primary">{item.changes_count} competencies</span>
                    </div>
                  )}
                  {item.reviewer_name && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Reviewed by</span>
                      <span className="truncate font-medium text-foreground">{item.reviewer_name}</span>
                    </div>
                  )}
                  {item.note && <p className="pt-1 text-xs italic text-muted-foreground">“{item.note}”</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  {canAct ? (
                    <>
                      <Button
                        variant="outline"
                        disabled={saving}
                        onClick={() => decide(item.id, 'approve')}
                        className="flex-1 border-success/20 bg-success/10 text-success hover:bg-success/20"
                      >
                        <Check className="mr-2 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        variant="outline"
                        disabled={saving}
                        onClick={() => {
                          clearMessages()
                          setNote('')
                          setRejecting(item)
                        }}
                        className="flex-1 border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20"
                      >
                        <X className="mr-2 h-4 w-4" /> Reject
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => openSubject(item)} className="flex-1 gap-2 font-semibold">
                      <ExternalLink className="h-4 w-4" />
                      {item.source === 'mapping-review' ? 'Review in Role Mapping' : 'Open record'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject asks for a reason: the submitter's next move depends on it. */}
      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Reject “{rejecting?.subject_name}”?</DialogTitle>
            <DialogDescription>
              It stays unpublished and returns to whoever submitted it. Add a reason so they know what to change.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Reason (optional)"
            className="bg-background"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={saving} className="font-bold">
              Cancel
            </Button>
            <Button
              onClick={confirmReject}
              disabled={saving}
              className="bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
