'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import NextLink from 'next/link'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileUp,
  Flame,
  Link2,
  Loader2,
  Radar,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { summariseEvidence, type EvidenceSummary } from '@/lib/evidence-summary'
import { ApiError } from '@/services/core'
import {
  opportunitiesService,
  type IngestionSourceInfo,
  type Opportunity,
  type OpportunityListResponse,
  type ResearchStatusResponse,
  type BuyingIntentLevel,
  type SignalAssessment,
  type SignalStrength,
} from '@/services/signals/opportunities'

/** This view is ScholarClone's: everything it lists, runs or adds is for that product. */
const PRODUCT = 'scholarclone'

const POLL_MS = 3000
const POLL_MAX = 200

type Tab = 'now' | 'later'

const TABS: { key: Tab; label: string; hint: string; section: string }[] = [
  { key: 'now', label: 'Approach now', hint: 'A school is asking for, hiring for, or tendering for what we sell.', section: 'immediate_action' },
  { key: 'later', label: 'This month & watching', hint: 'Events that usually lead to a purchase, and schools worth keeping an eye on.', section: 'watchlist' },
]

const STRENGTH: Record<SignalStrength, { label: string; className: string }> = {
  hot: { label: 'Hot', className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  warm: { label: 'Warm', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  watch: { label: 'Watch', className: 'bg-muted text-muted-foreground border-border' },
}

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback)

/**
 * ScholarClone Signals: one screen. Schools that show a reason to buy ScholarClone, found from tenders, LinkedIn, job boards and
 * news, and from any file or link you add. Each card says which school, what happened, why it matters and who to approach.
 *
 * `embedded`: just the persisted ScholarClone cards. Running research belongs to the Company opportunities screen around it (Generate Signals),
 * which bumps `refreshKey` after a run so the cards re-read what the backend stored; documents are added in the Ingestion engine.
 */
export function ScholarSignalsView({ embedded = false, refreshKey = 0 }: { embedded?: boolean; refreshKey?: number } = {}) {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const ready = isLaravelContextReady(context)

  const [tab, setTab] = useState<Tab>('now')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<OpportunityListResponse | null>(null)
  const [status, setStatus] = useState<ResearchStatusResponse['data'] | null>(null)
  const [sources, setSources] = useState<IngestionSourceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [school, setSchool] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadFeed = useCallback(async () => {
    if (!ready) return
    try {
      const res = await opportunitiesService.list(context, {
        search: search || undefined,
        feedSection: TABS.find((t) => t.key === tab)!.section,
        product: PRODUCT,
        page,
      })
      setData(res)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load signals'))
    } finally {
      setLoading(false)
    }
  }, [context, ready, search, tab, page])

  const loadStatus = useCallback(async () => {
    if (!ready) return null
    try {
      const res = await opportunitiesService.getStatus(context, PRODUCT)
      setStatus(res.data)
      return res.data
    } catch {
      return null
    }
  }, [context, ready])

  const loadSources = useCallback(async () => {
    if (!ready) return [] as IngestionSourceInfo[]
    try {
      const res = await opportunitiesService.listSources(context)
      // Only ScholarClone's own documents (those added before products were recorded are ScholarClone's too).
      const mine = res.data.filter((x) => !x.product_key || x.product_key === PRODUCT)
      setSources(mine.slice(0, 5))
      return mine
    } catch {
      return [] as IngestionSourceInfo[]
    }
  }, [context, ready])

  // Load on mount and whenever a filter changes (deferred a tick: the loaders set state when they finish).
  useEffect(() => {
    let live = true
    Promise.resolve().then(() => {
      if (live && !embedded) {
        void loadStatus()
        void loadSources()
      }
    })
    return () => { live = false }
  }, [loadStatus, loadSources, embedded])
  useEffect(() => {
    let live = true
    Promise.resolve().then(() => { if (live) void loadFeed() })
    return () => { live = false }
  }, [loadFeed, refreshKey])

  // While research or a document is being worked on, keep looking until it is done.
  const working = Boolean(status?.running) || sources.some((s) => s.processing_status === 'generating')
  useEffect(() => {
    if (!working) return
    let n = 0
    let t: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (n++ > POLL_MAX) return
      const [s, list] = await Promise.all([loadStatus(), loadSources()])
      const still = Boolean(s?.running) || list.some((x) => x.processing_status === 'generating')
      if (!still) {
        loadFeed()
        return
      }
      t = setTimeout(poll, POLL_MS)
    }
    t = setTimeout(poll, POLL_MS)
    return () => clearTimeout(t)
  }, [working, loadStatus, loadSources, loadFeed])

  const findSignals = async (target?: string) => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await opportunitiesService.runResearch(context, target?.trim() ? { company: target.trim() } : undefined, PRODUCT)
      setMessage(res.message)
      setSchool('')
      loadStatus()
    } catch (e) {
      setMessage(errMsg(e, 'Could not start the search'))
    } finally {
      setBusy(false)
    }
  }

  const addFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await opportunitiesService.upload(context, file, PRODUCT)
      setMessage(res.message ?? 'File added.')
      loadSources()
    } catch (e) {
      setMessage(errMsg(e, 'Could not read that file'))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const addLink = async () => {
    if (!link.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await opportunitiesService.addUrl(context, link.trim(), PRODUCT)
      setMessage(res.message ?? 'Link added.')
      setLink('')
      loadSources()
    } catch (e) {
      setMessage(errMsg(e, 'Could not read that link'))
    } finally {
      setBusy(false)
    }
  }

  const act = async (opp: Opportunity, action: 'follow-up' | 'dismiss' | 'review') => {
    try {
      await opportunitiesService.act(context, opp.id, action)
      loadFeed()
    } catch (e) {
      setMessage(errMsg(e, 'Action failed'))
    }
  }

  const removeSource = async (id: number) => {
    try {
      await opportunitiesService.deleteSource(context, id)
      loadSources()
    } catch (e) {
      setMessage(errMsg(e, 'Could not delete'))
    }
  }

  const req = status?.requirements
  const items = data?.data ?? []
  const summary = data?.summary

  return (
    <div className={embedded ? 'space-y-6' : 'mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8'}>
      {!embedded && (
        <>
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Radar className="size-5" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight">ScholarClone sales cards</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Schools showing a reason to buy, found from tenders, LinkedIn, job boards, news and anything you add.
          </p>
        </div>
        <Button onClick={() => findSignals()} disabled={!ready || busy || working || !req?.search_configured || !req?.ai_configured} className="gap-2">
          {working ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {status?.running ? 'Searching…' : 'Find signals now'}
        </Button>
      </header>

      {req && (!req.search_configured || !req.ai_configured) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            {!req.search_configured ? 'No web search is set up (an administrator must set SIGNALS_SEARCH_DRIVER and its key). ' : ''}
            {!req.ai_configured ? 'No AI provider is set up for this organisation. ' : ''}
            Nothing can be searched until this is fixed. Nothing is made up in the meantime.
          </span>
        </div>
      )}

      {status?.latest_run && (
        <p className="text-xs text-muted-foreground">
          {status.running ? status.latest_run.stage_message : `Last search: ${status.latest_run.stage_message ?? status.latest_run.status}`}
          {status.daily_time ? ` · runs by itself every day at ${status.daily_time} (${status.timezone})` : ''}
        </p>
      )}

      {/* Add a school, a file or a link */}
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Check one school</p>
          <div className="flex gap-2">
            <Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="School name" className="h-9 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && school.trim() && findSignals(school)} />
            <Button size="sm" variant="outline" disabled={!school.trim() || busy || working} onClick={() => findSignals(school)}>
              <Search className="size-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Add a file (tender, job post, news, notes)</p>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => addFile(e.target.files?.[0])} />
          <Button size="sm" variant="outline" className="w-full gap-2" disabled={busy} onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" /> Choose a file
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Add a link (LinkedIn post, job, article)</p>
          <div className="flex gap-2">
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className="h-9 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && addLink()} />
            <Button size="sm" variant="outline" disabled={!link.trim() || busy} onClick={addLink}>
              <Link2 className="size-4" />
            </Button>
          </div>
        </div>
        {message && <p className="text-xs text-muted-foreground sm:col-span-3">{message}</p>}
        {sources.length > 0 && (
          <ul className="space-y-1 sm:col-span-3">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-xs">
                <span className="truncate">{s.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  {s.processing_status === 'generating' ? (
                    <><Loader2 className="size-3 animate-spin" /> Looking for signals…</>
                  ) : s.processing_status === 'failed' ? (
                    <><XCircle className="size-3 text-destructive" /> {s.processing_message ?? 'Failed'}
                      {s.can_retry && <button className="underline" onClick={() => opportunitiesService.analyze(context, s.id).then(loadSources)}>Retry</button>}</>
                  ) : (
                    <><CheckCircle2 className="size-3 text-emerald-600" /> {s.findings_count} {s.findings_count === 1 ? 'signal' : 'signals'}{s.processing_message ? ` · ${s.processing_message}` : ''}</>
                  )}
                  <button aria-label="Delete" onClick={() => removeSource(s.id)}><Trash2 className="size-3" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

        </>
      )}

      {/* Feed */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" className="inline-flex gap-1 rounded-lg bg-muted p-1">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} title={t.hint}
              onClick={() => { setTab(t.key); setPage(1) }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.label}
              {summary && <span className="ml-1.5 text-xs text-muted-foreground">{t.key === 'now' ? summary.immediate ?? 0 : summary.watchlist ?? 0}</span>}
            </button>
          ))}
        </div>
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search schools…" className="h-9 w-full text-sm sm:w-64" />
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">{TABS.find((t) => t.key === tab)!.hint}</p>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}</div>
      ) : error ? (
        <ErrorState title="Could not load signals" description={error} retry={loadFeed} />
      ) : items.length === 0 ? (
        <EmptyState title="No signals here yet" description={embedded ? 'No ScholarClone opportunities are stored yet. Press Generate Signals above when you want research to run. Only schools with a real, sourced reason to buy appear.' : 'Press “Find signals now”, check one school, or add a file or link. Only schools with a real, sourced reason to buy appear.'} />
      ) : (
        <div className="space-y-4">
          {items.map((o) => <SignalCard key={o.id} o={o} onAct={act} />)}
          {data && data.meta.last_page > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-muted-foreground">Page {page} of {data.meta.last_page}</span>
              <Button size="sm" variant="outline" disabled={page >= data.meta.last_page} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const INTENT: Record<BuyingIntentLevel, { label: string; className: string }> = {
  explicit: { label: 'Buying: confirmed process', className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  strong: { label: 'Buying: strong signs', className: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  moderate: { label: 'Buying: a project is documented', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  weak: { label: 'Buying: indirect sign only', className: 'bg-muted text-muted-foreground border-border' },
  unconfirmed: { label: 'Buying: not confirmed', className: 'bg-muted text-muted-foreground border-border' },
}

const INDICATOR_WORDS: Record<string, string> = {
  open_tender: 'An open tender', vendor_selection: 'Asking for vendor recommendations', demo_or_proposal_request: 'Asking for demos or proposals',
  procurement_notice: 'A procurement notice', implementation_project: 'A stated implementation project', system_role_hiring: 'Hiring for a school-system role',
  partner_search: 'Looking for a technology partner', stated_problem: 'The school states a problem with its system', expansion: 'A new campus or branch',
  leadership_change: 'New leadership', academic_hiring: 'Hiring academic or career staff',
}

const SOURCE_WORDS: Record<string, string> = {
  official: 'Official or the school’s own site', job_post: 'A job post', social_post: 'A social post', third_party: 'A news or third-party page',
}

const PROVENANCE_WORDS: Record<string, string> = {
  structured_data: 'from the page’s data', meta_tag: 'from the page’s metadata', time_element: 'from the page',
  visible_absolute: 'from the page text', visible_relative: 'worked out from “posted N days ago”', search_provider: 'from the search provider',
}

const fmtDay = (iso?: string | null) => {
  if (!iso) return null
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** What the card says about when the source was published. An unknown date says so; it never shows today's date. */
function dateLabel(e?: SignalAssessment['evidence']): string {
  const day = fmtDay(e?.source_published_at)
  if (!day) return 'No publication date on the source'
  return `Published ${day}${e?.date_provenance ? ` (${PROVENANCE_WORDS[e.date_provenance] ?? e.date_provenance})` : ''}`
}

function IdentityLine({ id }: { id?: SignalAssessment['identity'] }) {
  if (!id) return null
  if (id.status === 'target_exact') {
    return <p className="text-xs text-emerald-700 dark:text-emerald-400">Target school{id.crm_ref ? ` · CRM lead ${id.crm_ref}` : ''}: name and place match.</p>
  }
  if (id.status === 'target_possible') {
    return <p className="text-xs text-amber-700 dark:text-amber-400">Possibly {id.account_name ?? 'a target school'}{id.crm_ref ? ` (${id.crm_ref})` : ''}: please confirm. {id.reasons[0]}</p>
  }
  return (
    <p className="text-xs text-muted-foreground">
      {id.for_scan_target === false ? `Not the school you searched for (${id.scan_target}): a different organisation.` : 'Not on your target list.'}
    </p>
  )
}

function EvidencePanel({ summary }: { summary: EvidenceSummary }) {
  const columns = [
    { key: 'verified', title: 'Verified in the source', dot: 'bg-emerald-500', lines: summary.verified, empty: 'Nothing could be confirmed directly.' },
    { key: 'inferred', title: 'Our reading', dot: 'bg-amber-500', lines: summary.inferred, empty: 'No inference was needed.' },
    { key: 'missing', title: 'Not established', dot: 'bg-slate-400', lines: summary.missing, empty: 'No gaps recorded.' },
  ] as const

  return (
    <details className="group rounded-xl bg-muted/40 text-xs">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 font-medium text-foreground">
        <span>Evidence at a glance <span className="font-normal text-muted-foreground">· {summary.verified.length} verified · {summary.inferred.length} our reading · {summary.missing.length} not established</span></span>
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 px-3 pb-3 sm:grid-cols-3">
        {columns.map((col) => (
          <div key={col.key} className="space-y-1">
            <p className="flex items-center gap-1.5 font-medium text-foreground"><span className={`size-2 rounded-full ${col.dot}`} aria-hidden="true" />{col.title}</p>
            {col.lines.length === 0
              ? <p className="text-muted-foreground">{col.empty}</p>
              : <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{col.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
          </div>
        ))}
      </div>
    </details>
  )
}

function LeadQualificationPanel({ q }: { q?: Opportunity['crm_qualification'] }) {
  if (!q) return null

  const isComplete = q.enrichment_status === 'Complete'
  const isPartial = q.enrichment_status === 'Partially Complete'

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
        <span className="font-semibold text-foreground flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${q.outreach_ready ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          Lead Qualification &amp; Required Information
        </span>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${
            isComplete ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
            isPartial ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
            'bg-amber-500/10 text-amber-600 border-amber-500/30'
          }`}>
            Enrichment: {q.enrichment_status}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
            {q.can_promote ? 'Ready for CRM Promotion' : 'Incomplete'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            ✓ Verified in research (Ready to promote):
          </p>
          <ul className="mt-1 list-disc pl-4 space-y-0.5 text-muted-foreground">
            {q.verified_fields.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            ⚠ Missing before outreach (Needs CRM Enrichment):
          </p>
          <ul className="mt-1 list-disc pl-4 space-y-0.5 text-muted-foreground">
            {q.missing_for_outreach.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground italic pt-1">
        * Company name and research signal are sufficient to promote to CRM Intake. Surnames, phone numbers, and emails are never guessed or hardcoded; missing fields will be enriched safely via CRM automation.
      </p>
    </div>
  )
}

export function SignalCard({ o, onAct, runDateLabel }: { o: Opportunity; onAct: (o: Opportunity, a: 'follow-up' | 'dismiss' | 'review') => void; runDateLabel?: string | null }) {
  const c = o.card
  const a = o.assessment
  const strength = STRENGTH[o.strength ?? 'watch']
  const intent = o.buying_intent ? INTENT[o.buying_intent] : null
  const src = c?.source ?? (o.source_url ? { text: 'Source', url: o.source_url } : null)
  const pull = a?.sales_pull ?? []
  const evidence = summariseEvidence(o)

  // Sales & Marketing merge, Phase 4: self-contained (its own context, its own loading/result
  // state) rather than threaded through onAct - SignalCard is used from two different parents
  // (SignalList and this file's own list), and promoting isn't a review-status action like the
  // other three buttons here, it creates a real crm_leads row via LeadFactory.
  const [promoting, setPromoting] = useState(false)
  const [promotedLeadId, setPromotedLeadId] = useState<string | null>(o.promoted_lead_id ?? null)
  const [promoteError, setPromoteError] = useState<string | null>(null)
  const handlePromote = async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return
    setPromoting(true)
    setPromoteError(null)
    try {
      const res = await opportunitiesService.promoteToCrm(context, o.id)
      setPromotedLeadId(res.data.lead_id)
    } catch (e) {
      setPromoteError(e instanceof ApiError || e instanceof Error ? e.message : 'Failed to promote this signal to a CRM lead')
    } finally {
      setPromoting(false)
    }
  }

  return (
    <article className="premium-card space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`gap-1 ${strength.className}`}>
          {o.strength === 'hot' && <Flame className="size-3" />}
          {strength.label}
        </Badge>
        {intent && <Badge variant="outline" className={intent.className} title={a?.buying_intent?.meaning}>{intent.label}</Badge>}
        <h2 className="text-base font-semibold">{c?.organisation_line ?? o.company_name}</h2>
        {o.review_status !== 'New' && <Badge variant="secondary">{o.review_status === 'Follow-up' ? 'Contacted' : o.review_status}</Badge>}
      </div>

      {/* 1. What happened */}
      <div>
        <p className="text-sm font-medium">{c?.needs_line ?? c?.headline ?? o.title}</p>
        {c?.context && <p className="mt-0.5 text-sm text-muted-foreground">{c.context}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* 3. Why it matters  /  4+6. Why they might need ScholarClone, and which part fits */}
        <div className="space-y-2 rounded-xl bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Why it matters</p>
          <p className="text-sm">{c?.so_what ?? o.likely_problem}</p>
          {a?.product_fit && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Fits:</span> {a.product_fit.what_it_does}. {a.product_fit.reason}
            </p>
          )}
          {pull.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {pull.map((p) => (
                <Badge key={p.category} variant="secondary" className="font-normal" title={`${p.rationale} (${p.basis === 'observed' ? 'shown in the source' : 'our reading, not stated'})`}>
                  {p.label}{p.basis === 'inferred' ? ' · our reading' : ''}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* 7. What to do */}
        <div className="rounded-xl bg-primary/5 p-3">
          <p className="text-xs font-medium text-muted-foreground">What to do</p>
          <p className="mt-1 text-sm">{c?.what_to_do ?? o.soft_marketing_angle}</p>
          {o.likely_stakeholder && <p className="mt-1 text-xs text-muted-foreground">Approach: {o.likely_stakeholder}</p>}
        </div>
      </div>

      {/* 5. Is there evidence of buying intent? */}
      {a?.buying_intent && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Buying evidence:</span>{' '}
          {a.buying_intent.indicators.length > 0
            ? a.buying_intent.indicators.map((i) => INDICATOR_WORDS[i.indicator] ?? i.indicator).join('; ') + '.'
            : 'None found in the source. This is a possible need, not a purchase process.'}
        </p>
      )}
      {o.strength_reason && <p className="text-xs text-muted-foreground">Why {strength.label.toLowerCase()}: {o.strength_reason}</p>}

      {/* Lead Qualification & Enrichment Panel */}
      <LeadQualificationPanel q={o.crm_qualification} />

      {/* 8. What is verified, what is our reading, and what is not established */}
      <EvidencePanel summary={evidence} />

      <IdentityLine id={a?.identity} />

      {c?.account && (
        <p className="text-xs text-muted-foreground">
          On the target list{c.account.crm_ref ? ` · CRM lead ${c.account.crm_ref}` : ''}{c.account.crm_owner ? ` · owner ${c.account.crm_owner}` : ''}
        </p>
      )}

      {/* 2. Where did it come from? */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="text-xs text-muted-foreground">
          {src?.url ? (
            <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
              {src.text} <ExternalLink className="size-3" />
            </a>
          ) : src?.text}
          {a?.source_reliability && <span className="ml-2">· {SOURCE_WORDS[a.source_reliability.class] ?? 'Source'} ({a.source_reliability.reliability} reliability)</span>}
          {a?.evidence ? <span className="ml-2">· {dateLabel(a.evidence)} · {a.evidence.read_as === 'page_text' ? 'page read' : 'snippet only'}</span>
            : <span className="ml-2">· {o.source_published_at ? `Published ${fmtDay(o.source_published_at)}` : 'No publication date on the source'}</span>}
          {runDateLabel && <span className="ml-2">· Found in the {runDateLabel} run</span>}
          {typeof o.days_left === 'number' && <span className="ml-2">· {o.days_left < 0 ? 'Past its closing date' : o.days_left === 0 ? 'Closes today' : `${o.days_left} day${o.days_left === 1 ? '' : 's'} left`}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={o.review_status === 'Reviewed'} onClick={() => onAct(o, 'review')}>Mark reviewed</Button>
          <Button size="sm" variant="outline" disabled={o.review_status === 'Follow-up'} onClick={() => onAct(o, 'follow-up')}>Contacted</Button>
          <Button size="sm" variant="ghost" onClick={() => onAct(o, 'dismiss')}>Not relevant</Button>
          {promotedLeadId ? (
            <NextLink
              href={`/module/crm/marketing/leads/${promotedLeadId}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
            >
              <CheckCircle2 className="size-3.5" />
              Promoted &middot; View Lead{o.promoted_lead_no ? ` (${o.promoted_lead_no})` : ''}
            </NextLink>
          ) : (
            <Button size="sm" variant="outline" disabled={promoting} onClick={() => void handlePromote()} className="gap-1.5">
              {promoting ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
              Promote to CRM Lead
            </Button>
          )}
        </div>
        {promoteError && <p role="alert" className="w-full text-xs text-destructive">{promoteError}</p>}
      </div>
    </article>
  )
}
