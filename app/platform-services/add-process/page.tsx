'use client'

/**
 * Add Process.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * FOUR STEPS, AND ONLY THE LAST ONE CHANGES ANYTHING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   Source    paste the procedure, pick the module
 *   Process   what was understood — objective, trigger, completion
 *   Workflow  the steps, and which of them are sign-offs
 *   Tasks     who each one is for, then publish
 *
 * Publishing raises REAL tasks in real people's queues. Everything before it is
 * reading and arranging, which is why `convert` stores nothing and the process
 * is saved as a draft until somebody says who the work is for.
 *
 * ── WHAT THE PARSER COULD NOT READ IS SHOWN, NOT HIDDEN ─────────────────────
 *
 * `spec.issues` names the lines it skipped. They are rendered as guidance rather
 * than swallowed, because a step nobody parsed is a task nobody will be given —
 * and finding that out after publishing is finding out too late.
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, CirclePlus, Loader2, Trash2 } from 'lucide-react'

import { describePlatformError, PlatformApiError } from '@/lib/platform/client'
import {
  convertProcedure,
  createProcess,
  deleteProcess,
  fetchProcesses,
  publishProcess,
  type ProcessRow,
  type ProcessSpec,
} from '@/lib/platform/process'
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

export default function AddProcessPage() {
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

        {rows && registry && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {rows.length} process{rows.length === 1 ? '' : 'es'}.
                {rows.filter((r) => r.status === 'published').length > 0 &&
                  ` ${rows.filter((r) => r.status === 'published').length} published.`}
              </p>
              <div className="flex gap-2">
                <RefreshButton onClick={reload} busy={loading} />
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ name: '', module: registry.modules[0]?.key ?? '', text: EXAMPLE })
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
                onCancel={() => setDraft(null)}
                onSaved={(message) => {
                  setDraft(null)
                  setNotice(message)
                  reload()
                }}
              />
            )}

            <ProcessList
              rows={rows}
              onDeleted={() => {
                setNotice('Process deleted. Any tasks it raised are untouched.')
                reload()
              }}
              onPublished={(message) => {
                setNotice(message)
                reload()
              }}
            />
          </>
        )}
      </div>
    </ServiceShell>
  )
}

/** Steps 1–3: paste, convert, review. Saving produces a draft. */
function ProcessBuilder({
  draft,
  modules,
  onCancel,
  onSaved,
}: {
  draft: { name: string; module: string; text: string }
  modules: PlatformRegistryPayload['modules']
  onCancel: () => void
  onSaved: (message: string) => void
}) {
  const [form, setForm] = useState(draft)
  const [spec, setSpec] = useState<ProcessSpec | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const convert = async () => {
    setBusy(true)
    setFormError(null)

    try {
      const result = await convertProcedure(form.text, form.name || undefined)
      setSpec(result.spec)
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
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Module</span>
          <select
            value={form.module}
            onChange={(event) => setForm({ ...form, module: event.target.value })}
            className={inputClass}
          >
            {modules.map((module) => (
              <option key={module.key} value={module.key}>
                {module.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
          The procedure
        </span>
        <textarea
          value={form.text}
          onChange={(event) => {
            setForm({ ...form, text: event.target.value })
            // The reading is stale the moment the text changes. Keeping it would
            // show steps the procedure no longer contains.
            setSpec(null)
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
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Save as draft
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </button>
      </div>

      {spec && <SpecReview spec={spec} />}
    </section>
  )
}

/** Steps 2 and 3: what was understood, and what could not be read. */
function SpecReview({ spec }: { spec: ProcessSpec }) {
  return (
    <div className="mt-5 space-y-4 border-t border-border pt-4">
      <dl className="grid gap-2 text-xs sm:grid-cols-3">
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

      <div>
        <p className="text-xs font-semibold text-card-foreground">
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
      </div>

      {spec.issues.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
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

/** The saved processes, and step 4 — assigning and publishing. */
function ProcessList({
  rows,
  onDeleted,
  onPublished,
}: {
  rows: ProcessRow[]
  onDeleted: () => void
  onPublished: (message: string) => void
}) {
  const [open, setOpen] = useState<number | null>(null)

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No processes yet. Paste a written procedure and it will be read into steps and tasks.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setOpen(open === row.id ? null : row.id)}
              className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block text-sm font-medium text-card-foreground">{row.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {row.module} — {row.spec.steps?.length ?? 0} steps,{' '}
                {row.spec.tasks?.length ?? 0} task{row.spec.tasks?.length === 1 ? '' : 's'}
              </span>
            </button>

            {/* What it has ACTUALLY raised, which is the thing K-12 forgets. */}
            {row.status === 'published' ? (
              <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {row.published_tasks} task{row.published_tasks === 1 ? '' : 's'} raised
              </span>
            ) : (
              <span className="shrink-0 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                Draft — nothing raised
              </span>
            )}
          </div>

          {open === row.id && (
            <PublishPanel row={row} onDeleted={onDeleted} onPublished={onPublished} />
          )}
        </div>
      ))}
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
  const getContext = useLaravelContext()
  const [people, setPeople] = useState<{ id: number; name: string }[]>([])
  const [assignments, setAssignments] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

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
      // Silent: the selects degrade to "nobody chosen", which the publish then
      // refuses with its own message. An error banner here would blame the wrong step.
      .catch(() => {})

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          <ul className="mt-2 space-y-2">
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
                    setAssignments({ ...assignments, [task.ref]: Number(event.target.value) })
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
