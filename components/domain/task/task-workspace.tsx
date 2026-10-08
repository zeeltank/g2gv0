'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Archive, BarChart3, CalendarDays, CheckCircle2, CheckSquare, Clock, Eye, Filter, LayoutGrid, List, ListChecks, Plus, Search, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/select'
import type { SearchableOption } from '@/components/ui/searchable-select'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { getLaravelContext } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { BacklogItem, TaskPriorityOption, TaskStatus, TaskStatusOption, WorkspaceScope, WorkspaceTask } from '@/types/task-management'
import { BacklogBoard } from './backlog-board'
import { CreateTaskModal } from './create-task-modal'
import { MyTaskDetailsDrawer } from './my-task-details-drawer'
import { PriorityBadge } from './priority-badge'
import { TaskReminderToast } from './task-reminder-toast'
import { WorkspaceBulkActionBar } from './workspace-bulk-action-bar'
import { bulkResultMessage } from './bulk-result-message'

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
/**
 * `backlog` is a fifth VIEW rather than a section stacked under the task list.
 *
 * The toggle already answers "what is this dashboard showing" rather than "how
 * do I draw tasks" — `analytics` broke that reading first. Stacking an
 * 800px panel beneath an already-long table would bury it.
 */
type WorkspaceView = 'list' | 'grid' | 'board' | 'analytics' | 'backlog'

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
  // Grid-only: which vocabulary TaskGrid builds its columns from.
  const [groupBy, setGroupBy] = useState<'status' | 'priority'>('status')
  const [priorityOptions, setPriorityOptions] = useState<TaskPriorityOption[]>([])
  const [backlogAdd, setBacklogAdd] = useState(0)
  const [promoting, setPromoting] = useState<BacklogItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [reload, setReload] = useState(0)
  // Bulk selection: a Set of task ids, not WorkspaceTask rows - rows live in
  // `tasks` already, and an id-only selection survives a page's own data
  // being re-fetched without going stale against a stale WorkspaceTask copy.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [assigneeOptions, setAssigneeOptions] = useState<SearchableOption[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    // A selection from a different page/filter/scope refers to rows that are
    // about to disappear from `tasks` - carrying it over would let someone
    // bulk-act on ids they can no longer see on screen.
    setSelectedIds(new Set())
    try {
      const response = await taskService.getWorkspace(getLaravelContext(), {
        scope, search: search || undefined, status: status === 'all' ? undefined : status,
        page, perPage: EMPTY_PAGINATION.per_page,
      })
      setTasks(response.data.tasks); setSummary(response.data.summary)
      setPagination(response.data.pagination)
      setStatusOptions(response.data.filters.status_options)
      // Already returned by this same call, previously fetched and
      // discarded - the priority-grouped Grid view needs it to build its
      // columns, ordered and colored, with no extra network round trip.
      setPriorityOptions(response.data.filters.priority_options)
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
    /*
     * A REJECTION MUST CARRY ITS REASON.
     *
     * The endpoint and the service both accept `remarks`, and this never sent
     * any — so `approve_remarks` was NULL on every rejection ever recorded. Three
     * things depend on it: the employee is told why their work came back, the
     * notification template reads {payload.approve_remarks}, and the capability
     * evidence a rejection now raises cites it. Sending a task back with no
     * stated reason produces a mark on someone's record that nobody can contest.
     *
     * Approval needs no reason, so it is not asked for one.
     */
    let remarks = ''

    if (decision === 'reject') {
      const given = window.prompt(
        `Why is “${task.title}” being sent back?

The assignee sees this, and it is recorded as the reason.`,
        '',
      )

      // Cancelled — not a rejection with an empty reason. Nothing is sent.
      if (given === null) return

      remarks = given.trim()

      if (remarks === '') {
        setError('A rejection needs a reason. The assignee is shown it, and it is kept on the record.')
        return
      }
    }

    try {
      const response = await taskService.decideWorkspaceTask(getLaravelContext(), task.id, decision, remarks)
      setMessage(response.message); setSelectedId(null); setReload((value) => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update approval.') }
  }
  const archive = async (task: WorkspaceTask) => {
    if (!window.confirm(`Archive “${task.title}”?`)) return
    try {
      const response = await taskService.archiveWorkspaceTask(getLaravelContext(), task.id)
      setMessage(response.message); setSelectedId(null); setReload((value) => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to archive task.') }
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAllSelected = (checked: boolean) => {
    setSelectedIds(checked ? new Set(tasks.map((task) => task.id)) : new Set())
  }
  const clearSelection = () => setSelectedIds(new Set())

  /**
   * The user picker, fetched once the first time a selection exists rather
   * than on every Dashboard visit - most visits never bulk-reassign anything.
   */
  useEffect(() => {
    if (!selectedIds.size || assigneeOptions.length) return
    taskService.getAssignmentUsers(getLaravelContext())
      .then((users) => setAssigneeOptions(users.map((user) => ({
        value: String(user.id),
        label: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' '),
      }))))
      .catch(() => { /* the picker shows no options; bulk delete still works */ })
  }, [selectedIds.size, assigneeOptions.length])

  const bulkReassign = async (assigneeId: string) => {
    setBulkBusy(true); setError(''); setMessage('')
    try {
      const response = await taskService.bulkReassignTasks(getLaravelContext(), Array.from(selectedIds), assigneeId)
      setMessage(bulkResultMessage('Reassigned', response.data))
      clearSelection(); setReload((value) => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reassign the selected tasks.')
    } finally { setBulkBusy(false) }
  }
  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} selected task${selectedIds.size === 1 ? '' : 's'}?`)) return
    setBulkBusy(true); setError(''); setMessage('')
    try {
      const response = await taskService.bulkDeleteTasks(getLaravelContext(), Array.from(selectedIds))
      setMessage(bulkResultMessage('Deleted', response.data))
      clearSelection(); setReload((value) => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the selected tasks.')
    } finally { setBulkBusy(false) }
  }

  // The row behind the open drawer, for the Dashboard-only approve/reject/
  // archive actions - MyTaskDetailsDrawer fetches the task itself by id, but
  // approval-chain fields only exist on WorkspaceTask, which is this list.
  const selectedRow = tasks.find((task) => task.id === selectedId) ?? null

  return <div className="space-y-6">
    <TaskReminderToast />
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold tracking-tight">Task Management Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Track assignments, reviews, deadlines, and ownership.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {/* Visible in every view: a notepad you have to navigate to is a
            notepad people stop using. */}
        <Button variant="outline" onClick={() => { setView('backlog'); setBacklogAdd((n) => n + 1) }}>
          <ListChecks className="mr-2 size-4" />Add to Backlog
        </Button>
        <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 size-4" />Assign Task</Button>
      </div>
    </div>
    {message && <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}
    {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
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
            {([['list', List, 'List'], ['grid', LayoutGrid, 'Grid'], ['board', CheckSquare, 'Board'], ['analytics', BarChart3, 'Analytics'], ['backlog', ListChecks, 'Backlog']] as const).map(([value, Icon, label]) =>
              <button key={value} type="button" title={label} aria-label={`${label} view`} onClick={() => setView(value)} className={`flex size-8 items-center justify-center rounded-lg transition ${view === value ? 'bg-background text-primary shadow-sm ring-1 ring-primary/10' : 'text-muted-foreground hover:text-foreground'}`}><Icon className="size-4" /></button>)}
          </div>
          {/* Grid-only: TaskGrid is the component that actually groups tasks
              into columns (the button labeled "Board" renders the Approvals
              queue instead). */}
          {view === 'grid' && (
            <div className="col-span-full flex h-10 items-center gap-1 rounded-xl border bg-muted/20 p-1 text-xs font-semibold sm:col-span-2 lg:col-span-1">
              <span className="px-2 text-muted-foreground">Group by</span>
              {(['status', 'priority'] as const).map((value) => (
                <button key={value} type="button" onClick={() => setGroupBy(value)} className={`h-8 rounded-lg px-3 capitalize transition ${groupBy === value ? 'bg-background text-primary shadow-sm ring-1 ring-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
                  {value}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Outside the task gate: the backlog has its own data and must not be
        hidden by "no tasks match the selected filters". */}
    {view === 'backlog' && (
      <div className="rounded-2xl border bg-card p-4">
        <BacklogBoard key={backlogAdd} projectId={null} onAssign={(item) => setPromoting(item)} />
      </div>
    )}

    {view !== 'backlog' && (loading ? <div className="flex h-72 items-center justify-center rounded-2xl border bg-card"><Spinner /></div> : !tasks.length ? <div className="flex h-72 items-center justify-center rounded-2xl border bg-card text-sm text-muted-foreground">No tasks match the selected filters.</div> : view === 'list' ? <TaskTable tasks={tasks} onSelect={(task) => setSelectedId(task.id)} onArchive={archive} selectedIds={selectedIds} onToggle={toggleSelected} onToggleAll={toggleAllSelected} /> : view === 'grid' ? <TaskGrid tasks={tasks} onSelect={(task) => setSelectedId(task.id)} groupBy={groupBy} priorityOptions={priorityOptions} /> : view === 'board' ? <TaskApprovals tasks={tasks} onSelect={(task) => setSelectedId(task.id)} onDecision={decide} /> : <TaskAnalytics tasks={tasks} />)}

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

    {/* ONE DRAWER, SHARED WITH MY TASKS. This used to be its own Sheet with a
        materially thinner feature set than my-task-details-drawer.tsx - the
        same task record had fewer capabilities (no instructions panel,
        documents, deadline extensions, repeat, reminder) depending which
        screen you opened it from. dashboardContext supplies the three things
        MyTask (what the shared drawer fetches) cannot carry on its own:
        the approval chain, and the approve/reject/archive actions that only
        make sense on this org-wide screen. */}
    <MyTaskDetailsDrawer
      taskId={selectedId}
      open={!!selectedId}
      onClose={() => setSelectedId(null)}
      onUpdated={() => setReload((current) => current + 1)}
      dashboardContext={selectedRow ? {
        approved: selectedRow.approved,
        onApprove: () => void decide(selectedRow, 'approve'),
        onReject: () => void decide(selectedRow, 'reject'),
        onArchive: () => void archive(selectedRow),
      } : undefined}
    />
    {/* Assigning a backlog item opens the same drawer that creates every other
        task, pre-filled — one task-creation path in the product. */}
    {promoting && (
      <CreateTaskModal
        key={`promote-${promoting.id}`}
        isOpen
        initialTitle={promoting.title}
        initialDescription={promoting.notes ?? ''}
        initialProjectId={promoting.project_id}
        initialWorkstreamId={promoting.workstream_id ?? undefined}
        onClose={() => setPromoting(null)}
        onCreated={(text) => { setMessage(text); setPromoting(null); setBacklogAdd((n) => n + 1) }}
        onCreatedTaskId={(taskId) => {
          void taskService.assignBacklogItem(getLaravelContext(), promoting.id, taskId).catch(() => {
            // The task exists regardless; only the link is lost, and the item
            // stays OPEN rather than claiming an assignment it cannot show.
          })
        }}
      />
    )}

    <CreateTaskModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={(value) => { setMessage(value); setReload((current) => current + 1) }} />
    <WorkspaceBulkActionBar
      count={selectedIds.size}
      busy={bulkBusy}
      people={assigneeOptions}
      allowReassign
      onReassign={(assigneeId) => void bulkReassign(assigneeId)}
      onDelete={() => void bulkDelete()}
      onClear={clearSelection}
    />
  </div>
}

function TaskTable({ tasks, onSelect, onArchive, selectedIds, onToggle, onToggleAll }: {
  tasks: WorkspaceTask[]
  onSelect: (task: WorkspaceTask) => void
  onArchive: (task: WorkspaceTask) => Promise<void>
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
}) {
  const allSelected = tasks.length > 0 && tasks.every((task) => selectedIds.has(task.id))
  return <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-primary/[0.045]"><tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><th className="w-10 px-4 py-4"><input type="checkbox" checked={allSelected} onChange={(event) => onToggleAll(event.target.checked)} aria-label="Select all tasks on this page" /></th><th className="px-6 py-4">Task Name</th><th className="px-5 py-4">Project</th><th className="px-5 py-4">Assignee</th><th className="px-5 py-4">Priority</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Due Date</th><th className="px-6 py-4 text-right">Quick Actions</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} className={`border-b last:border-0 hover:bg-muted/30 ${selectedIds.has(task.id) ? 'bg-primary/5' : ''}`}><td className="px-4 py-4"><input type="checkbox" checked={selectedIds.has(task.id)} onChange={() => onToggle(task.id)} aria-label={`Select ${task.title}`} /></td><td className="px-6 py-4"><button onClick={() => onSelect(task)} className="max-w-72 text-left"><p className="font-semibold">{task.title}</p><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{task.description}</p></button></td><td className="px-5 py-4">{task.project}</td><td className="px-5 py-4">{task.assignee}</td><td className="px-5 py-4"><PriorityBadge priority={task.priority} /></td><td className="px-5 py-4"><StatusBadge status={task.status} label={statusText(task)} /></td><td className="whitespace-nowrap px-5 py-4">{formatDueDate(task.due_date)}</td><td className="px-6 py-4"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="View task" onClick={() => onSelect(task)}><Eye className="size-4" /></Button><Button variant="ghost" size="icon" title="Archive task" onClick={() => void onArchive(task)}><Archive className="size-4 text-destructive" /></Button></div></td></tr>)}</tbody></table></div></div>
}

/** HEX equivalents of this grid's own status dots, so both grouping modes render through one inline-style path. */
const STATUS_DOT_COLORS: Record<string, string> = {
  todo: '#64748b', progress: '#2563eb', review: '#f59e0b', blocked: '#f43f5e', done: '#10b981',
}
/** A custom priority with no color set yet, and the catch-all "no priority" bucket, both read as this rather than no dot at all. */
const NEUTRAL_DOT_COLOR = '#94a3b8'

function TaskGrid({ tasks, onSelect, groupBy, priorityOptions }: {
  tasks: WorkspaceTask[]
  onSelect: (task: WorkspaceTask) => void
  groupBy: 'status' | 'priority'
  priorityOptions: TaskPriorityOption[]
}) {
  const statusColumns = [
    { id: 'todo', label: 'To Do', color: STATUS_DOT_COLORS.todo, tasks: tasks.filter((task) => task.status === 'PENDING') },
    { id: 'progress', label: 'In Progress', color: STATUS_DOT_COLORS.progress, tasks: tasks.filter((task) => task.status === 'IN-PROGRESS') },
    { id: 'review', label: 'Review', color: STATUS_DOT_COLORS.review, tasks: tasks.filter((task) => task.status === 'COMPLETED' && !task.approved) },
    { id: 'blocked', label: 'Blocked', color: STATUS_DOT_COLORS.blocked, tasks: tasks.filter((task) => task.status === 'ON HOLD') },
    { id: 'done', label: 'Done', color: STATUS_DOT_COLORS.done, tasks: tasks.filter((task) => task.status === 'COMPLETED' && task.approved) },
  ]

  // Ordered by the tenant's own sort_order, active levels only - the same
  // vocabulary the priority picker offers, so a column exists for every
  // priority a task could actually carry. A trailing catch-all holds tasks
  // whose priority is null or names a level this grid doesn't know about
  // (e.g. a now-deactivated custom level), so nothing silently disappears.
  const knownNames = new Set(priorityOptions.map((option) => option.name))
  const priorityColumns = [
    ...priorityOptions
      .filter((option) => option.active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((option) => ({
        id: option.id ?? option.name,
        label: option.name,
        color: option.color ?? NEUTRAL_DOT_COLOR,
        tasks: tasks.filter((task) => task.priority === option.name),
      })),
    {
      id: 'unspecified',
      label: 'No Priority',
      color: NEUTRAL_DOT_COLOR,
      tasks: tasks.filter((task) => !task.priority || !knownNames.has(task.priority)),
    },
  ]

  const columns = groupBy === 'priority' ? priorityColumns : statusColumns

  return <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-card shadow-sm">
    <div className="grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))`, minWidth: columns.length * 220 }}>
      {columns.map((column) => <section key={column.id} className="min-h-[320px] border-r border-border/60 p-3 last:border-r-0">
        <header className="mb-3 flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2"><span className="size-1.5 rounded-full" style={{ background: column.color }} /><h3 className="text-xs font-semibold uppercase tracking-[0.08em]">{column.label}</h3></div>
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
  /*
   * FILTERED ON THE DECISION, NOT ON A PROXY FOR IT.
   *
   * `rejected` was `status === 'ON HOLD'`. That was wrong in two directions:
   * both databases hold ZERO tasks in ON HOLD so the tab was permanently empty,
   * and ON HOLD is separately counted as "Blocked / Overdue" in the summary, so
   * a rejected task would have double-counted against itself.
   *
   * approve_status says what was actually decided, so each tab now asks its own
   * question instead of inferring one from the workflow state.
   */
  const groups = {
    pending: tasks.filter((task) => task.status === 'COMPLETED' && task.approve_status !== 'approved' && task.approve_status !== 'rejected'),
    approved: tasks.filter((task) => task.approve_status === 'approved'),
    rejected: tasks.filter((task) => task.approve_status === 'rejected'),
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
      <span className={`absolute inset-y-0 left-0 w-1.5 ${task.approve_status === 'rejected' ? 'bg-destructive/50' : 'bg-primary/35'}`} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <button onClick={() => onSelect(task)} className="flex min-w-0 items-center gap-4 text-left">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 text-xs font-bold text-primary">{task.assignee.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
          <span className="min-w-0"><span className="flex flex-wrap items-center gap-3"><strong className="truncate text-base">{task.title}</strong><span className="rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">TSK-{task.id}</span></span><span className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground"><span className="text-primary">●</span><span>{task.project}</span><span className="flex items-center gap-1"><CalendarDays className="size-3.5" />Submitted {formatShortDate(task.updated_at?.slice(0, 10) ?? task.due_date)}</span>{task.approval?.pending && (
            <span className="rounded-lg bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Awaiting {task.approval.step_name || task.approval.approver_role || 'approval'}
              {task.approval.of ? ` (step ${task.approval.step} of ${task.approval.of})` : ''}
            </span>
          )}</span>{task.approve_status === 'rejected' && (
            /* THE REASON, ON THE CARD. Capturing it at rejection is only half
               the job — an approver reviewing the rework queue needs to see why
               it was sent back without opening each one. Rejections recorded
               before the reason was captured have none, and say so rather than
               showing an empty quote. */
            <span className="mt-2 block rounded-lg border-l-2 border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs text-muted-foreground">
              {task.approve_remarks
                ? <><span className="font-semibold text-destructive">Sent back:</span> {task.approve_remarks}</>
                : <span className="italic">Sent back before a reason was recorded.</span>}
            </span>
          )}</span>
        </button>
        {tab === 'pending' && <div className="flex shrink-0 gap-3"><Button variant="outline" className="min-w-28 rounded-xl" onClick={() => void onDecision(task, 'reject')}><XCircle className="mr-2 size-4" />Reject</Button><Button className="min-w-32 rounded-xl shadow-md" onClick={() => void onDecision(task, 'approve')}><CheckCircle2 className="mr-2 size-4" />Approve</Button></div>}
        {tab !== 'pending' && <StatusBadge status={tab === 'approved' ? 'Completed' : 'On Hold'} label={tab === 'approved' ? 'Approved' : 'Rework'} />}
      </div>
    </article>) : <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">No {tab === 'pending' ? 'pending reviews' : tab} tasks.</div>}</div>
  </section>
}

function TaskAnalytics({ tasks }: { tasks: WorkspaceTask[] }) {
  const statuses = Object.keys(statusLabels) as TaskStatus[]
  return <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Status Distribution</CardTitle></CardHeader><CardContent className="space-y-4">{statuses.map((status) => { const count = tasks.filter((task) => task.status === status).length; return <div key={status}><div className="mb-1 flex items-center justify-between text-sm"><StatusBadge status={status} label={statusLabels[status]} /><span>{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${tasks.length ? count * 100 / tasks.length : 0}%` }} /></div></div> })}</CardContent></Card><Card><CardHeader><CardTitle>Priority Distribution</CardTitle></CardHeader><CardContent className="space-y-4">{['High','Medium','Low'].map((priority) => { const count = tasks.filter((task) => task.priority === priority).length; return <div key={priority} className="flex items-center justify-between rounded-xl border p-3"><PriorityBadge priority={priority} /><span className="text-xl font-bold">{count}</span></div> })}</CardContent></Card></div>
    <TeamWorkloadPanel />
  </div>
}

/**
 * Per-assignee active/overdue counts, from the real getWorkspaceWorkload
 * endpoint - already functional, zero backend changes needed, just never
 * called. Replaces the capability the old task-workload-view.tsx used to
 * provide (deleted as dead code: wrong generic Task[] type, and a
 * hardcoded maxCapacity = 5 guess with no server-side backing).
 *
 * The bar's scale is relative to the busiest person ON THIS TEAM, derived
 * from the response itself - not an invented capacity constant. The
 * endpoint returns no capacity figure at all, so none is shown.
 */
function TeamWorkloadPanel() {
  const [workload, setWorkload] = useState<Array<{ id: string; name: string; active_tasks: number; overdue_tasks: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => {
      if (!active) return
      taskService.getWorkspaceWorkload(getLaravelContext())
        .then((response) => { if (active) setWorkload(response.data) })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load team workload.') })
        .finally(() => { if (active) setLoading(false) })
    })
    return () => { active = false }
  }, [])

  const maxActive = Math.max(1, ...workload.map((person) => person.active_tasks))
  const sorted = [...workload].sort((a, b) => b.active_tasks - a.active_tasks)

  return <Card>
    <CardHeader><CardTitle>Team Workload</CardTitle></CardHeader>
    <CardContent>
      {loading ? <div className="flex h-24 items-center justify-center"><Spinner /></div>
        : error ? <p className="text-sm text-destructive">{error}</p>
        : !sorted.length ? <p className="text-sm text-muted-foreground">No active assignments to show.</p>
        : <div className="space-y-4">{sorted.map((person) => (
          <div key={person.id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">{person.name}</span>
              <span className="text-muted-foreground">
                {person.active_tasks} active
                {person.overdue_tasks > 0 && <span className="ml-2 font-semibold text-destructive">{person.overdue_tasks} overdue</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(person.active_tasks / maxActive) * 100}%` }} />
            </div>
          </div>
        ))}</div>}
    </CardContent>
  </Card>
}

function formatDueDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : '—'
}

function formatShortDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'
}
