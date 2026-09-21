'use client'

/**
 * Usage & Cost — what the AI spent, broken down, and the quota that bounds it.
 *
 * A static route, so it takes precedence over `app/ai/[capability]/page.tsx`.
 *
 * WHY THE COST FIGURE CARRIES A CAVEAT
 *
 * A rate is applied when a call is recorded, so calls made before anybody entered a
 * rate have no cost and never will. `cost_complete` says whether the total covers
 * every call, and this screen prints the qualification when it does not — "covers 1
 * of 2 calls" rather than a number that reads as the whole bill.
 *
 * WHY REFUSED CALLS ARE COUNTED SEPARATELY FROM FAILED ONES
 *
 * A refusal is a quota working: nothing was sent and nothing was charged. A failure
 * is a provider rejecting a request that was. Folding them together would make a
 * correctly-enforced limit look like an outage.
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'

import {
  fetchUsageEvents,
  fetchUsageOptions,
  fetchUsageSummary,
  saveUsageQuota,
  type UsageEvent,
  type UsageOptions,
  type UsageQuota,
  type UsageSummary,
} from '@/lib/intelligence/ai-usage'
import { describeAiError } from '@/lib/intelligence/client'

import { CapabilityShell } from '../_components/CapabilityShell'

const WINDOW_LABELS: Record<string, string> = {
  day: 'Today',
  week: 'Last 7 days',
  month: 'Last 30 days',
  quarter: 'Last 90 days',
}

export default function AiUsageCostPage() {
  return (
    <CapabilityShell slug="usage-cost">
      <UsageConsole />
    </CapabilityShell>
  )
}

function UsageConsole() {
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [events, setEvents] = useState<UsageEvent[]>([])
  const [options, setOptions] = useState<UsageOptions | null>(null)
  const [selectedWindow, setSelectedWindow] = useState('month')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchUsageSummary(selectedWindow), fetchUsageEvents(), fetchUsageOptions()])
      .then(([nextSummary, nextEvents, nextOptions]) => {
        if (cancelled) return
        setSummary(nextSummary)
        setEvents(nextEvents.events)
        setOptions(nextOptions)
        setError('')
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(describeAiError(cause))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedWindow, reloadToken])

  const reload = useCallback(() => {
    setLoading(true)
    setReloadToken((token) => token + 1)
  }, [])

  if (loading && summary === null && error === '') {
    return (
      <div className="mt-8 flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading usage&hellip;
      </div>
    )
  }

  return (
    <section className="mt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Usage &amp; cost</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every model call this platform makes is counted at one point, so nothing can spend
            without appearing here. Quotas refuse a call before it reaches a provider.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedWindow}
            onChange={(event) => setSelectedWindow(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
          >
            {(options?.windows ?? ['day', 'week', 'month', 'quarter']).map((value) => (
              <option key={value} value={value}>
                {WINDOW_LABELS[value] ?? value}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {notice && (
        <p className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Check className="size-4" />
          {notice}
        </p>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {summary && (
        <>
          <Totals summary={summary} />
          <Quotas
            quotas={summary.quotas}
            options={options}
            onSaved={(message) => {
              setNotice(message)
              reload()
            }}
            onError={setError}
          />

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Breakdown
              title="By module"
              caption="Which part of the product is spending. The first question a bill raises."
              rows={summary.by_module.map((row) => ({
                key: row.ai_module,
                label: row.module_label,
                calls: row.calls,
                tokens: row.tokens,
                cost: row.estimated_cost_usd,
              }))}
            />
            <Breakdown
              title="By provider and model"
              caption="What each model costs. This is what decides which model a capability should get."
              rows={summary.by_model.map((row) => ({
                key: `${row.provider}/${row.model ?? '-'}`,
                label: `${row.provider} / ${row.model ?? 'provider default'}`,
                calls: row.calls,
                tokens: row.tokens,
                cost: row.estimated_cost_usd,
              }))}
            />
          </div>

          <Trend rows={summary.by_day} />
          <Events events={events} />
          <OtherLedgers ledgers={summary.other_ledgers} />
        </>
      )}
    </section>
  )
}

function Totals({ summary }: { summary: UsageSummary }) {
  const { totals } = summary

  return (
    <div className="mt-5">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Model calls" value={totals.calls.toLocaleString('en-IN')} />
        <Metric label="Tokens" value={totals.total_tokens.toLocaleString('en-IN')} />
        <Metric
          label="Estimated cost"
          value={
            totals.estimated_cost_usd === null ? '—' : `$${totals.estimated_cost_usd.toFixed(6)}`
          }
          /* The caveat, inline. See the file note on why the bare number misleads. */
          note={
            totals.estimated_cost_usd === null
              ? 'No rate is set on any model used. Add one in Model Management.'
              : totals.cost_complete
                ? undefined
                : `Covers ${totals.calls_priced} of ${totals.calls} calls — the rest ran before a rate was set.`
          }
        />
        <Metric
          label="Average latency"
          value={totals.avg_latency_ms === null ? '—' : `${totals.avg_latency_ms} ms`}
        />
      </dl>

      {(totals.failed > 0 || totals.refused > 0) && (
        <p className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {totals.failed > 0 && (
            <span className="text-destructive">
              {totals.failed} call{totals.failed === 1 ? '' : 's'} failed at the provider
            </span>
          )}
          {/* Separate from failures on purpose — a refusal is the quota working. */}
          {totals.refused > 0 && (
            <span>{totals.refused} refused by a quota before reaching a provider (no cost)</span>
          )}
        </p>
      )}
    </div>
  )
}

