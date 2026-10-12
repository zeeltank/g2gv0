'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, RefreshCw, ShieldCheck, Wrench, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { monitoringService, type CheckStatus, type MonitoringCheck, type MonitoringReport, type Probe } from '@/services/gtm/monitoring'
import { ApiError } from '@/services/core'
import { GtmPageHeader, StatTile, errMsg, fmtDate, useGtmReady } from './gtm-shared'

/** The endpoint is throttled to 30/min; this stays far under that and never runs in a hidden tab. */
const AUTO_REFRESH_MS = 90_000

const STATUS: Record<CheckStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ok: { label: 'OK', cls: 'border-green-500 text-green-700', Icon: CheckCircle2 },
  warn: { label: 'Warning', cls: 'border-amber-400 text-amber-700', Icon: AlertTriangle },
  fail: { label: 'Failing', cls: 'border-destructive text-destructive', Icon: XCircle },
  unknown: { label: 'Unknown', cls: 'border-border text-muted-foreground', Icon: CircleHelp },
}
const ORDER: CheckStatus[] = ['fail', 'warn', 'unknown', 'ok']

const pretty = (s: string) => s.replace(/_/g, ' ')

function StatusBadge({ status }: { status: CheckStatus }) {
  const s = STATUS[status] ?? STATUS.unknown
  return (
    <Badge variant="outline" className={`gap-1 ${s.cls}`}>
      <s.Icon className="size-3" />{s.label}
    </Badge>
  )
}

function fmtTime(value: string | null | undefined): string {
  return value ? fmtDate(value, true) : '—'
}

/** A fact value, rendered readably. Nested maps become nested lists; nothing is stringified as raw JSON. */
function Fact({ value }: { value: unknown }): ReactNode {
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">—</span>
  if (typeof value === 'boolean') return <span>{value ? 'yes' : 'no'}</span>
  if (typeof value === 'number') return <span>{value.toLocaleString()}</span>
  if (typeof value === 'string') return <span className="break-words">{value}</span>
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">none</span>
    if (value.every((v) => typeof v !== 'object' || v === null)) return <span className="break-words">{value.map(String).join(', ')}</span>
    return <ul className="list-disc pl-4">{value.map((v, i) => <li key={i}><Fact value={v} /></li>)}</ul>
  }
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return <span className="text-muted-foreground">none</span>
  return <FactList facts={value as Record<string, unknown>} nested />
}

function FactList({ facts, nested = false }: { facts: Record<string, unknown>; nested?: boolean }) {
  const entries = Object.entries(facts)
  if (entries.length === 0) return null
  return (
    <dl className={`grid grid-cols-[minmax(0,12rem)_1fr] gap-x-4 gap-y-1 text-xs ${nested ? 'rounded border border-border/60 p-2' : ''}`}>
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{pretty(k)}</dt>
          <dd><Fact value={v} /></dd>
        </div>
      ))}
    </dl>
  )
}

/** The provider's own quota is not a GTM defect - the backend says so, and so does this badge. */
function isQuota(c: MonitoringCheck): boolean {
  return c.facts.quota_exhausted === true || c.facts.failures_were_provider_limits === true
}

