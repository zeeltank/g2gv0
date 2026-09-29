'use client'

/**
 * The Scheduler console.
 *
 * What this application runs on a timer, when each will next run, and — once the run
 * ledger exists — when each last did.
 *
 * ── WHY THIS SCREEN IS WORTH HAVING AT ALL ──────────────────────────────────
 *
 * `routes/console.php` carries a note about `app/Console/Kernel.php`, whose `schedule()`
 * has never run on Laravel 11+: three tasks were written there and silently never
 * registered, and `events:project` was believed to be draining the event store every
 * five minutes while in fact only running when somebody typed it. That went unnoticed
 * because nothing in the product showed what was scheduled. This is that thing.
 *
 * It reads the live schedule rather than a list copied from that file, so the same class
 * of mistake cannot hide here.
 */

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { describePlatformError } from '@/lib/platform/client'
import {
  fetchScheduledTasks,
  runTaskNow,
  saveScheduleOverride,
  type RunNowResult,
  type SchedulerPayload,
} from '@/lib/platform/scheduler'
import { fetchPlatformRegistry, type PlatformRegistryPayload } from '@/lib/platform/workflow'
import { isDecentralizedModule } from '@/lib/platform/access-links'

import { PanelError, PanelLoading, RefreshButton, StaleNotice } from '../_components/console-parts'
import { ServiceShell } from '../_components/ServiceShell'

export default function SchedulerPage() {
  return (
    <Suspense fallback={null}>
      <SchedulerConsole />
    </Suspense>
  )
}

