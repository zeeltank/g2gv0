'use client'

/**
 * The project, as a page rather than a 672px drawer.
 *
 * ── WHAT THE DRAWER COULD NOT SHOW ──────────────────────────────────────────
 *
 * The old `ProjectDrawer` was a right-hand Sheet capped at `sm:max-w-2xl` whose
 * entire header was the project name and code. The API had been returning 26
 * fields per project the whole time — progress, task counts, member count,
 * category, team size, regulatory flags, and `departments[]` with the primary
 * marked — and the drawer rendered a handful of them.
 *
 * Multi-department projects in particular rendered as single-department, because
 * the drawer read the scalar `department` and ignored the list beside it.
 *
 * ── NAVIGATION IS IN-MEMORY, AND THAT IS A KNOWN LIMIT ──────────────────────
 *
 * This module has no file routes — every screen is a component swapped inside
 * the shell by the content map — so a project has no URL and a refresh returns
 * to the list. That is the same limitation `TalentProfileView` has. Stated here
 * rather than discovered later.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Info, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip } from '@/components/ui/tooltip'
import { GtgBreadcrumb } from '@/components/shell/gtg-breadcrumb'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import { cn } from '@/lib/utils'
import { WorkstreamDialog } from './workstream-form'
import { ProjectCommandBar } from './project-command-bar'
import { BacklogBoard } from './backlog-board'
import { CreateTaskModal } from './create-task-modal'
import { MyTaskDetailsDrawer } from './my-task-details-drawer'
import { WorkstreamSchedule } from './workstream-schedule'
import { WorkstreamListPane } from './workstream-list-pane'
import { WorkstreamStage } from './workstream-stage'
import type {
  BacklogItem, LinkableTask, ProjectRecord, ScheduleItem, WorkstreamLink, WorkstreamOptions, WorkstreamSummary,
} from '@/types/task-management'
import type { WorkstreamPayload } from '@/services/task'

// Overview removed 2026-09-01 at the customer's request: it duplicated the
// Workstreams tab, which already carries the lifecycle diagram at full size and
// the same health cards. Workstreams is the default.
type Tab = 'workstreams' | 'team' | 'tasks' | 'timeline' | 'backlog'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'workstreams', label: 'Workstreams' },
  { id: 'team', label: 'Team' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'backlog', label: 'Backlog' },
]

export function ProjectDetailView({
  projectId, onBack,
}: {
  projectId: string
  onBack: () => void
}) {
  const [project, setProject] = useState<ProjectRecord | null>(null)
  const [workstreams, setWorkstreams] = useState<WorkstreamSummary[]>([])
  const [links, setLinks] = useState<WorkstreamLink[]>([])
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [tab, setTab] = useState<Tab>('workstreams')
  const [selectedWorkstream, setSelectedWorkstream] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [taskMessage, setTaskMessage] = useState('')
  const [wsDialog, setWsDialog] = useState<{ open: boolean; initial: WorkstreamSummary | null }>({ open: false, initial: null })
  const [wsSaving, setWsSaving] = useState(false)
  const [wsError, setWsError] = useState('')
  const [wsMessage, setWsMessage] = useState('')
  const [linkError, setLinkError] = useState('')
  const [options, setOptions] = useState<WorkstreamOptions | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [taskSearch, setTaskSearch] = useState('')
  const [taskStatus, setTaskStatus] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [backlogOpen, setBacklogOpen] = useState(0)
  const [assignSeed, setAssignSeed] = useState<BacklogItem | null>(null)

  /*
   * The list is the other way out of a workstream with unsaved edits, so it
   * asks the same question the stage does. `paneDirty` is owned by the stage
   * (it is what renders the editors); this ref mirrors it so the list can
   * consult it without the two components having to share state.
   */
  const paneDirty = useRef(false)
  const selectWorkstream = (id: string | null) => {
    if (paneDirty.current && !window.confirm(
      'This workstream has unsaved changes. Leave without saving them?'
    )) return
    paneDirty.current = false
    setSelectedWorkstream(id)
  }

  const load = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      // Two requests, not more: the workstream call already carries health,
      // links and the roll-up, so the diagram, the cards and the stat strip
      // cannot disagree with each other.
      const [record, ws, opts] = await Promise.all([
        taskService.getProjectRecord(context, projectId),
        taskService.getProjectWorkstreams(context, projectId),
        taskService.getWorkstreamOptions(context),
      ])
      setProject(record.data)
      setWorkstreams(ws.data.workstreams)
      setLinks(ws.data.links)
      setSchedule(ws.data.schedule ?? [])
      setOptions(opts.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load this project.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  const projectMembers = useMemo(
    () => (project?.members ?? []).map((m) => ({ id: String(m.id), name: m.name })),
    [project?.members],
  )

  /*
   * ONE TASK AT A TIME, NEVER THE WHOLE LIST.
   *
   * The drawer saved through an endpoint whose first act was deleting every link
   * for the project and reinserting whatever the browser was holding — so a
   * stale tab silently unlinked other people's work. attachTask and detachTask
   * touch exactly one row each. Both already existed and had never been called.
   */
  const placeTask = async (taskId: string, workstreamId: string) => {
    try {
      await taskService.attachTaskToProject(getLaravelContext(), projectId, taskId, workstreamId || undefined)
      setTaskMessage('Task moved.')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to move that task.')
    }
  }

  const unlinkTask = async (taskId: string, title: string) => {
    if (!window.confirm(`Unlink "${title}" from this project? The task itself is not deleted.`)) return
    try {
      await taskService.detachTaskFromProject(getLaravelContext(), projectId, taskId)
      setTaskMessage('Task unlinked.')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to unlink that task.')
    }
  }

  /* ── authoring the lifecycle ──────────────────────────────────────
     Create, edit and delete workstreams, and connect them. Every one of
     these service methods had zero callers until now: the old drawer held
     the only workstream form and it was removed with the drawer. */

  const saveWorkstream = async (payload: WorkstreamPayload) => {
    const context = getLaravelContext()
    const editing = wsDialog.initial
    setWsSaving(true)
    setWsError('')
    try {
      const response = editing
        ? await taskService.updateProjectWorkstream(context, projectId, editing.id, payload)
        : await taskService.createProjectWorkstream(context, projectId, payload)
      setWsMessage(response.message)
      setWsDialog({ open: false, initial: null })
      await load()
    } catch (reason) {
      // Inside the dialog — the server's message is the useful one here
      // ("Another workstream in this project already uses the code…").
      setWsError(reason instanceof Error ? reason.message : 'Unable to save that workstream.')
    } finally {
      setWsSaving(false)
    }
  }

  /**
   * Delete, naming what goes with it.
   *
   * A sub-workstream blocks the delete outright (the API refuses with 422 and
   * says why). Everything else — deliverables, KPIs, risks, checkpoints,
   * contributors — cascades, so the confirm counts them rather than asking a
   * bare "are you sure?" about work somebody planned.
   */
  const removeWorkstream = async (ws: WorkstreamSummary) => {
    const carries = [
      [ws.health.deliverables.total, 'deliverable'],
      [ws.health.kpis.total, 'success metric'],
      [ws.health.risks.open + ws.health.risks.closed, 'risk'],
      [ws.health.milestones.total, 'checkpoint'],
    ] as Array<[number, string]>

    const losing = carries.filter(([n]) => n > 0)
      .map(([n, word]) => `${n} ${word}${n === 1 ? '' : 's'}`)
      .join(', ')

    const warning = losing
      ? `Delete "${ws.name}"? This also deletes ${losing}. Linked tasks stay, but lose their workstream.`
      : `Delete "${ws.name}"?`

    if (!window.confirm(warning)) return

    try {
      const response = await taskService.deleteProjectWorkstream(getLaravelContext(), projectId, ws.id)
      setWsMessage(response.message)
      // Back to the map BEFORE reloading — otherwise the stage refetches the
      // id we just deleted and shows a 404 where the workstream used to be.
      if (selectedWorkstream === ws.id) setSelectedWorkstream(null)
      await load()
    } catch (reason) {
      setWsError(reason instanceof Error ? reason.message : 'Unable to delete that workstream.')
    }
  }

  const addLink = async (payload: Parameters<typeof taskService.createWorkstreamLink>[2]) => {
    setWsSaving(true)
    setLinkError('')
    try {
      await taskService.createWorkstreamLink(getLaravelContext(), projectId, payload)
      await load()
    } catch (reason) {
      // The API's cycle message tells the user what to do instead — show it
      // verbatim rather than replacing it with a generic failure.
      setLinkError(reason instanceof Error ? reason.message : 'Unable to add that connection.')
    } finally {
      setWsSaving(false)
    }
  }

  const removeLink = async (linkId: string) => {
    setWsSaving(true)
    setLinkError('')
    try {
      await taskService.deleteWorkstreamLink(getLaravelContext(), linkId)
      await load()
    } catch (reason) {
      setLinkError(reason instanceof Error ? reason.message : 'Unable to remove that connection.')
    } finally {
      setWsSaving(false)
    }
  }

  /** Every open risk across the project's workstreams, worst first. */
  /** The vocabularies actually present on this project — not a global list,
   *  so a filter can never offer a value that matches nothing here. */
  const taskStatuses = useMemo(
    () => [...new Set((project?.tasks ?? []).map((t) => t.status).filter(Boolean))].sort() as string[],
    [project?.tasks],
  )
  const taskAssignees = useMemo(
    () => [...new Set((project?.tasks ?? []).map((t) => t.assignee).filter(Boolean))].sort() as string[],
    [project?.tasks],
  )

  const visibleTasks = useMemo(() => {
    const needle = taskSearch.trim().toLowerCase()
    return (project?.tasks ?? []).filter((t) =>
      (!needle || t.title.toLowerCase().includes(needle) || (t.assignee ?? '').toLowerCase().includes(needle))
      && (!taskStatus || t.status === taskStatus)
      && (!taskAssignee || t.assignee === taskAssignee))
  }, [project?.tasks, taskSearch, taskStatus, taskAssignee])

  const riskLoad = useMemo(() => {
    const regulated = workstreams.reduce((n, w) => n + w.health.risks.regulated_open, 0)
    const high = workstreams.reduce((n, w) => n + w.health.risks.severe_open, 0)
    const open = workstreams.reduce((n, w) => n + w.health.risks.open, 0)
    return { regulated, high, open }
  }, [workstreams])

  /**
   * The number on each tab.
   *
   * These are the same figures the stat strip used to spend four bordered
   * Cards on. On the tab they cost nothing and answer the question where it
   * is actually asked — "is there anything in Tasks?" — instead of at the top
   * of a page you have already scrolled past. Timeline has no count because a
   * date range is not a quantity.
   */
  const tabCounts = useMemo<Partial<Record<Tab, number>>>(() => ({
    workstreams: workstreams.length,
    team: project?.members?.length ?? 0,
    tasks: project?.tasks?.length ?? 0,
    backlog: backlogOpen,
  }), [workstreams.length, project?.members, project?.tasks, backlogOpen])

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 size-4" /> Back to projects</Button>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error || 'This project could not be loaded.'}
        </div>
      </div>
    )
  }

  return (
    /*
     * ── BOUNDED HEIGHT, AND WHY IT IS A PREREQUISITE ─────────────────────
     *
     * This root used to be `flex h-full flex-col overflow-y-auto`. It sits
     * inside the shell's `<div className="w-full min-h-full p-6">`, which is
     * an AUTO-height block — and `height:100%` against an auto-height parent
     * computes to `auto`. So that `overflow-y-auto` never scrolled anything;
     * `<main>` did. Which also means a `sticky` tab bar in here would have
     * stuck to the wrong scroller and silently done nothing.
     *
     * The height is derivable, not magic: the shell is `h-screen`, its header
     * is `h-12` (gtg-header-base.tsx:127) and the page box is `p-6`
     * (48px of vertical padding) — so 100vh - 3rem - 3rem = 6rem.
     * `min-h-[34rem]` lets a short window fall back to page scrolling rather
     * than crushing the panes.
     *
     * ── AND WHY CONTAINER QUERIES, NOT BREAKPOINTS ───────────────────────
     *
     * Viewport breakpoints lie in this shell. The nav is 260px when expanded
     * (gtg-app-shell.tsx:368-372) and the agent panel is a FLEX SIBLING of
     * <main> taking `var(--agent-panel-width)` = 30rem (gtg-app-shell.tsx:401).
     * At 1440 with both open there are 652px of content while `xl:` still
     * matches — a viewport-keyed three-column layout would render 3 columns
     * into 652px. Every width decision below is therefore keyed to
     * `@container/page`. Precedent: department-list.tsx:889.
     */
    <div className="@container/page flex h-[calc(100vh-6rem)] min-h-[34rem] flex-col gap-4">
      <GtgBreadcrumb items={[
        { label: 'Projects & Workstreams' },
        { label: project.name },
      ]} />

      {/* Identity, status and vitals in one band. This replaced a metadata
          slab and four stat Cards — five bordered surfaces and ~450px that
          held not one interactive control. Every field the slab showed is in
          the Details disclosure, reachable from every tab. */}
      <ProjectCommandBar
        project={project}
        workstreamCount={workstreams.length}
        riskLoad={riskLoad}
        onBack={onBack}
      />

      {/* ── tabs ────────────────────────────────────────────────────
          NOT sticky — the root is now a bounded flex column, so the bar is
          simply always on screen and the PANES scroll beneath it. Sticky
          would have been the wrong tool anyway: it would have anchored to
          <main>, which is the scroller this component never owned.

          Counts live here so the page no longer needs four stat tiles to say
          how many workstreams there are — the number is on the thing you
          click to go and see them.

          `aria-controls` + `role="tabpanel"` are wired; neither this module's
          old bar nor the shared `Tabs` in components/shared has them, so
          screen readers were announcing tabs that control nothing. */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b" role="tablist">
        {TABS.map((t) => {
          const count = tabCounts[t.id]
          const active = tab === t.id
          return (
            <Button key={t.id} variant="ghost" role="tab" id={`tab-${t.id}`}
              aria-selected={active} aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                'shrink-0 rounded-none border-b-2 text-sm',
                active
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent font-medium text-muted-foreground',
              )}>
              {t.label}
              {count !== undefined && (
                <span className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                  active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}>
                  {count}
                </span>
              )}
            </Button>
          )
        })}
      </div>


      {/* ── Workstreams: two panes, never three ──────────────────────
          The list on the left is the only list of workstreams; the stage on
          the right shows EITHER the lifecycle map or the selected workstream.
          That is what replaced four stacked blocks — a heading row, a
          ~550px diagram card, a grid of tiles repeating the diagram, and a
          connections card ~1,800px down the page.

          There is no project rail here: with the list and the stage this tab
          already has its two columns, and a third leaves 352px of stage at
          1280px with the nav expanded. The project's facts are in the command
          bar's Details button instead, which costs no width. */}
      {tab === 'workstreams' && (
        <div id="panel-workstreams" role="tabpanel" aria-labelledby="tab-workstreams"
          className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-4 @3xl/page:grid-cols-[15rem_minmax(0,1fr)] @3xl/page:grid-rows-1 @6xl/page:grid-cols-[17rem_minmax(0,1fr)]">
          <WorkstreamListPane
            workstreams={workstreams}
            links={links}
            selectedId={selectedWorkstream}
            onSelect={(id) => selectWorkstream(id)}
            onShowMap={() => selectWorkstream(null)}
            onNew={() => { setWsError(''); setWsDialog({ open: true, initial: null }) }}
          />

          <WorkstreamStage
            workstreams={workstreams}
            links={links}
            selectedId={selectedWorkstream}
            projectMembers={projectMembers}
            message={wsMessage}
            saving={wsSaving}
            linkError={linkError}
            onSelect={(id) => setSelectedWorkstream(id)}
            onShowMap={() => setSelectedWorkstream(null)}
            onDirtyChange={(dirty) => { paneDirty.current = dirty }}
            onEdit={(ws) => { setWsError(''); setWsDialog({ open: true, initial: ws }) }}
            onDelete={(ws) => void removeWorkstream(ws)}
            onAddLink={(payload) => void addLink(payload)}
            onRemoveLink={(id) => void removeLink(id)}
            onChanged={() => void load()}
          />
        </div>
      )}

      {tab === 'team' && (
        <div id="panel-team" role="tabpanel" aria-labelledby="tab-team" className="contents">
        <div className="g2g-scrollbar min-h-0 flex-1 overflow-y-auto">
          <Card><CardContent className="p-5">
          <h2 className="mb-3 text-base font-semibold tracking-tight text-foreground">Project team</h2>
          {projectMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="divide-y">
              {projectMembers.map((m) => {
                // Which workstreams this person is accountable for — the first
                // thing this tab has ever been able to say.
                const owns = workstreams.filter((w) => w.owner_id === m.id)
                return (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="text-sm font-medium text-foreground">{m.name}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {owns.map((w) => (
                        <span key={w.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          Owns {w.name}
                        </span>
                      ))}
                      {owns.length === 0 && <span className="text-xs text-muted-foreground">Contributor</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent></Card>
        </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div id="panel-tasks" role="tabpanel" aria-labelledby="tab-tasks" className="contents">
        <div className="g2g-scrollbar min-h-0 flex-1 overflow-y-auto">
          <Card><CardContent className="p-5">
          {/*
            THE PROJECT'S OWN TASKS, AND NOTHING ELSE.
            The drawer stapled a 200-row list of every recent task in the
            organisation underneath this, which is what made the tab feel like it
            was showing all tasks — it was. Linking now happens in a picker you
            open on purpose.
          */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight text-foreground">Linked tasks</h2>
            <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
              <Plus className="mr-1 size-3.5" /> Link a task
            </Button>
          </div>

          {taskMessage && <p className="mb-3 text-sm text-success">{taskMessage}</p>}

          {/* The tab had NO filters — every linked task, always, in one list.
              `project.tasks` is already hydrated client-side, so narrowing it
              costs no request. */}
          {(project.tasks?.length ?? 0) > 0 && (
            /*
             * ── EACH CONTROL NEEDS ITS OWN SIZED WRAPPER ─────────────────
             *
             * `Select`'s root element is hardcoded `relative inline-block
             * w-full` and its `className` prop reaches only the inner
             * <button>. So `className="w-40"` sized the button while the
             * wrapper still claimed 100% of the flex row — which is what
             * stacked these filters vertically, one per line.
             *
             * The fix is a sized wrapper per control, not an edit to the
             * primitive: components/ui is shared and every other Select in
             * the product depends on that w-full behaviour inside a form
             * field. `min-w-0` lets them shrink instead of overflowing when
             * the pane is narrow.
             */
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="w-full min-w-0 sm:w-56">
                <Input
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="Search task or assignee…"
                  className="h-8"
                  aria-label="Search linked tasks"
                />
              </div>
              <div className="w-36 min-w-0">
                <Select value={taskStatus} onChange={setTaskStatus} size="sm"
                  aria-label="Filter by status"
                  options={[{ value: '', label: 'Any status' },
                    ...taskStatuses.map((v) => ({ value: v, label: v }))]} />
              </div>
              <div className="w-40 min-w-0">
                <Select value={taskAssignee} onChange={setTaskAssignee} size="sm"
                  aria-label="Filter by assignee"
                  options={[{ value: '', label: 'Anyone' },
                    ...taskAssignees.map((v) => ({ value: v, label: v }))]} />
              </div>
              {(taskSearch || taskStatus || taskAssignee) && (
                <>
                  <Button size="sm" variant="ghost" className="shrink-0"
                    onClick={() => { setTaskSearch(''); setTaskStatus(''); setTaskAssignee('') }}>
                    Clear
                  </Button>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {visibleTasks.length} of {project.tasks?.length ?? 0}
                  </span>
                </>
              )}
            </div>
          )}

          {(project.tasks?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks linked to this project yet.</p>
          ) : visibleTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked task matches those filters.</p>
          ) : (
            <div className="space-y-4">
              {groupByWorkstream(visibleTasks).map((group) => (
                <div key={group.id}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.name}</p>
                  <ul className="divide-y rounded-lg border">
                    {group.tasks.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                        {/* The row had NO click target — you could see a task
                            and never open it. The drawer this opens already
                            existed, carrying the description, the procedure,
                            attachments, documents and the extension history;
                            nothing here reached it. */}
                        <button type="button" onClick={() => setOpenTaskId(t.id)}
                          className="min-w-0 truncate text-left text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/40">
                          {t.title}
                        </button>
                        <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
                          {t.assignee && <span>{t.assignee}</span>}
                          {t.due_date && <span>{t.due_date}</span>}
                          <StatusBadge status={t.status ?? 'Pending'} size="sm">{t.status ?? 'Pending'}</StatusBadge>
                          {/* Moves the task between workstreams. attachTask
                              re-places a task already on the project rather than
                              duplicating it, so this is one call, not two. */}
                          {workstreams.length > 0 && (
                            <Select
                              value={t.workstream_id ?? ''}
                              onChange={(id) => void placeTask(t.id, id)}
                              size="sm"
                              options={[{ value: '', label: 'No workstream' },
                                ...workstreams.map((w) => ({ value: w.id, label: w.name }))]}
                            />
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-1.5 text-destructive"
                            aria-label={`Unlink ${t.title}`} onClick={() => void unlinkTask(t.id, t.title)}>
                            <X className="size-3.5" />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
        </div>
        </div>
      )}

      {tab === 'backlog' && (
        <div id="panel-backlog" role="tabpanel" aria-labelledby="tab-backlog" className="contents">
        <div className="g2g-scrollbar min-h-0 flex-1 overflow-y-auto">
          <Card><CardContent className="p-5">
            {/* Work written down before it has an owner. It loads itself
                rather than joining load()'s Promise.all — a fourth blocking
                request would make every other tab wait for the backlog. */}
            <BacklogBoard
              projectId={projectId}
              workstreams={workstreams}
              onCountChange={setBacklogOpen}
              onAssign={(item) => setAssignSeed(item)}
            />
          </CardContent></Card>
        </div>
        </div>
      )}

      {/* Assigning a backlog item opens the SAME drawer that creates every
          other task, pre-filled. One task-creation path in the product. */}
      {assignSeed && (
        <CreateTaskModal
          key={assignSeed.id}
          isOpen
          initialTitle={assignSeed.title}
          initialDescription={assignSeed.notes ?? ''}
          initialProjectId={projectId}
          initialWorkstreamId={assignSeed.workstream_id ?? undefined}
          onClose={() => setAssignSeed(null)}
          onCreated={(text) => {
            setTaskMessage(text)
            setAssignSeed(null)
            void load()
          }}
          onCreatedTaskId={(taskId) => {
            void taskService.assignBacklogItem(getLaravelContext(), assignSeed.id, taskId).catch(() => {
              // The task exists either way; only the backlog link is lost, and
              // the item stays OPEN rather than claiming an assignment it has no
              // id for.
            })
          }}
        />
      )}

      <WorkstreamDialog
        open={wsDialog.open} initial={wsDialog.initial}
        workstreams={workstreams} projectMembers={projectMembers} options={options}
        saving={wsSaving} error={wsError}
        onClose={() => { setWsDialog({ open: false, initial: null }); setWsError('') }}
        onSave={(payload) => void saveWorkstream(payload)}
      />

      {/* Reused verbatim from My Tasks — one task-detail surface in the
          product, not a second one written for this tab. */}
      <MyTaskDetailsDrawer
        taskId={openTaskId}
        open={openTaskId !== null}
        onClose={() => setOpenTaskId(null)}
        onUpdated={() => void load()}
      />

      <LinkTaskDialog
        open={linkOpen} projectId={projectId} workstreams={workstreams}
        onClose={() => setLinkOpen(false)}
        onLinked={(text) => { setTaskMessage(text); void load() }}
      />

      {tab === 'timeline' && (
        <div id="panel-timeline" role="tabpanel" aria-labelledby="tab-timeline" className="contents">
        <div className="g2g-scrollbar min-h-0 flex-1 overflow-y-auto">
          <Card><CardContent className="p-5">
          <h2 className="mb-4 flex items-center gap-1.5 text-base font-semibold tracking-tight text-foreground">
            Workstream timeline
            <Tooltip
              side="bottom"
              content={(
                <span className="block max-w-[15rem] text-left text-xs leading-relaxed">
                  Each workstream against the project window.
                </span>
              )}
            >
              <Info role="img" aria-label="Each workstream against the project window."
                className="size-3.5 text-muted-foreground" />
            </Tooltip>
          </h2>
          <WorkstreamSchedule
            project={project}
            workstreams={workstreams}
            schedule={schedule}
            onOpenWorkstream={(id) => { setTab('workstreams'); setSelectedWorkstream(id) }}
            onOpenTask={(id) => setOpenTaskId(id)}
          />
        </CardContent></Card>
        </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Link one task, deliberately.
 *
 * The list is searched server-side and capped, and it says so — a silently
 * truncated list reads as "these are all the tasks there are". A candidate
 * already on another project is OFFERED but LABELLED: hiding it would make a
 * task somebody is searching for simply absent, and double-linking is legal.
 */
function LinkTaskDialog({
  open, projectId, workstreams, onClose, onLinked,
}: {
  open: boolean
  projectId: string
  workstreams: WorkstreamSummary[]
  onClose: () => void
  onLinked: (message: string) => void
}) {
  const [search, setSearch] = useState('')
  const [tasks, setTasks] = useState<LinkableTask[]>([])
  const [capped, setCapped] = useState(false)
  const [workstreamId, setWorkstreamId] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Debounced, like every other search in this module.
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      const context = getLaravelContext()
      if (!isLaravelContextReady(context)) return
      setLoading(true)
      taskService.getLinkableTasks(context, projectId, search.trim() || undefined)
        .then((r) => { setTasks(r.data.tasks); setCapped(r.data.capped) })
        .catch(() => { setTasks([]); setCapped(false) })
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [open, projectId, search])

  const link = async (task: LinkableTask) => {
    setSaving(true)
    setError('')
    try {
      await taskService.attachTaskToProject(getLaravelContext(), projectId, task.id, workstreamId || undefined)
      onLinked(`"${task.title}" linked to this project.`)
      onClose()
    } catch (reason) {
      // Inside the dialog — a banner behind the overlay reads as nothing happening.
      setError(reason instanceof Error ? reason.message : 'Unable to link that task.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { onClose(); setError('') } }}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-[620px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Link a task</DialogTitle>
          <DialogDescription>
            Attach an existing task to this project, optionally placing it in a workstream.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" />

          {workstreams.length > 0 && (
            <Select
              value={workstreamId} onChange={setWorkstreamId}
              options={[{ value: '', label: 'No workstream' },
                ...workstreams.map((w) => ({ value: w.id, label: w.name }))]}
            />
          )}

          {loading && <div className="flex justify-center py-6"><Spinner /></div>}

          {!loading && tasks.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {search ? 'No tasks match that search.' : 'No tasks available to link.'}
            </p>
          )}

          <ul className="divide-y rounded-lg border">
            {tasks.map((t) => (
              <li key={t.id}>
                <button type="button" disabled={saving} onClick={() => void link(t)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40 disabled:opacity-50">
                  <span className="min-w-0">
                    <span className="block truncate">{t.title}</span>
                    {t.already_linked_project && (
                      // Reported, not hidden — and not blocked, because a task
                      // legitimately can sit on two projects.
                      <span className="text-xs text-warning" title={t.already_linked_project_code ?? undefined}>
                        already in {t.already_linked_project}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {t.assignee && <span>{t.assignee}</span>}
                    <StatusBadge status={t.status ?? 'Pending'} size="sm">{t.status ?? 'Pending'}</StatusBadge>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {capped && (
            <p className="text-xs text-muted-foreground">
              Showing the 50 most recent matches — search to narrow it further.
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



function groupByWorkstream(tasks: NonNullable<ProjectRecord['tasks']>) {
  const map = new Map<string, { id: string; name: string; tasks: typeof tasks }>()

  for (const task of tasks) {
    const id = task.workstream_id ?? 'none'
    if (!map.has(id)) {
      map.set(id, { id, name: task.workstream_name ?? 'Not in a workstream', tasks: [] })
    }
    map.get(id)!.tasks.push(task)
  }

  // The unplaced bucket sorts last — it is an absence, not a workstream.
  return [...map.values()].sort((a, b) => (a.id === 'none' ? 1 : b.id === 'none' ? -1 : 0))
}
