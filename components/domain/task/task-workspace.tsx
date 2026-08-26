'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Archive, BarChart3, CalendarDays, CheckCircle2, CheckSquare, Clock, Eye, Filter, LayoutGrid, List, ListChecks, Plus, Search, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { getLaravelContext } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { TaskStatus, TaskStatusOption, WorkspaceScope, WorkspaceTask } from '@/types/task-management'
import { CreateTaskModal } from './create-task-modal'
import { PriorityBadge } from './priority-badge'

const statusLabels: Record<TaskStatus, string> = {
  PENDING: 'Pending', 'IN-PROGRESS': 'In Progress', 'ON HOLD': 'On Hold', COMPLETED: 'Completed',
}

/**
 * What to call a task's status on screen. A tenant's custom status is a label
 * on one of the four system categories, so the label wins where it exists -
 * otherwise every "Awaiting Client" task reads as plain "On Hold".
 */
function statusText(task: Pick<WorkspaceTask, 'status' | 'status_label'>) {
  return task.status_label || statusLabels[task.status]
}

const EMPTY_PAGINATION = { current_page: 1, last_page: 1, per_page: 25, total: 0 }
type WorkspaceView = 'list' | 'grid' | 'board' | 'analytics'

export function TaskWorkspace() {
  const [tasks, setTasks] = useState<WorkspaceTask[]>([])
  const [summary, setSummary] = useState({ active: 0, pending_review: 0, blocked_overdue: 0, completed_this_month: 0 })
  const [scope, setScope] = useState<WorkspaceScope>('all')
  const [status, setStatus] = useState<string>('all')
  const [statusOptions, setStatusOptions] = useState<TaskStatusOption[]>([])
  const [pagination, setPagination] = useState(EMPTY_PAGINATION)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<WorkspaceView>('list')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<WorkspaceTask | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [reload, setReload] = useState(0)

  /*
   * EDITING A TASK, ON THE SCREEN PEOPLE ACTUALLY USE.
   *
   * This Sheet offered Approve / Reject / Archive and nothing else, so the
   * only way to change a task was the My Tasks drawer - which is a different
   * screen, shows only your own work, and wrote through the legacy web route.
   *
   * The form covers EXACTLY the eight fields `updateWorkspaceTask` accepts.
   * Reusing CreateTaskModal was considered and rejected: it collects projects,
   * workstreams, dependencies, competencies, attachments and bulk rows, none
   * of which this endpoint saves - it would show fifteen fields of which seven
   * silently do nothing.
   */
  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', assignee_id: '', owner_id: '',
    status: '', priority: '', due_date: '', remarks: '',
  })
  const [people, setPeople] = useState<Array<{ id: string; name: string }>>([])
  const [priorityOptions, setPriorityOptions] = useState<string[]>([])

  /**
   * People and priorities, fetched once the first time an edit is opened.
   *
   * Not with the list: the workspace renders fine without them, and most
   * visits never edit anything. Failures are swallowed into an empty list -
   * the Select then shows the task's CURRENT value as its only option, so an
   * edit of the title still saves rather than being blocked by a lookup.
   */
  const loadEditOptions = useCallback(async () => {
    if (people.length && priorityOptions.length) return
    const context = getLaravelContext()
    const [users, priorities] = await Promise.allSettled([
      taskService.getAssignmentUsers(context),
      taskService.getPriorityOptions(context),
    ])
    if (users.status === 'fulfilled') {
      setPeople(users.value.map((user) => ({
        id: String(user.id),
        name: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' '),
      })))
    }
    if (priorities.status === 'fulfilled') {
      setPriorityOptions(priorities.value.data.priorities.map((option) => option.name))
    }
  }, [people.length, priorityOptions.length])

  const openEdit = (task: WorkspaceTask) => {
    setForm({
      title: task.title,
      description: task.description ?? '',
      assignee_id: task.assignee_id ?? '',
      owner_id: task.owner_id ?? '',
      // The tenant's own label where there is one, so a custom status round-trips.
      status: task.status_label ?? task.status,
      priority: task.priority ?? '',
      due_date: task.due_date ?? '',
      remarks: task.remarks ?? '',
    })
    setEditing(true); setError(''); setMessage('')
    void loadEditOptions()
  }

  const saveEdit = async () => {
    if (!selected) return
    if (!form.title.trim()) { setError('A task needs a title.'); return }
    // assignee_id and owner_id are REQUIRED by the endpoint; saying so here
    // beats a 422 that names a field the form calls something else.
    if (!form.assignee_id) { setError('Choose who this task is assigned to.'); return }
    if (!form.owner_id) { setError('Choose who owns this task.'); return }

    setSavingEdit(true); setError(''); setMessage('')
    try {
      const response = await taskService.updateWorkspaceTask(getLaravelContext(), selected.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        assignee_id: form.assignee_id,
        owner_id: form.owner_id,
        status: form.status as WorkspaceTask['status'],
        priority: form.priority as NonNullable<WorkspaceTask['priority']>,
        ...(form.due_date ? { due_date: form.due_date } : {}),
        ...(form.remarks.trim() ? { remarks: form.remarks.trim() } : {}),
      })
      // The server returns the saved row - show THAT, not the form state, so
      // anything it normalised (status category, resolved priority) is visible.
      setSelected(response.data)
      setMessage(response.message)
      setEditing(false)
      setReload((current) => current + 1)
    } catch (reason) {
      // 403 for a task you neither own, created nor were assigned; 422 for an
      // illegal status move. Both are the server's words, shown as they are.
      setError(reason instanceof Error ? reason.message : 'Unable to save this task.')
    } finally { setSavingEdit(false) }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await taskService.getWorkspace(getLaravelContext(), {
        scope, search: search || undefined, status: status === 'all' ? undefined : status,
        page, perPage: EMPTY_PAGINATION.per_page,
      })
      setTasks(response.data.tasks); setSummary(response.data.summary)
      setPagination(response.data.pagination)
      setStatusOptions(response.data.filters.status_options)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the task workspace.')
    } finally { setLoading(false) }
  }, [page, scope, search, status])
  useEffect(() => {
    // Deferred so the load's first setState lands after this render. `reload`
    // is the manual refetch trigger the mutation handlers bump.
    queueMicrotask(() => { void load() })
  }, [load, reload])

  const cards = useMemo(() => [
    { title: 'Active Tasks', value: summary.active, subtitle: 'Open work across this scope', icon: ListChecks },
    { title: 'Pending Review', value: summary.pending_review, subtitle: 'Awaiting owner approval', icon: Clock },
    { title: 'Blocked / Overdue', value: summary.blocked_overdue, subtitle: 'Requires attention', icon: AlertCircle },
    { title: 'Completed', value: summary.completed_this_month, subtitle: 'Finished this month', icon: CheckCircle2 },
  ], [summary])

  const decide = async (task: WorkspaceTask, decision: 'approve' | 'reject') => {
    try {
      const response = await taskService.decideWorkspaceTask(getLaravelContext(), task.id, decision)
      setMessage(response.message); setSelected(null); setReload((value) => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update approval.') }
  }
  const archive = async (task: WorkspaceTask) => {
    if (!window.confirm(`Archive “${task.title}”?`)) return
    try {
      const response = await taskService.archiveWorkspaceTask(getLaravelContext(), task.id)
      setMessage(response.message); setSelected(null); setReload((value) => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to archive task.') }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold tracking-tight">Task Management Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Track assignments, reviews, deadlines, and ownership.</p></div>
      <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 size-4" />Assign Task</Button>
    </div>
    {message && <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}
    {error && <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ title, value, subtitle, icon: Icon }) =>
      <Card key={title}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">{title}</CardTitle><Icon className="size-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-bold">{value}</div><p className="text-xs text-muted-foreground">{subtitle}</p></CardContent></Card>)}
    </div>

    <div className="rounded-2xl border border-primary/10 bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-[48%]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search tasks, assignees, or projects..." className="h-10 w-full rounded-xl border border-input bg-muted/20 pl-9 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" /></div>
        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:items-center lg:justify-end">
          <div className="lg:w-52"><Select value={scope} onChange={(value) => { setScope(value as WorkspaceScope); setPage(1) }} className="h-10" options={[
            { value: 'all', label: 'All Tasks Workspace' }, { value: 'mine', label: 'Assigned to me' }, { value: 'created', label: 'Created by me' }, { value: 'team', label: 'My team' }, { value: 'department', label: 'My department' },
          ]} /></div>
          <div className="lg:w-44"><Select value={status} onChange={(value) => { setStatus(value); setPage(1) }} className="h-10" options={[
            // The tenant's own vocabulary, not a hardcoded four - a custom
            // status filters by its label, a system one by its category.
            { value: 'all', label: 'All Statuses' },
            ...(statusOptions.length
              ? statusOptions.map((option) => ({ value: option.is_system ? option.category : option.name, label: option.name }))
              : Object.entries(statusLabels).map(([value, label]) => ({ value, label }))),
          ]} /></div>
          <DropdownMenu><DropdownMenuTrigger className="flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"><Filter className="size-4" />More</DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={() => setScope('mine')}>Assigned to me</DropdownMenuItem><DropdownMenuItem onClick={() => setScope('created')}>Created by me</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => { setScope('all'); setStatus('all'); setSearchInput(''); setPage(1) }}>Clear all filters</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <div className="hidden h-6 w-px bg-border lg:block" />
          <div className="col-span-full flex h-10 items-center justify-center rounded-xl border bg-muted/20 p-1 sm:col-span-2 lg:col-span-1">
            {([['list', List, 'List'], ['grid', LayoutGrid, 'Grid'], ['board', CheckSquare, 'Board'], ['analytics', BarChart3, 'Analytics']] as const).map(([value, Icon, label]) =>
              <button key={value} type="button" title={label} aria-label={`${label} view`} onClick={() => setView(value)} className={`flex size-8 items-center justify-center rounded-lg transition ${view === value ? 'bg-background text-primary shadow-sm ring-1 ring-primary/10' : 'text-muted-foreground hover:text-foreground'}`}><Icon className="size-4" /></button>)}
          </div>
        </div>
      </div>
    </div>

    {loading ? <div className="flex h-72 items-center justify-center rounded-2xl border bg-card"><Spinner /></div> : !tasks.length ? <div className="flex h-72 items-center justify-center rounded-2xl border bg-card text-sm text-muted-foreground">No tasks match the selected filters.</div> : view === 'list' ? <TaskTable tasks={tasks} onSelect={setSelected} onArchive={archive} /> : view === 'grid' ? <TaskGrid tasks={tasks} onSelect={setSelected} /> : view === 'board' ? <TaskApprovals tasks={tasks} onSelect={setSelected} onDecision={decide} /> : <TaskAnalytics tasks={tasks} />}

    {/* The Dashboard is org-wide, so the list is almost always longer than one
        page. Same pager the My Tasks list uses. */}
    {!loading && !error && pagination.total > 0 && (
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{pagination.total} task{pagination.total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
          <span>Page {pagination.current_page} of {pagination.last_page}</span>
          <Button variant="outline" size="sm" disabled={page >= pagination.last_page} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      </div>
    )}

    <Sheet open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setEditing(false) } }}><SheetContent className="w-full overflow-y-auto sm:max-w-xl">{selected && <>
      <SheetHeader><SheetTitle>{selected.title}</SheetTitle><SheetDescription>{selected.project} · {selected.assignee}</SheetDescription></SheetHeader>

      {editing ? (
        <div className="space-y-4 p-5">
          <div className="space-y-1">
            <label htmlFor="edit-title" className="text-xs font-semibold text-muted-foreground">Title</label>
            <input id="edit-title" value={form.title} onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-description" className="text-xs font-semibold text-muted-foreground">Description</label>
            <textarea id="edit-description" value={form.description} onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
              rows={3} className="w-full rounded-lg border bg-background p-3 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Assignee</span>
              {/* The task's CURRENT person is always an option, so a failed
                  lookup cannot blank a field the endpoint requires. */}
              <Select value={form.assignee_id} onChange={(value) => setForm((f) => ({ ...f, assignee_id: value }))}
                options={optionsWith(people, selected.assignee_id, selected.assignee)} />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Owner</span>
              <Select value={form.owner_id} onChange={(value) => setForm((f) => ({ ...f, owner_id: value }))}
                options={optionsWith(people, selected.owner_id, selected.owner)} />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Status</span>
              <Select value={form.status} onChange={(value) => setForm((f) => ({ ...f, status: value }))}
                options={statusOptions.length
                  ? statusOptions.map((option) => ({ value: option.is_system ? option.category : option.name, label: option.name }))
                  : [{ value: form.status, label: form.status }]} />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Priority</span>
              <Select value={form.priority} onChange={(value) => setForm((f) => ({ ...f, priority: value }))}
                options={(priorityOptions.length ? priorityOptions : [form.priority].filter(Boolean)).map((name) => ({ value: name, label: name }))} />
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-due" className="text-xs font-semibold text-muted-foreground">Due date</label>
              <input id="edit-due" type="date" value={form.due_date} onChange={(event) => setForm((f) => ({ ...f, due_date: event.target.value }))}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-remarks" className="text-xs font-semibold text-muted-foreground">Remarks</label>
              <input id="edit-remarks" value={form.remarks} onChange={(event) => setForm((f) => ({ ...f, remarks: event.target.value }))}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
            </div>
          </div>

          {/* Said before they try it, not after a 422. The server enforces the
              same rule; this only saves them the round trip. */}
          <p className="text-xs text-muted-foreground">
            You can edit tasks you own, created, or are assigned to. Status moves follow the
            workflow — a completed task reopens to In Progress, never back to Pending.
          </p>

          <div className="flex gap-2">
            <Button onClick={() => void saveEdit()} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</Button>
            <Button variant="outline" onClick={() => { setEditing(false); setError('') }} disabled={savingEdit}>Cancel</Button>
          </div>
        </div>
      ) : (
      <div className="space-y-5 p-5"><p className="text-sm">{selected.description || 'No description provided.'}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">{[['Status', statusText(selected)], ['Priority', selected.priority ?? '—'], ['Owner', selected.owner], ['Department', selected.department || '—'], ['Due date', selected.due_date ?? '—'], ['Approval', selected.approved ? 'Approved' : 'Pending']].map(([label, value]) => <div key={label} className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{label}</p><div className="mt-1 font-medium">{label === 'Priority' ? <PriorityBadge priority={selected.priority} /> : label === 'Status' ? <StatusBadge status={selected.status} label={statusText(selected)} /> : label === 'Approval' ? <StatusBadge status={selected.approved ? 'Approved' : 'Pending'} /> : value}</div></div>)}</div>
        {selected.status === 'COMPLETED' && !selected.approved && <div className="flex gap-2"><Button onClick={() => void decide(selected, 'approve')}>Approve</Button><Button variant="outline" onClick={() => void decide(selected, 'reject')}>Reject</Button></div>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openEdit(selected)}>Edit Task</Button>
          {/* `danger` is not a token here either - globals.css defines
              --color-destructive, so this button rendered with default text. */}
          <Button variant="outline" className="text-destructive" onClick={() => void archive(selected)}>Archive Task</Button>
        </div>
      </div>
      )}</>}</SheetContent></Sheet>
    <CreateTaskModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={(value) => { setMessage(value); setReload((current) => current + 1) }} />
  </div>
}

