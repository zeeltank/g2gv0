'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  ListTree,
  Search,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAgents, useRunTrace, useRuns } from '@/hooks/use-agentic'
import type { AgentRun } from '@/services/agentic'

import { RunStatusBadge, dash, formatCost, formatDateTime, formatDuration, formatNumber } from './shared'

const ALL = 'all'

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: ALL },
  { label: 'Success', value: 'success' },
  { label: 'Error', value: 'error' },
  { label: 'Running', value: 'running' },
  { label: 'Pending', value: 'pending' },
  { label: 'Cancelled', value: 'cancelled' },
]

/**
 * Run Logs & Traces.
 *
 * The screen this replaces fetched the trace for every run on the page at once,
 * in a loop, to render a tab most users never opened. Here a trace loads only
 * when its run is expanded.
 */
export function AgRunLog() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(ALL)
  const [agentId, setAgentId] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const [expanded, setExpanded] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AgentRun | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const params = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(status !== ALL ? { status } : {}),
      ...(agentId !== ALL ? { agent_id: agentId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      page,
      per_page: 20,
    }),
    [search, status, agentId, from, to, page],
  )

  const { runs, pagination, loading, error, saving, actionMessage, actionError, retry, clearMessages, cancel, remove } =
    useRuns(params)

  // The agent picker needs names only, so it asks for a big page once rather
  // than paginating a dropdown.
  const { agents } = useAgents({ per_page: 200, sort: 'name', direction: 'asc' })

  const { detail: trace, loading: traceLoading } = useRunTrace(expanded)

  const agentOptions = useMemo(
    () => [
      { label: 'All Agents', value: ALL },
      ...agents.map((agent) => ({ label: agent.name, value: String(agent.id) })),
    ],
    [agents],
  )

  const hasFilters = Boolean(search) || status !== ALL || agentId !== ALL || Boolean(from) || Boolean(to)

  const clearAll = () => {
    setSearchInput('')
    setSearch('')
    setStatus(ALL)
    setAgentId(ALL)
    setFrom('')
    setTo('')
    setPage(1)
  }

  const total = pagination?.total ?? 0
  const lastPage = pagination?.last_page ?? 1

  if (pagination && page > pagination.last_page) {
    setPage(pagination.last_page)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const result = await remove(deleteTarget.id)
    if (result.ok) setDeleteTarget(null)
  }

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Run Logs &amp; Traces</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every agent execution, with the step-by-step trace behind it.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-2xl border border-primary/10 bg-card/50 p-4 shadow-sm backdrop-blur-xl">
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search input, output or error text…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="h-10 w-full rounded-xl border-input bg-background/50 pl-9 text-sm"
            aria-label="Search runs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-44">
            <Select value={status} onChange={(value) => { setStatus(value); setPage(1) }} options={STATUS_OPTIONS} className="h-9 rounded-lg border-border bg-background/50" aria-label="Status" />
          </div>
          <div className="w-56">
            <Select value={agentId} onChange={(value) => { setAgentId(value); setPage(1) }} options={agentOptions} className="h-9 rounded-lg border-border bg-background/50" aria-label="Agent" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="run-from">From</label>
            <Input id="run-from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} className="h-9 w-40 border-border bg-background/50" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="run-to">To</label>
            <Input id="run-to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} className="h-9 w-40 border-border bg-background/50" />
          </div>
          {hasFilters && (
            <button onClick={clearAll} className="text-sm font-medium text-primary hover:underline">Clear All</button>
          )}
        </div>
      </div>

      {(actionMessage || actionError) && (
        <div
          className={cn(
            'flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-medium',
            actionError
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600',
          )}
        >
          <span>{actionError || actionMessage}</span>
          <button onClick={clearMessages} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Runs */}
      {error ? (
        <ErrorState title="Couldn't load runs" description={error} retry={retry} />
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          className="border-0"
          icon={<ListTree className="h-10 w-10" />}
          title={hasFilters ? 'No runs match those filters' : 'No runs yet'}
          description={
            hasFilters
              ? 'Try widening the search or clearing the filters.'
              : 'Deploy an agent and start a run — it will appear here with its full trace.'
          }
          action={hasFilters ? <Button variant="outline" onClick={clearAll} className="font-semibold">Clear filters</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const open = expanded === run.id
            const live = run.status === 'running' || run.status === 'pending'

            return (
              <div key={run.id} className="rounded-2xl border border-primary/10 bg-card/90 shadow-sm backdrop-blur-2xl">
                <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : run.id)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    {open ? (
                      <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="text-base font-bold text-foreground">{run.agent_name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <RunStatusBadge status={run.status} size="sm" />
                        <span>·</span>
                        <span>{formatDateTime(run.created_at)}</span>
                        <span>·</span>
                        <span className="capitalize">{run.trigger}</span>
                      </div>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{formatDuration(run.duration_ms)}</span>
                    <span className="flex items-center gap-1.5"><Zap className="h-4 w-4" />{formatNumber(run.tokens_used)}</span>
                    <span className="flex items-center gap-1.5"><DollarSign className="h-4 w-4" />{formatCost(run.cost)}</span>

                    {live && (
                      <Button
                        variant="outline"
                        onClick={() => cancel(run.id)}
                        disabled={saving}
                        className="h-8 gap-1.5 rounded-lg text-xs font-semibold"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(run)}
                      aria-label={`Delete run ${run.id}`}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {(run.input || run.output || run.error_message) && (
                  <div className="space-y-3 border-t border-border px-5 py-4">
                    {run.input && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Input</p>
                        <p className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">{run.input}</p>
                      </div>
                    )}
                    {run.output && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Output</p>
                        <p className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">{run.output}</p>
                      </div>
                    )}
                    {run.error_message && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-destructive">Error</p>
                        <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                          {run.error_message}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Trace — fetched only when the row is expanded. */}
                {open && (
                  <div className="border-t border-border bg-muted/20 px-5 py-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Trace
                    </p>

                    {traceLoading ? (
                      <div className="space-y-2">
                        {[0, 1].map((index) => (
                          <Skeleton key={index} className="h-12 w-full rounded-lg" />
                        ))}
                      </div>
                    ) : (trace?.tasks.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">No trace steps were recorded for this run.</p>
                    ) : (
                      <ol className="space-y-2">
                        {trace!.tasks.map((task) => (
                          <li key={task.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm">
                            <span className="w-6 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                              {task.sequence}
                            </span>
                            <RunStatusBadge status={task.status} size="sm" />
                            <span className="min-w-[130px] shrink-0 text-xs text-muted-foreground">
                              {formatDateTime(task.created_at)}
                            </span>
                            <span className="min-w-0 flex-1 text-foreground">{dash(task.description)}</span>
                            {task.tool && (
                              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                {task.tool}
                              </span>
                            )}
                            {task.duration_ms !== null && (
                              <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(task.duration_ms)}</span>
                            )}
                            {task.error && (
                              <span className="w-full text-xs text-destructive">{task.error}</span>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {lastPage > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-card/60 px-5 py-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{total}</span> runs
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="h-9 font-semibold">
                  Previous
                </Button>
                <span className="px-2 text-sm tabular-nums text-muted-foreground">Page {page} of {lastPage}</span>
                <Button variant="outline" onClick={() => setPage((current) => Math.min(lastPage, current + 1))} disabled={page >= lastPage} className="h-9 font-semibold">
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Delete this run?</DialogTitle>
            <DialogDescription>
              The run and its trace are removed from the log. Analytics for past days will change accordingly.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving} className="font-bold">Cancel</Button>
            <Button onClick={confirmDelete} disabled={saving} className="bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90">
              {saving ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
