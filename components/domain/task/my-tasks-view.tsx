'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  ListChecks,
  Plus,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import { PriorityBadge } from './priority-badge'
import type {
  MyTask,
  MyTaskGroup,
  MyTaskPriority,
  MyTaskSummary,
  TaskPagination,
  TaskStatus,
} from '@/types/task-management'
import { MyTaskDetailsDrawer } from './my-task-details-drawer'
import { CreateTaskModal } from './create-task-modal'

const EMPTY_SUMMARY: MyTaskSummary = {
  due_today: 0,
  on_hold: 0,
  in_progress: 0,
  completed_this_month: 0,
}

const EMPTY_PAGINATION: TaskPagination = {
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 0,
}

const GROUPS: Array<{ value: MyTaskGroup; label: string }> = [
  { value: 'all', label: 'All Tasks' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'recent', label: 'Recent' },
  { value: 'subordinates', label: 'Subordinate Tasks' },
]

export function MyTasksView() {
  const [tasks, setTasks] = useState<MyTask[]>([])
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [pagination, setPagination] = useState(EMPTY_PAGINATION)
  const [group, setGroup] = useState<MyTaskGroup>('all')
  const [status, setStatus] = useState<TaskStatus | 'all'>('all')
  const [priority, setPriority] = useState<MyTaskPriority | 'all'>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'board'>('list')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // const [createOpen, setCreateOpen] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadTasks = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await taskService.getMyTasks(context, {
        group,
        search: search || undefined,
        status: status === 'all' ? undefined : status,
        priority: priority === 'all' ? undefined : priority,
        page,
        perPage: 20,
      })
      setTasks(response.data.tasks)
      setSummary(response.data.summary)
      setPagination(response.data.pagination)
    } catch (reason) {
      setTasks([])
      setError(reason instanceof Error ? reason.message : 'Unable to load tasks.')
    } finally {
      setLoading(false)
    }
  }, [group, page, priority, search, status])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks, reloadKey])

  function selectGroup(nextGroup: MyTaskGroup) {
    setGroup(nextGroup)
    setPage(1)
  }

  const cards = useMemo(() => [
    {
      title: 'Due Today',
      value: summary.due_today,
      subtitle: 'Requires action today',
      icon: Clock,
      action: () => { selectGroup('today'); setStatus('all') },
    },
    {
      title: 'On Hold',
      value: summary.on_hold,
      subtitle: 'Waiting for progress',
      icon: AlertCircle,
      action: () => { selectGroup('all'); setStatus('ON HOLD') },
    },
    {
      title: 'In Progress',
      value: summary.in_progress,
      subtitle: 'Currently being worked',
      icon: ListChecks,
      action: () => { selectGroup('all'); setStatus('IN-PROGRESS') },
    },
    {
      title: 'Completed',
      value: summary.completed_this_month,
      subtitle: 'Finished this month',
      icon: CheckCircle2,
      action: () => { selectGroup('all'); setStatus('COMPLETED') },
    },
  ], [summary])

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your assigned work and verified reporting-line tasks</p>
        </div>
        {/* <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 size-4" />Assign Task</Button> */}
      </div>
      {message && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ title, value, subtitle, icon: Icon, action }) => (
          <Card key={title} role="button" tabIndex={0} onClick={action} className="cursor-pointer transition-colors hover:border-primary/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-5 overflow-x-auto border-b">
        {GROUPS.map((item) => (
          <Button
            key={item.value}
            variant="ghost"
            onClick={() => selectGroup(item.value)}
            className={cn(
              'h-auto shrink-0 rounded-none border-b-2 px-1 pb-3',
              group === item.value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
            )}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card/40 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search title, description, or assigner…"
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <Select
            value={status}
            onChange={(value) => { setStatus(value as TaskStatus | 'all'); setPage(1) }}
            options={[
              { label: 'All Statuses', value: 'all' },
              { label: 'Pending', value: 'PENDING' },
              { label: 'In Progress', value: 'IN-PROGRESS' },
              { label: 'On Hold', value: 'ON HOLD' },
              { label: 'Completed', value: 'COMPLETED' },
            ]}
            className="w-full sm:w-40"
          />
          <Select
            value={priority}
            onChange={(value) => { setPriority(value as MyTaskPriority | 'all'); setPage(1) }}
            options={[
              { label: 'All Priorities', value: 'all' },
              { label: 'High', value: 'High' },
              { label: 'Medium', value: 'Medium' },
              { label: 'Low', value: 'Low' },
            ]}
            className="w-full sm:w-40"
          />
        </div>

        <div className="flex rounded-lg border bg-muted/30 p-1">
          <Button variant="ghost" size="icon" aria-label="List view" onClick={() => setView('list')} className={view === 'list' ? 'bg-background text-primary shadow-sm' : ''}>
            <List className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Board view" onClick={() => setView('board')} className={view === 'board' ? 'bg-background text-primary shadow-sm' : ''}>
            <LayoutGrid className="size-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border"><Spinner /></div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-danger/20 bg-danger/5 p-6 text-center">
            <AlertCircle className="size-9 text-danger" />
            <div><p className="font-semibold">Unable to load tasks</p><p className="text-sm text-muted-foreground">{error}</p></div>
            <Button variant="outline" onClick={() => setReloadKey((value) => value + 1)}>Try again</Button>
          </div>
        ) : view === 'list' ? (
          <TaskTable tasks={tasks} onSelect={setSelectedTaskId} />
        ) : (
          <TaskBoard tasks={tasks} onSelect={setSelectedTaskId} />
        )}
      </div>

      {!loading && !error && pagination.total > 0 && (
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">{pagination.total} task{pagination.total === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <span>Page {pagination.current_page} of {pagination.last_page}</span>
            <Button variant="outline" size="sm" disabled={page >= pagination.last_page} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      )}

      <MyTaskDetailsDrawer
        taskId={selectedTaskId}
        open={selectedTaskId !== null}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={() => setReloadKey((value) => value + 1)}
      />
      {/* <CreateTaskModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(text) => { setMessage(text); setReloadKey((value) => value + 1) }}
      /> */}
    </div>
  )
}