/**
 * Options that always contain the value currently selected.
 *
 * The assignee and owner lookups can fail or arrive late, and both fields are
 * REQUIRED by the endpoint. Without this, a slow lookup would leave the Select
 * showing nothing while the form held a real id - the user would see an empty
 * required field and assume the task had no assignee.
 */
function optionsWith(
  people: Array<{ id: string; name: string }>,
  currentId: string | null,
  currentName: string,
): Array<{ value: string; label: string }> {
  const options = people.map((person) => ({ value: person.id, label: person.name }))
  if (currentId && !options.some((option) => option.value === currentId)) {
    options.unshift({ value: currentId, label: currentName || `User #${currentId}` })
  }
  return options
}

function TaskTable({ tasks, onSelect, onArchive }: { tasks: WorkspaceTask[]; onSelect: (task: WorkspaceTask) => void; onArchive: (task: WorkspaceTask) => Promise<void> }) {
  return <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-primary/[0.045]"><tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><th className="px-6 py-4">Task Name</th><th className="px-5 py-4">Project</th><th className="px-5 py-4">Assignee</th><th className="px-5 py-4">Priority</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Due Date</th><th className="px-6 py-4 text-right">Quick Actions</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} className="border-b last:border-0 hover:bg-muted/30"><td className="px-6 py-4"><button onClick={() => onSelect(task)} className="max-w-72 text-left"><p className="font-semibold">{task.title}</p><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{task.description}</p></button></td><td className="px-5 py-4">{task.project}</td><td className="px-5 py-4">{task.assignee}</td><td className="px-5 py-4"><PriorityBadge priority={task.priority} /></td><td className="px-5 py-4"><StatusBadge status={task.status} label={statusText(task)} /></td><td className="whitespace-nowrap px-5 py-4">{formatDueDate(task.due_date)}</td><td className="px-6 py-4"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="View task" onClick={() => onSelect(task)}><Eye className="size-4" /></Button><Button variant="ghost" size="icon" title="Archive task" onClick={() => void onArchive(task)}><Archive className="size-4 text-destructive" /></Button></div></td></tr>)}</tbody></table></div></div>
}

