'use client'

import { useCallback, useEffect, useState } from 'react'
import { taskService } from '@/services/task'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type {
  DeadlineExtension, MyTask, RecurrenceRule, RecurrenceScope, TaskStatus, TaskStatusOption, WorkspaceTask,
} from '@/types/task-management'

export interface Notice {
  tone: 'success' | 'info' | 'warning' | 'destructive'
  text: string
}

/** One entry of the status picker. `category` is the system status it maps to, which is what the transition rules are written in. */
export interface StatusOption {
  label: string
  value: string
  category: TaskStatus
}

/**
 * Shown until the tenant's own vocabulary arrives from /statuses. Custom
 * statuses are labels on these four categories, so this stays a valid
 * fallback rather than a competing list.
 */
const SYSTEM_STATUS_OPTIONS: StatusOption[] = [
  { label: 'Pending', value: 'PENDING', category: 'PENDING' },
  { label: 'In Progress', value: 'IN-PROGRESS', category: 'IN-PROGRESS' },
  { label: 'On Hold', value: 'ON HOLD', category: 'ON HOLD' },
  { label: 'Completed', value: 'COMPLETED', category: 'COMPLETED' },
]

/**
 * The moves the server accepts (TaskStatusTransitionService). Re-sending the
 * same status is always allowed - it is how a progress note is added - and a
 * finished task can only be reopened to IN-PROGRESS.
 */
const ALLOWED_NEXT: Record<TaskStatus, TaskStatus[]> = {
  'PENDING': ['PENDING', 'IN-PROGRESS', 'ON HOLD', 'COMPLETED'],
  'IN-PROGRESS': ['IN-PROGRESS', 'PENDING', 'ON HOLD', 'COMPLETED'],
  'ON HOLD': ['ON HOLD', 'PENDING', 'IN-PROGRESS', 'COMPLETED'],
  'COMPLETED': ['COMPLETED', 'IN-PROGRESS'],
}

export function statusChoices(all: StatusOption[], current: TaskStatus): StatusOption[] {
  const allowed = ALLOWED_NEXT[current] ?? ALLOWED_NEXT.PENDING
  return all.filter((option) => allowed.includes(option.category))
}

/**
 * Did a legacy /task write succeed?
 *
 * The controller sets `status_code` and `is_mobile()` renames it to `status`
 * on the way out, so the wire carries {"message":"...","status":"1"}. Reading
 * `status_code` alone gave `Number(undefined)` = NaN, which is never 1 - so a
 * save that had already written the row was reported to the user as an error.
 * Both keys are accepted; the shape is the legacy route's, not ours to pick.
 */
function legacyOk(response: { status?: string | number; status_code?: string | number }): boolean {
  return Number(response.status ?? response.status_code) === 1
}

function reasonText(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback
}

/**
 * Everything the task detail panel loads and writes, in one place.
 *
 * The panel is mounted with `key={taskId}`, so every piece of state here is
 * born empty for each task - nothing left over from the previous one can show
 * while this one loads or after a failed fetch.
 */
