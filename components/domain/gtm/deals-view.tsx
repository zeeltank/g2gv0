'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, LayoutGrid, List, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DEAL_STAGES, OPEN_DEAL_STAGES, agentService, dealService, gtmService, playbookService,
  type DealDetail, type DealStage, type GtmAccount, type GtmDeal, type GtmPlaybook, type PipelineSummary,
} from '@/services/gtm/gtm'
import { EstimateTag, GtmPageHeader, MeasuredTag, errMsg, fmtDate, useGtmReady } from './gtm-shared'

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm'
const TEXTAREA = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'

/** One line per currency. Amounts in different currencies are never added together. */
export function money(byCurrency: Record<string, number> | undefined): string {
  const parts = Object.entries(byCurrency ?? {}).map(([c, v]) => `${c} ${v.toLocaleString('en-IN')}`)
  return parts.length ? parts.join(' · ') : '—'
}

const FLAG_TONE = 'bg-amber-100 text-amber-900'

/**
 * Deals. Pipeline numbers are counted from deal records and shown per currency; health flags
 * come from fixed rules over recorded dates and activity. Methodology scores, discovery analysis
 * and coaching are AI estimates and are labelled as such. Closing or reopening a deal asks for
 * confirmation; nothing an AI returns changes a deal.
 */
