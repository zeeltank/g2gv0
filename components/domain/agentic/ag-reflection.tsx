'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  DollarSign,
  Lightbulb,
  Minus,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'
import { useReflection } from '@/hooks/use-agentic'
import type { OptimizationStatus } from '@/services/agentic'

import { formatDateTime } from './shared'

const WINDOWS = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 14 days', value: '14' },
  { label: 'Last 30 days', value: '30' },
]

const CATEGORY_ICON = {
  performance: Zap,
  cost: DollarSign,
  reliability: Shield,
  accuracy: Target,
} as const

const IMPACT_TONE: Record<string, string> = {
  high: 'border-destructive/30 bg-destructive/10 text-destructive',
  medium: 'border-warning/30 bg-warning/10 text-warning',
  low: 'border-primary/30 bg-primary/10 text-primary',
}

const PRIORITY_BORDER: Record<string, string> = {
  high: 'border-destructive/40',
  medium: 'border-warning/40',
  low: 'border-border',
}

/**
 * Reflection System — what is going wrong, and what to do about it.
 *
 * Failure patterns are derived from real run errors each time the page loads,
 * so they change as the agents do. The screen this replaces listed four fixed
 * patterns and five fixed recommendations that were identical for everyone and
 * never moved.
 */
export function AgReflection() {
  const [days, setDays] = useState('7')
  const [statusFilter, setStatusFilter] = useState<'all' | OptimizationStatus>('open')

  const { data, loading, analysing, error, actionMessage, retry, analyse, setOptimizationStatus, clearMessages } =
    useReflection(Number(days))

  const optimizations = (data?.optimizations ?? []).filter(
    (item) => statusFilter === 'all' || item.status === statusFilter,
  )

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reflection System</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Failure analysis and optimisation recommendations, derived from your agents’ actual runs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-40">
            <Select value={days} onChange={setDays} options={WINDOWS} className="h-10 rounded-xl border-border bg-background" aria-label="Analysis window" />
          </div>
          <Button onClick={() => analyse()} disabled={analysing} className="h-10 gap-2 rounded-xl px-4 font-bold shadow-md shadow-primary/20">
            <BrainCircuit className="h-4 w-4" /> {analysing ? 'Analysing…' : 'Run New Analysis'}
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-sm font-medium text-emerald-600">
          <span>{actionMessage}</span>
          <button onClick={clearMessages} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {error ? (
        <ErrorState title="Couldn't load the reflection report" description={error} retry={retry} />
      ) : (
        <>
          {/* Insights */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading
              ? [0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-28 rounded-2xl" />)
              : (data?.insights ?? []).map((insight) => (
                  <div key={insight.metric} className="rounded-2xl border border-primary/10 bg-card/60 p-4 shadow-sm backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{insight.metric}</p>
                      {insight.trend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-600" />}
                      {insight.trend === 'down' && <TrendingDown className="h-4 w-4 text-destructive" />}
                      {insight.trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{insight.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{insight.insight}</p>
                  </div>
                ))}
          </div>

          {/* Failure patterns */}
          <div className="rounded-2xl border border-primary/10 bg-card/90 shadow-sm backdrop-blur-2xl">
            <div className="border-b border-border p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Identified Failure Patterns
              </h2>
              <p className="text-xs text-muted-foreground">
                Grouped from the error messages of failed runs in this window
              </p>
            </div>

            <div className="space-y-3 p-5">
              {loading ? (
                [0, 1].map((index) => <Skeleton key={index} className="h-32 w-full rounded-xl" />)
              ) : (data?.failure_patterns.length ?? 0) === 0 ? (
                <EmptyState
                  className="border-0 py-8"
                  icon={<Shield className="h-8 w-8" />}
                  title="No failures in this window"
                  description="Nothing has gone wrong in the selected period — there is nothing to analyse."
                />
              ) : (
                data!.failure_patterns.map((pattern) => (
                  <div key={pattern.key} className="space-y-3 rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-foreground">{pattern.pattern}</h3>
                          <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', IMPACT_TONE[pattern.impact])}>
                            {pattern.impact} impact
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Occurred {pattern.frequency} {pattern.frequency === 1 ? 'time' : 'times'} in the last {data!.window_days} days
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-primary/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Recommendation</p>
                      <p className="mt-1 text-sm text-foreground">{pattern.recommendation}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-foreground">Affected agents</p>
                        <div className="flex flex-wrap gap-1">
                          {pattern.affected_agents.map((agent) => (
                            <span key={agent} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                              {agent}
                            </span>
                          ))}
                        </div>
                      </div>

                      {pattern.examples.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-foreground">Example errors</p>
                          <ul className="space-y-1">
                            {pattern.examples.map((example, index) => (
                              <li key={index} className="line-clamp-2 rounded bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                                {example}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Optimizations */}
          <div className="rounded-2xl border border-primary/10 bg-card/90 shadow-sm backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Optimisation Recommendations
                </h2>
                <p className="text-xs text-muted-foreground">Generated from the patterns above</p>
              </div>

              <div className="flex rounded-lg bg-muted p-1">
                {(['open', 'applied', 'dismissed', 'all'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-bold capitalize transition-colors',
                      statusFilter === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 p-5">
              {loading ? (
                [0, 1].map((index) => <Skeleton key={index} className="h-32 w-full rounded-xl" />)
              ) : optimizations.length === 0 ? (
                <EmptyState
                  className="border-0 py-8"
                  icon={<Lightbulb className="h-8 w-8" />}
                  title={statusFilter === 'open' ? 'No open recommendations' : `No ${statusFilter} recommendations`}
                  description="Run a new analysis to turn the current failure patterns into suggestions."
                />
              ) : (
                optimizations.map((optimization) => {
                  const Icon = CATEGORY_ICON[optimization.category] ?? Zap

                  return (
                    <div
                      key={optimization.id}
                      className={cn('space-y-3 rounded-xl border-2 p-4', PRIORITY_BORDER[optimization.priority] ?? 'border-border')}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-foreground">{optimization.title}</h3>
                            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold capitalize text-muted-foreground">
                              {optimization.priority} priority
                            </span>
                            <span className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs font-semibold capitalize text-muted-foreground">
                              <Icon className="h-3 w-3" />
                              {optimization.category}
                            </span>
                            <StatusBadge
                              variant={
                                optimization.status === 'applied'
                                  ? 'active'
                                  : optimization.status === 'dismissed'
                                    ? 'inactive'
                                    : 'pending'
                              }
                              label={optimization.status}
                              size="sm"
                            />
                          </div>
                          <p className="text-sm text-muted-foreground">{optimization.description}</p>
                        </div>

                        {/* An applied or dismissed suggestion can be reopened —
                            acting on one is a decision, not a deletion. */}
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {optimization.status === 'open' ? (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => setOptimizationStatus(optimization.id, 'applied')}
                                className="h-8 gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20"
                              >
                                <Check className="h-3.5 w-3.5" /> Apply
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setOptimizationStatus(optimization.id, 'dismissed')}
                                className="h-8 gap-1.5 text-xs font-semibold"
                              >
                                <X className="h-3.5 w-3.5" /> Dismiss
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() => setOptimizationStatus(optimization.id, 'open')}
                              className="h-8 text-xs font-semibold"
                            >
                              Reopen
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 border-t border-border pt-3 text-sm sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Estimated impact</p>
                          <p className="font-medium text-emerald-600">{optimization.estimated_impact ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Implementation</p>
                          <p className="font-medium capitalize text-foreground">{optimization.implementation_complexity}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Affected agents</p>
                          <p className="font-medium text-foreground">
                            {optimization.affected_agents.length > 0 ? optimization.affected_agents.join(', ') : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Last analysis */}
          {data?.last_analysis && (
            <div className="rounded-2xl border border-primary/10 bg-card/60 p-5 shadow-sm backdrop-blur-xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Last Analysis</h2>
              <p className="mb-3 text-xs text-muted-foreground">{formatDateTime(data.last_analysis.created_at)}</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: 'Runs analysed', value: data.last_analysis.runs_analysed },
                  { label: 'Failures found', value: data.last_analysis.failures_found },
                  { label: 'Patterns', value: data.last_analysis.patterns_found },
                  { label: 'Suggestions created', value: data.last_analysis.optimizations_created },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-xl font-bold tabular-nums text-foreground">{stat.value}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
