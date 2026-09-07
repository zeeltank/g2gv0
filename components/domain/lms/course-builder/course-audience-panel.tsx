'use client'

/**
 * WHO THIS COURSE IS FOR — chosen while the course is being made.
 *
 * Until now a course was created on one screen and handed to people on
 * another, two menus away, by searching for the course again by name. And that
 * second screen could only pick individuals: "everyone in Nursing" was not
 * expressible at all, because its learner list never joined departments or job
 * roles.
 *
 * ── THE COUNT IS THE POINT ──────────────────────────────────────────────────
 *
 * "Assign to Nursing" is a decision about people whose names you cannot see.
 * So the panel always answers "how many, and who, and how many already have
 * it" BEFORE the button is pressed — and that count comes from the server,
 * computed by the same code that does the writing, so it cannot disagree with
 * the outcome.
 */

import { useEffect, useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  lmsCourseBuilderService,
  type AudiencePreview,
  type SuggestedAudience,
} from '@/services/lms/course-builder'
import type { CatalogDepartment, CatalogJobRole } from '@/services/lms'

export function CourseAudiencePanel({
  courseId,
  departments,
  jobRoles,
  profileName,
}: {
  /** Null until the course has been saved once - there is nothing to assign to yet. */
  courseId: number | null
  departments: CatalogDepartment[]
  jobRoles: CatalogJobRole[]
  profileName?: string
}) {
  const [departmentIds, setDepartmentIds] = useState<number[]>([])
  const [jobroleIds, setJobroleIds] = useState<number[]>([])
  /** Include everyone behind on what this course teaches. */
  const [byGap, setByGap] = useState(false)
  const [suggested, setSuggested] = useState<SuggestedAudience | null>(null)
  const [suggestedLoading, setSuggestedLoading] = useState(false)
  const [assignmentType, setAssignmentType] = useState('Mandatory')
  const [dueDate, setDueDate] = useState('')

  const [preview, setPreview] = useState<AudiencePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const nothingChosen = departmentIds.length === 0 && jobroleIds.length === 0 && !byGap

  /*
   * Re-count whenever the selection changes. Debounced lightly because ticking
   * three departments in a row should ask once, not three times.
   */
  useEffect(() => {
    if (!courseId || nothingChosen) {
      setPreview(null)
      return
    }
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    const timer = setTimeout(() => {
      lmsCourseBuilderService
        .previewAudience(context, courseId, {
          user_ids: [],
          department_ids: departmentIds,
          jobrole_ids: jobroleIds,
          by_gap: byGap,
        })
        .then((response) => setPreview(response.data ?? null))
        .catch(() => setPreview(null))
    }, 250)

    return () => clearTimeout(timer)
  }, [courseId, departmentIds, jobroleIds, byGap, nothingChosen])

  /*
   * Who is behind, and by how much.
   *
   * Loaded once when the course is known rather than on every keystroke: it
   * depends only on what the course develops, not on the boxes being ticked.
   * Shown whether or not the toggle is on, because "four people are behind on
   * this" is worth knowing before deciding to act on it.
   */
  useEffect(() => {
    if (!courseId) {
      setSuggested(null)
      return
    }
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    setSuggestedLoading(true)
    lmsCourseBuilderService
      .suggestedAudience(context, courseId, profileName)
      .then((response) => setSuggested(response.data ?? null))
      .catch(() => setSuggested(null))
      .finally(() => setSuggestedLoading(false))
  }, [courseId, profileName])

  /** One row per person per competency; a person behind on two is still one person. */
  const behindCount = new Set((suggested?.below ?? []).map((row) => row.user_id)).size

  const assign = async () => {
    if (!courseId) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setMessage({ ok: false, text: 'Your ERP session is unavailable. Please sign in again.' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const response = await lmsCourseBuilderService.assignAudience(
        context,
        courseId,
        {
          user_ids: [],
          department_ids: departmentIds,
          jobrole_ids: jobroleIds,
          by_gap: byGap,
          assignment_type: assignmentType,
          due_date: dueDate || null,
        },
        profileName,
      )
      const result = response.data
      setMessage({
        ok: true,
        text: result
          ? `Assigned to ${result.assigned} of ${result.reached}. ${result.already_had_it} already had it.`
          : 'Assigned.',
      })
    } catch (reason) {
      setMessage({
        ok: false,
        text: reason instanceof Error ? reason.message : 'Unable to assign this course.',
      })
    } finally {
      setBusy(false)
    }
  }

  const toggle = (list: number[], set: (next: number[]) => void, id: number) =>
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id])

  if (!courseId) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Save the course first, then choose who it is for. There is nothing to assign to yet.
      </p>
    )
  }

  return (
    <div className="@container/audience space-y-4">
      <div className="grid grid-cols-1 gap-4 @2xl/audience:grid-cols-2">
        <Picker
          label="Departments"
          hint="Everyone in the department, including people who join it later."
          options={departments.map((d) => ({ id: d.id, label: d.department }))}
          selected={departmentIds}
          onToggle={(id) => toggle(departmentIds, setDepartmentIds, id)}
        />
        <Picker
          label="Job roles"
          hint="Everyone holding the role."
          options={jobRoles.map((r) => ({ id: r.id, label: r.jobrole }))}
          selected={jobroleIds}
          onToggle={(id) => toggle(jobroleIds, setJobroleIds, id)}
        />
      </div>

      {/*
        * ── THE PEOPLE THIS COURSE WOULD ACTUALLY HELP ────────────────────────
        *
        * A course could be handed to a department or a job role and to nobody
        * on the basis of what they can already do — while the competency
        * picker's own label promised precisely this: "This is what lets it be
        * suggested to someone with a matching gap." Nothing delivered the
        * admin-facing half of that until now.
        *
        * Named people with their shortfall, not a bare count: "assign to
        * everyone behind" is a decision about individuals, and the panel's
        * whole premise is that such a decision is made with the names visible.
        */}
      <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
        {suggestedLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Checking who is behind on this…
          </p>
        ) : suggested?.reason ? (
          <p className="text-xs text-muted-foreground">{suggested.reason}</p>
        ) : (
          <>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-border"
                checked={byGap}
                disabled={behindCount === 0}
                onChange={(event) => setByGap(event.target.checked)}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">
                  Everyone behind on what this course teaches
                  {behindCount > 0 && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      ({behindCount} {behindCount === 1 ? 'person' : 'people'})
                    </span>
                  )}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  {behindCount === 0
                    ? 'Nobody whose role requires these capabilities is currently below the level it asks for.'
                    : `Measured against what each person’s own role requires on ${
                        suggested?.competencies.map((c) => c.name).filter(Boolean).join(' and ') ||
                        'this course’s capabilities'
                      }.`}
                </span>
              </span>
            </label>

            {(suggested?.below ?? []).length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-border/40 pt-3">
                {(suggested?.below ?? []).slice(0, 8).map((row) => (
                  <li
                    key={`${row.user_id}-${row.competency_id}`}
                    className="flex items-baseline justify-between gap-3 text-xs"
                  >
                    <span className="truncate">
                      <span className="font-semibold text-foreground">{row.name}</span>
                      <span className="text-muted-foreground"> · {row.competency_name}</span>
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                      {row.measured_level?.toFixed(2)} / {row.required_proficiency}
                      <span className="ml-1.5 font-semibold text-warning">
                        −{row.gap?.toFixed(2)}
                      </span>
                    </span>
                  </li>
                ))}
                {(suggested?.below ?? []).length > 8 && (
                  <li className="text-xs text-muted-foreground">
                    and {(suggested?.below ?? []).length - 8} more
                  </li>
                )}
              </ul>
            )}

            {/*
              * Unmeasured is neither a gap nor a pass. Stated rather than
              * folded into the count, because assigning training to somebody
              * on the grounds that nobody has assessed them is a different
              * decision from assigning it because they are behind.
              */}
            {(suggested?.unmeasured ?? []).length > 0 && (
              <p className="mt-3 border-t border-border/40 pt-3 text-xs text-muted-foreground">
                {new Set((suggested?.unmeasured ?? []).map((r) => r.user_id)).size} more
                {' '}whose role needs these capabilities have never been assessed on them, so
                whether they are behind is unknown. They are not included above.
              </p>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 @2xl/audience:grid-cols-2">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">Assignment type</span>
          <Select
            value={assignmentType}
            onChange={setAssignmentType}
            options={[
              { value: 'Mandatory', label: 'Mandatory' },
              { value: 'Recommended', label: 'Recommended' },
              { value: 'Optional', label: 'Optional' },
            ]}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">Due date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
          />
        </label>
      </div>

      {/* What will actually happen, before it happens. */}
      {preview && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="tabular-nums">{preview.will_assign}</span>
            {preview.will_assign === 1 ? ' person' : ' people'} will be assigned
            {preview.already_enrolled > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                · <span className="tabular-nums">{preview.already_enrolled}</span> already have it
              </span>
            )}
          </p>
          {preview.sample.length > 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {preview.sample.map((person) => person.name).join(', ')}
              {preview.count > preview.sample.length && ` and ${preview.count - preview.sample.length} more`}
            </p>
          )}
        </div>
      )}

      {message && (
        <p
          role="status"
          className={cn(
            'rounded-lg border px-3 py-2 text-sm',
            message.ok
              ? 'border-success/30 bg-success/5 text-success'
              : 'border-destructive/30 bg-destructive/5 text-destructive',
          )}
        >
          {message.text}
        </p>
      )}

      <Button onClick={() => void assign()} disabled={busy || nothingChosen}>
        {busy ? <><Loader2 className="mr-2 size-4 animate-spin" /> Assigning…</> : 'Assign course'}
      </Button>
    </div>
  )
}