function Quotas({
  quotas,
  options,
  onSaved,
  onError,
}: {
  quotas: UsageQuota[]
  options: UsageOptions | null
  onSaved: (message: string) => void
  onError: (message: string) => void
}) {
  const [moduleKey, setModuleKey] = useState('')
  const [period, setPeriod] = useState<'day' | 'month'>('month')
  const [limit, setLimit] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)

    try {
      await saveUsageQuota({
        ai_module: moduleKey === '' ? null : moduleKey,
        period,
        token_limit: Number(limit),
      })
      const removed = Number(limit) === 0
      setLimit('')
      onSaved(removed ? 'Quota removed.' : 'Quota saved.')
    } catch (cause) {
      onError(describeAiError(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-card-foreground">Quotas</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        A token ceiling per period, checked before a call is sent — so a runaway hits the limit
        instead of the invoice. The narrowest quota that matches applies: a module&rsquo;s beats the
        organisation&rsquo;s.
      </p>

      {quotas.length > 0 && (
        <ul className="mt-3 space-y-2">
          {quotas.map((quota) => (
            <li key={quota.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {quota.module_label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    per {quota.period}
                  </span>
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {quota.tokens_used.toLocaleString('en-IN')} /{' '}
                  {quota.token_limit.toLocaleString('en-IN')} tokens ({quota.percent_used}%)
                </span>
              </div>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${
                    quota.exceeded ? 'bg-destructive' : quota.warning ? 'bg-amber-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, quota.percent_used)}%` }}
                />
              </div>

              {/* Exceeded and warning lead to different actions, so they read differently. */}
              {quota.exceeded ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <ShieldAlert className="size-3.5" />
                  Spent — calls in this scope are being refused.
                </p>
              ) : quota.warning ? (
                <p className="mt-2 text-xs text-amber-700">
                  Past the {quota.warn_at_percent}% warning mark.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Scope</span>
          <select
            value={moduleKey}
            onChange={(event) => setModuleKey(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          >
            <option value="">Whole organisation</option>
            {(options?.modules ?? []).map((module) => (
              <option key={module.key} value={module.key}>
                {module.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Period</span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as 'day' | 'month')}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          >
            <option value="month">Per month</option>
            <option value="day">Per day</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Token limit</span>
          <input
            required
            type="number"
            min={0}
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            placeholder="1000000"
            className="w-36 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </label>

        <button
          type="submit"
          disabled={saving || limit === ''}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Save
        </button>
        <span className="pb-2 text-xs text-muted-foreground">0 removes the quota.</span>
      </form>
    </section>
  )
}

function Breakdown({
  title,
  caption,
  rows,
}: {
  title: string
  caption: string
  rows: Array<{ key: string; label: string; calls: number; tokens: number; cost: number | null }>
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No calls in this window.</p>
      ) : (
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr>
              {['Name', 'Calls', 'Tokens', 'Cost'].map((heading, index) => (
                <th
                  key={heading}
                  className={`border-b border-border pb-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase ${
                    index === 0 ? '' : 'text-right'
                  }`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="py-2 pr-2 text-foreground">{row.label}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">{row.calls}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {row.tokens.toLocaleString('en-IN')}
                </td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {row.cost === null ? '—' : `$${row.cost.toFixed(6)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function Trend({ rows }: { rows: UsageSummary['by_day'] }) {
  if (rows.length === 0) return null

  const peak = Math.max(...rows.map((row) => row.tokens), 1)

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-card-foreground">By day</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        The only breakdown that catches a runaway before the invoice does.
      </p>
      <ul className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <li key={row.day} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
              {row.day}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${Math.max(2, (row.tokens / peak) * 100)}%` }}
              />
            </span>
            <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {row.tokens.toLocaleString('en-IN')} t
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Events({ events }: { events: UsageEvent[] }) {
  if (events.length === 0) return null

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-card-foreground">Recent calls</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          For when a total needs explaining. &ldquo;Resolved from&rdquo; is the precedence step that
          chose the credential.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr>
              {['Module', 'Model', 'Resolved from', 'Tokens', 'Latency', 'Outcome', 'When'].map(
                (heading) => (
                  <th
                    key={heading}
                    className="border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold tracking-widest whitespace-nowrap text-muted-foreground uppercase"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((event) => (
              <tr key={event.id} className="align-top">
                <td className="px-3 py-2 whitespace-nowrap text-foreground">
                  {event.module_label}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                  {event.model ?? event.provider}
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                  {event.source ?? '—'}
                </td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap text-muted-foreground">
                  {(event.input_tokens + event.output_tokens).toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap text-muted-foreground">
                  {event.latency_ms === null ? '—' : `${event.latency_ms} ms`}
                </td>
                <td className="px-3 py-2">
                  <OutcomeChip outcome={event.outcome} />
                  {event.error && (
                    <p className="mt-1 max-w-sm text-[11px] leading-4 text-muted-foreground">
                      {event.error}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                  {event.created_at?.slice(0, 16) ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * Counts from meters this layer does not write.
 *
 * Named rather than merged into the totals: those rows are real usage recorded by
 * another application, and adding them to a figure this layer produced would make
 * neither number checkable.
 */
function OtherLedgers({ ledgers }: { ledgers: Record<string, number | null> }) {
  const present = Object.entries(ledgers).filter(([, count]) => count !== null && count > 0)

  if (present.length === 0) return null

  return (
    <p className="mt-6 rounded-md border border-dashed border-border bg-muted/40 px-3 py-3 text-xs leading-5 text-muted-foreground">
      Other usage ledgers exist in this database and are not counted above, because a different
      application writes them:{' '}
      {present.map(([table, count]) => `${table} (${count} rows)`).join(', ')}.
    </p>
  )
}

function OutcomeChip({ outcome }: { outcome: string }) {
  const tone =
    outcome === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : outcome === 'refused'
        ? 'border-border bg-muted text-muted-foreground'
        : 'border-destructive/30 bg-destructive/10 text-destructive'

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${tone}`}
    >
      {outcome}
    </span>
  )
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</dd>
      {note && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{note}</p>}
    </div>
  )
}
