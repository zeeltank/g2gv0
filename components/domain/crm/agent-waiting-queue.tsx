'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatWhen, NO_VALUE, type Notice } from '@/lib/agent/model'
import {
  agentOffQueueText, lastPage, NO_DECIDE_TEXT, organisationLine, QUEUE_EMPTY_TEXT, QUEUE_INTRO, queueParams, rangeText, readFailure, waitingTotalText, type ReadFailureKind,
} from '@/lib/agent/queue-model'
import { BANNER_TONE } from '@/lib/agent/tones'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import type { AgentApi } from '@/services/agent/api-types'
import { agentService } from '@/services/agent/agent-service'
import type { KillSwitch, ProposalsPage, QueuedProposal } from '@/services/agent/types'
import { useQueueDecisions } from './agent-queue-decisions'
import { AgentNotice, Meta, ProposalCard } from './org-agent-parts'

type Phase = 'loading' | 'ready' | 'error' | ReadFailureKind

export interface AgentWaitingQueueProps {
  /** For tests and for a page that already has one. */
  service?: AgentApi
  /** The agent's kill switch as the screen last read it: while it is on, the list says that nothing can be accepted. */
  kill?: KillSwitch | null
  /** The total number waiting, each time the list was read, so the tab can show it. */
  onTotal?: (total: number) => void
  /** Something was decided or refused: what depends on it (the counters and the kill switch) should be read again. */
  onChanged?: () => void
  className?: string
}

/**
 * The organisation panel's message, with a callback ref given under another name than `ref` (the decisions hook's `noticeRef`): a screen that passed it as `ref`
 * straight from the hook's result would read as touching a ref while rendering, which it does not.
 */
function QueueNotice({ notice, onDismiss, register }: { notice: Notice; onDismiss: () => void; register: (element: HTMLDivElement | null) => void }) {
  return <AgentNotice ref={register} notice={notice} onDismiss={onDismiss} />
}

/** The organisation a proposal is about, and when it was proposed, above the proposal itself. */
function QueueLead({ proposal }: { proposal: QueuedProposal }) {
  const line = organisationLine(proposal.organisation)
  return (
    <div className="space-y-1" data-organisation={proposal.organisation.id}>
      <p className="break-words text-sm text-foreground">
        <span className="font-medium text-muted-foreground">Organisation: </span>
        {line.kind === 'gone' ? <span>Not found</span> : line.href ? <a href={line.href} className="font-semibold underline underline-offset-2 hover:no-underline">{line.name}</a> : <span className="font-semibold">{line.name}</span>}
      </p>
      {line.note && <p className="break-words text-xs text-muted-foreground">{line.note}</p>}
      <Meta>
        {proposal.created_at && <span>Proposed {formatWhen(proposal.created_at)}</span>}
        <span>Run #{proposal.run_id}</span>
      </Meta>
    </div>
  )
}

/**
 * The Waiting for you tab of Agent Run History: every proposal nobody has decided, across the organisation's organisations, newest first, each with the
 * organisation it is about, what the agent wants to do in plain words and the records it rests on. Accept and Dismiss (with an optional reason) are the
 * organisation panel's own, through the existing accept and dismiss routes; a person can clear the day's proposals without opening organisations one by one.
 * Reading follows VIEW on Agent Run History; deciding follows EDIT on Organizations (`can.decide` on each row), and a person who may only read sees the
 * proposals without the buttons. Nothing is sent anywhere.
 */
