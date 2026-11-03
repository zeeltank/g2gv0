'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Bot, LoaderCircle, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { returnFocusTo } from '@/lib/agent/focus'
import {
  acceptNotice, autonomySentence, dismissNotice, durationText, failureText, formatCost, formatTokens, formatWhen, isWaiting, loadFailure, mergedInto, NO_VALUE, runGate, runNotice,
  triggerText, type Notice,
} from '@/lib/agent/model'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import type { AgentApi } from '@/services/agent/api-types'
import { agentService } from '@/services/agent/agent-service'
import { AgentApiError } from '@/services/agent/errors'
import type { AgentOrgState, AgentProposal } from '@/services/agent/types'
import { ActivityItem, AgentMark, AgentNotice, EvidenceList, Meta, ProposalCard, RunStatePill } from './org-agent-parts'

type Phase = 'resolving' | 'loading' | 'ready' | 'error' | 'forbidden' | 'notFound'

/** What is in flight. While anything is, every button waits, so nothing is pressed twice. */
type Busy = { kind: 'run' } | { kind: 'accept' | 'dismiss'; id: number }

/** How many finished items the panel lists before "Show all". */
const RECENT_SHOWN = 4

export interface OrgAgentPanelProps {
  /** The Organisation 360 identity of the organisation (g2g_org_accounts.id). Give this when it is known. */
  orgAccountId?: number | string | null
  /** The CRM organisation, for a page that knows only that one: its identity is found (and made, if there is none) through the Organisation 360 API. */
  crmOrganizationId?: number | string | null
  /** Called when the agent or a person's accept has changed what the organisation's Notes or Schedule tab shows (a note, a task), so the page can read them again. */
  onRecordsChanged?: () => void
  /** Called when accepting a link made this organisation part of another one: the identity that now holds it. This page's record is gone; the page should open that one. */
  onOrganisationChanged?: (identityId: number) => void
  /** For tests and for a page that already has one. */
  service?: AgentApi
  className?: string
}

/**
 * The Organisation agent on one organisation: press Run agent, and it reads what the CRM knows (signals, deals, notes, tasks), writes a short brief that
 * cites its evidence, and proposes next steps. What the organisation's settings allow it to do alone (notes and tasks, by default) it does at once and
 * marks "Agent"; everything else waits here for a person to accept or dismiss. Every run is recorded in Agent Run History. It never sends anything.
 *
 * MOUNT it on the Organization detail page with the identity it already has: `<OrgAgentPanel orgAccountId={identityId} onRecordsChanged={reloadNotesAndTasks} />`,
 * or, knowing only the CRM organisation: `<OrgAgentPanel crmOrganizationId={crmId} />`. It needs no other prop and fetches its own data.
 */
