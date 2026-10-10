'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ExternalLink, Loader2, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import {
  agentService, dealService, gtmService, outreachService,
  type GtmAccount, type GtmDeal, type GtmAgentInfo, type GtmAgentOutput, type GtmAgentRunRow, type GtmContact,
} from '@/services/gtm/gtm'
import { EstimateTag, GtmPageHeader, errMsg, fmtDate, useGtmReady } from './gtm-shared'

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

/**
 * GTM agents. An agent reads your records, applies a playbook through the configured AI
 * provider, and returns analysis or DRAFTS. None of them writes a business record or sends
 * anything. Agents that need data G2G does not hold yet say so instead of running.
 */
export function AgentsView() {
  const ready = useGtmReady()
  const [agents, setAgents] = useState<GtmAgentInfo[] | null>(null)
  const [aiConfigured, setAiConfigured] = useState(true)
  const [runs, setRuns] = useState<GtmAgentRunRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([agentService.list(), agentService.runs()])
      setAgents(a.data.agents)
      setAiConfigured(a.data.ai_configured)
      setRuns(r.data.runs)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load agents'))
    }
  }, [])

  useEffect(() => { if (ready) queueMicrotask(() => void load()) }, [ready, load])

  return (
    <div className="p-6">
      <GtmPageHeader title="Agents" description="Five GTM agents that analyse your own records and draft work for you to review. They read data and return results; they never change records or send messages." />
      {!aiConfigured && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">No AI provider is configured for GTM. Set one under AI &amp; Intelligence → AI Providers before running an agent.</div>
      )}
      {error ? <ErrorState title="Could not load agents" description={error} retry={load} /> : !agents ? <Skeleton className="h-40" /> : (
        <div className="space-y-4">
          {agents.map((a) => <AgentCard key={a.slug} agent={a} aiConfigured={aiConfigured} onRan={load} />)}
        </div>
      )}

      <h2 className="mb-2 mt-8 text-sm font-semibold">Recent runs</h2>
      {runs.length === 0 ? <p className="text-sm text-muted-foreground">No runs yet.</p> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Agent</th><th className="p-3">Result</th><th className="p-3">Tokens</th><th className="p-3">Time</th><th className="p-3">When</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">{r.name}</td>
                  <td className="p-3">{r.status === 'success' ? <Badge variant="outline">success</Badge> : <span className="text-destructive" title={r.error_message ?? ''}>{r.error_message ? r.error_message.slice(0, 90) : 'error'}</span>}</td>
                  <td className="p-3">{r.tokens_used ?? '—'}</td>
                  <td className="p-3">{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                  <td className="p-3">{fmtDate(r.started_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AgentCard({ agent, aiConfigured, onRan }: { agent: GtmAgentInfo; aiConfigured: boolean; onRan: () => void }) {
  const [accounts, setAccounts] = useState<GtmAccount[]>([])
  const [contacts, setContacts] = useState<GtmContact[]>([])
  const [deals, setDeals] = useState<GtmDeal[]>([])
  const [input, setInput] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [out, setOut] = useState<GtmAgentOutput | null>(null)
  const needsAccount = 'account_id' in agent.inputs
  const needsContact = 'contact_id' in agent.inputs
  const needsDeal = 'deal_id' in agent.inputs
  const modeOptions = agent.inputs.mode?.options

  useEffect(() => {
    if (!needsAccount || !agent.runnable) return
    void gtmService.listAccounts({}).then((r) => setAccounts(r.data.items)).catch(() => setAccounts([]))
  }, [needsAccount, agent.runnable])

  useEffect(() => {
    if (!needsDeal || !agent.runnable) return
    void dealService.list({ status: 'open' }).then((r) => setDeals(r.data.items)).catch(() => setDeals([]))
  }, [needsDeal, agent.runnable])

  useEffect(() => {
    if (!needsContact || !input.account_id) { queueMicrotask(() => setContacts([])); return }
    void gtmService.getAccount(Number(input.account_id)).then((r) => setContacts(r.data.contacts)).catch(() => setContacts([]))
  }, [needsContact, input.account_id])

  const mode = input.mode ?? modeOptions?.[0]
  const missing = Object.entries(agent.inputs).some(([k, v]) => v.required && !(k === 'mode' ? mode : input[k]) && !(k === 'account_id' && mode === 'signals'))

  const run = async () => {
    setBusy(true)
    setError(null)
    setOut(null)
    try {
      const payload: Record<string, unknown> = { ...input }
      if (mode) payload.mode = mode
      if (payload.account_id) payload.account_id = Number(payload.account_id)
      if (payload.contact_id) payload.contact_id = Number(payload.contact_id)
      if (payload.deal_id) payload.deal_id = Number(payload.deal_id)
      setOut((await agentService.run(agent.slug, payload)).data)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
      onRan()
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2"><h3 className="font-medium">{agent.name}</h3>{!agent.runnable && <Badge variant="outline">not available yet</Badge>}</div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{agent.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">Reads: {agent.reads.join(', ')}</p>
        </div>
      </div>

      {!agent.runnable ? (
        <p className="mt-3 rounded-md bg-muted/40 p-2 text-sm text-muted-foreground">{agent.unavailable_reason}</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {modeOptions && (
            <select className={SELECT} value={mode} onChange={(e) => setInput({ ...input, mode: e.target.value })}>
              {modeOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          {needsAccount && mode !== 'signals' && (
            <select className={SELECT} value={input.account_id ?? ''} onChange={(e) => setInput({ ...input, account_id: e.target.value, contact_id: '' })}>
              <option value="">Account…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {needsDeal && (
            <select className={SELECT} value={input.deal_id ?? ''} onChange={(e) => setInput({ ...input, deal_id: e.target.value })}>
              <option value="">{deals.length === 0 ? 'No open deals' : 'Open deal…'}</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.account_name}</option>)}
            </select>
          )}
          {needsContact && (
            <select className={SELECT} value={input.contact_id ?? ''} onChange={(e) => setInput({ ...input, contact_id: e.target.value })} disabled={!input.account_id}>
              <option value="">{input.account_id && contacts.length === 0 ? 'No contacts — add one first' : 'Contact…'}</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          )}
          <Button size="sm" disabled={busy || missing || !aiConfigured} onClick={run}>
            {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Play className="mr-1 size-3.5" />}Run
          </Button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {out && <AgentResult slug={agent.slug} out={out} />}
    </div>
  )
}

type Row = Record<string, unknown>
const arr = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : [])
const strs = (v: unknown): string[] => (Array.isArray(v) ? (v as unknown[]).map(String) : [])

function Src({ urls }: { urls?: unknown }) {
  return <>{strs(urls).slice(0, 3).map((u) => {
    let host = u
    try { host = new URL(u).hostname } catch { /* keep raw */ }
    return <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="mr-3 inline-flex items-center gap-1 text-xs text-primary">{host}<ExternalLink className="size-3" /></a>
  })}</>
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <div className="mt-3"><h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>{children}</div>
}

function AgentResult({ slug, out }: { slug: string; out: GtmAgentOutput }) {
  const r = out.result
  return (
    <div className="mt-4 rounded-md border border-border bg-muted/20 p-4 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <EstimateTag />{slug === 'gtm-outreach' && <Badge>DRAFT — not sent</Badge>}
        <span>{out.provider} · {out.model} · playbook {out.playbook.slug} v{out.playbook.version} ({out.playbook.source})</span>
      </div>
      {out.integrity.note && <p className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-900">{out.integrity.note}</p>}

      {slug === 'gtm-prospecting' && (
        <>
          {typeof r.summary === 'string' && <p>{r.summary}</p>}
          {typeof r.trigger === 'string' && <Block title="Buying trigger"><p>{r.trigger}</p></Block>}
          {(arr(r.ranked_signals).length > 0 || arr(r.ordered).length > 0) && (
            <Block title="Signals, in priority order">
              <ol className="list-decimal space-y-2 pl-5">
                {[...arr(r.ranked_signals), ...arr(r.ordered)].map((s) => (
                  <li key={String(s.signal_id)}><span className="font-medium">{String(s.title ?? `Signal #${s.signal_id}`)}</span>{s.company ? <span className="text-muted-foreground"> — {String(s.company)}</span> : null}<p className="text-muted-foreground">{String(s.why ?? s.reason ?? '')}</p><Src urls={s.source_urls} /></li>
                ))}
              </ol>
            </Block>
          )}
          {strs(r.target_roles).length > 0 && <Block title="Approach first"><p>{strs(r.target_roles).join(', ')}</p></Block>}
          {typeof r.next_step === 'string' && <Block title="Next step"><p>{r.next_step}</p></Block>}
        </>
      )}

      {slug === 'gtm-outreach' && (
        <>
          {typeof r.subject === 'string' && (
            <div className="rounded-md border border-border bg-background p-3">
              <p className="font-medium">Subject: {r.subject}</p>
              <p className="mt-2 whitespace-pre-wrap">{String(r.body ?? '')}</p>
            </div>
          )}
          {arr(r.steps).map((s) => (
            <div key={String(s.step)} className="mb-2 rounded-md border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Step {String(s.step)}{s.angle ? ` · ${String(s.angle)}` : ''}</p>
              <p className="font-medium">{String(s.subject ?? '')}</p>
              <p className="mt-1 whitespace-pre-wrap">{String(s.body ?? '')}</p>
            </div>
          ))}
          {arr(r.claims).length > 0 && (
            <Block title="Claims in this draft and where each comes from">
              <ul className="space-y-1">{arr(r.claims).map((c, i) => <li key={i}>{String(c.claim)} <Src urls={[c.source_url]} /></li>)}</ul>
            </Block>
          )}
          <SaveDraft analysisId={out.analysis_id} />
        </>
      )}

      {slug === 'gtm-customer-success' && (
        <>
          <Block title="Measured (counted from your records)">
            <table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th>Account</th><th>Contacts</th><th>Activities (90d)</th><th>Days since last</th></tr></thead>
              <tbody>{arr(r.facts).map((f) => <tr key={String(f.account_id)}><td>{String(f.name)}</td><td>{String(f.contacts)}</td><td>{String(f.activities_90d)}</td><td>{f.days_since_last_activity == null ? '—' : String(f.days_since_last_activity)}</td></tr>)}</tbody></table>
          </Block>
          <Block title="Assessment (AI estimate)">
            <ul className="space-y-2">{arr(r.accounts).map((a) => <li key={String(a.account_id)}><span className="font-medium">{String(a.risk)}</span><p className="text-muted-foreground">{String(a.evidence)}</p><p>→ {String(a.action)}</p></li>)}</ul>
          </Block>
          <p className="mt-2 text-xs text-muted-foreground">Renewal dates, contract values and product usage are not tracked in G2G yet, so none are estimated.</p>
        </>
      )}

      {slug === 'gtm-deal-coach' && (
        <>
          {typeof r.health === 'string' && <p className="font-medium">{r.health}</p>}
          {strs(r.measured_flags).length > 0 && <Block title="Measured flags (rules, not AI)"><ul className="list-disc pl-5">{strs(r.measured_flags).map((f) => <li key={f}>{String((r.measured_labels as Record<string, string> | undefined)?.[f] ?? f)}</li>)}</ul></Block>}
          {arr(r.risks).length > 0 && <Block title="Risks"><ul className="list-disc pl-5">{arr(r.risks).map((x, i) => <li key={i}>{String(x.risk)} <span className="text-muted-foreground">— {String(x.evidence)}</span></li>)}</ul></Block>}
          {arr(r.next_actions).length > 0 && <Block title="Next actions"><ol className="list-decimal pl-5">{arr(r.next_actions).map((x, i) => <li key={i}>{String(x.action)} <span className="text-muted-foreground">— {String(x.why)}</span></li>)}</ol></Block>}
        </>
      )}

      {slug === 'gtm-revops' && (
        <>
          <p className="text-muted-foreground">{String((r.measured as Row | undefined)?.flagged_deals ?? 0)} of {String((r.measured as Row | undefined)?.open_deals ?? 0)} open deals have health flags (counted by rules).</p>
          <Block title="Recommendations (AI estimate)"><ul className="space-y-2">{arr(r.deals).map((x) => <li key={String(x.deal_id)}><span className="font-medium">{String(arr((r.measured as Row | undefined)?.flagged).find((f) => f.deal_id === x.deal_id)?.name ?? `Deal #${x.deal_id}`)}</span> — {String(x.risk)}<p className="text-muted-foreground">→ {String(x.recommendation)}</p></li>)}</ul></Block>
        </>
      )}

      {strs(r.missing).length > 0 && <Block title="Missing information"><ul className="list-disc pl-5 text-muted-foreground">{strs(r.missing).map((m) => <li key={m}>{m}</li>)}</ul></Block>}
    </div>
  )
}

/** An agent draft is only text until a person saves it; saving creates drafts, never sends. */
function SaveDraft({ analysisId }: { analysisId: number }) {
  const [state, setState] = useState<{ busy: boolean; done: number | null; error: string | null }>({ busy: false, done: null, error: null })
  const save = async () => {
    setState({ busy: true, done: null, error: null })
    try {
      const r = await outreachService.fromAnalysis(analysisId)
      setState({ busy: false, done: r.data.messages.length, error: null })
    } catch (e) {
      setState({ busy: false, done: null, error: errMsg(e) })
    }
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button size="sm" disabled={state.busy || state.done !== null} onClick={save}>{state.busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}Save as draft{state.done !== null ? 'd' : ''}</Button>
      {state.done !== null && <span className="text-xs text-green-700">Saved {state.done} draft(s). Review and submit them for approval under Outreach.</span>}
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      <span className="text-xs text-muted-foreground">Nothing is sent: a person must approve each message first.</span>
    </div>
  )
}
