'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, endOfWeek, format, startOfWeek } from 'date-fns'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  lmsSessionService,
  type CalendarDeadline,
  type SessionAttendee,
  type SessionPayload,
  type SessionStats,
  type TrainingSession,
} from '@/services/lms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

const DATE = 'yyyy-MM-dd'

export interface SessionsState {
  sessions: TrainingSession[]
  /** Whole-day markers (course deadlines, org events) for the visible week. */
  deadlines: CalendarDeadline[]
  stats: SessionStats | null
  loading: boolean
  error: string | null
  reload: () => void

  /** Monday-anchored week the calendar grid is showing. */
  weekStart: Date
  weekDays: Date[]
  goToWeek: (offsetWeeks: number) => void
  goToToday: () => void

  search: string
  setSearch: (value: string) => void

  saving: boolean
  message: string | null
  actionError: string | null
  dismiss: () => void

  createSession: (payload: SessionPayload) => Promise<{ ok: boolean; message: string }>
  updateSession: (id: number, payload: SessionPayload) => Promise<{ ok: boolean; message: string }>
  removeSession: (id: number) => Promise<{ ok: boolean; message: string }>
  register: (id: number, learnerId?: number) => Promise<{ ok: boolean; message: string }>
  cancelRegistration: (id: number, learnerId?: number) => Promise<{ ok: boolean; message: string }>

  attendees: SessionAttendee[]
  attendeesLoading: boolean
  loadAttendees: (sessionId: number) => void
}

export function useSessions(): SessionsState {
  const { user } = useAuth()
  const resolveContext = useCallback(() => getLaravelContext(user), [user])
  const profileName = user?.profileName

  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [deadlines, setDeadlines] = useState<CalendarDeadline[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [attendees, setAttendees] = useState<SessionAttendee[]>([])
  const [attendeesLoading, setAttendeesLoading] = useState(false)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  )

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      setError('Your session has expired. Sign in again to view the schedule.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const from = format(weekStart, DATE)
      const to = format(endOfWeek(weekStart, { weekStartsOn: 1 }), DATE)

      // The list and the deadline overlay are both fetched for the visible week;
      // stats are org-wide, so they do not move as the user pages through weeks.
      // Deadlines are settled separately: an overlay failing should grey out the
      // markers, not blank the schedule the page exists to show.
      const [listResponse, statsResponse, deadlineResult] = await Promise.all([
        lmsSessionService.list(context, from, to, debouncedSearch || undefined),
        lmsSessionService.stats(context),
        lmsSessionService.deadlines(context, from, to).catch(() => null),
      ])

      setSessions(listResponse.data ?? [])
      setStats(statsResponse.data ?? null)
      setDeadlines(deadlineResult?.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the session schedule.'))
      setSessions([])
      setDeadlines([])
    } finally {
      setLoading(false)
    }
  }, [resolveContext, weekStart, debouncedSearch])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  /** Shared wrapper: run a write, refresh, surface the outcome. */
  const run = useCallback(
    async (operation: () => Promise<string>, fallback: string) => {
      setSaving(true)
      setActionError(null)
      setMessage(null)

      try {
        const ok = await operation()
        await load()
        setMessage(ok)
        return { ok: true, message: ok }
      } catch (writeError) {
        const failure = toMessage(writeError, fallback)
        setActionError(failure)
        return { ok: false, message: failure }
      } finally {
        setSaving(false)
      }
    },
    [load],
  )

  const createSession = useCallback(
    (payload: SessionPayload) =>
      run(async () => {
        await lmsSessionService.create(resolveContext(), payload, profileName)
        return `"${payload.room_name}" scheduled.`
      }, 'Failed to schedule the session.'),
    [run, resolveContext, profileName],
  )

  const updateSession = useCallback(
    (id: number, payload: SessionPayload) =>
      run(async () => {
        await lmsSessionService.update(resolveContext(), id, payload, profileName)
        return `"${payload.room_name}" updated.`
      }, 'Failed to update the session.'),
    [run, resolveContext, profileName],
  )

  const removeSession = useCallback(
    (id: number) =>
      run(async () => {
        await lmsSessionService.remove(resolveContext(), id, profileName)
        return 'Session cancelled.'
      }, 'Failed to cancel the session.'),
    [run, resolveContext, profileName],
  )

  const register = useCallback(
    (id: number, learnerId?: number) =>
      run(async () => {
        await lmsSessionService.register(resolveContext(), id, learnerId, profileName)
        return learnerId ? 'Learner registered.' : 'You are registered for this session.'
      }, 'Failed to register.'),
    [run, resolveContext, profileName],
  )

  const cancelRegistration = useCallback(
    (id: number, learnerId?: number) =>
      run(async () => {
        await lmsSessionService.cancelRegistration(resolveContext(), id, learnerId, profileName)
        return 'Registration cancelled.'
      }, 'Failed to cancel the registration.'),
    [run, resolveContext, profileName],
  )

  const loadAttendees = useCallback(
    (sessionId: number) => {
      const context = resolveContext()
      setAttendeesLoading(true)
      lmsSessionService
        .attendees(context, sessionId)
        .then((response) => setAttendees(response.data ?? []))
        .catch(() => setAttendees([]))
        .finally(() => setAttendeesLoading(false))
    },
    [resolveContext],
  )

  return {
    sessions,
    deadlines,
    stats,
    loading,
    error,
    reload: () => void load(),

    weekStart,
    weekDays,
    goToWeek: (offsetWeeks: number) => setWeekStart((current) => addDays(current, offsetWeeks * 7)),
    goToToday: () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })),

    search,
    setSearch,

    saving,
    message,
    actionError,
    dismiss: () => {
      setMessage(null)
      setActionError(null)
    },

    createSession,
    updateSession,
    removeSession,
    register,
    cancelRegistration,

    attendees,
    attendeesLoading,
    loadAttendees,
  }
}
