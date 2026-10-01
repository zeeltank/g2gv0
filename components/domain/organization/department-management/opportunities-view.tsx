'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  BookmarkPlus,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SelectInput } from '../components'
import type { LaravelContext } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import {
  opportunitiesService,
  type Opportunity,
  type OpportunityListResponse,
  type ResearchRun,
  type ResearchSourceInfo,
  type ResearchStatusResponse,
} from '@/services/signals/opportunities'
import { ProductProfileDialog } from './product-profile-dialog'
import { ProviderStatusPanel } from './provider-status-panel'
import { Fact, GroupHeading, Notice, SectionHeader, SignalsPage, StatTile, Surface } from './signals-ui'
import { BusinessOpportunityMatchingModal } from './business-opportunity-matching-modal'

const POLL_MS = 2500
const POLL_MAX = 120

const RESEARCH_STAGES = [
  { key: 'preparing', label: 'Preparing research' },
  { key: 'searching', label: 'Searching public sources' },
  { key: 'collecting', label: 'Collecting relevant evidence' },
  { key: 'analyzing', label: 'Analyzing opportunities' },
  { key: 'saving', label: 'Saving signals' },
  { key: 'completed', label: 'Research completed' },
] as const

const STAGE_ORDER: Record<string, number> = {
  preparing: 0,
  searching: 1,
  collecting: 2,
  analyzing: 3,
  saving: 4,
  completed: 5,
}

type Filters = { search: string; category: string; kind: string; priority: string; qualification: string; reviewStatus: string; reportDate: string }
const EMPTY: Filters = { search: '', category: '', kind: '', priority: '', qualification: '', reviewStatus: '', reportDate: '' }

const PRIORITY_VARIANT = { High: 'destructive', Medium: 'warning', Low: 'muted' } as const

function fmt(value?: string | null, withTime = true) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

const errText = (cause: unknown, fallback: string) => (cause instanceof ApiError || cause instanceof Error ? cause.message : fallback)

function QualBadge({ value }: { value: Opportunity['qualification'] }) {
  const variant = value === 'Relevant Requirement Found' ? 'success' : value === 'Needs Verification' ? 'warning' : value === 'Monitoring' ? 'muted' : 'navy'
  return <Badge variant={variant}>{value}</Badge>
}

