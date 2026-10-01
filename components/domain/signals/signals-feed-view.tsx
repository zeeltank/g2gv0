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
  Filter,
  Layers,
  Loader2,
  Radar,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import {
  opportunitiesService,
  type Opportunity,
  type OpportunityListResponse,
  type ResearchStatusResponse,
} from '@/services/signals/opportunities'
import { ProductProfileDialog } from '../organization/department-management/product-profile-dialog'
import { ProviderStatusPanel } from '../organization/department-management/provider-status-panel'
import { BusinessOpportunityMatchingModal } from '../organization/department-management/business-opportunity-matching-modal'

const POLL_MS = 3000
const POLL_MAX = 200

type FeedSectionKey = 'all' | 'immediate_action' | 'watchlist' | 'market_intelligence' | 'competitor_intelligence'

const SECTIONS: { key: FeedSectionKey; label: string; desc: string }[] = [
  { key: 'all', label: 'All Signals', desc: 'Complete research feed across all channels' },
  { key: 'immediate_action', label: 'Immediate Action', desc: 'Urgent tenders, active RFPs, and high-priority expansions' },
  { key: 'watchlist', label: 'Watchlist', desc: 'Emerging accounts, leadership transitions, and market movements' },
  { key: 'market_intelligence', label: 'Market Intelligence', desc: 'Sector trends, regulatory mandates, and policy rollouts' },
  { key: 'competitor_intelligence', label: 'Competitor Intel', desc: 'Competitor expansions, vendor displacements, and partner shifts' },
]

function fmtDate(value?: string | null, withTime = false) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    })
  } catch {
    return value
  }
}

