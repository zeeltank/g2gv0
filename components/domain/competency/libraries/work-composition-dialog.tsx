'use client'

/**
 * THE WORK COMPOSITION MAP — what a job role's work is actually made of.
 *
 * For one role: how much of it needs a person, how much a person with AI, how
 * much a machine could do with a human check, and how much is already just
 * software. Plus the task-by-task detail behind that, and the approve/override
 * decisions that make it real.
 *
 * ── THE THREE NUMBERS THAT MUST NEVER BE ADDED TOGETHER ─────────────────────
 *
 *   APPROVED     a person confirmed this classification
 *   PROPOSED     a model suggested it and nobody has looked
 *   UNCLASSIFIED nobody has even asked
 *
 * The headline share is computed from APPROVED ONLY, and the other two are
 * shown next to it as what is still outstanding. A demo that presents an
 * unreviewed model opinion as a finding is the single way this feature loses
 * trust permanently, so the screen is built so that it cannot.
 *
 * When nothing is approved yet the headline says so in words rather than
 * showing 0% — zero-approved and zero-automatable are different facts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Check, ClipboardList, Gauge, RefreshCw, ShieldAlert, Sparkles, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { LaravelContext } from '@/lib/laravel-context'
import { isLaravelContextReady } from '@/lib/laravel-context'
import {
  MODE_LABEL, MODE_ORDER, MODE_STYLE, RISK_STYLE, taskExecutionService,
} from '@/services/competency/task-execution'
import type {
  CompositionData, ExecutionMode, RiskClass, TaskExecutionRow,
} from '@/services/competency/task-execution'
import { LoadState, describeFailure } from '../load-state'

export function WorkCompositionDialog({
  jobrole,
  context,
  onClose,
}: {
  jobrole: string | null
  context: LaravelContext
  onClose: () => void
}) {
  const [rows, setRows] = useState<TaskExecutionRow[] | null>(null)
  const [composition, setComposition] = useState<CompositionData | null>(null)
  const [modes, setModes] = useState<Record<string, string>>({})
  /*
   * TWO ERROR STATES, DELIBERATELY.
   *
   * `loadError` means the data never arrived — it takes the whole surface.
   * `actionError` means Classify or Approve failed while the data is still on
   * screen — it belongs beside the list, not instead of it.
   *
   * One shared state put a failed Classify through the same path as a failed
   * load, so a 402 wiped the task list the user was reading. Given the most
   * likely first outcome on a fresh server is a balance or config refusal, that
   * was the single most probable thing to happen in a demo.
   */
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<'classify' | 'approve' | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    if (!jobrole || !isLaravelContextReady(context)) return

    setLoadError(null)
    try {
      const [list, comp] = await Promise.all([
        taskExecutionService.list(context, { jobrole }),
        taskExecutionService.composition(context, jobrole),
      ])
      setRows(list.data ?? [])
      setModes(list.modes ?? {})
      setComposition(comp.data ?? null)
    } catch (err) {
      // Rows stay null, NOT []. An empty array here would render "this role has
      // no tasks" under a failure message — the dead-bell lie this codebase
      // forbids.
      setLoadError(err instanceof Error ? err.message : 'Could not load the work composition.')
    }
  }, [jobrole, context])

  useEffect(() => {
    setRows(null)
    setComposition(null)
    setPicked(new Set())
    setNotice(null)
    setActionError(null)
    queueMicrotask(() => { load() })
  }, [load])

  const proposedIds = useMemo(
    () => (rows ?? [])
      .filter((row) => row.execution_id && row.classification_status !== 'Approved')
      .map((row) => Number(row.execution_id)),
    [rows],
  )

  const run = async (kind: 'classify' | 'approve', task: () => Promise<{ message?: string }>) => {
    setBusy(kind)
    setActionError(null)
    setNotice(null)
    try {
      const response = await task()
      setNotice(response.message ?? 'Done.')
      setPicked(new Set())
      await load()
    } catch (runError) {
      setActionError(runError instanceof Error ? runError.message : 'That did not go through.')
    } finally {
      setBusy(null)
    }
  }

  if (!jobrole) return null

  /*
   * THE HEADLINE COMES STRAIGHT FROM THE SERVER, AND FROM APPROVED ROWS ONLY.
   *
   * An earlier version of this computed the share here by summing the machine
   * modes out of `composition.modes` and dividing by `classified` — which folds
   * unreviewed AI proposals into a number labelled as approved. It read
   * correctly and was wrong, which is the worst combination. The server now
   * counts approved rows separately and returns the share, so there is one
   * answer to this question and it lives where the data does.
   */
  const approvedShare = composition?.automatable_percent ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm" />

      <div role="dialog" aria-modal="true" aria-label={`Work composition for ${jobrole}`}
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">

        {/* Header */}
        <div className="shrink-0 border-b border-border bg-gradient-to-r from-primary/12 via-primary/5 to-transparent p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/20">
                <Gauge className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Work Composition</p>
                <h2 className="truncate text-xl font-black leading-tight text-foreground">{jobrole}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  How this role&apos;s work is executed — and how much of it a machine could take.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                onClick={() => run('classify', () => taskExecutionService.classify(context, jobrole))}
                disabled={busy !== null}
                className="h-9 gap-2 rounded-lg font-bold"
              >
                <Sparkles className="h-4 w-4" />
                {busy === 'classify' ? 'Classifying…' : 'Classify unclassified tasks'}
              </Button>
              <Button variant="outline" onClick={() => void load()} disabled={busy !== null}
                aria-label="Refresh" className="h-9 w-9 rounded-lg p-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-lg p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="g2g-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
          {notice && (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {notice}
            </p>
          )}
          {actionError && (
            /* Beside the data, never instead of it — and with the title, so a
               balance refusal reads as "AI credit is too low" rather than as a
               generic failure. */
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-bold text-destructive">{describeFailure(actionError).title}</p>
              <p className="mt-0.5 text-xs text-destructive/90">{describeFailure(actionError).description}</p>
            </div>
          )}

          {/* ── THE HEADLINE ─────────────────────────────────────────────── */}
          {composition === null && loadError === null ? (
            <Skeleton className="h-44 w-full rounded-2xl" />
          ) : composition ? (
            <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Machine-executable · of approved work
                  </p>
                  {approvedShare === null ? (
                    /* NOT 0%. Nothing is approved, which is a different fact
                       from "none of this can be automated". */
                    <p className="mt-1 max-w-md text-sm font-semibold text-foreground">
                      Nothing approved yet
                      <span className="ml-1 font-normal text-muted-foreground">
                        — approve the proposals below and this becomes a number you can quote.
                      </span>
                    </p>
                  ) : (
                    <>
                      <p className="text-5xl font-black tabular-nums leading-none text-foreground">
                        {approvedShare}<span className="text-2xl text-muted-foreground">%</span>
                      </p>
                      {/* THE DENOMINATOR, ALWAYS. A percentage whose base is
                          invisible is a percentage nobody can check — and here
                          the base is the thing that makes it trustworthy. */}
                      <p className="mt-1 text-xs text-muted-foreground">
                        of the <span className="font-bold tabular-nums text-foreground">{composition.approved}</span>{' '}
                        approved task{composition.approved === 1 ? '' : 's'}
                        {composition.proposed > 0 && (
                          <>
                            {' · '}
                            <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
                              {composition.proposed}
                            </span>{' '}
                            more proposed but unreviewed
                          </>
                        )}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-5">
                  <Figure label="Tasks" value={composition.total_tasks} />
                  <Figure label="Approved" value={composition.approved} tone="good" />
                  <Figure label="Proposed" value={composition.proposed} tone="warn" />
                  <Figure label="Unclassified" value={composition.unclassified} tone="muted" />
                </div>
              </div>

              {/* THE BAR. Every task in the role is on it, including the ones
                  nobody has classified — a bar that only shows classified work
                  makes a half-done role look finished.

                  It shows ALL classifications, approved or not, which is why
                  the caption underneath says so. The headline above does not. */}
              <div className="mt-5">
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                  Every task in the role, by proposed execution mode
                  {composition.proposed > 0 && ' — including the unreviewed proposals'}
                </p>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  {MODE_ORDER.map((mode) => {
                    const n = composition.modes[mode] ?? 0
                    if (n === 0) return null
                    return (
                      <div key={mode} className={cn('h-full', MODE_STYLE[mode]?.bar)}
                        style={{ width: `${n / Math.max(1, composition.total_tasks) * 100}%` }}
                        title={`${MODE_LABEL[mode]}: ${n}`} />
                    )
                  })}
                  {composition.unclassified > 0 && (
                    <div className="h-full bg-muted-foreground/20"
                      style={{ width: `${composition.unclassified / Math.max(1, composition.total_tasks) * 100}%` }}
                      title={`Not classified: ${composition.unclassified}`} />
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {MODE_ORDER.filter((mode) => (composition.modes[mode] ?? 0) > 0).map((mode) => (
                    <span key={mode} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                      <span className={cn('h-2 w-2 rounded-full', MODE_STYLE[mode]?.bar)} />
                      {MODE_LABEL[mode]}
                      <span className="tabular-nums text-foreground">{composition.modes[mode]}</span>
                    </span>
                  ))}
                  {composition.unclassified > 0 && (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                      Not classified
                      <span className="tabular-nums text-foreground">{composition.unclassified}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* EFFORT — only when it is actually known, and it says from how
                  many tasks. A total over an unknown denominator is a number
                  nobody can check. */}
              {composition.effort.tasks_with_estimates > 0 && composition.effort.released_minutes != null && (
                <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-border pt-4">
                  <Figure label="Human minutes today" value={composition.effort.current_minutes ?? 0} />
                  <Figure label="At target" value={composition.effort.target_minutes ?? 0} />
                  <Figure label="Released" value={composition.effort.released_minutes} tone="good" />
                  <p className="max-w-xs text-[11px] text-muted-foreground">
                    From the {composition.effort.tasks_with_estimates} <strong>approved</strong> task
                    {composition.effort.tasks_with_estimates === 1 ? '' : 's'} that carry an estimate
                    {composition.effort.tasks_with_estimates < composition.approved
                      && ` — the other ${composition.approved - composition.effort.tasks_with_estimates} approved task(s) have none`}.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {/* ── THE TASKS ────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">Tasks in this role</p>
                <p className="text-xs text-muted-foreground">
                  Only approved classifications count in the figures above.
                </p>
              </div>

              {proposedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPicked(
                      picked.size === proposedIds.length ? new Set() : new Set(proposedIds),
                    )}
                    className="h-8 rounded-lg text-xs font-bold"
                  >
                    {picked.size === proposedIds.length ? 'Clear' : `Select all ${proposedIds.length} unapproved`}
                  </Button>
                  <Button
                    onClick={() => run('approve', () => taskExecutionService.review(context, {
                      execution_ids: [...picked],
                      decision: 'approve',
                    }))}
                    disabled={busy !== null || picked.size === 0}
                    className="h-8 gap-1.5 rounded-lg text-xs font-bold"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {busy === 'approve' ? 'Approving…' : `Approve ${picked.size}`}
                  </Button>
                </div>
              )}
            </div>

            <LoadState
              error={loadError}
              rows={rows}
              onRetry={load}
              emptyIcon={<ClipboardList className="h-8 w-8" />}
              emptyTitle="This role has no tasks yet"
              emptyDescription="Add tasks on the Job Role Task tab, then classify them here."
              rowHeight="h-16"
            >
              <div className="flex flex-col gap-2">
                {(rows ?? []).map((row) => {
                  const target = row.execution_mode_target as ExecutionMode | null
                  const risk = row.risk_class as RiskClass | null
                  const approved = row.classification_status === 'Approved'
                  const selectable = Boolean(row.execution_id) && !approved

                  return (
                    <div key={row.id} className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 transition-colors',
                      approved ? 'border-emerald-500/25 bg-emerald-500/[0.03]'
                        : target ? 'border-border bg-background/40'
                        : 'border-dashed border-border bg-muted/20',
                    )}>
                      <Checkbox
                        checked={picked.has(Number(row.execution_id))}
                        disabled={!selectable}
                        onCheckedChange={(checked) => {
                          const next = new Set(picked)
                          if (checked) next.add(Number(row.execution_id))
                          else next.delete(Number(row.execution_id))
                          setPicked(next)
                        }}
                        className="mt-1"
                        aria-label={`Select ${row.task}`}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-foreground">{row.task}</p>
                        {row.critical_work_function && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{row.critical_work_function}</p>
                        )}
                        {row.automation_rationale && (
                          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                            {row.automation_rationale}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {target ? (
                          <>
                            <span className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold',
                              MODE_STYLE[target]?.badge,
                            )} title={modes[target]}>
                              {MODE_LABEL[target]}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {risk && (
                                <span className={cn(
                                  'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold',
                                  RISK_STYLE[risk],
                                )}>
                                  {risk === 'Regulated' && <ShieldAlert className="h-2.5 w-2.5" />}
                                  {risk}
                                </span>
                              )}
                              <span className="text-xs font-black tabular-nums text-foreground">
                                {row.ai_executability_score ?? '—'}
                              </span>
                            </div>
                            <span className={cn(
                              'flex items-center gap-1 text-[10px] font-bold',
                              approved ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
                            )}>
                              {approved ? <Check className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                              {approved ? 'Approved' : row.classification_status === 'Human-reviewed' ? 'Changed, not approved' : 'AI proposal'}
                            </span>
                          </>
                        ) : (
                          /* NOT "human only". Nobody has looked at it. */
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            Not classified
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </LoadState>
          </div>
        </div>
      </div>
    </div>
  )
}

function Figure({ label, value, tone = 'default' }: {
  label: string
  value: number
  tone?: 'default' | 'good' | 'warn' | 'muted'
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn(
        'text-2xl font-black tabular-nums leading-tight',
        tone === 'good' ? 'text-emerald-600 dark:text-emerald-400'
          : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
          : tone === 'muted' ? 'text-muted-foreground'
          : 'text-foreground',
      )}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}
