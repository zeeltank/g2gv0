'use client'

import { useEffect, useState } from 'react'
import { ListTodo, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { Textarea } from '@/components/ui/textarea'
import { TimePicker } from '@/components/ui/time-picker'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { TaskStatusOption } from '@/types/task-management'
import { addOneHourToClock } from './time-follow'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: (message: string) => void
  /** Pre-fills the date when opened from a calendar empty-date click. */
  initialDate?: string
  /** Pre-fills the start time when opened from a week/day-view time-slot click. */
  initialTimeStart?: string
  /** Already fetched by the calendar's own load() — no extra call for this form alone. */
  statusOptions: TaskStatusOption[]
}

const SYSTEM_STATUS_FALLBACK: Array<{ label: string; value: string }> = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'In Progress', value: 'IN-PROGRESS' },
  { label: 'On Hold', value: 'ON HOLD' },
  { label: 'Completed', value: 'COMPLETED' },
]

/**
 * CRM's own "Calendar" activity type: an employee logging their own work for
 * a day, richer than the one-line QuickAddTaskBar but not the full
 * assign-to-someone-else CreateTaskModal (locked-in #5). Always self-assigned
 * - no assignee picker exists here, matching quickAdd's own backend reach.
 */
export function SelfTaskEntryModal({ isOpen, onClose, onCreated, initialDate, initialTimeStart, statusOptions }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [status, setStatus] = useState('PENDING')
  const [projectId, setProjectId] = useState('')
  const [workstreamId, setWorkstreamId] = useState('')
  const [projectOptions, setProjectOptions] = useState<SearchableOption[]>([])
  const [workstreamOptions, setWorkstreamOptions] = useState<SearchableOption[]>([])
  const [workstreamsLoading, setWorkstreamsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Reset-on-open, the same set-during-render pattern create-event-modal.tsx
  // and create-task-modal.tsx already use (this project's hooks lint forbids
  // reading a ref during render, so a plain boolean ref can't stand in here).
  const [seededOpen, setSeededOpen] = useState(false)
  if (isOpen && !seededOpen) {
    setSeededOpen(true)
    setTitle(''); setDescription('')
    setDate(initialDate ?? new Date().toISOString().slice(0, 10))
    setTimeStart(initialTimeStart ?? ''); setTimeEnd('')
    setStatus('PENDING')
    setProjectId(''); setWorkstreamId(''); setWorkstreamOptions([])
    setError('')
  } else if (!isOpen && seededOpen) {
    setSeededOpen(false)
  }

  useEffect(() => {
    if (!isOpen) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    let active = true
    queueMicrotask(() => {
      if (!active) return
      taskService.getProjectRecords(context, { perPage: 100, includeArchived: true })
        .then((response) => {
          if (!active) return
          setProjectOptions(response.data.projects.map((project) => ({ value: project.id, label: project.name })))
        })
        .catch(() => { /* the form still works with no project picked */ })
    })
    return () => { active = false }
  }, [isOpen])

  useEffect(() => {
    if (!projectId) {
      queueMicrotask(() => { setWorkstreamOptions([]); setWorkstreamId('') })
      return
    }
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    let active = true
    queueMicrotask(() => {
      if (!active) return
      setWorkstreamsLoading(true)
      taskService.getProjectRecord(context, projectId)
        .then((response) => {
          if (!active) return
          setWorkstreamOptions((response.data.workstreams ?? []).map((workstream) => ({ value: workstream.id, label: workstream.name })))
        })
        .catch(() => { if (active) setWorkstreamOptions([]) })
        .finally(() => { if (active) setWorkstreamsLoading(false) })
    })
    return () => { active = false }
  }, [projectId])

  const submit = async () => {
    const trimmed = title.trim()
    if (!trimmed || !date || submitting) return

    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true); setError('')
    try {
      const response = await taskService.quickAddMyTask(context, trimmed, date, {
        description: description.trim() || undefined,
        time_start: timeStart || undefined,
        time_end: timeEnd || undefined,
        status,
      })

      let message = response.message
      if (projectId) {
        try {
          await taskService.attachTaskToProject(context, projectId, response.data.id, workstreamId || undefined)
        } catch {
          // The task itself was created successfully - losing the project
          // link is worth surfacing, not worth discarding the task over.
          message = `${message} (Could not link it to the selected project.)`
        }
      }

      onCreated(message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create that task.')
    } finally {
      setSubmitting(false)
    }
  }

  const statusChoices = statusOptions.length > 0
    ? statusOptions.filter((option) => option.active).map((option) => ({ label: option.name, value: option.is_system ? option.category : option.name }))
    : SYSTEM_STATUS_FALLBACK

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription>Your own work for the day - not an assignment to someone else.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground"><ListTodo className="size-4" />Activity type</span>
            <span className="font-medium">Task</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground"><User className="size-4" />Assigned to</span>
            <span className="font-medium">You</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="self-task-title">Title</Label>
            <Input id="self-task-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What did you work on?" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="self-task-description">Description</Label>
            <Textarea id="self-task-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </div>

          {/* Date on its own row, Start/End as a 2-col row below - TimePicker's
              two-dropdown layout is wider than the native <input type="time">
              it replaces and no longer fits a 3-up grid. */}
          <div className="space-y-1.5">
            <Label htmlFor="self-task-date">Date</Label>
            <Input id="self-task-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="self-task-start">Start (optional)</Label>
              <TimePicker
                value={timeStart}
                onChange={(next) => { setTimeStart(next); setTimeEnd(addOneHourToClock(next)) }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="self-task-end">End (optional)</Label>
              <TimePicker value={timeEnd} onChange={setTimeEnd} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="self-task-status">Status</Label>
            <Select id="self-task-status" value={status} onChange={setStatus} options={statusChoices} />
          </div>

          <div className="space-y-1.5">
            <Label>Project (optional)</Label>
            <SearchableSelect
              value={projectId}
              onChange={setProjectId}
              options={projectOptions}
              placeholder="No project"
              searchPlaceholder="Search projects…"
            />
          </div>

          {projectId && (
            <div className="space-y-1.5">
              <Label>Workstream (optional)</Label>
              <SearchableSelect
                value={workstreamId}
                onChange={setWorkstreamId}
                options={workstreamOptions}
                placeholder={workstreamsLoading ? 'Loading…' : 'No workstream'}
                searchPlaceholder="Search workstreams…"
                disabled={workstreamsLoading}
              />
            </div>
          )}

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !title.trim() || !date}>
            {submitting ? 'Adding…' : 'Add Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
