'use client'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { statusBadgeVariants } from '@/components/ui/status-badge'
import {
  decidedByText, decisionLabel, formatDateTime, reasonText, relativeTime, statusLabel, statusTone, viaTag, type StatusTone,
} from '@/lib/signal-review/format'
import type { HistoryListProps, ReviewHistoryEntry, ReviewStatus } from '@/services/signal-review/types'

const TONE_VARIANT = { neutral: 'default', success: 'success', warning: 'warning', error: 'error' } as const satisfies Record<StatusTone, string>

function StatusChip({ status }: { status: ReviewStatus }) {
  return <span className={statusBadgeVariants({ variant: TONE_VARIANT[statusTone(status)], size: 'sm' })}>{statusLabel(status)}</span>
}

/** Newest first, whatever order the caller sends (a decision just saved may be added at either end). */
function newestFirst(entries: readonly ReviewHistoryEntry[]): ReviewHistoryEntry[] {
  const at = (entry: ReviewHistoryEntry) => {
    const time = Date.parse(entry.decided_at)
    return Number.isNaN(time) ? 0 : time
  }
  return [...entries].sort((a, b) => at(b) - at(a) || b.id - a.id)
}

/**
 * A signal's decision history as a vertical list, newest first. Four states: a loading skeleton, an error with Retry, "No decisions yet." and the
 * entries. Each entry says what was decided, how the status moved, the reason and note if there are any, who decided and when. Entries that did not
 * come from the Signal Review screen carry a small tag, so a missing reason is not mistaken for something a person left out.
 * `now` is only for tests: it fixes what "2 hours ago" is measured from.
 */
export function SignalHistoryList({ entries, loading, error, onRetry, now }: HistoryListProps & { now?: Date }) {
  if (loading || (entries === null && !error)) {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Loading history…</span>
        {[0, 1, 2].map((row) => (
          <div key={row} aria-hidden="true" className="space-y-2 border-l-2 border-border pl-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <p className="font-medium text-destructive">The history could not be loaded.</p>
        <p className="text-muted-foreground">{error}</p>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry</Button>
      </div>
    )
  }

  if (!entries || entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No decisions yet.</p>
  }

  return (
    <ol className="space-y-0">
      {newestFirst(entries).map((entry, index) => <HistoryEntry key={entry.id} entry={entry} latest={index === 0} now={now} />)}
    </ol>
  )
}

function HistoryEntry({ entry, latest, now }: { entry: ReviewHistoryEntry; latest: boolean; now?: Date }) {
  const reason = reasonText(entry)
  const tag = viaTag(entry.via)
  const ago = relativeTime(entry.decided_at, now)
  const unchanged = entry.from_status === entry.to_status

  return (
    <li className="relative border-l-2 border-border pb-4 pl-4 text-sm last:pb-0">
      <span aria-hidden="true" className={`absolute -left-[5px] top-1.5 size-2 rounded-full ${latest ? 'bg-primary' : 'bg-border'}`} />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-foreground">{decisionLabel(entry.decision)}</span>
        <span className="inline-flex items-center gap-1">
          {unchanged ? (
            <>
              <StatusChip status={entry.to_status} />
              <span className="text-xs text-muted-foreground">status unchanged</span>
            </>
          ) : (
            <>
              <StatusChip status={entry.from_status} />
              <span aria-label="to" className="text-muted-foreground">→</span>
              <StatusChip status={entry.to_status} />
            </>
          )}
        </span>
        {tag && (
          <span title={tag.explanation} className="rounded border border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {tag.label}
          </span>
        )}
      </div>

      {reason && <p className="mt-1 text-foreground">Reason: {reason}</p>}
      {entry.note && <p className="mt-1 whitespace-pre-wrap break-words text-foreground">&ldquo;{entry.note}&rdquo;</p>}

      <p className="mt-1 text-xs text-muted-foreground">
        {decidedByText(entry.decided_by_name)} · <time dateTime={entry.decided_at}>{formatDateTime(entry.decided_at)}</time>
        {ago ? ` · ${ago}` : ''}
      </p>
    </li>
  )
}