function SchedulerConsole() {
  /** `?module=hrms` etc. — the decentralized tab, pinned to one module. */
  const rawModuleKey = useSearchParams().get('module')
  const moduleKey = isDecentralizedModule(rawModuleKey) ? rawModuleKey : null

  const [data, setData] = useState<SchedulerPayload | null>(null)
  const [registry, setRegistry] = useState<PlatformRegistryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)

  /*
   * The effect sets state only from the promise callbacks, never synchronously in its
   * body. `setLoading(true)` lives in `reload()` below — an event handler — because a
   * synchronous setState inside an effect triggers a second render pass before the
   * first has committed. The AI console's loaders are written the same way.
   */
  useEffect(() => {
    let cancelled = false

    Promise.all([fetchScheduledTasks(moduleKey ?? undefined), fetchPlatformRegistry()])
      .then(([next, reg]) => {
        if (cancelled) return
        setData(next)
        setRegistry(reg)
        setError(null)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(describePlatformError(cause, 'The scheduled tasks could not be loaded.'))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, moduleKey])

  const reload = useCallback(() => {
    setLoading(true)
    setToken((value) => value + 1)
  }, [])

  const [saving, setSaving] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [runResults, setRunResults] = useState<Record<string, RunNowResult>>({})

  /**
   * Run one tenant-scoped task now, for this organisation.
   *
   * The result is kept per task_key rather than in one shared slot, so running task A
   * does not blank out what task B's last manual run reported. `reload()` afterward is
   * what makes the ledger writer's own effect visible — "Last run" below updates from
   * the same row this action just wrote, not from a value this component invents.
   */
  const runNow = useCallback(async (taskKey: string) => {
    setRunning(taskKey)
    setRunResults((current) => {
      const next = { ...current }
      delete next[taskKey]
      return next
    })

    try {
      const result = await runTaskNow(taskKey)
      setRunResults((current) => ({ ...current, [taskKey]: result }))
      setToken((value) => value + 1)
    } catch (cause: unknown) {
      setError(describePlatformError(cause, 'The task could not be run.'))
    } finally {
      setRunning(null)
    }
  }, [])

  /**
   * Switch a task off for this organisation, or back on.
   *
   * Turning it back on RESETS rather than writing `disabled: false`: no row means
   * "follow the shipped schedule", which is what somebody re-enabling a task
   * wants. Writing a row with the current expression would freeze today's
   * schedule for them, so a later improvement to it would silently never arrive.
   */
  const toggle = useCallback(
    async (task: SchedulerPayload['tasks'][number]) => {
      if (!task.task_key) return

      setSaving(task.task_key)

      try {
        await saveScheduleOverride(
          task.disabled_here
            ? { task_key: task.task_key, reset: true }
            : { task_key: task.task_key, disabled: true },
        )
        setToken((value) => value + 1)
      } catch (cause: unknown) {
        setError(describePlatformError(cause, 'The change could not be saved.'))
      } finally {
        setSaving(null)
      }
    },
    [],
  )

  return (
    <ServiceShell slug="scheduler">
      <div className="mt-6 space-y-4">
        {error && data === null && <PanelError message={error} onRetry={reload} />}
        {error && data !== null && <StaleNotice message={error} onRetry={reload} />}
        {loading && data === null && !error && <PanelLoading label="Reading the schedule…" />}

        {data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {data.summary.total} scheduled task{data.summary.total === 1 ? '' : 's'}
                {data.summary.failing > 0 && ` — ${data.summary.failing} failing`}
              </p>
              <RefreshButton onClick={reload} busy={loading} />
            </div>

            {/* A page-level banner, in addition to the per-row red text below — the
                summary line above already counts failures, but a count is easy to skim
                past. This is the same `last_run_status === 'failed'` fact, said once,
                prominently, rather than a second source of truth. */}
            {data.ledger_installed && data.summary.failing > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
                <span className="font-semibold">
                  {data.summary.failing} scheduled task{data.summary.failing === 1 ? '' : 's'} failed
                  {data.summary.failing === 1 ? ' its' : ' their'} last run.
                </span>{' '}
                See &ldquo;Last run&rdquo; below for which, and open a tenant-scoped one to run it
                again now.
              </div>
            )}

            {/* The ledger notice leads, because without it every "Last run" cell below
                is blank and a reader would reasonably conclude nothing has ever run. */}
            {!data.ledger_installed && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
                <span className="font-medium text-foreground">Last-run times are not recorded yet.</span>{' '}
                Nothing writes a ledger when a scheduled task finishes, so &ldquo;Last run&rdquo; below
                is unknown rather than never. The schedule itself, and when each task next runs, are
                read live and are accurate.
              </div>
            )}

            {/* A DECENTRALIZED TAB IS ALREADY PINNED — the server only returned
                this module's tasks. Zero tasks for a real module (Talent and LMS
                declare none today) is the honest empty state, not an error. */}
            {moduleKey ? (
              data.tasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing is scheduled for this module yet.
                </p>
              ) : (
                <TaskTable
                  tasks={data.tasks}
                  saving={saving}
                  onToggle={toggle}
                  onRunNow={runNow}
                  running={running}
                  runResults={runResults}
                />
              )
            ) : (
              <div className="space-y-5">
                {orderedTaskModuleKeys(data.tasks, registry?.modules ?? []).map((moduleKey) => {
                  const moduleTasks = data.tasks.filter((task) => (task.module ?? '_uncatalogued') === moduleKey)

                  return (
                    <div key={moduleKey}>
                      <h3 className="mb-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                        {moduleKey === '_uncatalogued' ? (
                          <span>Not catalogued</span>
                        ) : (
                          <Link
                            href={`/platform-services/scheduler?module=${moduleKey}`}
                            className="hover:text-foreground hover:underline"
                          >
                            {taskModuleLabel(moduleKey, registry?.modules ?? [])}
                          </Link>
                        )}{' '}
                        <span className="font-normal normal-case text-muted-foreground/70">
                          ({moduleTasks.length})
                        </span>
                      </h3>

                      <TaskTable
                        tasks={moduleTasks}
                        saving={saving}
                        onToggle={toggle}
                        onRunNow={runNow}
                        running={running}
                        runResults={runResults}
                      />
                    </div>
                  )
                })}
              </div>
            )}

            {/* Estate-wide, and labelled as such. `jobs` and `failed_jobs` carry no
                tenant column, so presenting these as this organisation's numbers would
                be showing somebody else's. */}
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-card-foreground">Queue</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Connection <span className="font-mono">{data.queue.connection}</span>. These counts
                are for the whole installation, not just this organisation — the queue tables carry
                no organisation column.
              </p>
              <dl className="mt-3 flex flex-wrap gap-6">
                <div>
                  <dt className="text-xs text-muted-foreground">Pending jobs</dt>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">
                    {data.queue.pending ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Failed jobs</dt>
                  <dd
                    className={`text-lg font-semibold tabular-nums ${
                      (data.queue.failed ?? 0) > 0 ? 'text-destructive' : 'text-foreground'
                    }`}
                  >
                    {data.queue.failed ?? '—'}
                  </dd>
                </div>
              </dl>
            </section>
          </>
        )}
      </div>
    </ServiceShell>
  )
}

/**
 * Unknown and never are different answers, and the difference is the whole point of
 * `available.last_run`.
 */
function LastRun({ task }: { task: SchedulerPayload['tasks'][number] }) {
  if (!task.available.last_run) {
    return (
      <span className="text-muted-foreground/60" title="No run ledger exists yet.">
        Not recorded
      </span>
    )
  }

  return (
    <span className={task.last_run_status === 'failed' ? 'text-destructive' : undefined}>
      {task.last_run_at ? new Date(task.last_run_at).toLocaleString() : '—'}
      {task.last_run_status === 'failed' && ' — failed'}
    </span>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase">
      {children}
    </th>
  )
}

/** The table body, extracted so both the scoped (one module) and central (grouped by
    module) views render identical rows rather than two copies of this markup. */
