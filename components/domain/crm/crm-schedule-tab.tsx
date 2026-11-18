'use client'

/**
 * A CRM record's own slice of the Task-Management calendar — every Event
 * (call/meeting/follow-up) scheduled against THIS Lead/Contact/Organization/
 * Opportunity/Ticket, read through the new
 * `/task-management/calendar/events/linked/{type}/{id}` endpoint rather than
 * the whole date-range feed. No new table: this is a filtered view over
 * `task_management_calendar_events`, the same entity CreateEventModal and
 * EventDetailsDrawer already read and write — reused here rather than a
 * parallel CRM-only calendar, per this gap's own brief.
 */

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { CreateEventModal } from '@/components/domain/task/create-event-modal'
import { EventDetailsDrawer } from '@/components/domain/task/event-details-drawer'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { CalendarEvent } from '@/types/task-management'
import type { LinkedRecordType } from './linked-record-picker'

interface Props {
  linkedType: LinkedRecordType
  linkedId: string
  /** Shown in the create modal's caption ("Linking to: <recordLabel>"). */
  recordLabel: string
}

function formatWhen(event: CalendarEvent): string {
  const start = new Date(event.start_at.replace(' ', 'T'))
  return event.all_day
    ? start.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : start.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function statusClasses(status: CalendarEvent['status']): string {
  if (status === 'Held') return 'bg-success/15 text-success'
  if (status === 'Cancelled') return 'bg-destructive/15 text-destructive'
  return 'bg-muted text-muted-foreground'
}

export function CrmScheduleTab({ linkedType, linkedId, recordLabel }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [openEventId, setOpenEventId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await taskService.getLinkedCalendarEvents(context, linkedType, linkedId)
      setEvents(response.data.entries)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load scheduled activities.')
    } finally {
      setLoading(false)
    }
  }, [linkedType, linkedId])

  useEffect(() => {
    // Deferred so this load's first setState lands after this render, same
    // reasoning every other CRM tab's own load effect already follows.
    queueMicrotask(() => { void load() })
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Scheduled Activities</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 size-4" aria-hidden="true" />
          Schedule
        </Button>
      </div>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Loading scheduled activities…
        </div>
      )}

      {!loading && events.length === 0 && !error && (
        <EmptyState
          icon={<CalendarClock className="size-8" aria-hidden="true" />}
          title="Nothing scheduled yet"
          description="Book a call, meeting, or follow-up against this record."
          action={(
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Schedule
            </Button>
          )}
        />
      )}

      {!loading && events.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setOpenEventId(event.id)}
              className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                <p className="truncate text-xs text-muted-foreground">{formatWhen(event)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClasses(event.status)}`}>
                {event.status}
              </span>
            </button>
          ))}
        </div>
      )}

      <CreateEventModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); void load() }}
        initialLink={{ type: linkedType, id: linkedId, label: recordLabel }}
      />
      <EventDetailsDrawer
        eventId={openEventId}
        open={openEventId !== null}
        onClose={() => setOpenEventId(null)}
        onUpdated={() => void load()}
      />
    </div>
  )
}
