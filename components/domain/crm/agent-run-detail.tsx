'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BANNER_TONE } from '@/lib/agent/tones'
import { cn } from '@/lib/utils'
import {
  countsText, durationText, formatCost, formatTokens, formatWhen, loadFailure, NO_VALUE, outcomeLabel, refusalText, stepLabel, triggerText,
} from '@/lib/agent/model'
import type { AgentApi } from '@/services/agent/api-types'
import type { AgentRunDetail } from '@/services/agent/types'
import { ActivityItem, EvidenceList, RunStatePill } from './org-agent-parts'

type Load = { phase: 'loading' } | { phase: 'ready'; run: AgentRunDetail } | { phase: 'error'; kind: 'forbidden' | 'notFound' | 'error'; message: string }

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">{children}</dd>
    </div>
  )
}

/**
 * One run of an agent, read-only: what it read, the brief and the records it cites, every proposal with what became of it (the ones the agent did itself are
 * marked Agent), and the audit trail of each step including what was refused and why. Decisions on waiting proposals are made on the organisation's page.
 */
export function AgentRunDetailDialog({ runId, service, onClose }: { runId: number | null; service: AgentApi; onClose: () => void }) {
  const [load, setLoad] = useState<{ id: number | null; value: Load }>({ id: null, value: { phase: 'loading' } })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (runId === null) return
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setLoad({ id: runId, value: { phase: 'loading' } }) })
    service.runDetail(runId).then((response) => {
      if (!cancelled) setLoad({ id: runId, value: { phase: 'ready', run: response.data } })
    }).catch((cause: unknown) => {
      if (cancelled) return
      const problem = loadFailure(cause, 'This run could not be opened.')
      setLoad({ id: runId, value: { phase: 'error', kind: problem.kind, message: problem.message } })
    })
    return () => { cancelled = true }
  }, [runId, service, attempt])

  // What is shown is only ever the answer for the run that is open: a late answer for a run that was closed or replaced never appears.
  const current: Load = load.id === runId ? load.value : { phase: 'loading' }

  return (
    <Dialog open={runId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agent run #{runId}</DialogTitle>
          <DialogDescription>
            {current.phase === 'ready'
              ? `Organisation agent${current.run.subject.name ? ` · ${current.run.subject.name}` : ''} · ${formatWhen(current.run.started_at)}`
              : 'What the agent read, proposed and did.'}
          </DialogDescription>
        </DialogHeader>

        {current.phase === 'loading' && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden className="size-4 animate-spin" /> Opening the run…</p>
        )}

        {current.phase === 'error' && (
          <div role="alert" className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm', BANNER_TONE.error)}>
            <span>{current.message}</span>
            {current.kind === 'error' && <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>}
          </div>
        )}

        {current.phase === 'ready' && <RunBody run={current.run} />}
      </DialogContent>
    </Dialog>
  )
}

function RunBody({ run }: { run: AgentRunDetail }) {
  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Status"><RunStatePill status={run.status} /></Fact>
        <Fact label="Acting for">{run.user_name ?? NO_VALUE}</Fact>
        <Fact label="Started by">{triggerText(run.trigger)}</Fact>
        <Fact label="Took">{durationText(run.started_at, run.finished_at)}</Fact>
        <Fact label="Model">{run.model ? `${run.provider ?? ''}${run.provider ? ' / ' : ''}${run.model}` : NO_VALUE}</Fact>
        <Fact label="Tokens">{formatTokens(run.input_tokens, run.output_tokens)}</Fact>
        <Fact label="Cost">{formatCost(run.cost, run.cost_currency)}</Fact>
        <Fact label="Proposals">{countsText(run.proposal_counts)}</Fact>
      </dl>

      {run.status !== 'completed' && run.message && (
        <p role="note" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">{run.message}</p>
      )}

      <section aria-labelledby="run-brief" className="space-y-2">
        <h3 id="run-brief" className="text-sm font-semibold text-foreground">Brief</h3>
        {run.brief ? <p className="whitespace-pre-line break-words text-foreground">{run.brief}</p> : <p className="text-muted-foreground">No brief was kept for this run.</p>}
        {run.brief && <EvidenceList refs={run.brief_evidence} />}
      </section>

      <section aria-labelledby="run-proposals" className="space-y-2">
        <h3 id="run-proposals" className="text-sm font-semibold text-foreground">Proposals ({run.proposals.length})</h3>
        {run.proposals.length === 0 ? (
          <p className="text-muted-foreground">The agent proposed nothing in this run.</p>
        ) : (
          <>
            <ul className="space-y-2">{run.proposals.map((p) => <ActivityItem key={p.id} proposal={p} />)}</ul>
            {run.proposals.some((p) => p.status === 'pending') && (
              <p className="text-xs text-muted-foreground">Proposals that are waiting are accepted or dismissed on the organisation’s own page.</p>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="run-trail" className="space-y-2">
        <h3 id="run-trail" className="text-sm font-semibold text-foreground">Audit trail ({run.trace.length} steps)</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Every step the agent took in this run, in order, with what happened to it</caption>
            <thead className="border-b border-border bg-muted font-medium text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">#</th>
                <th scope="col" className="px-3 py-2">Step</th>
                <th scope="col" className="px-3 py-2">Outcome</th>
                <th scope="col" className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {run.trace.map((step) => (
                <tr key={step.seq} data-step={step.seq}>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{step.seq}</td>
                  <td className="px-3 py-2 text-foreground">{stepLabel(step.tool)}</td>
                  <td className="px-3 py-2 text-foreground">{outcomeLabel(step.outcome)}</td>
                  <td className="break-words px-3 py-2 text-muted-foreground">
                    {[refusalText(step.deny_reason), step.result_ref ? `wrote ${step.result_ref}` : null, step.latency_ms !== null ? `${step.latency_ms} ms` : null].filter(Boolean).join(' · ') || NO_VALUE}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
