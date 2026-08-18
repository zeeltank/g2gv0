'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Briefcase, Calendar, CheckCircle2, MoreVertical, Plus, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { taskService } from '@/services/task'
import type { ProjectOptions, ProjectRecord, ProjectStatus, Workstream } from '@/types/task-management'
import { CreateProjectModal } from './create-project-modal'
import { PriorityBadge } from './priority-badge'

const EMPTY_OPTIONS: ProjectOptions = { users: [], departments: [], tasks: [], categories: [], statuses: [], priorities: [] }

export function ProjectsListView() {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [options, setOptions] = useState<ProjectOptions>(EMPTY_OPTIONS)
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectRecord | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => { const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 300); return () => clearTimeout(timer) }, [searchInput])

  const load = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const [records, lookup] = await Promise.all([
        taskService.getProjectRecords(context, { search: search || undefined, status: status === 'all' ? undefined : status, page }),
        taskService.getProjectOptions(context),
      ])
      setProjects(records.data.projects); setPagination(records.data.pagination); setOptions(lookup.data)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load projects.') }
    finally { setLoading(false) }
  }, [page, search, status])
  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load, reload])

  async function archive(project: ProjectRecord) {
    if (!window.confirm(`Archive ${project.name}? Existing tasks will not be deleted.`)) return
    try { const response = await taskService.archiveProjectRecord(getLaravelContext(), project.id); setMessage(response.message); setReload((v) => v + 1) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to archive project.') }
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-start justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight">Projects & Workstreams</h1><p className="mt-1 text-sm text-muted-foreground">Plan initiatives, teams, linked tasks, and delivery workstreams.</p></div>
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="mr-2 size-4" />New Project</Button>
      </div>
      {message && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}
      <div className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-primary/10 bg-card p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search project, code, or manager..." className="h-11 w-full rounded-xl border border-input bg-muted/20 pl-10 pr-4 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10" /></div>
        <div className="w-full"><Select value={status} onChange={(value) => { setStatus(value as ProjectStatus | 'all'); setPage(1) }} options={[{ value: 'all', label: 'All Projects' }, ...options.statuses.filter((v) => v !== 'ARCHIVED').map((value) => ({ value, label: value }))]} className="h-11 rounded-xl" /></div>
      </div>
      {loading ? <div className="flex h-64 items-center justify-center"><Spinner /></div> : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-danger/20"><AlertCircle className="size-8 text-danger" /><p>{error}</p><Button variant="outline" onClick={() => setReload((v) => v + 1)}>Try again</Button></div>
      ) : (
        <div className="grid grid-cols-1 gap-5 overflow-y-auto pb-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => setSelectedId(project.id)} onEdit={() => { setEditing(project); setFormOpen(true) }} onArchive={() => void archive(project)} />)}
          {!projects.length && <div className="col-span-full flex h-64 flex-col items-center justify-center text-muted-foreground"><Briefcase className="mb-3 size-10 opacity-40" />No projects match the selected filters.</div>}
        </div>
      )}
      {!loading && pagination.total > 0 && <div className="flex items-center justify-between border-t pt-3 text-sm"><span>{pagination.total} projects</span><div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>Previous</Button><span>Page {pagination.current_page} of {pagination.last_page}</span><Button variant="outline" size="sm" disabled={page >= pagination.last_page} onClick={() => setPage((v) => v + 1)}>Next</Button></div></div>}
      <CreateProjectModal isOpen={formOpen} onClose={() => setFormOpen(false)} options={options} project={editing} onSaved={(text) => { setMessage(text); setReload((v) => v + 1) }} />
      <ProjectDrawer projectId={selectedId} open={selectedId !== null} options={options} onClose={() => setSelectedId(null)} onChanged={() => setReload((v) => v + 1)} />
    </div>
  )
}

