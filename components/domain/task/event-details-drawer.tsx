'use client'

import { useEffect, useState } from 'react'
import { Bell, CalendarDays, Download, Repeat, Trash2, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { AttendeeEmailInput } from './attendee-email-input'
import { MemberPicker } from './member-picker'
import { RecurrenceRulePicker } from './recurrence-rule-picker'
import { RecurrenceScopeDialog } from './recurrence-scope-dialog'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { Attendee, CalendarEvent, RecurrenceRule, RecurrenceScope } from '@/types/task-management'

interface Props {
  eventId: string | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
}

/** `yyyy-MM-dd HH:mm:ss` -> `yyyy-MM-ddTHH:mm`, what <input type="datetime-local"> needs. */
function toInputDateTime(value: string): string {
  return value.slice(0, 16).replace(' ', 'T')
}

export function EventDetailsDrawer({ eventId, open, onClose, onUpdated }: Props) {
  const [event, setEvent] = useState<CalendarEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Core fields, editable directly - unlike the task drawer there is no
  // richer "assign form" to delegate to here, so this stays inline.
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(null)
  const [recurrenceBusy, setRecurrenceBusy] = useState(false)
  const [editingRecurrence, setEditingRecurrence] = useState(false)
  const [draftRecurrence, setDraftRecurrence] = useState<RecurrenceRule | null>({ frequency: 'weekly', interval: 1, until: null })

  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null)
  const [reminderBusy, setReminderBusy] = useState(false)

  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [attendeesBusy, setAttendeesBusy] = useState(false)
  const [newAttendeeEmails, setNewAttendeeEmails] = useState<string[]>([])
  // Internal employees, alongside (not replacing) external email invitees -
  // same superset reasoning as create-event-modal.tsx's own picker.
  const [newAttendeeUserIds, setNewAttendeeUserIds] = useState<string[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ id: string; name: string }>>([])

  const [deleteScopeOpen, setDeleteScopeOpen] = useState(false)

  useEffect(() => {
    if (!open || !eventId) return
    const id = eventId

    let active = true
    // Deferred so the load's first setState lands after this render.
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
      taskService.getCalendarEvent(context, id)
        .then((response) => {
          if (!active) return
          const data = response.data
          setEvent(data)
          setTitle(data.title)
          setDescription(data.description ?? '')
          setLocation(data.location ?? '')
          setAllDay(data.all_day)
          setStartAt(toInputDateTime(data.start_at))
          setEndAt(toInputDateTime(data.end_at))
          setIsPrivate(data.visibility === 'PRIVATE')
          setEditingRecurrence(false)
          setNewAttendeeEmails([])
          setNewAttendeeUserIds([])

          if (data.recurrence_id) {
            taskService.getEventRecurrence(context, id)
              .then((recurrenceResponse) => { if (active) setRecurrence(recurrenceResponse.data.recurrence) })
              .catch(() => { /* the drawer still works without the recurrence summary */ })
          } else {
            setRecurrence(null)
          }

          taskService.getEventReminder(context, id)
            .then((reminderResponse) => { if (active) setReminderMinutes(reminderResponse.data.reminder?.minutes_before ?? null) })
            .catch(() => { /* the drawer still works without the reminder summary */ })

          taskService.getEventAttendees(context, id)
            .then((attendeesResponse) => { if (active) setAttendees(attendeesResponse.data.attendees) })
            .catch(() => { /* the drawer still works without the attendee list */ })
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : 'Unable to load this event.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }

    return () => { active = false }
  }, [open, eventId])

  useEffect(() => {
    if (!open) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    let active = true
    queueMicrotask(() => {
      if (!active) return
      taskService.getProjectOptions(context)
        .then((response) => { if (active) setEmployeeOptions(response.data.users) })
        .catch(() => { /* the section still works with email invitees only */ })
    })
    return () => { active = false }
  }, [open])

  async function saveCore() {
    if (!event) return
    if (!title.trim() || !startAt || !endAt) {
      setError('Title, start and end are required.')
      return
    }
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await taskService.updateCalendarEvent(getLaravelContext(), event.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        start_at: startAt.replace('T', ' '),
        end_at: endAt.replace('T', ' '),
        all_day: allDay,
        visibility: isPrivate ? 'PRIVATE' : 'PUBLIC',
      })
      setEvent(response.data)
      setMessage(response.message)
      onUpdated()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save this event.')
    } finally {
      setSaving(false)
    }
  }

  /** Part of a series — ask which occurrences, rather than assuming "all". */
  function deleteEvent() {
    if (!event) return
    if (event.recurrence_id) { setDeleteScopeOpen(true); return }
    if (!window.confirm(`Delete "${event.title}"?`)) return
    void deleteEventWithScope('all')
  }

  async function deleteEventWithScope(scope: RecurrenceScope) {
    if (!event) return
    setDeleteScopeOpen(false)
    setSaving(true); setError('')
    try {
      await taskService.deleteCalendarEvent(getLaravelContext(), event.id, scope)
      onUpdated(); onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the event.')
    } finally {
      setSaving(false)
    }
  }

  /**
   * NO SCOPE DIALOG HERE, DELIBERATELY. Unlike the whole-event delete above,
   * neither backend endpoint behind this section has a real scope concept:
   * recurrenceUpsert always reshapes the series going FORWARD from this
   * entry (there is no "this occurrence only" rule to set), and
   * recurrenceDestroy hardcodes scope='all' server-side regardless of what
   * a caller sends. Offering a this/this-and-following/all choice that the
   * server silently ignores would be a UI that lies — so this mirrors
   * my-task-details-drawer.tsx's own recurrence section exactly, which has
   * never used the scope dialog for this either.
   */
  async function saveRecurrence(rule: RecurrenceRule) {
    if (!event) return
    setRecurrenceBusy(true); setError(''); setMessage('')
    try {
      const response = await taskService.upsertEventRecurrence(getLaravelContext(), event.id, rule)
      setRecurrence(response.data.recurrence)
      setEvent({ ...event, recurrence_id: response.data.recurrence.event_id ?? event.id })
      setEditingRecurrence(false)
      setMessage(`${response.message} ${response.data.created_count} upcoming occurrence${response.data.created_count === 1 ? '' : 's'} created.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the repeat schedule.')
    } finally {
      setRecurrenceBusy(false)
    }
  }

  async function removeRecurrence() {
    if (!event || !window.confirm('Stop this event from repeating? Past and already-created occurrences are unaffected.')) return
    setRecurrenceBusy(true); setError(''); setMessage('')
    try {
      const response = await taskService.deleteEventRecurrence(getLaravelContext(), event.id)
      setRecurrence(null)
      setEvent({ ...event, recurrence_id: null })
      setMessage(response.message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to remove the repeat schedule.')
    } finally {
      setRecurrenceBusy(false)
    }
  }

  async function setReminder(minutes: number) {
    if (!event) return
    setReminderBusy(true); setError(''); setMessage('')
    try {
      const response = await taskService.upsertEventReminder(getLaravelContext(), event.id, minutes)
      setReminderMinutes(response.data.reminder.minutes_before)
      setMessage(response.message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the reminder.')
    } finally {
      setReminderBusy(false)
    }
  }

  async function clearReminder() {
    if (!event) return
    setReminderBusy(true); setError(''); setMessage('')
    try {
      const response = await taskService.deleteEventReminder(getLaravelContext(), event.id)
      setReminderMinutes(null)
      setMessage(response.message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to remove the reminder.')
    } finally {
      setReminderBusy(false)
    }
  }

  async function refreshAttendees() {
    if (!event) return
    try {
      const response = await taskService.getEventAttendees(getLaravelContext(), event.id)
      setAttendees(response.data.attendees)
    } catch { /* non-fatal */ }
  }

  async function inviteNewAttendees() {
    const total = newAttendeeEmails.length + newAttendeeUserIds.length
    if (!event || !total) return
    setAttendeesBusy(true); setError(''); setMessage('')
    try {
      await Promise.all([
        ...newAttendeeEmails.map((email) => taskService.inviteAttendee(getLaravelContext(), event.id, undefined, email)),
        ...newAttendeeUserIds.map((userId) => taskService.inviteAttendee(getLaravelContext(), event.id, userId)),
      ])
      setMessage(`${total} attendee${total === 1 ? '' : 's'} invited.`)
      setNewAttendeeEmails([]); setNewAttendeeUserIds([])
      await refreshAttendees()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to invite those attendees.')
    } finally {
      setAttendeesBusy(false)
    }
  }

  async function removeAttendee(attendeeId: string) {
    if (!event) return
    setAttendeesBusy(true); setError('')
    try {
      await taskService.removeAttendee(getLaravelContext(), event.id, attendeeId)
      await refreshAttendees()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to remove that attendee.')
    } finally {
      setAttendeesBusy(false)
    }
  }

  // Mirrors my-task-details-drawer.tsx's own gate exactly: owner only. A
  // viewer seeing this event through a share they did not grant themselves
  // must not see edit controls, even if a privileged backend role would
  // technically accept the write.
  const canEdit = Boolean(event) && event?.owner_id === getLaravelContext().userId

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-[640px]">
        <SheetHeader className="border-b p-6">
          <SheetTitle>{event?.title ?? 'Event details'}</SheetTitle>
          <SheetDescription>Verified event information from Laravel</SheetDescription>
        </SheetHeader>

        <div className="h-[calc(100vh-98px)] overflow-y-auto p-6">
          {loading && <div className="flex h-48 items-center justify-center"><Spinner /></div>}
          {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
          {message && <div className="mb-4 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}

          {event && !loading && (
            <div className="space-y-6">
              <div className="flex justify-end gap-2">
                {/* Read action — available to anyone who can see this event, not ownership-gated. */}
                <a
                  href={taskService.eventIcsUrl(getLaravelContext(), event.id)}
                  className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <Download className="size-4" />Export .ics
                </a>
                {canEdit && (
                  <Button variant="outline" className="text-destructive" onClick={() => void deleteEvent()} disabled={saving}>
                    <Trash2 className="mr-2 size-4" />Delete
                  </Button>
                )}
              </div>

              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="text-sm font-semibold">Details</h3>
                {canEdit ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="event-title-edit">Title</Label>
                      <input id="event-title-edit" value={title} onChange={(event) => setTitle(event.target.value)} className="h-10 w-full rounded-lg border px-3 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="event-description-edit">Description</Label>
                      <textarea id="event-description-edit" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="min-h-20 w-full resize-none rounded-lg border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="event-location-edit">Location</Label>
                      <input id="event-location-edit" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Conference Room A, or a meeting link" className="h-10 w-full rounded-lg border px-3 text-sm" />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <Label htmlFor="event-all-day-edit" className="cursor-pointer">All day</Label>
                      <Switch id="event-all-day-edit" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label htmlFor="event-private-edit" className="cursor-pointer">Private</Label>
                        <p className="text-xs text-muted-foreground">Hidden from everyone except you and anyone with elevated access.</p>
                      </div>
                      {/* Part of the SAME draft as title/description/etc, saved
                          together by the button below - there is no dedicated
                          single-field visibility endpoint for events the way
                          there is for tasks, so toggling this and firing an
                          immediate save would send whatever `isPrivate` was
                          BEFORE this change (setState does not apply within
                          the same handler) unless it waits for Save changes
                          like everything else here. */}
                      <Switch id="event-private-edit" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
                    </div>
                    {/* Date and time as separate inputs, matching CRM's own
                        popup layout - not a single combined datetime-local field. */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="event-start-edit">Starts</Label>
                        <div className="flex gap-2">
                          <input id="event-start-edit" type="date" value={startAt.slice(0, 10)} onChange={(event) => setStartAt(`${event.target.value}T${startAt.slice(11) || '00:00'}`)} className="h-10 w-full rounded-lg border px-3 text-sm" />
                          {!allDay && <input aria-label="Start time" type="time" value={startAt.slice(11)} onChange={(event) => setStartAt(`${startAt.slice(0, 10)}T${event.target.value}`)} className="h-10 w-full rounded-lg border px-3 text-sm" />}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="event-end-edit">Ends</Label>
                        <div className="flex gap-2">
                          <input id="event-end-edit" type="date" value={endAt.slice(0, 10)} onChange={(event) => setEndAt(`${event.target.value}T${endAt.slice(11) || '23:59'}`)} className="h-10 w-full rounded-lg border px-3 text-sm" />
                          {!allDay && <input aria-label="End time" type="time" value={endAt.slice(11)} onChange={(event) => setEndAt(`${endAt.slice(0, 10)}T${event.target.value}`)} className="h-10 w-full rounded-lg border px-3 text-sm" />}
                        </div>
                      </div>
                    </div>
                    <Button onClick={() => void saveCore()} disabled={saving || !title.trim()} className="w-full">
                      {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info icon={CalendarDays} label="Starts" value={formatDateTime(event.start_at, event.all_day)} />
                    <Info icon={CalendarDays} label="Ends" value={formatDateTime(event.end_at, event.all_day)} />
                    {event.location && <Info icon={Users} label="Location" value={event.location} />}
                    {event.description && (
                      <div className="col-span-full rounded-xl bg-muted/30 p-4 text-sm leading-6 text-foreground/80">{event.description}</div>
                    )}
                  </div>
                )}
              </section>

              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Repeat className="size-4" /> Repeat
                </h3>
                {recurrence ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Every {recurrence.interval} {recurrence.frequency}
                      {recurrence.interval > 1 ? (recurrence.frequency === 'daily' ? 's' : recurrence.frequency === 'weekly' ? ' weeks' : ' months') : ''}
                      {recurrence.until ? ` until ${formatDate(recurrence.until)}` : ', with no end date'}.
                    </p>
                    {canEdit && (
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => void removeRecurrence()} disabled={recurrenceBusy}>
                        Stop repeating
                      </Button>
                    )}
                  </div>
                ) : editingRecurrence ? (
                  <div className="space-y-3">
                    <RecurrenceRulePicker value={draftRecurrence} onChange={setDraftRecurrence} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => draftRecurrence && void saveRecurrence(draftRecurrence)} disabled={recurrenceBusy || !draftRecurrence}>
                        {recurrenceBusy ? 'Saving…' : 'Save'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingRecurrence(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : canEdit ? (
                  <Button variant="outline" size="sm" onClick={() => setEditingRecurrence(true)}>Set up a repeat schedule</Button>
                ) : (
                  <p className="text-sm text-muted-foreground">This event does not repeat.</p>
                )}
              </section>

              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Bell className="size-4" /> Reminder
                </h3>
                <div className="flex items-center gap-2">
                  <Select
                    value={reminderMinutes === null ? 'none' : String(reminderMinutes)}
                    onChange={(value) => {
                      if (value === 'none') { void clearReminder(); return }
                      void setReminder(Number(value))
                    }}
                    options={[
                      { label: 'No reminder', value: 'none' },
                      { label: '5 minutes before', value: '5' },
                      { label: '30 minutes before', value: '30' },
                      { label: '1 hour before', value: '60' },
                      { label: '1 day before', value: '1440' },
                      { label: '1 week before', value: '10080' },
                    ]}
                    className="flex-1"
                  />
                  {reminderBusy && <Spinner className="size-4" />}
                </div>
              </section>

              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4" /> Attendees
                </h3>
                {attendees.length > 0 ? (
                  <ul className="space-y-1.5">
                    {attendees.map((attendee) => (
                      <li key={attendee.id} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5 text-sm">
                        <span className="min-w-0 truncate">{attendee.name}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${attendee.status === 'accepted' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                            {attendee.status === 'accepted' ? 'Accepted' : 'Invited'}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              aria-label={`Remove ${attendee.name}`}
                              onClick={() => void removeAttendee(attendee.id)}
                              disabled={attendeesBusy}
                              className="text-muted-foreground transition-colors hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No attendees invited yet.</p>
                )}

                {canEdit && (
                  <div className="space-y-2 border-t pt-3">
                    <MemberPicker value={newAttendeeUserIds} options={employeeOptions} onChange={setNewAttendeeUserIds} placeholder="Invite an employee…" disabled={attendeesBusy} />
                    <AttendeeEmailInput value={newAttendeeEmails} onChange={setNewAttendeeEmails} disabled={attendeesBusy} />
                    <Button size="sm" variant="outline" onClick={() => void inviteNewAttendees()} disabled={attendeesBusy || (!newAttendeeEmails.length && !newAttendeeUserIds.length)}>
                      <UserPlus className="mr-2 size-4" />{attendeesBusy ? 'Inviting…' : 'Invite'}
                    </Button>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </SheetContent>
      <RecurrenceScopeDialog
        open={deleteScopeOpen}
        action="delete"
        onChoose={(scope) => void deleteEventWithScope(scope)}
        onCancel={() => setDeleteScopeOpen(false)}
      />
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
  if (!value) return ''
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(value: string, allDay: boolean) {
  const date = new Date(value.replace(' ', 'T'))
  return allDay
    ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