export function DealsView() {
  const ready = useGtmReady()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [showClosed, setShowClosed] = useState(false)
  const [deals, setDeals] = useState<GtmDeal[] | null>(null)
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([dealService.list({ status: showClosed ? '' : 'open' }), dealService.pipeline()])
      setDeals(d.data.items)
      setPipeline(p.data)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load deals'))
    }
  }, [showClosed])

  useEffect(() => { if (ready) queueMicrotask(() => void load()) }, [ready, load])

  const stages = showClosed ? DEAL_STAGES : OPEN_DEAL_STAGES

  return (
    <div className="p-6">
      <GtmPageHeader
        title="Deals"
        description="Your pipeline. Counts and values are totals of your deal records, shown per currency. Health flags come from fixed rules, not from AI."
        actions={<Button onClick={() => setCreating(true)}><Plus className="mr-1 size-4" />New deal</Button>}
      />

      {pipeline && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4 text-sm">
          <div><div className="text-xs text-muted-foreground">Open deals</div><div className="text-xl font-semibold">{pipeline.open_total}</div></div>
          <div><div className="text-xs text-muted-foreground">Open value</div><div className="text-xl font-semibold">{money(pipeline.open_value_by_currency)}</div></div>
          <div><div className="text-xs text-muted-foreground">Won, last {pipeline.closed_last_days} days</div><div className="font-medium">{pipeline.won.count} · {money(pipeline.won.value_by_currency)}</div></div>
          <div><div className="text-xs text-muted-foreground">Lost, last {pipeline.closed_last_days} days</div><div className="font-medium">{pipeline.lost.count} · {money(pipeline.lost.value_by_currency)}</div></div>
          <MeasuredTag />
          <p className="basis-full text-xs text-muted-foreground">No forecast is shown: it needs stage probabilities your organisation sets, and none are recorded.</p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={view === 'board' ? 'default' : 'outline'} onClick={() => setView('board')}><LayoutGrid className="mr-1 size-3.5" />Board</Button>
        <Button size="sm" variant={view === 'list' ? 'default' : 'outline'} onClick={() => setView('list')}><List className="mr-1 size-3.5" />List</Button>
        <label className="ml-2 flex items-center gap-1 text-sm text-muted-foreground"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />Include won / lost</label>
      </div>

      {error ? <ErrorState title="Could not load deals" description={error} retry={load} /> : !deals ? <Skeleton className="h-48" /> : deals.length === 0 ? (
        <EmptyState title="No deals yet" description="Create a deal against one of your accounts to start tracking the pipeline." />
      ) : view === 'board' ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(200px, 1fr))` }}>
          {stages.map((s) => {
            const col = deals.filter((d) => d.stage === s)
            const sum = pipeline?.stages.find((x) => x.stage === s)
            return (
              <div key={s} className="rounded-lg border border-border bg-muted/20 p-2">
                <div className="mb-2 flex items-baseline justify-between px-1"><span className="text-sm font-semibold capitalize">{s}</span><span className="text-xs text-muted-foreground">{col.length}{sum ? ` · ${money(sum.value_by_currency)}` : ''}</span></div>
                <div className="space-y-2">
                  {col.map((d) => <DealCard key={d.id} deal={d} onOpen={() => setOpenId(d.id)} />)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Deal</th><th className="p-3">Account</th><th className="p-3">Stage</th><th className="p-3">Value</th><th className="p-3">Close date</th><th className="p-3">Next step</th><th className="p-3">Flags</th></tr></thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={() => setOpenId(d.id)}>
                  <td className="p-3 font-medium">{d.name}</td><td className="p-3">{d.account_name}</td><td className="p-3"><Badge variant="outline">{d.stage}</Badge></td>
                  <td className="p-3">{d.amount ? `${d.currency} ${Number(d.amount).toLocaleString('en-IN')}` : '—'}</td><td className="p-3">{fmtDate(d.expected_close_date)}</td>
                  <td className="p-3">{d.next_step || <span className="text-muted-foreground">none</span>}</td>
                  <td className="p-3">{d.health && d.health.flags.length > 0 ? <span className={`rounded px-1.5 py-0.5 text-xs ${FLAG_TONE}`}>{d.health.flags.length}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewDealDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); void load(); setOpenId(id) }} />
      <DealDialog key={openId ?? 'none'} id={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  )
}

function DealCard({ deal, onOpen }: { deal: GtmDeal; onOpen: () => void }) {
  const flags = deal.health?.flags.length ?? 0
  return (
    <button onClick={onOpen} className="w-full rounded-md border border-border bg-card p-3 text-left hover:bg-muted/30">
      <div className="text-sm font-medium">{deal.name}</div>
      <div className="text-xs text-muted-foreground">{deal.account_name}</div>
      <div className="mt-1 text-xs">{deal.amount ? `${deal.currency} ${Number(deal.amount).toLocaleString('en-IN')}` : 'No amount'}{deal.expected_close_date ? ` · closes ${fmtDate(deal.expected_close_date)}` : ''}</div>
      {flags > 0 && <div className={`mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${FLAG_TONE}`}><AlertTriangle className="size-3" />{flags} flag{flags > 1 ? 's' : ''}</div>}
    </button>
  )
}

function NewDealDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [accounts, setAccounts] = useState<GtmAccount[]>([])
  const [f, setF] = useState({ account_id: '', name: '', amount: '', currency: '', expected_close_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    void gtmService.listAccounts({}).then((r) => setAccounts(r.data.items)).catch(() => setAccounts([]))
  }, [open])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await dealService.create({
        account_id: Number(f.account_id), name: f.name.trim(),
        amount: f.amount ? Number(f.amount) : null, currency: f.amount ? f.currency.trim().toUpperCase() : null,
        expected_close_date: f.expected_close_date || null,
      })
      setF({ account_id: '', name: '', amount: '', currency: '', expected_close_date: '' })
      onCreated(res.data.deal.id)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New deal</DialogTitle><DialogDescription>A sales opportunity with one of your accounts. It starts in discovery.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <select className={`${SELECT} w-full`} value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}>
            <option value="">Account *</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <Input placeholder="Deal name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <div className="flex gap-2">
            <Input type="number" min="0" placeholder="Amount (optional)" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
            <Input className="w-28" maxLength={3} placeholder="Currency" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} />
          </div>
          <div><label className="text-xs text-muted-foreground">Expected close date</label><Input type="date" value={f.expected_close_date} onChange={(e) => setF({ ...f, expected_close_date: e.target.value })} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={saving || !f.account_id || !f.name.trim() || (!!f.amount && f.currency.length !== 3)} onClick={save}>{saving ? 'Saving…' : 'Create'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type Row = Record<string, unknown>
const arr = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : [])
const strs = (v: unknown): string[] => (Array.isArray(v) ? (v as unknown[]).map(String) : [])

function DealDialog({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<DealDetail | null>(null)
  const [methodologies, setMethodologies] = useState<GtmPlaybook[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [edit, setEdit] = useState({ next_step: '', next_step_due: '', expected_close_date: '' })
  const [methodology, setMethodology] = useState('')
  const [notes, setNotes] = useState('')
  const [note, setNote] = useState({ type: 'note', subject: '' })
  const [coach, setCoach] = useState<Row | null>(null)
  const [discovery, setDiscovery] = useState<{ result: Row; integrity: { note: string | null } } | null>(null)

  const load = useCallback(async () => {
    if (id === null) return
    try {
      const res = (await dealService.get(id)).data
      setD(res)
      setEdit({ next_step: res.deal.next_step ?? '', next_step_due: res.deal.next_step_due ?? '', expected_close_date: res.deal.expected_close_date ?? '' })
      setMethodology((m) => m || res.deal.methodology_slug || '')
      setCoach((c) => c ?? (res.analyses.deal_coach?.result as Row | undefined) ?? null)
      setDiscovery((x) => x ?? (res.analyses.discovery_analysis ? { result: res.analyses.discovery_analysis.result as Row, integrity: { note: null } } : null))
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load the deal'))
    }
  }, [id])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])
  useEffect(() => {
    if (id === null) return
    void playbookService.list({ kind: 'methodology' }).then((r) => setMethodologies(r.data.items)).catch(() => setMethodologies([]))
  }, [id])

  const run = async (key: string, fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      after?.()
      await load()
      onChanged()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  const deal = d?.deal
  const open = deal ? (OPEN_DEAL_STAGES as readonly string[]).includes(deal.stage) : false

  const changeStage = (to: DealStage) => {
    if (!deal) return
    const closing = to === 'won' || to === 'lost'
    let reason: string | undefined
    if (to === 'lost') {
      const r = window.prompt('Why was this deal lost? (required)')
      if (!r || !r.trim()) return
      reason = r.trim()
    }
    if ((closing || !open) && !window.confirm(closing ? `Close this deal as ${to}? It becomes read-only until reopened.` : 'Reopen this deal?')) return
    void run('stage', () => dealService.setStage(deal.id, { stage: to, confirm: closing || !open ? true : undefined, close_reason: reason }))
  }

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{deal?.name ?? 'Deal'}</DialogTitle>
          <DialogDescription>{d?.account ? `${d.account.name} · ` : ''}{deal ? `${deal.amount ? `${deal.currency} ${Number(deal.amount).toLocaleString('en-IN')}` : 'no amount'} · ${deal.stage}` : 'Loading…'}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!d || !deal ? (error ? null : <Skeleton className="h-48" />) : (
          <div className="space-y-6">
            <section>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Stage</span>
                <select className={SELECT} value={deal.stage} disabled={busy !== null} onChange={(e) => changeStage(e.target.value as DealStage)}>
                  {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {deal.close_reason && <span className="text-xs text-muted-foreground">Reason: {deal.close_reason}</span>}
                <Button size="sm" variant="outline" className="ml-auto text-destructive" disabled={busy !== null}
                  onClick={() => { if (window.confirm(`Remove the deal "${deal.name}"?`)) void run('del', () => dealService.remove(deal.id), onClose) }}><Trash2 className="mr-1 size-3.5" />Remove</Button>
              </div>
            </section>

            {open && (
              <section>
                <div className="mb-2 flex items-center gap-2"><h3 className="text-sm font-semibold">Health</h3><MeasuredTag /></div>
                {d.health && d.health.flags.length > 0 ? (
                  <ul className="space-y-1">{d.health.flags.map((f) => <li key={f} className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${FLAG_TONE}`}><AlertTriangle className="size-3.5" />{d.flag_labels[f] ?? f}</li>)}</ul>
                ) : <p className="text-sm text-muted-foreground">No health flags.</p>}
                {d.health && <p className="mt-1 text-xs text-muted-foreground">Last activity: {d.health.days_since_activity === null ? 'never' : `${d.health.days_since_activity} day(s) ago`} · {d.health.days_in_stage ?? '—'} day(s) in this stage</p>}
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <Input placeholder="Next step" className="md:col-span-2" value={edit.next_step} onChange={(e) => setEdit({ ...edit, next_step: e.target.value })} />
                  <Input type="date" title="Next step due" value={edit.next_step_due} onChange={(e) => setEdit({ ...edit, next_step_due: e.target.value })} />
                  <Input type="date" title="Expected close" value={edit.expected_close_date} onChange={(e) => setEdit({ ...edit, expected_close_date: e.target.value })} />
                </div>
                <Button size="sm" className="mt-2" disabled={busy !== null}
                  onClick={() => run('save', () => dealService.update(deal.id, { next_step: edit.next_step || null, next_step_due: edit.next_step_due || null, expected_close_date: edit.expected_close_date || null }))}>Save</Button>
              </section>
            )}

            <section>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">Methodology score</h3><EstimateTag />
                <select className={`${SELECT} ml-auto`} value={methodology} onChange={(e) => setMethodology(e.target.value)}>
                  <option value="">Default methodology</option>
                  {methodologies.map((m) => <option key={m.slug} value={m.slug}>{m.title}</option>)}
                </select>
                <Button size="sm" variant="outline" disabled={busy !== null || !open} onClick={() => run('score', () => dealService.score(deal.id, methodology || undefined))}>
                  {busy === 'score' ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Sparkles className="mr-1 size-3.5" />}Score
                </Button>
              </div>
              {d.analyses.methodology_score ? (() => {
                const s = d.analyses.methodology_score.result
                return (
                  <div className="rounded-md border border-border p-3 text-sm">
                    <div className="mb-2 flex items-baseline gap-2"><span className="text-2xl font-semibold">{s.total ?? '—'}</span><span className="text-xs text-muted-foreground">/ 100 · {s.methodology.title} v{s.methodology.version} · {s.coverage.scored} of {s.coverage.of} dimensions assessed · {d.analyses.methodology_score.model} · {fmtDate(d.analyses.methodology_score.created_at, true)}</span></div>
                    {s.total === null && <p className="mb-2 text-xs text-amber-700">Fewer than half the dimensions could be assessed from recorded evidence, so no total is given.</p>}
                    <ul className="space-y-1">{s.dimensions.map((x) => <li key={x.key} className="flex gap-2"><span className="w-36 shrink-0 font-medium">{x.label}</span><span className="w-10 shrink-0">{x.score ?? 'n/a'}</span><span className="text-muted-foreground">{x.evidence}{x.next_action ? ` → ${x.next_action}` : ''}</span></li>)}</ul>
                  </div>
                )
              })() : <p className="text-sm text-muted-foreground">Not scored. Scoring uses only this deal&apos;s recorded contacts and activity; missing evidence scores as not assessed.</p>}
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2"><h3 className="text-sm font-semibold">Discovery call analysis</h3><EstimateTag /></div>
              <textarea className={TEXTAREA} rows={4} placeholder="Paste your discovery call notes or transcript (at least 40 characters)…" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button size="sm" className="mt-2" disabled={busy !== null || notes.trim().length < 40}
                onClick={() => run('disc', async () => { const r = await dealService.discovery(deal.id, notes); setDiscovery({ result: r.data.result, integrity: r.data.integrity }) })}>
                {busy === 'disc' ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Sparkles className="mr-1 size-3.5" />}Analyse notes
              </Button>
              {discovery && (
                <div className="mt-3 rounded-md border border-border p-3 text-sm">
                  {discovery.integrity.note && <p className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-900">{discovery.integrity.note}</p>}
                  {arr(discovery.result.problems).length > 0 && <><h4 className="text-xs font-semibold uppercase text-muted-foreground">Problems (quoted from your notes)</h4><ul className="mb-2 list-disc pl-5">{arr(discovery.result.problems).map((p, i) => <li key={i}>{String(p.text)} <span className="text-muted-foreground">&ldquo;{String(p.quote)}&rdquo;</span></li>)}</ul></>}
                  {arr(discovery.result.stakeholders).length > 0 && <><h4 className="text-xs font-semibold uppercase text-muted-foreground">Stakeholders</h4><p className="mb-2">{arr(discovery.result.stakeholders).map((s) => `${s.name} (${s.role})`).join(', ')}</p></>}
                  {strs(discovery.result.gaps).length > 0 && <><h4 className="text-xs font-semibold uppercase text-muted-foreground">Not yet established</h4><p className="mb-2">{strs(discovery.result.gaps).join(', ')}</p></>}
                  {strs(discovery.result.next_questions).length > 0 && <><h4 className="text-xs font-semibold uppercase text-muted-foreground">Ask next</h4><ul className="list-disc pl-5">{strs(discovery.result.next_questions).map((q) => <li key={q}>{q}</li>)}</ul></>}
                </div>
              )}
            </section>

            {open && (
              <section>
                <div className="mb-2 flex items-center gap-2"><h3 className="text-sm font-semibold">Deal Coach</h3><EstimateTag /></div>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run('coach', async () => { const r = await agentService.run('gtm-deal-coach', { deal_id: deal.id }); setCoach(r.data.result) })}>
                  {busy === 'coach' ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Sparkles className="mr-1 size-3.5" />}Ask the coach
                </Button>
                {coach && (
                  <div className="mt-3 rounded-md border border-border p-3 text-sm">
                    {typeof coach.health === 'string' && <p className="mb-2 font-medium">{coach.health}</p>}
                    {arr(coach.risks).length > 0 && <><h4 className="text-xs font-semibold uppercase text-muted-foreground">Risks</h4><ul className="mb-2 list-disc pl-5">{arr(coach.risks).map((r, i) => <li key={i}>{String(r.risk)} <span className="text-muted-foreground">— {String(r.evidence)}</span></li>)}</ul></>}
                    {arr(coach.next_actions).length > 0 && <><h4 className="text-xs font-semibold uppercase text-muted-foreground">Next actions</h4><ol className="list-decimal pl-5">{arr(coach.next_actions).map((a, i) => <li key={i}>{String(a.action)} <span className="text-muted-foreground">— {String(a.why)}</span></li>)}</ol></>}
                    <p className="mt-2 text-xs text-muted-foreground">Advice only. Nothing here changes the deal.</p>
                  </div>
                )}
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Activity</h3>
              <div className="mb-3 flex gap-2">
                <select className={SELECT} value={note.type} onChange={(e) => setNote({ ...note, type: e.target.value })}>{['note', 'call', 'meeting', 'email', 'linkedin', 'task'].map((t) => <option key={t} value={t}>{t}</option>)}</select>
                <Input placeholder="What happened?" value={note.subject} onChange={(e) => setNote({ ...note, subject: e.target.value })} />
                <Button disabled={busy !== null || !note.subject.trim()} onClick={() => run('act', () => dealService.logActivity(deal.id, { type: note.type, subject: note.subject.trim() }), () => setNote({ ...note, subject: '' }))}>Log</Button>
              </div>
              <ul className="space-y-1 text-sm">{d.activities.map((a) => <li key={a.id} className="flex gap-3 border-b border-border py-1.5"><span className="w-28 shrink-0 text-xs text-muted-foreground">{fmtDate(a.occurred_at, true)}</span><Badge variant="outline">{a.type}</Badge><span>{a.subject}</span></li>)}</ul>
              {d.activities.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Stage history</h3>
              <ul className="space-y-1 text-sm">{d.history.map((h, i) => <li key={i} className="flex gap-3"><span className="w-28 shrink-0 text-xs text-muted-foreground">{fmtDate(h.changed_at, true)}</span><span>{h.from_stage ? `${h.from_stage} → ` : ''}{h.to_stage}{h.note ? ` — ${h.note}` : ''}</span></li>)}</ul>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
