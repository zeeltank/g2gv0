'use client'

/**
 * The Workflow console.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SCREEN IS A LIST OF POINTS, NOT A LIST OF CHAINS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The obvious design is a table of the approval chains an organisation has configured.
 * It answers the wrong question. What an administrator comes here to find out is which
 * of the platform's approvals have NOBODY signing them off — and a list of the
 * configured ones cannot show an absence.
 *
 * So every point the platform declares is listed, most of them with no chain, and the
 * empty ones are the finding rather than the filler.
 *
 * `governed` counts points with at least one ACTIVE chain. A draft governs nothing, and
 * counting drafts would produce exactly the flattering number that hides the gap.
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'

import { describePlatformError, PlatformApiError } from '@/lib/platform/client'
import {
  createWorkflow,
  deleteWorkflow,
  fetchPlatformRegistry,
  fetchWorkflowPoints,
  updateWorkflow,
  type PlatformRegistryPayload,
  type WorkflowChain,
  type WorkflowPayload,
  type WorkflowPoint,
  type WorkflowStatus,
  type WorkflowStep,
} from '@/lib/platform/workflow'
import { StatusChip } from '@/components/shared/console-ui'

import { PanelError, PanelLoading, RefreshButton, StaleNotice } from '../_components/console-parts'
import { ServiceShell } from '../_components/ServiceShell'
import { emptyStep, StepEditor, type DraftStep } from './_components/StepEditor'

interface ChainForm {
  id: number | null
  flow_key: string
  name: string
  description: string
  condition: string
  status: WorkflowStatus
  steps: DraftStep[]
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function WorkflowPage() {
  const [data, setData] = useState<WorkflowPayload | null>(null)
  const [registry, setRegistry] = useState<PlatformRegistryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)

  const [open, setOpen] = useState<Set<string>>(new Set())
  /** null = closed. The house form pattern: an inline card, not a modal. */
  const [form, setForm] = useState<ChainForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchWorkflowPoints(), fetchPlatformRegistry()])
      .then(([points, reg]) => {
        if (cancelled) return
        setData(points)
        setRegistry(reg)
        setError(null)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(describePlatformError(cause, 'The workflow points could not be loaded.'))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const reload = useCallback(() => {
    setLoading(true)
    setToken((value) => value + 1)
  }, [])

  const toggle = (key: string) => {
    setOpen((current) => {
      const next = new Set(current)

      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      return next
    })
  }

  const startNew = (point: WorkflowPoint) => {
    setFormError(null)
    setForm({
      id: null,
      flow_key: point.key,
      name: point.label,
      description: '',
      condition: '',
      // Draft by default, matching the server. Nothing starts intercepting real
      // records the moment somebody experiments.
      status: 'draft',
      steps: point.suggested_steps.length > 0 ? point.suggested_steps.map(toDraft) : [emptyStep()],
    })
  }

  const startEdit = (chain: WorkflowChain) => {
    setFormError(null)
    setForm({
      id: chain.id,
      flow_key: chain.flow_key,
      name: chain.name,
      description: chain.description ?? '',
      condition: chain.condition,
      status: chain.status,
      steps: chain.steps.map(toDraft),
    })
  }

  const save = async () => {
    if (!form) return

    setSaving(true)
    setFormError(null)

    try {
      const payload = {
        flow_key: form.flow_key,
        name: form.name,
        description: form.description,
        condition: form.condition,
        status: form.status,
        steps: form.steps,
      }

      if (form.id === null) {
        await createWorkflow(payload)
      } else {
        await updateWorkflow(form.id, payload)
      }

      setForm(null)
      setNotice(form.id === null ? 'Workflow created.' : 'Workflow saved.')
      reload()
    } catch (cause: unknown) {
      // Validation is server-side only, and its messages are written as instructions
      // rather than as field errors — "Step 3: set an SLA, or there is nothing for
      // Escalate to happen after" is the whole guidance, so it is shown verbatim.
      setFormError(
        cause instanceof PlatformApiError ? cause.message : describePlatformError(cause),
      )
    } finally {
      setSaving(false)
    }
  }

  const remove = async (chain: WorkflowChain) => {
    if (!window.confirm(`Delete "${chain.name}"? Approvals already in flight are not affected.`)) {
      return
    }

    try {
      await deleteWorkflow(chain.id)
      setNotice('Workflow deleted.')
      reload()
    } catch (cause: unknown) {
      setError(describePlatformError(cause))
    }
  }

  return (
    <ServiceShell slug="workflow">
      <div className="mt-6 space-y-4">
        {error && !data && <PanelError message={error} onRetry={reload} />}
        {error && data && <StaleNotice message={error} onRetry={reload} />}
        {loading && !data && !error && <PanelLoading label="Loading workflow points…" />}

        {registry && registry.problems.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4" />
              The platform registry is inconsistent ({registry.problems.length})
            </p>
            <ul className="mt-2 space-y-1">
              {registry.problems.map((problem) => (
                <li key={problem} className="text-xs leading-5 text-foreground">
                  {problem}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Fix these in <span className="font-mono">config/platform_services.php</span>.
            </p>
          </div>
        )}

        {notice && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="size-4 shrink-0" />
            {notice}
          </div>
        )}

        {data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* The headline is what is ENFORCED, not what is configured.
                  "1 of 8 points is enforced" is the true statement; "3 of 8 are
                  governed" was not, because five of those three were chains
                  nothing reads. */}
              <p className="text-sm text-muted-foreground">
                {data.summary.enforced_governed} of {data.summary.enforced_points} enforced approval
                point{data.summary.enforced_points === 1 ? '' : 's'}{' '}
                {data.summary.enforced_governed === 1 ? 'has' : 'have'} an active workflow.
                {data.summary.points > data.summary.enforced_points && (
                  <>
                    {' '}
                    {data.summary.points - data.summary.enforced_points} further point
                    {data.summary.points - data.summary.enforced_points === 1 ? ' is' : 's are'}{' '}
                    declared but not yet read by anything.
                  </>
                )}
              </p>
              <RefreshButton onClick={reload} busy={loading} />
            </div>

            {/* The form sits above the list, as an inline card rather than a modal —
                the house pattern for every create/edit in this product. */}
            {form && registry && (
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-card-foreground">
                  {form.id === null ? 'New workflow' : 'Edit workflow'}
                  <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                    {form.flow_key}
                  </span>
                </h2>

                {formError && (
                  <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {formError}
                  </p>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      Name
                    </span>
                    <input
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      Status
                    </span>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm({ ...form, status: event.target.value as WorkflowStatus })
                      }
                      className={inputClass}
                    >
                      <option value="draft">Draft — governs nothing</option>
                      <option value="active">Active — intercepts matching records</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      Applies when (leave empty to always apply)
                    </span>
                    <input
                      value={form.condition}
                      onChange={(event) => setForm({ ...form, condition: event.target.value })}
                      placeholder="days &gt; 5"
                      className={inputClass}
                    />
                  </label>
                </div>

                <h3 className="mt-5 mb-2 text-xs font-semibold text-card-foreground">
                  Approval steps
                </h3>
                <StepEditor
                  steps={form.steps}
                  approverTypes={registry.approver_types}
                  escalationActions={registry.escalation_actions}
                  onChange={(steps) => setForm({ ...form, steps })}
                />

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="size-3.5 animate-spin" />}
                    {saving ? 'Saving…' : 'Save workflow'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(null)}
                    className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            )}

            <div className="space-y-2">
              {data.points.map((point) => (
                <PointRow
                  key={point.key}
                  point={point}
                  expanded={open.has(point.key)}
                  onToggle={() => toggle(point.key)}
                  onAdd={() => startNew(point)}
                  onEdit={startEdit}
                  onDelete={remove}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </ServiceShell>
  )
}

function PointRow({
  point,
  expanded,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
}: {
  point: WorkflowPoint
  expanded: boolean
  onToggle: () => void
  onAdd: () => void
  onEdit: (chain: WorkflowChain) => void
  onDelete: (chain: WorkflowChain) => void
}) {
  const governed = point.workflows.some((chain) => chain.status === 'active')

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0">
            <span className="block text-sm font-medium text-card-foreground">{point.label}</span>
            <span className="block font-mono text-[11px] text-muted-foreground">{point.key}</span>
          </span>
        </button>

        {/*
          THREE STATES, NOT TWO.

          A point nothing reads is neither governed nor ungoverned — a chain there
          is a plan. Showing it the same way as an enforced point is the claim this
          screen used to make and could not keep.
        */}
        {!point.enforced ? (
          <span
            className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            title="Nothing in the product reads a chain saved here yet."
          >
            Not enforced
          </span>
        ) : governed ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {point.workflows.length} workflow{point.workflows.length === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            {point.workflows.length === 0 ? 'No workflow' : 'No active workflow'}
          </span>
        )}

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="size-3" />
          Add
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <p className="text-xs leading-5 text-muted-foreground">{point.description}</p>

          {/* What enforcement actually means here, from the registry. On the one
              enforced point this carries the warning that matters: editing a chain
              does not change requests already in flight. */}
          {point.enforced && point.enforced_note && (
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{point.enforced_note}</p>
          )}

          {!point.enforced ? (
            /*
             * The honest sentence for an unenforced point.
             *
             * The old copy said "they proceed without approval", which was true
             * here and ALSO true of a point with an active chain — so it told the
             * reader nothing and implied the opposite about the chains above it.
             */
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Nothing in the product pauses {point.subject.toLowerCase()}s for a sign-off yet. A
              chain saved here is a plan, not a gate — it can be kept as a draft, and it will take
              effect when this point is wired up.
            </p>
          ) : point.workflows.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Nothing signs off {point.subject.toLowerCase()}s here — they proceed without approval.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {point.workflows.map((chain) => (
                <li
                  key={chain.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-card-foreground">{chain.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {chain.step_count} step{chain.step_count === 1 ? '' : 's'}
                      {chain.total_sla_hours > 0 && ` — up to ${chain.total_sla_hours}h`}
                      {chain.condition ? ` — when ${chain.condition}` : ' — always applies'}
                    </p>
                    {/* Why this chain is not the one in force. Without it, two
                        identical-looking active chains differ only in an invisible
                        precedence rule, and editing the wrong one changes nothing. */}
                    {chain.ineffective_reason && (
                      <p className="mt-1 text-[11px] leading-4 text-amber-600 dark:text-amber-400">
                        {chain.ineffective_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <StatusChip
                      status={chain.status === 'active' ? 'live' : 'coming-soon'}
                      size="sm"
                    />
                    <button
                      type="button"
                      onClick={() => onEdit(chain)}
                      className="rounded border border-border px-2 py-0.5 text-[11px] transition-colors hover:bg-muted"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(chain)}
                      aria-label={`Delete ${chain.name}`}
                      className="rounded border border-border p-1 transition-colors hover:bg-muted"
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * A stored or suggested step as the editor's draft shape.
 *
 * Takes `WorkflowStep` rather than a loose record: both callers pass one, and the
 * loose signature only looked more permissive — it made the array `.map()` calls
 * fail to typecheck while appearing to accept anything.
 */
function toDraft(step: WorkflowStep): DraftStep {
  return {
    id: step.id,
    name: step.name ?? '',
    approver_type: step.approver_type ?? 'reporting_manager',
    approver: step.approver ?? '',
    sla_hours: Number(step.sla_hours ?? 0),
    on_breach: step.on_breach ?? 'none',
    allow_delegate: step.allow_delegate ?? true,
    require_comment: step.require_comment ?? false,
  }
}
