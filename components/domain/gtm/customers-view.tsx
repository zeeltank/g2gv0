'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { customerService, type CustomerAlerts, type CustomerList } from '@/services/gtm/customers'
import { GtmPageHeader, MeasuredTag, StatTile, errMsg, fmtDate, useGtmReady } from './gtm-shared'
import { BandBadge, CustomerDialog } from './customers-detail'
import { RenewalsTab, fmtAmount } from './customers-renewals'
import { CustomerAgentPanel } from './customers-agent'

type Tab = 'customers' | 'renewals' | 'alerts' | 'agent'
const TABS: { key: Tab; label: string }[] = [
  { key: 'customers', label: 'Customers' }, { key: 'renewals', label: 'Renewals' }, { key: 'alerts', label: 'Alerts' }, { key: 'agent', label: 'Customer Success agent' },
]

/**
 * Customers. Health is computed by fixed rules from logged activity, replies, contacts and recorded
 * renewals; every score shows its components and what data is missing. Renewals are only what people
 * record. The agent's opinions are tagged as AI estimates and kept apart from the measured figures.
 */
export function CustomersView() {
  const ready = useGtmReady()
  const [tab, setTab] = useState<Tab>('customers')
  const [list, setList] = useState<CustomerList | null>(null)
  const [alerts, setAlerts] = useState<CustomerAlerts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [version, setVersion] = useState(0)

  const load = useCallback(async () => {
    try {
      const [l, a] = await Promise.all([customerService.list(), customerService.alerts()])
      setList(l.data)
      setAlerts(a.data)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load customers'))
    }
  }, [])

  useEffect(() => { if (ready) queueMicrotask(() => void load()) }, [ready, load])

  const alertCount = alerts ? alerts.renewals.length + alerts.at_risk.length : 0

  return (
    <div className="p-6">
      <GtmPageHeader title="Customers" description="Customer health, renewals and expansion. Health is computed from your own records and always shows its working; where data is missing it says so instead of guessing." />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'outline'} onClick={() => setTab(t.key)}>
            {t.label}{t.key === 'alerts' && alertCount > 0 ? ` (${alertCount})` : ''}
          </Button>
        ))}
      </div>

      {tab === 'agent' ? <CustomerAgentPanel /> : tab === 'renewals' ? (
        <RenewalsTab customers={list?.items ?? []} version={version} onChanged={() => { setVersion((v) => v + 1); void load() }} />
      ) : error ? <ErrorState title="Could not load customers" description={error} retry={load} /> : !list || !alerts ? <Skeleton className="h-48" /> : tab === 'alerts' ? (
        <AlertsPanel alerts={alerts} onOpen={setOpenId} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatTile label="Customers" value={list.summary.customers} tag={<MeasuredTag />} />
            <StatTile label="Healthy" value={list.summary.healthy} />
            <StatTile label="Watch" value={list.summary.watch} />
            <StatTile label="At risk" value={list.summary.at_risk} tone={list.summary.at_risk > 0 ? 'warn' : undefined} />
            <StatTile label="Unknown" value={list.summary.unknown} hint="Not enough data to score" />
          </div>
          <p className="mb-3 text-xs text-muted-foreground">{list.method} Weights: {Object.entries(list.weights).map(([k, v]) => `${k.replace('_', ' ')} ${v}`).join(' · ')}.</p>
          {list.items.length === 0 ? (
            <EmptyState title="No customer accounts" description='A customer is an account whose stage is "customer" - set by a confirmed won deal or by an administrator. None exist yet.' />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Customer</th><th className="p-3">Health</th><th className="p-3">Trend</th><th className="p-3">Why</th><th className="p-3">Next renewal</th></tr></thead>
                <tbody>
                  {list.items.map((c) => (
                    <tr key={c.account_id} className="cursor-pointer border-t border-border align-top hover:bg-muted/30" onClick={() => setOpenId(c.account_id)}>
                      <td className="p-3 font-medium">{c.name}{c.industry && <p className="text-xs font-normal text-muted-foreground">{c.industry}</p>}</td>
                      <td className="p-3"><BandBadge health={c.health} /></td>
                      <td className="p-3 text-xs">{c.trend && c.trend.change !== null ? (
                        <span className="inline-flex items-center gap-1">{c.trend.change >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}{c.trend.change > 0 ? '+' : ''}{c.trend.change}</span>
                      ) : <span className="text-muted-foreground">no history</span>}</td>
                      <td className="max-w-md p-3 text-xs text-muted-foreground">
                        {c.health.risks.length > 0 ? c.health.risks.join(' ') : c.health.missing.length > 0 ? `Missing: ${c.health.missing.join(' ')}` : 'No risks flagged by the rules.'}
                      </td>
                      <td className="p-3 text-xs">{c.renewal ? <>{fmtDate(c.renewal.date)}<p className="text-muted-foreground">{c.renewal.status.replace('_', ' ')} · {fmtAmount(c.renewal.amount, c.renewal.currency)}</p></> : <span className="text-muted-foreground">none recorded</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <CustomerDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}

function AlertsPanel({ alerts, onOpen }: { alerts: CustomerAlerts; onOpen: (id: number) => void }) {
  if (alerts.renewals.length === 0 && alerts.at_risk.length === 0) {
    return <EmptyState title="Nothing needs attention" description="No overdue renewals, no renewals due soon without work started, and no at-risk customers right now." />
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">Renewals needing action <MeasuredTag /></h2>
        {alerts.renewals.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul className="space-y-2">
            {alerts.renewals.map((r) => (
              <li key={r.renewal_id}>
                <button onClick={() => onOpen(r.account_id)} className="flex w-full items-start gap-2 rounded-md border border-border bg-card p-3 text-left text-sm hover:bg-muted/30">
                  <AlertTriangle className={`mt-0.5 size-4 ${r.kind === 'overdue' ? 'text-red-600' : 'text-amber-600'}`} />
                  <span><span className="font-medium">{r.account_name}</span> — {r.name}<br />
                    <span className="text-xs text-muted-foreground">{r.kind === 'overdue' ? `Overdue by ${Math.abs(r.days)} day(s)` : `Due in ${r.days} day(s), not started`} · {fmtDate(r.renewal_date)} · {fmtAmount(r.amount, r.currency)}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">At-risk customers <MeasuredTag /></h2>
        {alerts.at_risk.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul className="space-y-2">
            {alerts.at_risk.map((c) => (
              <li key={c.account_id}>
                <button onClick={() => onOpen(c.account_id)} className="w-full rounded-md border border-border bg-card p-3 text-left text-sm hover:bg-muted/30">
                  <span className="font-medium">{c.name}</span> <span className="text-xs text-muted-foreground">score {c.score ?? '—'}/100</span>
                  {c.risks.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">{c.risks.map((x) => <li key={x}>{x}</li>)}</ul>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
