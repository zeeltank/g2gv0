'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Briefcase, Calendar, CheckCircle2, MoreVertical, Plus, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { ProjectOptions, ProjectRecord, ProjectStatus } from '@/types/task-management'
import { CreateProjectModal } from './create-project-modal'
import { ProjectDetailView } from './project-detail-view'
import { projectStatusVariant } from './workstream-health'

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

  /*
   * A PAGE, NOT A DRAWER.
   *
   * `ProjectDrawer` used to render here as a 672px Sheet over a dimmed backdrop,
   * which is a poor home for tabs, tables, a lifecycle diagram and a Gantt — and
   * it discarded most of the 26 fields the API returns per project.
   *
   * Swapping the whole view is the pattern `TalentProfileView` already uses
   * (recruitment-center.tsx does the same early return). It needs no menu row
   * and no new permissions. The cost is that selection lives in memory, so a
   * refresh returns to the list — the same limitation that screen has.
   */
  if (selectedId) {
    return (
      <ProjectDetailView
        projectId={selectedId}
        onBack={() => { setSelectedId(null); setReload((v) => v + 1) }}
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-start justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight text-foreground">Projects & Workstreams</h1><p className="mt-1 text-sm text-muted-foreground">Plan initiatives, teams, linked tasks, and delivery workstreams.</p></div>
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
      {!loading && pagination.total > 0 && <div className="flex items-center justify-between border-t pt-3 text-sm"><span className="text-muted-foreground"><span className="tabular-nums font-medium text-foreground">{pagination.total}</span> projects</span><div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>Previous</Button><span className="tabular-nums text-muted-foreground">Page {pagination.current_page} of {pagination.last_page}</span><Button variant="outline" size="sm" disabled={page >= pagination.last_page} onClick={() => setPage((v) => v + 1)}>Next</Button></div></div>}
      {/* `editing` is cleared on close so a re-edit cannot reseed the form from
          a stale record, and the list refresh is deferred to the next frame so
          it does not unmount every card - and every DropdownMenu inside them -
          while the dialog is still animating out. Both were making the
          pointer-events race above more likely to land badly. */}
      <CreateProjectModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        options={options}
        project={editing}
        onSaved={(text) => { setMessage(text); requestAnimationFrame(() => setReload((v) => v + 1)) }}
      />
    </div>
  )
}

function ProjectCard({ project, onOpen, onEdit, onArchive }: { project: ProjectRecord; onOpen: () => void; onEdit: () => void; onArchive: () => void }) {
  return <Card className="cursor-pointer transition hover:border-primary/40 hover:shadow-md" onClick={onOpen}><CardContent className="p-5">
    <div className="flex items-start justify-between"><div className="flex gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Briefcase className="size-5" /></div><div><h3 className="truncate text-base font-semibold tracking-tight text-foreground">{project.name}</h3><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{project.code}</p></div></div>
      {/* modal={false} IS THE FIX FOR THE FROZEN SCREEN, and it is not cosmetic.
          A modal Radix menu and a modal Radix dialog both register into
          dismissable-layer's MODULE-LEVEL `originalBodyPointerEvents`. Opening
          the edit dialog from this menu overlaps their teardowns, and whichever
          unmounts last writes the captured value back onto <body> - which can
          be "none". The page then looks normal and swallows every click.

          Creating a project never hits this because it opens from a plain
          button with no second layer. recruitment-center.tsx and
          talent-dashboard.tsx already carry this same fix; this file was the
          outlier. */}
      <DropdownMenu modal={false}><DropdownMenuTrigger onClick={(e) => e.stopPropagation()} className="rounded-lg p-2 hover:bg-muted"><MoreVertical className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit() }}>Edit Project</DropdownMenuItem><DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen() }}>Manage Team & Workstreams</DropdownMenuItem><DropdownMenuItem className="text-danger" onClick={(e) => { e.stopPropagation(); onArchive() }}>Archive</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </div>
    <p className="my-4 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
    <div className="grid grid-cols-2 gap-3 text-sm"><span className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" />{date(project.due_date)}</span><span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-muted-foreground" /><span className="tabular-nums">{project.tasks_completed}/{project.tasks_total}</span>&nbsp;tasks</span><span className="flex items-center gap-2"><Users className="size-4 text-muted-foreground" /><span className="tabular-nums">{project.members_count}</span>&nbsp;members</span><Status status={project.status} /></div>
    <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span className="font-medium text-muted-foreground">Progress</span><b className="tabular-nums text-foreground">{project.progress}%</b></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${project.progress}%` }} /></div></div>
  </CardContent></Card>
}

/*
 * ProjectDrawer REMOVED 2026-09-01 — replaced by ProjectDetailView.
 *
 * It was a 672px Sheet whose entire header was the project name and code, and
 * whose four tabs showed a fraction of the 26 fields the API returns. Its Tasks
 * tab also stapled a 200-row list of EVERY recent task in the organisation under
 * the project's own tasks, and saved through an endpoint that replaced the
 * project's whole task list with whatever the browser happened to be holding.
 *
 * Checklist/Info/Notice/date went with it — they existed only to serve it.
 * `Status` survives below because ProjectCard still uses it.
 */
// `variant` is passed explicitly: statusVariantMap has 'In Progress' and
// 'IN-PROGRESS' but NOT the space-and-caps 'IN PROGRESS' that ProjectStatus
// actually uses, so that one status rendered neutral while the other four
// coloured. components/ui is shared and not edited from here.
function Status({ status }: { status: ProjectStatus }) { return <StatusBadge status={status} variant={projectStatusVariant(status)}>{status}</StatusBadge> }
function date(value: string | null) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }
