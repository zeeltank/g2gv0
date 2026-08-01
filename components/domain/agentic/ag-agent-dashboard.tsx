'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Bot, DollarSign, Plus, TrendingUp, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { useAgenticDashboard } from '@/hooks/use-agentic'

import {
  KpiTile,
  RunStatusBadge,
  formatCost,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRate,
} from './shared'

const WINDOWS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 14 days', value: '14' },
  { label: 'Last 30 days', value: '30' },
]

/**
 * Agent Dashboard — the operational view of what the agents are doing.
 *
 * Every figure comes from recorded runs. The screen this replaces drew its four
 * sparklines from a fixture array, so the trends moved identically for every
 * customer regardless of activity.
 */
export function AgAgentDashboard() {
  const router = useRouter()
  const [days, setDays] = useState('7')

  const { data, loading, error, retry } = useAgenticDashboard(Number(days))

  // Memoised so the four sparkline useMemos below don't see a new array every render.
  const series = useMemo(() => data?.series ?? [], [data])
  const runsSpark = useMemo(() => series.map((point) => point.total_runs), [series])
  const successSpark = useMemo(() => series.map((point) => point.success_rate), [series])
  const costSpark = useMemo(() => series.map((point) => point.cost), [series])
  const tokenSpark = useMemo(() => series.map((point) => point.tokens), [series])

  const go = (submenuId: string) => router.push(`/module/m7/${submenuId}/${submenuId}`)

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agent Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live activity across your agents — runs, reliability and spend.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-40">
            <Select value={days} onChange={setDays} options={WINDOWS} className="h-10 rounded-xl border-border bg-background" aria-label="Time window" />
          </div>
          <Button
            onClick={() => router.push('/module/m7/ag-create-agent/ag-create-agent')}
            className="h-10 gap-2 rounded-xl px-4 font-bold shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4 stroke-[3]" /> Create Agent
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState title="Couldn't load the dashboard" description={error} retry={retry} />
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              label="Agents"
              value={formatNumber(data?.agents.total)}
              hint={`${data?.agents.deployed ?? 0} deployed · ${data?.agents.draft ?? 0} draft`}
              icon={<Bot className="h-4 w-4" />}
              loading={loading}
              onClick={() => go('ag-agent-library')}
            />
            <KpiTile
              label="Total Runs"
              value={formatNumber(data?.runs.total)}
              hint={data?.runs.active ? `${data.runs.active} in flight` : 'Across all agents'}
              icon={<Activity className="h-4 w-4" />}
              spark={runsSpark}
              sparkColor="hsl(var(--primary))"
              loading={loading}
              onClick={() => go('ag-run-log')}
            />
            <KpiTile
              label="Success Rate"
              value={formatRate(data?.runs.success_rate)}
              hint={
                data?.runs.total
                  ? `${formatNumber(data.runs.failures)} failed of ${formatNumber(data.runs.total)}`
                  : 'Nothing has run yet'
              }
              icon={<TrendingUp className="h-4 w-4" />}
              spark={successSpark}
              sparkColor="hsl(var(--success))"
              loading={loading}
              onClick={() => go('ag-analytics')}
            />
            <KpiTile
              label="Spend"
              value={formatCost(data?.runs.total_cost)}
              hint={
                data?.today.cost_change_pct === null || data?.today.cost_change_pct === undefined
                  ? `${formatNumber(data?.runs.total_tokens)} tokens`
                  : `${data.today.cost_change_pct > 0 ? '+' : ''}${data.today.cost_change_pct}% vs yesterday`
              }
              icon={<DollarSign className="h-4 w-4" />}
              spark={costSpark}
              sparkColor="hsl(var(--warning))"
              loading={loading}
            />
          </div>

          {/* Activity + tokens */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl lg:col-span-2">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Run Activity</h2>
                  <p className="text-xs text-muted-foreground">Successes and failures per day</p>
                </div>
                <button onClick={() => go('ag-analytics')} className="text-xs font-bold text-primary hover:underline">
                  Full analytics
                </button>
              </div>

              {loading ? (
                <Skeleton className="h-48 w-full rounded-xl" />
              ) : series.every((point) => point.total_runs === 0) ? (
                <EmptyState
                  className="border-0 py-10"
                  icon={<Activity className="h-8 w-8" />}
                  title="No runs in this window"
                  description="Start a run from an agent's detail panel and it will appear here."
                />
              ) : (
                <DailyBars series={series} />
              )}
            </div>

            <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-foreground">Token Use</h2>
              <p className="mb-4 text-xs text-muted-foreground">Consumption trend</p>
              <p className="text-3xl font-bold tabular-nums text-foreground">
                {loading ? '…' : formatNumber(data?.runs.total_tokens)}
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                Avg run {formatDuration(data?.runs.avg_duration_ms)}
              </p>
              <div style={{ color: 'hsl(var(--primary))' }}>
                <SparklineBlock values={tokenSpark} loading={loading} />
              </div>
            </div>
          </div>

          {/* Recent runs */}
          <div className="rounded-2xl border border-primary/10 bg-card/90 shadow-sm backdrop-blur-2xl">
            <div className="flex items-baseline justify-between gap-3 border-b border-border p-5">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Recent Runs</h2>
                <p className="text-xs text-muted-foreground">The last few executions across all agents</p>
              </div>
              <button onClick={() => go('ag-run-log')} className="text-xs font-bold text-primary hover:underline">
                View run log
              </button>
            </div>

            {loading ? (
              <div className="space-y-2 p-5">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : (data?.recent_runs.length ?? 0) === 0 ? (
              <EmptyState
                className="m-5 border-0"
                icon={<Zap className="h-8 w-8" />}
                title="No runs yet"
                description="Deploy an agent and start a run to populate this feed."
              />
            ) : (
              <div className="divide-y divide-border">
                {data!.recent_runs.map((run) => (
                  <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <RunStatusBadge status={run.status} size="sm" />
                      <span className="truncate text-sm font-semibold text-foreground">{run.agent_name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>{formatDuration(run.duration_ms)}</span>
                      <span>{formatNumber(run.tokens_used)} tokens</span>
                      <span>{formatDateTime(run.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** A stacked bar per day: successes below, failures above. */
function DailyBars({ series }: { series: { date: string; successes: number; failures: number; total_runs: number }[] }) {
  const max = Math.max(...series.map((point) => point.total_runs), 1)

  return (
    <div className="flex h-48 items-end gap-1.5">
      {series.map((point) => {
        const height = (point.total_runs / max) * 100
        const failureShare = point.total_runs > 0 ? (point.failures / point.total_runs) * 100 : 0

        return (
          <div key={point.date} className="group flex flex-1 flex-col items-center gap-1.5">
            <div className="relative flex w-full flex-1 items-end">
              <div
                className="w-full overflow-hidden rounded-t-md bg-primary/70 transition-all group-hover:bg-primary"
                style={{ height: `${Math.max(height, point.total_runs > 0 ? 4 : 0)}%` }}
                title={`${point.date}: ${point.total_runs} runs, ${point.failures} failed`}
              >
                {failureShare > 0 && (
                  <div className="w-full bg-destructive/80" style={{ height: `${failureShare}%` }} />
                )}
              </div>
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {point.date.slice(5).replace('-', '/')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function SparklineBlock({ values, loading }: { values: number[]; loading?: boolean }) {
  if (loading) return <Skeleton className="h-10 w-full rounded" />
  if (values.length < 2) return <p className="text-xs text-muted-foreground">Not enough data yet.</p>

  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100
      const y = 32 - ((value - min) / span) * 28 - 2
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
      <polygon points={`0,32 ${points} 100,32`} fill="currentColor" opacity={0.12} />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
