'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { LaravelContext } from '@/lib/laravel-context'
import { apiErrorText } from '@/lib/api-messages'
import { opportunitiesService, type SyncReport, type SyncReportItem } from '@/services/signals/opportunities'

export interface ConnectorSyncReportProps {
  context: LaravelContext
  target: { connectorId: number; syncId: number; name: string } | null
  onClose: () => void
}

const ORIGIN_LABEL: Record<SyncReportItem['origin'], string> = {
  own_posts: 'Own post',
  comments: 'Comment',
  discovery: 'Other account',
}

function minutesAndSeconds(total: number | null): string {
  if (total === null) return '—'
  const m = Math.floor(total / 60)
  return m > 0 ? `${m} min ${total % 60} s` : `${total} s`
}

export function ConnectorSyncReport({ context, target, onClose }: ConnectorSyncReportProps) {
  if (!target) return null
  return <Body key={`${target.connectorId}:${target.syncId}`} context={context} target={target} onClose={onClose} />
}

function Body({ context, target, onClose }: { context: LaravelContext; target: NonNullable<ConnectorSyncReportProps['target']>; onClose: () => void }) {
  const [report, setReport] = useState<SyncReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    opportunitiesService
      .getSyncReport(context, target.connectorId, target.syncId)
      .then((res) => { if (!cancelled) setReport(res.data) })
      .catch((err) => { if (!cancelled) setError(apiErrorText(err, 'The sync report could not be loaded.')) })
    return () => { cancelled = true }
  }, [context, target.connectorId, target.syncId])

  const totals = report?.totals
  const tiles: { label: string; value: number | string }[] = totals
    ? [
        { label: 'Fetched', value: totals.fetched },
        { label: 'Stored', value: totals.stored },
        { label: 'Analysed', value: totals.analysed },
        { label: 'Pending', value: totals.pending },
        { label: 'Rejected', value: totals.rejected },
        { label: 'Qualified', value: totals.qualified },
        { label: 'Errors', value: totals.errors },
        { label: 'Duration', value: minutesAndSeconds(totals.duration_seconds) },
      ]
    : []

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1 pb-2 border-b border-border">
          <DialogTitle className="text-base font-bold text-foreground">Sync report</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">{target.name}</DialogDescription>
        </DialogHeader>

        {!report && !error && (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading the report…</div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" /><p className="flex-1">{error}</p>
          </div>
        )}

        {report && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Stage: <strong className="text-foreground">{report.stage_label}</strong></span>
              <span aria-hidden>·</span>
              <span>Queue: <strong className="text-foreground">{report.queue.name}</strong> ({report.queue.driver})</span>
              {!report.queue.retry_after_safe && <span className="text-primary">Queue retry time is shorter than the job timeout: ask an administrator to fix it.</span>}
            </div>
            {report.sync.error_message && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-foreground">{report.sync.error_message}</div>
            )}

            <div className="grid grid-cols-4 gap-2" aria-label="Sync totals">
              {tiles.map((tile) => (
                <div key={tile.label} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{tile.label}</div>
                  <div className="text-sm font-bold text-foreground">{tile.value}</div>
                </div>
              ))}
            </div>

            {Object.keys(report.by_reason).length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Why posts were or were not signals">
                {Object.entries(report.by_reason).map(([code, count]) => (
                  <span key={code} className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
                    <span className="font-mono">{code}</span> · {count}
                  </span>
                ))}
              </div>
            )}
            {!report.reasons_recorded && (
              <p className="text-[11px] text-muted-foreground">Per-post reasons are recorded from the next sync, once the latest database update has been applied.</p>
            )}

            <div className="divide-y divide-border/60 rounded-xl border border-border/80">
              {report.items.length === 0 && <p className="p-3 text-xs text-muted-foreground">No posts were stored by this sync.</p>}
              {report.items.map((item) => (
                <div key={item.source_id} className="space-y-1 p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={item.decision_code === 'QUALIFIED_SIGNAL' ? 'font-semibold text-emerald-600' : item.status === 'analysed' ? 'font-semibold text-foreground' : 'font-semibold text-primary'}>
                      {item.status === 'pending' ? 'Waiting for analysis' : item.decision_label ?? 'Analysed'}
                    </span>
                    {item.decision_code && <span className="font-mono text-[10px] text-muted-foreground">{item.decision_code}</span>}
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{ORIGIN_LABEL[item.origin]}</span>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noreferrer noopener" className="ml-auto flex items-center gap-1 text-[11px] text-primary hover:underline">
                        Open original <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-muted-foreground line-clamp-3 whitespace-pre-line">{item.content}</p>
                  {item.organisation && <p><strong className="text-foreground">Prospect:</strong> {item.organisation}</p>}
                  {item.quote && <blockquote className="border-l-2 border-primary/40 pl-2 italic text-foreground">“{item.quote}”</blockquote>}
                  {item.detail && item.decision_code !== 'QUALIFIED_SIGNAL' && <p className="text-muted-foreground">{item.detail}</p>}
                  {item.error && <p className="text-destructive">{item.error}</p>}
                </div>
              ))}
            </div>
            {report.items_truncated && <p className="text-[11px] text-muted-foreground">Showing the first 500 posts.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