function TaskTable({ tasks, onSelect }: { tasks: MyTask[]; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Assigned By</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id} className="cursor-pointer" onClick={() => onSelect(task.id)}>
                <TableCell><p className="font-medium">{task.title}</p><p className="max-w-sm truncate text-xs text-muted-foreground">{task.description || 'No description'}</p></TableCell>
                <TableCell>{task.owner}</TableCell>
                <TableCell>{task.department || '—'}</TableCell>
                <TableCell><span className="flex items-center gap-2"><CalendarDays className="size-4 text-muted-foreground" />{formatDate(task.due_date)}</span></TableCell>
                <TableCell><PriorityBadge priority={task.priority ?? task.task_type} /></TableCell>
                <TableCell><StatusBadge status={task.status} /></TableCell>
              </TableRow>
            ))}
            {tasks.length === 0 && (
              <TableRow><TableCell colSpan={6} className="h-44 text-center text-muted-foreground">No tasks match the selected filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function TaskBoard({ tasks, onSelect }: { tasks: MyTask[]; onSelect: (id: string) => void }) {
  const statuses: TaskStatus[] = ['PENDING', 'IN-PROGRESS', 'ON HOLD', 'COMPLETED']
  return (
    <div className="grid min-h-80 gap-3 overflow-x-auto lg:grid-cols-4">
      {statuses.map((status) => {
        const matching = tasks.filter((task) => task.status === status)
        return (
          <section key={status} className="min-w-60 rounded-xl border bg-muted/10 p-3">
            <div className="mb-3 flex items-center justify-between"><StatusBadge status={status} /><span className="text-xs text-muted-foreground">{matching.length}</span></div>
            <div className="space-y-3">
              {matching.map((task) => (
                <button key={task.id} type="button" onClick={() => onSelect(task.id)} className="w-full rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40">
                  <p className="text-sm font-semibold">{task.title}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span>{formatDate(task.due_date)}</span><span>·</span><PriorityBadge priority={task.priority ?? task.task_type} /></div>
                </button>
              ))}
              {matching.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">No tasks</div>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return 'No due date'
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