/** A checkbox list with a filter, for lists that run to hundreds. */
function Picker({
  label, hint, options, selected, onToggle,
}: {
  label: string
  hint: string
  options: { id: number; label: string }[]
  selected: number[]
  onToggle: (id: number) => void
}) {
  const [query, setQuery] = useState('')
  const visible = query.trim()
    ? options.filter((option) =>
        option.label.toLowerCase().includes(query.trim().toLowerCase()) || selected.includes(option.id))
    : options

  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium text-muted-foreground">
        {label}
        {selected.length > 0 && (
          <span className="ml-1.5 tabular-nums text-primary">{selected.length} selected</span>
        )}
      </span>
      <div className="rounded-lg border">
        {/* 332 job roles is not a list you scroll. */}
        {options.length >= 8 && (
          <div className="border-b p-1.5">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${options.length}…`}
              aria-label={`Filter ${label}`}
              className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/50"
            />
          </div>
        )}
        <div className="max-h-40 overflow-y-auto p-2">
          {visible.length === 0 ? (
            <span className="text-xs text-muted-foreground">Nothing matches “{query}”</span>
          ) : (
            visible.map((option) => (
              <label key={option.id} className="flex gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(option.id)}
                  onChange={() => onToggle(option.id)}
                />
                <span className="min-w-0 truncate">{option.label}</span>
              </label>
            ))
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}
