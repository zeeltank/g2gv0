'use client'

/**
 * Add Process.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * FOUR STEPS, AND ONLY THE LAST ONE CHANGES ANYTHING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   Source    pick Module -> Process Group -> Procedure, or paste your own
 *   Process   what was understood — objective, trigger, completion
 *   Workflow  the steps, and which of them are sign-offs
 *   Tasks     who each one is for, then publish
 *
 * Publishing raises REAL tasks in real people's queues. Everything before it is
 * reading and arranging, which is why `convert` stores nothing and the process
 * is saved as a draft until somebody says who the work is for.
 *
 * ── SOURCE'S THREE CASCADING PICKERS MATCH K12'S OWN SCREEN ─────────────────
 *
 * Checked directly against LMS K12's `app/general/add_process/` rather than
 * assumed: Module -> Process Group -> Procedure is exactly its own hierarchy
 * (`lib/process/module-registry.ts` + `sop-catalog.ts`), and — confirmed against
 * K12's backend too — a static registry there as well, not database rows. See
 * `lib/platform/process-templates.ts` for the G2G equivalent. Picking a Procedure
 * loads its text into the textarea below, which stays exactly as free-text
 * editable as it always was — the picker is a starting point, never a constraint.
 *
 * ── WHAT THE PARSER COULD NOT READ IS SHOWN, NOT HIDDEN ─────────────────────
 *
 * `spec.issues` names the lines it skipped. They are rendered as guidance rather
 * than swallowed, because a step nobody parsed is a task nobody will be given —
 * and finding that out after publishing is finding out too late.
 */

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Check, CirclePlus, Loader2, Trash2 } from 'lucide-react'

import { describePlatformError, PlatformApiError } from '@/lib/platform/client'
import {
  convertProcedure,
  createProcess,
  deleteProcess,
  fetchProcesses,
  fetchProcessHistory,
  publishProcess,
  type DerivedTask,
  type ProcessRow,
  type ProcessSpec,
  type ProcessVersion,
} from '@/lib/platform/process'
import { groupsForModule, type ProcessGroup } from '@/lib/platform/process-templates'
import { fetchPlatformRegistry, type PlatformRegistryPayload } from '@/lib/platform/workflow'
import { employeeDirectoryService } from '@/services/organization/employee-directory'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'

import { PanelError, PanelLoading, RefreshButton, StaleNotice } from '../_components/console-parts'
import { ServiceShell } from '../_components/ServiceShell'

const EXAMPLE = `Objective: Onboard a new joiner before their first day
Trigger: An offer is accepted

1. Raise the IT equipment request (IT)
2. Confirm the signed contract is filed (HR)
3. [approval] Approve the seating allocation (Facilities Head)
4. Send the welcome email (HR)

Completion: The joiner has a laptop, a desk and a signed contract`

const inputClass =
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * This organisation's active employees, for a task-assignee picker.
 *
 * Shared by `ProcessBuilder`'s new "4. Tasks" stage and `PublishPanel` — both
 * need the identical list, and duplicating this fetch in two places is exactly
 * the kind of copy that drifts when one of them is edited and the other is not.
 */
function useActiveEmployees(): { id: number; name: string }[] {
  const getContext = useLaravelContext()
  const [people, setPeople] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    let cancelled = false

    const context = getContext()

    if (!isLaravelContextReady(context)) return

    employeeDirectoryService
      .list(context, { status: '1' })
      .then((result) => {
        if (cancelled) return

        const list = (result?.data ?? []) as Array<Record<string, unknown>>

        setPeople(
          list.map((person) => ({
            id: Number(person.id),
            name: String(
              person.full_name ?? person.first_name ?? `User #${String(person.id)}`,
            ).trim(),
          })),
        )
      })
      // Silent: the selects degrade to "nobody chosen", which publishing then
      // refuses with its own message. An error banner here would blame the wrong step.
      .catch(() => {})

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return people
}

/**
 * Per-task assignee pickers — stage "4. Tasks" in `ProcessBuilder`'s creation
 * flow, and the same UI `PublishPanel` uses when revisiting a saved process. One
 * implementation, so the two never drift into looking like different features.
 */