export function OrgAgentPanel({ orgAccountId = null, crmOrganizationId = null, onRecordsChanged, onOrganisationChanged, service = agentService, className }: OrgAgentPanelProps) {
  const context = useMemo(() => getLaravelContext(), [])
  const titleId = useId()
  const gateId = useId()

  const given = orgAccountId !== null && orgAccountId !== undefined && String(orgAccountId).trim() !== '' ? Number(orgAccountId) : null
  const [resolved, setResolved] = useState<number | null>(null)
  const identity = given ?? resolved

  const [phase, setPhase] = useState<Phase>(given !== null ? 'loading' : 'resolving')
  const [error, setError] = useState('')
  const [state, setState] = useState<AgentOrgState | null>(null)
  const [busy, setBusy] = useState<Busy | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dismissing, setDismissing] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [showAll, setShowAll] = useState(false)
  // Bumped by Retry when the identity could not be found, so the lookup runs again.
  const [attempt, setAttempt] = useState(0)

  const noticeBar = useRef<HTMLDivElement>(null)
  const focusNotice = useRef(false)
  const reasonBox = useRef<HTMLDivElement>(null)

  // Only the newest read may change what is shown: switching to another organisation while the first is still loading must not let its answer replace it.
  const latest = useRef(0)

  // The identity this panel is showing right now. Work that finishes after the page has moved on to another organisation must not touch the new one's panel.
  const shown = useRef(identity)

  // Another organisation starts clean: a message, an open reason form, a half-typed reason and "show all" belong to the one before.
  useEffect(() => {
    shown.current = identity
    queueMicrotask(() => { setNotice(null); setDismissing(null); setReason(''); setShowAll(false) })
  }, [identity])

  // ── finding the organisation's identity when only the CRM organisation is known ─────────────────────────────────────────────────────
  useEffect(() => {
    if (given !== null) return
    const crm = crmOrganizationId !== null && crmOrganizationId !== undefined ? String(crmOrganizationId).trim() : ''
    if (crm === '') {
      queueMicrotask(() => { setError('No organisation was given to the agent panel.'); setPhase('error') })
      return
    }
    if (!isLaravelContextReady(context)) {
      queueMicrotask(() => { setError('Your ERP session is unavailable. Please sign in again.'); setPhase('error') })
      return
    }
    let cancelled = false
    queueMicrotask(() => setPhase('resolving'))
    service.resolve(crm).then((response) => {
      if (!cancelled) setResolved(response.data.org_account_id)
    }).catch((cause: unknown) => {
      if (cancelled) return
      const problem = loadFailure(cause, 'The agent could not be opened for this organisation.')
      setError(problem.message)
      setPhase(problem.kind)
    })
    return () => { cancelled = true }
  }, [given, crmOrganizationId, context, service, attempt])

  // ── reading the panel's state ────────────────────────────────────────────────────────────────────────────────────────────────────────

  /** `quiet` reads again behind the panel, without the "Opening…" state. It answers whether it worked. */
  const load = useCallback(async (quiet = false): Promise<boolean> => {
    if (identity === null) return false
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setPhase('error')
      return false
    }
    const mine = ++latest.current
    if (!quiet) setPhase('loading')
    try {
      const response = await service.state(identity)
      if (mine !== latest.current) return false
      setState(response.data)
      setPhase('ready')
      return true
    } catch (cause) {
      if (mine !== latest.current || quiet) return false
      const problem = loadFailure(cause, 'The agent could not be opened.')
      setError(problem.message)
      setPhase(problem.kind)
      return false
    }
  }, [context, service, identity])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  // After the button that was pressed has left the panel (its proposal was decided), the focus goes to the message instead of to nowhere.
  useEffect(() => {
    if (notice && focusNotice.current) {
      focusNotice.current = false
      noticeBar.current?.focus()
    }
  }, [notice])

  // Opening the reason form puts the focus in it.
  useEffect(() => {
    if (dismissing !== null) reasonBox.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus()
  }, [dismissing])

  const announce = (next: Notice) => {
    focusNotice.current = true
    setNotice(next)
  }

  // ── what a person does ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

  const run = async () => {
    if (busy || identity === null || !state) return
    setBusy({ kind: 'run' })
    setNotice(null)
    setDismissing(null)
    try {
      const response = await service.run(identity)
      if (shown.current !== identity) return
      await load(true)
      announce(runNotice(response.data))
      if (response.data.proposal_counts.applied > 0) onRecordsChanged?.()
    } catch (cause) {
      if (shown.current !== identity) return
      // A refusal says why, and whatever it refers to (today's count, the kill switch, a model that has gone) is read again, so the panel shows the truth.
      await load(true)
      announce({ tone: 'error', text: failureText(cause, 'The agent could not be run.') })
    } finally {
      setBusy(null)
    }
  }

  const accept = async (proposal: AgentProposal) => {
    if (busy || identity === null) return
    setBusy({ kind: 'accept', id: proposal.id })
    setNotice(null)
    setDismissing(null)
    try {
      const response = await service.accept(proposal.id)
      if (shown.current !== identity) return
      const decided = response.data.proposal
      const merged = decided.action === 'confirm_link' ? mergedInto(decided.result_ref, identity) : null
      if (merged !== null) {
        // The two organisations became one and this identity was the one removed: reading it again would only say "not found".
        announce({ tone: 'success', text: 'The records were linked as one organisation. This record is now part of another one, so open that one to see it.' })
        onOrganisationChanged?.(merged)
      } else {
        await load(true)
        announce({ tone: 'success', text: acceptNotice(proposal.action, response.data.outcome) })
      }
      onRecordsChanged?.()
    } catch (cause) {
      if (shown.current !== identity) return
      // A proposal that could not be applied, was already decided, or may no longer be applied (the action was switched off): the panel is read again so it
      // shows what became of it, whatever the reason was.
      await load(true)
      announce({ tone: 'error', text: failureText(cause, 'The proposal could not be accepted.') })
    } finally {
      setBusy(null)
    }
  }

  const confirmDismiss = async (proposal: AgentProposal) => {
    if (busy) return
    setBusy({ kind: 'dismiss', id: proposal.id })
    setNotice(null)
    try {
      const response = await service.dismiss(proposal.id, reason)
      if (shown.current !== identity) return
      setDismissing(null)
      setReason('')
      await load(true)
      announce({ tone: 'success', text: dismissNotice(response.data.outcome) })
    } catch (cause) {
      if (shown.current !== identity) return
      // The server said what became of the proposal (it was decided meanwhile): the form has nothing left to ask about.
      if (cause instanceof AgentApiError && cause.proposal) setDismissing(null)
      await load(true)
      announce({ tone: 'error', text: failureText(cause, 'The proposal could not be dismissed.') })
    } finally {
      setBusy(null)
    }
  }

  const openDismiss = (proposal: AgentProposal) => {
    setNotice(null)
    setReason('')
    setDismissing(proposal.id)
  }

  const cancelDismiss = (trigger: HTMLElement | null) => {
    setDismissing(null)
    setReason('')
    returnFocusTo(trigger)
  }

  // ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  const frame = 'space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm'

  const heading = (
    <div className="flex flex-wrap items-center gap-2">
      <Bot aria-hidden className="size-4 text-primary" />
      <h2 id={titleId} className="text-base font-semibold text-foreground">Organisation agent</h2>
      <AgentMark />
    </div>
  )

  if (phase === 'resolving' || phase === 'loading') {
    return (
      <section aria-labelledby={titleId} aria-busy="true" className={cn(frame, className)}>
        {heading}
        <p role="status" className="text-sm text-muted-foreground">Opening the agent…</p>
      </section>
    )
  }

  if (phase === 'forbidden' || phase === 'notFound') {
    return (
      <section aria-labelledby={titleId} className={cn(frame, className)}>
        {heading}
        <p className="text-sm text-muted-foreground">{error}</p>
      </section>
    )
  }

  if (phase === 'error' || !state) {
    return (
      <section aria-labelledby={titleId} className={cn(frame, className)}>
        {heading}
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <span><strong>The agent could not be opened.</strong> {error}</span>
          <Button size="sm" variant="outline" onClick={() => { if (identity === null) { setPhase('resolving'); setAttempt((n) => n + 1) } else { void load() } }}>
            <RefreshCw aria-hidden /> Retry
          </Button>
        </div>
      </section>
    )
  }

  const gate = runGate(state)
  const last = state.last_run
  const pending = state.pending.filter((p) => isWaiting(p.status))
  const recentShown = showAll ? state.recent : state.recent.slice(0, RECENT_SHOWN)
  const running = busy?.kind === 'run'
  const anyBusy = busy !== null
  const busyFor = (p: AgentProposal): 'accept' | 'dismiss' | null => (busy && busy.kind !== 'run' && busy.id === p.id ? busy.kind : null)

  return (
    <section aria-labelledby={titleId} aria-busy={anyBusy} className={cn(frame, className)} data-agent-panel>
      {heading}
      <p className="text-sm text-muted-foreground">
        Reads this organisation&apos;s signals, deals, notes and tasks, writes a short brief with its evidence and proposes next steps. It never sends anything.
      </p>

      {/* The one place a screen reader hears that the agent is working. */}
      <p className="sr-only" role="status" aria-live="polite">{running ? 'The agent is reading this organisation. This takes a few seconds.' : anyBusy ? 'Working…' : ''}</p>

      <div className="flex flex-wrap items-start gap-3">
        <Button onClick={() => { void run() }} disabled={!gate.allowed || anyBusy} aria-describedby={gate.allowed ? undefined : gateId} aria-busy={running}>
          {running ? <LoaderCircle aria-hidden className="animate-spin" /> : <Play aria-hidden />}
          {running ? 'Running…' : 'Run agent'}
        </Button>
        <div className="min-w-0 flex-1 space-y-1">
          {!gate.allowed && <p id={gateId} className="break-words text-sm text-muted-foreground">{gate.reason}</p>}
          <Meta>
            <span>{state.agent.runs_today} of {state.agent.daily_cap} runs today</span>
            {last && <span>Last run {formatWhen(last.started_at)}</span>}
            {last && <span>{formatCost(last.cost, last.cost_currency)}</span>}
          </Meta>
        </div>
      </div>

      {notice && <AgentNotice ref={noticeBar} notice={notice} onDismiss={() => setNotice(null)} />}

      {last ? (
        <div className="space-y-2 rounded-lg border border-border bg-background p-3" data-last-run={last.id}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Why now</h3>
            <RunStatePill status={last.status} />
          </div>
          {last.brief ? (
            <p className="whitespace-pre-line break-words text-sm text-foreground">{last.brief}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{last.message ?? 'The agent did not write a brief this time.'}</p>
          )}
          {last.brief && <EvidenceList refs={last.brief_evidence} />}
          <Meta>
            <span>Run #{last.id}</span>
            <span>{triggerText(last.trigger)}</span>
            {last.user_name && <span>for {last.user_name}</span>}
            <span>{last.model ?? NO_VALUE}</span>
            <span>{formatTokens(last.input_tokens, last.output_tokens)}</span>
            <span>{durationText(last.started_at, last.finished_at)}</span>
          </Meta>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground" data-empty>
          The agent has not run on this organisation yet. Press Run agent to get a brief and proposals.
        </p>
      )}

      {pending.length > 0 && (
        <div className="space-y-2" ref={reasonBox}>
          <h3 className="text-sm font-semibold text-foreground">Waiting for you ({pending.length})</h3>
          <ul className="space-y-2">
            {pending.map((p) => (
              <ProposalCard
                key={p.id} proposal={p} canDecide={state.can.decide} busy={busyFor(p)} anyBusy={anyBusy} dismissing={dismissing === p.id} reason={reason}
                onReason={setReason} onAccept={(proposal: AgentProposal) => { void accept(proposal) }} onOpenDismiss={openDismiss} onCancelDismiss={cancelDismiss}
                onConfirmDismiss={(proposal) => { void confirmDismiss(proposal) }}
              />
            ))}
          </ul>
        </div>
      )}

      {state.recent.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">What the agent has done</h3>
          <ul className="space-y-2">
            {recentShown.map((p) => <ActivityItem key={p.id} proposal={p} />)}
          </ul>
          {state.recent.length > RECENT_SHOWN && (
            <Button size="sm" variant="ghost" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
              {showAll ? 'Show fewer' : `Show all ${state.recent.length}`}
            </Button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground" data-autonomy>{autonomySentence(state.agent.autonomy)}</p>
    </section>
  )
}
