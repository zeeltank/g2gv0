'use client'

/**
 * "How to do this" — the procedure, shown to the person doing the work.
 *
 * The same ESO the Capability screens author, rendered for a different reader.
 * An admin needs to know how much of a role could be automated; an employee
 * needs to know what to do, in what order, and what they must not do.
 *
 * ── THREE STATES, ALL SAID OUT LOUD ─────────────────────────────────────────
 *
 *   no duty     this work item is not linked to a job role duty (a one-off)
 *   no ESO      the duty exists but nobody has written the procedure
 *   an ESO      here it is
 *
 * The first two are NOT the same as an empty panel. A blank "Required controls"
 * heading reads as "there are no controls", which is a claim nobody has made.
 *
 * ── WHAT AN EMPLOYEE IS NOT SHOWN ───────────────────────────────────────────
 *
 * No executability score, no risk class, no automation percentage — the server
 * does not send them. Telling somebody, on the screen where they do their job,
 * that a machine scored 78% on it is a conversation for their manager to have
 * with them, not a badge.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Ban, BookOpen, ChevronDown, Download, ShieldCheck, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskInstructionsService } from '@/services/competency/task-instructions'
import type { TaskInstructions } from '@/services/competency/task-instructions'
import { ACTOR_LABEL, ACTOR_STYLE } from '@/services/competency/eso'

export function TaskInstructionsPanel({ taskId }: { taskId: number }) {
  const [data, setData] = useState<TaskInstructions | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(true)

  const load = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await taskInstructionsService.get(context, taskId)
      setData(response.data ?? null)
      setNote(response.message ?? null)
    } catch (loadError) {
      // Stays null rather than becoming an empty procedure — a failed fetch
      // must never render as "this task has no instructions".
      setError(loadError instanceof Error ? loadError.message : 'Could not load the instructions.')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    queueMicrotask(() => { load() })
  }, [load])

  if (loading) return <Skeleton className="h-28 w-full rounded-xl" />

  if (error) {
    return (
      <section className="rounded-xl border border-danger/30 bg-danger/5 p-4">
        <h3 className="text-sm font-semibold text-danger">Instructions could not be loaded</h3>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>Try again</Button>
      </section>
    )
  }

  if (!data) return null

  /* ── No duty behind this work item ─────────────────────────────────────── */
  if (!data.has_duty) {
    return (
      <section className="rounded-xl border border-dashed p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4" /> How to do this
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {note ?? 'This task is not linked to a standard duty, so there is no written procedure behind it.'}
        </p>
        <Criteria data={data} />
      </section>
    )
  }

  /* ── Duty exists, procedure not written ────────────────────────────────── */
  if (!data.eso) {
    return (
      <section className="rounded-xl border border-dashed p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4" /> How to do this
        </h3>
        {data.duty && (
          <p className="mt-1.5 text-sm">
            <span className="text-muted-foreground">Part of the duty</span>{' '}
            <span className="font-medium">{data.duty.critical_work_function || data.duty.task}</span>
          </p>
        )}
        <p className="mt-1.5 text-sm text-muted-foreground">
          {note ?? 'No written procedure exists for this duty yet.'}
        </p>
        <Criteria data={data} />
      </section>
    )
  }

  const eso = data.eso

  return (
    <section className="rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <BookOpen className="size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">How to do this</span>
            <span className="block truncate text-xs text-muted-foreground">
              {eso.title} · v{eso.version}
            </span>
          </span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-4 border-t p-4">
          {/* NOT THE AGREED PROCEDURE YET — said before the steps, not after.
              Somebody reading downward must meet this before they act on it. */}
          {!eso.is_agreed && (
            <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs font-medium text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                This procedure is <strong>{eso.status}</strong>, not published
                {eso.source === 'ai-generated' && ' and was drafted by AI'}. It is guidance, not
                the agreed way of working — check with your manager before relying on it.
              </span>
            </p>
          )}

          {eso.objective && (
            <div>
              <Label>Why this task exists</Label>
              <p className="text-sm leading-6 text-foreground/80">{eso.objective}</p>
            </div>
          )}

          {eso.expected_outcome && (
            <div>
              <Label>Done means</Label>
              <p className="text-sm leading-6 text-foreground/80">{eso.expected_outcome}</p>
            </div>
          )}

          {data.execution?.mode_meaning && (
            <div>
              <Label>How this work is performed</Label>
              <p className="text-sm leading-6 text-foreground/80">
                {data.execution.mode_meaning}
                {!data.execution.confirmed && (
                  <span className="text-muted-foreground"> (proposed, not yet confirmed)</span>
                )}
              </p>
            </div>
          )}

          {eso.steps.length > 0 && (
            <div>
              <Label>Steps</Label>
              <ol className="space-y-2.5">
                {eso.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold tabular-nums text-muted-foreground">
                      {step.seq ?? i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{step.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {step.actor && (
                          <span className={cn(
                            'rounded-full border px-1.5 py-0.5 text-[10px] font-bold',
                            ACTOR_STYLE[step.actor] ?? 'border-border bg-muted text-muted-foreground',
                          )}>
                            {ACTOR_LABEL[step.actor] ?? step.actor}
                          </span>
                        )}
                        {step.tool && <span className="text-[10px] text-muted-foreground">via {step.tool}</span>}
                        {step.output && <span className="text-[10px] text-muted-foreground">→ {step.output}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {eso.inputs.length > 0 && (
            <div>
              <Label>You will need</Label>
              <ul className="space-y-1">
                {eso.inputs.map((input, i) => (
                  <li key={i} className="text-sm text-foreground/80">
                    <span className="font-medium">{input.name}</span>
                    {input.source && <span className="text-muted-foreground"> — from {input.source}</span>}
                    {input.required === false && <span className="text-muted-foreground"> (optional)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* PROHIBITED IS ITS OWN BLOCK, IN RED. This is the part people skim
              and the part that matters when something has gone wrong. */}
          {eso.prohibited_actions.length > 0 && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-danger">
                <Ban className="size-3.5" /> Never do this
              </p>
              <ul className="space-y-1">
                {eso.prohibited_actions.map((item, i) => (
                  <li key={i} className="text-sm leading-snug text-danger">{item}</li>
                ))}
              </ul>
            </div>
          )}

          {eso.escalation_triggers.length > 0 && (
            <div>
              <Label>Stop and ask for help when</Label>
              <ul className="space-y-1">
                {eso.escalation_triggers.map((item, i) => (
                  <li key={i} className="text-sm text-foreground/80">{item}</li>
                ))}
              </ul>
            </div>
          )}

          {eso.required_controls.length > 0 && (
            <div>
              <Label><ShieldCheck className="mr-1 inline size-3.5" />Must be in place</Label>
              <ul className="space-y-1">
                {eso.required_controls.map((item, i) => (
                  <li key={i} className="text-sm text-foreground/80">{item}</li>
                ))}
              </ul>
            </div>
          )}

          <Criteria data={data} />

          <div className="flex flex-wrap gap-2 border-t pt-3">
            <a href={downloadHref(taskId, 'pdf')} className="inline-flex">
              <Button variant="outline" size="sm" type="button">
                <Download className="mr-1.5 size-3.5" /> Print this procedure
              </Button>
            </a>
            <a href={downloadHref(taskId, 'md')} className="inline-flex">
              <Button variant="outline" size="sm" type="button">
                <Sparkles className="mr-1.5 size-3.5" /> Markdown
              </Button>
            </a>
          </div>
        </div>
      )}
    </section>
  )
}

/** Resolved at click time — a token captured on mount may be stale by now. */
function downloadHref(taskId: number, format: 'md' | 'pdf') {
  const context = getLaravelContext()
  return isLaravelContextReady(context)
    ? taskInstructionsService.downloadUrl(context, taskId, format)
    : '#'
}

/** Acceptance criteria and observation point live on the task, not the ESO. */
function Criteria({ data }: { data: TaskInstructions }) {
  if (!data.acceptance_criteria && !data.observation_point) return null

  return (
    <div className="mt-3 space-y-3">
      {data.acceptance_criteria && (
        <div>
          <Label>Accepted when</Label>
          <p className="text-sm leading-6 text-foreground/80">{data.acceptance_criteria}</p>
        </div>
      )}
      {data.observation_point && (
        <div>
          <Label>Watch for</Label>
          <p className="text-sm leading-6 text-foreground/80">{data.observation_point}</p>
        </div>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}
