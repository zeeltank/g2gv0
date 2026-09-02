'use client'

/**
 * One workstream, all nine fields at once.
 *
 * ── DELIBERATELY NOT TABBED ─────────────────────────────────────────────────
 *
 * Tabs would be the easy layout and the wrong one. The point of a 360° view is
 * that purpose, people, deliverables, timeline, dependencies, metrics, scope and
 * risks are visible together — a workstream is understood by seeing how those
 * relate, and hiding five of them behind tabs turns it back into a form.
 *
 * Scope in/out gets two EQUAL columns. The out-of-scope side is the half that
 * prevents scope creep, which is the reason the model calls it out; rendering it
 * as a footnote under "in scope" would quietly undo that.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, CalendarDays, CircleDot, Flag, Info, Pencil, Shield, Target, Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip } from '@/components/ui/tooltip'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService, type WorkstreamRecordKind } from '@/services/task'
import { cn } from '@/lib/utils'
import { EmptySection, SectionAddButton, SectionGroup } from './section'
import {
  WorkstreamHealthLine, WorkstreamProgress, projectStatusVariant,
} from './workstream-health'
import {
  CheckpointDialog, ContributorsEditor, DeliverableDialog, DependencyDialog,
  KpiDialog, MeasurementDialog, RiskDialog, RiskSeverityBadge, StatementListEditor,
} from './workstream-record-forms'
import type {
  WorkstreamCheckpoint, WorkstreamDeliverable, WorkstreamDependency,
  WorkstreamDetail, WorkstreamKpi, WorkstreamOptions, WorkstreamRisk,
} from '@/types/task-management'

/**
 * ── THIS IS A PANE NOW, NOT A PAGE ──────────────────────────────────────────
 *
 * It used to replace the whole project screen: its own breadcrumb, its own
 * 3xl h1, its own "Back to {project}" button, its own full-page spinner. It
 * had exactly one caller, and that caller now renders it inside the stage
 * beside the workstream list — so the breadcrumb belonged to the project, the
 * h1 is the stage's segment label, and "Back" pointed at a page that is
 * already on screen. All three are gone rather than switched off by a flag.
 */
interface Props {
  workstreamId: string
  projectMembers: Array<{ id: string; name: string }>
  onOpenWorkstream?: (id: string) => void
  onChanged?: () => void
  /**
   * Raised while ANY inline editor on this pane holds unsaved edits.
   *
   * Four of them can be dirty at once — Responsibilities, In scope, Out of
   * scope and Contributors — each with its own Save. The pane is remounted on
   * `key={selectedId}`, so before this existed, clicking another workstream
   * threw all of that away without a word.
   */
  onDirtyChange?: (dirty: boolean) => void
}

type DialogState =
  | { kind: 'deliverable'; record: WorkstreamDeliverable | null }
  | { kind: 'checkpoint'; record: WorkstreamCheckpoint | null }
  | { kind: 'kpi'; record: WorkstreamKpi | null }
  | { kind: 'measurement'; record: WorkstreamKpi }
  | { kind: 'risk'; record: WorkstreamRisk | null }
  | { kind: 'dependency'; record: WorkstreamDependency | null; direction: 'UPSTREAM' | 'DOWNSTREAM' }
  | null

