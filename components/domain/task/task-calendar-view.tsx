'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { getLaravelContext } from '@/lib/laravel-context'
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

  const range = useMemo(() => ({
    from: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    to: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  }), [month])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await taskService.getWorkspace(getLaravelContext(), {
        from: format(range.from, 'yyyy-MM-dd'), to: format(range.to, 'yyyy-MM-dd'), perPage: 100,
      })
      setTasks(response.data.tasks)
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

  const days = eachDayOfInterval({ start: range.from, end: range.to })
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold tracking-tight">Task Calendar</h1><p className="text-sm text-muted-foreground">Deadlines across all visible projects and assignments.</p></div>
      <div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => setMonth((value) => subMonths(value, 1))}><ChevronLeft className="size-4" /></Button><Button variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button><Button variant="outline" size="icon" onClick={() => setMonth((value) => addMonths(value, 1))}><ChevronRight className="size-4" /></Button></div>
    </div>
    {error && <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
    {message && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}
    <Card><CardContent className="p-0">
      <div className="flex items-center justify-between border-b p-4"><h2 className="text-lg font-semibold">{format(month, 'MMMM yyyy')}</h2><span className="text-sm text-muted-foreground">{tasks.length} scheduled tasks</span></div>
      {loading ? <div className="flex h-96 items-center justify-center"><Spinner /></div> : <>
        <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs font-medium uppercase text-muted-foreground">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => <div key={day} className="p-3">{day}</div>)}</div>
        <div className="grid grid-cols-7">{days.map((day) => {
          const dayTasks = tasks.filter((task) => task.due_date && isSameDay(new Date(`${task.due_date}T00:00:00`), day))
          return <div key={day.toISOString()} className="min-h-32 border-b border-r p-2"><span className={isSameMonth(day, month) ? 'text-sm font-medium' : 'text-sm text-muted-foreground/50'}>{format(day, 'd')}</span>
            <div className="mt-2 space-y-1">{dayTasks.map((task) => <button key={task.id} onClick={() => openTask(task)} className="block w-full truncate rounded bg-primary/10 px-2 py-1 text-left text-xs font-medium text-primary hover:bg-primary/20">{task.title}</button>)}</div>
          </div>
        })}</div>
      </>}
    </CardContent></Card>
    {selected && <Card><CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" /><h3 className="font-semibold">{selected.title}</h3></div>
        <p className="mt-2 text-sm text-muted-foreground">{selected.project} · {selected.assignee} · Due {selected.due_date ?? '—'}</p>
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
