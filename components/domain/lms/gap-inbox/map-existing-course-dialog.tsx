'use client'

/**
 * "Map an existing course" — the inbox's resolve action for one or several
 * flagged competencies at once.
 *
 * THE ONE PLACE THIS WHOLE FEATURE CAN SILENTLY DESTROY DATA, so the sequence
 * is deliberate and must not be shortened:
 *
 *   1. GET /competency/course-map?course_id=N  — the course's CURRENT full
 *      mapping. `POST /competency/course-map` is a SYNC: it deletes any of
 *      the course's existing rows that are absent from `items`. Skipping this
 *      read and posting only the newly-picked competencies would silently
 *      wipe everything else that course already taught.
 *   2. Append the selected competency id(s) that are not already in that
 *      list — never replace, never assume the list was empty.
 *   3. POST the COMPLETE list back.
 *
 * The backend then flips the matching `capability_course_requests` row(s) to
 * `course_created` and assigns the course to everyone who was waiting, on its
 * own — nothing else needs to be called to "finish" the resolution.
 */

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { lmsCatalogService, type CatalogCourse } from '@/services/lms'
import { courseCompetenciesService, type CourseCompetencyInput } from '@/services/competency/course-competencies'

export function MapExistingCourseDialog({
  open,
  onClose,
  competencyIds,
  competencyLabel,
  onMapped,
}: {
  open: boolean
  onClose: () => void
  /** One id for a single row's action, several for a bulk "map selected" action. */
  competencyIds: number[]
  /** What to call the thing being mapped — a competency name, or "3 competencies". */
  competencyLabel: string
  onMapped: () => void
}) {
  const { user } = useAuth()
  const resolveContext = useCallback(() => getLaravelContext(user), [user])

  const [query, setQuery] = useState('')
  const [courses, setCourses] = useState<CatalogCourse[]>([])
  const [selected, setSelected] = useState<CatalogCourse | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ written: number; removed: number } | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setQuery('')
      setCourses([])
      setSelected(null)
      setSaving(false)
      setError(null)
      setResult(null)
    })
  }, [open])

  useEffect(() => {
    if (!open || selected) return
    const timer = setTimeout(() => {
      lmsCatalogService
        .getCourses(resolveContext(), { search: query || undefined, perPage: 20, status: 1 })
        .then((response) => setCourses(response.data ?? []))
        .catch(() => setCourses([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [open, query, selected, resolveContext])

  if (!open) return null

  const handleConfirm = async () => {
    if (!selected) {
      setError('Pick a course first.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const context = resolveContext()

      // Step 1 — read the course's CURRENT full mapping. Never skip this.
      const current = await courseCompetenciesService.list(context, selected.id)
      const currentItems: CourseCompetencyInput[] = (current.data ?? []).map((row) => ({
        competency_id: row.competency_id,
        proficiency_level: row.proficiency_level ?? undefined,
        is_primary: row.is_primary,
      }))
      const currentIds = new Set(currentItems.map((item) => item.competency_id))

      // Step 2 — append only what is missing. A competency already mapped to
      // this course is left exactly as it was (its proficiency_level and
      // is_primary untouched), never duplicated or reset.
      const toAdd = competencyIds.filter((id) => !currentIds.has(id))
      const nextItems: CourseCompetencyInput[] = [
        ...currentItems,
        ...toAdd.map((id) => ({ competency_id: id })),
      ]

      // Step 3 — the one write, with the complete set.
      const saved = await courseCompetenciesService.save(context, selected.id, nextItems)
      setResult({ written: saved.data.written, removed: saved.data.removed })
      onMapped()
    } catch (saveError) {
      setError(
        saveError instanceof Error && saveError.message
          ? saveError.message
          : 'Could not map this course.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Map an existing course</h2>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose} disabled={saving}>
            <X className="size-4" />
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          This maps <span className="font-semibold text-foreground">{competencyLabel}</span> to the
          course you pick. Everyone currently waiting on it gets assigned automatically — nothing
          else to do after this.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {error}
          </div>
        )}

        {result ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success">
              Mapped. {result.written} competenc{result.written === 1 ? 'y' : 'ies'} now on this
              course{result.removed > 0 ? ` (${result.removed} removed because they were not re-sent)` : ''}.
            </div>
            <Button className="self-end font-bold" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">Course</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-9"
                  placeholder="Search courses…"
                  value={selected ? (selected.display_name ?? '') : query}
                  onChange={(event) => {
                    setSelected(null)
                    setQuery(event.target.value)
                  }}
                  disabled={saving}
                />
              </div>
              {!selected && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60">
                  {courses.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No courses found.</p>
                  ) : (
                    courses.map((course) => (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => setSelected(course)}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-muted/40"
                      >
                        <span className="truncate font-medium text-foreground">
                          {course.display_name}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {course.subject_code || course.subject_type}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-border/40 pt-4">
              <Button variant="outline" className="font-bold" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button className="gap-2 font-bold" onClick={() => void handleConfirm()} disabled={saving || !selected}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Map course
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
