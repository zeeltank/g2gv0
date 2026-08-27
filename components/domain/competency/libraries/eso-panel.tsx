'use client'

/**
 * The ESO panels on a job role task — Governance and Evidence (§6.3).
 *
 * `TaskExecutionPanel` says how much of this task a machine could take.
 * These say what the procedure actually IS: what must be in place while it runs
 * (Governance) and what it produces for the capability record (Evidence).
 *
 * ── WHAT THESE REFUSE TO DO ─────────────────────────────────────────────────
 *
 * They never render empty when no ESO exists. "No controls listed" and "no ESO
 * has been written for this task" are different facts, and the second one has a
 * next action attached to it. An empty panel invites the reader to conclude
 * there are no controls, which is the opposite of true.
 *
 * They never present a generated draft as an agreed procedure. An `ai-generated`
 * ESO that nobody has reviewed is labelled as such in words, next to its
 * content, not just in a badge colour.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Ban, Check, FileText, Shield, Sparkles, Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { ACTOR_LABEL, ACTOR_STYLE, STATUS_STYLE, esoService } from '@/services/competency/eso'
import type { EsoRecord } from '@/services/competency/eso'
import { MODE_LABEL } from '@/services/competency/task-execution'
import type { ExecutionMode } from '@/services/competency/task-execution'
import { describeFailure } from '../load-state'

export type EsoSection = 'governance' | 'evidence'

export function EsoPanel({ taskId, section }: { taskId: number; section: EsoSection }) {
  const [eso, setEso] = useState<EsoRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setLoading(false)
      setError('You are not signed in, so this cannot be loaded.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await esoService.list(context, { task_id: taskId })
      // `eso` stays null when there is none — that is the state the panels
      // are built to distinguish, so it must not become an empty record.
      setEso(response.data?.[0] ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the execution model.')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    queueMicrotask(() => { load() })
  }, [load])

  const generate = async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await esoService.generate(context, taskId)
      setNotice(response.message ?? 'A draft was generated.')
      await load()
    } catch (genError) {
      setError(genError instanceof Error ? genError.message : 'The draft could not be generated.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (error && !eso) {
    const { title, description } = describeFailure(error)
    return <ErrorState title={title} description={description} retry={load} />
  }

  /* ── NO ESO AT ALL ─────────────────────────────────────────────────────
     Said in words, with the action attached. Rendering an empty controls list
     here would read as "this task has no controls", which is a claim nobody
     has made. */
  if (!eso) {
    return (
      <div className="space-y-4">
        {error && <InlineError message={error} />}
        <EmptyState
          className="border-0"
          icon={<Workflow className="h-8 w-8" />}
          title="No execution model has been written for this task"
          description={
            section === 'governance'
              ? 'Governance shows the controls that must be in place and the things that must never '
                + 'happen while this task is performed. None of that is recorded yet — this is not the '
                + 'same as saying there are no controls.'
              : 'Evidence shows what performing this task produces for the capability record. '
                + 'Nothing is recorded yet, so nothing can be claimed from doing this work.'
          }
        />
        <div className="flex justify-center">
          <Button onClick={generate} disabled={busy} className="h-9 gap-2 rounded-lg font-bold">
            <Sparkles className="h-4 w-4" />
            {busy ? 'Generating…' : 'Generate a draft with AI'}
          </Button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          A generated draft is a starting point for a person, not a procedure to follow.
        </p>
      </div>
    )
  }

  const unreviewed = eso.source === 'ai-generated' && eso.status === 'Draft'

  return (
    <div className="space-y-4">
      {error && <InlineError message={error} />}
      {notice && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {notice}
        </p>
      )}

      {/* Which ESO this is, and whether anyone has stood behind it */}
      <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Execution model · v{eso.version}
            </p>
            <p className="text-base font-black leading-tight text-foreground">{eso.title}</p>
            {eso.execution_mode && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Written for <strong>{MODE_LABEL[eso.execution_mode as ExecutionMode] ?? eso.execution_mode}</strong>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-bold', STATUS_STYLE[eso.status])}>
              {eso.status}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
              {eso.fields_filled}/{eso.fields_total} fields
            </span>
          </div>
        </div>

        {unreviewed && (
          /* IN WORDS, not just a badge. The content below reads as a procedure
             whether or not anybody checked it. */
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Written by {eso.model ?? 'AI'} and not reviewed by anyone. Treat it as a first draft —
              it cannot be published until a person has read it.
            </span>
          </p>
        )}
      </div>

      {section === 'governance' ? <Governance eso={eso} /> : <Evidence eso={eso} />}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Governance — §5.16-17, plus the steps that give them context
 * ------------------------------------------------------------------ */

function Governance({ eso }: { eso: EsoRecord }) {
  return (
    <>
      <Panel
        icon={<Shield className="h-4 w-4" />}
        title="Required controls"
        hint="What must be in place while this task is performed"
        empty="No controls are recorded on this execution model."
        items={eso.required_controls}
      />

      {/* PROHIBITED FIRST-CLASS, not a footnote. The document calls it out
          separately from controls because "what must never happen" is the part
          people skip, and it is the part that matters when something goes wrong. */}
      <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Ban className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">Prohibited actions</p>
            <p className="text-[11px] text-muted-foreground">Things that must never happen while doing this task</p>
          </div>
        </div>
        {eso.prohibited_actions.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Nothing is recorded. That is worth fixing — an execution model with no prohibitions
            has not been thought through.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {eso.prohibited_actions.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Panel
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Escalation triggers"
        hint="Conditions where execution must stop and hand over to a person"
        empty="No escalation triggers are recorded."
        items={eso.escalation_triggers}
      />

      <Panel
        icon={<Check className="h-4 w-4" />}
        title="Human decision points"
        hint="Where a person must decide, whatever else is automated"
        empty="No decision points are recorded."
        items={eso.human_decision_points}
      />

      {/* The steps, because a control means little without the sequence it guards */}
      {eso.steps.length > 0 && (
        <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            The procedure
          </p>
          <ol className="mt-3 space-y-2.5">
            {eso.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-black tabular-nums text-muted-foreground">
                  {step.seq ?? i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-foreground">{step.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {step.actor && (
                      <span className={cn(
                        'rounded-full border px-1.5 py-0.5 text-[10px] font-bold',
                        ACTOR_STYLE[step.actor] ?? 'border-border bg-muted text-muted-foreground',
                      )}>
                        {ACTOR_LABEL[step.actor] ?? step.actor}
                      </span>
                    )}
                    {step.tool && <span className="text-[10px] text-muted-foreground">via {step.tool}</span>}
                    {step.output && <span className="text-[10px] text-muted-foreground">→ {step.output}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Evidence — §5.18, the link back to the capability engine
 * ------------------------------------------------------------------ */

function Evidence({ eso }: { eso: EsoRecord }) {
  return (
    <>
      <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">Evidence emitted</p>
            <p className="text-[11px] text-muted-foreground">
              What performing this task proves about capability
            </p>
          </div>
        </div>

        {eso.evidence_emitted.length === 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              Nothing is recorded yet, so performing this task currently proves nothing in the
              capability record.
            </p>
            {/* THE HONEST STATE, said plainly rather than implied. This is the
                one field the document insists on keeping and it is also the one
                that cannot be filled generically. */}
            <p className="rounded-xl border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              Evidence has to name a specific competency, and competencies belong to an
              organisation — so a shared template cannot fill this in without inventing a
              reference. It is set per task, here, by someone who knows which competency the
              work actually demonstrates.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {eso.evidence_emitted.map((item, i) => (
              <li key={i} className="rounded-xl border border-border bg-background/40 p-3">
                <p className="text-sm font-semibold text-foreground">{item.evidence_type ?? 'Evidence'}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.format ? `${item.format} · ` : ''}
                  {item.competency_id ? `competency #${item.competency_id}` : 'no competency named'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Panel
        icon={<FileText className="h-4 w-4" />}
        title="Outputs"
        hint="What this task produces, and where it goes"
        empty="No outputs are recorded."
        items={eso.outputs.map((o) => [o.name, o.format, o.destination].filter(Boolean).join(' · '))}
      />

      <Panel
        icon={<FileText className="h-4 w-4" />}
        title="Inputs"
        hint="What has to be available before this task can start"
        empty="No inputs are recorded."
        items={eso.inputs.map((o) => [
          o.name, o.source, o.format, o.required ? 'required' : 'optional',
        ].filter(Boolean).join(' · '))}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function Panel({ icon, title, hint, empty, items }: {
  icon: React.ReactNode
  title: string
  hint: string
  empty: string
  items: string[]
}) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function InlineError({ message }: { message: string }) {
  const { title, description } = describeFailure(message)
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm font-bold text-destructive">{title}</p>
      <p className="mt-0.5 text-xs text-destructive/90">{description}</p>
    </div>
  )
}