function CheckCard({ check, probedAt }: { check: MonitoringCheck; probedAt?: string }) {
  const notOk = check.status !== 'ok'
  return (
    <div className={`rounded-lg border p-4 ${check.status === 'fail' ? 'border-destructive/60' : check.status === 'warn' ? 'border-amber-300' : 'border-border'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{check.label}</h3>
        <StatusBadge status={check.status} />
        {isQuota(check) && <Badge variant="outline" className="border-amber-400 text-amber-700">AI provider quota, not a GTM defect</Badge>}
        {probedAt && <Badge variant="outline">Live check {fmtTime(probedAt)}</Badge>}
      </div>
      <p className="mt-1 text-sm text-foreground">{check.summary}</p>

      {notOk && check.fix && (
        <div className="mt-3 flex gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <Wrench className="mt-0.5 size-4 shrink-0 text-primary" />
          <div><div className="font-medium">How to fix</div><p className="text-muted-foreground">{check.fix}</p></div>
        </div>
      )}

      {Object.keys(check.facts ?? {}).length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Details</summary>
          <div className="mt-2"><FactList facts={check.facts} /></div>
        </details>
      )}
    </div>
  )
}

export function MonitoringView() {
  const ready = useGtmReady()
  const [report, setReport] = useState<MonitoringReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [probing, setProbing] = useState<Probe | null>(null)
  const [probeError, setProbeError] = useState<string | null>(null)
  /** Live-check results survive background refreshes until the person runs a check again. */
  const [probed, setProbed] = useState<Record<string, { check: MonitoringCheck; at: string }>>({})
  const lastLoad = useRef(0)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await monitoringService.get()
      setReport(res.data)
      setError(null)
      lastLoad.current = Date.now()
    } catch (e) {
      setError(errMsg(e, 'Unable to load monitoring'))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { if (ready) queueMicrotask(() => void load()) }, [ready, load])

  // Slow background refresh, only while the tab is visible; coming back to a stale tab refreshes once.
  useEffect(() => {
    if (!ready) return
    const tick = () => { if (document.visibilityState === 'visible' && Date.now() - lastLoad.current >= AUTO_REFRESH_MS) void load() }
    const timer = setInterval(tick, AUTO_REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [ready, load])

  const runProbe = async (probe: Probe) => {
    setProbing(probe)
    setProbeError(null)
    try {
      const res = await monitoringService.get(probe)
      const key = probe === 'ai' ? 'ai' : 'mail'
      const check = res.data.checks.find((c) => c.key === key)
      setReport(res.data)
      lastLoad.current = Date.now()
      if (check) setProbed((p) => ({ ...p, [key]: { check, at: res.data.generated_at } }))
    } catch (e) {
      setProbeError(e instanceof ApiError && e.status === 403 ? 'Only Administrators can run a live check.' : errMsg(e, 'The live check could not run'))
    } finally {
      setProbing(null)
    }
  }

  const canProbe = report?.recent_events != null // the server sends the audit events to administrators only
  const checks = report
    ? [...report.checks.map((c) => probed[c.key]?.check ?? c)].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))
    : []
  const overall = report ? STATUS[report.overall] ?? STATUS.unknown : null

  return (
    <div className="p-6">
      <GtmPageHeader
        readOnlyActions
        title="Monitoring"
        description="Whether GTM is working, from the records the module itself writes. A check with no data says Unknown, never OK."
        actions={
          <Button size="sm" variant="outline" onClick={load} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RefreshCw className="mr-1 size-3.5" />}Refresh
          </Button>
        }
      />

      {error && !report ? <ErrorState title="Could not load monitoring" description={error} retry={load} /> : !report ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : (
        <div className="space-y-6">
          {error && <p role="alert" className="text-sm text-destructive">Last refresh failed: {error}. Showing the previous result.</p>}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile label="Overall" value={overall ? <StatusBadge status={report.overall} /> : null} hint={`Last checked ${fmtTime(report.generated_at)}`} />
            {ORDER.map((s) => <StatTile key={s} label={STATUS[s].label} value={report.counts[s] ?? 0} tone={s !== 'ok' && (report.counts[s] ?? 0) > 0 && s !== 'unknown' ? 'warn' : undefined} />)}
          </div>
          <p className="text-xs text-muted-foreground">Refreshes itself about every 90 seconds while this tab is visible. Times are shown as returned by the server.</p>

          <section className="rounded-lg border border-border p-4">
            <h2 className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4" />Live checks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These contact an outside service, so they only run when you press a button. The AI check makes one tiny real call to the provider (it uses a few tokens). The mail check logs in to the mail server and sends nothing.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!canProbe || probing !== null} onClick={() => runProbe('ai')}>
                {probing === 'ai' && <Loader2 className="mr-1 size-3.5 animate-spin" />}Test AI provider
              </Button>
              <Button size="sm" variant="outline" disabled={!canProbe || probing !== null} onClick={() => runProbe('smtp')}>
                {probing === 'smtp' && <Loader2 className="mr-1 size-3.5 animate-spin" />}Test mail connection
              </Button>
            </div>
            {!canProbe && <p className="mt-2 text-xs text-muted-foreground">Live checks are limited to Administrators.</p>}
            {probeError && <p role="alert" className="mt-2 text-sm text-destructive">{probeError}</p>}
          </section>

          <section className="space-y-3">
            <h2 className="font-medium">Checks</h2>
            {checks.length === 0 ? <EmptyState title="No checks returned" description="The server returned no checks." /> : checks.map((c) => (
              <CheckCard key={c.key + c.label} check={c} probedAt={probed[c.key]?.at} />
            ))}
          </section>

          <section>
            <h2 className="mb-2 font-medium">Dependencies</h2>
            {report.dependencies.length === 0 ? <EmptyState title="No dependencies listed" description="Nothing to report." /> : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Needed</th><th className="p-3">Ready</th><th className="p-3">Where to set it</th></tr></thead>
                  <tbody>
                    {report.dependencies.map((d) => (
                      <tr key={d.name} className="border-t border-border">
                        <td className="p-3">{d.name}</td>
                        <td className="p-3"><StatusBadge status={d.ready ? 'ok' : 'warn'} /></td>
                        <td className="p-3 text-muted-foreground">{d.where}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-medium">Recent failures</h2>
            {report.recent_failures.length === 0 ? <EmptyState title="No recent failures" description="No failed agent runs, workflow runs, emails or inbound events were found." /> : (
              <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                {report.recent_failures.map((f, i) => (
                  <li key={i} className="p-3">
                    <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{f.source}</Badge><span className="font-medium">{f.what}</span><span className="text-xs text-muted-foreground">{fmtTime(f.at)}</span></div>
                    <p className="mt-1 break-words text-muted-foreground">{f.message || 'No message recorded.'}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {report.recent_events !== null && (
            <section>
              <h2 className="mb-2 font-medium">Recent events <span className="text-xs font-normal text-muted-foreground">(Administrators only)</span></h2>
              {report.recent_events.length === 0 ? <EmptyState title="No events yet" description="No GTM events have been recorded." /> : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">When</th><th className="p-3">Event</th><th className="p-3">Record</th><th className="p-3">By</th></tr></thead>
                    <tbody>
                      {report.recent_events.map((e) => (
                        <tr key={e.id} className="border-t border-border">
                          <td className="whitespace-nowrap p-3">{fmtTime(e.at)}</td>
                          <td className="p-3">{e.type}</td>
                          <td className="p-3">{e.record ?? '—'}</td>
                          <td className="p-3">{e.actor_id ? `user ${e.actor_id}` : 'system'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
