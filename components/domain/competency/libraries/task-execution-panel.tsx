'use client'

/**
 * The Execution card on a job role task — how THIS task gets done.
 *
 * Four things, in the order a reader needs them:
 *   1. the verdict     — the mode, and whether a person has confirmed it
 *   2. the reason      — in words, including any cap the risk class imposed
 *   3. the four scores — what the verdict was built from
 *   4. the decision    — approve it, or override it with a reason
 *
 * ── WHAT THIS SCREEN REFUSES TO DO ──────────────────────────────────────────
 *
 * It never shows an AI proposal as a settled fact. An unreviewed row is labelled
 * as a proposal in its own words, not just a badge colour, because the number
 * next to it - "78% executable by AI" - reads as a measurement whether or not
 * anybody checked it.
 *
 * It never shows an unclassified task as human-only. Nobody has looked at it,
 * and that is a different statement from "a person must do this".
 */

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Bot, Check, Cpu, Gauge, ShieldAlert, Sparkles, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
// The house Select takes `options` + `onChange` — it is NOT the Radix
// trigger/content/item composition. `components/ui/*` is not editable, so this
// follows its API rather than the shape other repos use.
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  MODE_LABEL, MODE_ORDER, MODE_STYLE, RISK_STYLE, taskExecutionService,
} from '@/services/competency/task-execution'
import type {
  ExecutionMode, RiskClass, TaskExecutionRow,
} from '@/services/competency/task-execution'
import { describeFailure } from '../load-state'

/** Each dimension, with what a high number actually means. */
const DIMENSIONS: Array<{
  key: keyof Pick<TaskExecutionRow, 'digital_input' | 'rule_clarity' | 'judgment_required' | 'error_consequence'>
  label: string
  high: string
  /** True when a HIGH score makes the task LESS executable by a machine. */
  inverse?: boolean
}> = [
  { key: 'digital_input', label: 'Digital input', high: 'inputs are already digital and structured' },
  { key: 'rule_clarity', label: 'Rule clarity', high: 'correct execution can be written as rules' },
  { key: 'judgment_required', label: 'Judgement needed', high: 'needs contextual or ethical judgement', inverse: true },
  { key: 'error_consequence', label: 'Cost of error', high: 'expensive to get wrong', inverse: true },
]

