'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, addMonths, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isAfter, isBefore, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Select } from '@/components/ui/select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { WorkspaceTask } from '@/types/task-management'

/**
 * A `yyyy-MM-dd` string as a LOCAL date.
 *
 * `new Date('2026-08-21')` parses as UTC midnight and then renders in local
 * time, which lands on the 20th for anyone west of Greenwich - a task silently
 * one day early. Appending the time forces local-midnight parsing, matching how
 * `format(day, 'yyyy-MM-dd')` writes them back out.
 */
function localDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

/**
 * The days a task occupies: [start, due].
 *
 * Returns null when it has neither date - such a task is not on the calendar
 * at all. Where only one is present that date stands for both, so the task is
 * a single day rather than an open-ended bar.
 *
 * INVERTED DATA IS NORMALISED, NOT TRUSTED. `TaskScheduleController` validates
 * order only on write, so legacy rows can hold a start AFTER their due date.
 * Rendering that literally would produce a negative-length span that draws
 * nothing; the two are swapped so the task still appears and can be corrected.
 */
function taskSpan(task: WorkspaceTask): { start: Date; end: Date } | null {
  const startRaw = task.planned_start_date ?? task.due_date
  const endRaw = task.due_date ?? task.planned_start_date
  if (!startRaw || !endRaw) return null

  const a = localDate(startRaw)
  const b = localDate(endRaw)
  return a <= b ? { start: a, end: b } : { start: b, end: a }
}

function occupiesDay(task: WorkspaceTask, day: Date): boolean {
  const span = taskSpan(task)
  if (!span) return false
  // Compare on the calendar day, not the instant, so a task due today counts
  // for the whole of today rather than only its midnight.
  return !isBefore(startOfDay(day), startOfDay(span.start))
    && !isAfter(startOfDay(day), startOfDay(span.end))
}

/** Hover text that says what the bar covers, since only day one shows a title. */
function taskTitleHint(task: WorkspaceTask): string {
  const where = task.project ? task.project : 'Not in a project'
  const span = taskSpan(task)
  const when = span && !isSameDay(span.start, span.end)
    ? ` (${format(span.start, 'd MMM')} - ${format(span.end, 'd MMM')})`
    : ''
  return `${where} - ${task.title}${when}`
}

type CalendarView = 'month' | 'week' | 'day'

