'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { gtmService, type GtmOverview } from '@/services/gtm/gtm'
import { money } from './deals-view'
import { EstimateTag, GtmPageHeader, MeasuredTag, StatTile, errMsg, useGtmReady } from './gtm-shared'

const STAGE_LABEL: Record<string, string> = {
  target: 'Target', engaged: 'Engaged', opportunity: 'Opportunity',
  customer: 'Customer', churned: 'Churned', disqualified: 'Disqualified',
}

/**
 * Command Center. Every number is read from the database through /api/gtm/overview.
 * "Measured" tiles are counts of rows; "AI estimate" tiles are model output and say so.
 * Deal figures are counted from deal records, per currency. There is no forecast: it needs
 * stage probabilities an organisation sets, and none are recorded.
 */
export function CommandCenterView() {
  const ready = useGtmReady()
  const [data, setData] = useState<GtmOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData((await gtmService.overview()).data)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load the Command Center'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (ready) queueMicrotask(() => void load())
  }, [ready, load])

  if (loading && !data) {
    return <div className="grid gap-4 p-6 md:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
  }
  if (error || !data) {
    return <div className="p-6"><ErrorState title="Command Center unavailable" description={error ?? undefined} retry={load} /></div>
  }

  const m = data.measured
  const hi = m.signals_by_priority.High ?? 0

  return (
    <div className="p-6">
      <GtmPageHeader
        title="GTM Command Center"
        description="Live view of your target accounts, buying signals and outreach activity. Measured figures are counted from your records; AI estimates are labelled."
      />

      <section className="mb-6 grid gap-3 md:grid-cols-2">
        <ReadinessRow ok={data.readiness.ai.configured} label="AI provider" okText="Configured" badText="Not configured — AI analysis is unavailable. Set it up in AI & Intelligence → Providers." />
        <ReadinessRow
          ok={data.readiness.web_search.configured}
          label="Web search"
          okText={`Configured (${data.readiness.web_search.driver})`}
          badText={`Not configured${data.readiness.web_search.driver ? ` (driver: ${data.readiness.web_search.driver})` : ''} — signal research cannot fetch new sources until an API key is set.`}
        />
      </section>

      <h2 className="mb-3 text-sm font-semibold text-foreground">Pipeline of accounts</h2>
      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <StatTile label="Accounts" value={m.accounts_total} tag={<MeasuredTag />} hint={m.accounts_total === 0 ? 'None yet — promote a researched company in Prospecting.' : undefined} />
        <StatTile label="Contacts" value={m.contacts_total} tag={<MeasuredTag />} />
        <StatTile label="Accounts with no contact" value={m.accounts_without_contacts} tag={<MeasuredTag />} tone={m.accounts_without_contacts > 0 ? 'warn' : undefined} hint="Cannot be contacted until a person is added." />
        <StatTile label="Researched, not yet accounts" value={m.companies_not_yet_accounts} tag={<MeasuredTag />} hint="Companies your research found." />
      </section>

      {m.accounts_total > 0 && (
        <section className="mb-6 flex flex-wrap gap-2">
          {Object.entries(m.accounts_by_stage).map(([stage, n]) => (
            <span key={stage} className="rounded-full border border-border bg-card px-3 py-1 text-xs">
              {STAGE_LABEL[stage] ?? stage}: <strong>{n}</strong>
            </span>
          ))}
        </section>
      )}

      {data.deals && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Deals</h2>
          <section className="mb-6 grid gap-3 md:grid-cols-4">
            <StatTile label="Open deals" value={data.deals.open_count} tag={<MeasuredTag />} hint={data.deals.open_count === 0 ? 'None yet — create one in Deals.' : undefined} />
            <StatTile label="Open value" value={money(data.deals.open_value_by_currency)} tag={<MeasuredTag />} hint={data.deals.open_without_amount > 0 ? `${data.deals.open_without_amount} open deal(s) have no amount and are not counted.` : 'Shown per currency; never added across currencies.'} />
            <StatTile label="Deals needing attention" value={data.deals.flagged_count} tag={<MeasuredTag />} tone={data.deals.flagged_count > 0 ? 'warn' : undefined} hint={`${data.deals.no_next_step_count} with no next step. Rule-based flags.`} />
            <StatTile label="Won, last 30 days" value={data.deals.won_30d.count} tag={<MeasuredTag />} hint={`${money(data.deals.won_30d.value_by_currency)} · ${data.deals.lost_30d.count} lost`} />
          </section>
        </>
      )}

      <h2 className="mb-3 text-sm font-semibold text-foreground">Buying signals</h2>
      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <StatTile label="High-priority signals" value={hi} tag={<MeasuredTag />} />
        <StatTile label="Medium" value={m.signals_by_priority.Medium ?? 0} tag={<MeasuredTag />} />
        <StatTile label="Low" value={m.signals_by_priority.Low ?? 0} tag={<MeasuredTag />} />
        <StatTile label="Not yet reviewed" value={m.signals_unreviewed} tag={<MeasuredTag />} hint="Review them in Signals." />
      </section>

      <h2 className="mb-3 text-sm font-semibold text-foreground">Activity — last 30 days</h2>
      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <StatTile label="Logged touches" value={m.activities_30d_total} tag={<MeasuredTag />} hint="Notes, calls, meetings, emails recorded against accounts." />
        {Object.entries(m.activities_30d_by_type).map(([type, n]) => (
          <StatTile key={type} label={type[0].toUpperCase() + type.slice(1) + 's'} value={n} tag={<MeasuredTag />} />
        ))}
      </section>

      <h2 className="mb-3 text-sm font-semibold text-foreground">AI estimates</h2>
      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <StatTile
          label="Average ICP fit"
          value={data.estimates.icp_fit_avg === null ? '—' : `${data.estimates.icp_fit_avg}`}
          tag={<EstimateTag />}
          hint={data.estimates.icp_fit_avg === null ? 'No account has been scored yet.' : `Across ${data.estimates.icp_fit_scored_accounts} scored account(s). A model's judgement, not a result.`}
        />
      </section>

      <p className="text-xs text-muted-foreground">
        Forecast is not shown: it needs stage probabilities your organisation sets, and none are recorded. Renewal dates and customer health scores are not tracked yet either, so none are invented.{' '}
        <Link href="/gtm/prospecting" className="text-primary underline">Go to Prospecting</Link>
      </p>
    </div>
  )
}

function ReadinessRow({ ok, label, okText, badText }: { ok: boolean; label: string; okText: string; badText: string }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${ok ? 'border-border' : 'border-amber-300 bg-amber-50/50'}`}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${ok ? 'text-green-600' : 'text-amber-600'}`} />
      <div><span className="font-medium">{label}: </span><span className="text-muted-foreground">{ok ? okText : badText}</span></div>
    </div>
  )
}
