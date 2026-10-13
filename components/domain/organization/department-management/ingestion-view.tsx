'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SelectInput } from '../components'
import type { LaravelContext } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import {
  opportunitiesService,
  type IngestionSignal,
  type IngestionSignalListResponse,
  type IngestionSourceDetail,
  type IngestionSourceInfo,
  type MarketImportResult,
  type ProcessingStatus,
} from '@/services/signals/opportunities'
import { Fact, FieldLabel, GroupHeading, Notice, Placeholder, SectionHeader, SignalsPage, Surface } from './signals-ui'

const ACCEPT = '.pdf,.docx,.txt,.xlsx,.xls'
const FORMATS = ['PDF', 'DOCX', 'TXT', 'XLSX']
/** A structured demand-side file goes to the market import, not to AI analysis. Excel is not read yet. */
const MARKET_ACCEPT = '.json,.csv'
const MARKET_FORMATS = ['JSON', 'CSV']

type Intent = 'foundation' | 'market'
const INTENTS: { id: Intent; label: string; help: string }[] = [
  { id: 'foundation', label: 'Foundation', help: 'Our own catalogue, notes or documents. The AI reads them and writes signals about our business.' },
  { id: 'market', label: 'Market signals', help: 'A structured demand-side file (JSON or CSV) from the daily scan. It goes straight into Company opportunities. Rows that fail a check are listed with the reason.' },
]
const POLL_FAST_MS = 3000
const POLL_SLOW_MS = 10000
const POLL_FAST_TICKS = 60 // three minutes at the fast rate, then back off

const KIND_LABEL: Record<string, string> = {
  requirement: 'Requirements', opportunity: 'Business opportunities', risk: 'Risks', gap: 'Gaps',
  recommendation: 'Recommendations', insight: 'Insights', company_info: 'Company information',
}
const KIND_BADGE: Record<string, string> = {
  requirement: 'Requirement', opportunity: 'Opportunity', risk: 'Risk', gap: 'Gap',
  recommendation: 'Recommendation', insight: 'Insight', company_info: 'Company info',
}
// A small dot per category gives quiet differentiation without colouring whole cards.
const KIND_DOT: Record<string, string> = {
  company_info: 'bg-muted-foreground', requirement: 'bg-primary', opportunity: 'bg-success',
  risk: 'bg-destructive', gap: 'bg-warning', recommendation: 'bg-primary', insight: 'bg-muted-foreground',
}
const LEVEL_VARIANT = { High: 'destructive', Medium: 'warning', Low: 'muted' } as const
const STATUS_VARIANT: Record<ProcessingStatus, 'success' | 'warning' | 'destructive' | 'navy' | 'muted'> = {
  uploaded: 'muted', generating: 'navy', completed: 'success', completed_with_warnings: 'warning', failed: 'destructive',
}

const errText = (cause: unknown, fallback: string) => (cause instanceof ApiError || cause instanceof Error ? cause.message : fallback)

