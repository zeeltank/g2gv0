'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { ExternalLink, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { returnFocusTo } from '@/lib/agent/focus'
import { formatWhen } from '@/lib/agent/model'
import {
  bandView, decisionLine, entityLabel, evidenceLabel, fieldLabel, isWaiting, MAX_REASON, NO_VALUE, originLine, quoteText, recordLine, scoreText, sourceView, statusView,
  strengthText, valueLink, type Notice, type PillView,
} from '@/lib/facts/model'
import { CHIP_BASE, NOTICE_LOOK, PILL_TONE } from '@/lib/facts/tones'
import { cn } from '@/lib/utils'
import type { Fact, FactEvidence } from '@/services/facts/types'

/** A state in words. The colour (a border) only helps: the word is always there. */
export function Pill({ view, kind }: { view: PillView; kind?: string }) {
  return <span data-tone={view.tone} data-pill={kind} className={cn(CHIP_BASE, PILL_TONE[view.tone])}>{view.label}</span>
}

/** How sure the ledger is: the band in a word and the score in words ("Probable", "87% sure"). */
export function BandPill({ band, score }: { band: string; score: number }) {
  const view = bandView(band)
  const sure = scoreText(score)
  return <Pill kind="band" view={{ label: sure ? `${view.label} · ${sure}` : view.label, tone: view.tone }} />
}

/**
 * A result shown on the screen. An error is announced at once (alert); a success politely (status). It can take focus, so a screen that has just removed the
 * button the person pressed can put the focus here: `register` is a callback ref (the decisions hook's `noticeRef`), given under another name than `ref` so the
 * screen that owns the hook is not taken for one that reads a ref while it renders.
 */
export function FactNotice({ notice, onDismiss, register }: { notice: Notice; onDismiss: () => void; register?: (element: HTMLDivElement | null) => void }) {
  return (
    <div
      ref={register}
      tabIndex={-1}
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', NOTICE_LOOK[notice.tone])}
    >
      <span className="min-w-0 break-words">{notice.text}</span>
      <Button size="sm" variant="ghost" onClick={onDismiss}>Close message</Button>
    </div>
  )
}

/** One link out of the application: new tab, no opener, no referrer-sensitive leak, and the screen reader is told. The text is what a person sees of where it goes. */
function WebLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 break-all text-foreground underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

/** Where a piece of evidence came from: a web link for an http(s) address, a link for a path inside this application, plain text for anything else. */
function SourceLine({ url }: { url: string | null }) {
  const source = sourceView(url)
  if (!source) return null
  return (
    <p className="text-xs text-muted-foreground" data-source={source.kind}>
      Source:{' '}
      {source.kind === 'web' ? <WebLink href={source.href}>{source.text}</WebLink>
        : source.kind === 'internal' ? <Link href={source.href} className="break-all text-foreground underline underline-offset-2 hover:no-underline">{source.text}</Link>
          : <span className="break-all text-foreground">{source.text}</span>}
    </p>
  )
}

/**
 * The evidence a fact rests on, one entry per independent source: what it is, how much it counts, the wording copied from the source (as text, never as
 * markup) and where it came from. Everything here may have come from the web or a model, so none of it is ever interpreted.
 */
export function EvidenceList({ evidence }: { evidence: readonly FactEvidence[] }) {
  if (evidence.length === 0) return <p className="text-xs text-muted-foreground" data-no-evidence>No evidence was recorded for this fact.</p>
  return (
    <ul aria-label="Evidence" className="space-y-2">
      {evidence.map((item, index) => {
        const quote = quoteText(item.quote)
        const retrieved = formatWhen(item.retrieved_at)
        return (
          <li key={`${item.kind}-${index}`} data-evidence={item.kind} className="space-y-1 rounded-md border border-border bg-card p-2.5">
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-foreground">
              <span className="font-medium">{evidenceLabel(item)}</span>
              <span className="text-xs text-muted-foreground">{strengthText(item)}</span>
            </p>
            {quote && <blockquote className="break-words border-l-2 border-border pl-2.5 text-xs text-muted-foreground">“{quote}”</blockquote>}
            <SourceLine url={item.source_url} />
            {retrieved !== NO_VALUE && <p className="text-xs text-muted-foreground">Retrieved {retrieved}</p>}
          </li>
        )
      })}
    </ul>
  )
}

