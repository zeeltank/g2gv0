'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/services/core'
import {
  FORECAST_CATEGORIES, FORECAST_OPEN_STAGES, forecastService,
  type ForecastCategory, type ForecastData, type ForecastRow, type ForecastSettingsData,
} from '@/services/gtm/forecast'
import { GtmPageHeader, MeasuredTag, StatTile, errMsg, useGtmReady } from './gtm-shared'

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

/** Amounts arrive in major units, already grouped per currency. */
function amt(currency: string, v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${currency} ${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function byCurrency(m: Record<string, number> | undefined): string {
  const parts = Object.entries(m ?? {}).map(([c, v]) => amt(c, v))
  return parts.length ? parts.join(' · ') : '—'
}

const label = (s: string) => s.replace('_', ' ')

/**
 * Forecast. A calculation over open deals and the stage probabilities an administrator sets - not a
 * prediction. It is kept apart from actuals (deals that really closed). Totals are per currency and
 * never combined. Accuracy appears only when the server has snapshots to compare.
 */
export function ForecastView() {
  const ready = useGtmReady()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [stage, setStage] = useState('')
  const [currency, setCurrency] = useState('')
  const [data, setData] = useState<ForecastData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await forecastService.get({ from, to, stage, currency: currency.toUpperCase() })
      setData(r.data)
      setError(null)
      setFilterError(null)
    } catch (e) {
      const msg = errMsg(e, 'Unable to load the forecast')
      // A rejected filter is the user's to fix; keep the last good forecast on screen.
      if (e instanceof ApiError && e.status === 422) setFilterError(e.errors ? Object.values(e.errors).flat().join(' ') : msg)
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }, [from, to, stage, currency])

  useEffect(() => { if (ready) queueMicrotask(() => void load()) }, [ready, load])

  const currencies = data ? Array.from(new Set(data.forecast.totals_by_currency.map((t) => t.currency))) : []

  return (
    <div className="p-6">
      <GtmPageHeader
        title="Forecast"
        description="Calculated from your open deals and the stage probabilities your administrators set. It is arithmetic, not a prediction, and it is shown separately from what actually closed. Each currency is its own block."
        actions={<Button variant="outline" onClick={() => setEditing(true)}><Settings className="mr-1 size-4" />Settings</Button>}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9 w-40" /></label>
        <label className="text-xs text-muted-foreground">To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9 w-40" /></label>
        <label className="text-xs text-muted-foreground">Stage
          <select className={`${SELECT} mt-1 block`} value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All open stages</option>
            {FORECAST_OPEN_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Currency
          <Input value={currency} maxLength={3} placeholder="All" onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="mt-1 h-9 w-24" />
        </label>
        {loading && <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />}
        {data && <span className="mb-2 text-xs text-muted-foreground">Window: {data.filters.from} to {data.filters.to}</span>}
      </div>
      {filterError && <p className="mb-4 text-sm text-destructive">{filterError}</p>}

      {error ? <ErrorState title="Could not load the forecast" description={error} retry={load} /> : !data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-6">
          {!data.probabilities_configured && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Weighted forecast: not configured.</strong> No stage probabilities have been set, so no weighted figure is shown. Nothing is assumed.
              Pipeline, best case and commit totals below are still counted from your deals. An administrator can set probabilities in Settings.
            </div>
          )}

          <section>
            <h2 className="mb-2 text-lg font-semibold">Calculated forecast <span className="ml-1 align-middle"><MeasuredTag /></span></h2>
            <p className="mb-3 text-xs text-muted-foreground">{data.basis}</p>
            {currencies.length === 0 ? (
              <EmptyState title="Nothing to forecast in this window" description="No open deals with an amount, a currency and an expected close date fall inside the selected window." />
            ) : currencies.map((c) => (
              <CurrencyBlock key={c} currency={c} total={data.forecast.totals_by_currency.find((t) => t.currency === c)!} periods={data.forecast.periods.filter((p) => p.currency === c)} weighted={data.forecast.weighted_available} />
            ))}
            <ExcludedNote data={data} />
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Actual results in this window <span className="ml-1 align-middle"><MeasuredTag /></span></h2>
            <p className="mb-3 text-xs text-muted-foreground">Deals that really closed in the window, by close date. These are results, not part of the forecast above.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label="Closed won" value={data.actuals.won.count} hint={byCurrency(data.actuals.won.value_by_currency)} tag={<MeasuredTag />} />
              <StatTile label="Closed lost" value={data.actuals.lost.count} hint={byCurrency(data.actuals.lost.value_by_currency)} tag={<MeasuredTag />} />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Forecast accuracy</h2>
            {!data.accuracy.available ? (
              <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{data.accuracy.reason ?? 'Accuracy is not available yet.'}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Month</th><th className="p-3">Snapshot taken</th><th className="p-3">Commit forecast</th><th className="p-3">Weighted forecast</th><th className="p-3">Actually won</th><th className="p-3">Commit attainment</th></tr></thead>
                  <tbody>
                    {data.accuracy.periods.map((p) => (
                      <tr key={`${p.period}-${p.currency}`} className="border-t border-border">
                        <td className="p-3 font-medium">{p.period}</td><td className="p-3">{p.snapshot_date}</td>
                        <td className="p-3">{amt(p.currency, p.forecast_commit)}</td><td className="p-3">{amt(p.currency, p.forecast_weighted)}</td>
                        <td className="p-3">{amt(p.currency, p.actual_won)}</td><td className="p-3">{p.commit_attainment_pct === null ? '—' : `${p.commit_attainment_pct}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <SettingsDialog open={editing} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void load() }} />
    </div>
  )
}

function CurrencyBlock({ currency, total, periods, weighted }: { currency: string; total: ForecastRow; periods: ForecastRow[]; weighted: boolean }) {
  return (
    <div className="mb-4 rounded-lg border border-border p-4">
      <div className="mb-3 text-sm font-semibold">{currency}</div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Pipeline" value={amt(currency, total.pipeline)} hint={`${total.deal_count} deals, all non-omitted`} />
        <StatTile label="Best case" value={amt(currency, total.best_case)} hint="Best case + commit" />
        <StatTile label="Commit" value={amt(currency, total.commit)} />
        <StatTile label="Weighted" value={weighted ? amt(currency, total.weighted) : 'Not configured'} hint={weighted ? 'Uses your stage probabilities' : 'Needs stage probabilities'} tone={weighted ? undefined : 'warn'} />
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Expected close month</th><th className="p-3">Deals</th><th className="p-3">Pipeline</th><th className="p-3">Best case</th><th className="p-3">Commit</th><th className="p-3">Weighted</th></tr></thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.period} className="border-t border-border">
                <td className="p-3 font-medium">{p.period}</td><td className="p-3">{p.deal_count}</td>
                <td className="p-3">{amt(currency, p.pipeline)}</td><td className="p-3">{amt(currency, p.best_case)}</td><td className="p-3">{amt(currency, p.commit)}</td>
                <td className="p-3">{weighted ? amt(currency, p.weighted) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExcludedNote({ data }: { data: ForecastData }) {
  const x = data.forecast.excluded
  const o = data.forecast.overdue
  const items = [
    x.no_close_date > 0 && `${x.no_close_date} without an expected close date`,
    x.no_amount > 0 && `${x.no_amount} without an amount or currency`,
    x.omitted > 0 && `${x.omitted} marked omitted`,
    x.outside_window > 0 && `${x.outside_window} closing after the window`,
    x.no_probability > 0 && `${x.no_probability} in stages with no probability (left out of weighted)`,
    o.count > 0 && `${o.count} overdue (expected close before the window; ${byCurrency(o.value_by_currency)})`,
  ].filter(Boolean)
  if (items.length === 0) return null
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
      <div className="mb-1 font-medium text-foreground">Open deals not counted above</div>
      <ul className="list-disc pl-4">{items.map((i) => <li key={String(i)}>{i}</li>)}</ul>
    </div>
  )
}

type Draft = Record<string, { probability: string; category: ForecastCategory }>

function SettingsDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Forecast settings</DialogTitle>
          <DialogDescription>Probability is the chance (0 to 100) that a deal in that stage is won. Leave it blank to leave the stage out of the weighted figure. Only Administrators can save.</DialogDescription>
        </DialogHeader>
        {open && <SettingsForm onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function SettingsForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [cfg, setCfg] = useState<ForecastSettingsData | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await forecastService.settings()
      setCfg(r.data)
      const d: Draft = {}
      for (const s of FORECAST_OPEN_STAGES) {
        const v = r.data.stages[s]
        d[s] = { probability: v?.probability === null || v?.probability === undefined ? '' : String(v.probability), category: v?.category ?? 'pipeline' }
      }
      setDraft(d)
      setLoadError(null)
    } catch (e) {
      setLoadError(errMsg(e, 'Unable to load settings'))
    }
  }, [])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const save = async () => {
    const stages: Record<string, { probability: number | null; category: ForecastCategory }> = {}
    for (const s of FORECAST_OPEN_STAGES) {
      const raw = draft[s].probability.trim()
      const n = Number(raw)
      if (raw !== '' && (Number.isNaN(n) || n < 0 || n > 100)) {
        setSaveError(`Probability for ${s} must be a number between 0 and 100.`)
        return
      }
      stages[s] = { probability: raw === '' ? null : n, category: draft[s].category }
    }
    setSaving(true)
    setSaveError(null)
    try {
      await forecastService.saveSettings(stages)
      onSaved()
    } catch (e) {
      const extra = e instanceof ApiError && e.errors ? ` ${Object.values(e.errors).flat().join(' ')}` : ''
      setSaveError(errMsg(e, 'Unable to save settings') + extra)
    } finally {
      setSaving(false)
    }
  }

  if (loadError) return <ErrorState title="Could not load settings" description={loadError} retry={load} />
  if (!cfg) return <Skeleton className="h-40" />

  return (
    <div className="space-y-3">
      {!cfg.configured && <p className="text-sm text-amber-700">No probabilities are set yet, so the forecast shows no weighted figure.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Stage</th><th className="p-2">Probability (%)</th><th className="p-2">Category</th><th className="p-2">Your closed-deal history</th></tr></thead>
          <tbody>
            {FORECAST_OPEN_STAGES.map((s) => {
              const sug = cfg.suggestions[s]
              return (
                <tr key={s} className="border-t border-border">
                  <td className="p-2 font-medium capitalize">{s}</td>
                  <td className="p-2">
                    <Input type="number" min={0} max={100} step="0.01" value={draft[s]?.probability ?? ''} placeholder="Not set" className="h-9 w-28"
                      onChange={(e) => setDraft((d) => ({ ...d, [s]: { ...d[s], probability: e.target.value } }))} />
                  </td>
                  <td className="p-2">
                    <select className={SELECT} value={draft[s]?.category ?? 'pipeline'} onChange={(e) => setDraft((d) => ({ ...d, [s]: { ...d[s], category: e.target.value as ForecastCategory } }))}>
                      {(cfg.categories.length ? cfg.categories : [...FORECAST_CATEGORIES]).map((c) => <option key={c} value={c}>{label(c)}</option>)}
                    </select>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {sug?.available ? `Suggestion: ${sug.win_rate}% won (${sug.sample} closed deals). Not applied.` : `Not enough history (${sug?.sample ?? 0} of ${sug?.minimum ?? '—'} closed deals).`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{cfg.note}</p>
      {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="mr-1 size-4 animate-spin" />}Save</Button>
      </div>
    </div>
  )
}
