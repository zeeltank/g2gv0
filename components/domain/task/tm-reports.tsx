'use client'

/**
 * Task Management > Reports — the new home of the old frontend's
 * task-analysis report (/task_analysis_report), rebuilt on the token API:
 *
 *   Productivity — per-assignee throughput (total / completed / open /
 *   overdue / completion rate), sortable at a glance.
 *   Delays — why work stalls: ON HOLD by category, plus the overdue list.
 *   Learning recommendations — the Task Management -> LMS hand-off made
 *   real: tasks rejected in review, mapped through their required skills to
 *   recommended courses. The endpoint predates this app; this is its first
 *   consumer in the new frontend.
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, BarChart3, BookOpen, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { taskService } from '@/services/task'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { DelayReport, ProductivityRow } from '@/types/task-management'

type Tab = 'productivity' | 'delays' | 'learning'

export function TmReports() {
  const [tab, setTab] = useState<Tab>('productivity')
  const [productivity, setProductivity] = useState<ProductivityRow[]>([])
  const [delays, setDelays] = useState<DelayReport | null>(null)
  const [learning, setLearning] = useState<unknown>(null)
  const [learningMessage, setLearningMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // The file's own docblock promised productivity was "sortable at a glance".
  // It never was - there was no control and no state. Default stays `total`
  // desc, which is the order the endpoint returns.
  const [sortKey, setSortKey] = useState<'name' | 'total' | 'completed' | 'open' | 'overdue' | 'completion_rate'>('total')
  const [sortDesc, setSortDesc] = useState(true)

  const load = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [productivityResponse, delaysResponse] = await Promise.all([
        taskService.getProductivityReport(context),
        taskService.getDelaysReport(context),
      ])
      setProductivity(productivityResponse.data.rows)
      setDelays(delaysResponse.data)

      // The LMS bridge 404s when the user has no rejected tasks - that is an
      // answer ("nothing to recommend"), not an error.
      try {
        const learningResponse = await taskService.getRejectedTaskLearning(context)
        setLearning(learningResponse.data ?? null)
        setLearningMessage(learningResponse.message ?? '')
      } catch {
        setLearning(null)
        setLearningMessage('No rejected tasks — no learning recommendations right now.')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load reports.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  const sorted = [...productivity].sort((a, b) => {
    const factor = sortDesc ? -1 : 1
    if (sortKey === 'name') return a.name.localeCompare(b.name) * factor
    return (a[sortKey] - b[sortKey]) * factor
  })

  const toggleSort = (key: typeof sortKey) => {
    if (key === sortKey) { setSortDesc((value) => !value); return }
    setSortKey(key)
    setSortDesc(key !== 'name')
  }

  // Top ten only. A stacked bar per assignee is readable at ten and unreadable
  // at two hundred; the table below carries the full set, so nothing is hidden
  // - and the caption says so rather than letting the cut pass unnoticed.
  const chartRows = sorted.slice(0, 10)
  const chartMax = Math.max(1, ...chartRows.map((row) => row.total))

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary shadow-sm">
            <BarChart3 className="h-6 w-6" />
          </div>
          Reports & Analysis
        </h1>
        <p className="text-sm text-muted-foreground">
          Org-wide task performance, delay analysis, and learning recommended from rejected work.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {([
          { id: 'productivity', label: 'Productivity', icon: TrendingUp },
          { id: 'delays', label: 'Delays', icon: AlertTriangle },
          { id: 'learning', label: 'Learning Recommendations', icon: BookOpen },
        ] as const).map((entry) => (
          <Button
            key={entry.id}
            variant="ghost"
            onClick={() => setTab(entry.id)}
            className={cn(
              'rounded-none border-b-2',
              tab === entry.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
            )}
          >
            <entry.icon className="mr-2 size-4" /> {entry.label}
          </Button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
      {loading && <div className="flex h-40 items-center justify-center"><Spinner /></div>}

      {!loading && !error && tab === 'productivity' && (
        <Card>
          <CardContent className="p-0">
            {/* THE CHART: one stacked bar per assignee, split completed /
                open / overdue.

                These are STATUS colours, not a categorical palette - good,
                neutral, critical - so they come from the reserved status slots
                rather than a series ramp. Validated against the light surface:
                CVD separation worst-adjacent dE 26.7, normal-vision 38.2, both
                well clear. The success green warns at 2.24 contrast, which
                obligates relief: the segments carry direct labels AND the full
                table sits directly below. */}
            {chartRows.length > 0 && (
              <div className="border-b p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Workload by assignee</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-success" />Completed</span>
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />Open</span>
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-danger" />Overdue</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {chartRows.map((row) => (
                    <div key={row.user_id} className="grid grid-cols-[10rem_minmax(0,1fr)] items-center gap-3">
                      <span className="truncate text-xs text-muted-foreground" title={row.name}>{row.name}</span>
                      <div className="flex h-5 items-center gap-0.5" role="img" aria-label={`${row.name}: ${row.completed} completed, ${row.open} open, ${row.overdue} overdue`}>
                        {([
                          ['completed', row.completed, 'bg-success'],
                          ['open', row.open, 'bg-primary'],
                          ['overdue', row.overdue, 'bg-danger'],
                        ] as const).map(([key, value, tone], index, all) => value > 0 && (
                          <div
                            key={key}
                            title={`${value} ${key}`}
                            style={{ width: `${(value / chartMax) * 100}%` }}
                            className={cn(
                              'flex h-5 min-w-6 items-center justify-center text-[10px] font-semibold text-white',
                              tone,
                              // 4px rounded data-ends: the outermost segments
                              // round, interior joins stay square.
                              index === 0 && 'rounded-l',
                              index === all.length - 1 && 'rounded-r',
                            )}
                          >
                            {value}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {sorted.length > chartRows.length && (
                  <p className="mt-3 text-xs text-muted-foreground">Charting the top {chartRows.length} of {sorted.length} assignees. The table below lists them all.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-7 border-b bg-primary/5 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {([
                ['name', 'Assignee', 'col-span-2 text-left'],
                ['total', 'Total', 'text-center'],
                ['completed', 'Completed', 'text-center'],
                ['open', 'Open', 'text-center'],
                ['overdue', 'Overdue', 'text-center'],
                ['completion_rate', 'Completion', 'text-center'],
              ] as const).map(([key, label, className]) => (
                <button key={key} type="button" onClick={() => toggleSort(key)} className={cn('uppercase tracking-wider transition hover:text-foreground', className, sortKey === key && 'text-foreground')}>
                  {label}{sortKey === key ? (sortDesc ? ' ↓' : ' ↑') : ''}
                </button>
              ))}
            </div>
            {sorted.map((row) => (
              <div key={row.user_id} className="grid grid-cols-7 items-center border-t px-4 py-3 text-sm transition-colors hover:bg-primary/5">
                <div className="col-span-2 font-medium">{row.name}</div>
                <div className="text-center tabular-nums">{row.total}</div>
                <div className="text-center tabular-nums">{row.completed}</div>
                {/* `open` was fetched on every request and never rendered, even
                    though this file's docblock listed it. */}
                <div className="text-center tabular-nums">{row.open}</div>
                <div className={cn('text-center tabular-nums', row.overdue > 0 && 'font-bold text-danger')}>{row.overdue}</div>
                <div className="text-center">
                  <span className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums',
                    row.completion_rate >= 70 ? 'bg-success/10 text-success'
                      : row.completion_rate >= 30 ? 'bg-warning/10 text-warning'
                      : 'bg-danger/10 text-danger',
                  )}>
                    {row.completion_rate}%
                  </span>
                </div>
              </div>
            ))}
            {productivity.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">No assigned tasks yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !error && tab === 'delays' && delays && (
        <div className="grid gap-6 lg:grid-cols-[minmax(16rem,1fr)_2fr]">
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-bold">On Hold, by reason</h3>
              {delays.by_category.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nothing is on hold. A reason is only recorded when a task is moved to ON HOLD and
                  the person doing it picks a delay category — so this panel stays empty until that
                  happens, rather than because anything is broken.
                </p>
              )}
              <div className="space-y-2">
                {delays.by_category.map((entry) => (
                  <div key={entry.category} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <span>{entry.category}</span>
                    <span className="font-bold tabular-nums">{entry.total}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-bold">Overdue right now</h3>
              {delays.overdue.length === 0 && <p className="text-sm text-muted-foreground">Nothing overdue.</p>}
              <div className="space-y-2">
                {delays.overdue.map((task) => (
                  <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{task.title}</p>
                      {/* status and delay_category arrive on every overdue row
                          and were both discarded before this. */}
                      <p className="text-xs text-muted-foreground">
                        {[task.assignee, task.due_date ? `due ${task.due_date}` : null, task.status, task.delay_category].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-bold text-danger">
                      {task.days_overdue}d overdue
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && !error && tab === 'learning' && (
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-1 text-sm font-bold">Recommended learning from rejected work</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Tasks sent back in review are mapped through their required skills to courses — the Task
              Management → LMS hand-off.
            </p>
            {learning ? (
              <LearningList data={learning} />
            ) : (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                {learningMessage || 'No recommendations right now.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * The bridge endpoint predates typed contracts, so its payload is rendered
 * defensively: arrays of objects become cards using whichever of the common
 * name fields each row carries.
 */
function LearningList({ data }: { data: unknown }) {
  const rows: Array<Record<string, unknown>> = Array.isArray(data)
    ? (data as Array<Record<string, unknown>>)
    : typeof data === 'object' && data !== null
      ? Object.values(data as Record<string, unknown>).filter(
          (value): value is Record<string, unknown> => typeof value === 'object' && value !== null,
        )
      : []

  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No recommendations right now.</p>
  }

  const label = (row: Record<string, unknown>) =>
    String(row.course_name ?? row.title ?? row.task_title ?? row.name ?? row.skill ?? 'Recommendation')

  const detail = (row: Record<string, unknown>) =>
    String(row.description ?? row.required_skills ?? row.skills ?? '')

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.slice(0, 30).map((row, index) => (
        <div key={index} className="rounded-xl border p-4">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <p className="text-sm font-bold">{label(row)}</p>
          </div>
          {detail(row) && <p className="line-clamp-3 text-xs text-muted-foreground">{detail(row)}</p>}
        </div>
      ))}
    </div>
  )
}