function TaskGrid({ tasks, onSelect }: { tasks: WorkspaceTask[]; onSelect: (task: WorkspaceTask) => void }) {
  const columns = [
    { id: 'todo', label: 'To Do', dot: 'bg-slate-500', tasks: tasks.filter((task) => task.status === 'PENDING') },
    { id: 'progress', label: 'In Progress', dot: 'bg-blue-600', tasks: tasks.filter((task) => task.status === 'IN-PROGRESS') },
    { id: 'review', label: 'Review', dot: 'bg-amber-500', tasks: tasks.filter((task) => task.status === 'COMPLETED' && !task.approved) },
    { id: 'blocked', label: 'Blocked', dot: 'bg-rose-500', tasks: tasks.filter((task) => task.status === 'ON HOLD') },
    { id: 'done', label: 'Done', dot: 'bg-emerald-500', tasks: tasks.filter((task) => task.status === 'COMPLETED' && task.approved) },
  ]
  return <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-card shadow-sm">
    <div className="grid min-w-[1180px] grid-cols-5">
      {columns.map((column) => <section key={column.id} className="min-h-[320px] border-r border-border/60 p-3 last:border-r-0">
        <header className="mb-3 flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${column.dot}`} /><h3 className="text-xs font-semibold uppercase tracking-[0.08em]">{column.label}</h3></div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{column.tasks.length}</span>
        </header>
        <div className="space-y-3">{column.tasks.map((task) => {
          const initials = task.assignee.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—'
          const accent = task.priority === 'High' ? 'border-t-destructive' : task.priority === 'Medium' ? 'border-t-warning' : task.priority === 'Low' ? 'border-t-success' : 'border-t-purple-700'
          return <button key={task.id} onClick={() => onSelect(task)} className={`w-full rounded-2xl border border-t-2 bg-background p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accent}`}>
            <PriorityBadge priority={task.priority} className="border-0 bg-transparent px-0 py-0 text-[10px] uppercase" />
            <h4 className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold leading-5">{task.title}</h4>
            <div className="mt-4 flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{formatShortDate(task.due_date)}</span>
              <span title={task.assignee} className="flex size-6 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-[9px] font-semibold text-primary">{initials}</span>
            </div>
          </button>
        })}</div>
      </section>)}
    </div>
  </div>
}