export function AgentWaitingQueue({ service = agentService, kill = null, onTotal, onChanged, className }: AgentWaitingQueueProps) {
  const context = useMemo(() => getLaravelContext(), [])
  const titleId = useId()

  const [page, setPage] = useState(1)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState<ProposalsPage | null>(null)
  // A new page is being read while the list that is on screen stays: the buttons must not vanish under the person's hands (their focus would be lost).
  const [refreshing, setRefreshing] = useState(false)
  // Only the newest read may change what is shown: a slow answer for the page the person has left must not replace the one they are on.
  const latest = useRef(0)
  // The latest callbacks, kept in refs so a parent that passes new functions on every render cannot make the list read again.
  const totalCallback = useRef(onTotal)
  const changedCallback = useRef(onChanged)
  useEffect(() => {
    totalCallback.current = onTotal
    changedCallback.current = onChanged
  })

  /** `quiet` reads again behind the list, without the "Opening…" state, and never throws. It answers whether it worked. */
  const load = useCallback(async (quiet = false): Promise<boolean> => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setPhase('error')
      return false
    }
    const mine = ++latest.current
    if (!quiet) setRefreshing(true)
    try {
      const response = await service.proposals(queueParams(page))
      if (mine !== latest.current) return false
      // The page the person was on has emptied (its last proposal was decided): step back to the last one that has rows.
      if (response.data.rows.length === 0 && page > 1 && response.data.pagination.total > 0) {
        setPage(lastPage(response.data.pagination))
        return true
      }
      setData(response.data)
      setPhase('ready')
      setRefreshing(false)
      totalCallback.current?.(response.data.pagination.total)
      return true
    } catch (cause) {
      if (mine !== latest.current || quiet) return false
      const problem = readFailure(cause, 'waiting list', 'The waiting list could not be read.')
      setData(null)
      setRefreshing(false)
      setError(problem.message)
      setPhase(problem.kind)
      return false
    }
  }, [context, service, page])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const decisions = useQueueDecisions({ service, reload: () => load(true), onChanged: () => changedCallback.current?.() })

  // Opening the reason form puts the focus in it.
  const list = useRef<HTMLUListElement>(null)
  const dismissing = decisions.dismissing
  useEffect(() => {
    if (dismissing !== null) list.current?.querySelector<HTMLTextAreaElement>(`[data-proposal="${dismissing}"] textarea`)?.focus()
  }, [dismissing])

  const heading = (
    <div className="space-y-1">
      <h2 id={titleId} className="text-base font-semibold text-foreground">Waiting for you</h2>
      <p className="text-sm text-muted-foreground">{QUEUE_INTRO}</p>
    </div>
  )

  // Nothing to show yet: the first read, or a Retry after an error.
  if (data === null && (phase === 'loading' || refreshing)) {
    return (
      <section aria-labelledby={titleId} aria-busy="true" className={cn('space-y-4', className)} data-queue-state="loading">
        {heading}
        <p role="status" className="text-sm text-muted-foreground">Opening the waiting list…</p>
      </section>
    )
  }

  if (phase === 'forbidden' || phase === 'unavailable') {
    return (
      <section aria-labelledby={titleId} className={cn('space-y-4', className)} data-queue-state={phase}>
        {heading}
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">{error}</p>
      </section>
    )
  }

  if (phase === 'error' || !data) {
    return (
      <section aria-labelledby={titleId} className={cn('space-y-4', className)} data-queue-state="error">
        {heading}
        <div role="alert" className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm', BANNER_TONE.error)}>
          <span><strong>The waiting list could not be opened.</strong> {error}</span>
          <Button size="sm" variant="outline" onClick={() => { void load() }}><RefreshCw aria-hidden /> Retry</Button>
        </div>
      </section>
    )
  }

  const rows = data.rows
  const total = data.pagination.total
  const pages = lastPage(data.pagination)
  const range = rangeText(data.pagination, rows.length)
  // While a decision is in flight, or another page is being read, nothing can be decided or paged: the rows on screen may be about to change.
  const anyBusy = decisions.busy !== null || refreshing
  const busyFor = (id: number): 'accept' | 'dismiss' | null => (decisions.busy && decisions.busy.id === id ? decisions.busy.kind : null)
  const mayDecide = (row: QueuedProposal) => row.can.decide && !decisions.noRight
  const nobodyMayDecide = rows.length > 0 && rows.every((row) => !mayDecide(row))
  const off = agentOffQueueText(kill)

  return (
    <section aria-labelledby={titleId} aria-busy={anyBusy} className={cn('space-y-4', className)} data-queue-state="ready">
      {heading}

      <p className="sr-only" role="status" aria-live="polite">{decisions.busy ? 'Working…' : refreshing ? 'Loading the list…' : ''}</p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" data-total>{waitingTotalText(total)}</p>
        <Button variant="outline" size="sm" onClick={() => { void load() }} disabled={anyBusy} className="gap-1.5 text-xs">
          <RefreshCw aria-hidden className={cn('size-3.5', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {off && <p className={cn('rounded-lg border p-3 text-sm', BANNER_TONE.error)} data-agent-off>{off}</p>}

      {decisions.notice && <QueueNotice register={decisions.noticeRef} notice={decisions.notice} onDismiss={() => decisions.setNotice(null)} />}

      {nobodyMayDecide && <p className="rounded-lg border border-border bg-card p-3 text-sm text-foreground" data-view-only>{NO_DECIDE_TEXT}</p>}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground" data-empty>{QUEUE_EMPTY_TEXT}</p>
      ) : (
        <ul ref={list} className="space-y-3" aria-label="Proposals waiting for you">
          {rows.map((row) => (
            <ProposalCard
              key={row.id} proposal={row} lead={<QueueLead proposal={row} />} canDecide={mayDecide(row)} busy={busyFor(row.id)} anyBusy={anyBusy}
              dismissing={decisions.dismissing === row.id} reason={decisions.reason} onReason={decisions.setReason}
              onAccept={() => { void decisions.accept(row) }} onOpenDismiss={() => decisions.openDismiss(row)} onCancelDismiss={decisions.cancelDismiss}
              onConfirmDismiss={() => { void decisions.confirmDismiss(row) }}
            />
          ))}
        </ul>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{range ?? NO_VALUE}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || anyBusy} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages || anyBusy} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </section>
  )
}
