'use client'

import { forwardRef, useId, useRef, type ReactNode } from 'react'
import { Bot, CircleAlert, CircleCheck, CircleX, Clock, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  actionLabel, AGENT_BADGE, appliedByAgent, evidenceItems, formatWhen, proposalStatus, runStatus, type Notice, type StatusView, type Tone,
} from '@/lib/agent/model'
import { AGENT_MARK_TONE, BANNER_TONE, CHIP_BASE, FIELD_ERROR_TEXT, STATE_TONE } from '@/lib/agent/tones'
import { cn } from '@/lib/utils'
import type { AgentEvidenceRef, AgentProposal } from '@/services/agent/types'

/** The longest reason a person may give when dismissing (the server accepts 500). */
export const MAX_REASON = 500

const ICONS: Record<Tone, ReactNode> = {
  success: <CircleCheck aria-hidden className="size-3" />,
  pending: <Clock aria-hidden className="size-3" />,
  error: <CircleX aria-hidden className="size-3" />,
  inactive: <CircleAlert aria-hidden className="size-3" />,
  processing: <LoaderCircle aria-hidden className="size-3 animate-spin" />,
}

/** A state in words with an icon. The colour only helps: the word is always there. */
export function StatePill({ view }: { view: StatusView }) {
  return (
    <span data-tone={view.tone} className={cn(CHIP_BASE, STATE_TONE[view.tone])}>
      {ICONS[view.tone]}
      {view.label}
    </span>
  )
}

export function ProposalStatePill({ proposal }: { proposal: Pick<AgentProposal, 'status' | 'applied_via' | 'decided_by_name'> }) {
  return <StatePill view={proposalStatus(proposal)} />
}

export function RunStatePill({ status }: { status: string }) {
  return <StatePill view={runStatus(status)} />
}

/** Marks what the agent itself did. */
export function AgentMark() {
  return (
    <span data-agent-mark className={cn(CHIP_BASE, AGENT_MARK_TONE)}>
      <Bot aria-hidden className="size-3" />
      {AGENT_BADGE}
    </span>
  )
}

/**
 * The records a statement rests on, as a list. A record inside this application is a link; anything else (this organisation itself, a possible link, an
 * address that is not a plain path in this application) is text. What a model wrote is never a link.
 */
