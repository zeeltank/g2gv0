'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  hrmsService,
  type DepartmentSchedule,
  type DepartmentScheduleDay,
  type SchedulePreviewResponse,
} from '@/services/hrms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export const WEEKDAYS: DepartmentScheduleDay['weekday'][] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]

/** The two days whose hours genuinely vary; a copy-forward must never assume them. */
export const WEEKEND: DepartmentScheduleDay['weekday'][] = ['saturday', 'sunday']

/**
 * Office hours, per department.
 *
 * ── SAVE AND APPLY ARE TWO ACTIONS, ON PURPOSE ──────────────────────────────
 *
 * `save` writes the template. `apply` copies it onto the department's
 * employees' tbluser columns, which is what the attendance and payroll
 * calculations actually read. Keeping them separate is the safety mechanism,
 * not a nicety: saving what the hours should be is cheap and reversible,
 * writing them onto a hundred people is neither.
 *
 * ── THE PREVIEW IS NOT OPTIONAL IN THE FLOW ─────────────────────────────────
 *
 * The previous version of this feature was removed from the product because a
 * bulk shift write silently flattened Saturday across a department - 100
 * employees in one tenant finish at 14:00, and a blanket 09:00-18:00 wiped that
 * with no record and no warning.
 *
 * So `apply` here always runs `preview` first and hands the caller the numbers;
 * the screen shows them and asks. The server computes the preview with the same
 * code path as the write, so the two cannot disagree.
 */
export function useDepartmentSchedules() {
  const { user, isLoading: authLoading } = useAuth()

  const [schedules, setSchedules] = useState<DepartmentSchedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (authLoading || !user) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await hrmsService.getDepartmentSchedules(getLaravelContext(user))
      setSchedules(response.data ?? [])
    } catch (caught) {
      setError(toMessage(caught, 'Could not load the department office hours.'))
      setSchedules([])
    } finally {
      setIsLoading(false)
    }
  }, [authLoading, user])

  /*
   * Deferred by a tick rather than called straight from the effect body.
   *
   * `load` sets isLoading before its first await, so calling it directly makes
   * that setState land synchronously inside the effect - a cascading render.
   * The sibling hook (use-attendance-admin) avoids the same thing by accident,
   * because its search debounce already wraps the call in a timeout.
   */
  useEffect(() => {
    const handle = setTimeout(() => void load(), 0)
    return () => clearTimeout(handle)
  }, [load])

  /** Save one department's week. Writes the template; changes no employee. */
  const save = useCallback(
    async (departmentId: number, week: DepartmentScheduleDay[]): Promise<boolean> => {
      setIsSaving(true)
      setError(null)
      setNotice(null)
      try {
        const response = await hrmsService.saveDepartmentSchedule(getLaravelContext(user), {
          departmentId,
          week: week.map((day) => ({
            weekday: day.weekday,
            // A day that was never set saves as not-working rather than as null:
            // the server needs a boolean, and "I opened the screen and pressed
            // Save" should not silently mean "worked".
            is_working: day.is_working === true,
            in_time: day.in_time,
            out_time: day.out_time,
          })),
        })
        setNotice(response.message || 'Office hours saved.')
        await load()
        return true
      } catch (caught) {
        setError(toMessage(caught, 'Could not save these office hours.'))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [load, user],
  )

  /** What an apply would do. Writes nothing. */
  const preview = useCallback(
    async (
      departmentId: number,
      weekdays: string[],
      /**
       * Also overwrite employees who set their OWN hours through an approved
       * request. Defaults to false, and the preview is asked with the same
       * value the apply will use - a preview that disagreed with the write
       * would be worse than none, because it is trusted.
       */
      overrideEmployeeHours = false,
    ): Promise<SchedulePreviewResponse | null> => {
      setError(null)
      try {
        return await hrmsService.previewScheduleApply(getLaravelContext(user), {
          departmentId,
          weekdays,
          overrideEmployeeHours,
        })
      } catch (caught) {
        setError(toMessage(caught, 'Could not work out what this would change.'))
        return null
      }
    },
    [user],
  )

  /** Write the template onto the department's employees. */
  const apply = useCallback(
    async (
      departmentId: number,
      weekdays: string[],
      overrideEmployeeHours = false,
    ): Promise<boolean> => {
      setIsSaving(true)
      setError(null)
      setNotice(null)
      try {
        const response = await hrmsService.applySchedule(getLaravelContext(user), {
          departmentId,
          weekdays,
          overrideEmployeeHours,
        })
        setNotice(
          response.message ||
            (response.applied ? 'Office hours applied.' : 'Nothing needed changing.'),
        )
        await load()
        return true
      } catch (caught) {
        setError(toMessage(caught, 'Could not apply these office hours.'))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [load, user],
  )

  return {
    schedules, isLoading, isSaving, error, notice,
    setError, setNotice,
    refresh: load, save, preview, apply,
  }
}

/**
 * Copy one weekday's hours across the week.
 *
 * SATURDAY AND SUNDAY ARE EXCLUDED unless `includeWeekend` is explicitly true.
 * Saturday is the day whose hours genuinely vary - 100 employees in one tenant
 * finish at 14:00 - and a copy-forward that swept it up is the shape of the bug
 * that got the previous version of this feature deleted. The caller has to ask.
 */
export function copyAcrossWeek(
  week: DepartmentScheduleDay[],
  from: DepartmentScheduleDay['weekday'],
  includeWeekend = false,
): DepartmentScheduleDay[] {
  const source = week.find((day) => day.weekday === from)
  if (!source) return week

  return week.map((day) => {
    if (day.weekday === from) return day
    if (!includeWeekend && WEEKEND.includes(day.weekday)) return day
    return { ...day, is_working: source.is_working, in_time: source.in_time, out_time: source.out_time }
  })
}
