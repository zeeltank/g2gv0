'use client'

import { useMemo, useState } from 'react'
import { Activity, BarChart3, DollarSign, Download, Timer, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useAgenticAnalytics, useAgents } from '@/hooks/use-agentic'

import { KpiTile, Sparkline, TOOL_LABELS, formatCost, formatDuration, formatNumber, formatRate } from './shared'

const ALL = 'all'

const WINDOWS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 14 days', value: '14' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
]

const STATUS_TONE: Record<string, string> = {
  success: 'bg-emerald-500',
  error: 'bg-destructive',
  running: 'bg-primary',
  pending: 'bg-amber-500',
  cancelled: 'bg-muted-foreground',
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Analytics — how the agents actually performed.
 *
 * Everything here is computed from recorded runs. The screen this replaces read
 * a fixture module, so its per-agent table listed four agents that did not
 * exist in any customer's account.
 */
export function AgAnalytics() {
  const [days, setDays] = useState('30')
  const [agentId, setAgentId] = useState(ALL)

  const params = useMemo(
    () => ({
      days: Number(days),
      ...(agentId !== ALL ? { agent_id: Number(agentId) } : {}),
    }),
    [days, agentId],
  )

  const { data, loading, error, retry } = useAgenticAnalytics(params)
  const { agents } = useAgents({ per_page: 200, sort: 'name', direction: 'asc' })

  const agentOptions = useMemo(
    () => [
      { label: 'All Agents', value: ALL },
      ...agents.map((agent) => ({ label: agent.name, value: String(agent.id) })),
    ],
    [agents],
  )

  // Memoised so the totals useMemo below doesn't see a new array every render.
  const series = useMemo(() => data?.series ?? [], [data])

  const totals = useMemo(() => {
    const runs = series.reduce((sum, point) => sum + point.total_runs, 0)
    const successes = series.reduce((sum, point) => sum + point.successes, 0)
    const cost = series.reduce((sum, point) => sum + point.cost, 0)
    const tokens = series.reduce((sum, point) => sum + point.tokens, 0)
    const durationPoints = series.filter((point) => point.avg_duration_ms > 0)
    const avgDuration = durationPoints.length
      ? durationPoints.reduce((sum, point) => sum + point.avg_duration_ms, 0) / durationPoints.length
      : 0

    return {
      runs,
      // null rather than 0% when nothing ran — 0% reads as "everything failed".
      successRate: runs > 0 ? Math.round((successes / runs) * 1000) / 10 : null,
      cost,
      tokens,
      avgDuration: Math.round(avgDuration),
    }
  }, [series])

  const statusTotal = (data?.status_breakdown ?? []).reduce((sum, entry) => sum + entry.total, 0)
  const maxToolUse = Math.max(...(data?.tool_usage ?? []).map((entry) => entry.total), 1)

  const exportCsv = () => {
    if (series.length === 0) return

    const header = ['Date', 'Runs', 'Successes', 'Failures', 'Success Rate %', 'Tokens', 'Cost', 'Avg Duration (ms)']
    const rows = series.map((point) => [
      point.date,
      point.total_runs,
      point.successes,
      point.failures,
      point.success_rate,
      point.tokens,
      point.cost,
      point.avg_duration_ms,
    ])

    const blob = new Blob(['﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `agentic-analytics-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agent Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Throughput, reliability and cost across the window you choose.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-52">
            <Select value={agentId} onChange={setAgentId} options={agentOptions} className="h-10 rounded-xl border-border bg-background" aria-label="Agent" />
          </div>
          <div className="w-40">
            <Select value={days} onChange={setDays} options={WINDOWS} className="h-10 rounded-xl border-border bg-background" aria-label="Time window" />
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={series.length === 0} className="h-10 gap-2 rounded-xl font-semibold">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState title="Couldn't load analytics" description={error} retry={retry} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              label="Runs"
              value={formatNumber(totals.runs)}
              hint={`Over ${data?.window_days ?? days} days`}
              icon={<Activity className="h-4 w-4" />}
              spark={series.map((point) => point.total_runs)}
              loading={loading}
            />
            <KpiTile
              label="Success Rate"
              value={formatRate(totals.successRate)}
              hint={totals.runs > 0 ? `${formatNumber(totals.runs)} runs analysed` : 'Nothing ran in this window'}
              icon={<BarChart3 className="h-4 w-4" />}
              spark={series.map((point) => point.success_rate)}
              sparkColor="hsl(var(--success))"
              loading={loading}
            />
            <KpiTile
              label="Cost"
              value={formatCost(totals.cost)}
              hint={`${formatNumber(totals.tokens)} tokens`}
              icon={<DollarSign className="h-4 w-4" />}
              spark={series.map((point) => point.cost)}
              sparkColor="hsl(var(--warning))"
              loading={loading}
            />
            <KpiTile
              label="Avg Duration"
              value={formatDuration(totals.avgDuration)}
              hint="Mean run wall-clock time"
              icon={<Timer className="h-4 w-4" />}
              spark={series.map((point) => point.avg_duration_ms)}
              loading={loading}
            />
          </div>

          {/* Trend */}
          <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Daily Trend</h2>
            <p className="mb-4 text-xs text-muted-foreground">Runs, with the failed share shaded</p>

            {loading ? (
              <Skeleton className="h-56 w-full rounded-xl" />
            ) : series.every((point) => point.total_runs === 0) ? (
              <EmptyState
                className="border-0 py-10"
                icon={<Activity className="h-8 w-8" />}
                title="No activity in this window"
                description="Widen the range or start a run to populate the chart."
              />
            ) : (
              <>
                <div className="flex h-56 items-end gap-1">
                  {series.map((point) => {
                    const max = Math.max(...series.map((entry) => entry.total_runs), 1)
                    const height = (point.total_runs / max) * 100
                    const failureShare = point.total_runs > 0 ? (point.failures / point.total_runs) * 100 : 0

                    return (
                      <div key={point.date} className="group flex flex-1 flex-col items-center gap-1">
                        <div className="flex w-full flex-1 items-end">
                          <div
                            className="w-full overflow-hidden rounded-t-md bg-primary/70 transition-colors group-hover:bg-primary"
                            style={{ height: `${Math.max(height, point.total_runs > 0 ? 3 : 0)}%` }}
                            title={`${point.date}: ${point.total_runs} runs · ${point.failures} failed · ${formatCost(point.cost)}`}
                          >
                            {failureShare > 0 && <div className="w-full bg-destructive/80" style={{ height: `${failureShare}%` }} />}
                          </div>
                        </div>
                        {series.length <= 31 && (
                          <span className="text-[9px] tabular-nums text-muted-foreground">
                            {point.date.slice(8)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/70" /> Successful</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-destructive/80" /> Failed</span>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Status breakdown */}
            <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Run Outcomes</h2>
              <p className="mb-4 text-xs text-muted-foreground">Distribution across the window</p>

              {loading ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : statusTotal === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">No runs to break down.</p>
              ) : (
                <>
                  <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted">
                    {data!.status_breakdown.map((entry) => (
                      <div
                        key={entry.status}
                        className={cn('h-full', STATUS_TONE[entry.status] ?? 'bg-muted-foreground')}
                        style={{ width: `${(entry.total / statusTotal) * 100}%` }}
                        title={`${entry.status}: ${entry.total}`}
                      />
                    ))}
                  </div>
                  <ul className="space-y-2">
                    {data!.status_breakdown.map((entry) => (
                      <li key={entry.status} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 capitalize text-foreground">
                          <span className={cn('h-2.5 w-2.5 rounded-sm', STATUS_TONE[entry.status] ?? 'bg-muted-foreground')} />
                          {entry.status}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatNumber(entry.total)} · {Math.round((entry.total / statusTotal) * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Tool usage */}
            <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Tool Usage</h2>
              <p className="mb-4 text-xs text-muted-foreground">Which capabilities are actually being used</p>

              {loading ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : (data?.tool_usage.length ?? 0) === 0 ? (
                <EmptyState
                  className="border-0 py-6"
                  icon={<Wrench className="h-7 w-7" />}
                  title="No tool calls"
                  description="Tool invocations from agent detail panels appear here."
                />
              ) : (
                <ul className="space-y-3">
                  {data!.tool_usage.map((entry) => (
                    <li key={entry.tool} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-foreground">{TOOL_LABELS[entry.tool] ?? entry.tool}</span>
                        <span className="tabular-nums text-muted-foreground">{formatNumber(entry.total)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(entry.total / maxToolUse) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Per-agent */}
          <div className="rounded-2xl border border-primary/10 bg-card/90 shadow-sm backdrop-blur-2xl">
            <div className="border-b border-border p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Agent Performance</h2>
              <p className="text-xs text-muted-foreground">Ranked by run volume</p>
            </div>

            {loading ? (
              <div className="space-y-2 p-5">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : (data?.per_agent.length ?? 0) === 0 ? (
              <EmptyState
                className="m-5 border-0"
                icon={<BarChart3 className="h-8 w-8" />}
                title="No agent activity"
                description="Once agents start running, their comparative performance shows here."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="px-4 py-3 text-xs uppercase tracking-wider">Agent</TableHead>
                      <TableHead className="w-24 px-4 py-3 text-right text-xs uppercase tracking-wider">Runs</TableHead>
                      <TableHead className="w-28 px-4 py-3 text-right text-xs uppercase tracking-wider">Success</TableHead>
                      <TableHead className="w-24 px-4 py-3 text-right text-xs uppercase tracking-wider">Failed</TableHead>
                      <TableHead className="w-28 px-4 py-3 text-right text-xs uppercase tracking-wider">Avg Time</TableHead>
                      <TableHead className="w-28 px-4 py-3 text-right text-xs uppercase tracking-wider">Tokens</TableHead>
                      <TableHead className="w-24 px-4 py-3 text-right text-xs uppercase tracking-wider">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.per_agent.map((row) => (
                      <TableRow key={row.agent_id} className="border-border">
                        <TableCell className="px-4 py-3 font-semibold text-foreground">{row.agent_name}</TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatNumber(row.total_runs)}</TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums">
                          <span className={cn(
                            'font-semibold',
                            row.success_rate === null ? 'text-muted-foreground'
                              : row.success_rate >= 90 ? 'text-emerald-600'
                              : row.success_rate >= 70 ? 'text-amber-600'
                              : 'text-destructive',
                          )}>
                            {formatRate(row.success_rate)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatNumber(row.failures)}</TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatDuration(row.avg_duration_ms)}</TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatNumber(row.tokens)}</TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCost(row.cost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