function ResearchProgressCard({ run }: { run: ResearchRun | null }) {
  const currentStage = run?.stage || 'preparing'
  const currentIndex = STAGE_ORDER[currentStage] ?? 0
  const isFailed = run?.status === 'failed' || currentStage === 'failed'

  return (
    <Surface className="overflow-hidden border-primary/40 bg-gradient-to-br from-primary/[0.04] to-card p-5 shadow-xs">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Loader2 className="size-4 animate-spin" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Company Research in Progress {run?.id ? `(#${run.id})` : ''}
              </h4>
              <p className="text-xs text-muted-foreground">
                {run?.stage_message || 'Research pipeline is actively collecting and analyzing market opportunities...'}
              </p>
            </div>
          </div>
          <Badge variant="navy" className="text-xs font-medium">
            Background Execution Active
          </Badge>
        </div>

        {/* Stages Progress Stepper */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {RESEARCH_STAGES.map((s, idx) => {
            const isCompleted = idx < currentIndex
            const isCurrent = idx === currentIndex && !isFailed

            return (
              <div
                key={s.key}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs transition-colors ${
                  isCurrent
                    ? 'border-primary/60 bg-primary/10 text-foreground font-semibold shadow-xs'
                    : isCompleted
                      ? 'border-border bg-muted/40 text-muted-foreground'
                      : 'border-dashed border-border/60 bg-card/40 text-muted-foreground/60'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <Circle className="size-3.5 shrink-0 text-muted-foreground/40" />
                )}
                <span className="truncate">{s.label}</span>
              </div>
            )
          })}
        </div>

        {/* Live Counters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            {run?.sources_found !== undefined && run.sources_found > 0 && (
              <span>Sources found: <strong className="text-foreground">{run.sources_found}</strong></span>
            )}
            {run?.companies_researched !== undefined && run.companies_researched > 0 && (
              <span>Entities checked: <strong className="text-foreground">{run.companies_researched}</strong></span>
            )}
            {run?.search_provider && (
              <span>Provider: <strong className="text-foreground capitalize">{run.search_provider}</strong></span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground italic">
            Safe to leave or refresh — the backend job continues independently.
          </span>
        </div>
      </div>
    </Surface>
  )
}

function OpportunityCard({ o, onOpen, onMatch }: { o: Opportunity; onOpen: (o: Opportunity) => void; onMatch: (o: Opportunity) => void }) {
  const high = o.priority === 'High' && o.review_status !== 'Dismissed'
  const meta = [o.industry, o.location].filter(Boolean).join(' · ')
  return (
    <Surface className={`p-5 ${high ? 'border-destructive/30' : ''} ${o.review_status === 'Dismissed' ? 'opacity-70' : ''}`}>
      <article className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {o.signal_kind_label && <Badge variant="default">{o.signal_kind_label}</Badge>}
          <Badge variant="navy">{o.category_label}</Badge>
          <Badge variant={PRIORITY_VARIANT[o.priority]}>{o.priority}</Badge>
          <QualBadge value={o.qualification} />
          {o.review_status !== 'New' && <Badge variant="muted">{o.review_status}</Badge>}
          <span className="ml-auto text-xs text-muted-foreground">Found {fmt(o.first_discovered_at, false)}</span>
        </div>

        <div className="min-w-0">
          <h4 className="break-words text-base font-semibold leading-snug text-foreground">{o.company_name}</h4>
          <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
            {meta || 'Industry and location not verified from sources'}
            {o.website && (
              <>
                {meta && ' · '}
                <a href={o.website} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
                  {o.website.replace(/^https?:\/\//, '')}
                </a>
              </>
            )}
          </p>
          <p className="mt-3 break-words text-sm font-medium leading-snug text-foreground">{o.title}</p>
        </div>

        <dl className="space-y-4">
          <Fact label="Observed event">{o.observed_event}</Fact>
          {o.source_published_at && (
            <p className="text-xs text-muted-foreground">Published: {fmt(o.source_published_at, false)}</p>
          )}
          <div className="grid gap-4 @2xl:grid-cols-2">
            <Fact label={`Inference — Why they may need ${o.product_name ?? 'the product'}`}>{o.why_indicates_need}</Fact>
            <Fact label="Suggested next action">{o.recommended_action}</Fact>
          </div>
          {o.confirmed_facts && o.confirmed_facts.length > 0 && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Confirmed Facts</dt>
              <dd className="mt-1 text-xs text-foreground">
                <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                  {o.confirmed_facts.slice(0, 2).map((fact, idx) => (
                    <li key={idx}><span className="text-foreground">{fact}</span></li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          {o.primary_source ? (
            <a
              href={o.primary_source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 max-w-full flex-1 items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="size-3.5 shrink-0" />
              <span className="truncate">{o.primary_source.title}</span>
            </a>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default" className="shrink-0" onClick={() => onMatch(o)}>
              <Briefcase className="mr-1.5 size-3.5" /> Match Offers &amp; Partners
            </Button>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => onOpen(o)}>View evidence</Button>
          </div>
        </div>
      </article>
    </Surface>
  )
}

function OpportunityDetail({ o, busy, onAct, onMatch }: { o: Opportunity; busy: boolean; onAct: (a: 'review' | 'dismiss' | 'follow-up') => void; onMatch: (o: Opportunity) => void }) {
  return (
    <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {o.signal_kind_label && <Badge variant="default">{o.signal_kind_label}</Badge>}
        <Badge variant="navy">{o.category_label}</Badge>
        <Badge variant={PRIORITY_VARIANT[o.priority]}>{o.priority} priority</Badge>
        <QualBadge value={o.qualification} />
        <Badge variant="muted">Confidence: {o.confidence}</Badge>
        <Badge variant="muted">{o.review_status}</Badge>
      </div>

      <section className="space-y-1 rounded-lg bg-muted/50 p-4">
        <p className="break-words font-semibold text-foreground">{o.company_name}</p>
        <p className="break-words text-xs leading-relaxed text-muted-foreground">
          {[o.industry, o.location].filter(Boolean).join(' · ') || 'Industry and location not verified from sources'}
          {o.website && (<> · <a href={o.website} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">{o.website}</a></>)}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Source published {fmt(o.source_published_at, false)} · Event date {fmt(o.event_date, false)} · First found {fmt(o.first_discovered_at)} · Last verified {fmt(o.last_verified_at)}
        </p>
      </section>

      <dl className="space-y-4">
        <Fact label="Observed event">{o.observed_event}</Fact>
        <Fact label="Why this may indicate a need">{o.why_indicates_need}</Fact>
        <Fact label="Product fit">{o.product_fit}</Fact>
        <Fact label="Recommended next action">{o.recommended_action}</Fact>
      </dl>

      <p className="text-xs leading-relaxed text-muted-foreground">
        This is an AI-assisted lead signal, not confirmed buying intent. Verify against the sources before acting. Nothing is sent to the company automatically.
      </p>

      <section>
        <h5 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sources ({o.sources?.length ?? 0})</h5>
        <ul className="mt-2 divide-y divide-border/60">
          {(o.sources ?? []).map((src, i) => (
            <li key={i} className="space-y-1 py-3 first:pt-1">
              <a href={src.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-start gap-1.5 font-medium text-primary hover:underline">
                <span className="break-words">{src.title}</span> <ExternalLink className="mt-1 size-3 shrink-0" />
              </a>
              <p className="break-all text-xs text-muted-foreground">{src.url}</p>
              <p className="text-xs text-muted-foreground">Published {fmt(src.published_at, false)} · Retrieved {fmt(src.retrieved_at)} · {src.page_fetched ? 'Full page read' : 'Search excerpt only'}</p>
              {src.excerpt && <blockquote className="mt-2 break-words border-l-2 border-primary/40 pl-3 leading-relaxed text-foreground">&ldquo;{src.excerpt}&rdquo;</blockquote>}
            </li>
          ))}
        </ul>
      </section>

      <div className="sticky bottom-0 -mb-px flex flex-wrap justify-end gap-2 border-t border-border/60 bg-card pt-4">
        <Button size="sm" variant="default" onClick={() => onMatch(o)}><Briefcase className="mr-1.5 size-4" /> Match Offers &amp; Partners</Button>
        <Button size="sm" variant="outline" disabled={busy || o.review_status === 'Dismissed'} onClick={() => onAct('dismiss')}><XCircle className="mr-1.5 size-4" /> Dismiss</Button>
        <Button size="sm" variant="outline" disabled={busy || o.review_status === 'Follow-up'} onClick={() => onAct('follow-up')}><BookmarkPlus className="mr-1.5 size-4" /> Add to follow-up</Button>
        <Button size="sm" disabled={busy || o.review_status === 'Reviewed'} onClick={() => onAct('review')}><CheckCircle2 className="mr-1.5 size-4" /> Mark reviewed</Button>
      </div>
    </div>
  )
}

function RunLine({ run, context }: { run: ResearchRun; context: LaravelContext }) {
  const tone = run.status === 'failed' ? 'destructive' : run.status === 'skipped' ? 'muted' : run.status === 'partial' ? 'warning' : 'success'
  const [sources, setSources] = useState<ResearchSourceInfo[] | null>(null)
  const [openSources, setOpenSources] = useState(false)
  const [sourcesError, setSourcesError] = useState('')

  async function toggle() {
    const next = !openSources
    setOpenSources(next)
    if (next && sources === null) {
      try {
        setSources((await opportunitiesService.getRunSources(context, run.id)).data)
      } catch (cause) {
        setSourcesError(errText(cause, 'Could not load the sources.'))
      }
    }
  }

  return (
    <li className="space-y-1 py-3 text-sm first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{fmt(run.report_date, false)}</span>
        <Badge variant={tone}>{run.status}</Badge>
        <Badge variant="muted">{run.trigger}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">{fmt(run.started_at)}</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {run.sources_found} sources · {run.companies_researched} companies · {run.opportunities_qualified} qualified ({run.opportunities_new} new)
        {run.queries_failed > 0 && ` · ${run.queries_failed}/${run.queries_run} searches failed`}
      </p>
      {run.error_message && <p className="text-xs leading-relaxed text-foreground">{run.error_message}</p>}
      {run.sources_found > 0 && (
        <>
          <button type="button" onClick={() => void toggle()} className="text-xs font-medium text-primary hover:underline">{openSources ? 'Hide sources' : 'View sources'}</button>
          {openSources && (
            <ul className="mt-2 space-y-2 rounded-lg bg-muted/40 p-3">
              {sourcesError && <li className="text-xs text-destructive">{sourcesError}</li>}
              {sources === null && !sourcesError && <li className="text-xs text-muted-foreground">Loading…</li>}
              {sources?.map((src, i) => (
                <li key={i} className="min-w-0 text-xs leading-relaxed">
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="break-words font-medium text-primary hover:underline">{src.title}</a>
                  <span className="block break-all text-muted-foreground">{src.domain} · published {fmt(src.published_at, false)} · {src.page_fetched ? 'full page read' : 'search excerpt'}{src.cited ? ' · cited by a signal' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}

/*
 * Data is fetched on filter change and a started run is followed by polling; both set
 * state from effects/timers by design.
 */
/* eslint-disable react-hooks/set-state-in-effect -- Intentional: fetch-on-filter-change and run polling */
export function OpportunitiesView({ context }: { context: LaravelContext }) {
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<OpportunityListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<ResearchStatusResponse['data'] | null>(null)
  const [running, setRunning] = useState(false)
  const [activeRun, setActiveRun] = useState<ResearchRun | null>(null)
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)
  const [open, setOpen] = useState<Opportunity | null>(null)
  const [acting, setActing] = useState(false)
  const [matchingOpportunity, setMatchingOpportunity] = useState<Opportunity | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [providersOpen, setProvidersOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<ResearchRun[] | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRef = useRef(0)
  const activeRunIdRef = useRef<number | null>(null)

  const storageKey = `g2g_active_research_${context.organizationId || context.subInstituteId || 'default'}`

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters.search.trim()), 300)
    return () => clearTimeout(t)
  }, [filters.search])

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    setError('')
    try {
      const response = await opportunitiesService.list(context, {
        search: debounced || undefined, category: filters.category || undefined, kind: filters.kind || undefined, priority: filters.priority || undefined,
        qualification: filters.qualification || undefined, reviewStatus: filters.reviewStatus || undefined,
        reportDate: filters.reportDate || undefined, page,
      })
      if (request === requestRef.current) setList(response)
    } catch (cause) {
      if (request === requestRef.current) setError(errText(cause, 'Failed to load opportunities.'))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [context, debounced, filters.category, filters.kind, filters.priority, filters.qualification, filters.reviewStatus, filters.reportDate, page])

  const loadStatus = useCallback(async () => {
    try {
      const response = await opportunitiesService.getStatus(context)
      setStatus(response.data)
      return response.data
    } catch {
      return null
    }
  }, [context])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadStatus() }, [loadStatus])
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])

  const poll = useCallback((runId: number, attempt: number) => {
    activeRunIdRef.current = runId
    pollRef.current = setTimeout(async () => {
      try {
        const runRes = await opportunitiesService.getRun(context, runId)
        const run = runRes.data
        setActiveRun(run)

        const isTerminal = run && ['success', 'partial', 'failed', 'skipped'].includes(run.status)
        if (isTerminal || attempt >= POLL_MAX) {
          setRunning(false)
          activeRunIdRef.current = null
          try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }

          if (isTerminal) {
            if (run.status === 'failed' || run.status === 'skipped') {
              setNotice({ tone: 'error', text: run.error_message ?? 'Research did not complete.' })
            } else {
              setNotice({
                tone: 'info',
                text: run.opportunities_qualified === 0
                  ? `Research finished: checked ${run.sources_found} sources across ${run.companies_researched} companies, but no sufficiently supported opportunities qualified.`
                  : `Research finished: found ${run.opportunities_qualified} qualified opportunities (${run.opportunities_new} new) from ${run.sources_found} sources.`,
              })
            }
          } else {
            setNotice({ tone: 'error', text: 'Research is still running in the background. You can check back shortly or view Report History.' })
          }

          void load()
          void loadStatus()
          return
        }
      } catch {
        // Fallback to checking overall status if getRun fails
        const current = await loadStatus()
        if (current && !current.running) {
          setRunning(false)
          activeRunIdRef.current = null
          try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
          void load()
          return
        }
      }

      poll(runId, attempt + 1)
    }, POLL_MS)
  }, [context, load, loadStatus, storageKey])

  // Resume running state from sessionStorage across page navigation or refresh
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey)
      if (stored) {
        const runId = Number(stored)
        if (runId > 0 && !activeRunIdRef.current) {
          setRunning(true)
          opportunitiesService.getRun(context, runId).then((res) => {
            const run = res.data
            if (run && run.status === 'running') {
              setActiveRun(run)
              poll(runId, 0)
            } else {
              setRunning(false)
              try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
              if (run) setActiveRun(run)
            }
          }).catch(() => {
            try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
            setRunning(false)
          })
        }
      }
    } catch { /* ignore */ }
  }, [context, poll, storageKey])

  // Sync if status shows a run is in progress and polling hasn't started yet
  useEffect(() => {
    if (status?.running && !running && status.latest_run?.id && !activeRunIdRef.current) {
      setRunning(true)
      setActiveRun(status.latest_run)
      poll(status.latest_run.id, 0)
    }
  }, [status?.running, status?.latest_run, running, poll])

  async function runNow() {
    if (running) return
    setNotice(null)
    setRunning(true)
    try {
      const res = await opportunitiesService.runResearch(context)
      const runId = res.data?.run_id ?? res.data?.run?.id
      if (runId) {
        setActiveRun(res.data?.run ?? null)
        try { sessionStorage.setItem(storageKey, String(runId)) } catch { /* ignore */ }
        poll(runId, 0)
      } else {
        const s = await loadStatus()
        const id = s?.latest_run?.id ?? 0
        if (id) poll(id, 0)
      }
    } catch (cause) {
      setRunning(false)
      setNotice({ tone: 'error', text: errText(cause, 'Could not start research.') })
    }
  }

  async function act(action: 'review' | 'dismiss' | 'follow-up') {
    if (!open) return
    setActing(true)
    try {
      const response = await opportunitiesService.act(context, open.id, action)
      setOpen((cur) => (cur ? { ...cur, ...response.data } : cur))
      void load()
    } catch (cause) {
      setNotice({ tone: 'error', text: errText(cause, 'Could not update the opportunity.') })
    } finally {
      setActing(false)
    }
  }

  async function openOpportunity(o: Opportunity) {
    setOpen(o)
    try {
      setOpen((await opportunitiesService.get(context, o.id)).data)
    } catch (cause) {
      setNotice({ tone: 'error', text: errText(cause, 'Could not load the details.') })
    }
  }

  async function showHistory() {
    setHistoryOpen(true)
    setHistory(null)
    try {
      setHistory((await opportunitiesService.getRuns(context)).data)
    } catch (cause) {
      setNotice({ tone: 'error', text: errText(cause, 'Could not load the report history.') })
      setHistoryOpen(false)
    }
  }

  const set = (patch: Partial<Filters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(1) }
  const req = status?.requirements
  const blocked = Boolean(req && (!req.profile_complete || !req.search_configured || !req.ai_configured))
  const active = Object.values(filters).some(Boolean)
  const latest = status?.latest_run
  const last = status?.last_successful_run

  return (
    <SignalsPage>
      <SectionHeader
        title="Company opportunities"
        description="Public, source-backed signals that companies may need your product. These are leads to verify, not confirmed buyers."
        actions={
          <>
            <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => { void load(); void loadStatus() }} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></Button>
            <Button variant="outline" onClick={() => setProvidersOpen(true)}><ShieldCheck className="mr-2 size-4" /> Providers</Button>
            <Button variant="outline" onClick={showHistory}><History className="mr-2 size-4" /> Report history</Button>
            <Button variant="outline" onClick={() => setProfileOpen(true)}><Settings2 className="mr-2 size-4" /> Product profile</Button>
            <Button onClick={runNow} disabled={running || blocked}>
              {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Search className="mr-2 size-4" />}
              {running ? 'Researching…' : 'Run Research Now'}
            </Button>
          </>
        }
      />

      {(running || activeRun?.status === 'running') && (
        <ResearchProgressCard run={activeRun ?? latest ?? null} />
      )}

      <section aria-label="Research status" className="space-y-3">
        <Surface>
          <dl className="grid divide-y divide-border/60 @xl:grid-cols-3 @xl:divide-x @xl:divide-y-0">
            <div className="p-4"><Fact label="Last successful run">{last ? fmt(last.completed_at) : 'None yet'}</Fact></div>
            <div className="p-4"><Fact label={`Next scheduled${status?.timezone ? ` (${status.timezone})` : ''}`}>{status?.next_scheduled_at ? fmt(status.next_scheduled_at) : req?.research_enabled === false ? 'Automatic research is off' : '—'}</Fact></div>
            <div className="p-4"><Fact label="Current status"><span className="capitalize">{running ? 'Running…' : latest ? latest.status : 'Ready to search'}</span></Fact></div>
          </dl>
        </Surface>

        {req && !req.profile_complete && (
          <Notice tone="warning" action={<Button size="sm" onClick={() => setProfileOpen(true)}>Set up profile</Button>}>
            Daily company research needs a completed product and target-customer profile. No results are generated from an empty profile.
          </Notice>
        )}
        {latest && (latest.status === 'failed' || latest.queries_failed > 0) && !running && !notice && (
          <Notice tone="error" action={latest.status === 'failed' && !blocked ? <Button size="sm" variant="outline" onClick={() => void runNow()}>Retry now</Button> : undefined}>
            {latest.status === 'failed' ? `The last research run failed: ${latest.error_message ?? 'unknown error'}` : `${latest.queries_failed} of ${latest.queries_run} searches failed in the last run.`}
          </Notice>
        )}
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      </section>

      <section aria-label="Last run summary" className="space-y-4">
        <GroupHeading title="Last run" aside={latest ? fmt(latest.completed_at ?? latest.started_at) : undefined} />
        <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
        <StatTile label="Companies researched" value={latest?.companies_researched} />
        <StatTile label="Qualifying opportunities" value={latest?.opportunities_qualified} />
        <StatTile label="New opportunities" value={list?.summary.new} />
        <StatTile label="Research failures" value={latest ? latest.queries_failed + (latest.status === 'failed' ? 1 : 0) : undefined} />
        </div>
      </section>

      <section aria-label="Opportunities" className="space-y-4">
        <GroupHeading title="Opportunities" aside={list ? `${list.meta.total} total` : undefined} />

        <Surface className="p-4">
          <div className="grid gap-3 @xl:grid-cols-2 @3xl:grid-cols-3">
            <div className="@xl:col-span-2 @3xl:col-span-3">
              <Input aria-label="Search opportunities" placeholder="Search company, title or event" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
            </div>
            <SelectInput value={filters.category} onChange={(v) => set({ category: v })} options={[{ value: '', label: 'All categories' }, ...(list?.filters.categories ?? [])]} />
            <SelectInput value={filters.kind} onChange={(v) => set({ kind: v })} options={[{ value: '', label: 'All signal types' }, ...(list?.filters.kinds ?? [])]} />
            <SelectInput value={filters.priority} onChange={(v) => set({ priority: v })} options={[{ value: '', label: 'All priorities' }, { value: 'High', label: 'High' }, { value: 'Medium', label: 'Medium' }, { value: 'Low', label: 'Low' }]} />
            <SelectInput value={filters.qualification} onChange={(v) => set({ qualification: v })} options={[{ value: '', label: 'All qualifications' }, ...['New Opportunity', 'Needs Verification', 'Relevant Requirement Found', 'Monitoring'].map((q) => ({ value: q, label: q }))]} />
            <SelectInput value={filters.reviewStatus} onChange={(v) => set({ reviewStatus: v })} options={[{ value: '', label: 'All review states' }, ...['New', 'Reviewed', 'Follow-up', 'Dismissed'].map((q) => ({ value: q, label: q }))]} />
            <SelectInput value={filters.reportDate} onChange={(v) => set({ reportDate: v })} options={[{ value: '', label: 'All report dates' }, ...(list?.filters.report_dates ?? []).map((d) => ({ value: d, label: fmt(d, false) }))]} />
          </div>
        </Surface>

        {loading && !list ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading opportunities">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}</div>
        ) : error ? (
          <ErrorState title="Could not load opportunities" description={error} retry={() => void load()} />
        ) : list && list.data.length === 0 ? (
          active || list.summary.total > 0 ? (
            <EmptyState icon={<Search className="size-8" />} title="No opportunities match these filters" description="Try clearing a filter." action={<Button variant="outline" onClick={() => { setFilters(EMPTY); setPage(1) }}>Clear filters</Button>} />
          ) : (
            <EmptyState
              icon={<Search className="size-8" />}
              title={running ? 'Researching companies…' : latest?.status === 'success' || latest?.status === 'partial' ? 'No qualifying opportunities found' : 'No opportunities yet'}
              description={running ? 'Searching public sources and qualifying findings. This can take a few minutes.'
                : latest?.status === 'success' || latest?.status === 'partial' ? `The last research run reviewed ${latest.sources_found} sources across ${latest.companies_researched} companies, but found no company activity with enough confirmed evidence to qualify. All source records are preserved in the Report History.`
                : blocked ? 'Complete the setup above, then research will run daily at the scheduled time.' : 'Research runs automatically at the scheduled time, or click Run Research Now.'}
            />
          )
        ) : (
          <>
            <div className="space-y-4" aria-busy={loading}>{list?.data.map((o) => <OpportunityCard key={o.id} o={o} onOpen={openOpportunity} onMatch={setMatchingOpportunity} />)}</div>
            {list && list.meta.last_page > 1 && (
              <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Opportunities pagination">
                <span className="text-muted-foreground">Page {list.meta.page} of {list.meta.last_page} · {list.meta.total} opportunities</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /> Previous</Button>
                  <Button size="sm" variant="outline" disabled={page >= list.meta.last_page || loading} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="size-4" /></Button>
                </div>
              </nav>
            )}
          </>
        )}
      </section>

      <Dialog open={open !== null} onOpenChange={(next) => { if (!next) setOpen(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="break-words pr-6">{open?.title}</DialogTitle><DialogDescription>{open?.company_name}</DialogDescription></DialogHeader>
          {open && <OpportunityDetail o={open} busy={acting} onAct={act} onMatch={(o) => { setOpen(null); setMatchingOpportunity(o) }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Daily research history</DialogTitle><DialogDescription>Every run is kept, including skipped and failed ones.</DialogDescription></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {!history ? <Skeleton className="h-24" /> : history.length === 0 ? <p className="text-sm text-muted-foreground">No research runs yet.</p> : <ul className="divide-y divide-border/60">{history.map((r) => <RunLine key={r.id} run={r} context={context} />)}</ul>}
          </div>
        </DialogContent>
      </Dialog>

      <ProductProfileDialog open={profileOpen} context={context} onOpenChange={setProfileOpen} onSaved={() => { void loadStatus(); setNotice({ tone: 'info', text: 'Product profile saved.' }) }} />

      <BusinessOpportunityMatchingModal
        open={matchingOpportunity !== null}
        onOpenChange={(isOpen) => { if (!isOpen) setMatchingOpportunity(null) }}
        signalType="company_opportunity"
        signalId={matchingOpportunity?.id ?? 0}
        signalTitle={matchingOpportunity?.title ?? ''}
        signalDescription={`${matchingOpportunity?.company_name ?? ''}: ${matchingOpportunity?.observed_event ?? ''}. ${matchingOpportunity?.why_indicates_need ?? ''}`}
      />
    </SignalsPage>
  )
}
