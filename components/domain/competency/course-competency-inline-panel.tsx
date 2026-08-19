'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { courseCompetenciesService, type CourseCompetency } from '@/services/competency/course-competencies'
import { competencyLibraryService } from '@/services/competency/library'

/**
 * WHAT THIS COURSE BUILDS — inside the course builder.
 *
 * Replaces the standalone Course Competencies screen. The person writing the
 * course knows what it develops; an admin filling a matrix months later is
 * guessing. Same reasoning that moved task competencies into the assign modal.
 *
 * TWO CONSTRAINTS THIS SCREEN MUST RESPECT, both from the API:
 *
 *   1. SAVE IS A SYNC. POST /competency/course-map REPLACES the whole set, so
 *      every write sends the complete list - on an add and on a remove alike.
 *      Sending only the changed row would delete the others, and the write
 *      would succeed while doing it.
 *
 *   2. SAVE REFUSES AN EMPTY LIST (`items` is min:1). So removing the LAST
 *      mapping cannot go through save at all - it has to use DELETE
 *      /competency/course-map/{id}. Routing that case through save would fail
 *      validation and leave the row in place while looking like it worked.
 *
 * NO NEW PRIMITIVE: Button, Select, Skeleton from the design system.
 */
export function CourseCompetencyInlinePanel({
  courseId,
  readOnly = false,
}: {
  courseId: number | null
  readOnly?: boolean
}) {
  const { user } = useAuth()
  const [mapped, setMapped] = useState<CourseCompetency[]>([])
  const [available, setAvailable] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState('')

  const load = useCallback(async () => {
    if (!courseId) { setMapped([]); return }
    setLoading(true)
    setError(null)
    try {
      const context = getLaravelContext(user)
      const [current, library] = await Promise.all([
        courseCompetenciesService.list(context, courseId),
        competencyLibraryService.list(context),
      ])
      setMapped(current.data ?? [])
      setAvailable((library.data ?? []).map((item) => ({ id: item.id, name: item.name })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load what this course builds.')
    } finally {
      setLoading(false)
    }
  }, [courseId, user])

  useEffect(() => { void load() }, [load])

  /** Always sends the FULL set — see constraint 1 above. */
  async function sync(nextIds: number[]) {
    if (!courseId) return
    setSaving(true)
    setError(null)
    try {
      await courseCompetenciesService.save(
        getLaravelContext(user),
        courseId,
        nextIds.map((id) => ({ competency_id: id })),
      )
      await load()
      setPicked('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change was not saved.')
    } finally {
      setSaving(false)
    }
  }

  /** Constraint 2: the last row leaves by DELETE, never by an empty sync. */
  async function drop(row: CourseCompetency) {
    if (!courseId) return
    const remaining = mapped.filter((m) => m.id !== row.id)
    if (remaining.length === 0) {
      setSaving(true)
      setError(null)
      try {
        await courseCompetenciesService.remove(getLaravelContext(user), row.id)
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That change was not saved.')
      } finally {
        setSaving(false)
      }
      return
    }
    await sync(remaining.map((m) => m.competency_id))
  }

  // A CONTROL THAT LOOKS LIVE AND DOES NOTHING IS WORSE THAN ONE THAT SAYS IT
  // IS UNAVAILABLE. The mapping is stored against a course id, and a course
  // that has never been saved does not have one yet.
  if (!courseId) {
    return (
      <p className="text-xs text-muted-foreground">
        Continue to the next step once to save a draft — competencies attach to the saved course,
        so this becomes available as soon as it has been saved once.
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

  const mappedIds = mapped.map((m) => m.competency_id)
  const addable = available.filter((a) => !mappedIds.includes(a.id))

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {mapped.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No competencies are mapped to this course yet. Add one so completing it counts towards
          capability and can close a gap.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {mapped.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
            >
              <span className="text-sm font-medium">{row.competency_name}</span>
              {row.competency_code && (
                <span className="text-xs tabular-nums text-muted-foreground">{row.competency_code}</span>
              )}
              {row.is_primary && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  primary
                </span>
              )}
              {!readOnly && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void drop(row)}
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
            options={addable.map((a) => ({ label: a.name, value: String(a.id) }))}
            value={picked}
            onChange={setPicked}
            placeholder="Add a competency this course builds…"
            searchPlaceholder="Search competencies…"
            emptyMessage="No competency matches that search"
            className="w-72"
            aria-label="Add a competency"
          />
          <Button
            variant="outline"
            disabled={!picked || saving}
            onClick={() => void sync([...mappedIds, Number(picked)])}
            className="h-9 px-3 text-xs font-semibold"
          >
            {saving ? 'Saving…' : 'Add'}
          </Button>
        </div>
      )}

      {!readOnly && (
        <p className="text-xs text-muted-foreground">
          This records what the course develops, so finishing it counts towards capability and can be
          suggested to close a gap.
        </p>
      )}
    </div>
  )
}
