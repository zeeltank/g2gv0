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

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, Briefcase, Info, Layers, Pencil, Plus, Target, Trash2, Users, X,
} from 'lucide-react'

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
import { PriorityBadge } from './priority-badge'
import { WorkstreamLifecycleMap } from './workstream-lifecycle-map'
import { LifecycleConnections, WorkstreamDialog } from './workstream-form'
import { WorkstreamDetailView } from './workstream-detail-view'
import {
  WorkstreamHealthBadge, WorkstreamProgress, healthTone, projectStatusVariant,
} from './workstream-health'
import type {
  LinkableTask, ProjectRecord, WorkstreamLink, WorkstreamOptions, WorkstreamSummary,
} from '@/types/task-management'
import type { WorkstreamPayload } from '@/services/task'

// Overview removed 2026-09-01 at the customer's request: it duplicated the
// Workstreams tab, which already carries the lifecycle diagram at full size and
// the same health cards. Workstreams is the default.
type Tab = 'workstreams' | 'team' | 'tasks' | 'timeline'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'workstreams', label: 'Workstreams' },
  { id: 'team', label: 'Team' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'timeline', label: 'Timeline' },
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
  const riskLoad = useMemo(() => {
    const regulated = workstreams.reduce((n, w) => n + w.health.risks.regulated_open, 0)
    const high = workstreams.reduce((n, w) => n + w.health.risks.severe_open, 0)
    const open = workstreams.reduce((n, w) => n + w.health.risks.open, 0)
    return { regulated, high, open }
  }, [workstreams])

  // A workstream is opened in place, keeping the project's data loaded behind it.
  if (selectedWorkstream) {
    return (
      <WorkstreamDetailView
        workstreamId={selectedWorkstream}
        projectMembers={projectMembers}
        onBack={() => setSelectedWorkstream(null)}
        onOpenWorkstream={(id) => setSelectedWorkstream(id)}
        onChanged={() => void load()}
      />
    )
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 size-4" /> Back to projects</Button>
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {error || 'This project could not be loaded.'}
        </div>
      </div>
    )
  }

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-5 overflow-y-auto pb-8">
      <GtgBreadcrumb items={[
        { label: 'Projects & Workstreams' },
        { label: project.name },
      ]} />

      {/* ── page header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2.5 text-3xl font-bold tracking-tight text-foreground">
            <Briefcase className="size-7 shrink-0 text-primary" />
            {project.name}
            <span className="font-mono text-sm font-medium text-muted-foreground">{project.code}</span>
          </h1>
          {project.description && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <PriorityBadge priority={project.priority} />
          {/* variant passed explicitly — 'IN PROGRESS' is missing from the
              shared status map, so four statuses colour and one does not. */}
          <StatusBadge status={project.status} variant={projectStatusVariant(project.status)}>
            {project.status}
          </StatusBadge>
          {project.archived_at && <StatusBadge status="Archived" size="sm">Archived</StatusBadge>}
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 size-3.5" /> Back to projects
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          {/* Everything the API already returned and the drawer discarded. */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
            <Meta label="Manager" value={project.manager} />
            <Meta label="Sponsor" value={project.sponsor} />
            <Meta label="Timeline" value={`${project.start_date ?? '—'} → ${project.due_date ?? '—'}`} />
            <Meta label="Category" value={project.category} />
            <Meta label="Client" value={project.client_name} />
            <Meta label="Budget" value={project.budget_estimate ? Number(project.budget_estimate).toLocaleString() : null} />
            <Meta label="Team size" value={project.team_size} />
            <Meta label="Members" value={String(project.members_count)} />
          </dl>

          {/* Multi-department projects rendered as single-department in the
              drawer; the API has always returned the whole list. */}
          {(project.departments?.length ?? 0) > 0 && (
            <div className="border-t pt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Departments</p>
              <div className="flex flex-wrap gap-1.5">
                {project.departments!.map((d) => (
                  <span key={d.id} className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs',
                    d.is_primary ? 'border-primary/30 bg-primary/10 font-medium text-primary' : 'bg-muted/40',
                  )}>
                    {d.name ?? 'Unnamed'}{d.is_primary && ' · primary'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {project.regulatory_flags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t pt-3">
              {project.regulatory_flags.map((flag) => (
                <span key={flag} className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-xs text-warning">
                  {flag}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── stat strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Target} label="Progress" value={`${project.progress}%`} />
        <Stat icon={Layers} label="Tasks" value={`${project.tasks_completed} of ${project.tasks_total}`} />
        <Stat icon={Users} label="Workstreams" value={String(workstreams.length)} />
        <Stat icon={AlertTriangle} label="Open risks" value={String(riskLoad.open)}
          tone={riskLoad.regulated > 0 ? 'text-danger' : riskLoad.high > 0 ? 'text-warning' : undefined} />
      </div>

      {/* ── tabs: ghost buttons with an underline, the house pattern ── */}
      <div className="flex gap-1 overflow-x-auto border-b" role="tablist">
        {TABS.map((t) => (
          <Button key={t.id} variant="ghost" role="tab" aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-none border-b-2 text-sm',
              tab === t.id
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent font-medium text-muted-foreground',
            )}>
            {t.label}
          </Button>
        ))}
      </div>


      {tab === 'workstreams' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-foreground">
                Delivery lifecycle
                <Tooltip
                  side="bottom"
                  content={(
                    <span className="block max-w-[15rem] text-left text-xs leading-relaxed">
                      Create the workstreams for this project, then connect them to describe how work flows.
                    </span>
                  )}
                >
                  {/* lucide stamps aria-hidden on a childless icon, so the bare
                      <Info /> left this trigger — and the guidance it replaced —
                      with no accessible name at all. */}
                  <Info role="img"
                    aria-label="Create the workstreams for this project, then connect them to describe how work flows."
                    className="size-3.5 text-muted-foreground" />
                </Tooltip>
              </h2>
            </div>
            <Button size="sm" onClick={() => { setWsError(''); setWsDialog({ open: true, initial: null }) }}>
              <Plus className="mr-1 size-3.5" /> New workstream
            </Button>
          </div>

          {wsMessage && <p className="text-sm text-success">{wsMessage}</p>}

          <Card><CardContent className="p-5">
            <WorkstreamLifecycleMap
              workstreams={workstreams} links={links}
              onOpen={(id) => setSelectedWorkstream(id)}
            />
          </CardContent></Card>

          {workstreams.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">No workstreams yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {workstreams.map((w) => (
                /*
                 * The WHOLE card opens the workstream, not just its title.
                 *
                 * It already carried `hover:shadow-md`, so it announced itself
                 * as clickable while only the small name/code button inside it
                 * actually was — the badge, the owner, the reason line, the
                 * progress bar and every bit of padding did nothing.
                 *
                 * A plain div takes the click rather than `role="button"`,
                 * because the card contains real Edit and Delete buttons and a
                 * button inside a button is invalid. The name stays a genuine
                 * <button> so the card is still reachable by keyboard, and the
                 * two actions stopPropagation so they do not also navigate.
                 * This is the pattern ProjectCard already uses on the list.
                 */
                <div key={w.id}
                  onClick={() => setSelectedWorkstream(w.id)}
                  className={cn(
                    'group cursor-pointer rounded-xl border-l-4 border bg-card p-4 text-left transition hover:shadow-md',
                    healthTone(w.health.state),
                  )}>
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      onClick={(e) => { e.stopPropagation(); setSelectedWorkstream(w.id) }}>
                      {/* Name first. The code is a reference, in muted text beneath. */}
                      <p className="text-sm font-semibold leading-tight text-foreground group-hover:text-primary">{w.name}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        {w.code && <span className="font-mono">{w.code}</span>}
                        {w.kind === 'GOVERNANCE' && <span className="font-medium">Governance layer</span>}
                      </p>
                    </button>
                    <WorkstreamHealthBadge state={w.health.state} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{w.owner_name ?? 'No owner'}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{w.health.state_reason}</p>
                  <div className="mt-3"><WorkstreamProgress progress={w.progress} /></div>
                  <div className="mt-3 flex justify-end gap-1 border-t pt-2">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                      onClick={(e) => { e.stopPropagation(); setWsError(''); setWsDialog({ open: true, initial: w }) }}>
                      <Pencil className="mr-1 size-3" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-danger"
                      onClick={(e) => { e.stopPropagation(); void removeWorkstream(w) }}>
                      <Trash2 className="mr-1 size-3" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Card><CardContent className="p-5">
            <LifecycleConnections
              workstreams={workstreams} links={links}
              canManage saving={wsSaving} error={linkError}
              onAdd={(payload) => void addLink(payload)}
              onRemove={(id) => void removeLink(id)}
            />
          </CardContent></Card>
        </div>
      )}

      {tab === 'team' && (
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
      )}

      {tab === 'tasks' && (
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

          {(project.tasks?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks linked to this project yet.</p>
          ) : (
            <div className="space-y-4">
              {groupByWorkstream(project.tasks ?? []).map((group) => (
                <div key={group.id}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.name}</p>
                  <ul className="divide-y rounded-lg border">
                    {group.tasks.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="min-w-0 truncate text-foreground">{t.title}</span>
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
                          <Button size="sm" variant="ghost" className="h-7 px-1.5 text-danger"
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
      )}

      <WorkstreamDialog
        open={wsDialog.open} initial={wsDialog.initial}
        workstreams={workstreams} projectMembers={projectMembers} options={options}
        saving={wsSaving} error={wsError}
        onClose={() => { setWsDialog({ open: false, initial: null }); setWsError('') }}
        onSave={(payload) => void saveWorkstream(payload)}
      />

      <LinkTaskDialog
        open={linkOpen} projectId={projectId} workstreams={workstreams}
        onClose={() => setLinkOpen(false)}
        onLinked={(text) => { setTaskMessage(text); void load() }}
      />

      {tab === 'timeline' && (
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
          <WorkstreamTimeline workstreams={workstreams} project={project} onOpen={(id) => setSelectedWorkstream(id)} />
        </CardContent></Card>
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
            <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">
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

function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      {/* An em dash, not a blank: absent and empty read differently. */}
      <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{value && value !== '' ? value : '—'}</dd>
    </div>
  )
}

function Stat({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone?: string }) {
  return (
    <Card><CardContent className="flex items-center gap-3 p-4">
      <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-4" /></span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className={cn('block text-lg font-bold tabular-nums text-foreground', tone)}>{value}</span>
      </span>
    </CardContent></Card>
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

/**
 * A simple Gantt over the project window.
 *
 * The range covers BOTH starts and dues — taking min/max from due dates alone
 * while positioning bars from starts puts anything starting before the earliest
 * due at a negative offset. Same guard the dependency timeline uses, including
 * the minimum span so a single-day project does not divide by zero.
 */
function WorkstreamTimeline({
  workstreams, project, onOpen,
}: {
  workstreams: WorkstreamSummary[]
  project: ProjectRecord
  onOpen: (id: string) => void
}) {
  const dated = workstreams.filter((w) => w.start_date || w.due_date)

  if (dated.length === 0) {
    return <p className="text-sm text-muted-foreground">No workstream has dates set yet.</p>
  }

  const stamps = [
    ...dated.flatMap((w) => [w.start_date, w.due_date]),
    project.start_date, project.due_date,
  ].filter(Boolean).map((d) => new Date(`${d}T00:00:00`).getTime()).filter((n) => !Number.isNaN(n))

  const min = Math.min(...stamps)
  const span = Math.max(Math.max(...stamps) - min, 6 * 86400000)
  const pct = (value: string | null) => {
    if (!value) return null
    const time = new Date(`${value}T00:00:00`).getTime()
    if (Number.isNaN(time)) return null
    return Math.min(100, Math.max(0, ((time - min) / span) * 100))
  }

  return (
    <div className="space-y-2">
      {dated.map((w) => {
        const start = pct(w.start_date)
        const end = pct(w.due_date)

        return (
          <div key={w.id} className="flex items-center gap-3">
            <button type="button" onClick={() => onOpen(w.id)}
              className="w-40 shrink-0 truncate text-left text-sm hover:text-primary hover:underline">
              {w.name}
            </button>
            <div className="relative h-6 flex-1 rounded bg-muted/40">
              {start !== null && end !== null ? (
                <span className="absolute inset-y-1 rounded bg-primary/70"
                  style={{ left: `${start}%`, width: `${Math.max(end - start, 1)}%` }}
                  title={`${w.start_date} → ${w.due_date}`} />
              ) : (
                // No span to draw: a point marker on whichever date exists,
                // rather than inventing a start or an end.
                <span className="absolute top-1/2 size-2.5 -translate-y-1/2 rotate-45 bg-primary"
                  style={{ left: `${start ?? end ?? 0}%` }}
                  title={w.start_date ?? w.due_date ?? ''} />
              )}
            </div>
          </div>
        )
      })}
      <p className="pt-1 text-xs text-muted-foreground">
        {workstreams.length - dated.length > 0
          ? `${workstreams.length - dated.length} workstream(s) have no dates set and are not shown.`
          : 'All workstreams have dates.'}
      </p>
    </div>
  )
}