function TaskAssignments({
  tasks,
  people,
  assignments,
  onChange,
}: {
  tasks: DerivedTask[]
  people: { id: number; name: string }[]
  assignments: Record<string, number>
  onChange: (next: Record<string, number>) => void
}) {
  if (tasks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No step in this procedure names who performs it, so there is nothing to raise. Add an
        actor in brackets — <span className="font-mono">(HR)</span> — and read it again.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => (
        <li key={task.ref} className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 text-xs">
            {task.title}
            <span className="ml-1.5 text-[11px] text-muted-foreground">
              ({task.actor}, due in {task.due_in_days}d)
            </span>
          </span>
          <select
            value={assignments[task.ref] ?? ''}
            onChange={(event) =>
              onChange({ ...assignments, [task.ref]: Number(event.target.value) })
            }
            aria-label={`Assignee for ${task.title}`}
            className="h-8 w-56 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Nobody chosen</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </li>
      ))}
    </ul>
  )
}

export default function AddProcessPage() {
  return (
    <Suspense fallback={null}>
      <AddProcessConsole />
    </Suspense>
  )
}

function AddProcessConsole() {
  /** `?module=hrms` etc. — the decentralized tab, pinned to one module. Filtered
      client-side (`fetchProcesses` has no server-side module filter — the saved
      list is small enough per tenant that this costs nothing real). */
  const moduleKey = useSearchParams().get('module')

  const [rows, setRows] = useState<ProcessRow[] | null>(null)
  const [registry, setRegistry] = useState<PlatformRegistryPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchProcesses(), fetchPlatformRegistry()])
      .then(([list, reg]) => {
        if (cancelled) return
        setRows(list.rows)
        setRegistry(reg)
        setError(null)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(describePlatformError(cause, 'The processes could not be loaded.'))
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

  const [draft, setDraft] = useState<{ name: string; module: string; text: string } | null>(null)

  return (
    <ServiceShell slug="add-process">
      <div className="mt-6 space-y-4">
        {error && !rows && <PanelError message={error} onRetry={reload} />}
        {error && rows && <StaleNotice message={error} onRetry={reload} />}
        {loading && !rows && !error && <PanelLoading label="Loading processes…" />}

        {notice && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="size-4 shrink-0" />
            {notice}
          </div>
        )}

        {rows && registry && (() => {
          const scopedRows = moduleKey ? rows.filter((r) => r.module === moduleKey) : rows

          return (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {scopedRows.length} process{scopedRows.length === 1 ? '' : 'es'}.
                {scopedRows.filter((r) => r.status === 'published').length > 0 &&
                  ` ${scopedRows.filter((r) => r.status === 'published').length} published.`}
              </p>
              <div className="flex gap-2">
                <RefreshButton onClick={reload} busy={loading} />
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      name: '',
                      module: moduleKey ?? registry.modules[0]?.key ?? '',
                      text: EXAMPLE,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <CirclePlus className="size-3.5" />
                  New process
                </button>
              </div>
            </div>

            {draft && (
              <ProcessBuilder
                draft={draft}
                modules={registry.modules}
                lockedModule={moduleKey}
                onCancel={() => setDraft(null)}
                onSaved={(message) => {
                  setDraft(null)
                  setNotice(message)
                  reload()
                }}
              />
            )}

            {/* A DECENTRALIZED TAB IS ALREADY PINNED — filtered client-side above.
                Zero for a real module is the honest empty state, not an error;
                every one of G2G's modules has at least one template, though, so
                this is really only ever "nothing SAVED here yet". */}
            {moduleKey && scopedRows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                No process has been saved for this module yet.
              </p>
            ) : (
            <ProcessList
              rows={scopedRows}
              modules={registry.modules}
              onDeleted={() => {
                setNotice('Process deleted. Any tasks it raised are untouched.')
                reload()
              }}
              onPublished={(message) => {
                setNotice(message)
                reload()
              }}
            />
            )}
          </>
          )
        })()}
      </div>
    </ServiceShell>
  )
}