function TaskApprovals({ tasks, onSelect, onDecision }: {
  tasks: WorkspaceTask[]
  onSelect: (task: WorkspaceTask) => void
  onDecision: (task: WorkspaceTask, decision: 'approve' | 'reject') => Promise<void>
}) {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const groups = {
    pending: tasks.filter((task) => task.status === 'COMPLETED' && !task.approved),
    approved: tasks.filter((task) => task.status === 'COMPLETED' && task.approved),
    rejected: tasks.filter((task) => task.status === 'ON HOLD'),
  }
  const visible = groups[tab]
  return <section className="rounded-2xl border border-primary/10 bg-card p-6 shadow-sm">
    <div className="mb-6 flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 text-primary shadow-sm"><CheckSquare className="size-6" /></span><h2 className="text-2xl font-bold tracking-tight">Approvals &amp; Reviews</h2></div>
    <div className="mb-6 flex w-fit flex-wrap items-center rounded-2xl border bg-muted/20 p-1 shadow-sm">
      {([
        ['pending', Clock, 'Pending Reviews'], ['approved', CheckCircle2, 'Approved'], ['rejected', XCircle, 'Rejected / Rework'],
      ] as const).map(([value, Icon, label]) => <button key={value} onClick={() => setTab(value)} className={`flex h-9 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition ${tab === value ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}><Icon className="size-4" />{label}<span className={`rounded-full px-2 py-0.5 text-[10px] ${tab === value ? 'bg-white/20' : 'bg-muted'}`}>{groups[value].length}</span></button>)}
    </div>
    <div className="space-y-4">{visible.length ? visible.map((task) => <article key={task.id} className="relative overflow-hidden rounded-3xl border bg-background p-5 pl-8 shadow-sm">
      <span className="absolute inset-y-0 left-0 w-1.5 bg-primary/35" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <button onClick={() => onSelect(task)} className="flex min-w-0 items-center gap-4 text-left">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 text-xs font-bold text-primary">{task.assignee.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
          <span className="min-w-0"><span className="flex flex-wrap items-center gap-3"><strong className="truncate text-base">{task.title}</strong><span className="rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">TSK-{task.id}</span></span><span className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground"><span className="text-primary">●</span><span>{task.project}</span><span className="flex items-center gap-1"><CalendarDays className="size-3.5" />Submitted {formatShortDate(task.updated_at?.slice(0, 10) ?? task.due_date)}</span></span></span>
        </button>
        {tab === 'pending' && <div className="flex shrink-0 gap-3"><Button variant="outline" className="min-w-28 rounded-xl" onClick={() => void onDecision(task, 'reject')}><XCircle className="mr-2 size-4" />Reject</Button><Button className="min-w-32 rounded-xl shadow-md" onClick={() => void onDecision(task, 'approve')}><CheckCircle2 className="mr-2 size-4" />Approve</Button></div>}
        {tab !== 'pending' && <StatusBadge status={tab === 'approved' ? 'Completed' : 'On Hold'} label={tab === 'approved' ? 'Approved' : 'Rework'} />}
      </div>
    </article>) : <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">No {tab === 'pending' ? 'pending reviews' : tab} tasks.</div>}</div>
  </section>
}

function TaskAnalytics({ tasks }: { tasks: WorkspaceTask[] }) {
  const statuses = Object.keys(statusLabels) as TaskStatus[]
  return <div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Status Distribution</CardTitle></CardHeader><CardContent className="space-y-4">{statuses.map((status) => { const count = tasks.filter((task) => task.status === status).length; return <div key={status}><div className="mb-1 flex items-center justify-between text-sm"><StatusBadge status={status} label={statusLabels[status]} /><span>{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${tasks.length ? count * 100 / tasks.length : 0}%` }} /></div></div> })}</CardContent></Card><Card><CardHeader><CardTitle>Priority Distribution</CardTitle></CardHeader><CardContent className="space-y-4">{['High','Medium','Low'].map((priority) => { const count = tasks.filter((task) => task.priority === priority).length; return <div key={priority} className="flex items-center justify-between rounded-xl border p-3"><PriorityBadge priority={priority} /><span className="text-xl font-bold">{count}</span></div> })}</CardContent></Card></div>
}

function formatDueDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : '—'
}

function formatShortDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'
}
