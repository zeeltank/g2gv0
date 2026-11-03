'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Bot, CircleCheck, Clock, Eye, History, ListChecks, RefreshCw, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { returnFocusTo } from '@/lib/agent/focus'
import {
  countsText, durationText, EMPTY_FILTERS, filterProblem, formatCost, formatWhen, loadFailure, NO_VALUE, RUN_STATUS_OPTIONS, runsParams, successRate, triggerText, type RunFilters,
} from '@/lib/agent/model'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { AgentApi } from '@/services/agent/api-types'
import { agentService } from '@/services/agent/agent-service'
import type { AgentRunsMeta, AgentRunsSummary, AgentRunSummary } from '@/services/agent/types'
import { AgentRunDetailDialog } from './agent-run-detail'
import { RunStatePill } from './org-agent-parts'

type Phase = 'loading' | 'ready' | 'error' | 'forbidden'

const FIELD = 'h-9 rounded-md border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

/**
 * Agent Run History: every run of an agent in this organisation, from the agent API, newest first. It replaces the demonstration rows this screen used to
 * show. Filter by status and by the day a run started; open a run to see its brief, the proposals and what became of each, the cost and the audit trail.
 * Nothing here runs an agent: a run is started on the organisation's own page (Run agent), and this is the record of it.
 */
