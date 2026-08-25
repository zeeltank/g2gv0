'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  taskCompetencyInlineService,
  type TaskCompetencyView,
  type TaskReadinessVerdict,
} from '@/services/competency/task-competency-inline'

/**
 * THE ANSWER AN ASSIGNER IS ACTUALLY LOOKING FOR.
 *
 * `unknown` and `unmapped` are deliberately NEUTRAL rather than warning-
 * coloured. Neither is a finding about the person — one means nobody has
 * assessed them, the other means nobody has mapped the task. Colouring missing
 * paperwork like a shortfall is how a capability system starts making people
 * look incompetent for administrative reasons.
 *
 * And none of them BLOCKS the assignment. A manager may knowingly assign work
 * somebody is not yet cleared for — that is how people develop. The panel
 * informs the decision; it does not take it.
 */
const VERDICT: Record<TaskReadinessVerdict, { label: string; hint: string; className: string }> = {
  cleared: {
    label: 'Capable of this task',
    hint: 'Every competency this task needs is measured at or above the level their role requires.',
    className: 'border-success/30 bg-success/10 text-success',
  },
  not_cleared: {
    label: 'Not yet capable',
    hint: 'At least one competency this task needs is measured below the level their role requires.',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  unknown: {
    label: 'Cannot say yet',
    hint: 'Nothing is known to be short, but something has not been assessed or has no required level set.',
    className: 'border-warning/30 bg-warning/10 text-warning',
  },
  unmapped: {
    label: 'No competencies mapped',
    hint: 'Map what this task exercises below, and capability can be checked.',
    className: 'border-border bg-muted text-muted-foreground',
  },
}

/**
 * "SKILLS REQUIRED", MADE REAL — inside the assign-task modal.
 *
 * Shows what the selected task exercises, where the person being assigned it
 * stands, and lets the assigner map a competency on the spot when none is set.
 *
 * WHY IT IS EDITABLE HERE: the mapping is per-tenant
 * (jobrole_task_competency_map has sub_institute_id) even though the task is a
 * shared catalogue row. A manager editing this describes their own
 * organisation's view, never anyone else's.
 *
 * SAVE IS A SYNC. The service replaces the whole set, so this panel always sends
 * its complete current list — on an add and on a remove alike. Sending only the
 * changed item would delete the others, and the write would succeed while doing
 * it.
 *
 * NO NEW PRIMITIVE: Button, Select, Skeleton from the design system.
 */
/** How many assignees get an individual verdict before the list is summarised. */
const VERDICT_LIMIT = 8

export function TaskCompetencyInlinePanel({
  jobroleTaskId,
  assigneeIds = [],
  assigneeNames = {},
  readOnly = false,
}: {
  jobroleTaskId: number | null
  /**
   * EVERY assignee, not just the first.
   *
   * A task can be assigned to several people at once, and capability is
   * per-person: the bar comes from each one's own job role, so two people on
   * different roles can get different answers about the same task. Checking
   * only the first would quietly clear the rest.
   */
  assigneeIds?: number[]
  /** id → display name, so a verdict can say who it is about. */
  assigneeNames?: Record<number, string>
  readOnly?: boolean
}) {
  const { user } = useAuth()
  const [view, setView] = useState<TaskCompetencyView | null>(null)
  /** One view per assignee, keyed by user id. The mapping is identical across
   *  them; only the verdicts differ. */
  const [perAssignee, setPerAssignee] = useState<Record<number, TaskCompetencyView>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState('')

  // Stable across renders even though the parent rebuilds the array each time.
  const idsKey = assigneeIds.join(',')

  const load = useCallback(async () => {
    if (!jobroleTaskId) {
      setView(null)
      setPerAssignee({})
      return
    }
    setLoading(true)
    setError(null)
    try {
      const ids = idsKey ? idsKey.split(',').map(Number).filter(Boolean) : []
      const checked = ids.slice(0, VERDICT_LIMIT)
      const ctx = getLaravelContext(user)

      // One call per assignee. `allSettled`, because one person's verdict
      // failing must not blank the mapping for everybody else.
      const [base, ...rest] = await Promise.all([
        taskCompetencyInlineService.forTask(jobroleTaskId, checked[0] ?? null, ctx),
        ...checked.slice(1).map((id) => taskCompetencyInlineService.forTask(jobroleTaskId, id, ctx)),
      ])

      setView(base)
      const byUser: Record<number, TaskCompetencyView> = {}
      if (checked[0]) byUser[checked[0]] = base
      rest.forEach((v, i) => { const id = checked[i + 1]; if (id) byUser[id] = v })
      setPerAssignee(byUser)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load what this task exercises.')
    } finally {
      setLoading(false)
    }
  }, [jobroleTaskId, idsKey, user])

  useEffect(() => {
    void load()
  }, [load])

  /** Always sends the FULL set — see the sync note above. */
  async function sync(nextIds: number[]) {
    if (!jobroleTaskId) return
    setSaving(true)
    setError(null)
    try {
      await taskCompetencyInlineService.save(jobroleTaskId, nextIds, getLaravelContext(user))
      // RE-READ rather than patch local state: the server is the authority on
      // what was stored, and the ratings come back with it.
      await load()
      setPicked('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change was not saved.')
    } finally {
      setSaving(false)
    }
  }

  if (!jobroleTaskId) {
    return (
      <p className="text-xs text-muted-foreground">
        Pick a task to see which capabilities it builds.
      </p>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  const current = view?.competencies ?? []
  const currentIds = current.map((c) => c.id)
  const addable = (view?.available ?? []).filter((a) => !currentIds.includes(a.id))

  /**
   * One verdict row per assignee we actually got an answer for.
   *
   * Filtered on `readiness` being present rather than on the assignee list, so
   * a person whose check failed to load is simply absent rather than rendered
   * with a verdict the server never gave.
   */
  const verdictRows = assigneeIds
    .map((id) => ({ id, name: assigneeNames[id] ?? `Employee #${id}`, v: perAssignee[id] }))
    .filter((r): r is { id: number; name: string; v: TaskCompetencyView } => Boolean(r.v?.readiness))

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* THE VERDICTS, FIRST — before the list that produced them, because this
          is what the assigner is deciding on. One per person: the bar is their
          own role's, so the same task can be cleared for one assignee and not
          for another. */}
      {verdictRows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {verdictRows.map(({ id, name, v }) => {
            const style = VERDICT[v.readiness!]
            const s = v.readiness_summary
            return (
              <div key={id} className={`rounded-md border px-3 py-2 ${style.className}`}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold">{name}</span>
                  <span className="text-sm font-semibold">— {style.label}</span>
                </div>
                <p className="mt-0.5 text-xs opacity-90">{style.hint}</p>
                {s && s.total > 0 && (
                  <p className="mt-1 text-xs tabular-nums opacity-90">
                    {s.met} of {s.total} met
                    {s.below > 0 && ` · ${s.below} below`}
                    {s.unknown > 0 && ` · ${s.unknown} not assessed`}
                    {/* Called out separately: an average can clear the bar
                        while a mandatory competency inside it does not. */}
                    {s.mandatory_below > 0 && ` · ${s.mandatory_below} of them mandatory`}
                  </p>
                )}
              </div>
            )
          })}

          {/* Truncation is STATED. A silently capped list reads as "everyone
              else is fine", which is the one thing it does not mean. */}
          {assigneeIds.length > VERDICT_LIMIT && (
            <p className="text-xs text-muted-foreground">
              Showing the first {VERDICT_LIMIT} of {assigneeIds.length} assignees. The rest were not
              checked — open the task again with fewer people selected to see them.
            </p>
          )}
        </div>
      )}

      {current.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {view?.empty_reason ??
            'No competencies are mapped to this task yet. Add one so this work counts towards capability.'}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {current.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
            >
              <span className="text-sm font-medium">{c.name}</span>

              {c.is_mandatory && (
                <span className="rounded bg-destructive/10 px-1 text-[9px] font-bold uppercase text-destructive">
                  Mandatory
                </span>
              )}

              {/* THE POINT OF SHOWING THIS DURING ASSIGNMENT: whether the work
                  stretches the person or repeats what they can already do —
                  and whether they clear the bar their role sets.

                  ONLY WITH A SINGLE ASSIGNEE. `view` carries one person's
                  numbers; printing them under a list of several people would
                  attribute one person's rating to everyone selected. With more
                  than one, the per-person verdicts above carry the answer and
                  this list is just the mapping. */}
              {verdictRows.length === 1 ? (
                <span className="flex flex-wrap items-center gap-x-2 text-xs tabular-nums">
                  {/* The bar. It comes from the assignee's ROLE, not the task. */}
                  {c.required !== null ? (
                    <span className="text-muted-foreground">needs L{c.required}</span>
                  ) : (
                    <span className="text-muted-foreground">no level set by their role</span>
                  )}

                  {/* UNRATED IS NOT ZERO, and the copy says which it is. */}
                  {c.rating !== null ? (
                    <span className="text-muted-foreground">· at {c.rating}</span>
                  ) : (
                    <span className="text-warning">· not yet assessed</span>
                  )}

                  {c.state === 'below' && c.shortfall !== null && (
                    <span className="font-semibold text-destructive">· short by {c.shortfall}</span>
                  )}
                  {c.state === 'met' && <span className="font-semibold text-success">· met</span>}

                  {/* A level drawn from part of a competency must not read as a
                      complete measurement. */}
                  {c.rating !== null && c.coverage > 0 && c.coverage < 1 && (
                    <span className="text-warning">· {Math.round(c.coverage * 100)}% measured</span>
                  )}
                </span>
              ) : null}

              {!readOnly && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void sync(currentIds.filter((id) => id !== c.id))}
                  className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && addable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect
            options={addable.map((a) => ({ label: a.name, value: String(a.id), hint: a.code }))}
            value={picked}
            onChange={setPicked}
            placeholder="Add a competency this task builds…"
            searchPlaceholder="Search competencies…"
            emptyMessage="No competency matches that search"
            className="w-72"
            aria-label="Add a competency"
          />
          <Button
            variant="outline"
            disabled={!picked || saving}
            onClick={() => void sync([...currentIds, Number(picked)])}
            className="h-9 px-3 text-xs font-semibold"
          >
            {saving ? 'Saving…' : 'Add'}
          </Button>
        </div>
      )}

      {!readOnly && (
        <p className="text-xs text-muted-foreground">
          This applies to your organisation only. It records what the task develops, so completing it
          counts towards capability.
        </p>
      )}
    </div>
  )
}