export function TaskCalendarView() {
  const [month, setMonth] = useState(startOfMonth(new Date()))
  /**
   * Month / week / day.
   *
   * All three drive the SAME range and the same grid - only the interval and
   * the column count differ - so a task renders identically in each and there
   * is one span calculation, not three.
   */
  const [view, setView] = useState<CalendarView>('month')
  const [tasks, setTasks] = useState<WorkspaceTask[]>([])
  const [selected, setSelected] = useState<WorkspaceTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  // Rescheduling: the due date the user is moving the selected task to.
  const [newDueDate, setNewDueDate] = useState('')
  const [rescheduling, setRescheduling] = useState(false)
  const [projectFilter, setProjectFilter] = useState('')
  // How many the server says exist for this window, versus how many we hold.
  // A calendar that silently drops days is worse than one that admits it.
  const [totalInRange, setTotalInRange] = useState(0)

  const range = useMemo(() => {
    if (view === 'day') return { from: startOfDay(month), to: startOfDay(month) }
    if (view === 'week') {
      return { from: startOfWeek(month, { weekStartsOn: 1 }), to: endOfWeek(month, { weekStartsOn: 1 }) }
    }
    return {
      from: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
      to: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    }
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
          from: format(range.from, 'yyyy-MM-dd'), to: format(range.to, 'yyyy-MM-dd'), perPage: 100, page,
        })
        collected.push(...response.data.tasks)
        total = response.data.pagination?.total ?? collected.length
        const lastPage = response.data.pagination?.last_page ?? 1
        if (page >= lastPage || !response.data.tasks.length) break
        page += 1
      }

      setTasks(collected)
      setTotalInRange(total)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load calendar tasks.') }
    finally { setLoading(false) }
  }, [range])
  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  const openTask = (task: WorkspaceTask) => {
    setSelected(task); setNewDueDate(task.due_date ?? ''); setMessage('')
  }

  const reschedule = async () => {
    if (!selected || !newDueDate || newDueDate === selected.due_date) return
    setRescheduling(true); setError(''); setMessage('')
    try {
      const response = await taskService.updateTaskSchedule(getLaravelContext(), selected.id, { due_date: newDueDate })
      setSelected({ ...selected, due_date: response.data.schedule.due_date })
      setMessage(response.message)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reschedule this task.')
    } finally { setRescheduling(false) }
  }

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropDay, setDropDay] = useState<string | null>(null)

  /**
   * MOVE A TASK BY DRAGGING IT TO ANOTHER DAY.
   *
   * Native HTML5 drag, mirroring `candidate-kanban.tsx` - no library, and the
   * same `dataTransfer` idiom already used elsewhere in this app.
   *
   * THE WHOLE SPAN MOVES, KEEPING ITS LENGTH. Dragging a three-day task to
   * Monday makes it Monday-Wednesday, not a three-day task that now ends on
   * Monday. Only tasks WITH a start date shift both ends; a single-day task
   * just moves its due date, which is what the existing dialog does.
   *
   * OPTIMISTIC, WITH A REVERT. The grid updates immediately so the drag feels
   * direct, and the previous dates are restored if the write fails - the task
   * must never sit on a day the server did not agree to.
   */
  const dropOnDay = async (taskId: string, day: Date) => {
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) return

    const span = taskSpan(task)
    if (!span) return

    const target = startOfDay(day)
    const shift = differenceInCalendarDays(target, startOfDay(span.start))
    if (shift === 0) return

    const hadStart = Boolean(task.planned_start_date)
    const nextStart = format(target, 'yyyy-MM-dd')
    const nextDue = format(addDays(startOfDay(span.end), shift), 'yyyy-MM-dd')

    // Only the keys that actually change are sent - updateTaskSchedule patches,
    // so omitting start on a task that has none leaves it NULL rather than
    // inventing one.
    const payload = hadStart ? { planned_start_date: nextStart, due_date: nextDue } : { due_date: nextDue }

    const previous = tasks
    setTasks((current) => current.map((candidate) => candidate.id === taskId
      ? { ...candidate, ...(hadStart ? { planned_start_date: nextStart } : {}), due_date: nextDue }
      : candidate))
    setError(''); setMessage('')

    try {
      const response = await taskService.updateTaskSchedule(getLaravelContext(), taskId, payload)
      setMessage(response.message)
      await load()
    } catch (reason) {
      setTasks(previous)
      setError(reason instanceof Error ? reason.message : 'Unable to move that task.')
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

  const visibleTasks = projectFilter
    ? tasks.filter((task) => (projectFilter === '__none__' ? !task.project : task.project === projectFilter))
    : tasks

  const days = eachDayOfInterval({ start: range.from, end: range.to })
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold tracking-tight">Task Calendar</h1><p className="text-sm text-muted-foreground">Deadlines across all visible projects and assignments.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-52"><Select value={projectFilter} onChange={setProjectFilter} options={[{ value: '', label: 'All projects' }, { value: '__none__', label: 'Not in a project' }, ...projects.map((name) => ({ value: name, label: name }))]} /></div>
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
        {/* The arrows step by whatever is on screen - a month, a week, a day -
            rather than always a month, which in week view would skip four. */}
        <Button variant="outline" size="icon" onClick={() => step(-1)}><ChevronLeft className="size-4" /></Button>
        <Button variant="outline" onClick={() => setMonth(view === 'month' ? startOfMonth(new Date()) : startOfDay(new Date()))}>Today</Button>
        <Button variant="outline" size="icon" onClick={() => step(1)}><ChevronRight className="size-4" /></Button>
      </div>
    </div>
    {/* `danger` is not a token in this design system - globals.css defines
        --color-destructive. This banner rendered with no border and default
        text colour, so a failed reschedule looked like a stray paragraph. */}
    {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    {message && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}
    <Card><CardContent className="p-0">
      <div className="flex items-center justify-between border-b p-4"><h2 className="text-lg font-semibold">{periodLabel}</h2><span className="text-sm text-muted-foreground">{visibleTasks.length}{visibleTasks.length !== totalInRange && totalInRange ? ` of ${totalInRange}` : ''} scheduled tasks</span></div>
      {loading ? <div className="flex h-96 items-center justify-center"><Spinner /></div> : <>
        {view !== 'day' && <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs font-medium uppercase text-muted-foreground">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => <div key={day} className="p-3">{day}</div>)}</div>}
        <div className={view === 'day' ? 'grid grid-cols-1' : 'grid grid-cols-7'}>{days.map((day) => {
          const dayTasks = visibleTasks.filter((task) => occupiesDay(task, day))
          const dayKey = format(day, 'yyyy-MM-dd')
          return <div
            key={day.toISOString()}
            onDragOver={(event) => { if (draggingId) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropDay(dayKey) } }}
            onDragLeave={() => setDropDay((current) => (current === dayKey ? null : current))}
            onDrop={(event) => {
              event.preventDefault()
              const id = event.dataTransfer.getData('text/task-id')
              setDropDay(null); setDraggingId(null)
              if (id) void dropOnDay(id, day)
            }}
            className={`border-b border-r p-2 transition-colors ${view === 'month' ? 'min-h-32' : view === 'week' ? 'min-h-64' : 'min-h-96'} ${dropDay === dayKey ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : ''}`}
          ><span className={isSameMonth(day, month) ? 'text-sm font-medium' : 'text-sm text-muted-foreground/50'}>{format(day, 'd')}</span>
            <div className="mt-2 space-y-1">{dayTasks.map((task) => {
              const span = taskSpan(task)
              // WHERE THIS DAY SITS IN THE TASK'S RUN. A task with no start is
              // a single day and reads exactly as it did before; only a task
              // that actually spans gets the continuation treatment.
              const isFirst = !span || isSameDay(span.start, day)
              const isLast = !span || isSameDay(span.end, day)
              const multiDay = span !== null && !isSameDay(span.start, span.end)
              return <button
                key={task.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/task-id', task.id)
                  setDraggingId(task.id)
                }}
                onDragEnd={() => { setDraggingId(null); setDropDay(null) }}
                onClick={() => openTask(task)}
                title={taskTitleHint(task)}
                className={`block w-full truncate px-2 py-1 text-left text-xs font-medium ${projectColour(task.project).chip} ${
                  !multiDay ? 'rounded'
                    : isFirst ? 'rounded-l border-l-2 border-current'
                    : isLast ? 'rounded-r'
                    : ''
                }`}
              >
                {/* Only the first day carries the title. Repeating it on every
                    day of a three-week task turns the month into a wall of the
                    same sentence; the continuation days read as the bar they
                    are. */}
                {multiDay && !isFirst ? <span className="opacity-0">.</span> : task.title}
              </button>
            })}</div>
          </div>
        })}</div>
      </>}
      {!loading && (projects.length > 0 || visibleTasks.some((task) => !task.project)) && (
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
    {selected && <Card><CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" /><h3 className="font-semibold">{selected.title}</h3></div>
        <p className="mt-2 text-sm text-muted-foreground">{[selected.project || 'Not in a project', selected.assignee, `Due ${selected.due_date ?? '—'}`].filter(Boolean).join(' · ')}</p>
        <p className="mt-2 text-sm">{selected.description}</p>
        {/* A calendar you can only read is half a calendar - moving a deadline
            is the one edit people expect to make from this screen. */}
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-muted-foreground">
            <span className="mb-1 block">Move deadline to</span>
            <input type="date" value={newDueDate} onChange={(event) => setNewDueDate(event.target.value)} className="h-10 rounded-lg border px-3 text-sm font-normal text-foreground" />
          </label>
          <Button onClick={() => void reschedule()} disabled={rescheduling || !newDueDate || newDueDate === selected.due_date}>
            {rescheduling ? 'Rescheduling…' : 'Reschedule'}
          </Button>
        </div>
      </div>
      <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
    </CardContent></Card>}
  </div>
}
