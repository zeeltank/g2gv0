'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Download, Eye, FileClock, History, Link2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLaravelContext } from '@/hooks/use-agentic'
import {
  accountService,
  type DocumentActivityEntry,
  type DocumentDetail,
  type DocumentHistoryEntry,
  type RelatedDocument,
} from '@/services/account'

type Tab = 'details' | 'activity' | 'related'

export interface DocumentDetailDialogProps {
  documentId: number | null
  typeLabel: (key: string | null) => string | null
  onOpenChange: (open: boolean) => void
  onPreview: () => void
  onDownload: () => void
  downloading: boolean
}

/**
 * The "logs and extra" surface — everything `document-card-grid.tsx` leaves
 * out for weight: AI classification detail, warnings, version/audit history,
 * and other documents like this one. Mirrors LMS K-12's own
 * `DocumentDetailPanel` (details/versions/related/audit tabs over the same
 * kind of record) adapted to this app's own data — read-only here rather
 * than also offering a "restore an old version" action, which K-12 has and
 * this does not yet.
 */
export function DocumentDetailDialog({
  documentId,
  typeLabel,
  onOpenChange,
  onPreview,
  onDownload,
  downloading,
}: DocumentDetailDialogProps) {
  const resolveContext = useLaravelContext()
  const [tab, setTab] = useState<Tab>('details')
  const [detail, setDetail] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [history, setHistory] = useState<DocumentHistoryEntry[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [related, setRelated] = useState<RelatedDocument[] | null>(null)
  const [relatedLoading, setRelatedLoading] = useState(false)

  useEffect(() => {
    if (documentId === null) return

    setTab('details')
    setDetail(null)
    setHistory(null)
    setRelated(null)
    setError(null)
    setLoading(true)

    accountService
      .getDocument(resolveContext(), documentId)
      .then((response) => setDetail(response.data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'That document could not be opened.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  useEffect(() => {
    if (documentId === null || tab !== 'activity' || history !== null) return

    setHistoryLoading(true)
    accountService
      .getDocumentHistory(resolveContext(), documentId)
      .then((response) => setHistory(response.data))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, tab])

  useEffect(() => {
    if (documentId === null || tab !== 'related' || related !== null) return

    setRelatedLoading(true)
    accountService
      .getRelatedDocuments(resolveContext(), documentId)
      .then((response) => setRelated(response.data))
      .catch(() => setRelated([]))
      .finally(() => setRelatedLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, tab])

  const warnings: string[] = (() => {
    if (!detail?.warnings) return []
    try {
      const parsed = JSON.parse(detail.warnings)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  })()

  const keywords: string[] = (() => {
    if (!detail?.keywords) return []
    try {
      const parsed = JSON.parse(detail.keywords)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  })()

  return (
    <Dialog open={documentId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border p-4">
          <DialogTitle className="truncate">{detail?.title ?? (loading ? 'Loading…' : 'Document')}</DialogTitle>
          <DialogDescription className="truncate">{detail?.original_file_name ?? ''}</DialogDescription>
        </DialogHeader>

        {/* Tabs — deliberately plain buttons, not the Tabs primitive (not in this app's component set; see artifact notes elsewhere in this feature). */}
        <div className="flex shrink-0 gap-1 border-b border-border px-4 pt-2">
          {(
            [
              { key: 'details', label: 'Details' },
              { key: 'activity', label: 'Activity' },
              { key: 'related', label: 'Related' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-primary text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : error || !detail ? (
            <p className="text-sm text-destructive">{error ?? 'That document could not be opened.'}</p>
          ) : tab === 'details' ? (
            <DetailsTab detail={detail} typeLabel={typeLabel} warnings={warnings} keywords={keywords} />
          ) : tab === 'activity' ? (
            <ActivityTab loading={historyLoading} entries={history ?? []} />
          ) : (
            <RelatedTab loading={relatedLoading} items={related ?? []} typeLabel={typeLabel} />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border p-3">
          <Button variant="outline" size="sm" onClick={onPreview}>
            <Eye className="mr-1.5 size-3.5" aria-hidden="true" />
            Preview
          </Button>
          <Button size="sm" onClick={onDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="mr-1.5 size-3.5" aria-hidden="true" />
            )}
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  )
}

function DetailsTab({
  detail,
  typeLabel,
  warnings,
  keywords,
}: {
  detail: DocumentDetail
  typeLabel: (key: string | null) => string | null
  warnings: string[]
  keywords: string[]
}) {
  const sizeLabel = detail.size ? `${(detail.size / 1024).toFixed(1)} KB` : null
  const confidence = detail.confidence ? Math.round(parseFloat(detail.confidence) * 100) : null

  return (
    <div className="space-y-5">
      {warnings.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-warning/30 bg-warning/10 p-3">
          {warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2 text-xs text-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
              {readableWarning(w)}
            </p>
          ))}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Fact label="Type">{typeLabel(detail.document_type) ?? '—'}</Fact>
        <Fact label="Category">{detail.category === 'organization' ? 'Organisation' : 'Personal'}</Fact>
        {detail.subject && <Fact label="Subject">{detail.subject}</Fact>}
        {detail.period_label && <Fact label="Period">{detail.period_label}</Fact>}
        <Fact label="Visibility">
          <span className="capitalize">{detail.visibility ?? 'private'}</span>
        </Fact>
        {detail.source_system && <Fact label="Source">{detail.source_system}</Fact>}
        {sizeLabel && <Fact label="Size">{sizeLabel}</Fact>}
        {confidence !== null && (
          <Fact label="AI confidence">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${confidence}%` }} />
              </span>
              {confidence}%
            </span>
          </Fact>
        )}
      </dl>

      {detail.summary && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{detail.summary}</p>
        </div>
      )}

      {keywords.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Keywords</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {keywords.map((k) => (
              <Badge key={k} variant="muted">
                {k}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {detail.processing_error && (
        <p className="text-xs text-muted-foreground">
          Last enrichment note: {detail.processing_error}
        </p>
      )}
    </div>
  )
}

function readableWarning(warning: string): string {
  if (warning.startsWith('possible_duplicate_of:')) {
    return `This looks like a duplicate of document #${warning.split(':')[1]}.`
  }
  if (warning === 'ocr_found_no_text') return 'OCR ran but found no readable text in this file.'
  if (warning === 'file_missing_for_ocr') return 'The file could not be found for OCR.'

  return warning.replace(/_/g, ' ')
}

function ActivityTab({ loading, entries }: { loading: boolean; entries: DocumentHistoryEntry[] }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {entry.entry_type === 'version' ? (
              <FileClock className="size-3.5" aria-hidden="true" />
            ) : (
              <History className="size-3.5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">
              {entry.entry_type === 'version'
                ? `Version ${entry.version_number ?? 1}${entry.change_note ? ` — ${entry.change_note}` : ''}`
                : actionLabel(entry.action)}
            </p>
            <p className="text-xs text-muted-foreground">
              {[entry.actor_name ?? 'System', formatDateTime(entry.created_at)].filter(Boolean).join(' · ')}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function actionLabel(action: string | null): string {
  if (!action) return 'Activity'
  const labels: Record<string, string> = {
    uploaded: 'Uploaded',
    downloaded: 'Downloaded',
    deleted: 'Removed',
    classified: 'Classified by AI',
  }

  return labels[action] ?? action.replace(/_/g, ' ')
}

function formatDateTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value.replace(' ', 'T'))

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function RelatedTab({
  loading,
  items,
  typeLabel,
}: {
  loading: boolean
  items: RelatedDocument[]
  typeLabel: (key: string | null) => string | null
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nothing similar found yet.</p>
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
          <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">{item.title || item.original_file_name}</p>
            <p className="truncate text-xs text-muted-foreground">{typeLabel(item.document_type) ?? '—'}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