export function WorkstreamDetailView({
  workstreamId, projectMembers, onOpenWorkstream, onChanged, onDirtyChange,
}: Props) {
  // Which editors are dirty, by key — one boolean would be overwritten by
  // whichever editor reported last.
  const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({})
  const markDirty = useCallback((key: string) => (dirty: boolean) => {
    setDirtyKeys((current) => (current[key] === dirty ? current : { ...current, [key]: dirty }))
  }, [])

  const anyDirty = Object.values(dirtyKeys).some(Boolean)
  useEffect(() => { onDirtyChange?.(anyDirty) }, [anyDirty, onDirtyChange])
  const [detail, setDetail] = useState<WorkstreamDetail | null>(null)
  const [options, setOptions] = useState<WorkstreamOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [dialogError, setDialogError] = useState('')

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
      const [ws, opts] = await Promise.all([
        taskService.getWorkstream(context, workstreamId),
        taskService.getWorkstreamOptions(context),
      ])
      setDetail(ws.data)
      setOptions(opts.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load this workstream.')
    } finally {
      setLoading(false)
    }
  }, [workstreamId])

  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  /** One place where every write reports success or failure the same way. */
  const run = async (action: () => Promise<{ message: string }>): Promise<{ ok: boolean; message: string }> => {
    setSaving(true)
    try {
      const response = await action()
      await load()
      onChanged?.()
      return { ok: true, message: response.message }
    } catch (reason) {
      return { ok: false, message: reason instanceof Error ? reason.message : 'Unable to save.' }
    } finally {
      setSaving(false)
    }
  }

  const saveRecord = async (kind: WorkstreamRecordKind, recordId: string | null, payload: Record<string, unknown>) => {
    const context = getLaravelContext()
    const result = await run(() => recordId
      ? taskService.updateWorkstreamRecord(context, workstreamId, kind, recordId, payload)
      : taskService.createWorkstreamRecord(context, workstreamId, kind, payload))

    if (result.ok) { setDialog(null); setDialogError('') } else { setDialogError(result.message) }
  }

  const removeRecord = async (kind: WorkstreamRecordKind, recordId: string, label: string) => {
    if (!window.confirm(`Remove this ${label}?`)) return
    const result = await run(() => taskService.deleteWorkstreamRecord(getLaravelContext(), workstreamId, kind, recordId))
    if (!result.ok) setError(result.message)
  }

  // Pane-sized, not page-sized: a centred h-64 spinner inside a 700px stage
  // sits in the wrong place entirely.
  if (loading) return <div className="flex h-40 items-center justify-center"><Spinner /></div>

  if (error || !detail || !options) {
    return (
      <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
        {error || 'This workstream could not be loaded.'}
      </div>
    )
  }

  const can = detail.can_manage
  const people = projectMembers

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* ── the context strip ────────────────────────────────────────
          Every fact about this workstream that is not one of the nine
          fields, stated ONCE. It used to be split between a full-width
          health card at the top and an "At a glance" card in a 320px rail —
          which also meant the owner and the dates were rendered twice, and
          the rail was ~1150px tall while being `sticky` in a ~750px viewport,
          so its lower cards could never be scrolled to. No rail, no bug. */}
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-3.5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            {detail.name}
            {detail.code && <span className="font-mono text-xs font-medium text-muted-foreground">{detail.code}</span>}
            {detail.kind === 'GOVERNANCE' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Shield className="size-3" /> Governance
              </span>
            )}
          </h2>
          <StatusBadge status={detail.status} variant={projectStatusVariant(detail.status)}>{detail.status}</StatusBadge>
        </div>

        {/* The core question, which is what makes the workstream legible
            at a glance — the model gives one per workstream. */}
        {detail.core_question && (
          <p className="text-sm italic text-muted-foreground">{detail.core_question}</p>
        )}

        {/* ① Purpose — read first, and no longer inside a frame of its own. */}
        {detail.purpose
          ? <p className="max-w-[68ch] text-sm leading-relaxed text-foreground">{detail.purpose}</p>
          : <p className="text-sm text-muted-foreground">No purpose recorded yet.</p>}

        <WorkstreamHealthLine health={detail.health} />
        {/* The counts come from `health`, which already carries both — so the
            bar can name what it is measuring without a second request. */}
        <WorkstreamProgress
          progress={detail.progress}
          basis={{
            deliverables: detail.health.deliverables,
            tasks: { done: detail.health.tasks.completed, total: detail.health.tasks.total },
          }}
          className="max-w-sm"
        />

        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-2 text-sm">
            <span><span className="text-muted-foreground">Accountable:</span> {detail.owner_name ?? '—'}</span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <CalendarDays className="size-3.5 text-muted-foreground" />
              {detail.start_date ?? '—'} → {detail.due_date ?? '—'}
            </span>
        </div>
      </div>

      {/* ── THE NINE, IN THREE GROUPS ───────────────────────────────
          They used to render as nine identical Cards — same surface, same
          padding, same heading — split across two columns in an order that
          matched neither the model's numbering nor any reading of the work.
          Nine equal siblings is not a hierarchy.

          Three questions instead: what is this work, what does it produce,
          and what could go wrong with it. Purpose (①) is not here — it is
          the first thing read, so it sits in the strip above. */}
      <div className="space-y-6">
        <SectionGroup label="Plan" hint="What this workstream is for, and where its edges are">
          <div className="grid gap-5 @3xl/stage:grid-cols-2">
        {/* ③ Responsibilities */}
        <Card><CardContent className="p-5">
          <StatementListEditor
            title="Responsibilities" level={2} onDirtyChange={markDirty('responsibilities')} statements={detail.statements.responsibilities}
            canManage={can} saving={saving}
            onSave={(bodies) => run(() => taskService.saveWorkstreamStatements(
              getLaravelContext(), workstreamId, 'RESPONSIBILITY', bodies))}
          />
        </CardContent></Card>

        {/* ⑧ Scope — two EQUAL columns, on purpose */}
        <Card><CardContent className="p-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-base font-semibold tracking-tight text-foreground">
            Scope boundaries
            <Tooltip side="bottom" content={<span className="block max-w-[15rem] text-left text-xs leading-relaxed">What is out of scope is what prevents scope creep — it carries the same weight as what is in.</span>}>
              {/* lucide marks a childless icon aria-hidden; without a name here
                  the sentence this tooltip replaced reaches nobody. */}
              <Info role="img"
                aria-label="What is out of scope is what prevents scope creep — it carries the same weight as what is in."
                className="size-3.5 text-muted-foreground" />
            </Tooltip>
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <StatementListEditor
              title="In scope" onDirtyChange={markDirty('in_scope')} statements={detail.statements.in_scope} canManage={can} saving={saving}
              onSave={(bodies) => run(() => taskService.saveWorkstreamStatements(
                getLaravelContext(), workstreamId, 'IN_SCOPE', bodies))}
            />
            <StatementListEditor
              title="Out of scope" onDirtyChange={markDirty('out_of_scope')} statements={detail.statements.out_of_scope} canManage={can} saving={saving}
              onSave={(bodies) => run(() => taskService.saveWorkstreamStatements(
                getLaravelContext(), workstreamId, 'OUT_OF_SCOPE', bodies))}
            />
          </div>
        </CardContent></Card>
          </div>
        </SectionGroup>

        <SectionGroup label="Deliver" hint="What it produces, by when, and how success is judged">
          <div className="grid gap-5 @3xl/stage:grid-cols-2">
        {/* ④ Deliverables */}
        <Card><CardContent className="p-5">
          <SectionHeader title="Deliverables" icon={Flag}
            action={can && <SectionAddButton label="Add" onClick={() => { setDialogError(''); setDialog({ kind: 'deliverable', record: null }) }} />} />
          {detail.deliverables.length === 0 ? (
            <Empty>No deliverables defined.</Empty>
          ) : (
            <ul className="divide-y">
              {detail.deliverables.map((d) => (
                <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{d.name}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
                      <span>{d.owner_name ?? 'Unassigned'}</span>
                      {d.due_date && <span>due {d.due_date}</span>}
                      {/* The checkpoint this deliverable is gated by — field ⑤
                          meeting field ④, which is the point of linking them. */}
                      {d.checkpoint_name && <span className="text-primary">gate: {d.checkpoint_name}</span>}
                    </p>
                    {d.acceptance_criteria && (
                      <p className="mt-1 text-xs italic text-muted-foreground">{d.acceptance_criteria}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusBadge status={d.status} size="sm">{d.status}</StatusBadge>
                    {can && <RowActions
                      onEdit={() => { setDialogError(''); setDialog({ kind: 'deliverable', record: d }) }}
                      onDelete={() => void removeRecord('deliverables', d.id, 'deliverable')} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent></Card>

        {/* ⑤ Timeline & checkpoints */}
        {detail.checkpoints.length === 0 ? (
          <EmptySection title="Timeline" icon={CircleDot} canManage={can}
            onAdd={() => { setDialogError(''); setDialog({ kind: 'checkpoint', record: null }) }} />
        ) : (
        <Card><CardContent className="p-5">
          <SectionHeader title="Timeline" icon={CircleDot}
            action={can && <SectionAddButton label="Add"
              onClick={() => { setDialogError(''); setDialog({ kind: 'checkpoint', record: null }) }} />} />
          {detail.checkpoints.length > 0 && (
            <ol className="space-y-0">
              {detail.checkpoints.map((c, i) => (
                <li key={c.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={cn('mt-1 size-2.5 shrink-0 rounded-full',
                      c.is_critical ? 'bg-destructive ring-2 ring-destructive/25' : 'bg-muted-foreground/40')} />
                    {i < detail.checkpoints.length - 1 && <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {c.name}
                        {c.is_critical && <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wider text-destructive">Critical</span>}
                      </p>
                      {can && <RowActions
                        onEdit={() => { setDialogError(''); setDialog({ kind: 'checkpoint', record: c }) }}
                        onDelete={() => void removeRecord('checkpoints', c.id, 'checkpoint')} />}
                    </div>
                    <p className="text-xs tabular-nums text-muted-foreground">{c.target_date ?? 'No date'} · {c.status}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent></Card>
        )}

        {/* ⑦ Success metrics */}
        {detail.kpis.length === 0 ? (
          <EmptySection title="Success metrics" icon={Target} canManage={can}
            onAdd={() => { setDialogError(''); setDialog({ kind: 'kpi', record: null }) }} />
        ) : (
        <Card><CardContent className="p-5">
          <SectionHeader title="Success metrics" icon={Target}
            action={can && <SectionAddButton label="Add" onClick={() => { setDialogError(''); setDialog({ kind: 'kpi', record: null }) }} />} />
          {detail.kpis.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {detail.kpis.map((k) => (
                <div key={k.id} className="rounded-lg bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{k.name}</p>
                    {can && <RowActions
                      onEdit={() => { setDialogError(''); setDialog({ kind: 'kpi', record: k }) }}
                      onDelete={() => void removeRecord('kpis', k.id, 'metric')} />}
                  </div>
                  {k.metric && <p className="text-xs text-muted-foreground">{k.metric}</p>}
                  <dl className="mt-2 space-y-1 text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Target</dt>
                      <dd className="text-right text-sm font-medium tabular-nums text-foreground">{k.target_value ?? 'Not set'}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current</dt>
                      {/* NULL is "not yet measured", never 0 — a zero here
                          would assert a reading nobody took. */}
                      <dd className={cn('text-right text-sm font-medium tabular-nums text-foreground', k.current_value === null && 'text-muted-foreground')}>
                        {k.current_value ?? 'Not yet measured'}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge status={k.status} size="sm"
                      variant={k.status === 'MET' || k.status === 'ON_TRACK' ? 'active'
                        : k.status === 'AT_RISK' ? 'warning' : k.status === 'OFF_TRACK' ? 'error' : 'default'}>
                      {k.status.replace(/_/g, ' ')}
                    </StatusBadge>
                    {can && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => { setDialogError(''); setDialog({ kind: 'measurement', record: k }) }}>
                        Record
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
        )}
          </div>
        </SectionGroup>

        <SectionGroup label="Watch" hint="What could go wrong, what it waits on, and who is on it">
          <div className="grid gap-5 @3xl/stage:grid-cols-2">
        {/* ⑨ Risks */}
        {detail.risks.length === 0 ? (
          <EmptySection title="Risks & mitigations" icon={AlertTriangle} canManage={can}
            onAdd={() => { setDialogError(''); setDialog({ kind: 'risk', record: null }) }} />
        ) : (
        <Card><CardContent className="p-5">
          <SectionHeader title="Risks & mitigations" icon={AlertTriangle}
            action={can && <SectionAddButton label="Add" onClick={() => { setDialogError(''); setDialog({ kind: 'risk', record: null }) }} />} />
          {detail.risks.length > 0 && (
            <ul className="space-y-3">
              {detail.risks.map((r) => (
                <li key={r.id} className="rounded-lg bg-muted/30 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <RiskSeverityBadge severity={r.severity} />
                      <StatusBadge status={r.status} size="sm">{r.status}</StatusBadge>
                      {can && <RowActions
                        onEdit={() => { setDialogError(''); setDialog({ kind: 'risk', record: r }) }}
                        onDelete={() => void removeRecord('risks', r.id, 'risk')} />}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.probability} probability · {r.impact} impact{r.owner_name ? ` · ${r.owner_name}` : ''}
                  </p>
                  {r.description && <p className="mt-1.5 text-xs text-foreground">{r.description}</p>}
                  {r.mitigation && (
                    <p className="mt-1.5 rounded bg-muted/50 px-2 py-1.5 text-xs text-foreground">
                      <span className="font-medium">Mitigation: </span>{r.mitigation}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent></Card>
        )}

        {/* ⑥ Dependencies — graph links and external, together */}
        <Card><CardContent className="space-y-4 p-5">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Dependencies</h2>

          <DependencyGroup
            heading="What this needs" empty="Nothing recorded."
            links={detail.upstream} linkLabel={(l) => l.from_id}
            external={detail.dependencies.upstream}
            detail={detail} onOpen={onOpenWorkstream}
            onAdd={can ? () => { setDialogError(''); setDialog({ kind: 'dependency', record: null, direction: 'UPSTREAM' }) } : undefined}
            onEdit={can ? (d) => { setDialogError(''); setDialog({ kind: 'dependency', record: d, direction: 'UPSTREAM' }) } : undefined}
            onDelete={can ? (d) => void removeRecord('dependencies', d.id, 'dependency') : undefined}
          />

          <DependencyGroup
            heading="Who is waiting on this" empty="Nothing recorded."
            links={detail.downstream} linkLabel={(l) => l.to_id}
            external={detail.dependencies.downstream}
            detail={detail} onOpen={onOpenWorkstream}
            onAdd={can ? () => { setDialogError(''); setDialog({ kind: 'dependency', record: null, direction: 'DOWNSTREAM' }) } : undefined}
            onEdit={can ? (d) => { setDialogError(''); setDialog({ kind: 'dependency', record: d, direction: 'DOWNSTREAM' }) } : undefined}
            onDelete={can ? (d) => void removeRecord('dependencies', d.id, 'dependency') : undefined}
          />

          {(detail.governed_by.length > 0 || detail.governs.length > 0) && (
            <div className="border-t pt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Governance</p>
              {detail.governed_by.map((l) => (
                <p key={l.id} className="text-xs text-muted-foreground">
                  Governed for <span className="text-foreground">{l.label ?? 'delivery'}</span>
                </p>
              ))}
              {detail.governs.map((l) => (
                <p key={l.id} className="text-xs text-muted-foreground">
                  Governs <span className="text-foreground">{l.label ?? 'a workstream'}</span>
                </p>
              ))}
            </div>
          )}
        </CardContent></Card>

        {/* ② Contributors */}
        <Card><CardContent className="p-5">
          <ContributorsEditor
            onDirtyChange={markDirty('contributors')}
            members={detail.members} projectMembers={people}
            ownerId={detail.owner_id} ownerName={detail.owner_name}
            canManage={can} saving={saving}
            onSave={(members) => run(() => taskService.saveWorkstreamMembers(getLaravelContext(), workstreamId, members))}
          />
        </CardContent></Card>

        {/* The API returns title, status, due date and assignee per task.
            This card used to spend a whole bordered surface saying only
            "N tasks placed in this workstream." — throwing four fields per
            task away and giving the reader nothing to act on. */}
        {detail.tasks.length > 0 && (
          <Card><CardContent className="p-5">
            <SectionHeader title="Linked tasks" icon={CircleDot} />
            <ul className="divide-y divide-border">
              {detail.tasks.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">{t.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[t.assignee, t.due_date].filter(Boolean).join(' · ') || 'Unassigned'}
                    </span>
                  </span>
                  {t.status && (
                    <StatusBadge status={t.status} size="sm" className="shrink-0">{t.status}</StatusBadge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent></Card>
        )}
          </div>
        </SectionGroup>
      </div>

      {/* ── dialogs ──────────────────────────────────────────────── */}
      <DeliverableDialog
        open={dialog?.kind === 'deliverable'} initial={dialog?.kind === 'deliverable' ? dialog.record : null}
        options={options} checkpoints={detail.checkpoints} people={people}
        saving={saving} error={dialogError} onClose={() => setDialog(null)}
        onSave={(p) => void saveRecord('deliverables', dialog?.kind === 'deliverable' ? dialog.record?.id ?? null : null, p)}
      />
      <CheckpointDialog
        open={dialog?.kind === 'checkpoint'} initial={dialog?.kind === 'checkpoint' ? dialog.record : null}
        options={options} saving={saving} error={dialogError} onClose={() => setDialog(null)}
        onSave={(p) => void saveRecord('checkpoints', dialog?.kind === 'checkpoint' ? dialog.record?.id ?? null : null, p)}
      />
      <KpiDialog
        open={dialog?.kind === 'kpi'} initial={dialog?.kind === 'kpi' ? dialog.record : null}
        options={options} people={people} saving={saving} error={dialogError} onClose={() => setDialog(null)}
        onSave={(p) => void saveRecord('kpis', dialog?.kind === 'kpi' ? dialog.record?.id ?? null : null, p)}
      />
      <MeasurementDialog
        open={dialog?.kind === 'measurement'} kpi={dialog?.kind === 'measurement' ? dialog.record : null}
        options={options} saving={saving} error={dialogError} onClose={() => setDialog(null)}
        onSave={async (p) => {
          if (dialog?.kind !== 'measurement') return
          const result = await run(() => taskService.recordKpiMeasurement(getLaravelContext(), workstreamId, dialog.record.id, p))
          if (result.ok) { setDialog(null); setDialogError('') } else { setDialogError(result.message) }
        }}
      />
      <RiskDialog
        open={dialog?.kind === 'risk'} initial={dialog?.kind === 'risk' ? dialog.record : null}
        options={options} people={people} saving={saving} error={dialogError} onClose={() => setDialog(null)}
        onSave={(p) => void saveRecord('risks', dialog?.kind === 'risk' ? dialog.record?.id ?? null : null, p)}
      />
      <DependencyDialog
        open={dialog?.kind === 'dependency'} initial={dialog?.kind === 'dependency' ? dialog.record : null}
        direction={dialog?.kind === 'dependency' ? dialog.direction : 'UPSTREAM'}
        options={options} saving={saving} error={dialogError} onClose={() => setDialog(null)}
        onSave={(p) => void saveRecord('dependencies', dialog?.kind === 'dependency' ? dialog.record?.id ?? null : null, p)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function SectionHeader({ title, icon: Icon, action }: { title: string; icon: React.ElementType; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
        <Icon className="size-4 text-muted-foreground" /> {title}
      </h2>
      {action}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <span className="flex gap-0.5">
      <Button size="sm" variant="ghost" className="h-7 px-1.5" aria-label="Edit" onClick={onEdit}>
        <Pencil className="size-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-1.5 text-destructive" aria-label="Remove" onClick={onDelete}>
        <Trash2 className="size-3.5" />
      </Button>
    </span>
  )
}

/**
 * Workstream links and free-text requirements in ONE list.
 *
 * They are different tables and the same question: "what does this need?" A
 * reader does not care that a customer sign-off is stored differently from an
 * upstream workstream, so they are not split into two panels.
 */
function DependencyGroup({
  heading, empty, links, linkLabel, external, detail, onOpen, onAdd, onEdit, onDelete,
}: {
  heading: string
  empty: string
  links: WorkstreamDetail['upstream']
  linkLabel: (l: WorkstreamDetail['upstream'][number]) => string
  external: WorkstreamDependency[]
  detail: WorkstreamDetail
  onOpen?: (id: string) => void
  onAdd?: () => void
  onEdit?: (d: WorkstreamDependency) => void
  onDelete?: (d: WorkstreamDependency) => void
}) {
  const total = links.length + external.length

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{heading}</p>
        {onAdd && <SectionAddButton label="Add" onClick={onAdd} />}
      </div>

      {total === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}

      <ul className="space-y-1.5">
        {links.map((l) => {
          const otherId = linkLabel(l)
          return (
            <li key={l.id} className="text-sm">
              <button type="button" onClick={onOpen ? () => onOpen(otherId) : undefined}
                className={cn('text-left', onOpen && 'hover:text-primary hover:underline')}>
                <span className="font-medium text-foreground">{l.label ?? 'Linked workstream'}</span>
                <span className="text-xs text-muted-foreground"> · from the delivery flow</span>
              </button>
            </li>
          )
        })}

        {external.map((d) => (
          <li key={d.id} className="flex items-start justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className={cn(d.is_blocking ? 'font-medium text-destructive' : 'text-foreground')}>{d.description}</span>
              {d.source && <span className="text-xs text-muted-foreground"> · {d.source}</span>}
              {d.is_blocking && <span className="ml-1 text-[11px] font-semibold uppercase tracking-wider text-destructive">Blocking</span>}
            </span>
            {(onEdit || onDelete) && (
              <span className="flex shrink-0 gap-0.5">
                {onEdit && (
                  <Button size="sm" variant="ghost" className="h-6 px-1" aria-label="Edit" onClick={() => onEdit(d)}>
                    <Pencil className="size-3" />
                  </Button>
                )}
                {onDelete && (
                  <Button size="sm" variant="ghost" className="h-6 px-1 text-destructive" aria-label="Remove" onClick={() => onDelete(d)}>
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