function fmt(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function size(bytes: number | null) {
  if (!bytes) return ''
  return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function StatusBadge({ s }: { s: Pick<IngestionSourceInfo, 'processing_status' | 'processing_label'> }) {
  return (
    <Badge variant={STATUS_VARIANT[s.processing_status]} className="shrink-0 gap-1">
      {s.processing_status === 'generating' && <Loader2 className="size-3 animate-spin" />}
      {s.processing_label}
    </Badge>
  )
}

function SignalDetail({
  signal,
  busy,
  onAct,
}: {
  signal: IngestionSignal
  busy: boolean
  onAct: (a: 'review' | 'dismiss') => void
}) {
  return (
    <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="navy">{KIND_BADGE[signal.kind] ?? signal.kind}</Badge>
        {signal.priority && <Badge variant={LEVEL_VARIANT[signal.priority]}>{signal.priority} priority</Badge>}
        {signal.confidence && <Badge variant="muted">Confidence: {signal.confidence}</Badge>}
        {signal.review_status !== 'New' && <Badge variant="muted">{signal.review_status}</Badge>}
      </div>

      <section className="rounded-lg bg-muted/50 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Source</p>
        <p className="mt-1 flex items-start gap-2 break-words font-medium text-foreground">
          {signal.source_type === 'url' ? <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
          <span className="min-w-0 break-all">{signal.source_name}</span>
        </p>
        {signal.source_url && <a href={signal.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-xs text-primary hover:underline">{signal.source_url}</a>}
        <p className="mt-1 text-xs text-muted-foreground">Generated {fmt(signal.created_at)}</p>
      </section>

      <dl className="space-y-4">
        <Fact label="Description">{signal.detail}</Fact>
        {signal.business_impact && <Fact label="Business impact">{signal.business_impact}</Fact>}
        {signal.suggested_action && <Fact label="Suggested next action">{signal.suggested_action}</Fact>}
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">Advisory only. Nothing is changed or sent automatically.</p>

      <section>
        <h5 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Supporting evidence ({signal.evidence.length})</h5>
        <ul className="mt-2 space-y-3">
          {signal.evidence.map((e, i) => (
            <li key={i} className="break-words border-l-2 border-primary/40 pl-3 leading-relaxed">
              <span className="text-xs font-medium text-muted-foreground">{e.ref}</span>
              <span className="block text-foreground">&ldquo;{e.quote}&rdquo;</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="sticky bottom-0 -mb-px flex flex-wrap justify-end gap-2 border-t border-border/60 bg-card pt-4">
        <Button size="sm" variant="outline" disabled={busy || signal.review_status === 'Dismissed'} onClick={() => onAct('dismiss')}><XCircle className="mr-1.5 size-4" /> Dismiss</Button>
        <Button size="sm" disabled={busy || signal.review_status === 'Reviewed'} onClick={() => onAct('review')}><CheckCircle2 className="mr-1.5 size-4" /> Mark reviewed</Button>
      </div>
    </div>
  )
}

/* eslint-disable react-hooks/set-state-in-effect -- Intentional: load on mount / filter change and follow sources that are still processing */
export function IngestionView({ context }: { context: LaravelContext }) {
  const [sources, setSources] = useState<IngestionSourceInfo[] | null>(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<IngestionSourceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState<'upload' | 'url' | 'market' | null>(null)
  const [intent, setIntent] = useState<Intent>('foundation')
  const [marketResult, setMarketResult] = useState<{ file: string; dryRun: boolean; result: MarketImportResult } | null>(null)
  const [dryRun, setDryRun] = useState(false)
  const [retrying, setRetrying] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'error' | 'info' | 'warning'; text: string } | null>(null)

  const [signals, setSignals] = useState<IngestionSignalListResponse | null>(null)
  const [signalsLoading, setSignalsLoading] = useState(true)
  const [signalsError, setSignalsError] = useState('')
  const [kind, setKind] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [openSignal, setOpenSignal] = useState<IngestionSignal | null>(null)
  const [acting, setActing] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const marketFileRef = useRef<HTMLInputElement>(null)
  const previousStatus = useRef<Map<number, ProcessingStatus>>(new Map())
  const signalsRequest = useRef(0)
  const pollTicks = useRef(0)

  const loadSources = useCallback(async () => {
    try {
      const list = (await opportunitiesService.listSources(context)).data
      setSources(list)
      setError('')
      return list
    } catch (cause) {
      setError(errText(cause, 'Failed to load sources.'))
      return null
    }
  }, [context])

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const response = await opportunitiesService.getSource(context, id)
      setDetail(response.data)
    } catch (cause) {
      setNotice({ tone: 'error', text: errText(cause, 'Failed to load the source.') })
    } finally {
      setDetailLoading(false)
    }
  }, [context])

  const loadSignals = useCallback(async () => {
    const request = ++signalsRequest.current
    setSignalsLoading(true)
    setSignalsError('')
    try {
      const response = await opportunitiesService.listSignals(context, {
        sourceId: sourceFilter ? Number(sourceFilter) : undefined, kind: kind || undefined, search: debouncedSearch || undefined, page,
      })
      if (request === signalsRequest.current) setSignals(response)
    } catch (cause) {
      if (request === signalsRequest.current) setSignalsError(errText(cause, 'Failed to load signals.'))
    } finally {
      if (request === signalsRequest.current) setSignalsLoading(false)
    }
  }, [context, sourceFilter, kind, debouncedSearch, page])

  useEffect(() => { void loadSources() }, [loadSources])
  useEffect(() => { void loadSignals() }, [loadSignals])
  useEffect(() => { if (selectedId !== null) void loadDetail(selectedId) }, [selectedId, loadDetail])
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  /*
   * LIVE UPDATES WITHOUT A REFRESH.
   * While any source is still "generating", ONE timer re-reads the source list (and the
   * open source). It backs off after three minutes and stops as soon as nothing is
   * processing, so an idle page makes no requests. When a source finishes, the signals
   * list reloads and a notice says what happened.
   */
  const anyGenerating = Boolean(sources?.some((s) => s.processing_status === 'generating'))
  useEffect(() => {
    if (!anyGenerating) { pollTicks.current = 0; return }
    const delay = pollTicks.current < POLL_FAST_TICKS ? POLL_FAST_MS : POLL_SLOW_MS
    const timer = setTimeout(async () => {
      pollTicks.current += 1
      await loadSources()
      if (selectedId !== null) await loadDetail(selectedId)
    }, delay)
    return () => clearTimeout(timer)
  }, [anyGenerating, sources, selectedId, loadSources, loadDetail])

  useEffect(() => {
    if (!sources) return
    let finished = false
    for (const s of sources) {
      const before = previousStatus.current.get(s.id)
      if (before === 'generating' && s.processing_status !== 'generating') {
        finished = true
        setNotice(
          s.processing_status === 'failed'
            ? { tone: 'error', text: `"${s.name}": ${s.processing_message ?? 'analysis failed.'}` }
            : s.processing_status === 'completed_with_warnings'
              ? { tone: 'warning', text: `"${s.name}": ${s.findings_count} signal(s) generated. ${s.processing_message ?? ''}` }
              : { tone: 'info', text: s.findings_count === 0 ? `"${s.name}": analysis finished, nothing evidence-backed was found.` : `"${s.name}": ${s.findings_count} signal(s) generated.` },
        )
      }
      previousStatus.current.set(s.id, s.processing_status)
    }
    if (finished) { setPage(1); void loadSignals() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources])

  function ingested(response: { message: string; analysis_started?: boolean; data: IngestionSourceInfo }) {
    setNotice({ tone: response.analysis_started === false ? 'warning' : 'info', text: response.message })
    setSelectedId(response.data.id)
    setSourceFilter(String(response.data.id))
    setPage(1)
  }

  async function handleMarketFile(file: File | undefined) {
    if (!file || busy) return
    setNotice(null)
    setMarketResult(null)
    setBusy('market')
    try {
      const response = await opportunitiesService.importMarket(context, file, { dryRun, label: file.name })
      setMarketResult({ file: file.name, dryRun, result: response.data })
    } catch (cause) {
      setNotice({ tone: 'error', text: errText(cause, 'The market file could not be imported.') })
    } finally {
      setBusy(null)
      if (marketFileRef.current) marketFileRef.current.value = ''
    }
  }

  async function handleFile(file: File | undefined) {
    if (intent === 'market') return handleMarketFile(file)
    if (!file || busy) return
    setNotice(null)
    setBusy('upload')
    try {
      ingested(await opportunitiesService.upload(context, file))
    } catch (cause) {
      setNotice({ tone: 'error', text: errText(cause, 'Upload failed.') })
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
      void loadSources()
    }
  }

  async function handleUrl() {
    if (!url.trim() || busy) return
    setNotice(null)
    setBusy('url')
    try {
      ingested(await opportunitiesService.addUrl(context, url.trim()))
      setUrl('')
    } catch (cause) {
      setNotice({ tone: 'error', text: errText(cause, 'Could not read that page.') })
    } finally {
      setBusy(null)
      void loadSources()
    }
  }

  async function retry(id: number) {
    if (retrying !== null) return
    setNotice(null)
    setRetrying(id)
    try {
      await opportunitiesService.analyze(context, id)
      setNotice({ tone: 'info', text: 'Analysis restarted. Signals will appear automatically.' })
    } catch (cause) {
      setNotice({ tone: 'error', text: errText(cause, 'Could not restart the analysis.') })
    } finally {
      setRetrying(null)
      await loadSources()
      if (selectedId === id) await loadDetail(id)
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this source and all of its signals? This cannot be undone.')) return
    try {
      await opportunitiesService.deleteSource(context, id)
      if (selectedId === id) { setSelectedId(null); setDetail(null) }
      if (sourceFilter === String(id)) setSourceFilter('')
      await loadSources()
      void loadSignals()
    } catch (cause) {
      setNotice({ tone: 'error', text: errText(cause, 'Could not delete the source.') })
    }
  }

  async function actOnSignal(action: 'review' | 'dismiss') {
    if (!openSignal) return
    setActing(true)
    try {
      const response = await opportunitiesService.actOnFinding(context, openSignal.id, action)
      setOpenSignal({ ...openSignal, review_status: response.data.review_status })
      void loadSignals()
    } catch (cause) {
      setNotice({ tone: 'error', text: errText(cause, 'Could not update the signal.') })
    } finally {
      setActing(false)
    }
  }

  const selectSource = (id: number) => { setSelectedId(id); setSourceFilter(String(id)); setPage(1) }
  const kindOptions = [
    { value: '', label: 'All categories' },
    ...Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label: `${label}${signals?.kind_counts?.[value] ? ` (${signals.kind_counts[value]})` : ''}` })),
  ]
  const sourceOptions = [{ value: '', label: 'All sources' }, ...(sources ?? []).filter((s) => s.status === 'ready').map((s) => ({ value: String(s.id), label: s.name }))]
  const filtersActive = Boolean(kind || sourceFilter || debouncedSearch)

  return (
    <SignalsPage>
      <SectionHeader
        title="Ingestion engine"
        description="Upload a document or submit one public web page. Signals are generated automatically and appear here as soon as the analysis finishes."
      />

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <section aria-label="What are you uploading?" className="space-y-2">
        <div role="radiogroup" aria-label="Upload intent" className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
          {INTENTS.map((i) => (
            <button
              key={i.id}
              type="button"
              role="radio"
              aria-checked={intent === i.id}
              onClick={() => { setIntent(i.id); setMarketResult(null) }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${intent === i.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {i.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{INTENTS.find((i) => i.id === intent)?.help}</p>
      </section>

      {intent === 'market' && (
        <section aria-label="Market signals import" className="grid gap-4 @3xl:grid-cols-2">
          <label
            onDragOver={(e) => { e.preventDefault(); if (busy === null) setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void handleMarketFile(e.dataTransfer.files?.[0]) }}
            className={`flex min-w-0 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-ring ${dragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'} ${busy !== null ? 'pointer-events-none opacity-70' : ''}`}
          >
            <input ref={marketFileRef} type="file" accept={MARKET_ACCEPT} aria-label="Choose a market signals file" className="sr-only" onChange={(e) => void handleMarketFile(e.target.files?.[0])} disabled={busy !== null} />
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {busy === 'market' ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{busy === 'market' ? 'Checking and importing…' : 'Upload a market signals file'}</span>
              <span className="mt-1 block text-sm text-muted-foreground">Drop a file here, or click to browse</span>
            </span>
            <span className="flex flex-wrap justify-center gap-1.5">{MARKET_FORMATS.map((f) => <Badge key={f} variant="muted">{f}</Badge>)}</span>
            <span className="text-xs text-muted-foreground">Excel is not read yet: save the sheet as CSV.</span>
          </label>

          <Surface className="flex flex-col gap-3 p-6">
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input type="checkbox" className="mt-0.5 size-4 rounded border-border" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} disabled={busy !== null} />
              <span>
                Check only (dry run)
                <span className="block text-xs text-muted-foreground">Validate the file and show what would be accepted or rejected. Nothing is saved.</span>
              </span>
            </label>

            {marketResult ? (
              <div className="space-y-3" aria-live="polite">
                <p className="text-sm font-semibold text-foreground">
                  {marketResult.dryRun ? 'Check result' : 'Import result'} <span className="font-normal text-muted-foreground">· {marketResult.file}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">{marketResult.result.accepted} {marketResult.dryRun ? 'valid' : 'accepted'}</Badge>
                  {!marketResult.dryRun && <Badge variant="navy">{marketResult.result.updated} updated</Badge>}
                  {!marketResult.dryRun && <Badge variant="muted">{marketResult.result.duplicate} duplicate</Badge>}
                  <Badge variant={marketResult.result.rejected > 0 ? 'destructive' : 'muted'}>{marketResult.result.rejected} rejected</Badge>
                </div>
                {marketResult.result.rejected > 0 && (
                  <ul className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
                    {marketResult.result.results.filter((r) => r.outcome === 'rejected').map((r) => (
                      <li key={r.index} className="rounded-md bg-destructive/5 px-3 py-2 text-destructive">
                        <span className="font-semibold">Row {r.index + 1}</span> · {r.reason}
                      </li>
                    ))}
                  </ul>
                )}
                {!marketResult.dryRun && marketResult.result.accepted + marketResult.result.updated > 0 && (
                  <p className="text-xs text-muted-foreground">They now appear under Company opportunities.</p>
                )}
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Each record needs a buyer, a named trigger, a date, a source link and an evidence level. Signals that cannot be confirmed from the full page are stored as inference, not confirmed.
              </p>
            )}
          </Surface>
        </section>
      )}

      <section aria-label="Add a source" className={`grid gap-4 @3xl:grid-cols-2 ${intent === 'market' ? 'hidden' : ''}`}>
        <label
          onDragOver={(e) => { e.preventDefault(); if (busy === null) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files?.[0]) }}
          className={`flex min-w-0 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-ring ${dragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'} ${busy !== null ? 'pointer-events-none opacity-70' : ''}`}
        >
          <input ref={fileRef} type="file" accept={ACCEPT} aria-label="Choose a file to ingest" className="sr-only" onChange={(e) => void handleFile(e.target.files?.[0])} disabled={busy !== null} />
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {busy === 'upload' ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">{busy === 'upload' ? 'Reading file…' : 'Upload a document'}</span>
            <span className="mt-1 block text-sm text-muted-foreground">Drop a file here, or click to browse</span>
          </span>
          <span className="flex flex-wrap justify-center gap-1.5">{FORMATS.map((f) => <Badge key={f} variant="muted">{f}</Badge>)}</span>
          <span className="text-xs text-muted-foreground">Up to 15 MB. Legacy .xls: save as .xlsx first.</span>
        </label>

        <Surface className="flex flex-col justify-center gap-4 p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><Globe className="size-5" /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Submit a website URL</p>
              <p className="text-sm text-muted-foreground">One public page per source.</p>
            </div>
          </div>
          <FieldLabel label="Page address" hint="Public pages only. robots.txt is respected.">
            <span className="flex gap-2">
              <Input aria-label="Website URL" placeholder="https://example.com/about" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleUrl() }} disabled={busy !== null} className="min-w-0 flex-1" />
              <Button onClick={handleUrl} disabled={busy !== null || !url.trim()} className="shrink-0">{busy === 'url' ? <Loader2 className="size-4 animate-spin" /> : 'Add'}</Button>
            </span>
          </FieldLabel>
        </Surface>
      </section>

      <section aria-label="Ingestion history" className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="min-w-0 space-y-3">
          <GroupHeading title="Ingestion history" aside={sources ? `${sources.length} added` : undefined} />
          <Surface>
            {error ? (
              <ErrorState title="Could not load sources" description={error} retry={() => void loadSources()} className="border-0 bg-transparent" />
            ) : !sources ? (
              <div className="space-y-3 p-5" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : sources.length === 0 ? (
              <Placeholder icon={<FileText className="size-5" />} title="No sources yet" description="Upload a document or add a web page. Signals are generated automatically." />
            ) : (
              <ul className="max-h-[32rem] divide-y divide-border/60 overflow-y-auto">
                {sources.map((s) => (
                  <li key={s.id}>
                    <div className={`flex items-start gap-2 pr-3 ${selectedId === s.id ? 'bg-primary/5 shadow-[inset_3px_0_0_0_var(--primary)]' : ''}`}>
                      <button
                        type="button"
                        onClick={() => selectSource(s.id)}
                        aria-pressed={selectedId === s.id}
                        className="block min-w-0 flex-1 px-5 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <span className="flex items-start gap-2.5">
                          {s.type === 'url' ? <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                          <span className="line-clamp-2 min-w-0 flex-1 break-all text-sm font-medium leading-snug text-foreground">{s.name}</span>
                          <StatusBadge s={s} />
                        </span>
                        <span className="mt-1 block pl-[26px] text-xs leading-relaxed text-muted-foreground">
                          {s.type === 'url' ? 'Web page' : 'File'}{size(s.size_bytes) && ` · ${size(s.size_bytes)}`} · {fmt(s.created_at)} · {s.findings_count} {s.findings_count === 1 ? 'signal' : 'signals'}
                        </span>
                        {s.processing_message && s.processing_status !== 'generating' && (
                          <span className={`mt-1 line-clamp-2 block pl-[26px] text-xs leading-relaxed ${s.processing_status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{s.processing_message}</span>
                        )}
                      </button>
                      {s.can_retry && (
                        <Button size="sm" variant="outline" className="mt-3 shrink-0" disabled={retrying !== null} onClick={() => void retry(s.id)}>
                          {retrying === s.id ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 size-3.5" />} Retry
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </div>

        <div className="min-w-0 space-y-3">
          <GroupHeading title="Selected source" />
          <Surface>
            {selectedId === null ? (
              <Placeholder icon={<Sparkles className="size-5" />} title="Select a source" description="Choose a source to see its status and what was read." />
            ) : detailLoading && !detail ? (
              <div className="space-y-3 p-5"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24" /></div>
            ) : detail ? (
              <div className="space-y-5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <h4 className="break-words text-sm font-semibold leading-snug text-foreground">{detail.name}</h4>
                    <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                      {detail.type === 'url'
                        ? <>Retrieved {fmt(detail.retrieved_at)} · <a href={detail.url ?? '#'} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">{detail.url}</a></>
                        : `File · ${size(detail.size_bytes)}`}
                      {' · '}{detail.char_count.toLocaleString()} characters{detail.truncated && ' (truncated)'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge s={detail} />
                    {detail.can_retry && (
                      <Button size="sm" variant="outline" disabled={retrying !== null} onClick={() => void retry(detail.id)}>
                        {retrying === detail.id ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 size-3.5" />} Retry
                      </Button>
                    )}
                    <Button size="icon" variant="outline" onClick={() => void remove(detail.id)} aria-label="Delete source"><Trash2 className="size-4" /></Button>
                  </div>
                </div>

                {detail.processing_status === 'generating' && <Notice tone="info">Generating signals from this source. This page updates automatically when the analysis finishes.</Notice>}
                {detail.processing_status === 'uploaded' && <Notice tone="warning">{detail.processing_message} Use Retry once the AI provider is available.</Notice>}
                {detail.processing_status === 'failed' && detail.processing_message && <Notice tone="error">{detail.processing_message}</Notice>}
                {detail.processing_status === 'completed_with_warnings' && detail.processing_message && <Notice tone="warning">{detail.processing_message}</Notice>}
                {detail.processing_status === 'completed' && detail.findings_count === 0 && (
                  <Notice tone="info">The analysis completed, but nothing evidence-backed was found in this source.</Notice>
                )}

                {detail.status === 'ready' && (
                  <details className="group rounded-lg bg-muted/40 px-4 py-3 text-sm">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">What was read ({detail.preview.length} of the first sections)</summary>
                    <ul className="mt-3 space-y-3">
                      {detail.preview.map((p) => (
                        <li key={p.ref}>
                          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{p.ref}</span>
                          <p className="mt-0.5 whitespace-pre-line break-words leading-relaxed text-foreground">{p.text}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {detail.latest_analysis && detail.latest_analysis.status !== 'running' && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Last analysis {fmt(detail.latest_analysis.completed_at ?? detail.latest_analysis.started_at)}
                    {detail.latest_analysis.status !== 'failed' && ` · ${detail.latest_analysis.findings_count} kept, ${detail.latest_analysis.findings_rejected} discarded for lacking evidence`}
                  </p>
                )}
              </div>
            ) : null}
          </Surface>
        </div>
      </section>

      <section aria-label="Generated signals" className="space-y-4">
        <GroupHeading title="Generated signals" aside={signals ? `${signals.meta.total} total` : undefined} />

        <Surface className="p-4">
          <div className="grid gap-3 @xl:grid-cols-2 @3xl:grid-cols-3">
            <div className="@xl:col-span-2 @3xl:col-span-3">
              <Input aria-label="Search signals" placeholder="Search signal title or description" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <SelectInput value={sourceFilter} onChange={(v) => { setSourceFilter(v); setPage(1) }} options={sourceOptions} />
            <SelectInput value={kind} onChange={(v) => { setKind(v); setPage(1) }} options={kindOptions} />
          </div>
        </Surface>

        {signalsLoading && !signals ? (
          <div className="space-y-4" aria-busy="true">{[0, 1].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}</div>
        ) : signalsError ? (
          <ErrorState title="Could not load signals" description={signalsError} retry={() => void loadSignals()} />
        ) : signals && signals.data.length === 0 ? (
          <Surface>
            <Placeholder
              icon={<Sparkles className="size-5" />}
              title={filtersActive ? 'No signals match these filters' : 'No signals yet'}
              description={filtersActive ? 'Try another source or category.' : 'Signals appear here automatically after a document or web page has been analysed.'}
              action={filtersActive ? <Button variant="outline" onClick={() => { setKind(''); setSourceFilter(''); setSearch(''); setPage(1) }}>Clear filters</Button> : undefined}
            />
          </Surface>
        ) : (
          <>
            <div className="space-y-4" aria-busy={signalsLoading}>
              {signals?.data.map((sig) => (
                <Surface key={sig.id} className={`p-5 ${sig.review_status === 'Dismissed' ? 'opacity-60' : ''}`}>
                  <article className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span aria-hidden className={`size-2 rounded-full ${KIND_DOT[sig.kind] ?? 'bg-muted-foreground'}`} />
                      <Badge variant="navy">{KIND_BADGE[sig.kind] ?? sig.kind}</Badge>
                      {sig.priority && <Badge variant={LEVEL_VARIANT[sig.priority]}>{sig.priority}</Badge>}
                      {sig.confidence && <Badge variant="muted">Confidence: {sig.confidence}</Badge>}
                      {sig.review_status !== 'New' && <Badge variant="muted">{sig.review_status}</Badge>}
                      <span className="ml-auto text-xs text-muted-foreground">{fmt(sig.created_at)}</span>
                    </div>
                    <h4 className="break-words text-base font-semibold leading-snug text-foreground">{sig.title}</h4>
                    <p className="break-words text-sm leading-relaxed text-foreground">{sig.detail}</p>
                    {sig.suggested_action && <Fact label="Suggested next action">{sig.suggested_action}</Fact>}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                      <span className="inline-flex min-w-0 max-w-full flex-1 items-center gap-1.5 text-xs text-muted-foreground">
                        {sig.source_type === 'url' ? <Globe className="size-3.5 shrink-0" /> : <FileText className="size-3.5 shrink-0" />}
                        <span className="truncate">{sig.source_name}</span>
                        <span className="shrink-0">· {sig.evidence.length} evidence</span>
                      </span>
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => setOpenSignal(sig)}>View evidence</Button>
                    </div>
                  </article>
                </Surface>
              ))}
            </div>
            {signals && signals.meta.last_page > 1 && (
              <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Signals pagination">
                <span className="text-muted-foreground">Page {signals.meta.page} of {signals.meta.last_page} · {signals.meta.total} signals</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || signalsLoading} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /> Previous</Button>
                  <Button size="sm" variant="outline" disabled={page >= signals.meta.last_page || signalsLoading} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="size-4" /></Button>
                </div>
              </nav>
            )}
          </>
        )}
      </section>

      <Dialog open={openSignal !== null} onOpenChange={(next) => { if (!next) setOpenSignal(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="break-words pr-6">{openSignal?.title}</DialogTitle>
            <DialogDescription>{openSignal ? KIND_LABEL[openSignal.kind] ?? openSignal.kind : ''}</DialogDescription>
          </DialogHeader>
          {openSignal && <SignalDetail signal={openSignal} busy={acting} onAct={actOnSignal} />}
        </DialogContent>
      </Dialog>
    </SignalsPage>
  )
}
