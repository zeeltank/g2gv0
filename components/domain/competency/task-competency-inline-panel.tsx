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
} from '@/services/competency/task-competency-inline'

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
export function TaskCompetencyInlinePanel({
  jobroleTaskId,
  userId,
  readOnly = false,
}: {
  jobroleTaskId: number | null
  userId?: number | null
  readOnly?: boolean
}) {
  const { user } = useAuth()
  const [view, setView] = useState<TaskCompetencyView | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState('')

  const load = useCallback(async () => {
    if (!jobroleTaskId) {
      setView(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setView(await taskCompetencyInlineService.forTask(jobroleTaskId, userId ?? null, getLaravelContext(user)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load what this task exercises.')
    } finally {
      setLoading(false)
    }
  }, [jobroleTaskId, userId, user])

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

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
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

              {/* THE POINT OF SHOWING THIS DURING ASSIGNMENT: whether the work
                  stretches the person or repeats what they can already do. */}
              {userId ? (
                c.rating !== null ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    they are at {c.rating} · {c.items_rated} of {c.items} items rated
                  </span>
                ) : (
                  // UNRATED IS NOT ZERO, and the copy says which it is.
                  <span className="text-xs text-warning">not yet assessed on this</span>
                )
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
