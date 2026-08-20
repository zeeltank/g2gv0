'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Select } from '@/components/ui/select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { WorkspaceTask } from '@/types/task-management'

export function TaskCalendarView() {
  const [month, setMonth] = useState(startOfMonth(new Date()))
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

  const range = useMemo(() => ({
    from: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    to: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  }), [month])

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

  // One colour per project, assigned by stable sort order so a project keeps
  // its colour between renders. Standalone tasks (no project) are deliberately
  // NOT given a colour — they read as neutral, which is what distinguishes
  // them at a glance from project work.
  const projects = useMemo(
    () => [...new Set(tasks.map((task) => task.project).filter((name): name is string => Boolean(name)))].sort(),
    [tasks],
  )
  const projectColour = (project: string | null) => {
    if (!project) return 'bg-muted text-muted-foreground hover:bg-muted/80 border border-dashed border-border'
    const palette = [
      'bg-primary/10 text-primary hover:bg-primary/20',
      'bg-success/10 text-success hover:bg-success/20',
      'bg-warning/15 text-warning hover:bg-warning/25',
      'bg-destructive/10 text-destructive hover:bg-destructive/20',
      'bg-secondary/60 text-secondary-foreground hover:bg-secondary/80',
    ]
    return palette[projects.indexOf(project) % palette.length]
  }

  const visibleTasks = projectFilter
    ? tasks.filter((task) => (projectFilter === '__none__' ? !task.project : task.project === projectFilter))
    : tasks

  const days = eachDayOfInterval({ start: range.from, end: range.to })
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold tracking-tight">Task Calendar</h1><p className="text-sm text-muted-foreground">Deadlines across all visible projects and assignments.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-52"><Select value={projectFilter} onChange={setProjectFilter} options={[{ value: '', label: 'All projects' }, { value: '__none__', label: 'Not in a project' }, ...projects.map((name) => ({ value: name, label: name }))]} /></div>
        <Button variant="outline" size="icon" onClick={() => setMonth((value) => subMonths(value, 1))}><ChevronLeft className="size-4" /></Button><Button variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button><Button variant="outline" size="icon" onClick={() => setMonth((value) => addMonths(value, 1))}><ChevronRight className="size-4" /></Button>
      </div>
    </div>
    {error && <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
    {message && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}
    <Card><CardContent className="p-0">
      <div className="flex items-center justify-between border-b p-4"><h2 className="text-lg font-semibold">{format(month, 'MMMM yyyy')}</h2><span className="text-sm text-muted-foreground">{visibleTasks.length}{visibleTasks.length !== totalInRange && totalInRange ? ` of ${totalInRange}` : ''} scheduled tasks</span></div>
      {loading ? <div className="flex h-96 items-center justify-center"><Spinner /></div> : <>
        <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs font-medium uppercase text-muted-foreground">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => <div key={day} className="p-3">{day}</div>)}</div>
        <div className="grid grid-cols-7">{days.map((day) => {
          const dayTasks = visibleTasks.filter((task) => task.due_date && isSameDay(new Date(`${task.due_date}T00:00:00`), day))
          return <div key={day.toISOString()} className="min-h-32 border-b border-r p-2"><span className={isSameMonth(day, month) ? 'text-sm font-medium' : 'text-sm text-muted-foreground/50'}>{format(day, 'd')}</span>
            <div className="mt-2 space-y-1">{dayTasks.map((task) => <button key={task.id} onClick={() => openTask(task)} title={task.project ? `${task.project} — ${task.title}` : `Not in a project — ${task.title}`} className={`block w-full truncate rounded px-2 py-1 text-left text-xs font-medium ${projectColour(task.project)}`}>{task.title}</button>)}</div>
          </div>
        })}</div>
      </>}
      {!loading && (projects.length > 0 || visibleTasks.some((task) => !task.project)) && (
        <div className="flex flex-wrap items-center gap-3 border-t p-4 text-xs text-muted-foreground">
          <span className="font-medium">Projects:</span>
          {projects.map((name) => (
            <span key={name} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${projectColour(name).split(' ')[0]}`} />{name}</span>
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
