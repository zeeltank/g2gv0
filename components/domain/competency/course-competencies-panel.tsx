'use client'

/**
 * COURSE COMPETENCIES — the screen that fills `course_competency_map`.
 *
 * THE TABLE HAD TWO SHIPPED CONSUMERS AND NO WRITER. LearningAssigner and
 * RemediationRecommender have both been reading 56 seeded rows since they landed,
 * because course creation writes `sub_std_map` and stops. This panel is the first
 * thing in the product that can add a 57th.
 *
 * SYNC, NOT APPEND. The endpoint deletes rows absent from the payload, so this
 * always sends the course's complete list and reports the removal count back. A
 * competency dropped from a course must stop being recommended for it.
 *
 * IT UNBLOCKS THE MECHANISM, NOT THE OUTCOME. There are 96 courses platform-wide
 * and none in most tenants. A tenant with no courses sees an empty picker and the
 * two consumers stay dark — the same shape as Role Requirements and the composer.
 * The empty state says so plainly rather than implying something is broken.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save, AlertTriangle, Loader2, GraduationCap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  courseCompetenciesService,
  type CourseCompetency,
  type CourseCompetencyInput,
} from '@/services/competency/course-competencies'
import { competencyDefinitionsService } from '@/services/competency/definitions'
import { lmsCatalogService, type CatalogCourse } from '@/services/lms/catalog'

interface DraftRow {
  id: number | null
  competency_id: number
  competency_name: string
  proficiency_level: number | null
  is_primary: boolean
}

const LEVELS = [1, 2, 3, 4, 5]

export function CourseCompetenciesPanel() {
  const { user } = useAuth()

  const [courses, setCourses] = useState<{ id: number; title: string }[]>([])
  const [competencies, setCompetencies] = useState<{ id: number; name: string }[]>([])
  const [courseId, setCourseId] = useState<number | null>(null)

  const [rows, setRows] = useState<DraftRow[]>([])
  const [emptyIsExpected, setEmptyIsExpected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [addId, setAddId] = useState('')

  const canEdit = user?.role === 'admin' || user?.role === 'hr'

  /* -- Sources -------------------------------------------------------- */
  useEffect(() => {
    const ctx = getLaravelContext(user)
    if (!isLaravelContextReady(ctx)) return

    lmsCatalogService.getCourses(ctx, { perPage: 200 })
      .then((res) => {
        // TYPED, NOT CAST. tsc rejected `as Record<string, unknown>[]` because
        // CatalogCourse does not overlap it - and the compiler was right: the
        // title field is `display_name`, not `title`, so the cast would have
        // produced a list of empty labels that filtered itself to zero and
        // looked like "this tenant has no courses".
        setCourses((res?.data ?? [])
          .map((c) => ({ id: Number(c.id), title: (c.display_name ?? c.short_name ?? '').trim() }))
          .filter((c) => c.id && c.title))
      })
      .catch(() => setCourses([]))

    competencyDefinitionsService.list(ctx)
      .then((res) => setCompetencies((res?.data ?? []).map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setCompetencies([]))
  }, [user])

  /* -- One course's current list -------------------------------------- */
  const load = useCallback(async (id: number) => {
    const ctx = getLaravelContext(user)
    if (!isLaravelContextReady(ctx)) return
    setLoading(true); setError(null); setNotice(null)
    try {
      const res = await courseCompetenciesService.list(ctx, id)
      setRows((res?.data ?? []).map((r: CourseCompetency) => ({
        id: r.id,
        competency_id: r.competency_id,
        competency_name: r.competency_name,
        proficiency_level: r.proficiency_level,
        is_primary: r.is_primary,
      })))
      setEmptyIsExpected(Boolean(res?.empty_is_expected))
    } catch {
      setError('Could not load this course’s competencies.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { if (courseId !== null) load(courseId) }, [courseId, load])

  const available = useMemo(() => {
    const used = new Set(rows.map((r) => r.competency_id))
    return competencies.filter((c) => !used.has(c.id))
  }, [competencies, rows])

  const addRow = () => {
    const comp = competencies.find((c) => c.id === Number(addId))
    if (!comp) return
    setRows((p) => [...p, {
      id: null, competency_id: comp.id, competency_name: comp.name,
      proficiency_level: 3, is_primary: false,
    }])
    setAddId(''); setNotice(null)
  }

  const save = async () => {
    const ctx = getLaravelContext(user)
    if (courseId === null || !isLaravelContextReady(ctx)) return
    // The server refuses an empty list (min:1). Clearing a course entirely is a
    // per-row delete, so this is stopped here with a reason rather than sent to
    // collect a 422.
    if (rows.length === 0) {
      setError('A course needs at least one competency. Remove rows individually to clear it.')
      return
    }
    setSaving(true); setError(null); setNotice(null)
    try {
      const items: CourseCompetencyInput[] = rows.map((r) => ({
        competency_id: r.competency_id,
        proficiency_level: r.proficiency_level,
        is_primary: r.is_primary,
      }))
      const res = await courseCompetenciesService.save(ctx, courseId, items)
      const written = res.data?.written ?? 0
      const removed = res.data?.removed ?? 0
      // `removed` is never swallowed: this endpoint SYNCS, and a user who dropped
      // a row should be told the row is gone.
      setNotice(removed > 0
        ? `${written} competency link(s) saved. ${removed} removed from this course.`
        : `${written} competency link(s) saved.`)
      await load(courseId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const selected = courses.find((c) => c.id === courseId)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <GraduationCap className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What a course develops</p>
            <p className="mt-1">
              Learning assignment and remediation both read this list. A course with nothing here
              will never be suggested to close a gap, however relevant it is.
            </p>
          </div>
        </div>
      </div>

      {/*
        NO COURSES: the honest empty state. It names where courses come from but
        does NOT link there - the same rule the Role Requirements panel follows.
        A link is added only once the destination is mounted and reachable.
      */}
      {courses.length === 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
            <div className="text-sm">
              <p className="font-medium text-foreground">No courses exist in this organisation</p>
              <p className="mt-1 text-muted-foreground">
                Competencies are mapped onto courses, and there are none yet. Courses are created
                in the LMS; once one exists it will appear here.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[280px]">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Course</label>
          <Select
            value={courseId === null ? '' : String(courseId)}
            placeholder={courses.length === 0 ? 'No courses available' : 'Select a course…'}
            disabled={courses.length === 0}
            onChange={(v) => setCourseId(v ? Number(v) : null)}
            options={courses.map((c) => ({ value: String(c.id), label: c.title }))}
          />
        </div>

        {courseId !== null && canEdit && (
          <>
            <div className="min-w-[260px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Add a competency</label>
              <Select
                value={addId}
                onChange={setAddId}
                disabled={available.length === 0}
                placeholder={available.length === 0 ? 'No competencies left to add' : 'Select a competency…'}
                options={available.map((c) => ({ value: String(c.id), label: c.name }))}
              />
            </div>
            <Button variant="outline" onClick={addRow} disabled={!addId} className="gap-2">
              <Plus className="w-4 h-4" /> Add
            </Button>
            <Button onClick={save} disabled={saving || loading} className="gap-2 ml-auto">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
          </>
        )}
      </div>

      {courseId !== null && competencies.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No competencies are defined in this organisation, so there is nothing to map onto a course.
        </p>
      )}

      {error && <p className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</p>}
      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-500">{notice}</p>}

      {courseId === null ? (
        <EmptyState title="Select a course" description="Pick a course to see and edit the competencies it develops." />
      ) : loading ? (
        <div className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : rows.length === 0 ? (
        /*
          `empty_is_expected` comes from the SERVER. Nothing mapped is the normal
          state for a course nobody has mapped, and saying so is the difference
          between "not done yet" and "something went wrong".
        */
        <EmptyState
          title="No competencies mapped yet"
          description={emptyIsExpected
            ? `Nothing is mapped to ${selected?.title ?? 'this course'} yet. Until something is, this course will never be suggested to close a gap.`
            : 'This course has no competencies mapped.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left font-medium px-4 py-2">Competency</th>
                <th className="text-left font-medium px-4 py-2 w-44">Level developed</th>
                <th className="text-left font-medium px-4 py-2 w-28">Primary</th>
                <th className="w-16 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.competency_id} className="border-t border-border">
                  <td className="px-4 py-2">{r.competency_name}</td>
                  <td className="px-4 py-2">
                    <Select
                      aria-label={`Level developed for ${r.competency_name}`}
                      value={r.proficiency_level === null ? '' : String(r.proficiency_level)}
                      placeholder="Not stated"
                      onChange={(v) => setRows((p) => p.map((x, j) => j === i
                        ? { ...x, proficiency_level: v ? Number(v) : null } : x))}
                      options={LEVELS.map((l) => ({ value: String(l), label: `Level ${l}` }))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={r.is_primary}
                      onChange={(e) => setRows((p) => p.map((x, j) => j === i
                        ? { ...x, is_primary: e.target.checked } : x))}
                      aria-label={`${r.competency_name} is a primary outcome of this course`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    {canEdit && (
                      <Button variant="ghost" size="sm" aria-label={`Remove ${r.competency_name}`}
                        onClick={() => setRows((p) => p.filter((_, j) => j !== i))}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
            Saving replaces this course’s whole list. Rows you remove here are deleted when you save.
          </p>
        </div>
      )}
    </div>
  )
}
