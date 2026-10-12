'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { agentService, type GtmAgentInfo, type GtmAgentOutput } from '@/services/gtm/gtm'
import { EstimateTag, MeasuredTag, errMsg } from './gtm-shared'

const SLUG = 'gtm-customer-success'
type Row = Record<string, unknown>
const arr = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : [])
const strs = (v: unknown): string[] => (Array.isArray(v) ? (v as unknown[]).map(String) : [])

const MODE_LABEL: Record<string, string> = { renewal_risk: 'Renewal risk review', expansion: 'Expansion opportunities' }

function Src({ urls }: { urls?: unknown }) {
  return <>{strs(urls).slice(0, 3).map((u) => {
    let host = u
    try { host = new URL(u).hostname } catch { /* keep raw */ }
    return <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="mr-3 inline-flex items-center gap-1 text-xs text-primary">{host}<ExternalLink className="size-3" /></a>
  })}</>
}

/**
 * Runs the Customer Success agent in the modes the backend defines. Advice only: the agent writes no
 * business record. Measured facts (computed by rules) and the model's assessment (AI estimate) are
 * shown separately and tagged.
 */
export function CustomerAgentPanel() {
  const [agent, setAgent] = useState<GtmAgentInfo | null>(null)
  const [aiConfigured, setAiConfigured] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [out, setOut] = useState<GtmAgentOutput | null>(null)

  useEffect(() => {
    let alive = true
    void agentService.list()
      .then((r) => { if (alive) { setAgent(r.data.agents.find((a) => a.slug === SLUG) ?? null); setAiConfigured(r.data.ai_configured) } })
      .catch((e) => { if (alive) setLoadError(errMsg(e, 'Unable to load the agent')) })
    return () => { alive = false }
  }, [])

  const modes = agent?.inputs.mode?.options ?? []

  const run = async (mode: string) => {
    setBusy(mode)
    setError(null)
    setOut(null)
    try {
      setOut((await agentService.run(SLUG, { mode })).data)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-medium">Customer Success agent</h3>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{agent?.description ?? 'Reviews customer accounts from measured health and recorded renewals, or expansion opportunities backed by a real signal.'} It gives advice only and changes no record.</p>
      {loadError && <p className="mt-2 text-sm text-destructive">{loadError}</p>}
      {agent && !agent.runnable && <p className="mt-2 rounded-md bg-muted/40 p-2 text-sm text-muted-foreground">{agent.unavailable_reason ?? 'This agent is not available yet.'}</p>}
      {!aiConfigured && <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">No AI provider is configured for GTM, so the agent cannot run.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {modes.map((m) => (
          <Button key={m} size="sm" variant="outline" disabled={busy !== null || !agent?.runnable || !aiConfigured} onClick={() => run(m)}>
            {busy === m ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Play className="mr-1 size-3.5" />}{MODE_LABEL[m] ?? m}
          </Button>
        ))}
        {agent && modes.length === 0 && <p className="text-sm text-muted-foreground">The agent reports no modes to run.</p>}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {out && <AgentOutput out={out} />}
    </div>
  )
}

function Block({ title, tag, children }: { title: string; tag: React.ReactNode; children: React.ReactNode }) {
  return <div className="mt-3"><h4 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}{tag}</h4>{children}</div>
}

function AgentOutput({ out }: { out: GtmAgentOutput }) {
  const r = out.result
  const facts = arr(r.facts)
  const nameOf = (id: unknown) => String(facts.find((f) => f.account_id === id)?.name ?? `Account #${String(id)}`)
  const mode = String(r.mode ?? '')
  return (
    <div className="mt-4 rounded-md border border-border bg-muted/20 p-4 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{MODE_LABEL[mode] ?? (mode || 'result')}</Badge>
        <span>{out.provider} · {out.model} · playbook {out.playbook.slug} v{out.playbook.version} ({out.playbook.source})</span>
      </div>
      {out.integrity.note && <p className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-900">{out.integrity.note}</p>}

      {facts.length > 0 && (
        <Block title="Measured by rules from your records" tag={<MeasuredTag />}>
          <div className="space-y-2">
            {facts.map((f) => (
              <div key={String(f.account_id)} className="rounded border border-border bg-background p-2">
                <p className="font-medium">{String(f.name)} <span className="font-normal text-muted-foreground">· {String(f.band)}{f.score == null ? ' · no score' : ` · ${String(f.score)}/100`}</span></p>
                {f.renewal ? <p className="text-xs text-muted-foreground">Renewal {String((f.renewal as Row).date)} ({String((f.renewal as Row).status)}), {String((f.renewal as Row).days_until)} day(s)</p> : <p className="text-xs text-muted-foreground">No open renewal recorded.</p>}
                {strs(f.risks).length > 0 && <ul className="mt-1 list-disc pl-5 text-xs">{strs(f.risks).map((x) => <li key={x}>{x}</li>)}</ul>}
                {strs(f.missing).length > 0 && <p className="mt-1 text-xs text-muted-foreground">Missing: {strs(f.missing).join(' ')}</p>}
              </div>
            ))}
          </div>
        </Block>
      )}

      {arr(r.accounts).length > 0 && (
        <Block title="Assessment" tag={<EstimateTag />}>
          <ul className="space-y-2">
            {arr(r.accounts).map((a) => (
              <li key={String(a.account_id)}>
                <span className="font-medium">{nameOf(a.account_id)}</span>{a.risk ? <span> — {String(a.risk)}</span> : null}
                {a.evidence ? <p className="text-muted-foreground">{String(a.evidence)}</p> : null}
                {a.action ? <p>→ {String(a.action)}</p> : null}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {arr(r.opportunities).length > 0 && (
        <Block title="Expansion opportunities, each tied to a recorded signal" tag={<EstimateTag />}>
          <ul className="space-y-2">
            {arr(r.opportunities).map((o, i) => (
              <li key={i}>
                <span className="font-medium">{String(o.opportunity ?? '')}</span> <span className="text-muted-foreground">— account #{String(o.account_id)}</span>
                {o.evidence ? <p className="text-muted-foreground">{String(o.evidence)}</p> : null}
                {o.signal_title ? <p className="text-xs">Signal: {String(o.signal_title)} <Src urls={o.source_urls} /></p> : null}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {mode === 'expansion' && arr(r.opportunities).length === 0 && <p className="text-muted-foreground">No opportunity had a recorded signal to rest on.</p>}
      {strs(r.missing).length > 0 && <Block title="Missing information" tag={null}><ul className="list-disc pl-5 text-muted-foreground">{strs(r.missing).map((m) => <li key={m}>{m}</li>)}</ul></Block>}
    </div>
  )
}