/** The optional reason a person gives when dismissing. It takes the focus when it opens; Escape closes it. */
function ReasonForm({ id, reason, anyBusy, dismissBusy, onReason, onSubmit, onCancel }: {
  id: string
  reason: string
  anyBusy: boolean
  dismissBusy: boolean
  onReason: (text: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const field = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { field.current?.focus() }, [])
  return (
    <form
      id={id}
      className="space-y-2 rounded-md border border-border bg-muted p-3"
      onSubmit={(event) => { event.preventDefault(); onSubmit() }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onCancel()
      }}
    >
      <label htmlFor={`${id}-reason`} className="block text-xs font-medium text-foreground">Why are you dismissing this? (optional)</label>
      <Textarea
        id={`${id}-reason`} ref={field} size="sm" value={reason} maxLength={MAX_REASON} onChange={(event) => onReason(event.target.value)} disabled={anyBusy}
        aria-describedby={`${id}-count`} placeholder="For example: that is the school office, not this person."
      />
      <p id={`${id}-count`} className="text-xs text-muted-foreground">{reason.length} of {MAX_REASON} characters. A dismissed value is never suggested again.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={anyBusy}>
          {dismissBusy ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
          Dismiss this suggestion
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={anyBusy} onClick={onCancel}>Keep it</Button>
      </div>
    </form>
  )
}

export interface FactCardProps {
  fact: Fact
  /** The queue shows whose fact it is (name, kind, a link to the record); a record's own section does not. */
  showRecord?: boolean
  recordHref?: string | null
  canDecide: boolean
  /** Say, on a fact that waits and that this person may not decide, why it has no buttons (used when other facts beside it do have them). */
  viewOnlyNote?: boolean
  /** What is happening to THIS fact right now, if anything. */
  busy: 'accept' | 'dismiss' | null
  /** Something is in flight (this fact or another one): every button waits. */
  anyBusy: boolean
  dismissing: boolean
  reason: string
  onReason: (text: string) => void
  onAccept: (fact: Fact) => void
  onOpenDismiss: (fact: Fact) => void
  onCancelDismiss: (returnFocus: () => void) => void
  onConfirmDismiss: (fact: Fact) => void
}

/**
 * One fact: the value and the field, how sure the ledger is and why, what the record holds now, the evidence (open for a fact that waits, behind a
 * disclosure once it is decided), where it came from, and, for a person who may decide, Accept and Dismiss. Dismissing opens a small form (an optional
 * reason); Escape closes it and the focus goes back to the Dismiss button. Nothing is sent anywhere: accepting writes the record's own field only when it is
 * blank, and keeps the fact in the ledger either way.
 */
export function FactCard({
  fact, showRecord = false, recordHref = null, canDecide, viewOnlyNote = false, busy, anyBusy, dismissing, reason, onReason, onAccept, onOpenDismiss, onCancelDismiss, onConfirmDismiss,
}: FactCardProps) {
  const id = useId()
  const summaryId = `${id}-summary`
  const formId = `${id}-dismiss`
  const dismissButton = useRef<HTMLButtonElement>(null)
  const waiting = isWaiting(fact.status)
  const band = bandView(fact.band)
  const link = valueLink(fact.field, fact.value)
  const record = recordLine(fact)
  const decision = decisionLine(fact)
  const origin = originLine(fact)
  const label = fieldLabel(fact)
  const status = statusView(fact)
  return (
    <li data-fact={fact.id} data-status={fact.status} data-band={fact.band} data-entity-type={fact.entity_type} className="space-y-2 rounded-lg border border-border bg-card p-3">
      {showRecord && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-foreground" data-record>
          <span className={cn(CHIP_BASE, PILL_TONE.neutral)}>{entityLabel(fact.entity_type)}</span>
          {recordHref ? <Link href={recordHref} className="font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{fact.entity_name?.trim() || `${entityLabel(fact.entity_type)} ${fact.entity_id}`}</Link>
            : <span className="font-medium">{fact.entity_name?.trim() || `${entityLabel(fact.entity_type)} ${fact.entity_id}`}</span>}
        </p>
      )}

      <div id={summaryId} className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground" data-field>{label}</span>
          {fact.value_kind && <Pill kind="kind" view={{ label: fact.value_kind === 'role' ? 'Role address' : 'Personal address', tone: 'neutral' }} />}
          <BandPill band={fact.band} score={fact.score} />
          {!waiting && <Pill kind="status" view={status} />}
        </div>
        <p className="break-words text-base font-semibold text-foreground" data-value>
          {link ? <WebLink href={link}>{fact.value}</WebLink> : fact.value}
        </p>
        <p className="break-words text-xs text-muted-foreground">{[band.meaning, fact.rationale?.trim()].filter(Boolean).join(' ')}</p>
      </div>

      {record && <p className="break-words text-sm text-foreground" data-record-line>{record}</p>}
      {decision && <p className="break-words text-sm text-muted-foreground" data-decision>{decision}</p>}

      {waiting ? (
        <div className="space-y-1.5">
          <h5 className="text-xs font-semibold text-foreground">Evidence ({fact.evidence.length})</h5>
          <EvidenceList evidence={fact.evidence} />
        </div>
      ) : (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">Evidence ({fact.evidence.length})</summary>
          <div className="mt-1.5"><EvidenceList evidence={fact.evidence} /></div>
        </details>
      )}

      {origin && <p className="break-words text-xs text-muted-foreground">{origin}</p>}

      {waiting && !canDecide && viewOnlyNote && <p className="break-words text-xs text-muted-foreground" data-view-only>{`You can read this, but deciding it needs the edit right on ${entityLabel(fact.entity_type, true)}.`}</p>}

      {waiting && canDecide && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" onClick={() => onAccept(fact)} disabled={anyBusy} aria-describedby={summaryId}>
            {busy === 'accept' ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
            Accept
          </Button>
          <Button
            ref={dismissButton} size="sm" variant="outline" aria-expanded={dismissing} aria-controls={dismissing ? formId : undefined} aria-describedby={summaryId} disabled={anyBusy}
            onClick={() => (dismissing ? onCancelDismiss(() => returnFocusTo(dismissButton.current)) : onOpenDismiss(fact))}
          >
            Dismiss
          </Button>
        </div>
      )}
      {waiting && canDecide && dismissing && (
        <ReasonForm
          id={formId} reason={reason} anyBusy={anyBusy} dismissBusy={busy === 'dismiss'} onReason={onReason}
          onSubmit={() => onConfirmDismiss(fact)} onCancel={() => onCancelDismiss(() => returnFocusTo(dismissButton.current))}
        />
      )}
    </li>
  )
}