export function SignalsFeedView() {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const ready = isLaravelContextReady(context)

  // Status & feed data
  const [status, setStatus] = useState<ResearchStatusResponse['data'] | null>(null)
  const [data, setData] = useState<OpportunityListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtering & pagination
  const [section, setSection] = useState<FeedSectionKey>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Modals & Drawers
  const [profileOpen, setProfileOpen] = useState(false)
  const [providersOpen, setProvidersOpen] = useState(false)
  const [reviewNoteModal, setReviewNoteModal] = useState<{ opp: Opportunity; action: 'review' | 'dismiss' | 'follow-up' } | null>(null)
  const [reviewNoteText, setReviewNoteText] = useState('')
  const [matchingModalOpp, setMatchingModalOpp] = useState<Opportunity | null>(null)

  // Custom scan form state
  const [showFilters, setShowFilters] = useState(false)
  const [scanForm, setScanForm] = useState({
    topic: '',
    company: '',
    industry: '',
    geography: '',
    signal_type: '',
    recency_days: 30,
  })
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)

  // Polling ref
  const pollCount = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadFeed = useCallback(async () => {
    if (!ready) return
    try {
      const res = await opportunitiesService.list(context, {
        search: search || undefined,
        feedSection: section === 'all' ? undefined : section,
        page,
      })
      setData(res)
      setError(null)
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Unable to load signals')
    } finally {
      setLoading(false)
    }
  }, [context, ready, search, section, page])

  const loadStatus = useCallback(async () => {
    if (!ready) return
    try {
      const res = await opportunitiesService.getStatus(context)
      setStatus(res.data)
      return res.data
    } catch {
      return null
    }
  }, [context, ready])

  // Initial load
  useEffect(() => {
    loadStatus()
    loadFeed()
  }, [loadStatus, loadFeed])

  // Poll while research is running
  useEffect(() => {
    if (!status?.running) return

    const poll = async () => {
      if (pollCount.current++ > POLL_MAX) return
      const s = await loadStatus()
      if (s && !s.running) {
        loadFeed()
        setScanning(false)
        return
      }
      timer.current = setTimeout(poll, POLL_MS)
    }
    timer.current = setTimeout(poll, POLL_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [status?.running, loadStatus, loadFeed])

  const handleStartScan = async (isCustom = false) => {
    if (!ready) return
    setScanning(true)
    setScanMessage(null)
    try {
      const params = isCustom ? scanForm : undefined
      const res = await opportunitiesService.runResearch(context, params)
      setScanMessage(res.message)
      loadStatus()
    } catch (e) {
      setScanMessage(e instanceof ApiError || e instanceof Error ? e.message : 'Failed to launch research run')
      setScanning(false)
    }
  }

  const handleAction = async (opp: Opportunity, action: 'review' | 'dismiss' | 'follow-up', notes?: string) => {
    if (!ready) return
    try {
      await opportunitiesService.act(context, opp.id, action, notes)
      setReviewNoteModal(null)
      setReviewNoteText('')
      loadFeed()
    } catch (e) {
      alert(e instanceof ApiError || e instanceof Error ? e.message : 'Action failed')
    }
  }

  const summary = data?.summary
  const items = data?.data ?? []

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Top Banner & Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Radar className="size-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Signals Feed
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Claude Cowork Morning Opportunity Intelligence — Evidence-backed signals discovered across verified public records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setProvidersOpen(true)}
            className="gap-2 text-xs"
          >
            <ShieldCheck className="size-3.5" />
            AI & Search Status
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setProfileOpen(true)}
            className="gap-2 text-xs"
          >
            <Settings2 className="size-3.5" />
            Product Profile
          </Button>
        </div>
      </div>

      {/* Opportunity Research Console (Claude Cowork Morning Opportunity Intelligence) */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search topic or research trigger (e.g. ERP modernization, cloud tender, AI expansion)..."
              value={scanForm.topic}
              onChange={(e) => setScanForm({ ...scanForm, topic: e.target.value })}
              className="h-10 pl-9 pr-4 text-xs sm:text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !status?.running && !scanning) {
                  handleStartScan(Boolean(scanForm.topic || scanForm.company || scanForm.industry || scanForm.geography || scanForm.signal_type))
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={showFilters ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-10 gap-1.5 px-3 text-xs"
            >
              <Filter className="size-3.5" />
              <span>Filters</span>
              {(scanForm.company || scanForm.industry || scanForm.geography || scanForm.signal_type || scanForm.recency_days !== 30) && (
                <span className="size-1.5 rounded-full bg-primary" />
              )}
            </Button>
            <Button
              type="button"
              className="h-10 gap-2 px-4 text-xs font-semibold"
              disabled={status?.running || scanning}
              onClick={() => handleStartScan(Boolean(scanForm.topic || scanForm.company || scanForm.industry || scanForm.geography || scanForm.signal_type))}
            >
              {status?.running || scanning ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Researching Live Web...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  <span>Run Research Now</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Optional Collapsible Filters */}
        {showFilters && (
          <div className="grid gap-3 pt-3 border-t border-border/60 sm:grid-cols-2 lg:grid-cols-5 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Target Company</label>
              <Input
                placeholder="e.g. Tata, RailTel, ACME"
                value={scanForm.company}
                onChange={(e) => setScanForm({ ...scanForm, company: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Industry</label>
              <Input
                placeholder="e.g. Manufacturing, Rail"
                value={scanForm.industry}
                onChange={(e) => setScanForm({ ...scanForm, industry: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Geography</label>
              <Input
                placeholder="e.g. India, Middle East, US"
                value={scanForm.geography}
                onChange={(e) => setScanForm({ ...scanForm, geography: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Signal Type</label>
              <select
                value={scanForm.signal_type}
                onChange={(e) => setScanForm({ ...scanForm, signal_type: e.target.value })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Any Signal Type</option>
                <option value="tenders_rfps">Tenders & RFPs</option>
                <option value="corporate_expansion">Corporate Expansion</option>
                <option value="digital_transformation">Digital Transformation</option>
                <option value="compliance">Compliance Mandates</option>
                <option value="leadership">Leadership Changes</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="font-medium text-foreground block mb-1">Recency</label>
                <select
                  value={scanForm.recency_days}
                  onChange={(e) => setScanForm({ ...scanForm, recency_days: Number(e.target.value) || 30 })}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={60}>Last 60 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setScanForm({ topic: '', company: '', industry: '', geography: '', signal_type: '', recency_days: 30 })}
              >
                Reset
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Running Alert / Scan Status Banner */}
      {(status?.running || scanning || scanMessage) && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary" />
            <div>
              <p className="font-semibold text-foreground">
                {status?.latest_run?.stage_message || (status?.running ? 'Opportunity Discovery in Progress' : 'Research Triggered')}
              </p>
              <p className="text-xs text-muted-foreground">
                {status?.latest_run?.stage
                  ? `Stage: ${status.latest_run.stage} · Background job running independently · Safe to navigate away`
                  : scanMessage || 'Live search queries are gathering public records and verifying factual evidence.'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { loadFeed(); loadStatus(); }} className="gap-1">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      )}

      {/* Morning Opportunity Briefing & KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Feed</span>
            <Target className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{summary?.total ?? 0}</p>
          <span className="text-xs text-muted-foreground">{summary?.new ?? 0} new unreviewed</span>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 transition-colors hover:border-destructive/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-destructive">Immediate Action</span>
            <TrendingUp className="size-4 text-destructive" />
          </div>
          <p className="mt-2 text-2xl font-bold text-destructive">{summary?.immediate ?? summary?.high_priority ?? 0}</p>
          <span className="text-xs text-destructive/80">High urgency opportunities</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Watchlist</span>
            <Clock className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{summary?.watchlist ?? 0}</p>
          <span className="text-xs text-muted-foreground">Accounts under monitoring</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Market Intel</span>
            <Building2 className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{summary?.market_intelligence ?? 0}</p>
          <span className="text-xs text-muted-foreground">Policy & industry shifts</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">In Follow-Up</span>
            <CheckCircle2 className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{summary?.follow_up ?? 0}</p>
          <span className="text-xs text-muted-foreground">Engaged opportunities</span>
        </div>
      </div>

      {/* Top Business Action Briefing (Claude Cowork Morning Feed Style) */}
      {items.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Top Business Actions for Today</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Prioritized business actions synthesized from recent high-confidence signals.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {items.slice(0, 3).map((item) => (
              <div key={item.id} className="flex flex-col justify-between rounded-xl border border-border/80 bg-background/80 p-4">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-primary">{item.company_name}</span>
                    <Badge variant={item.priority === 'High' ? 'destructive' : 'warning'} className="text-[10px] px-1.5 py-0">
                      {item.urgency || item.priority}
                    </Badge>
                  </div>
                  <h4 className="mt-2 text-sm font-medium line-clamp-2 text-foreground">{item.title}</h4>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.recommended_action}</p>
                </div>
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                  <span className="text-[11px] text-muted-foreground">{item.product_name || 'Solution Match'}</span>
                  <button
                    onClick={() => setMatchingModalOpp(item)}
                    className="flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    View Match
                    <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feed Filter Tabs & Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-2">
            {SECTIONS.map((sec) => {
              const active = section === sec.key
              return (
                <button
                  key={sec.key}
                  onClick={() => {
                    setSection(sec.key)
                    setPage(1)
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                >
                  {sec.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 sm:w-72">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search headlines, company..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="h-9 pl-9 text-xs"
              />
            </div>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Section Description */}
        <p className="text-xs text-muted-foreground">
          {SECTIONS.find((s) => s.key === section)?.desc}
        </p>
      </div>

      {/* Main Signal Cards List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Failed to load signals" description={error} retry={loadFeed} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No opportunity signals found"
          description={
            search
              ? 'No signals matched your search criteria.'
              : 'Trigger a scan or run a custom search query to discover verified business opportunities.'
          }
          action={
            <Button onClick={() => handleStartScan(false)} className="gap-2">
              <Sparkles className="size-4" />
              Scan Now
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {items.map((opp) => {
            const isHigh = opp.priority === 'High' && opp.review_status !== 'Dismissed'
            const confirmedFacts = opp.confirmed_facts?.length ? opp.confirmed_facts : (opp.sources?.[0]?.excerpt ? [opp.sources[0].excerpt] : [])
            const unverifiedClaims = opp.unverified_claims || []

            return (
              <div
                key={opp.id}
                className={`overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all ${
                  isHigh ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border hover:border-border/80'
                }`}
              >
                {/* Header row: badges & timestamps */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isHigh ? 'destructive' : 'warning'}>
                      {opp.urgency || `${opp.priority} Urgency`}
                    </Badge>

                    {opp.signal_kind_label && (
                      <Badge variant="outline">{opp.signal_kind_label}</Badge>
                    )}

                    <Badge variant="outline" className="bg-muted/40">
                      {opp.category_label}
                    </Badge>

                    <Badge
                      variant={
                        opp.qualification === 'Relevant Requirement Found'
                          ? 'success'
                          : opp.qualification === 'Needs Verification'
                          ? 'warning'
                          : 'default'
                      }
                    >
                      {opp.qualification}
                    </Badge>

                    {opp.review_status !== 'New' && (
                      <Badge variant="outline" className="border-primary/40 text-primary">
                        {opp.review_status}
                      </Badge>
                    )}
                  </div>

                  <span className="text-xs text-muted-foreground">
                    Discovered {fmtDate(opp.first_discovered_at)}
                  </span>
                </div>

                {/* Company & Headline */}
                <div className="mt-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-foreground">{opp.company_name}</span>
                    {opp.industry && (
                      <span className="text-xs text-muted-foreground">· {opp.industry}</span>
                    )}
                    {opp.location && (
                      <span className="text-xs text-muted-foreground">· {opp.location}</span>
                    )}
                    {opp.website && (
                      <a
                        href={opp.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {opp.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>

                  <h3 className="mt-1.5 text-lg font-bold leading-snug text-foreground">
                    {opp.title}
                  </h3>
                </div>

                {/* What Happened (Observed Event) */}
                <div className="mt-3 rounded-xl bg-muted/30 p-3 text-sm leading-relaxed text-foreground">
                  <span className="font-medium text-foreground">What Happened: </span>
                  {opp.observed_event}
                </div>

                {/* Confirmed Facts vs Unverified Claims (Claude Cowork Verification) */}
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="size-4" />
                      Confirmed Facts (Verbatim Evidence)
                    </div>
                    {confirmedFacts.length > 0 ? (
                      <ul className="mt-2 space-y-1.5 text-xs text-foreground/90">
                        {confirmedFacts.map((fact, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                            <span className="italic">“{fact}”</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        Documented from cited public reporting below.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      <AlertCircle className="size-4" />
                      Unverified Claims & Limitations
                    </div>
                    {unverifiedClaims.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-foreground/90">
                        {unverifiedClaims.map((claim, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="size-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            <span>{claim}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Internal procurement budgets, target vendors, and final sign-off timelines remain unverified publicly.
                      </p>
                    )}
                  </div>
                </div>

                {/* Opportunity Rationale & Offer Match */}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border p-3.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Potential Business Need
                    </span>
                    <p className="mt-1 text-xs leading-relaxed text-foreground">
                      {opp.why_indicates_need}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Relevant Product / Offer Fit
                      </span>
                      {opp.relevant_offer_name && (
                        <Badge variant="navy" className="text-[10px]">
                          {opp.relevant_offer_name}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-foreground">
                      {opp.product_fit}
                    </p>
                  </div>
                </div>

                {/* Suggested Next Action */}
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-xs text-foreground">
                  <span className="font-semibold text-primary">Suggested Action:</span>
                  <span>{opp.recommended_action}</span>
                </div>

                {/* Provenance and Citation */}
                {opp.primary_source && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Source:</span>
                    <a
                      href={opp.primary_source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      {opp.primary_source.title || opp.primary_source.url}
                      <ExternalLink className="size-3" />
                    </a>
                    {opp.primary_source.published_at && (
                      <span>· Published {fmtDate(opp.primary_source.published_at)}</span>
                    )}
                  </div>
                )}

                {/* Review Notes (if saved) */}
                {opp.review_notes && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Reviewer Note: </span>
                    {opp.review_notes}
                  </div>
                )}

                {/* Action Bar */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={opp.review_status === 'Reviewed' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => handleAction(opp, 'review')}
                    >
                      <CheckCircle2 className="size-3.5 mr-1" />
                      Reviewed
                    </Button>

                    <Button
                      variant={opp.review_status === 'Follow-up' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setReviewNoteModal({ opp, action: 'follow-up' })
                        setReviewNoteText(opp.review_notes || '')
                      }}
                    >
                      <Clock className="size-3.5 mr-1" />
                      Set Follow-up
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction(opp, 'dismiss')}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <XCircle className="size-3.5 mr-1" />
                      Dismiss
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMatchingModalOpp(opp)}
                    className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <Briefcase className="size-3.5" />
                    Match Offers & Partners
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}



      {/* Review / Follow-Up Note Dialog */}
      <Dialog open={!!reviewNoteModal} onOpenChange={() => setReviewNoteModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Follow-Up & Action Plan</DialogTitle>
            <DialogDescription>
              Record team notes, designated owner, or planned next steps for {reviewNoteModal?.opp.company_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-foreground">Action Notes / Next Steps</label>
              <textarea
                rows={4}
                value={reviewNoteText}
                onChange={(e) => setReviewNoteText(e.target.value)}
                placeholder="e.g. Met with procurement head on 12th; requested follow-up meeting on proposal..."
                className="mt-1 w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setReviewNoteModal(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (reviewNoteModal) {
                    handleAction(reviewNoteModal.opp, reviewNoteModal.action, reviewNoteText)
                  }
                }}
              >
                Save & Set Follow-up
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogs: Product Profile, Provider Status, Offer/Partner Match Modal */}
      <ProductProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        context={context}
        onSaved={() => {
          loadStatus()
          loadFeed()
        }}
      />

      <Dialog open={providersOpen} onOpenChange={setProvidersOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI & Web Search Connectivity</DialogTitle>
            <DialogDescription>
              Verify active search API (Tavily/Brave) and AI model (Gemini) configuration.
            </DialogDescription>
          </DialogHeader>
          <ProviderStatusPanel context={context} canTest={true} />
        </DialogContent>
      </Dialog>

      {matchingModalOpp && (
        <BusinessOpportunityMatchingModal
          open={!!matchingModalOpp}
          onClose={() => setMatchingModalOpp(null)}
          signalType="opportunity"
          signalId={matchingModalOpp.id}
          signalTitle={matchingModalOpp.title}
          signalDescription={matchingModalOpp.observed_event}
          context={context}
        />
      )}
    </div>
  )
}