export function EvidenceList({ refs, label = 'Based on' }: { refs: readonly AgentEvidenceRef[]; label?: string }) {
  const items = evidenceItems(refs)
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}:</span>
      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label={label}>
        {items.map((item) => (
          <li key={item.key} data-evidence={item.key} className="min-w-0 break-words">
            <span className="text-muted-foreground">{item.typeLabel}: </span>
            {item.href ? <a href={item.href} className="text-foreground underline underline-offset-2 hover:no-underline">{item.label}</a> : <span className="text-foreground">{item.label}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * A result shown in the panel. An error is announced at once (alert); a success politely (status). It can take focus, so a panel that has just removed the
 * button the person pressed can put the focus here instead of losing it.
 */
export const AgentNotice = forwardRef<HTMLDivElement, { notice: Notice; onDismiss: () => void }>(({ notice, onDismiss }, ref) => (
  <div
    ref={ref}
    tabIndex={-1}
    role={notice.tone === 'error' ? 'alert' : 'status'}
    className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', BANNER_TONE[notice.tone])}
  >
    <span className="min-w-0 break-words">{notice.text}</span>
    <Button size="sm" variant="ghost" onClick={onDismiss}>Close message</Button>
  </div>
))
AgentNotice.displayName = 'AgentNotice'

/** The words an Accept button says, by what it will do. */
function acceptLabel(action: string): string {
  switch (action) {
    case 'add_note': return 'Accept: add the note'
    case 'add_task': return 'Accept: add the task'
    case 'confirm_link': return 'Accept: link the records'
    default: return 'Accept'
  }
}

/**
 * One proposal waiting for a person: what it is, why, what it rests on, and the two answers. Dismissing opens a small form (an optional reason) under the
 * buttons; Escape closes it and the focus goes back to the Dismiss button. Nothing is sent anywhere: accepting writes a note, a task or a link inside the CRM.
 */
export function ProposalCard({ proposal, canDecide, busy, anyBusy, dismissing, reason, onReason, onAccept, onOpenDismiss, onCancelDismiss, onConfirmDismiss }: {
  proposal: AgentProposal
  canDecide: boolean
  /** What is happening to THIS proposal right now, if anything. */
  busy: 'accept' | 'dismiss' | null
  /** Something is in flight (this proposal or another one, or a run): every button waits. */
  anyBusy: boolean
  dismissing: boolean
  reason: string
  onReason: (text: string) => void
  onAccept: (proposal: AgentProposal) => void
  onOpenDismiss: (proposal: AgentProposal) => void
  onCancelDismiss: (trigger: HTMLElement | null) => void
  onConfirmDismiss: (proposal: AgentProposal) => void
}) {
  const id = useId()
  const summaryId = `${id}-summary`
  const formId = `${id}-dismiss`
  const dismissButton = useRef<HTMLButtonElement>(null)
  return (
    <li data-proposal={proposal.id} data-action={proposal.action} className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{actionLabel(proposal.action)}</span>
        <ProposalStatePill proposal={proposal} />
      </div>
      <p id={summaryId} className="whitespace-pre-line break-words text-sm text-foreground">{proposal.summary}</p>
      {proposal.reason && <p className="break-words text-sm text-muted-foreground"><span className="font-medium">Why:</span> {proposal.reason}</p>}
      <EvidenceList refs={proposal.evidence} />
      {canDecide && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" onClick={() => onAccept(proposal)} disabled={anyBusy} aria-describedby={summaryId}>
            {busy === 'accept' ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
            {acceptLabel(proposal.action)}
          </Button>
          <Button
            ref={dismissButton} size="sm" variant="outline" aria-expanded={dismissing} aria-controls={dismissing ? formId : undefined} aria-describedby={summaryId} disabled={anyBusy}
            onClick={() => (dismissing ? onCancelDismiss(dismissButton.current) : onOpenDismiss(proposal))}
          >
            Dismiss
          </Button>
        </div>
      )}
      {canDecide && dismissing && (
        <form
          id={formId}
          className="space-y-2 rounded-md border border-border bg-muted p-3"
          onSubmit={(event) => { event.preventDefault(); onConfirmDismiss(proposal) }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            onCancelDismiss(dismissButton.current)
          }}
        >
          <label htmlFor={`${id}-reason`} className="block text-xs font-medium text-foreground">Why are you dismissing this? (optional)</label>
          <Textarea
            id={`${id}-reason`} size="sm" value={reason} maxLength={MAX_REASON} onChange={(event) => onReason(event.target.value)} disabled={anyBusy}
            aria-describedby={`${id}-count`} placeholder="For example: we already know this."
          />
          <p id={`${id}-count`} className="text-xs text-muted-foreground">{reason.length} of {MAX_REASON} characters. The agent never suggests a dismissed proposal again.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="destructive" disabled={anyBusy}>
              {busy === 'dismiss' ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
              Dismiss this proposal
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={anyBusy} onClick={() => onCancelDismiss(dismissButton.current)}>
              Keep it
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}

/** One thing that has been decided or done: marked "Agent" when the agent did it itself. */
export function ActivityItem({ proposal }: { proposal: AgentProposal }) {
  const byAgent = appliedByAgent(proposal)
  return (
    <li data-activity={proposal.id} data-by-agent={byAgent ? 'true' : 'false'} className="space-y-1.5 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {byAgent && <AgentMark />}
        <span className="text-sm font-semibold text-foreground">{actionLabel(proposal.action)}</span>
        <ProposalStatePill proposal={proposal} />
        {proposal.applied_at && proposal.status === 'applied' && <span className="text-xs text-muted-foreground">{formatWhen(proposal.applied_at)}</span>}
        {proposal.status === 'dismissed' && proposal.decided_at && <span className="text-xs text-muted-foreground">{formatWhen(proposal.decided_at)}</span>}
      </div>
      <p className="whitespace-pre-line break-words text-sm text-foreground">{proposal.summary}</p>
      {proposal.status === 'failed' && proposal.error && <p className={cn('break-words text-sm', FIELD_ERROR_TEXT)}><span className="font-medium">Why not:</span> {proposal.error}</p>}
      {proposal.status === 'dismissed' && proposal.decision_note && <p className="break-words text-sm text-muted-foreground"><span className="font-medium">Reason given:</span> {proposal.decision_note}</p>}
      <EvidenceList refs={proposal.evidence} />
    </li>
  )
}

/** Run facts in one line, with the cost never shown as 0 when it is not known. */
export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>{children}</p>
}
