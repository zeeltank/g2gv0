'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock, Edit2, FileText, Trash2, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { PriorityBadge } from './priority-badge'
import { Spinner } from '@/components/ui/spinner'
import { taskService } from '@/services/task'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { MyTask, TaskStatus } from '@/types/task-management'

const STATUS_OPTIONS: Array<{ label: string; value: TaskStatus }> = [
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

export function MyTaskDetailsDrawer({ taskId, open, onClose, onUpdated }: Props) {
  const [task, setTask] = useState<MyTask | null>(null)
  const [status, setStatus] = useState<TaskStatus>('PENDING')
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([])
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAssignee, setEditAssignee] = useState('')
  const [editPriority, setEditPriority] = useState('Medium')
  const [editDueDate, setEditDueDate] = useState('')

  useEffect(() => {
    if (!open || !taskId) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    let active = true
    setLoading(true)
    setError('')
    setMessage('')
    taskService.getMyTask(context, taskId)
      .then((response) => {
        if (!active) return
        setTask(response.data)
        setStatus(response.data.status)
        setRemarks(response.data.remarks ?? '')
        setEditTitle(response.data.title)
        setEditDescription(response.data.description)
        setEditAssignee(response.data.assignee_id ?? '')
        setEditPriority(response.data.priority ?? response.data.task_type ?? 'Medium')
        setEditDueDate(response.data.due_date ?? '')
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load this task.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

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
      setTask({ ...task, status, remarks: remarks.trim() })
      setMessage(response.message)
      onUpdated()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update the task.')
    } finally {
      setSaving(false)
    }
  }

  async function startEditing() {
    const context = getLaravelContext()
    setError('')
    try {
      const users = await taskService.getAssignmentUsers(context)
      setEmployees(users.map((user) => ({
        id: String(user.id),
        name: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' '),
      })))
      setEditing(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load employees.')
    }
  }

  async function saveTask() {
    if (!task || !editTitle.trim() || !editAssignee || !editDueDate) {
      setError('Title, assignee, and due date are required.')
      return
    }
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await taskService.updateLegacyTask(getLaravelContext(), task.id, {
        title: editTitle.trim(), description: editDescription.trim(), assigneeId: editAssignee,
        observerId: task.owner_id ?? '', priority: editPriority, dueDate: editDueDate, status: task.status,
      })
      if (Number(response.status_code) !== 1) throw new Error(response.message)
      setMessage(response.message); setEditing(false); onUpdated()
      const refreshed = await taskService.getMyTask(getLaravelContext(), task.id)
      setTask(refreshed.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update the task.')
    } finally { setSaving(false) }
  }

  async function deleteTask() {
    if (!task || !window.confirm(`Delete "${task.title}"?`)) return
    setSaving(true); setError('')
    try {
      const response = await taskService.deleteLegacyTask(getLaravelContext(), task.id)
      if (Number(response.status_code) !== 1) throw new Error(response.message)
      onUpdated(); onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the task.')
    } finally { setSaving(false) }
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
          {error && <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
          {message && <div className="mb-4 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}

          {task && !loading && (
            <div className="space-y-6">
              {task.owner_id === getLaravelContext().userId && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => editing ? setEditing(false) : void startEditing()}><Edit2 className="mr-2 size-4" />{editing ? 'Cancel Edit' : 'Edit / Reassign'}</Button>
                  <Button variant="outline" className="text-danger" onClick={() => void deleteTask()} disabled={saving}><Trash2 className="mr-2 size-4" />Delete</Button>
                </div>
              )}
              {editing && (
                <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                  <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Task Title</span><input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-10 w-full rounded-lg border px-3 text-sm" /></label>
                  <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Description</span><textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="min-h-24 w-full rounded-lg border p-3 text-sm" /></label>
                  <label><span className="mb-1 block text-xs font-semibold">Assignee</span><Select value={editAssignee} onChange={setEditAssignee} options={employees.map((employee) => ({ value: employee.id, label: employee.name }))} /></label>
                  <label><span className="mb-1 block text-xs font-semibold">Priority</span><Select value={editPriority} onChange={setEditPriority} options={['High','Medium','Low'].map((value) => ({ value, label: value }))} /></label>
                  <label><span className="mb-1 block text-xs font-semibold">Due Date</span><input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="h-10 w-full rounded-lg border px-3 text-sm" /></label>
                  <div className="flex items-end"><Button onClick={() => void saveTask()} disabled={saving}>{saving ? 'Saving…' : 'Save Task'}</Button></div>
                </section>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Info icon={UserCircle2} label="Assigned to" value={task.assignee} />
                <Info icon={UserCircle2} label="Assigned by" value={task.owner} />
                <Info icon={CalendarDays} label="Due date" value={formatDate(task.due_date)} />
                <Info icon={FileText} label="Department" value={task.department || 'Not assigned'} />
                <Info icon={Clock} label="Priority / cadence" value={<PriorityBadge priority={task.priority ?? task.task_type} />} />
                <Info icon={CheckCircle2} label="Current status" value={<StatusBadge status={task.status} />} />
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

              {task.attachment && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Attachment</h3>
                  <div className="rounded-xl border p-4 text-sm">{task.attachment.name}</div>
                </section>
              )}

              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="text-sm font-semibold">Update status</h3>
                <Select
                  value={status}
                  onChange={(value) => setStatus(value as TaskStatus)}
                  options={STATUS_OPTIONS}
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
