'use client'

/**
 * What you are actually assigning — the duty behind the task.
 *
 * The assign form knows a task title. This says what that title *is*: which
 * duty of the role it belongs to, how that work is meant to be executed, and
 * whether a written procedure exists to hand the person.
 *
 * ── ITS EMPTY STATE IS THE NORMAL STATE ─────────────────────────────────────
 *
 * Measured across 2,253 assigned tasks: 8 reach an execution model. Only one
 * tenant has been classified, and it is not the one doing the most task work.
 * So "not classified yet" is what this panel shows almost every time, and it is
 * written as carefully as the populated case — a blank box would read as "there
 * is nothing here", which is a different claim from "nobody has decided yet".
 */

import { useCallback, useEffect, useState } from 'react'
import { Bot, Gauge, Info, ShieldCheck, User } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskInstructionsService } from '@/services/competency/task-instructions'
import type { TaskInstructions } from '@/services/competency/task-instructions'

/** Modes where the machine does the producing. Purely for which icon to show. */
const MACHINE_MODES = ['ai_human_review', 'ai_supervised', 'ai_autonomous', 'system_automated']

export function TaskDutyContext({ taskId }: { taskId: number | null }) {
  const [data, setData] = useState<TaskInstructions | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!taskId) {
      setData(null)
      return
    }

    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    setLoading(true)
    setFailed(false)
    try {
      const response = await taskInstructionsService.get(context, taskId)
      setData(response.data ?? null)
    } catch {
      /*
       * Silent, and `data` stays null.
       *
       * This is supporting context on a form whose job is creating a task. A
       * red error banner here would suggest the assignment itself is in
       * trouble, which it is not — the panel simply does not render.
       */
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    queueMicrotask(() => { load() })
  }, [load])

  if (!taskId) return null
  if (loading) return <Skeleton className="h-16 w-full rounded-xl" />

  /*
   * ═══════════════════════════════════════════════════════════════════════
   * "NOT LINKED" IS A FACT, NOT A REASON TO RENDER NOTHING
   * ═══════════════════════════════════════════════════════════════════════
   *
   * This used to `return null` for both `failed` and `!has_duty`, so three
   * different situations looked identical to whoever opened the task: the duty
   * loaded fine, the task has no duty, and the request errored. The one that
   * matters most — the link is missing, so this task can never show its
   * procedure — was the most invisible of the three.
   *
   * That silence is why a missing link went unnoticed: an ESO was generated, the
   * task was assigned, and nothing anywhere said the two were not connected.
   */
  if (failed) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-4">
        <p className="text-xs text-muted-foreground">
          The job-role duty for this task could not be checked. This is a loading problem, not a
          statement that the task has none.
        </p>
      </div>
    )
  }

  if (!data || !data.has_duty) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Info className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Not linked to a job-role task
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              This task was written manually rather than picked from the job-role catalogue, so it
              has no execution model and no written procedure — and the person doing it will not see
              one. Assigning it from the catalogue instead is what connects the two.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const mode = data.execution?.mode ?? null
  const machine = mode !== null && MACHINE_MODES.includes(mode)

  return (
    <div className="rounded-xl border border-primary/10 bg-card/60 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Info className="size-4" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            This is a standard duty of the role
          </p>
          {data.duty?.critical_work_function && (
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {data.duty.critical_work_function}
            </p>
          )}

          <div className="mt-2 flex flex-col gap-1.5">
            {/* ── How the work is meant to be performed ─────────────────── */}
            {data.execution ? (
              <span className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
                {machine
                  ? <Bot className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  : <User className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
                <span className="min-w-0 flex-1 text-xs text-foreground">
                  {data.execution.mode_meaning}
                </span>
                {!data.execution.confirmed && (
                  /* An AI proposal nobody has approved. Said in words — the
                     sentence above reads as settled policy otherwise. */
                  <span className="shrink-0 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-warning">
                    proposed
                  </span>
                )}
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border px-3 py-2">
                <Gauge className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs text-muted-foreground">
                  How this work should be executed has not been decided yet — classify it on the
                  Capability screen to see whether it needs a person, a person with AI help, or a machine.
                </span>
              </span>
            )}

            {/* ── Whether a procedure exists to hand over ───────────────── */}
            <span
              className={cn(
                'flex flex-wrap items-center gap-2 rounded-md border px-3 py-2',
                data.has_eso ? 'border-border bg-surface' : 'border-dashed border-border',
              )}
            >
              <ShieldCheck
                className={cn('size-3.5 shrink-0', data.has_eso ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}
                aria-hidden="true"
              />
              <span className={cn('min-w-0 flex-1 text-xs', data.has_eso ? 'text-foreground' : 'text-muted-foreground')}>
                {data.has_eso
                  ? `The person assigned will see a written procedure: “${data.eso?.title}”.`
                  : 'No written procedure exists for this duty, so the person will have only the description and acceptance criteria.'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
