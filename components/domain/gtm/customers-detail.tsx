'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { customerService, type CustomerDetail, type CustomerHealthResult } from '@/services/gtm/customers'
import { dealService, gtmService, type GtmContact, type GtmDeal } from '@/services/gtm/gtm'
import { EstimateTag, MeasuredTag, errMsg, fmtDate } from './gtm-shared'
import { fmtAmount } from './customers-renewals'

export const BAND_STYLE: Record<string, string> = {
  healthy: 'bg-green-100 text-green-900', watch: 'bg-amber-100 text-amber-900', at_risk: 'bg-red-100 text-red-900', unknown: 'bg-muted text-muted-foreground',
}

export function BandBadge({ health }: { health: CustomerHealthResult }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${BAND_STYLE[health.band] ?? BAND_STYLE.unknown}`}>{health.band.replace('_', ' ')}{health.score === null ? ' · no score' : ` · ${health.score}/100`}</span>
}

/** The score's working: every component with its weight, reason, and what is missing. Never a bare number. */
export function HealthBreakdown({ health }: { health: CustomerHealthResult }) {
  const entries = Object.entries(health.components)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2"><BandBadge health={health} /><MeasuredTag /><span className="text-xs text-muted-foreground">Weighted mean of the components that have data (needs at least two). A component without data is left out, not scored zero.</span></div>
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground"><tr><th className="py-1">Component</th><th>Weight</th><th>Score</th><th>Reason</th></tr></thead>
        <tbody>
          {entries.map(([k, c]) => (
            <tr key={k} className="border-t border-border align-top">
              <td className="py-1 font-medium capitalize">{k.replace('_', ' ')}</td>
              <td>{c.weight}</td>
              <td>{c.score === null ? <span className="text-muted-foreground">not available</span> : c.score}</td>
              <td className="text-muted-foreground">{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {health.risks.length > 0 && <div><h4 className="text-xs font-semibold uppercase text-muted-foreground">Risks</h4><ul className="list-disc pl-5 text-sm">{health.risks.map((r) => <li key={r}>{r}</li>)}</ul></div>}
      {health.missing.length > 0 && <div><h4 className="text-xs font-semibold uppercase text-muted-foreground">Missing data</h4><ul className="list-disc pl-5 text-sm text-muted-foreground">{health.missing.map((r) => <li key={r}>{r}</li>)}</ul></div>}
    </div>
  )
}

function Section({ title, tag, children }: { title: string; tag?: ReactNode; children: ReactNode }) {
  return <section className="mt-5"><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">{title}{tag}</h3>{children}</section>
}

type Row = Record<string, unknown>

export function CustomerDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {id !== null && <CustomerBody key={id} id={id} />}
      </DialogContent>
    </Dialog>
  )
}

function CustomerBody({ id }: { id: number }) {
  const [d, setD] = useState<CustomerDetail | null>(null)
  const [contacts, setContacts] = useState<GtmContact[] | null>(null)
  const [deals, setDeals] = useState<GtmDeal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [extraError, setExtraError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    void customerService.get(id)
      .then((r) => { if (alive) { setD(r.data); setError(null) } })
      .catch((e) => { if (alive) setError(errMsg(e, 'Unable to load the customer')) })
    // The customer endpoint carries no contacts or deals, so they come from the account and deal endpoints.
    void Promise.all([gtmService.getAccount(id), dealService.list({ status: '' })])
      .then(([a, dl]) => { if (alive) { setContacts(a.data.contacts); setDeals(dl.data.items.filter((x) => x.account_id === id)) } })
      .catch((e) => { if (alive) setExtraError(errMsg(e, 'Unable to load contacts and deals')) })
    return () => { alive = false }
  }, [id, tick])

  if (error) return <ErrorState title="Could not load customer" description={error} retry={() => { setError(null); setTick((t) => t + 1) }} />
  if (!d) return <Skeleton className="h-64" />

  const f = d.facts
  const review = d.last_review?.result as Row | null | undefined
  return (
    <div>
      <DialogHeader><DialogTitle>{d.name}</DialogTitle><DialogDescription>Customer health, contacts, deals, renewals and expansion signals for this account.</DialogDescription></DialogHeader>

      <Section title="Health" tag={<MeasuredTag />}><HealthBreakdown health={d.health} /></Section>

      <Section title="Facts behind the score" tag={<MeasuredTag />}>
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <div>Days since activity<div className="font-medium">{f.days_since_activity ?? '—'}</div></div>
          <div>Inbound (90d)<div className="font-medium">{f.inbound_90d}</div></div>
          <div>Outbound (90d)<div className="font-medium">{f.outbound_90d}</div></div>
          <div>Contacts<div className="font-medium">{f.active_contacts} active of {f.contacts}</div></div>
        </div>
      </Section>

      <Section title="Health history" tag={<MeasuredTag />}>
        {d.history.length === 0 ? <p className="text-sm text-muted-foreground">No daily snapshots stored yet, so no trend is shown.</p> : (
          <div className="flex flex-wrap gap-1.5 text-xs">{d.history.map((h) => <span key={h.date} className={`rounded px-1.5 py-0.5 ${BAND_STYLE[h.band] ?? BAND_STYLE.unknown}`} title={h.band}>{fmtDate(h.date)}: {h.score ?? '—'}</span>)}</div>
        )}
      </Section>

      <Section title="Contacts">
        {extraError ? <p className="text-sm text-destructive">{extraError}</p> : !contacts ? <Skeleton className="h-10" /> : contacts.length === 0 ? <p className="text-sm text-muted-foreground">No contacts recorded.</p> : (
          <ul className="space-y-1 text-sm">{contacts.map((c) => <li key={c.id}>{c.full_name}{c.title ? ` · ${c.title}` : ''} <Badge variant="outline">{c.role_in_deal?.replace('_', ' ') ?? 'no role'}</Badge> <span className="text-xs text-muted-foreground">{c.status.replace('_', ' ')}{c.email ? ` · ${c.email}` : ''}</span></li>)}</ul>
        )}
      </Section>

      <Section title="Deals">
        {extraError ? <p className="text-sm text-destructive">{extraError}</p> : !deals ? <Skeleton className="h-10" /> : deals.length === 0 ? <p className="text-sm text-muted-foreground">No deals recorded for this account.</p> : (
          <ul className="space-y-1 text-sm">{deals.map((x) => <li key={x.id}>{x.name} <Badge variant="outline">{x.stage}</Badge> <span className="text-xs text-muted-foreground">{fmtAmount(x.amount, x.currency)}</span></li>)}</ul>
        )}
      </Section>

      <Section title="Renewals" tag={<MeasuredTag />}>
        {d.renewals.length === 0 ? <p className="text-sm text-muted-foreground">No renewal is recorded for this customer.</p> : (
          <ul className="space-y-1 text-sm">{d.renewals.map((r) => <li key={r.id}>{r.name} · {fmtDate(r.renewal_date)} · {fmtAmount(r.amount, r.currency)} <Badge variant="outline">{r.status.replace('_', ' ')}</Badge></li>)}</ul>
        )}
      </Section>

      <Section title="Expansion signals" tag={<MeasuredTag />}>
        {d.expansion_signals.length === 0 ? <p className="text-sm text-muted-foreground">No research signal is recorded for this customer, so there is no basis to suggest an expansion.</p> : (
          <ul className="space-y-2 text-sm">{d.expansion_signals.map((s) => (
            <li key={s.id}><span className="font-medium">{s.title}</span> <Badge variant="outline">{s.priority}</Badge>{s.signal_kind && <span className="text-xs text-muted-foreground"> · {s.signal_kind}</span>}
              <div>{s.sources.slice(0, 3).map((u) => <a key={u.url} href={u.url} target="_blank" rel="noopener noreferrer" className="mr-3 inline-flex items-center gap-1 text-xs text-primary">{u.title ?? new URL(u.url, 'http://x').hostname}<ExternalLink className="size-3" /></a>)}</div>
            </li>
          ))}</ul>
        )}
      </Section>

      <Section title="Recent activity" tag={<MeasuredTag />}>
        {d.activities.length === 0 ? <p className="text-sm text-muted-foreground">No activity logged.</p> : (
          <ul className="space-y-1 text-sm">{d.activities.map((a) => <li key={a.id}><span className="text-xs text-muted-foreground">{fmtDate(a.occurred_at)} · {a.type}{a.direction ? ` · ${a.direction}` : ''}</span> {a.subject}</li>)}</ul>
        )}
      </Section>

      {d.last_review && review && (
        <Section title="Last agent review" tag={<EstimateTag />}>
          <p className="text-xs text-muted-foreground">{d.last_review.provider} · {d.last_review.model} · {fmtDate(d.last_review.created_at, true)}. It covers all customers; this account&apos;s entry is shown.</p>
          {(Array.isArray(review.accounts) ? (review.accounts as Row[]) : []).filter((a) => Number(a.account_id) === id).map((a) => (
            <div key={String(a.account_id)} className="mt-1 text-sm"><span className="font-medium">{String(a.risk ?? '')}</span><p className="text-muted-foreground">{String(a.evidence ?? '')}</p><p>→ {String(a.action ?? '')}</p></div>
          ))}
        </Section>
      )}
    </div>
  )
}
