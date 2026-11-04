'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { statusBadgeVariants } from '@/components/ui/status-badge'
import {
  formatCount, formatDateTime, formatDuration, formatMoney, NO_VALUE, relativeTime, runNeedsReason, runReason, runStatusLabel, runStatusTone,
  sortRunsNewestFirst, summariseRuns, totalTokens, type CostSummary, type KnownSum, type RunsSummary,
} from '@/lib/signal-review/format'
import { ApiError } from '@/services/core'
import { signalRunsService, type SignalRun } from '@/services/signal-review/runs-service'

const TONE_VARIANT = { neutral: 'default', success: 'success', warning: 'warning', error: 'error', info: 'processing' } as const

function describeError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return 'Your session has ended. Please sign in again.'
    if (cause.status === 403) return 'You do not have access to the run history.'
    return cause.message
  }
  return cause instanceof Error ? cause.message : 'The run history could not be loaded.'
}

/**
 * The Runs tab of Signal Review: how the latest research runs went and what they cost. It loads the runs itself (GET /signals/research/runs, the
 * latest 60 of the organisation) and keeps no other state. What the layout shows is in SignalRunsView, which takes the runs as props.
 */
export function SignalRunsPanel() {
  const [runs, setRuns] = useState<SignalRun[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Only the newest request may change what is shown, and nothing after the panel has gone.
  const latest = useRef(0)
  const load = useCallback(async () => {
    const mine = ++latest.current
    setLoading(true)
    setError(null)
    try {
      const list = await signalRunsService.list()
      if (mine === latest.current) setRuns(list)
    } catch (cause) {
      if (mine === latest.current) setError(describeError(cause))
    } finally {
      if (mine === latest.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => { void load() })
    return () => { latest.current += 1 }
  }, [load])

  return <SignalRunsView runs={runs} loading={loading} error={error} onRetry={() => void load()} />
}

/**
 * Loading, error with Retry, empty, or the run health on top of a table of runs. Unknown figures show `—` and are left out of the sums, which say how
 * many runs they leave out. `now` is only for tests: it fixes what "2 hours ago" is measured from.
 */
export function SignalRunsView({ runs, loading, error, onRetry, now }: {
  runs: readonly SignalRun[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
  now?: Date
}) {
  if (loading) {
    return (
      <div role="status" aria-busy="true" className="space-y-3">
        <span className="sr-only">Loading runs…</span>
        <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => <Skeleton key={tile} className="h-20" />)}
        </div>
        <Skeleton aria-hidden="true" className="h-48" />
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert">
        <ErrorState title="The runs could not be loaded" description={error} retry={onRetry} />
      </div>
    )
  }

  if (!runs || runs.length === 0) {
    return <EmptyState title="No research runs yet" description="Runs appear here once someone starts a research run." />
  }

  const summary = summariseRuns(runs)
  const ordered = sortRunsNewestFirst(runs)

  return (
    <div className="space-y-4">
      <section aria-label="Run health" className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <LastRunTile run={summary.last} now={now} />
          <OutcomesTile counts={summary.counts} total={summary.total} />
          <CostTile cost={summary.cost} total={summary.total} />
          <SumTile label="AI tokens" value={formatCount(summary.tokens.total)} sum={summary.tokens} total={summary.total} noun="token count" />
          <SumTile label="Search requests" value={formatCount(summary.searches.total)} sum={summary.searches} total={summary.total} noun="search count" />
        </div>

        {summary.allManual && <p className="text-sm text-foreground">Runs are started by hand. No schedule is switched on.</p>}
        {summary.scheduled > 0 && (
          <p className="text-sm text-foreground">
            {summary.scheduled} of {summary.total} {summary.total === 1 ? 'run was' : 'runs were'} started on a schedule.
          </p>
        )}
      </section>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <caption className="sr-only">Research runs, newest first</caption>
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Run</th>
              <th scope="col" className="px-3 py-2 font-medium">Started</th>
              <th scope="col" className="px-3 py-2 font-medium">Trigger</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium">Duration</th>
              <th scope="col" className="px-3 py-2 font-medium">Product</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Signals found</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">AI tokens</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">AI cost</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Search requests</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((run) => <RunRow key={run.id} run={run} now={now} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RunRow({ run, now }: { run: SignalRun; now?: Date }) {
  const ago = relativeTime(run.started_at, now)
  const inProgress = run.status.toLowerCase() === 'running' && run.duration_seconds === null
  const tokens = totalTokens(run)

  return (
    <tr className="border-b border-border align-top last:border-0">
      <td className="px-3 py-2 font-medium">#{run.id}</td>
      <td className="px-3 py-2">
        <div>{formatDateTime(run.started_at)}</div>
        {ago && <div className="text-xs text-muted-foreground">{ago}</div>}
      </td>
      <td className="px-3 py-2 capitalize">{run.trigger}</td>
      <td className="px-3 py-2">
        <StatusChip status={run.status} />
        {runNeedsReason(run.status) && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{runReason(run)}</p>}
      </td>
      <td className="px-3 py-2">{inProgress ? 'In progress' : formatDuration(run.duration_seconds)}</td>
      <td className="px-3 py-2">{run.product_name ?? run.product_key ?? NO_VALUE}</td>
      <td className="px-3 py-2 text-right">
        {formatCount(run.signals_found)}
        {run.signals_new !== null && <div className="text-xs text-muted-foreground">{formatCount(run.signals_new)} new</div>}
      </td>
      <td className="px-3 py-2 text-right" title={tokens === null ? 'Not recorded for this run' : `${formatCount(run.ai_input_tokens)} in, ${formatCount(run.ai_output_tokens)} out`}>
        {formatCount(tokens)}
      </td>
      <td className="px-3 py-2 text-right" title={costNote(run)}>
        {formatMoney(run.ai_cost, run.ai_cost_currency)}
      </td>
      <td className="px-3 py-2 text-right">{formatCount(run.search_requests)}</td>
    </tr>
  )
}

function StatusChip({ status }: { status: string }) {
  return <span className={statusBadgeVariants({ variant: TONE_VARIANT[runStatusTone(status)], size: 'sm' })}>{runStatusLabel(status)}</span>
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function LastRunTile({ run, now }: { run: SignalRun | null; now?: Date }) {
  const ago = relativeTime(run?.started_at, now)
  return (
    <Tile label="Last run">
      {run ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusChip status={run.status} />
          <span className="text-sm text-foreground">{ago ?? 'start time not recorded'}</span>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{NO_VALUE}</p>
      )}
    </Tile>
  )
}

function OutcomesTile({ counts, total }: { counts: RunsSummary['counts']; total: number }) {
  const rows: Array<[string, string, number]> = [
    ['success', 'Success', counts.success],
    ['partial', 'Partial', counts.partial],
    ['failed', 'Failed', counts.failed],
    ['skipped', 'Skipped', counts.skipped],
  ]
  if (counts.other > 0) rows.push(['other', 'Other', counts.other])

  return (
    <Tile label={`Outcomes of ${total} ${total === 1 ? 'run' : 'runs'}`}>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
        {rows.map(([key, label, count]) => (
          <li key={key} data-count={key}>
            <span className="text-muted-foreground">{label}</span> <b className="font-semibold text-foreground">{count}</b>
          </li>
        ))}
      </ul>
    </Tile>
  )
}

/** What a total says about the runs it leaves out: "1 of 3 runs has no cost recorded", "All 2 runs have a cost recorded", "No run has a cost recorded". */
function coverage(sum: Pick<KnownSum, 'known' | 'unknown'>, total: number, noun: string): string {
  if (sum.known === 0) return `No run has a ${noun} recorded`
  if (sum.unknown > 0) return `${sum.unknown} of ${total} ${sum.unknown === 1 ? 'runs has' : 'runs have'} no ${noun} recorded`
  return `All ${total} ${total === 1 ? 'run has' : 'runs have'} a ${noun} recorded`
}

function SumTile({ label, value, sum, total, noun }: { label: string; value: string; sum: KnownSum; total: number; noun: string }) {
  return (
    <Tile label={label}>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{coverage(sum, total, noun)}</p>
    </Tile>
  )
}

/** Why a cost cell shows a dash: no cost at all, or an amount whose currency nobody recorded. A cost that is shown needs no note. */
function costNote(run: Pick<SignalRun, 'ai_cost' | 'ai_cost_currency'>): string | undefined {
  if (run.ai_cost === null) return 'Cost was not recorded for this run'
  return formatMoney(run.ai_cost, run.ai_cost_currency) === NO_VALUE ? 'The currency of this cost was not recorded' : undefined
}

/**
 * The AI cost of the runs. One total per currency, never added across currencies: a single figure when every cost is in one currency, a labelled list
 * when there are two. Runs without a cost are left out of every total, and the line under it says how many.
 */
function CostTile({ cost, total }: { cost: CostSummary; total: number }) {
  const { byCurrency } = cost

  return (
    <Tile label="AI cost">
      {byCurrency.length === 0 && <p className="mt-1 text-xl font-semibold text-foreground">{NO_VALUE}</p>}
      {byCurrency.length === 1 && <p className="mt-1 text-xl font-semibold text-foreground">{formatMoney(byCurrency[0].total, byCurrency[0].currency)}</p>}
      {byCurrency.length > 1 && (
        <ul className="mt-1 space-y-0.5">
          {byCurrency.map((entry) => (
            <li key={entry.currency} data-currency={entry.currency} className="flex items-baseline gap-2">
              <span className="w-10 text-xs text-muted-foreground">{entry.currency}</span>
              <b className="text-lg font-semibold text-foreground">{formatMoney(entry.total, entry.currency)}</b>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{coverage(cost, total, 'cost')}</p>
      {byCurrency.length > 1 && <p className="text-xs text-muted-foreground">Shown per currency; they are not added together.</p>}
    </Tile>
  )
}
