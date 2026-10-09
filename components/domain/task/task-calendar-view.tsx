'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { CalendarClock, ChevronLeft, ChevronRight, Download, Filter, MoreHorizontal, Plus, SlidersHorizontal, UserPlus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Select } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { CalendarEntry, CalendarEntryKind, TaskStatusOption, WorkspaceScope, WorkspaceTask } from '@/types/task-management'
import { CreateTaskModal } from './create-task-modal'
import { SelfTaskEntryModal } from './self-task-entry-modal'
import { CreateEventModal } from './create-event-modal'
import { EventDetailsDrawer } from './event-details-drawer'
import { MyTaskDetailsDrawer } from './my-task-details-drawer'
import { TaskReminderToast } from './task-reminder-toast'
import { CalendarSidebar } from './calendar-sidebar'
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
  // independent of the visible date range/scope. Fixes the confirmed bug
  // where a project only appeared in the old filter if it happened to have
  // a task in the currently-displayed window.
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
  // Defaults to 'mine', matching screenMode's own default below — a shared
  // tenant-wide view as the FIRST thing anyone sees read as "where did
  // everyone else's work come from" more than it read as useful context.
  const [viewScope, setViewScope] = useState<WorkspaceScope>('mine')
  /**
   * My Calendar / Shared Calendar / List View - CRM's own three top-level
   * calendar modes. Not new routes (locked-in #2): My/Shared drive the same
   * viewScope + Feeds mechanism this screen already had, just surfaced as a
   * real, named switch instead of a generic scope dropdown; List is a new
   * flat table over the same already-fetched data.
   *
   * Defaults to 'my' (locked-in, per explicit request): a viewer lands on
   * their own work first and opts into the shared/tenant-wide view, not the
   * other way round - matching selectMyCalendar()'s own viewScope/feed
   * state exactly, just set once up front instead of via a click.
   */
  const [screenMode, setScreenMode] = useState<ScreenMode>('my')
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
  const [selfTaskTime, setSelfTaskTime] = useState<string | undefined>(undefined)
  const [assignTaskOpen, setAssignTaskOpen] = useState(false)
  const [statusOptions, setStatusOptions] = useState<TaskStatusOption[]>([])
  // Whose calendars are overlaid — GET /calendar/feeds already resolves this
  // to exactly who the viewer may see, so every row is a legitimate toggle.
  const [feeds, setFeeds] = useState<CalendarFeed[]>([])
  const [hiddenFeedUserIds, setHiddenFeedUserIds] = useState<Set<string>>(new Set())
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
  const onTaskReschedule = async (taskId: string, start: Date, end: Date, allDay: boolean): Promise<boolean> => {
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) return false

    const hadStart = Boolean(task.planned_start_date)
    const nextStart = format(start, 'yyyy-MM-dd')
    const nextDue = format(end, 'yyyy-MM-dd')
    // Only the keys that actually change are sent - updateTaskSchedule
    // patches, so omitting start on a task that has none leaves it NULL
    // rather than inventing one.
    const payload: {
      planned_start_date?: string; due_date?: string
      time_start?: string | null; time_end?: string | null
    } = hadStart ? { planned_start_date: nextStart, due_date: nextDue } : { due_date: nextDue }

    const hadTime = Boolean(task.time_start)
    if (allDay) {
      // Dropped onto an all-day row / month cell: no time slot was chosen.
      // A task that previously had a time must have it explicitly cleared,
      // not silently retained alongside a new date it no longer matches.
      if (hadTime) { payload.time_start = null; payload.time_end = null }
    } else {
      payload.time_start = format(start, 'HH:mm')
      payload.time_end = format(end, 'HH:mm')
    }

    const previous = tasks
    setTasks((current) => current.map((candidate) => candidate.id === taskId
      ? {
          ...candidate,
          ...(hadStart ? { planned_start_date: nextStart } : {}),
          due_date: nextDue,
          ...('time_start' in payload ? { time_start: payload.time_start ?? null, time_end: payload.time_end ?? null } : {}),
        }
      : candidate))
    setError(''); setMessage('')

    try {
      const response = await taskService.updateTaskSchedule(getLaravelContext(), taskId, payload)
      setMessage(response.message)
      // No reload here (locked-in) - the optimistic patch above is already
      // complete and correct, and a full load() sets `loading`, which swaps
      // the whole grid for a Spinner for no reason. onEventReschedule right
      // below already works this way; this brings TASK in line with it.
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
   *
   * `solid` is the same SOLID colour as `dot`, now also used for the calendar
   * grid's own task/event chips (locked-in: full fill + matching border, like
   * CRM's project chips — not the washed `chip` tint). Pairing each solid fill
   * with its matching `-foreground` token rather than a flat white/black is
   * the one already-reviewed-for-contrast scheme in this codebase (see
   * globals.css's measured white-on-success/warning/destructive ratios) — so
   * success/warning read with dark text and primary/destructive with light,
   * instead of re-deriving a contrast rule here.
   */
  const PALETTE = [
    { chip: 'bg-primary/10 text-primary hover:bg-primary/20', dot: 'bg-primary', solid: 'bg-primary text-primary-foreground border border-primary hover:opacity-90' },
    { chip: 'bg-success/10 text-success hover:bg-success/20', dot: 'bg-success', solid: 'bg-success text-success-foreground border border-success hover:opacity-90' },
    { chip: 'bg-warning/15 text-warning hover:bg-warning/25', dot: 'bg-warning', solid: 'bg-warning text-warning-foreground border border-warning hover:opacity-90' },
    { chip: 'bg-destructive/10 text-destructive hover:bg-destructive/20', dot: 'bg-destructive', solid: 'bg-destructive text-destructive-foreground border border-destructive hover:opacity-90' },
    { chip: 'bg-secondary/60 text-secondary-foreground hover:bg-secondary/80', dot: 'bg-secondary-foreground', solid: 'bg-secondary-foreground text-background border border-secondary-foreground hover:opacity-90' },
  ]

  /** Standalone tasks stay deliberately uncoloured — that is what marks them out. */
  const NO_PROJECT = {
    chip: 'bg-muted text-muted-foreground hover:bg-muted/80 border border-dashed border-border',
    dot: 'bg-muted border border-dashed border-border',
    solid: 'bg-muted text-muted-foreground hover:bg-muted/80 border border-dashed border-border',
  }

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

  const activeFilterCount = (screenMode === 'shared' && viewScope !== 'all' && viewScope !== 'mine' ? 1 : 0)
    + (projectFilter ? 1 : 0) + (departmentFilter ? 1 : 0)

  return <div className="space-y-5">
    <TaskReminderToast />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold tracking-tight">Task Calendar</h1><p className="text-sm text-muted-foreground">Deadlines across all visible projects and assignments.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {/* A 3-button pill group here cost as much width as "Shared Calendar"
            has letters, three times over - a Select, matching the filters
            right next to it, says the same thing in a fixed, narrow box. */}
        <div className="w-40">
          <Select
            value={screenMode}
            onChange={(value) => {
              if (value === 'my') selectMyCalendar()
              else if (value === 'shared') selectSharedCalendar()
              else setScreenMode('list')
            }}
            options={[
              { value: 'my', label: 'My Calendar' },
              { value: 'shared', label: 'Shared Calendar' },
              { value: 'list', label: 'List View' },
            ]}
          />
        </div>
        {/* Scope/project/department were three separate select boxes sitting
            side by side - the single heaviest contributor to the header
            outgrowing one line. Consolidated into one icon button; a badge
            shows how many are actually narrowed so nothing active goes
            invisible just because the popover is closed. */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Filters" className="relative">
              <Filter className="size-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-3">
            {screenMode === 'shared' && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">Scope</label>
                <Select value={viewScope === 'mine' ? 'all' : viewScope} onChange={(value) => setViewScope(value as WorkspaceScope)} options={[
                  { value: 'all', label: 'All Tasks' }, { value: 'team', label: 'My Team' }, { value: 'department', label: 'My Department' },
                ]} />
              </div>
            )}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">Project</label>
              <Select value={projectFilter} onChange={setProjectFilter} options={[{ value: '', label: 'All projects' }, { value: '__none__', label: 'Not in a project' }, ...allProjects.map((project) => ({ value: project.id, label: project.name }))]} />
            </div>
            {/* New capability beyond CRM parity - CRM itself has no department
                concept at all. Filters the whole merged feed, not just tasks,
                now that 8.5 put department_id on every kind's entries. */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">Department</label>
              <Select value={departmentFilter} onChange={setDepartmentFilter} options={[{ value: '', label: 'All departments' }, ...allDepartments.map((department) => ({ value: department.id, label: department.name }))]} />
            </div>
          </PopoverContent>
        </Popover>
        {screenMode !== 'list' && (
          <div className="w-28">
            <Select value={view} onChange={(value) => setView(value as CalendarGridView)} options={[
              { value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' },
            ]} />
          </div>
        )}
        {/* The arrows step by whatever is on screen - a month, a week, a day -
            rather than always a month, which in week view would skip four. */}
        <Button variant="outline" size="icon" onClick={() => step(-1)}><ChevronLeft className="size-4" /></Button>
        <Button variant="outline" onClick={() => setMonth(view === 'month' ? startOfMonth(new Date()) : startOfDay(new Date()))}>Today</Button>
        <Button variant="outline" size="icon" onClick={() => step(1)}><ChevronRight className="size-4" /></Button>

        {/* A visual break between navigation/filtering (left of here) and the
            create actions (right of here) - kept as their own clearly
            separate group rather than blended into the same cluster. */}
        <div className="mx-1 h-6 w-px shrink-0 bg-border" />

        <Button
          variant="outline"
          onClick={() => { setSelfTaskDate(format(new Date(), 'yyyy-MM-dd')); setSelfTaskOpen(true) }}
        >
          <Plus className="mr-2 size-4" />Add Task
        </Button>
        <Button onClick={() => { setCreateEventDate(format(new Date(), 'yyyy-MM-dd')); setCreateEventOpen(true) }}>
          <CalendarClock className="mr-2 size-4" />Add Event
        </Button>
        {/* A separate, clearly distinct control from "Add Task" - that one is
            always self-assigned; this opens the same unchanged
            assign-to-someone-else form Task Management itself uses
            (locked-in #5). Visible here, not tucked into the overflow menu. */}
        <Button variant="outline" onClick={() => setAssignTaskOpen(true)}>
          <UserPlus className="mr-2 size-4" />Assign Task
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions" className="relative">
              <MoreHorizontal className="size-4" />
              {hiddenKinds.size > 0 && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => setActivityTypesOpen(true)}>
              <SlidersHorizontal />Activity Types{hiddenKinds.size > 0 ? ` (${4 - hiddenKinds.size}/4)` : ''}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={taskService.calendarExportIcsUrl(getLaravelContext(), format(range.from, 'yyyy-MM-dd'), format(range.to, 'yyyy-MM-dd'))}>
                <Download />Export .ics
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIcsImportOpen(true)}>
              <Upload />Import .ics
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
    {/* Persistent left rail (whose calendars are overlaid) alongside the
        grid/list, mirroring document-library-view.tsx's own sidebar shape -
        replaces both the old "Calendars:" chip row and the Feeds overlay
        panel's visibility section. Always rendered, even in 'my' mode
        (9.11): every OTHER feed is hidden and inert there, so the sidebar
        shows just the viewer's own row - which still needs to be reachable,
        since that's where their own task_card_color picker lives now. */}
    <div className="flex min-w-0 items-start gap-4">
      <CalendarSidebar
        feeds={feeds}
        hidden={hiddenFeedUserIds}
        onToggle={toggleFeed}
        dotClassFor={(userId) => feedColour(userId).dot}
        viewerId={viewerId}
        onMyColorChanged={() => void loadFeeds()}
        selfOnly={screenMode === 'my'}
      />
      <div className="min-w-0 flex-1">
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
              feedColour={feedColour}
              onTaskClick={setOpenTaskId}
              onEventClick={setOpenEventId}
              // Self-logged work is the far more frequent reason to click a
              // bare day - "Add Event" (meetings) stays one click away in
              // the header for the less-frequent case, unchanged.
              onEmptyDateClick={(dateStr, timeStr) => { setSelfTaskDate(dateStr); setSelfTaskTime(timeStr); setSelfTaskOpen(true) }}
              onTaskReschedule={onTaskReschedule}
              onEventReschedule={onEventReschedule}
            />
          )}
          {/* Project colour is gone from task chips (locked-in: feed colour
              only) so the old per-project legend no longer corresponds to
              anything on screen - a status legend replaces it, since that's
              now the one thing a chip's border communicates beyond identity. */}
          {!loading && screenMode !== 'list' && (
            <div className="flex flex-wrap items-center gap-3 border-t p-4 text-xs text-muted-foreground">
              <span className="font-medium">Status:</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-success" />Completed</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-warning" />Pending</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-destructive" />Overdue</span>
            </div>
          )}
        </CardContent></Card>
      </div>
    </div>
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
      initialTimeStart={selfTaskTime}
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
