'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, CalendarDays, CheckCircle2, Clock, Edit2, FileText, Trash2, UserCircle2, Paperclip, Download} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { PriorityBadge } from './priority-badge'
import { TaskInstructionsPanel } from './task-instructions-panel'
import { TaskDocumentsPanel } from './task-documents-panel'
import { Spinner } from '@/components/ui/spinner'
import { taskService } from '@/services/task'
import { CreateTaskModal } from './create-task-modal'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { DeadlineExtension, MyTask, TaskStatus, TaskStatusOption } from '@/types/task-management'

/**
 * Shown until the tenant's own vocabulary arrives from /statuses. Custom
 * statuses are labels on these four categories, so this stays a valid
 * fallback rather than a competing list.
 */
const SYSTEM_STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'In Progress', value: 'IN-PROGRESS' },
  { label: 'On Hold', value: 'ON HOLD' },
  { label: 'Completed', value: 'COMPLETED' },
]

interface Props {
  taskId: string | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
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

export function MyTaskDetailsDrawer({ taskId, open, onClose, onUpdated }: Props) {
  const [task, setTask] = useState<MyTask | null>(null)
  const [status, setStatus] = useState<string>('PENDING')
  const [statusOptions, setStatusOptions] = useState(SYSTEM_STATUS_OPTIONS)
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  /** Whether the shared assign/edit form is open over this drawer. */
  const [editing, setEditing] = useState(false)
  // Deadline extensions: the executor asks for more time from this drawer,
  // the owner decides here too. Approval moves the due date server-side.
  const [extensions, setExtensions] = useState<DeadlineExtension[]>([])
  const [extDate, setExtDate] = useState('')
  const [extReason, setExtReason] = useState('')
  const [extBusy, setExtBusy] = useState(false)

  useEffect(() => {
    if (!open || !taskId) return
    // Captured after the guard: the narrowing does not carry into the nested
    // function below, so it would see string | null otherwise.
    const id = taskId

    let active = true
    // Deferred so the load's first setState lands after this render rather
    // than cascading out of the effect body.
    queueMicrotask(() => {
      if (!active) return
      const context = getLaravelContext()
      if (!isLaravelContextReady(context)) {
        setError('Your ERP session is unavailable. Please sign in again.')
        return
      }
      run(context)
    })

    function run(context: ReturnType<typeof getLaravelContext>) {
    setLoading(true)
    setError('')
    setMessage('')
    taskService.getDeadlineExtensions(context, id)
      .then((response) => { if (active) setExtensions(response.data.extensions) })
      .catch(() => { /* the drawer still works without the extension history */ })

    // The tenant's status vocabulary, so the picker offers custom statuses
    // rather than only the four system categories.
    taskService.getStatusOptions(context)
      .then((response) => {
        if (!active || !response.data.statuses.length) return
        setStatusOptions(response.data.statuses.map((option: TaskStatusOption) => ({
          label: option.name, value: option.is_system ? option.category : option.name,
        })))
      })
      .catch(() => { /* the four system statuses remain selectable */ })

    taskService.getMyTask(context, id)
      .then((response) => {
        if (!active) return
        setTask(response.data)
        setStatus(response.data.status_label || response.data.status)
        setRemarks(response.data.remarks ?? '')
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load this task.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    }

    return () => { active = false }
  }, [open, taskId])

  async function saveStatus() {
    if (!task || !remarks.trim()) {
      setError('Remarks are required when updating a task status.')
      return
    }
    const context = getLaravelContext()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await taskService.updateMyTaskStatus(context, task.id, status, remarks.trim())
      // The API resolves a custom label back to its system category, so take
      // both from the response rather than echoing what was picked.
      setTask({ ...task, status: response.data.status, status_label: response.data.status_label, remarks: remarks.trim() })
      setMessage(response.message)
      onUpdated()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update the task.')
    } finally {
      setSaving(false)
    }
  }


  async function deleteTask() {
    if (!task || !window.confirm(`Delete "${task.title}"?`)) return
    setSaving(true); setError('')
    try {
      const response = await taskService.deleteLegacyTask(getLaravelContext(), task.id)
      if (!legacyOk(response)) throw new Error(response.message)
      onUpdated(); onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the task.')
    } finally { setSaving(false) }
  }

  async function refreshExtensions() {
    if (!taskId) return
    try {
      const response = await taskService.getDeadlineExtensions(getLaravelContext(), taskId)
      setExtensions(response.data.extensions)
    } catch { /* non-fatal */ }
  }

  async function requestExtension() {
    if (!task || !extDate || !extReason.trim()) {
      setError('A new date and a reason are required to request an extension.')
      return
    }
    setExtBusy(true); setError(''); setMessage('')
    try {
      const response = await taskService.requestDeadlineExtension(getLaravelContext(), {
        taskId: task.id, requestedDate: extDate, reason: extReason.trim(),
      })
      setMessage(response.message)
      setExtDate(''); setExtReason('')
      await refreshExtensions()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to request the extension.')
    } finally { setExtBusy(false) }
  }

  async function decideExtension(id: string, decision: 'approve' | 'reject') {
    if (!task) return
    setExtBusy(true); setError(''); setMessage('')
    try {
      const response = await taskService.decideDeadlineExtension(getLaravelContext(), id, decision)
      setMessage(response.message)
      await refreshExtensions()
      // Approval moved the due date server-side, so the task must be re-read.
      const refreshed = await taskService.getMyTask(getLaravelContext(), task.id)
      setTask(refreshed.data)
      onUpdated()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to record the decision.')
    } finally { setExtBusy(false) }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-[640px]">
        <SheetHeader className="border-b p-6">
          <SheetTitle>{task?.title ?? 'Task details'}</SheetTitle>
          <SheetDescription>Verified task information from Laravel</SheetDescription>
        </SheetHeader>

        <div className="h-[calc(100vh-98px)] overflow-y-auto p-6">
          {loading && <div className="flex h-48 items-center justify-center"><Spinner /></div>}
          {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
          {message && <div className="mb-4 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}

          {task && !loading && (
            <div className="space-y-6">
              {task.owner_id === getLaravelContext().userId && (
                <div className="flex justify-end gap-2">
                  {/* ONE EDIT EXPERIENCE. This used to be five fields inline -
                      title, description, assignee, priority, due date - written
                      through a full-replace update, which meant editing a task
                      here silently blanked its KRA, KPA, skills and monitoring
                      points. It now opens the same form the task was assigned
                      with, which can see and save all of them. */}
                  <Button variant="outline" onClick={() => setEditing(true)}><Edit2 className="mr-2 size-4" />Edit / Reassign</Button>
                  <Button variant="outline" className="text-destructive" onClick={() => void deleteTask()} disabled={saving}><Trash2 className="mr-2 size-4" />Delete</Button>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Info icon={UserCircle2} label="Assigned to" value={task.assignee} />
                <Info icon={UserCircle2} label="Assigned by" value={task.owner} />
                <Info icon={CalendarDays} label="Due date" value={formatDate(task.due_date)} />
                <Info icon={FileText} label="Department" value={task.department || 'Not assigned'} />
                <Info icon={Clock} label="Priority / cadence" value={<PriorityBadge priority={task.priority ?? task.task_type} />} />
                <Info icon={CheckCircle2} label="Current status" value={<StatusBadge status={task.status} label={task.status_label || undefined} />} />
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Description</h3>
                <p className="rounded-xl bg-muted/30 p-4 text-sm leading-6 text-foreground/80">
                  {task.description || 'No description provided.'}
                </p>
              </section>

              {task.observation_point && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Observation point</h3>
                  <p className="rounded-xl bg-muted/30 p-4 text-sm">{task.observation_point}</p>
                </section>
              )}

              {/* THE PROCEDURE, HIGH UP. Somebody opening their own task wants
                  to know what to do — that belongs above deadline extensions
                  and approval history, which are administration. */}
              <TaskInstructionsPanel taskId={Number(taskId)} />

              {task.attachment && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Attachment</h3>
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border p-4 text-sm">
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{task.attachment.name}</span>
                      {(task.attachment.type || task.attachment.size) && (
                        <span className="block text-xs tabular-nums text-muted-foreground">
                          {[task.attachment.type, task.attachment.size ? `${task.attachment.size} bytes` : null]
                            .filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>

                    {/* DOWNLOAD ONLY WHEN THE FILE IS ACTUALLY REACHABLE.
                        `task.task_attachment` holds a bare filename, and the
                        bytes sit in one of two stores depending on which path
                        uploaded them — so the server tells us whether a version
                        record with a real path exists. Without that flag this
                        would be a link that 404s, which is worse than plain
                        text. */}
                    {task.attachment.download_version !== null ? (
                      <a
                        href={taskService.taskAttachmentDownloadUrl(getLaravelContext(), String(taskId), task.attachment.download_version)}
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label={`Download ${task.attachment.name}`}
                      >
                        <Download className="size-4" />
                      </a>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Ask your manager for a copy
                      </span>
                    )}
                  </div>
                </section>
              )}

              {/* Reference material, beside the procedure — the two things an
                  employee opens this drawer to find. */}
              <section>
                <h3 className="mb-2 text-sm font-semibold">Documents</h3>
                <TaskDocumentsPanel taskId={Number(taskId)} compact />
              </section>

              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarClock className="size-4" /> Deadline extension
                </h3>

                {extensions.length > 0 && (
                  <ul className="space-y-2">
                    {extensions.map((extension) => (
                      <li key={extension.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <span className="font-semibold">{formatDate(extension.requested_date)}</span>
                            <span className="text-muted-foreground"> requested by {extension.requested_by ?? 'Unknown'}</span>
                          </span>
                          <StatusBadge status={extension.status.toUpperCase()} />
                        </div>
                        {extension.reason && <p className="mt-1 text-muted-foreground">{extension.reason}</p>}
                        {extension.decision_remarks && (
                          <p className="mt-1 text-xs text-muted-foreground">Decision: {extension.decision_remarks}</p>
                        )}

                        {/* The owner decides; pending only, decided rows are history. */}
                        {extension.status === 'pending' && task.owner_id === getLaravelContext().userId && (
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" onClick={() => void decideExtension(extension.id, 'approve')} disabled={extBusy}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => void decideExtension(extension.id, 'reject')} disabled={extBusy}>
                              Reject
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* One pending request per task; the form hides while one is open. */}
                {!extensions.some((extension) => extension.status === 'pending') && (
                  <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                    <input
                      type="date"
                      value={extDate}
                      onChange={(event) => setExtDate(event.target.value)}
                      className="h-10 rounded-lg border px-3 text-sm"
                      aria-label="New due date"
                    />
                    <input
                      value={extReason}
                      onChange={(event) => setExtReason(event.target.value)}
                      placeholder="Why is more time needed?"
                      className="h-10 rounded-lg border px-3 text-sm"
                    />
                    <Button variant="outline" onClick={() => void requestExtension()} disabled={extBusy || !extDate || !extReason.trim()}>
                      {extBusy ? 'Sending…' : 'Request'}
                    </Button>
                  </div>
                )}
              </section>

              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="text-sm font-semibold">Update status</h3>
                <Select
                  value={status}
                  onChange={(value) => setStatus(value)}
                  options={statusOptions}
                />
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Completion or progress remarks (required)"
                  className="min-h-28 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
                <StatusBadge status={status} />
                <Button onClick={saveStatus} disabled={saving || !remarks.trim()} className="w-full">
                  {saving ? 'Saving…' : 'Save status and remarks'}
                </Button>
              </section>
            </div>
          )}
        </div>
      </SheetContent>
    {/* The assign form, in edit mode, over the drawer. Keyed on the task so it
        remounts per task rather than showing the last one while this loads. */}
    {editing && task && <CreateTaskModal key={task.id} isOpen editTaskId={task.id}
      onClose={() => setEditing(false)}
      onUpdated={(value) => {
        setEditing(false); setMessage(value); onUpdated()
        // Re-read rather than patching local state: the update normalises
        // things (priority casing, the observer's display name) and the drawer
        // should show what was saved, not what was typed.
        void taskService.getMyTask(getLaravelContext(), task.id).then((refreshed) => setTask(refreshed.data)).catch(() => { /* the list behind is already refreshed */ })
      }} />}
    </Sheet>
  )
}

function Info({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return 'No due date'
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
