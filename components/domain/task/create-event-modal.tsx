'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { TimePicker } from '@/components/ui/time-picker'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import { AttendeeEmailInput } from './attendee-email-input'
import { MemberPicker } from './member-picker'
import { RecurrenceRulePicker } from './recurrence-rule-picker'
import { addOneHourToDateTimeLocal } from './time-follow'
import type { RecurrenceRule } from '@/types/task-management'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: (message: string) => void
  /** Pre-fills start/end when opened from a calendar day-cell click. */
  initialDate?: string
}

/**
 * A genuine calendar Event (a meeting/call) — distinct from a Task.
 *
 * This is the ONLY place in the frontend that calls
 * POST /task-management/calendar/events. Without it, the backend's
 * task_management_calendar_events table has no way to ever be populated by a
 * real user — the calendar's "Add Task" button opens SelfTaskEntryModal
 * instead, which never reaches this endpoint at all.
 */
export function CreateEventModal({ isOpen, onClose, onCreated, initialDate }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(null)
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null)
  const [isPrivate, setIsPrivate] = useState(false)
  // External-email invitees, collected before the event exists - sent as
  // individual invites once creation succeeds and a real event id exists.
  // An internal-user picker is left out of this create-time flow: this modal
  // stays a lightweight "set up the meeting" form, not an assignment form.
  const [attendeeEmails, setAttendeeEmails] = useState<string[]>([])
  // Internal employees, alongside (not replacing) external email invitees -
  // CRM's own Events form is employee-only; external email is this app's
  // existing superset, worth keeping rather than a regression to fix.
  const [attendeeUserIds, setAttendeeUserIds] = useState<string[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ id: string; name: string }>>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    let active = true
    queueMicrotask(() => {
      if (!active) return
      taskService.getProjectOptions(context)
        .then((response) => { if (active) setEmployeeOptions(response.data.users) })
        .catch(() => { /* the form still works with email invitees only */ })
    })
    return () => { active = false }
  }, [isOpen])

  // Reset the form the moment this opens — set-during-render (not inside an
  // effect), the same escape from the cascading-render lint rule
  // create-task-modal.tsx's own `seed`/`seededFrom` STATE pair already uses.
  // A plain boolean ref would read as cleaner but this project's hooks lint
  // forbids reading `.current` during render at all (refs may only be read
  // in effects/handlers) — state is the only render-safe way to compare
  // "have I already seeded this open".
  const [seededOpen, setSeededOpen] = useState(false)
  if (isOpen && !seededOpen) {
    setSeededOpen(true)
    const day = initialDate ?? new Date().toISOString().slice(0, 10)
    setTitle('')
    setDescription('')
    setLocation('')
    setAllDay(false)
    setStartAt(`${day}T10:00`)
    setEndAt(`${day}T11:00`)
    setRecurrence(null)
    setReminderMinutes(null)
    setIsPrivate(false)
    setAttendeeEmails([])
    setAttendeeUserIds([])
    setError('')
  } else if (!isOpen && seededOpen) {
    setSeededOpen(false)
  }

  const submit = async () => {
    const trimmed = title.trim()
    if (!trimmed || !startAt || !endAt) return

    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await taskService.createCalendarEvent(context, {
        title: trimmed,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        // datetime-local has no seconds/zone; the server stores it as given.
        start_at: startAt.replace('T', ' '),
        end_at: endAt.replace('T', ' '),
        all_day: allDay,
        visibility: isPrivate ? 'PRIVATE' : 'PUBLIC',
      })

      let message = response.message
      if (recurrence) {
        const recurrenceResult = await taskService.upsertEventRecurrence(context, response.data.id, recurrence)
        message = `${message} ${recurrenceResult.data.created_count} more occurrence${recurrenceResult.data.created_count === 1 ? '' : 's'} created.`
      }
      if (reminderMinutes !== null) {
        await taskService.upsertEventReminder(context, response.data.id, reminderMinutes)
      }
      const attendeeCount = attendeeEmails.length + attendeeUserIds.length
      if (attendeeCount > 0) {
        await Promise.all([
          ...attendeeEmails.map((email) => taskService.inviteAttendee(context, response.data.id, undefined, email)),
          ...attendeeUserIds.map((userId) => taskService.inviteAttendee(context, response.data.id, userId)),
        ])
        message = `${message} ${attendeeCount} attendee${attendeeCount === 1 ? '' : 's'} invited.`
      }

      onCreated(message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create that event.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>New Event</DialogTitle>
          <DialogDescription>A meeting or call on your calendar — separate from a task.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
            <div className="space-y-1.5">
              <Label htmlFor="event-title">Title</Label>
              <Input id="event-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Weekly sync with design" autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-description">Description</Label>
              <Textarea id="event-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-location">Location</Label>
              <Input id="event-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Conference Room A, or a meeting link" />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="event-all-day" className="cursor-pointer">All day</Label>
              <Switch id="event-all-day" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="event-private" className="cursor-pointer">Private</Label>
                <p className="text-xs text-muted-foreground">Hidden from everyone except you and anyone with elevated access.</p>
              </div>
              <Switch id="event-private" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
            </div>

            {/* Date and time as separate inputs, matching CRM's own popup
                layout - not a single combined datetime-local field. */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="event-start-date">Starts</Label>
                <div className="flex gap-2">
                  <Input id="event-start-date" type="date" value={startAt.slice(0, 10)} onChange={(event) => setStartAt(`${event.target.value}T${startAt.slice(11) || '00:00'}`)} />
                  {!allDay && (
                    <TimePicker
                      value={startAt.slice(11)}
                      onChange={(next) => {
                        const nextStart = `${startAt.slice(0, 10)}T${next}`
                        setStartAt(nextStart)
                        setEndAt(addOneHourToDateTimeLocal(nextStart))
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-end-date">Ends</Label>
                <div className="flex gap-2">
                  <Input id="event-end-date" type="date" value={endAt.slice(0, 10)} onChange={(event) => setEndAt(`${event.target.value}T${endAt.slice(11) || '23:59'}`)} />
                  {!allDay && <TimePicker value={endAt.slice(11)} onChange={(next) => setEndAt(`${endAt.slice(0, 10)}T${next}`)} />}
                </div>
              </div>
            </div>

            <RecurrenceRulePicker value={recurrence} onChange={setRecurrence} />

            <div className="space-y-1.5">
              <Label htmlFor="event-reminder">Reminder</Label>
              <Select
                value={reminderMinutes === null ? 'none' : String(reminderMinutes)}
                onChange={(value) => setReminderMinutes(value === 'none' ? null : Number(value))}
                options={[
                  { label: 'No reminder', value: 'none' },
                  { label: '5 minutes before', value: '5' },
                  { label: '30 minutes before', value: '30' },
                  { label: '1 hour before', value: '60' },
                  { label: '1 day before', value: '1440' },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Invite employees</Label>
              <MemberPicker value={attendeeUserIds} options={employeeOptions} onChange={setAttendeeUserIds} placeholder="Invite an employee…" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-attendee">Invite attendees (email)</Label>
              <AttendeeEmailInput value={attendeeEmails} onChange={setAttendeeEmails} />
            </div>

            {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !title.trim()}>
            {submitting ? 'Creating…' : 'Create Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