function ProjectCard({ project, onOpen, onEdit, onArchive }: { project: ProjectRecord; onOpen: () => void; onEdit: () => void; onArchive: () => void }) {
  return <Card className="cursor-pointer transition hover:border-primary/40 hover:shadow-md" onClick={onOpen}><CardContent className="p-5">
    <div className="flex items-start justify-between"><div className="flex gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Briefcase className="size-5" /></div><div><h3 className="font-semibold">{project.name}</h3><p className="text-xs text-muted-foreground">{project.code}</p></div></div>
      <DropdownMenu><DropdownMenuTrigger onClick={(e) => e.stopPropagation()} className="rounded-lg p-2 hover:bg-muted"><MoreVertical className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit() }}>Edit Project</DropdownMenuItem><DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen() }}>Manage Team & Workstreams</DropdownMenuItem><DropdownMenuItem className="text-danger" onClick={(e) => { e.stopPropagation(); onArchive() }}>Archive</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </div>
    <p className="my-4 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
    <div className="grid grid-cols-2 gap-3 text-sm"><span className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" />{date(project.due_date)}</span><span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-muted-foreground" />{project.tasks_completed}/{project.tasks_total} tasks</span><span className="flex items-center gap-2"><Users className="size-4 text-muted-foreground" />{project.members_count} members</span><Status status={project.status} /></div>
    <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span>Progress</span><b>{project.progress}%</b></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${project.progress}%` }} /></div></div>
  </CardContent></Card>
}

function ProjectDrawer({ projectId, open, options, onClose, onChanged }: { projectId: string | null; open: boolean; options: ProjectOptions; onClose: () => void; onChanged: () => void }) {
  const [project, setProject] = useState<ProjectRecord | null>(null)
  const [tab, setTab] = useState<'overview' | 'team' | 'workstreams' | 'tasks'>('overview')
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('')
  const [members, setMembers] = useState<string[]>([]); const [taskIds, setTaskIds] = useState<string[]>([])
  const [wsName, setWsName] = useState(''); const [wsOwner, setWsOwner] = useState(''); const [wsStatus, setWsStatus] = useState<ProjectStatus>('PLANNING')
  const [editingWorkstream, setEditingWorkstream] = useState<Workstream | null>(null)
  const load = useCallback(async () => { if (!open || !projectId) return; setLoading(true); setError(''); try { const response = await taskService.getProjectRecord(getLaravelContext(), projectId); setProject(response.data); setMembers(response.data.members?.map((m) => String(m.id)) ?? []); setTaskIds(response.data.task_ids ?? []) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load project.') } finally { setLoading(false) } }, [open, projectId])
  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])
  // A selected owner who is no longer a member is invalid the moment the
  // member list changes - cleared during render rather than one frame later.
  if (wsOwner && !project?.members?.some((member) => String(member.id) === wsOwner)) {
    setWsOwner('')
  }
  async function saveMembers() { if (!project) return; try { const r = await taskService.syncProjectMembers(getLaravelContext(), project.id, members); setMessage(r.message); await load(); onChanged() } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update team.') } }
  async function saveTasks() { if (!project) return; try { const r = await taskService.syncProjectTasks(getLaravelContext(), project.id, taskIds); setMessage(r.message); await load(); onChanged() } catch (e) { setError(e instanceof Error ? e.message : 'Unable to link tasks.') } }
  async function saveWorkstream() { if (!project || !wsName.trim()) return; try { const payload = { name: wsName.trim(), description: editingWorkstream?.description ?? null, owner_id: wsOwner || null, owner_name: null, status: wsStatus, start_date: editingWorkstream?.start_date ?? project.start_date, due_date: editingWorkstream?.due_date ?? project.due_date, sort_order: editingWorkstream?.sort_order ?? project.workstreams?.length ?? 0 }; const r = editingWorkstream ? await taskService.updateWorkstream(getLaravelContext(), project.id, String(editingWorkstream.id), payload) : await taskService.createWorkstream(getLaravelContext(), project.id, payload); setMessage(r.message); setWsName(''); setWsOwner(''); setWsStatus('PLANNING'); setEditingWorkstream(null); await load(); onChanged() } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save workstream.') } }
  async function removeWorkstream(item: Workstream) { if (!project || !confirm(`Delete workstream ${item.name}?`)) return; try { const r = await taskService.deleteWorkstream(getLaravelContext(), project.id, String(item.id)); setMessage(r.message); await load(); onChanged() } catch (e) { setError(e instanceof Error ? e.message : 'Unable to delete workstream.') } }
  return <Sheet open={open} onOpenChange={(next) => !next && onClose()}><SheetContent className="w-full overflow-y-auto sm:max-w-2xl"><SheetHeader><SheetTitle>{project?.name ?? 'Project'}</SheetTitle><SheetDescription>{project?.code ?? 'Loading project details…'}</SheetDescription></SheetHeader>
    {loading ? <div className="flex h-48 items-center justify-center"><Spinner /></div> : <div className="mt-5 space-y-5">{error && <Notice danger>{error}</Notice>}{message && <Notice>{message}</Notice>}
      <div className="flex gap-1 overflow-x-auto border-b">{(['overview','team','workstreams','tasks'] as const).map((value) => <Button key={value} variant="ghost" onClick={() => setTab(value)} className={cn('rounded-none border-b-2 capitalize', tab === value ? 'border-primary text-primary' : 'border-transparent')}>{value}</Button>)}</div>
      {project && tab === 'overview' && <div className="space-y-4"><p className="rounded-xl bg-muted/30 p-4 text-sm">{project.description}</p><div className="grid grid-cols-2 gap-3 text-sm"><Info label="Manager" value={project.manager ?? '—'} /><Info label="Sponsor" value={project.sponsor ?? '—'} /><Info label="Department" value={project.department ?? '—'} /><Info label="Timeline" value={`${date(project.start_date)} – ${date(project.due_date)}`} /><Info label="Priority" value={<PriorityBadge priority={project.priority} />} /><Info label="Status" value={<StatusBadge status={project.status} />} /><Info label="Client" value={project.client_name ?? '—'} /><Info label="Budget" value={project.budget_estimate ? Number(project.budget_estimate).toLocaleString() : '—'} /></div></div>}
      {project && tab === 'team' && <div><h3 className="mb-3 font-semibold">Project members</h3><Checklist items={options.users.map((u) => ({ id: String(u.id), label: u.name }))} selected={members} setSelected={setMembers} /><Button className="mt-4" onClick={saveMembers}>Save Team</Button></div>}
      {project && tab === 'tasks' && (() => {
        const departmentTasks = project.department_id
          ? options.tasks.filter((task) => String(task.department_id ?? '') === String(project.department_id))
          : []
        return <div><h3 className="mb-1 font-semibold">Linked tasks</h3><p className="mb-3 text-xs text-muted-foreground">{project.department ? `Showing tasks for ${project.department}` : 'This project has no department assigned.'}</p>
          {departmentTasks.length ? <><Checklist items={departmentTasks.map((task) => ({ id: String(task.id), label: `${task.title} (${task.status ?? 'Pending'})` }))} selected={taskIds.filter((id) => departmentTasks.some((task) => String(task.id) === id))} setSelected={(next) => setTaskIds([...taskIds.filter((id) => !departmentTasks.some((task) => String(task.id) === id)), ...next])} /><Button className="mt-4" onClick={saveTasks}>Save Linked Tasks</Button></> : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No tasks available for the selected department.</div>}
        </div>
      })()}
      {project && tab === 'workstreams' && <div className="space-y-4"><div className="grid gap-2 sm:grid-cols-3"><input value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="Workstream name" className="h-10 rounded-lg border px-3 text-sm" /><Select value={wsOwner} onChange={setWsOwner} options={(project.members ?? []).map((member) => ({ value: String(member.id), label: member.name }))} placeholder={project.members?.length ? 'Owner' : 'No team members available'} disabled={!project.members?.length} /><Select value={wsStatus} onChange={(v) => setWsStatus(v as ProjectStatus)} options={options.statuses.filter((s) => s !== 'ARCHIVED').map((s) => ({ value: s, label: s }))} /></div>{!project.members?.length && <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">No team members available. Please add team members first.</p>}<div className="flex gap-2"><Button onClick={saveWorkstream} disabled={!wsName.trim()}>{editingWorkstream ? 'Save Workstream' : 'Add Workstream'}</Button>{editingWorkstream && <Button variant="outline" onClick={() => { setEditingWorkstream(null); setWsName(''); setWsOwner(''); setWsStatus('PLANNING') }}>Cancel</Button>}</div><div className="space-y-2">{project.workstreams?.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border p-4"><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.owner_name || 'No owner'} · {item.status}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setEditingWorkstream(item); setWsName(item.name); setWsOwner(item.owner_id && project.members?.some((member) => String(member.id) === String(item.owner_id)) ? String(item.owner_id) : ''); setWsStatus(item.status) }}>Edit</Button><Button variant="outline" size="sm" onClick={() => removeWorkstream(item)}>Delete</Button></div></div>)}{!project.workstreams?.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No workstreams yet.</p>}</div></div>}
    </div>}</SheetContent></Sheet>
}

function Checklist({ items, selected, setSelected }: { items: Array<{ id: string; label: string }>; selected: string[]; setSelected: (ids: string[]) => void }) { return <div className="grid max-h-72 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">{items.map((item) => <label key={item.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} />{item.label}</label>)}</div> }
function Info({ label, value }: { label: string; value: React.ReactNode }) { return <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{label}</p><div className="mt-1 font-medium">{value}</div></div> }
function Notice({ danger, children }: { danger?: boolean; children: React.ReactNode }) { return <div className={cn('rounded-lg border p-3 text-sm', danger ? 'border-danger/30 bg-danger/5 text-danger' : 'border-success/30 bg-success/5 text-success')}>{children}</div> }
function Status({ status }: { status: ProjectStatus }) { return <StatusBadge status={status} /> }
function date(value: string | null) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }
