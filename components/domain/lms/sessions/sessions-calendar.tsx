'use client'

import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Loader2,
  List as ListIcon,
  MapPin,
  Monitor,
  Pencil,
  Plus,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react'
import { format, isSameDay, parseISO } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { SearchInput } from '@/components/ui/search-input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useSessions } from '@/hooks/use-sessions'
import type { SeatStatus, SessionPayload, TrainingSession } from '@/services/lms'
import { SessionFormSheet } from './session-form-sheet'

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/**
 * The grid defaults to 8AM–8PM, but widens to fit whatever the week actually
 * holds. A fixed window silently dropped early and late sessions: they appeared
 * in the list view but had no cell to be drawn in, which reads as data loss.
 */
const DEFAULT_START_HOUR = 8
const DEFAULT_END_HOUR = 20

function hourLabel(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display} ${suffix}`
}

function toMinutes(time: string | null) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

function timeRange(session: TrainingSession) {
  const from = (session.from_time ?? '').slice(0, 5)
  const to = (session.to_time ?? '').slice(0, 5)
  return from && to ? `${from} – ${to}` : from || '—'
}

const SEAT_VARIANT: Record<SeatStatus, 'active' | 'pending' | 'error' | 'inactive'> = {
  open: 'active',
  'almost-full': 'pending',
  full: 'error',
  closed: 'inactive',
}

const SEAT_LABEL: Record<SeatStatus, string> = {
  open: 'Open',
  'almost-full': 'Almost full',
  full: 'Full',
  closed: 'Closed',
}

/** Client-side CSV of the visible week — there is no export endpoint. */
function exportCsv(sessions: TrainingSession[]) {
  const headers = ['Session', 'Format', 'Trainer', 'Date', 'Start', 'End', 'Venue/Link', 'Registered', 'Seats', 'Status']
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`

  const rows = sessions.map((session) =>
    [
      session.room_name,
      session.session_type,
      session.trainer_name,
      session.event_date,
      (session.from_time ?? '').slice(0, 5),
      (session.to_time ?? '').slice(0, 5),
      session.session_type === 'virtual' ? session.url : session.venue,
      session.registered_count,
      session.seats_total ?? 'Unlimited',
      SEAT_LABEL[session.seat_status],
    ]
      .map(escape)
      .join(','),
  )

  const blob = new Blob([[headers.map(escape).join(','), ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `sessions-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  loading,
}: {
  label: string
  value: number
  sub: string
  icon: React.ElementType
  loading: boolean
}) {
  return (
    <Card className="rounded-xl border-border/80 shadow-sm">
      <CardContent className="p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Icon className="size-4" /> {label}
        </p>
        {loading ? (
          <Skeleton className="mt-1.5 h-7 w-12" />
        ) : (
          <h3 className="mt-1 text-2xl font-black tracking-tight text-foreground">{value}</h3>
        )}
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export function SessionsCalendar() {
  const { user } = useAuth()
  // Scheduling is an admin/HR action; the API enforces the same rule.
  const canManage = user?.role === 'admin' || user?.role === 'hr'

  const {
    sessions, deadlines, stats, loading, error, reload,
    weekStart, weekDays, goToWeek, goToToday,
    search, setSearch,
    saving, message, actionError, dismiss,
    createSession, updateSession, removeSession, register, cancelRegistration,
    attendees, attendeesLoading, loadAttendees,
  } = useSessions()

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [selected, setSelected] = useState<TrainingSession | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TrainingSession | null>(null)
  const [pendingDelete, setPendingDelete] = useState<TrainingSession | null>(null)

  // Widen the grid to cover every session in the week. A session ending at
  // 21:30 needs the 21:00 row present, hence the ceil on the end bound.
  const hours = useMemo(() => {
    let start = DEFAULT_START_HOUR
    let end = DEFAULT_END_HOUR

    for (const session of sessions) {
      const from = toMinutes(session.from_time)
      const to = toMinutes(session.to_time)
      if (from !== null) start = Math.min(start, Math.floor(from / 60))
      if (to !== null) end = Math.max(end, Math.ceil(to / 60))
    }

    start = Math.max(0, start)
    end = Math.min(24, Math.max(end, start + 1))

    return Array.from({ length: end - start }, (_, index) => start + index)
  }, [sessions])

  /** Whole-day markers keyed by yyyy-MM-dd, drawn under each day's header. */
  const deadlinesByDay = useMemo(() => {
    const map = new Map<string, typeof deadlines>()
    for (const deadline of deadlines) {
      const key = (deadline.date ?? '').slice(0, 10)
      if (!key) continue
      const bucket = map.get(key)
      if (bucket) bucket.push(deadline)
      else map.set(key, [deadline])
    }
    return map
  }, [deadlines])

  const openDetail = (session: TrainingSession) => {
    setSelected(session)
    if (canManage) loadAttendees(session.id)
  }

  const handleSubmit = (payload: SessionPayload, id?: number) =>
    id ? updateSession(id, payload) : createSession(payload)

  if (error && !loading && sessions.length === 0) {
    return (
      <div className="p-6">
        <ErrorState title="Couldn't load the schedule" description={error} retry={reload} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sessions &amp; Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule instructor-led training and manage who attends.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => exportCsv(sessions)}
            disabled={sessions.length === 0}
          >
            <Download className="size-4" /> Export
          </Button>
          {canManage && (
            <Button
              className="gap-2"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus className="size-4" /> New Session
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm font-medium text-success">
          <span className="flex items-center gap-2"><CheckCircle2 className="size-4" />{message}</span>
          <button type="button" onClick={dismiss} aria-label="Dismiss"><X className="size-3.5" /></button>
        </div>
      )}
      {(actionError || error) && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive">
          <span className="flex items-center gap-2"><AlertTriangle className="size-4" />{actionError ?? error}</span>
          <button type="button" onClick={dismiss} aria-label="Dismiss"><X className="size-3.5" /></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Upcoming Sessions" value={stats?.upcoming_sessions ?? 0} sub="Next 30 days" icon={CalendarIcon} loading={loading} />
        <KpiCard label="Total Registrations" value={stats?.total_registrations ?? 0} sub="Across all sessions" icon={Users} loading={loading} />
        <KpiCard label="Open Sessions" value={stats?.open_sessions ?? 0} sub="Seats available" icon={CheckSquare} loading={loading} />
        <KpiCard label="Full Sessions" value={stats?.full_sessions ?? 0} sub="No seats left" icon={Users} loading={loading} />
        <KpiCard label="Sessions This Month" value={stats?.sessions_this_month ?? 0} sub="In this month" icon={Clock} loading={loading} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search sessions, trainers or venues..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/50 p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                viewMode === 'calendar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              <CalendarIcon className="size-3.5" /> Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              <ListIcon className="size-3.5" /> List
            </button>
          </div>

          <Button variant="outline" size="icon" className="size-8" onClick={() => goToWeek(-1)} aria-label="Previous week">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[190px] text-center text-sm font-semibold text-foreground">
            {format(weekStart, 'dd MMM')} – {format(weekDays[6], 'dd MMM yyyy')}
          </span>
          <Button variant="outline" size="icon" className="size-8" onClick={() => goToWeek(1)} aria-label="Next week">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={goToToday}>
            Today
          </Button>
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Calendar — a real week computed from weekStart, not a fixed label list. */}
      {viewMode === 'calendar' && (
        <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-border/60">
              <div />
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'border-l border-border/40 px-2 py-2 text-center',
                    isSameDay(day, new Date()) && 'bg-primary/5',
                  )}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {format(day, 'EEE')}
                  </p>
                  <p
                    className={cn(
                      'text-sm font-bold',
                      isSameDay(day, new Date()) ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {format(day, 'd')}
                  </p>

                  {/* Deadlines carry a date but no time, so they belong in the
                      header rather than in an hour slot. */}
                  {(deadlinesByDay.get(format(day, 'yyyy-MM-dd')) ?? [])
                    .slice(0, 2)
                    .map((deadline, index) => (
                      <p
                        key={`${deadline.kind}-${deadline.user_id ?? 'org'}-${index}`}
                        title={
                          deadline.learner_name
                            ? `${deadline.title} — ${deadline.learner_name}`
                            : (deadline.title ?? '')
                        }
                        className={cn(
                          'mt-1 truncate rounded px-1 py-0.5 text-[9px] font-semibold',
                          deadline.kind === 'course-deadline'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {deadline.title ?? 'Deadline'}
                      </p>
                    ))}

                  {(deadlinesByDay.get(format(day, 'yyyy-MM-dd'))?.length ?? 0) > 2 && (
                    <p className="mt-0.5 text-[9px] font-medium text-muted-foreground">
                      +{(deadlinesByDay.get(format(day, 'yyyy-MM-dd'))?.length ?? 0) - 2} more
                    </p>
                  )}
                </div>
              ))}
            </div>

            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-border/30">
                <div className="px-2 py-3 text-right text-[11px] font-medium text-muted-foreground">
                  {hourLabel(hour)}
                </div>
                {weekDays.map((day) => {
                  const cellSessions = sessions.filter((session) => {
                    if (!session.event_date) return false
                    const start = toMinutes(session.from_time)
                    return (
                      isSameDay(parseISO(session.event_date), day) &&
                      start !== null &&
                      Math.floor(start / 60) === hour
                    )
                  })

                  return (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className="min-h-[52px] border-l border-border/40 p-1"
                    >
                      {cellSessions.map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => openDetail(session)}
                          className={cn(
                            'mb-1 w-full rounded-md border p-1.5 text-left transition-colors',
                            session.session_type === 'classroom'
                              ? 'border-warning/30 bg-warning/10 hover:bg-warning/20'
                              : 'border-primary/30 bg-primary/10 hover:bg-primary/20',
                          )}
                        >
                          <p className="truncate text-[11px] font-bold text-foreground">
                            {session.room_name}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {timeRange(session)}
                          </p>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {viewMode === 'list' && (
        <div className="rounded-xl border border-border/80 bg-card shadow-sm">
          {loading && sessions.length === 0 ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<CalendarIcon className="size-8" />}
                title="No sessions this week"
                description={
                  search
                    ? 'Try a different search term or another week.'
                    : 'Nothing is scheduled for the selected week.'
                }
                action={
                  canManage ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditing(null)
                        setFormOpen(true)
                      }}
                    >
                      Schedule a session
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(session)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {session.session_type === 'classroom' ? (
                          <MapPin className="size-4 shrink-0 text-warning" />
                        ) : (
                          <Video className="size-4 shrink-0 text-primary" />
                        )}
                        <span className="font-semibold text-foreground">{session.room_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{session.trainer_name || '—'}</TableCell>
                    <TableCell>
                      {session.event_date ? format(parseISO(session.event_date), 'dd MMM') : '—'}
                      <span className="ml-2 text-xs text-muted-foreground">{timeRange(session)}</span>
                    </TableCell>
                    <TableCell>
                      {session.registered_count}
                      {session.seats_total !== null ? ` / ${session.seats_total}` : ''}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={SEAT_VARIANT[session.seat_status]}
                        className="text-[10px] font-bold uppercase tracking-wider"
                      >
                        {SEAT_LABEL[session.seat_status]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0"
                              aria-label="Edit session"
                              onClick={() => {
                                setEditing(session)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0 text-destructive hover:text-destructive"
                              aria-label="Cancel session"
                              onClick={() => setPendingDelete(session)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Detail sheet */}
      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.room_name}</SheetTitle>
                <SheetDescription>
                  {selected.session_type === 'classroom' ? 'Classroom session' : 'Virtual session'}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-4 pt-2">
                <StatusBadge
                  variant={SEAT_VARIANT[selected.seat_status]}
                  className="w-fit text-[10px] font-bold uppercase tracking-wider"
                >
                  {SEAT_LABEL[selected.seat_status]}
                </StatusBadge>

                <div className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                  <span className="font-medium text-muted-foreground">Date</span>
                  <span className="font-semibold text-foreground">
                    {selected.event_date ? format(parseISO(selected.event_date), 'EEEE, dd MMM yyyy') : '—'}
                  </span>
                  <span className="font-medium text-muted-foreground">Time</span>
                  <span className="font-semibold text-foreground">{timeRange(selected)}</span>
                  <span className="font-medium text-muted-foreground">Trainer</span>
                  <span className="font-semibold text-foreground">{selected.trainer_name || '—'}</span>
                  {selected.trainer_email && (
                    <>
                      <span className="font-medium text-muted-foreground">Contact</span>
                      <span className="truncate font-semibold text-foreground">{selected.trainer_email}</span>
                    </>
                  )}
                  <span className="font-medium text-muted-foreground">
                    {selected.session_type === 'classroom' ? 'Venue' : 'Link'}
                  </span>
                  <span className="truncate font-semibold text-foreground">
                    {selected.session_type === 'classroom'
                      ? selected.venue || '—'
                      : selected.url || '—'}
                  </span>
                  <span className="font-medium text-muted-foreground">Seats</span>
                  <span className="font-semibold text-foreground">
                    {selected.registered_count}
                    {selected.seats_total !== null
                      ? ` of ${selected.seats_total} (${selected.seats_available} left)`
                      : ' registered (unlimited)'}
                  </span>
                </div>

                {selected.description && (
                  <p className="text-sm text-muted-foreground">{selected.description}</p>
                )}
                {selected.notes && (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Joining notes
                    </p>
                    <p className="mt-1 text-xs text-foreground">{selected.notes}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {selected.session_type === 'virtual' && selected.url && selected.is_registered && (
                    <a href={selected.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-2">
                        <ExternalLink className="size-3.5" /> Join
                      </Button>
                    </a>
                  )}

                  {selected.is_registered ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={async () => {
                        const result = await cancelRegistration(selected.id)
                        if (result.ok) setSelected(null)
                      }}
                    >
                      Cancel my registration
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={saving || selected.seat_status === 'full' || selected.is_past}
                      onClick={async () => {
                        const result = await register(selected.id)
                        if (result.ok) setSelected(null)
                      }}
                    >
                      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Monitor className="size-3.5" />}
                      {selected.is_past
                        ? 'Session has passed'
                        : selected.seat_status === 'full'
                          ? 'Session full'
                          : 'Register'}
                    </Button>
                  )}
                </div>

                {canManage && (
                  <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Attendees ({attendees.length})
                    </p>
                    {attendeesLoading ? (
                      <Skeleton className="h-16 rounded-lg" />
                    ) : attendees.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nobody has registered yet.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60">
                        {attendees.map((attendee) => (
                          <div
                            key={attendee.id}
                            className="flex items-center justify-between border-b border-border/40 px-3 py-1.5 text-xs last:border-b-0"
                          >
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate font-medium text-foreground">
                                {attendee.learner_name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {attendee.employee_no || attendee.email}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <StatusBadge
                                variant={attendee.status === 'cancelled' ? 'inactive' : 'active'}
                                size="sm"
                                className="text-[9px] font-bold uppercase"
                              >
                                {attendee.status}
                              </StatusBadge>
                              {attendee.status !== 'cancelled' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-6 p-0 text-destructive hover:text-destructive"
                                  aria-label={`Remove ${attendee.learner_name}`}
                                  onClick={() => {
                                    void cancelRegistration(selected.id, attendee.user_id).then(() =>
                                      loadAttendees(selected.id),
                                    )
                                  }}
                                >
                                  <X className="size-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <SessionFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        session={editing}
        saving={saving}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open: boolean) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.room_name}" and its ${pendingDelete.registered_count} registration(s) will be removed.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) void removeSession(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              Cancel session
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
