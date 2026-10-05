'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Link as LinkIcon,
  Loader2,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import {
  opportunitiesService,
  type IngestionSourceDetail,
  type IngestionSourceInfo,
} from '@/services/signals/opportunities'
import { BusinessOpportunityMatchingModal } from '../organization/department-management/business-opportunity-matching-modal'

const POLL_INTERVAL_MS = 2500
const MAX_POLLS = 120

export function IngestionEngineView() {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const ready = isLaravelContextReady(context)

  // Input state
  const [tab, setTab] = useState<'url' | 'document'>('url')
  const [urlInput, setUrlInput] = useState('')
  const [fileInput, setFileInput] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Recent sources list & active source selection
  const [sources, setSources] = useState<IngestionSourceInfo[]>([])
  const [activeSourceId, setActiveSourceId] = useState<number | null>(null)
  const [activeDetail, setActiveDetail] = useState<IngestionSourceDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Modal for matching
  const [matchFinding, setMatchFinding] = useState<IngestionSourceDetail['findings'][0] | null>(null)

  const pollCount = useRef(0)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadSources = useCallback(async () => {
    if (!ready) return
    try {
      const res = await opportunitiesService.listSources(context)
      setSources(res.data)
      if (res.data.length > 0 && activeSourceId === null) {
        setActiveSourceId(res.data[0].id)
      }
    } catch {
      // Ignored
    }
  }, [context, ready, activeSourceId])

  const loadActiveDetail = useCallback(async (sourceId: number) => {
    if (!ready) return
    setLoadingDetail(true)
    try {
      const res = await opportunitiesService.getSource(context, sourceId)
      setActiveDetail(res.data)
      return res.data
    } catch {
      setActiveDetail(null)
      return null
    } finally {
      setLoadingDetail(false)
    }
  }, [context, ready])

  // Initial load
  useEffect(() => {
    loadSources()
  }, [loadSources])

  // Load detail when active source changes
  useEffect(() => {
    if (activeSourceId) {
      loadActiveDetail(activeSourceId)
    }
  }, [activeSourceId, loadActiveDetail])

  // Polling for generating source
  useEffect(() => {
    if (!activeDetail || activeDetail.processing_status !== 'generating') return

    const poll = async () => {
      if (pollCount.current++ > MAX_POLLS) return
      const updated = await loadActiveDetail(activeDetail.id)
      if (updated && updated.processing_status !== 'generating') {
        loadSources()
        return
      }
      pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS)
    }

    pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS)
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [activeDetail?.processing_status, activeDetail?.id, loadActiveDetail, loadSources])

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetUrl = urlInput.trim()
    if (!targetUrl || !ready) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await opportunitiesService.addUrl(context, targetUrl)
      setUrlInput('')
      await loadSources()
      setActiveSourceId(res.data.id)
      pollCount.current = 0
    } catch (err) {
      setSubmitError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to ingest URL')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fileInput || !ready) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await opportunitiesService.upload(context, fileInput)
      setFileInput(null)
      await loadSources()
      setActiveSourceId(res.data.id)
      pollCount.current = 0
    } catch (err) {
      setSubmitError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to ingest document')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = async () => {
    if (!activeDetail || !ready) return
    try {
      await opportunitiesService.analyze(context, activeDetail.id)
      pollCount.current = 0
      loadActiveDetail(activeDetail.id)
    } catch (err) {
      alert(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to trigger retry')
    }
  }

  const handleDelete = async () => {
    if (!activeDetail || !ready) return
    if (!confirm('Are you sure you want to remove this ingested source and its generated findings?')) return
    try {
      await opportunitiesService.deleteSource(context, activeDetail.id)
      setActiveDetail(null)
      const remaining = sources.filter((s) => s.id !== activeDetail.id)
      setSources(remaining)
      if (remaining.length > 0) {
        setActiveSourceId(remaining[0].id)
      } else {
        setActiveSourceId(null)
      }
    } catch (err) {
      alert(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to delete source')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UploadCloud className="size-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ingestion Engine
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Provide a company URL or upload documents. The engine extracts intelligence, discovers related public news, and displays results directly below.
        </p>
      </div>

      {/* Prominent Input Card at Top */}
      <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm">
        {/* Tab switch */}
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <button
            type="button"
            onClick={() => setTab('url')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              tab === 'url'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Globe className="size-4" />
            Website or Article URL
          </button>
          <button
            type="button"
            onClick={() => setTab('document')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              tab === 'document'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <FileText className="size-4" />
            Upload Document (PDF, DOCX, TXT)
          </button>
        </div>

        {/* Tab content */}
        <div className="pt-5">
          {tab === 'url' ? (
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Company Website or Article / Tender URL
                </label>
                <div className="mt-1.5 flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="url"
                      required
                      placeholder="https://example.com or https://news.domain.com/article"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="pl-9 text-xs"
                      disabled={submitting}
                    />
                  </div>
                  <Button type="submit" disabled={submitting || !urlInput.trim()} className="gap-2">
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Ingesting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Extract & Discover Signals
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Public pages are verified via SSRF guards and respect robots.txt policies.
              </p>
            </form>
          ) : (
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Select Document File (.pdf, .docx, .txt, .xlsx)
                </label>
                <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="file"
                    required
                    accept=".pdf,.docx,.txt,.xlsx"
                    onChange={(e) => setFileInput(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-muted file:px-4 file:py-2 file:text-xs file:font-semibold file:text-foreground hover:file:bg-muted/80"
                    disabled={submitting}
                  />
                  <Button type="submit" disabled={submitting || !fileInput} className="gap-2 shrink-0">
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Uploading & Analyzing...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="size-4" />
                        Extract & Discover Signals
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Text content is securely parsed into verified segment quotes. Files up to 20MB supported.
              </p>
            </form>
          )}

          {submitError && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Ingestion History Switcher */}
      {sources.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">Recently Ingested Sources</span>
            <span>{sources.length} sources analyzed</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {sources.map((src) => {
              const selected = src.id === activeSourceId
              return (
                <button
                  key={src.id}
                  onClick={() => {
                    setActiveSourceId(src.id)
                    pollCount.current = 0
                  }}
                  className={`flex items-center gap-2 shrink-0 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all ${
                    selected
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'
                  }`}
                >
                  {src.type === 'url' ? <Globe className="size-3.5" /> : <FileText className="size-3.5" />}
                  <span className="max-w-[180px] truncate">{src.page_title || src.name}</span>
                  <Badge variant={src.processing_status === 'completed' ? 'success' : src.processing_status === 'generating' ? 'warning' : 'outline'} className="text-[10px] px-1 py-0">
                    {src.findings_count}
                  </Badge>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* RESULTS DISPLAYED DIRECTLY BELOW ON THE SAME PAGE */}
      {loadingDetail && !activeDetail ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : activeDetail ? (
        <div className="space-y-6 pt-2">
          {/* Active Source Banner */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={activeDetail.type === 'url' ? 'outline' : 'navy'}>
                    {activeDetail.type.toUpperCase()}
                  </Badge>
                  <h2 className="text-lg font-bold text-foreground">
                    {activeDetail.page_title || activeDetail.name}
                  </h2>
                </div>
                {activeDetail.url && (
                  <a
                    href={activeDetail.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {activeDetail.url}
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeDetail.can_retry && (
                  <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5 text-xs">
                    <RefreshCw className="size-3.5" />
                    Retry Analysis
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {/* Processing State Indicator */}
            {activeDetail.processing_status === 'generating' && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">
                <Loader2 className="size-5 animate-spin" />
                <div>
                  <p className="font-semibold">Analyzing Content & Discovering Follow-up Signals...</p>
                  <p className="text-[11px] opacity-80">
                    Extracting verbatim quotes, querying live search for related news, and formatting opportunity signals.
                  </p>
                </div>
              </div>
            )}

            {/* Executive Summary */}
            {activeDetail.extracted_summary && (
              <div className="mt-4 rounded-xl bg-muted/40 p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Executive Summary
                </span>
                <p className="mt-1 text-sm leading-relaxed text-foreground">
                  {activeDetail.extracted_summary}
                </p>
              </div>
            )}

            {/* Identified Entities */}
            {activeDetail.identified_entities && activeDetail.identified_entities.length > 0 && (
              <div className="mt-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Identified Key Entities
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeDetail.identified_entities.map((ent, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs">
                      <Building2 className="size-3.5 text-primary" />
                      <span className="font-medium text-foreground">{ent.name}</span>
                      <span className="text-[10px] text-muted-foreground">({ent.type})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 1: Discovered Related Public News / Follow-up Signals */}
          {activeDetail.discovered_news && activeDetail.discovered_news.length > 0 && (
            <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Newspaper className="size-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Discovered Related News & Public Follow-up Signals
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Follow-up reporting and news discovered for the identified company via live web search.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                {activeDetail.discovered_news.map((item, idx) => (
                  <div key={idx} className="flex flex-col justify-between rounded-xl border border-border/70 bg-background p-4 text-xs">
                    <div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-semibold text-primary">{item.source || 'Public Press'}</span>
                        <span>{item.published_at || 'Recent'}</span>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block font-semibold text-sm text-foreground hover:text-primary hover:underline line-clamp-2"
                      >
                        {item.title}
                      </a>
                      <p className="mt-1.5 text-muted-foreground line-clamp-3 leading-relaxed">
                        {item.snippet}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/40 flex justify-end">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        Original Source
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Generated Evidence-Backed Signals & Opportunities */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Generated Opportunity Signals ({activeDetail.findings?.length || 0})
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                Linked directly to the main Signals feed
              </span>
            </div>

            {activeDetail.findings && activeDetail.findings.length > 0 ? (
              <div className="space-y-4">
                {activeDetail.findings.map((f) => (
                  <div key={f.id} className="rounded-xl border border-border/80 bg-background p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="uppercase text-[10px]">
                          {f.kind}
                        </Badge>
                        <Badge variant={f.priority === 'High' ? 'destructive' : 'warning'}>
                          {f.priority || 'Medium'} Priority
                        </Badge>
                        <Badge variant="success" className="text-[10px]">
                          Linked to Signals Feed
                        </Badge>
                      </div>

                      <span className="text-xs text-muted-foreground">
                        Status: <strong className="text-foreground">{f.review_status}</strong>
                      </span>
                    </div>

                    <h4 className="text-base font-semibold text-foreground">{f.title}</h4>
                    <p className="text-xs leading-relaxed text-foreground/90">{f.detail}</p>

                    {/* Verbatim Evidence Quote */}
                    {f.evidence && f.evidence.length > 0 && (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3.5" />
                          Confirmed Evidence Quote (Verbatim from Source)
                        </div>
                        <p className="mt-1 italic text-foreground/90">
                          “{f.evidence[0].quote}”
                        </p>
                      </div>
                    )}

                    {/* Business Impact & Suggested Action */}
                    <div className="grid gap-3 sm:grid-cols-2 text-xs">
                      {f.business_impact && (
                        <div className="rounded-lg bg-muted/40 p-3">
                          <span className="font-semibold text-muted-foreground">Potential Business Need:</span>
                          <p className="mt-0.5 text-foreground">{f.business_impact}</p>
                        </div>
                      )}
                      {f.suggested_action && (
                        <div className="rounded-lg bg-primary/5 p-3">
                          <span className="font-semibold text-primary">Suggested Next Action:</span>
                          <p className="mt-0.5 text-foreground">{f.suggested_action}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex justify-end pt-2 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMatchFinding(f)}
                        className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
                      >
                        <Briefcase className="size-3.5" />
                        Match Offers & Partners
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                No signal findings generated yet. The analyzer is verifying the source content.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <UploadCloud className="mx-auto size-10 text-muted-foreground/40" />
          <h3 className="mt-3 text-base font-semibold text-foreground">No source selected</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Provide a company website URL or upload a document at the top to start analysis.
          </p>
        </div>
      )}

      {/* Match modal */}
      {matchFinding && (
        <BusinessOpportunityMatchingModal
          open={!!matchFinding}
          onClose={() => setMatchFinding(null)}
          signalType="ingestion_finding"
          signalId={matchFinding.id}
          signalTitle={matchFinding.title}
          signalDescription={matchFinding.detail}
          context={context}
        />
      )}
    </div>
  )
}