/** Steps 1–3: paste, convert, review. Saving produces a draft. */
function ProcessBuilder({
  draft,
  modules,
  lockedModule,
  onCancel,
  onSaved,
}: {
  draft: { name: string; module: string; text: string }
  modules: PlatformRegistryPayload['modules']
  /** Set from a decentralized tab's `?module=` — this process can only ever be for
      that module, so the picker is fixed rather than offering a choice that would
      just take somebody back to the central hub's process list. */
  lockedModule?: string | null
  onCancel: () => void
  onSaved: (message: string) => void
}) {
  const [form, setForm] = useState(draft)
  const [spec, setSpec] = useState<ProcessSpec | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  /*
   * Stage "4. Tasks" lives in the creation flow itself now, not only in
   * PublishPanel after a save-and-reopen round trip — see the file's own note on
   * why that round trip was the real gap next to K12's continuous flow.
   */
  const people = useActiveEmployees()
  const [assignments, setAssignments] = useState<Record<string, number>>({})

  /*
   * Module -> Process Group -> Procedure, matching LMS K12's own Add Process
   * screen (checked directly against its source, not assumed) — three cascading
   * pickers ahead of the free-text procedure, rather than G2G's previous flat
   * button row. See process-templates.ts for why this stays a static registry,
   * the same choice K12 itself made.
   *
   * Module changing recomputes the group/procedure OPTIONS and defaults the
   * selection to the first of each, but never touches `form.text` — a module
   * change alone must not silently overwrite something already typed. Only
   * picking a PROCEDURE does that, the same as clicking a template button did
   * before this: it is the one deliberate "load this text" action.
   */
  const groups = groupsForModule(form.module)
  const [groupKey, setGroupKey] = useState(groups[0]?.key ?? '')
  const activeGroup: ProcessGroup | undefined = groups.find((g) => g.key === groupKey) ?? groups[0]
  const procedures = activeGroup?.templates ?? []
  const [templateKey, setTemplateKey] = useState(procedures[0]?.key ?? '')

  const changeModule = (module: string) => {
    const nextGroups = groupsForModule(module)
    setForm({ ...form, module })
    setGroupKey(nextGroups[0]?.key ?? '')
    setTemplateKey(nextGroups[0]?.templates[0]?.key ?? '')
  }

  const changeGroup = (key: string) => {
    setGroupKey(key)
    const group = groups.find((g) => g.key === key)
    setTemplateKey(group?.templates[0]?.key ?? '')
  }

  const loadProcedure = (key: string) => {
    setTemplateKey(key)
    const template = procedures.find((t) => t.key === key)
    if (!template) return
    setForm({ ...form, text: template.text })
    // The reading is stale the moment the text changes underneath it, and so are
    // any assignments — they're keyed by task refs the old reading produced.
    setSpec(null)
    setAssignments({})
  }

  const convert = async () => {
    setBusy(true)
    setFormError(null)

    try {
      const result = await convertProcedure(form.text, form.name || undefined)
      setSpec(result.spec)
      // A fresh reading means fresh task refs — any assignments made against a
      // previous reading no longer name anything real.
      setAssignments({})
    } catch (cause: unknown) {
      setFormError(cause instanceof PlatformApiError ? cause.message : describePlatformError(cause))
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    setFormError(null)

    try {
      await createProcess({
        name: form.name || spec?.name || 'Untitled procedure',
        module: form.module,
        source_text: form.text,
      })
      onSaved('Process saved as a draft. Assign its tasks to publish them.')
    } catch (cause: unknown) {
      setFormError(cause instanceof PlatformApiError ? cause.message : describePlatformError(cause))
    } finally {
      setBusy(false)
    }
  }

  /*
   * "Save & Publish" — creates the draft, then immediately publishes it with
   * whatever assignments were made, in one click. This is what closes the real
   * gap next to K12: before this, Tasks and Publish only existed after saving,
   * closing the builder, and reopening the new row from the list below.
   *
   * The two steps are NOT one transaction from the caller's point of view: if
   * create succeeds and publish fails (nobody assigned, an inactive employee,
   * a network blip), the process IS saved — the message says so, the same rule
   * already used on the employee form's custom-fields save, rather than leaving
   * someone to think nothing happened and re-do work that already exists.
   */
  const saveAndPublish = async () => {
    setBusy(true)
    setFormError(null)

    let createdId: number
    try {
      const created = await createProcess({
        name: form.name || spec?.name || 'Untitled procedure',
        module: form.module,
        source_text: form.text,
      })
      createdId = created.id
    } catch (cause: unknown) {
      setFormError(cause instanceof PlatformApiError ? cause.message : describePlatformError(cause))
      setBusy(false)
      return
    }

    try {
      const result = await publishProcess(createdId, assignments)
      const parts: string[] = []

      if (result.created.length > 0) {
        parts.push(
          `${result.created.length} task${result.created.length === 1 ? '' : 's'} raised.`,
        )
      }
      if (result.problems.length > 0) {
        parts.push(result.problems.join(' '))
      }

      onSaved(
        parts.length > 0
          ? `Process saved. ${parts.join(' ')}`
          : 'Process saved as a draft. Choose an assignee for at least one task, then publish it from the list below.',
      )
    } catch (cause: unknown) {
      onSaved(
        `Process saved as a draft, but publishing failed: ${
          cause instanceof PlatformApiError ? cause.message : describePlatformError(cause)
        } Publish it from the list below once fixed.`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-card-foreground">New process</h2>

      {formError && (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Name</span>
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Taken from the objective if left empty"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Module{lockedModule && ' (this module’s own tab)'}
          </span>
          <select
            value={form.module}
            disabled={!!lockedModule}
            onChange={(event) => changeModule(event.target.value)}
            className={inputClass}
          >
            {modules.map((moduleOption) => (
              <option key={moduleOption.key} value={moduleOption.key}>
                {moduleOption.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Module -> Process Group -> Procedure, matching K12's own cascading pickers.
          Reduces the blank-page start every process used to have, without changing
          what "Read it" does: a procedure is exactly the text the textarea would
          otherwise hold, run through the same parser as anything pasted by hand. */}
      {groups.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Process group
            </span>
            <select value={groupKey} onChange={(event) => changeGroup(event.target.value)} className={inputClass}>
              {groups.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Procedure — loads its text below
            </span>
            <select
              value={templateKey}
              onChange={(event) => loadProcedure(event.target.value)}
              disabled={procedures.length === 0}
              className={inputClass}
            >
              {procedures.length === 0 && <option value="">No procedures in this group</option>}
              {procedures.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
          The procedure
        </span>
        <textarea
          value={form.text}
          onChange={(event) => {
            setForm({ ...form, text: event.target.value })
            // The reading is stale the moment the text changes. Keeping it would
            // show steps the procedure no longer contains, and any assignments
            // against it would name refs a fresh reading may not produce again.
            setSpec(null)
            setAssignments({})
          }}
          rows={12}
          className={`${inputClass} font-mono text-xs`}
        />
        <span className="mt-1 block text-[11px] text-muted-foreground">
          Number the steps, or start them with a dash. Put who does it in brackets at the end —
          <span className="font-mono"> (HR)</span>. Mark a sign-off with
          <span className="font-mono"> [approval]</span>.
        </span>
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={convert}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          Read it
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || spec === null}
          title={spec === null ? 'Read the procedure first' : undefined}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          Save as draft
        </button>
        <button
          type="button"
          onClick={saveAndPublish}
          disabled={busy || spec === null}
          title={spec === null ? 'Read the procedure first' : undefined}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          Save &amp; Publish
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </button>
      </div>

      {/*
        Stages 2–4, all visible in this same sitting right after "Read it" —
        Process, Workflow and Tasks, matching K12's own numbered sections rather
        than G2G's previous merged review with no Tasks stage at all.
      */}
      {spec && (
        <div className="mt-5 space-y-5 border-t border-border pt-4">
          <ProcessReview spec={spec} />
          <WorkflowReview spec={spec} />

          <div>
            <h3 className="text-xs font-semibold text-card-foreground">
              4. Tasks{' '}
              <span className="font-normal text-muted-foreground">
                — who each one is for
              </span>
            </h3>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Publishing creates real tasks in the assigned people&rsquo;s queues.
              Leaving a task unassigned just skips it — you can assign the rest later
              from the list below.
            </p>
            <div className="mt-2">
              <TaskAssignments
                tasks={spec.tasks}
                people={people}
                assignments={assignments}
                onChange={setAssignments}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/** Stage "2. Process" — what was understood: objective, trigger, completion. */
function ProcessReview({ spec }: { spec: ProcessSpec }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-card-foreground">2. Process</h3>
      <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
        {[
          ['Objective', spec.objective],
          ['Trigger', spec.trigger],
          ['Completion', spec.completion],
        ].map(([label, value]) => (
          <div key={label as string}>
            <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 leading-5 text-foreground">
              {value ?? <span className="text-muted-foreground/60">Not stated</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Stage "3. Workflow" — the steps, which are sign-offs, and what could not be read. */
function WorkflowReview({ spec }: { spec: ProcessSpec }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-card-foreground">3. Workflow</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Steps ({spec.steps.length}) — {spec.tasks.length} become tasks
      </p>
      <ul className="mt-2 space-y-1">
        {spec.steps.map((step) => (
          <li key={step.order} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] tabular-nums text-muted-foreground">
              {step.order}
            </span>
            <span className="min-w-0 flex-1">
              {step.text}
              {step.is_approval && (
                <span className="ml-1.5 rounded border border-primary/30 bg-primary/10 px-1 py-0.5 text-[10px] text-primary">
                  sign-off
                </span>
              )}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {/* A step with no actor raises no task, and the row says so rather
                  than leaving somebody to notice the count does not match. */}
              {step.actor ?? <span className="text-muted-foreground/60">nobody named</span>}
            </span>
          </li>
        ))}
      </ul>

      {spec.issues.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3.5" />
            {spec.issues.length} line{spec.issues.length === 1 ? '' : 's'} were not read as steps
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {spec.issues.map((issue) => (
              <li key={issue} className="text-[11px] leading-4 text-muted-foreground">
                {issue}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            These raise no tasks. Number them or start them with a dash if they should.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * The saved processes, grouped by module, and step 4 — assigning and publishing.
 *
 * K12 effectively partitions processes by module through separate per-module nav
 * entry points (a "Process Builder" tab on each module's own bar). G2G keeps one
 * centralised screen — Platform Services items are deliberately not scattered
 * across every module's navigation — so the equivalent here is grouping the list
 * itself, rather than building seven entry points to get the same partitioning.
 */
function ProcessList({
  rows,
  modules,
  onDeleted,
  onPublished,
}: {
  rows: ProcessRow[]
  modules: PlatformRegistryPayload['modules']
  onDeleted: () => void
  onPublished: (message: string) => void
}) {
  const [open, setOpen] = useState<number | null>(null)
  const [historyFor, setHistoryFor] = useState<number | null>(null)
  const [historyVersions, setHistoryVersions] = useState<ProcessVersion[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const toggleHistory = async (row: ProcessRow) => {
    if (historyFor === row.id) {
      setHistoryFor(null)
      return
    }

    setHistoryFor(row.id)
    setHistoryVersions(null)
    setHistoryError(null)
    setHistoryLoading(true)

    try {
      const { versions } = await fetchProcessHistory(row.id)
      setHistoryVersions(versions)
    } catch (cause: unknown) {
      setHistoryError(describePlatformError(cause, 'The history could not be loaded.'))
    } finally {
      setHistoryLoading(false)
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No processes yet. Paste a written procedure and it will be read into steps and tasks.
      </div>
    )
  }

  /*
   * Grouped by module, in the module registry's own order — the same order the
   * Module dropdown offers them in — with any row naming a module the registry no
   * longer declares falling in after, labelled by its raw key rather than dropped.
   * A tenant with processes in 2 of 7 modules sees 2 headings, not 7 — an empty
   * module heading is clutter, not information.
   */
  const moduleLabel = (key: string) => modules.find((m) => m.key === key)?.label ?? key
  const orderedModuleKeys = [
    ...modules.map((m) => m.key).filter((key) => rows.some((r) => r.module === key)),
    ...Array.from(new Set(rows.map((r) => r.module))).filter(
      (key) => !modules.some((m) => m.key === key),
    ),
  ]

  return (
    <div className="space-y-5">
      {orderedModuleKeys.map((moduleKey) => {
        const moduleRows = rows.filter((r) => r.module === moduleKey)

        return (
          <div key={moduleKey}>
            <h3 className="mb-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              {moduleLabel(moduleKey)}{' '}
              <span className="font-normal normal-case text-muted-foreground/70">
                ({moduleRows.length})
              </span>
            </h3>

            <div className="space-y-2">
              {moduleRows.map((row) => (
                <div key={row.id} className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpen(open === row.id ? null : row.id)}
                      className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block text-sm font-medium text-card-foreground">{row.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {row.spec.steps?.length ?? 0} steps,{' '}
                        {row.spec.tasks?.length ?? 0} task{row.spec.tasks?.length === 1 ? '' : 's'}
                      </span>
                    </button>

                    {/* What it has ACTUALLY raised, which is the thing K-12 forgets — and now
                        how much of that is actually done, joined through to the real task
                        table rather than a status this document keeps on its own. */}
                    {row.status === 'published' ? (
                      <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {row.completed_tasks ?? 0} of {row.published_tasks} task
                        {row.published_tasks === 1 ? '' : 's'} done
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        Draft — nothing raised
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleHistory(row)}
                      className="shrink-0 rounded border border-border px-2 py-0.5 text-[11px] transition-colors hover:bg-muted"
                    >
                      History
                    </button>
                  </div>

                  {historyFor === row.id && (
                    <div className="border-t border-border bg-muted/20 px-4 py-3">
                      {historyLoading && (
                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Loader2 className="size-3 animate-spin" />
                          Loading history…
                        </p>
                      )}
                      {historyError && <p className="text-[11px] text-destructive">{historyError}</p>}
                      {historyVersions && historyVersions.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          No prior edits recorded — this is the only version.
                        </p>
                      )}
                      {historyVersions && historyVersions.length > 0 && (
                        <ul className="space-y-2">
                          {historyVersions.map((version) => (
                            <li key={version.id} className="rounded-md border border-border bg-card p-2.5">
                              <p className="text-[11px] text-muted-foreground">
                                {version.created_at ? new Date(version.created_at).toLocaleString() : '—'}
                                {version.changed_by && ` · ${version.changed_by}`}
                              </p>
                              <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">
                                {version.source_text}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {open === row.id && (
                    <PublishPanel row={row} onDeleted={onDeleted} onPublished={onPublished} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PublishPanel({
  row,
  onDeleted,
  onPublished,
}: {
  row: ProcessRow
  onDeleted: () => void
  onPublished: (message: string) => void
}) {
  const people = useActiveEmployees()
  const [assignments, setAssignments] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const publish = async () => {
    setBusy(true)
    setProblem(null)

    try {
      const result = await publishProcess(row.id, assignments)

      if (result.problems.length > 0) {
        setProblem(result.problems.join(' '))
      }

      if (result.created.length > 0) {
        onPublished(
          `${result.created.length} task${result.created.length === 1 ? '' : 's'} raised.`,
        )
      } else if (result.problems.length === 0) {
        setProblem('Everything here has already been raised.')
      }
    } catch (cause: unknown) {
      setProblem(cause instanceof PlatformApiError ? cause.message : describePlatformError(cause))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (
      !window.confirm(
        `Delete "${row.name}"? Any tasks it already raised stay in people's queues — they are real work, and removing the document they came from must not remove them.`,
      )
    ) {
      return
    }

    try {
      await deleteProcess(row.id)
      onDeleted()
    } catch (cause: unknown) {
      setProblem(describePlatformError(cause))
    }
  }

  const tasks = row.spec.tasks ?? []

  return (
    <div className="border-t border-border bg-muted/20 px-4 py-3">
      {problem && (
        <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {problem}
        </p>
      )}

      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No step in this procedure names who performs it, so there is nothing to raise. Add an
          actor in brackets — <span className="font-mono">(HR)</span> — and save it again.
        </p>
      ) : (
        <>
          <p className="text-xs font-semibold text-card-foreground">Who is each task for?</p>
          <div className="mt-2">
            <TaskAssignments
              tasks={tasks}
              people={people}
              assignments={assignments}
              onChange={setAssignments}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={publish}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Loader2 className="size-3 animate-spin" />}
              {row.status === 'published' ? 'Raise anything outstanding' : 'Publish'}
            </button>
            <button
              type="button"
              onClick={remove}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Trash2 className="size-3 text-destructive" />
              Delete
            </button>
          </div>

          {/* Said before the click, not after: this is the one control here that
              puts work in other people's queues. */}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Publishing creates real tasks in the assigned people&rsquo;s queues. Publishing twice
            raises nothing extra — anything already created is recognised and skipped.
          </p>
        </>
      )}
    </div>
  )
}