export function useTaskDetail({ taskId, open, onUpdated, onClose }: {
  taskId: string
  open: boolean
  onUpdated: () => void
  onClose: () => void
}) {
  const [task, setTask] = useState<MyTask | null>(null)
  /** Project, time window, approval chain - fields the my-tasks read does not carry. */
  const [workspace, setWorkspace] = useState<WorkspaceTask | null>(null)
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>(SYSTEM_STATUS_OPTIONS)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [extensions, setExtensions] = useState<DeadlineExtension[]>([])
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(null)
  /** null = no reminder. 0 is a real value ("at the due time"), so it is never used for "none". */
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null)
  /** Which write is in flight, so exactly the control that started it can show it. */
  const [busy, setBusy] = useState<string | null>(null)
  /** Bumped by anything that adds history, so the Activity tab re-reads. */
  const [activityVersion, setActivityVersion] = useState(0)

  const fail = useCallback((reason: unknown, fallback: string) => {
    setNotice({ tone: 'destructive', text: reasonText(reason, fallback) })
  }, [])

  const touchActivity = useCallback(() => setActivityVersion((value) => value + 1), [])

  useEffect(() => {
    if (!open) return
    let active = true

    // Deferred so the load's first setState lands after this render rather
    // than cascading out of the effect body.
    queueMicrotask(() => {
      if (!active) return
      const context = getLaravelContext()
      if (!isLaravelContextReady(context)) {
        setNotice({ tone: 'destructive', text: 'Your ERP session is unavailable. Please sign in again.' })
        return
      }
      setLoading(true)

      taskService.getDeadlineExtensions(context, taskId)
        .then((response) => { if (active) setExtensions(response.data.extensions) })
        .catch(() => { /* the panel still works without the extension history */ })

      // The tenant's status vocabulary, so the picker offers custom statuses
      // rather than only the four system categories.
      taskService.getStatusOptions(context)
        .then((response) => {
          if (!active || !response.data.statuses.length) return
          setStatusOptions(response.data.statuses.map((option: TaskStatusOption) => ({
            label: option.name,
            value: option.is_system ? option.category : option.name,
            category: option.category,
          })))
        })
        .catch(() => { /* the four system statuses remain selectable */ })

      taskService.getWorkspaceTask(context, taskId)
        .then((response) => { if (active) setWorkspace(response.data) })
        .catch(() => { /* project and time window are extras; the panel works without them */ })

      taskService.getMyTask(context, taskId)
        .then((response) => {
          if (!active) return
          setTask(response.data)
          if (response.data.recurrence_id) {
            taskService.getTaskRecurrence(context, taskId)
              .then((recurrenceResponse) => { if (active) setRecurrence(recurrenceResponse.data.recurrence) })
              .catch(() => { /* the panel still works without the recurrence summary */ })
          }
          taskService.getTaskReminder(context, taskId)
            .then((reminderResponse) => { if (active) setReminderMinutes(reminderResponse.data.reminder?.minutes_before ?? null) })
            .catch(() => { /* the panel still works without the reminder summary */ })
        })
        .catch((reason: unknown) => { if (active) fail(reason, 'Unable to load this task.') })
        .finally(() => { if (active) setLoading(false) })
    })

    return () => { active = false }
  }, [open, taskId, fail])

  /**
   * Re-read rather than patching local state: the server normalises things
   * (priority casing, the observer's display name), and the panel should show
   * what was saved, not what was typed.
   */
  const refreshTask = useCallback(async () => {
    const context = getLaravelContext()
    try {
      const [mine, shared] = await Promise.all([
        taskService.getMyTask(context, taskId),
        taskService.getWorkspaceTask(context, taskId).catch(() => null),
      ])
      setTask(mine.data)
      if (shared) setWorkspace(shared.data)
    } catch { /* the list behind is already refreshed */ }
  }, [taskId])

  const refreshExtensions = useCallback(async () => {
    try {
      const response = await taskService.getDeadlineExtensions(getLaravelContext(), taskId)
      setExtensions(response.data.extensions)
    } catch { /* non-fatal */ }
  }, [taskId])

  /** The status moves; the panel stays open, and anything the server warns about is shown. */
  async function saveStatus(status: string, remarks: string): Promise<boolean> {
    if (!task) return false
    if (!remarks.trim()) {
      setNotice({ tone: 'destructive', text: 'Remarks are required when updating a task status.' })
      return false
    }
    setBusy('status'); setNotice(null)
    try {
      const response = await taskService.updateMyTaskStatus(getLaravelContext(), task.id, status, remarks.trim())
      // The API resolves a custom label back to its system category, so take
      // both from the response rather than echoing what was picked.
      setTask({ ...task, status: response.data.status, status_label: response.data.status_label, remarks: remarks.trim() })
      const warnings = (response.warnings ?? []).map((warning) => warning.message)
      setNotice(warnings.length
        ? { tone: 'warning', text: `${response.message} ${warnings.join(' ')}` }
        : { tone: 'success', text: response.message })
      touchActivity()
      onUpdated()
      return true
    } catch (reason) {
      fail(reason, 'Unable to update the task.')
      return false
    } finally { setBusy(null) }
  }

  /** Hidden from everyone but you and anyone with elevated access - never masked, simply absent from their calendar. */
  async function toggleVisibility() {
    if (!task) return
    const next = task.visibility === 'PRIVATE' ? 'PUBLIC' : 'PRIVATE'
    setBusy('visibility'); setNotice(null)
    try {
      await taskService.updateTaskVisibility(getLaravelContext(), task.id, next)
      setTask({ ...task, visibility: next })
    } catch (reason) {
      fail(reason, 'Unable to change visibility.')
    } finally { setBusy(null) }
  }

  /**
   * Clones this task into a fresh PENDING one, due today + the caller's own
   * follow_up_days preference. No schema link is kept between the two -
   * only the new task's title prefix signals the relationship.
   */
  async function createFollowUp(formatDue: (value: string | null) => string) {
    if (!task) return
    setBusy('followup'); setNotice(null)
    try {
      const response = await taskService.createFollowUpTask(getLaravelContext(), task.id)
      setNotice({ tone: 'success', text: `${response.message} "${response.data.task_title}" is due ${formatDue(response.data.due_date)}.` })
      onUpdated()
    } catch (reason) {
      fail(reason, 'Unable to create a follow-up task.')
    } finally { setBusy(null) }
  }

  async function setReminder(minutes: number | null) {
    if (!task) return
    setBusy('reminder'); setNotice(null)
    try {
      if (minutes === null) {
        const response = await taskService.deleteTaskReminder(getLaravelContext(), task.id)
        setReminderMinutes(null)
        setNotice({ tone: 'success', text: response.message })
      } else {
        const response = await taskService.upsertTaskReminder(getLaravelContext(), task.id, minutes)
        setReminderMinutes(response.data.reminder.minutes_before)
        setNotice({ tone: 'success', text: response.message })
      }
    } catch (reason) {
      fail(reason, 'Unable to save the reminder.')
    } finally { setBusy(null) }
  }

  async function saveRecurrence(rule: RecurrenceRule): Promise<boolean> {
    if (!task) return false
    setBusy('recurrence'); setNotice(null)
    try {
      const response = await taskService.upsertTaskRecurrence(getLaravelContext(), task.id, rule)
      setRecurrence(response.data.recurrence)
      setTask({ ...task, recurrence_id: response.data.recurrence.task_id ?? task.id })
      const created = response.data.created_count
      setNotice({ tone: 'success', text: `${response.message} ${created} upcoming occurrence${created === 1 ? '' : 's'} created.` })
      return true
    } catch (reason) {
      fail(reason, 'Unable to save the repeat schedule.')
      return false
    } finally { setBusy(null) }
  }

  async function removeRecurrence() {
    if (!task) return
    setBusy('recurrence'); setNotice(null)
    try {
      const response = await taskService.deleteTaskRecurrence(getLaravelContext(), task.id)
      setRecurrence(null)
      setTask({ ...task, recurrence_id: null })
      setNotice({ tone: 'success', text: response.message })
    } catch (reason) {
      fail(reason, 'Unable to remove the repeat schedule.')
    } finally { setBusy(null) }
  }

  async function deleteTask(scope: RecurrenceScope) {
    if (!task) return
    setBusy('delete'); setNotice(null)
    try {
      const response = await taskService.deleteModernTask(getLaravelContext(), task.id, scope)
      if (!legacyOk(response)) throw new Error(response.message)
      onUpdated(); onClose()
    } catch (reason) {
      fail(reason, 'Unable to delete the task.')
    } finally { setBusy(null) }
  }

  async function requestExtension(requestedDate: string, reason: string): Promise<boolean> {
    if (!task) return false
    setBusy('extension'); setNotice(null)
    try {
      const response = await taskService.requestDeadlineExtension(getLaravelContext(), {
        taskId: task.id, requestedDate, reason: reason.trim(),
      })
      setNotice({ tone: 'success', text: response.message })
      await refreshExtensions()
      await refreshTask()
      touchActivity()
      return true
    } catch (failure) {
      fail(failure, 'Unable to request the extension.')
      return false
    } finally { setBusy(null) }
  }

  async function decideExtension(id: string, decision: 'approve' | 'reject', remarks: string): Promise<boolean> {
    if (!task) return false
    setBusy('extension'); setNotice(null)
    try {
      const response = await taskService.decideDeadlineExtension(getLaravelContext(), id, decision, remarks.trim())
      // A rejection is a normal outcome, not a success to celebrate in green.
      setNotice({ tone: decision === 'approve' ? 'success' : 'info', text: response.message })
      await refreshExtensions()
      // Approval moved the due date server-side, so the task must be re-read.
      await refreshTask()
      touchActivity()
      onUpdated()
      return true
    } catch (reason) {
      fail(reason, 'Unable to record the decision.')
      return false
    } finally { setBusy(null) }
  }

  async function withdrawExtension(id: string): Promise<boolean> {
    if (!task) return false
    setBusy('extension'); setNotice(null)
    try {
      const response = await taskService.withdrawDeadlineExtension(getLaravelContext(), id)
      setNotice({ tone: 'info', text: response.message })
      await refreshExtensions()
      await refreshTask()
      touchActivity()
      onUpdated()
      return true
    } catch (reason) {
      fail(reason, 'Unable to withdraw the request.')
      return false
    } finally { setBusy(null) }
  }

  async function addComment(content: string): Promise<boolean> {
    if (!task || !content.trim()) return false
    setBusy('comment'); setNotice(null)
    try {
      await taskService.addWorkspaceComment(getLaravelContext(), task.id, content.trim())
      touchActivity()
      return true
    } catch (reason) {
      fail(reason, 'Unable to post the comment.')
      return false
    } finally { setBusy(null) }
  }

  return {
    task, setTask, workspace, statusOptions, loading, notice, setNotice, extensions, recurrence, reminderMinutes, busy,
    activityVersion, touchActivity, refreshTask, refreshExtensions,
    saveStatus, toggleVisibility, createFollowUp, setReminder, saveRecurrence, removeRecurrence, deleteTask,
    requestExtension, decideExtension, withdrawExtension, addComment,
  }
}