export function TaskExecutionPanel({ taskId, jobrole }: { taskId: number; jobrole: string | null }) {
  const [row, setRow] = useState<TaskExecutionRow | null>(null)
  const [modes, setModes] = useState<Record<string, string>>({})
  const [ceiling, setCeiling] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  /** The task carries no job role, so it cannot be classified. Not the same as unclassified. */
  const [noRole, setNoRole] = useState(false)
  /** Signed-out / storage-cleared. Without this the panel span forever on skeletons. */
  const [noContext, setNoContext] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'classify' | 'approve' | 'override' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [overriding, setOverriding] = useState(false)
  const [newMode, setNewMode] = useState<ExecutionMode | ''>('')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      // `loading` starts true, so returning here without clearing it left the
      // panel pulsing skeletons forever with no message and no retry.
      setNoContext(true)
      setLoading(false)
      return
    }
    setNoContext(false)

    setLoading(true)
    setError(null)
    try {
      /*
       * WITHOUT A ROLE THIS CANNOT ANSWER, AND MUST NOT PRETEND TO.
       *
       * The filter is dropped when `jobrole` is null, so the endpoint returns
       * 500 arbitrary rows from across the tenant, this task is not among them,
       * and the card confidently reported "Not classified yet" for a task that
       * may well be classified — with the recovery button hidden. A missing
       * role is its own state and says so.
       */
      if (!jobrole) {
        setRow(null)
        setNoRole(true)
        return
      }
      setNoRole(false)

      // The role's tasks, then this one out of them. There is no single-task
      // endpoint and adding one would be a second answer to the same question.
      const response = await taskExecutionService.list(context, { jobrole })
      setModes(response.modes ?? {})
      setCeiling(response.risk_ceiling ?? {})
      setRow(response.data?.find((r) => Number(r.id) === Number(taskId)) ?? null)
    } catch (loadError) {
      // Row stays as it was; it is NOT set to a blank record, which would
      // render this task as unclassified when the truth is unknown.
      setError(loadError instanceof Error ? loadError.message : 'Could not load the execution model.')
    } finally {
      setLoading(false)
    }
  }, [taskId, jobrole])

  useEffect(() => {
    queueMicrotask(() => { load() })
  }, [load])

  const act = async (
    kind: 'classify' | 'approve' | 'override',
    run: (context: ReturnType<typeof getLaravelContext>) => Promise<{ message?: string }>,
  ) => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    setBusy(kind)
    setError(null)
    setNotice(null)
    try {
      const response = await run(context)
      setNotice(response.message ?? 'Done.')
      setOverriding(false)
      setNote('')
      await load()
    } catch (actError) {
      setError(actError instanceof Error ? actError.message : 'That did not go through.')
    } finally {
      setBusy(null)
    }
  }

  if (error && !row) {
    const { title, description } = describeFailure(error)
    return <ErrorState title={title} description={description} retry={load} />
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (noContext) {
    return (
      <ErrorState
        title="You are not signed in"
        description={'This panel needs your session to read the execution model. '
          + 'Sign in again and reopen this task.'}
        retry={load}
      />
    )
  }

  if (noRole) {
    /* A DIFFERENT FACT FROM "not classified". Classification is per job role,
       so a task with no role attached cannot be classified at all — and saying
       "nobody has decided" would send someone looking for a button that
       cannot work. */
    return (
      <ErrorState
        title="This task has no job role"
        description={'Execution models are decided per job role, so a task that is not '
          + 'attached to one cannot be classified. Set its job role on the Details tab first.'}
      />
    )
  }

  const classified = Boolean(row?.execution_mode_target)
  const status = row?.classification_status ?? null
  const approved = status === 'Approved'
  const target = row?.execution_mode_target as ExecutionMode | undefined
  const risk = (row?.risk_class ?? null) as RiskClass | null
  const cap = risk ? (ceiling[risk] as ExecutionMode | undefined) : undefined

  return (
    <div className="space-y-4">
      {error && (
        /* Through describeFailure, so a balance refusal or a stale backend reads
           as itself rather than as a raw "API Error: 402". */
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-bold text-destructive">{describeFailure(error).title}</p>
          <p className="mt-0.5 text-xs text-destructive/90">{describeFailure(error).description}</p>
        </div>
      )}
      {notice && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {notice}
        </p>
      )}

      {/* ── THE VERDICT ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
        {!classified ? (
          /* NOT "human only". Nobody has looked at this task. */
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Gauge className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">Not classified yet</p>
                <p className="mt-0.5 max-w-lg text-xs text-muted-foreground">
                  Nobody has decided how this task is executed. That is not the same as
                  saying a person must do it — it means the question has not been asked.
                </p>
              </div>
            </div>
            {jobrole && (
              <Button
                onClick={() => act('classify', (context) =>
                  taskExecutionService.classify(context, jobrole))}
                disabled={busy !== null}
                className="h-9 shrink-0 gap-2 rounded-lg font-bold"
              >
                <Sparkles className="h-4 w-4" />
                {busy === 'classify' ? 'Classifying…' : 'Classify this role'}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  target === 'human_only' || target === 'human_ai_assist'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                )}>
                  {target === 'human_only' ? <User className="h-5 w-5" />
                    : target === 'system_automated' ? <Cpu className="h-5 w-5" />
                    : <Bot className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Target execution mode
                  </p>
                  <p className="text-lg font-black leading-tight text-foreground">
                    {target ? MODE_LABEL[target] : '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {target ? modes[target] : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <span className="text-3xl font-black tabular-nums leading-none text-foreground">
                  {row?.ai_executability_score ?? '—'}
                  <span className="text-base font-bold text-muted-foreground">/100</span>
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">AI executability</span>
              </div>
            </div>

            {/* WHAT IT IS TODAY vs WHAT IT COULD BE. Without the first, the
                second is a target with no journey. */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Today</span>
              <ModeBadge mode={row?.execution_mode_current as ExecutionMode | null} />
              <span className="text-muted-foreground">→</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Target</span>
              <ModeBadge mode={target ?? null} />

              {risk && (
                <span className={cn(
                  'ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold',
                  RISK_STYLE[risk],
                )}>
                  <ShieldAlert className="h-3 w-3" /> {risk} risk
                </span>
              )}
            </div>

            {/* THE STATUS, IN WORDS. A badge alone lets an unreviewed number
                read as a measurement. */}
            <p className={cn(
              'mt-3 flex items-start gap-2 rounded-xl border p-3 text-xs font-semibold',
              approved
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
            )}>
              {approved ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              <span>
                {approved
                  ? `Approved by a person${row?.reviewed_at ? ` on ${new Date(row.reviewed_at).toLocaleDateString()}` : ''}. This counts in the work composition.`
                  : status === 'Human-reviewed'
                    ? 'Overridden by a person. It does not count as approved until somebody approves it.'
                    : `Proposed by ${row?.model ?? 'the model'}. Nobody has confirmed it, so it does not count in the work composition yet.`}
              </span>
            </p>
          </>
        )}
      </div>

      {classified && (
        <>
          {/* ── THE REASON ───────────────────────────────────────────────── */}
          {row?.automation_rationale && (
            <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Why</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{row.automation_rationale}</p>
              {cap && target !== cap && (
                <p className="mt-3 text-xs text-muted-foreground">
                  A <strong>{risk}</strong> task can go no further than{' '}
                  <strong>{MODE_LABEL[cap]}</strong>, whatever it scores.
                </p>
              )}
            </div>
          )}

          {/* ── THE FOUR SCORES ──────────────────────────────────────────── */}
          <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              What the score was built from
            </p>
            <div className="mt-3 space-y-3">
              {DIMENSIONS.map((dimension) => {
                const value = row?.[dimension.key]
                return (
                  <div key={dimension.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        {dimension.label}
                        {/* Saying WHICH WAY a dimension points. Without this,
                            "judgement 90" looks like a good score. */}
                        {dimension.inverse && (
                          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            lowers automatability
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-black tabular-nums text-foreground">
                        {value ?? '—'}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', dimension.inverse ? 'bg-amber-500' : 'bg-primary')}
                        style={{ width: `${Math.max(0, Math.min(100, Number(value ?? 0)))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">High means {dimension.high}.</p>
                  </div>
                )
              })}
            </div>

            {(row?.human_effort_current_min != null || row?.human_effort_target_min != null) && (
              <div className="mt-4 flex flex-wrap gap-6 border-t border-border pt-4">
                <Stat label="Human effort today" value={row?.human_effort_current_min} />
                <Stat label="At the target mode" value={row?.human_effort_target_min} />
              </div>
            )}
          </div>

          {/* ── THE DECISION ─────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Your decision</p>

            {!overriding ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => act('approve', (context) =>
                    taskExecutionService.review(context, {
                      execution_ids: [Number(row?.execution_id)],
                      decision: 'approve',
                    }))}
                  disabled={busy !== null || approved || !row?.execution_id}
                  className="h-9 gap-2 rounded-lg font-bold"
                >
                  <Check className="h-4 w-4" />
                  {approved ? 'Already approved' : busy === 'approve' ? 'Approving…' : 'Approve this classification'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setOverriding(true); setNewMode(target ?? '') }}
                  disabled={busy !== null}
                  className="h-9 rounded-lg font-bold"
                >
                  Change it
                </Button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-bold text-foreground">Execution mode</label>
                  <Select
                    value={newMode}
                    onChange={(value) => setNewMode(value as ExecutionMode)}
                    placeholder="Pick a mode"
                    aria-label="Execution mode"
                    className="mt-1"
                    options={MODE_ORDER.map((mode) => ({
                      value: mode,
                      // The full definition, not just the short label — this is
                      // the moment somebody is deciding, so it is the moment
                      // the difference between the modes has to be legible.
                      label: `${MODE_LABEL[mode]} — ${modes[mode] ?? ''}`,
                    }))}
                  />
                  {/* The ceiling, said BEFORE the attempt rather than as a
                      rejection after it. */}
                  {cap && risk && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      This is a <strong>{risk}</strong> task, so it cannot go past{' '}
                      <strong>{MODE_LABEL[cap]}</strong>.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground">
                    Why — required
                  </label>
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    placeholder="What does the model not know about this task?"
                    className="mt-1 rounded-lg text-sm"
                  />
                  {/* Saying WHY the reason is required, not just that it is. */}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    A change without a reason is indistinguishable from a mistake later on.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => act('override', (context) =>
                      taskExecutionService.review(context, {
                        execution_ids: [Number(row?.execution_id)],
                        decision: 'override',
                        execution_mode_target: newMode as ExecutionMode,
                        note,
                      }))}
                    disabled={busy !== null || !newMode || note.trim().length === 0}
                    className="h-9 rounded-lg font-bold"
                  >
                    {busy === 'override' ? 'Saving…' : 'Save the change'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setOverriding(false); setNote('') }}
                    disabled={busy !== null}
                    className="h-9 rounded-lg font-bold"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ModeBadge({ mode }: { mode: ExecutionMode | null }) {
  if (!mode) return <span className="text-xs font-semibold text-muted-foreground">not recorded</span>
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold',
      MODE_STYLE[mode]?.badge,
    )}>
      {MODE_LABEL[mode]}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-black tabular-nums text-foreground">
        {value == null ? '—' : `${value} min`}
      </p>
    </div>
  )
}
