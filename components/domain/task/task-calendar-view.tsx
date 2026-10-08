'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { CalendarClock, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Select } from '@/components/ui/select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { CalendarEntry, CalendarEntryKind, TaskStatusOption, WorkspaceScope, WorkspaceTask } from '@/types/task-management'
import { CreateTaskModal } from './create-task-modal'
import { SelfTaskEntryModal } from './self-task-entry-modal'
import { CreateEventModal } from './create-event-modal'
import { EventDetailsDrawer } from './event-details-drawer'
import { MyTaskDetailsDrawer } from './my-task-details-drawer'
import { TaskReminderToast } from './task-reminder-toast'
import { CalendarFeedTogglePanel } from './calendar-feed-toggle-panel'
import { IcsExportButton } from './ics-export-button'
import { IcsImportModal } from './ics-import-modal'
import { TaskCalendarGrid, type CalendarGridView } from './task-calendar-grid'
import { ActivityTypesPanel } from './activity-types-panel'
import { CalendarListView } from './calendar-list-view'

type ScreenMode = 'my' | 'shared' | 'list'
import type { CalendarFeed } from '@/types/task-management'

export function TaskCalendarView() {
  const [month, setMonth] = useState(startOfMonth(new Date()))
  /**
   * Month / week / day.
   *
   * All three drive the SAME underlying range/grid component - only the
   * interval and FullCalendar's own view name differ.
   */
  const [view, setView] = useState<CalendarGridView>('month')
  const [tasks, setTasks] = useState<WorkspaceTask[]>([])
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  /** A project id, or '__none__' for "not in a project" - never a name, so a renamed/duplicate-named project can't silently filter the wrong rows. */
  const [projectFilter, setProjectFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  // The REAL, tenant-wide project/department lists for the filter dropdowns -
  // independent of the visible date range/scope, unlike the color-legend's
  // own `projects` (below), which stays derived from on-screen tasks only.
  // Fixes the confirmed bug where a project only appeared in the old filter
  // if it happened to have a task in the currently-displayed window.
  const [allProjects, setAllProjects] = useState<Array<{ id: string; name: string }>>([])
  const [allDepartments, setAllDepartments] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    let active = true
    queueMicrotask(() => {
      if (!active) return
      taskService.getProjectRecords(context, { perPage: 100, includeArchived: true })
        .then((response) => { if (active) setAllProjects(response.data.projects.map((project) => ({ id: project.id, name: project.name }))) })
        .catch(() => { /* the calendar still works with no project filter options */ })
      taskService.getProjectOptions(context)
        .then((response) => { if (active) setAllDepartments(response.data.departments) })
        .catch(() => { /* the calendar still works with no department filter options */ })
    })
    return () => { active = false }
  }, [])
  // My calendar vs team calendar — reuses task-workspace.tsx's existing
  // WorkspaceScope control and its already-working backend support, rather
  // than inventing a second access-control mechanism for the same question.
  // Defaults to 'all', matching this screen's existing behaviour before this
  // control existed (the backend's own default) — adding the selector must
  // not narrow what anyone already saw.
  const [viewScope, setViewScope] = useState<WorkspaceScope>('all')
  /**
   * My Calendar / Shared Calendar / List View - CRM's own three top-level
   * calendar modes. Not new routes (locked-in #2): My/Shared drive the same
   * viewScope + Feeds mechanism this screen already had, just surfaced as a
   * real, named switch instead of a generic scope dropdown; List is a new
   * flat table over the same already-fetched data.
   */
  const [screenMode, setScreenMode] = useState<ScreenMode>('shared')
  // How many the server says exist for this window, versus how many we hold.
  // A calendar that silently drops days is worse than one that admits it.
  const [totalInRange, setTotalInRange] = useState(0)

  // Entries — EVENT, MILESTONE and CHECKPOINT, alongside the task chips
  // above. Tasks keep using `getWorkspace`/WorkspaceTask (span math and
  // drag-reschedule are already built and proven against that shape); the
  // other three kinds come from the merged calendar feed, which this screen
  // used to filter down to EVENT only - MILESTONE/CHECKPOINT were silently
  // dropped entirely, with no toggle for either (see the Activity Types panel
  // this plan adds next for the user-facing show/hide control).
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [createEventOpen, setCreateEventOpen] = useState(false)
  const [createEventDate, setCreateEventDate] = useState<string | undefined>(undefined)
  const [selfTaskOpen, setSelfTaskOpen] = useState(false)
  const [selfTaskDate, setSelfTaskDate] = useState<string | undefined>(undefined)
  const [assignTaskOpen, setAssignTaskOpen] = useState(false)
  const [statusOptions, setStatusOptions] = useState<TaskStatusOption[]>([])
  // Whose calendars are overlaid — GET /calendar/feeds already resolves this
  // to exactly who the viewer may see, so every row is a legitimate toggle.
  const [feeds, setFeeds] = useState<CalendarFeed[]>([])
  const [hiddenFeedUserIds, setHiddenFeedUserIds] = useState<Set<string>>(new Set())
  const [feedPanelOpen, setFeedPanelOpen] = useState(false)
  const [icsImportOpen, setIcsImportOpen] = useState(false)
  // Activity Types: which of the four kinds are hidden on the grid - empty
  // by default, since 9.1 already made all four visible unconditionally and
  // this panel only adds the ability to turn one off, never a new default-off.
  const [hiddenKinds, setHiddenKinds] = useState<Set<CalendarEntryKind>>(new Set())
  const [activityTypesOpen, setActivityTypesOpen] = useState(false)
  // The event drawer - the chip's title opens it; MILESTONE/CHECKPOINT open
  // their own read-only popover instead (TaskCalendarGrid's own concern).
  const [openEventId, setOpenEventId] = useState<string | null>(null)

  const viewerId = getLaravelContext().userId

  const range = useMemo(() => {
    if (view === 'day') return { from: startOfDay(month), to: startOfDay(month) }
    if (view === 'week') {
      return { from: startOfWeek(month, { weekStartsOn: 1 }), to: endOfWeek(month, { weekStartsOn: 1 }) }
    }
    // A FIXED 6-week window, matching TaskCalendarGrid's own fixedWeekCount -
    // a variable-length range here would under-fetch whatever trailing week
    // a shorter month gets padded out to on screen.
    const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    return { from, to: addDays(from, 6 * 7 - 1) }
  }, [month, view])

  /** Step by whatever unit is on screen, so the arrows always mean "next one of these". */
  const step = useCallback((direction: -1 | 1) => {
    setMonth((current) => {
      if (view === 'day') return addDays(current, direction)
      if (view === 'week') return addDays(current, direction * 7)
      return direction === 1 ? addMonths(current, 1) : subMonths(current, 1)
    })
  }, [view])

  const periodLabel = view === 'day'
    ? format(month, 'EEEE d MMMM yyyy')
    : view === 'week'
      ? `${format(range.from, 'd MMM')} - ${format(range.to, 'd MMM yyyy')}`
      : format(month, 'MMMM yyyy')

  const load = useCallback(async () => {
    // Nothing may fire before the session exists, or the first paint is an
    // auth error instead of a calendar. tm-reports.tsx already guards this way.
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    setLoading(true); setError('')
    try {
      // PAGE UNTIL EXHAUSTED. This used to request perPage:100 once, with no
      // pagination — and the backend caps per_page at 100 and sorts by
      // task_date DESC. So in a month with more than 100 tasks the EARLIEST
      // days simply rendered blank, with nothing on screen admitting it. The
      // symptom read as "the calendar is not showing real data".
      const collected: WorkspaceTask[] = []
      let page = 1
      let total = 0

      // Bounded so a bad `last_page` can never spin forever.
      for (let guard = 0; guard < 20; guard += 1) {
        const response = await taskService.getWorkspace(getLaravelContext(), {
          from: format(range.from, 'yyyy-MM-dd'), to: format(range.to, 'yyyy-MM-dd'), perPage: 100, page, scope: viewScope,
        })
        collected.push(...response.data.tasks)
        total = response.data.pagination?.total ?? collected.length
        // Already returned by this same call - the self-entry form's status
        // picker needs the tenant's vocabulary and would otherwise need a
        // second round trip just for that.
        setStatusOptions(response.data.filters.status_options)
        const lastPage = response.data.pagination?.last_page ?? 1
        if (page >= lastPage || !response.data.tasks.length) break
        page += 1
      }

      setTasks(collected)
      setTotalInRange(total)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load calendar tasks.') }
    finally { setLoading(false) }
  }, [range, viewScope])
  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  // Secondary layers (entries, feeds): a failed fetch must never block the
  // rest of the calendar, so these never feed into the main `error` state -
  // but failing SILENTLY, with nothing on screen admitting it, was its own
  // problem. Each gets its own small, non-blocking retry affordance instead.
  const [entriesError, setEntriesError] = useState(false)
  const [feedsError, setFeedsError] = useState(false)

  const loadEntries = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    try {
      const response = await taskService.getCalendarEntries(context, {
        from: format(range.from, 'yyyy-MM-dd'), to: format(range.to, 'yyyy-MM-dd'),
      })
      setEntries(response.data.entries.filter((entry) => entry.kind !== 'TASK'))
      setEntriesError(false)
    } catch {
      // A secondary layer on this screen — a failed fetch leaves the task
      // calendar fully usable rather than erroring the whole view.
      setEntries([])
      setEntriesError(true)
    }
  }, [range])
  useEffect(() => {
    queueMicrotask(() => { void loadEntries() })
  }, [loadEntries])

  const loadFeeds = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    try {
      const response = await taskService.getCalendarFeeds(context)
      setFeeds(response.data.feeds)
      setFeedsError(false)
    } catch {
      // The calendar still works with just the task/entry layers.
      setFeedsError(true)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => { void loadFeeds() })
  }, [loadFeeds])

  const toggleFeed = (userId: string) => {
    setHiddenFeedUserIds((current) => {
      const next = new Set(current)
      if (next.has(userId)) next.delete(userId); else next.add(userId)
      return next
    })
  }

  const toggleKind = (kind: CalendarEntryKind) => {
    setHiddenKinds((current) => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind); else next.add(kind)
      return next
    })
  }

  /** My Calendar: just you - any overlaid feed would contradict "my". */
  const selectMyCalendar = () => {
    setScreenMode('my'); setViewScope('mine')
    setHiddenFeedUserIds(new Set(feeds.map((feed) => feed.user_id)))
  }
  /** Shared Calendar: back to a team-wide scope, feeds visible again by default. */
  const selectSharedCalendar = () => {
    setScreenMode('shared')
    setViewScope((current) => (current === 'mine' ? 'all' : current))
    setHiddenFeedUserIds(new Set())
  }

  /**
   * Approve/reject/archive, ported from task-workspace.tsx's own Dashboard
   * handlers verbatim - this screen now opens the SAME shared drawer with a
   * dashboardContext, for the same reason the Dashboard does: viewScope
   * routinely shows tasks the viewer does not personally own.
   */
  const decide = async (task: WorkspaceTask, decision: 'approve' | 'reject') => {
    let remarks = ''
    if (decision === 'reject') {
      const given = window.prompt(
        `Why is “${task.title}” being sent back?\n\nThe assignee sees this, and it is recorded as the reason.`,
        '',
      )
      if (given === null) return
      remarks = given.trim()
      if (remarks === '') {
        setError('A rejection needs a reason. The assignee is shown it, and it is kept on the record.')
        return
      }
    }
    try {
      const response = await taskService.decideWorkspaceTask(getLaravelContext(), task.id, decision, remarks)
      setMessage(response.message); setOpenTaskId(null); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update approval.') }
  }
  const archive = async (task: WorkspaceTask) => {
    if (!window.confirm(`Archive “${task.title}”?`)) return
    try {
      const response = await taskService.archiveWorkspaceTask(getLaravelContext(), task.id)
      setMessage(response.message); setOpenTaskId(null); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to archive task.') }
  }

  /**
   * MOVE A TASK BY DRAGGING IT. TaskCalendarGrid/calendar-event-mapping.ts
   * already converted FullCalendar's exclusive-end drag/resize result back
   * to this app's inclusive [start, end] - this handler only has to decide
   * what to send and revert on failure, exactly like the old native-drag
   * dropOnDay did.
   */
  const onTaskReschedule = async (taskId: string, start: Date, end: Date): Promise<boolean> => {
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) return false

    const hadStart = Boolean(task.planned_start_date)
    const nextStart = format(start, 'yyyy-MM-dd')
    const nextDue = format(end, 'yyyy-MM-dd')
    // Only the keys that actually change are sent - updateTaskSchedule
    // patches, so omitting start on a task that has none leaves it NULL
    // rather than inventing one.
    const payload = hadStart ? { planned_start_date: nextStart, due_date: nextDue } : { due_date: nextDue }

    const previous = tasks
    setTasks((current) => current.map((candidate) => candidate.id === taskId
      ? { ...candidate, ...(hadStart ? { planned_start_date: nextStart } : {}), due_date: nextDue }
      : candidate))
    setError(''); setMessage('')

    try {
      const response = await taskService.updateTaskSchedule(getLaravelContext(), taskId, payload)
      setMessage(response.message)
      void load()
      return true
    } catch (reason) {
      setTasks(previous)
      setError(reason instanceof Error ? reason.message : 'Unable to move that task.')
      return false
    }
  }

  const onEventReschedule = async (eventId: string, start: Date, end: Date, allDay: boolean): Promise<boolean> => {
    const startAt = allDay ? `${format(start, 'yyyy-MM-dd')} 00:00:00` : format(start, 'yyyy-MM-dd HH:mm:ss')
    const endAt = allDay ? `${format(end, 'yyyy-MM-dd')} 23:59:00` : format(end, 'yyyy-MM-dd HH:mm:ss')

    const previous = entries
    setEntries((current) => current.map((entry) => (entry.id === eventId && entry.kind === 'EVENT')
      ? { ...entry, start: startAt, end: endAt, all_day: allDay }
      : entry))
    setError(''); setMessage('')

    try {
      const response = await taskService.rescheduleCalendarEvent(getLaravelContext(), eventId, startAt, endAt)
      setMessage(response.message)
      return true
    } catch (reason) {
      setEntries(previous)
      setError(reason instanceof Error ? reason.message : 'Unable to move that event.')
      return false
    }
  }

  // One colour per project, assigned by stable sort order so a project keeps
  // its colour between renders. Standalone tasks (no project) are deliberately
  // NOT given a colour — they read as neutral, which is what distinguishes
  // them at a glance from project work.
  const projects = useMemo(
    () => [...new Set(tasks.map((task) => task.project).filter((name): name is string => Boolean(name)))].sort(),
    [tasks],
  )
  /**
   * ONE PALETTE, TWO USES — and that is the fix.
   *
   * This returned a single chip class string, and the legend derived its dot
   * from it with `.split(' ')[0]` — which yields `bg-primary/10`, a TEN PERCENT
   * tint. On a chip that is correct: the text sits on it in a matching hue and
   * reads clearly. On a 10-pixel dot with no text it is invisible, which is
   * exactly the reported symptom: colour on the tasks, nothing in the legend.
   *
   * So each entry now carries both: the washed `chip` for the block, and a
   * SOLID `dot` for the swatch. Slicing a class string to guess at a colour was
   * never going to hold.
   */
  const PALETTE = [
    { chip: 'bg-primary/10 text-primary hover:bg-primary/20', dot: 'bg-primary' },
    { chip: 'bg-success/10 text-success hover:bg-success/20', dot: 'bg-success' },
    { chip: 'bg-warning/15 text-warning hover:bg-warning/25', dot: 'bg-warning' },
    { chip: 'bg-destructive/10 text-destructive hover:bg-destructive/20', dot: 'bg-destructive' },
    { chip: 'bg-secondary/60 text-secondary-foreground hover:bg-secondary/80', dot: 'bg-secondary-foreground' },
  ]

  /** Standalone tasks stay deliberately uncoloured — that is what marks them out. */
  const NO_PROJECT = {
    chip: 'bg-muted text-muted-foreground hover:bg-muted/80 border border-dashed border-border',
    dot: 'bg-muted border border-dashed border-border',
  }

  const projectColour = (project: string | null) =>
    project ? PALETTE[projects.indexOf(project) % PALETTE.length] : NO_PROJECT

  const matchesProject = (projectId: string | null) =>
    !projectFilter || (projectFilter === '__none__' ? !projectId : projectId === projectFilter)
  const matchesDepartment = (departmentId: string | null) => !departmentFilter || departmentId === departmentFilter

  const visibleTasks = hiddenKinds.has('TASK')
    ? []
    : tasks.filter((task) => matchesProject(task.project_id) && matchesDepartment(task.department_id)
        && (!task.assignee_id || !hiddenFeedUserIds.has(task.assignee_id)))
  const visibleEntries = entries.filter((entry) =>
    !hiddenKinds.has(entry.kind) && matchesProject(entry.project_id) && matchesDepartment(entry.department_id)
    && (!entry.owner_id || !hiddenFeedUserIds.has(entry.owner_id)))

  /** One colour per feed, by the SAME stable-sort-order scheme as project colours. */
  const feedColour = (userId: string) => PALETTE[feeds.findIndex((feed) => feed.user_id === userId) % PALETTE.length] ?? NO_PROJECT

  const openTaskRow = tasks.find((task) => task.id === openTaskId) ?? null

  return <div className="space-y-5">
    <TaskReminderToast />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold tracking-tight">Task Calendar</h1><p className="text-sm text-muted-foreground">Deadlines across all visible projects and assignments.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border p-0.5">
          {([
            { key: 'my' as const, label: 'My Calendar', onClick: selectMyCalendar },
            { key: 'shared' as const, label: 'Shared Calendar', onClick: selectSharedCalendar },
            { key: 'list' as const, label: 'List View', onClick: () => setScreenMode('list') },
          ]).map(({ key, label, onClick }) => (
            <button
              key={key}
              onClick={onClick}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                screenMode === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {screenMode === 'shared' && (
          <div className="w-44"><Select value={viewScope === 'mine' ? 'all' : viewScope} onChange={(value) => setViewScope(value as WorkspaceScope)} options={[
            { value: 'all', label: 'All Tasks' }, { value: 'team', label: 'My Team' }, { value: 'department', label: 'My Department' },
          ]} /></div>
        )}
        <div className="w-52"><Select value={projectFilter} onChange={setProjectFilter} options={[{ value: '', label: 'All projects' }, { value: '__none__', label: 'Not in a project' }, ...allProjects.map((project) => ({ value: project.id, label: project.name }))]} /></div>
        {/* New capability beyond CRM parity - CRM itself has no department
            concept at all. Filters the whole merged feed, not just tasks,
            now that 8.5 put department_id on every kind's entries. */}
        <div className="w-48"><Select value={departmentFilter} onChange={setDepartmentFilter} options={[{ value: '', label: 'All departments' }, ...allDepartments.map((department) => ({ value: department.id, label: department.name }))]} /></div>
        {screenMode !== 'list' && (
          <div className="flex items-center rounded-lg border p-0.5">
            {(['month', 'week', 'day'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  view === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
        {/* The arrows step by whatever is on screen - a month, a week, a day -
            rather than always a month, which in week view would skip four. */}
        <Button variant="outline" size="icon" onClick={() => step(-1)}><ChevronLeft className="size-4" /></Button>
        <Button variant="outline" onClick={() => setMonth(view === 'month' ? startOfMonth(new Date()) : startOfDay(new Date()))}>Today</Button>
        <Button variant="outline" size="icon" onClick={() => step(1)}><ChevronRight className="size-4" /></Button>
        <Button
          variant="outline"
          onClick={() => { setSelfTaskDate(format(new Date(), 'yyyy-MM-dd')); setSelfTaskOpen(true) }}
        >
          <Plus className="mr-2 size-4" />Add Task
        </Button>
        {/* Deliberately a separate, clearly distinct control from "Add Task" -
            that one is always self-assigned; this one opens the same
            unchanged assign-to-someone-else form Task Management itself uses
            (locked-in #5). */}
        <Button variant="outline" onClick={() => setAssignTaskOpen(true)}>
          <UserPlus className="mr-2 size-4" />Assign Task
        </Button>
        <Button onClick={() => { setCreateEventDate(format(new Date(), 'yyyy-MM-dd')); setCreateEventOpen(true) }}>
          <CalendarClock className="mr-2 size-4" />Add Event
        </Button>
        <Button variant="outline" onClick={() => setFeedPanelOpen(true)}>
          <Users className="mr-2 size-4" />Feeds{hiddenFeedUserIds.size > 0 ? ` (${feeds.length - hiddenFeedUserIds.size}/${feeds.length})` : ''}
        </Button>
        <Button variant="outline" onClick={() => setActivityTypesOpen(true)}>
          <SlidersHorizontal className="mr-2 size-4" />Activity Types{hiddenKinds.size > 0 ? ` (${4 - hiddenKinds.size}/4)` : ''}
        </Button>
        <IcsExportButton from={format(range.from, 'yyyy-MM-dd')} to={format(range.to, 'yyyy-MM-dd')} />
        <Button variant="outline" onClick={() => setIcsImportOpen(true)}>Import .ics</Button>
      </div>
    </div>
    {/* `danger` is not a token in this design system - globals.css defines
        --color-destructive. This banner rendered with no border and default
        text colour, so a failed reschedule looked like a stray paragraph. */}
    {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    {message && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}
    {/* Secondary layers only - the task calendar above stays fully usable
        either way, so this is a small inline strip, never a blocking state. */}
    {entriesError && (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <span>Couldn&apos;t load events, milestones or checkpoints.</span>
        <Button variant="outline" size="sm" onClick={() => void loadEntries()}>Try again</Button>
      </div>
    )}
    {feedsError && (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <span>Couldn&apos;t load shared calendars.</span>
        <Button variant="outline" size="sm" onClick={() => void loadFeeds()}>Try again</Button>
      </div>
    )}
    {/* Shared Calendar's own feed toggles, inline - the Feeds button above
        still opens the full side panel (sharing, "Can edit", etc.), but
        whose calendars are currently overlaid should be visible on the
        screen itself, not only behind a click. */}
    {screenMode === 'shared' && feeds.length > 0 && (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3">
        <span className="text-xs font-semibold text-muted-foreground">Calendars:</span>
        {feeds.map((feed) => {
          const active = !hiddenFeedUserIds.has(feed.user_id)
          return (
            <button
              key={feed.user_id}
              type="button"
              onClick={() => toggleFeed(feed.user_id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active ? 'border-transparent bg-background shadow-sm' : 'border-dashed text-muted-foreground opacity-60'
              }`}
            >
              <span
                className={feed.color ? 'size-2 rounded-full' : `size-2 rounded-full ${feedColour(feed.user_id).dot}`}
                style={feed.color ? { backgroundColor: feed.color } : undefined}
              />{feed.name}
            </button>
          )
        })}
      </div>
    )}
    <Card><CardContent className="p-0">
      <div className="flex items-center justify-between border-b p-4"><h2 className="text-lg font-semibold">{screenMode === 'list' ? 'All scheduled entries' : periodLabel}</h2><span className="text-sm text-muted-foreground">{visibleTasks.length}{visibleTasks.length !== totalInRange && totalInRange ? ` of ${totalInRange}` : ''} scheduled tasks</span></div>
      {loading ? <div className="flex h-96 items-center justify-center"><Spinner /></div> : screenMode === 'list' ? (
        <CalendarListView
          tasks={visibleTasks}
          entries={visibleEntries}
          feeds={feeds}
          onTaskClick={setOpenTaskId}
          onEventClick={setOpenEventId}
        />
      ) : (
        <TaskCalendarGrid
          tasks={visibleTasks}
          entries={visibleEntries}
          feeds={feeds}
          viewerId={viewerId}
          view={view}
          anchorDate={month}
          projectColour={projectColour}
          feedColour={feedColour}
          onTaskClick={setOpenTaskId}
          onEventClick={setOpenEventId}
          onEmptyDateClick={(dateStr) => { setCreateEventDate(dateStr); setCreateEventOpen(true) }}
          onTaskReschedule={onTaskReschedule}
          onEventReschedule={onEventReschedule}
        />
      )}
      {!loading && screenMode !== 'list' && (projects.length > 0 || visibleTasks.some((task) => !task.project)) && (
        <div className="flex flex-wrap items-center gap-3 border-t p-4 text-xs text-muted-foreground">
          <span className="font-medium">Projects:</span>
          {projects.map((name) => (
            <span key={name} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${projectColour(name).dot}`} />{name}</span>
          ))}
          {visibleTasks.some((task) => !task.project) && (
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-dashed border-border bg-muted" />Not in a project</span>
          )}
        </div>
      )}
    </CardContent></Card>
    <MyTaskDetailsDrawer
      taskId={openTaskId}
      open={openTaskId !== null}
      onClose={() => setOpenTaskId(null)}
      onUpdated={() => void load()}
      /* dashboardContext ALWAYS supplied here, mirroring task-workspace.tsx's
         own Dashboard precedent unconditionally (not just for non-'mine'
         scopes) - viewScope can show tasks the viewer does not personally
         own even in 'mine' (assigned-to vs. assigned-by are different
         people), and the drawer's own canManage gate is what actually
         decides whether Edit/Delete/Private render, not this screen. */
      dashboardContext={openTaskRow ? {
        approved: openTaskRow.approved,
        onApprove: () => void decide(openTaskRow, 'approve'),
        onReject: () => void decide(openTaskRow, 'reject'),
        onArchive: () => void archive(openTaskRow),
      } : undefined}
    />
    <SelfTaskEntryModal
      isOpen={selfTaskOpen}
      initialDate={selfTaskDate}
      statusOptions={statusOptions}
      onClose={() => setSelfTaskOpen(false)}
      onCreated={(text) => { setMessage(text); void load() }}
    />
    <CreateTaskModal
      isOpen={assignTaskOpen}
      onClose={() => setAssignTaskOpen(false)}
      onCreated={(text) => { setMessage(text); void load() }}
    />
    <CreateEventModal
      isOpen={createEventOpen}
      initialDate={createEventDate}
      onClose={() => setCreateEventOpen(false)}
      onCreated={(text) => { setMessage(text); void loadEntries() }}
    />
    <EventDetailsDrawer
      eventId={openEventId}
      open={openEventId !== null}
      onClose={() => setOpenEventId(null)}
      onUpdated={() => void loadEntries()}
    />
    <CalendarFeedTogglePanel
      open={feedPanelOpen}
      onClose={() => setFeedPanelOpen(false)}
      feeds={feeds}
      hidden={hiddenFeedUserIds}
      onToggle={toggleFeed}
      dotClassFor={(userId) => feedColour(userId).dot}
    />
    <ActivityTypesPanel
      open={activityTypesOpen}
      onClose={() => setActivityTypesOpen(false)}
      hidden={hiddenKinds}
      onToggle={toggleKind}
    />
    <IcsImportModal
      isOpen={icsImportOpen}
      onClose={() => setIcsImportOpen(false)}
      onImported={() => { setMessage('Calendar imported.'); void loadEntries() }}
    />
  </div>
}