function TaskTable({
  tasks,
  saving,
  onToggle,
  onRunNow,
  running,
  runResults,
}: {
  tasks: SchedulerPayload['tasks']
  saving: string | null
  onToggle: (task: SchedulerPayload['tasks'][number]) => void
  onRunNow: (taskKey: string) => void
  running: string | null
  runResults: Record<string, RunNowResult>
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[54rem] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-muted/50">
            <Th>Task</Th>
            <Th>Schedule</Th>
            <Th>Next run</Th>
            <Th>Last run</Th>
            <Th>Guards</Th>
            <Th>This organisation</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tasks.map((task) => (
            <tr
              key={task.key}
              className={`transition-colors hover:bg-muted/40 ${
                task.last_run_status === 'failed' ? 'bg-destructive/5' : ''
              }`}
            >
              <td className="px-3 py-3 align-top">
                <p className="font-mono text-xs font-medium text-card-foreground">{task.key}</p>
                {task.description && (
                  <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                    {task.description}
                  </p>
                )}
              </td>
              <td className="px-3 py-3 align-top">
                {/* The sentence is a convenience; the expression is the truth,
                    so both are shown and the expression is never omitted. */}
                {task.describes && <p className="text-xs">{task.describes}</p>}
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {task.expression}
                </p>
              </td>
              <td className="px-3 py-3 align-top text-xs whitespace-nowrap tabular-nums">
                {task.next_run_at ? (
                  new Date(task.next_run_at).toLocaleString()
                ) : (
                  <span className="text-muted-foreground/60" title="The expression could not be parsed.">
                    &mdash;
                  </span>
                )}
              </td>
              <td className="px-3 py-3 align-top text-xs whitespace-nowrap">
                <LastRun task={task} />
              </td>
              <td className="px-3 py-3 align-top">
                <div className="flex flex-wrap gap-1">
                  {task.without_overlapping && <Guard>no overlap</Guard>}
                  {task.on_one_server && <Guard>one server</Guard>}
                  {task.in_background && <Guard>background</Guard>}
                </div>
              </td>
              <td className="px-3 py-3 align-top">
                <TenantControl
                  task={task}
                  onToggle={onToggle}
                  busy={saving === task.task_key}
                  onRunNow={onRunNow}
                  running={task.task_key !== null && running === task.task_key}
                  runResult={task.task_key ? runResults[task.task_key] : undefined}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A task's module, labelled from the registry — matching Workflow's own grouping. */
function taskModuleLabel(key: string, modules: PlatformRegistryPayload['modules']): string {
  return modules.find((m) => m.key === key)?.label ?? key
}

/** Modules with at least one task, registry order, then any module the registry does not
    declare, then `_uncatalogued` last for events the catalogue does not describe at all. */
function orderedTaskModuleKeys(
  tasks: SchedulerPayload['tasks'],
  modules: PlatformRegistryPayload['modules'],
): string[] {
  const present = new Set(tasks.map((t) => t.module ?? '_uncatalogued'))

  return [
    ...modules.map((m) => m.key).filter((key) => present.has(key)),
    ...Array.from(present).filter(
      (key) => key !== '_uncatalogued' && !modules.some((m) => m.key === key),
    ),
    ...(present.has('_uncatalogued') ? ['_uncatalogued'] : []),
  ]
}

/**
 * Whether this organisation can change a task, and the control if it can.
 *
 * ── THE REASON IS SHOWN, NOT JUST THE ABSENCE ───────────────────────────────
 *
 * Four of the six tasks cannot be scheduled per organisation, because one pass
 * covers every tenant. A greyed-out switch would leave somebody guessing whether
 * it was a permission problem, a bug, or something they could fix by asking. The
 * sentence says which.
 */
function TenantControl({
  task,
  onToggle,
  busy,
  onRunNow,
  running,
  runResult,
}: {
  task: SchedulerPayload['tasks'][number]
  onToggle: (task: SchedulerPayload['tasks'][number]) => void
  busy: boolean
  onRunNow: (taskKey: string) => void
  running: boolean
  runResult: RunNowResult | undefined
}) {
  if (!task.tenant_scoped) {
    return (
      <span className="block max-w-[14rem] text-[11px] leading-4 text-muted-foreground">
        Runs for the whole installation.{' '}
        {task.estate_reason && <span className="opacity-80">{task.estate_reason}</span>}
      </span>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onToggle(task)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
          {task.disabled_here ? 'Switch on' : 'Switch off'}
        </button>

        {/* Disabled here as well as tenant-scoped: a task switched off for this
            organisation should not be runnable through the back door this button
            would otherwise be. */}
        {task.task_key && !task.disabled_here && (
          <button
            type="button"
            onClick={() => onRunNow(task.task_key as string)}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            title="Run this task now, for this organisation, and record it in the ledger below."
          >
            {running && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
            Run now
          </button>
        )}
      </div>

      {task.disabled_here ? (
        <span className="block text-[11px] text-amber-600 dark:text-amber-400">
          Off for this organisation
        </span>
      ) : task.overridden ? (
        <span className="block text-[11px] text-muted-foreground">
          Custom schedule (ships as{' '}
          <span className="font-mono">{task.shipped_expression}</span>)
        </span>
      ) : (
        <span className="block text-[11px] text-muted-foreground">On, shipped schedule</span>
      )}

      {runResult && (
        <div
          className={`max-w-[16rem] rounded border px-2 py-1.5 text-[11px] leading-4 ${
            runResult.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          <p className="font-medium">
            {runResult.ok ? 'Ran successfully.' : `Failed (exit ${runResult.exit_code}).`}
          </p>
          {runResult.output && (
            <p className="mt-0.5 line-clamp-3 font-mono opacity-90">{runResult.output}</p>
          )}
        </div>
      )}
    </div>
  )
}

function Guard({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {children}
    </span>
  )
}