export function AgentRunsView({ service = agentService }: { service?: AgentApi }) {
  const context = useMemo(() => getLaravelContext(), [])
  const statusId = useId()
  const fromId = useId()
  const toId = useId()

  const [filters, setFilters] = useState<RunFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState('')
  const [rows, setRows] = useState<AgentRunSummary[]>([])
  const [meta, setMeta] = useState<AgentRunsMeta | null>(null)
  const [summary, setSummary] = useState<AgentRunsSummary | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  const problem = filterProblem(filters)

  // Only the newest read may change what is shown: changing a filter while the last one is still loading must not let its answer replace the new one.
  const latest = useRef(0)

  useEffect(() => {
    if (problem !== null) return
    if (!isLaravelContextReady(context)) {
      queueMicrotask(() => { setError('Your ERP session is unavailable. Please sign in again.'); setPhase('error') })
      return
    }
    const mine = ++latest.current
    queueMicrotask(() => { if (mine === latest.current) setRefreshing(true) })
    service.runs(runsParams(filters, page)).then((response) => {
      if (mine !== latest.current) return
      setRows(response.data)
      setMeta(response.meta)
      setSummary(response.summary)
      setPhase('ready')
      setRefreshing(false)
    }).catch((cause: unknown) => {
      if (mine !== latest.current) return
      const failure = loadFailure(cause, 'The run history could not be read.')
      setError(failure.message)
      setPhase(failure.kind === 'error' ? 'error' : 'forbidden')
      setRefreshing(false)
    })
  }, [context, service, filters, page, problem, attempt])

  const change = (next: Partial<RunFilters>) => {
    setFilters((current) => ({ ...current, ...next }))
    setPage(1)
  }
  const filtered = filters.status !== '' || filters.dateFrom !== '' || filters.dateTo !== ''
  const rate = summary ? successRate(summary) : null

  const show = (id: number, trigger: HTMLElement) => {
    opener.current = trigger
    setOpen(id)
  }
  const close = () => {
    setOpen(null)
    returnFocusTo(opener.current)
  }

  return (
    <div className="@container mx-auto max-w-6xl space-y-6 p-4 @xl:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Agent run history</h1>
            <Badge variant="navy" className="gap-1">
              <History aria-hidden className="size-3" /> Audit log
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Every run of an agent: what it read, what it proposed, what it did on its own, what a person decided, and what it cost.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)} disabled={refreshing} className="gap-1.5 text-xs">
          <RefreshCw aria-hidden className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {phase === 'forbidden' && (
        <p role="alert" className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">{error}</p>
      )}

      {phase === 'error' && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <span><strong>The run history could not be opened.</strong> {error}</span>
          <Button size="sm" variant="outline" onClick={() => { setPhase('loading'); setAttempt((n) => n + 1) }}>Retry</Button>
        </div>
      )}

      {phase === 'loading' && <p role="status" className="text-sm text-muted-foreground">Opening the run history…</p>}

      {phase === 'ready' && summary && meta && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" role="group" aria-label="Summary of all runs">
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Total runs</span>
                <Bot aria-hidden className="size-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground" data-stat="total">{summary.total}</p>
              <p className="mt-1 text-xs text-muted-foreground">Recorded runs, all time</p>
            </div>

            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
                <CircleCheck aria-hidden className="size-4 text-success" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground" data-stat="completed">{summary.completed}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {rate === null ? 'None has finished yet' : `${rate}% of the runs that finished`}
                {summary.failed + summary.unavailable > 0 ? ` · ${summary.failed} failed, ${summary.unavailable} unavailable` : ''}
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Waiting for a person</span>
                <Clock aria-hidden className="size-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground" data-stat="waiting">{summary.proposals_pending}</p>
              <p className="mt-1 text-xs text-muted-foreground">Proposals nobody has decided yet</p>
            </div>

            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Actions applied</span>
                <ListChecks aria-hidden className="size-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground" data-stat="applied">{summary.actions_applied}</p>
              <p className="mt-1 text-xs text-muted-foreground">Notes, tasks and links, by the agent or after a person accepted</p>
            </div>
          </div>
        </>
      )}

      {/* Filters */}
      {(phase === 'ready' || filtered) && phase !== 'forbidden' && (
        <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filter the runs">
          <div className="flex flex-col gap-1">
            <label htmlFor={statusId} className="text-xs font-medium text-muted-foreground">Status</label>
            <select id={statusId} value={filters.status} onChange={(event) => change({ status: event.target.value as RunFilters['status'] })} className={FIELD}>
              {RUN_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={fromId} className="text-xs font-medium text-muted-foreground">Started from</label>
            <Input id={fromId} type="date" size="sm" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(event) => change({ dateFrom: event.target.value })} className="w-40" aria-invalid={problem !== null} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={toId} className="text-xs font-medium text-muted-foreground">Started until</label>
            <Input id={toId} type="date" size="sm" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(event) => change({ dateTo: event.target.value })} className="w-40" aria-invalid={problem !== null} />
          </div>
          {filtered && <Button size="sm" variant="ghost" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1) }}>Clear filters</Button>}
        </div>
      )}
      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
      {phase === 'ready' && <p className="-mt-3 text-xs text-muted-foreground">Days are counted on the server’s clock (UTC); the times in the list are shown in your own time zone.</p>}

      {/* Execution log */}
      {phase === 'ready' && rows.length === 0 && (
        <EmptyState
          title={filtered ? 'No runs match these filters' : 'No agent runs yet'}
          description={filtered ? 'Try a wider range of days, or clear the filters.' : 'Open an organisation and press Run agent. Each run is recorded here.'}
          action={filtered ? <Button size="sm" variant="outline" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1) }}>Clear filters</Button> : undefined}
        />
      )}

      {phase === 'ready' && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-busy={refreshing}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Agent runs, newest first</caption>
              <thead className="border-b border-border bg-muted/60 font-medium text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Run</th>
                  <th scope="col" className="px-4 py-3">Organisation</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Proposals</th>
                  <th scope="col" className="px-4 py-3">Model and cost</th>
                  <th scope="col" className="px-4 py-3">Started</th>
                  <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((run) => (
                  <tr key={run.id} data-run={run.id} className="align-top transition-colors hover:bg-muted/30">
                    <td className="space-y-1 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">#{run.id}</span>
                        <Badge variant="navy" className="gap-1"><Zap aria-hidden className="size-3" /> Organisation agent</Badge>
                      </div>
                      <p className="text-muted-foreground">{triggerText(run.trigger)}{run.user_name ? ` · for ${run.user_name}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{run.subject.name ?? `Organisation #${run.subject.id}`}</td>
                    <td className="space-y-1 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <RunStatePill status={run.status} />
                        <span className="font-mono text-[11px] text-muted-foreground">{durationText(run.started_at, run.finished_at)}</span>
                      </div>
                      {run.status !== 'completed' && run.message && <p className="max-w-xs break-words text-muted-foreground">{run.message}</p>}
                    </td>
                    <td className="px-4 py-3 text-foreground">{countsText(run.proposal_counts)}</td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{run.model ?? NO_VALUE}</p>
                      <p className="text-muted-foreground">{formatCost(run.cost, run.cost_currency)}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatWhen(run.started_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={(event) => show(run.id, event.currentTarget)} className="h-7 gap-1 text-xs" aria-label={`Open run ${run.id}`}>
                        <Eye aria-hidden className="size-3.5" />
                        Trace
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {phase === 'ready' && meta && meta.last_page > 1 && (
        <nav aria-label="Pages of runs" className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {meta.page} of {meta.last_page} ({meta.total} runs)</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={meta.page <= 1 || refreshing} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-7 text-xs">Previous</Button>
            <Button size="sm" variant="outline" disabled={meta.page >= meta.last_page || refreshing} onClick={() => setPage((p) => p + 1)} className="h-7 text-xs">Next</Button>
          </div>
        </nav>
      )}

      <AgentRunDetailDialog runId={open} service={service} onClose={close} />
    </div>
  )
}
