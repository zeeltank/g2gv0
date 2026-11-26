'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { availableDecisions, decisionNotice, type DecisionAction } from '@/lib/signals/decision-actions'
import { FORBIDDEN_TEXT } from '@/lib/signals/decision-failure'
import { leadOf, withLead } from '@/lib/signals/lead-action'
import { applyDecision, withStatus } from '@/lib/signals/opportunity-row'
import { BANNER_TONE } from '@/lib/signals/tones'
import { cn } from '@/lib/utils'
import type { SignalReviewApi } from '@/services/signal-review/signal-review-service'
import type { ProductFilterOption, SignalDecisionResponse } from '@/services/signal-review/signal-types'
import type { ReasonOption, ReviewDecisionCode, ReviewHistoryEntry } from '@/services/signal-review/types'
import { signalFunnelService, type SignalFunnelApi } from '@/services/signal-review/signal-funnel-service'
import type { Opportunity } from '@/services/signals/opportunities'
import { useSignalDecision } from './signal-decision'
import { SignalDecisionDialog } from './signal-decision-dialog'
import { SignalFitScore } from './signal-fit'
import { SignalHistoryList } from './signal-history-list'
import { FunnelFeedbackMessage, SignalFunnelActions, useSignalFunnel } from './signal-funnel'
import { LeadFeedbackMessage, SignalLeadAction, useSignalLead } from './signal-lead'
import { SignalEvidence } from './signal-parts'

/** What a Company Opportunities card needs from the server for a decision, the history under it, and the lead. The Signal Review's own service has all four. */
export type SignalCardService = Pick<SignalReviewApi, 'decide' | 'get' | 'history' | 'promote'>

type HistoryState = { entries: ReviewHistoryEntry[] | null; loading: boolean; error: string | null }

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

/**
 * Everything one card can do to its signal beyond reading it: decide (a reason, a note, "someone decided first"), turn it into a lead (asked first, made
 * once), and show the decisions made on it. One mount per signal, so a half-finished decision never leaks from one card to the next. A change is handed up
 * as the signal's new version (`onChanged`); the list that owns the signals replaces the row and moves its counts. The history is read only when the card's
 * details are opened (`openHistory`), so a page of fifty cards does not ask for fifty histories.
 */
export function useSignalCard({ signal, service, onChanged, funnelService = signalFunnelService }: { signal: Opportunity; service: SignalCardService; onChanged: (next: Opportunity) => void; funnelService?: SignalFunnelApi }) {
  const [history, setHistory] = useState<HistoryState>({ entries: null, loading: false, error: null })
  const [requested, setRequested] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  // The row the list holds can be replaced under the card (a decision, a refresh): later work must act on the newest one.
  const current = useRef(signal)
  useEffect(() => { current.current = signal })
  const historyNow = useRef(history)
  useEffect(() => { historyNow.current = history })
  const asked = useRef(false)
  const latestHistory = useRef(0)

  const loadHistory = useCallback(async () => {
    const mine = ++latestHistory.current
    setHistory((h) => ({ ...h, loading: true, error: null }))
    try {
      const response = await service.history(current.current.id)
      if (mine === latestHistory.current) setHistory({ entries: response.data, loading: false, error: null })
    } catch (cause) {
      if (mine === latestHistory.current) setHistory((h) => ({ ...h, loading: false, error: cause instanceof Error ? cause.message : 'The history could not be loaded.' }))
    }
  }, [service])

  const openHistory = useCallback(() => {
    if (asked.current) return
    asked.current = true
    setRequested(true)
    void loadHistory()
  }, [loadHistory])

  // The server's version of this signal, for when the card's copy turned out to be out of date and the 409 did not say what is current.
  const refresh = useCallback(async () => {
    try {
      const response = await service.get(current.current.id)
      onChanged(withStatus(current.current, response.data.review_status))
    } catch {
      // The card stays as it is; the next load of the list corrects it.
    }
  }, [service, onChanged])

  const onSaved = useCallback((result: SignalDecisionResponse) => {
    onChanged(applyDecision(current.current, result))
    setNotice(decisionNotice(result.review.decision))
    const loaded = historyNow.current.entries
    // A history already on screen gains the new row at the top. One that was asked for and has not arrived is read again (and then includes it). One
    // nobody has opened is left alone: it is read, with the decision in it, when the details are opened.
    if (loaded) setHistory({ entries: loaded.some((e) => e.id === result.review.id) ? loaded : [result.review, ...loaded], loading: false, error: null })
    else if (asked.current) void loadHistory()
  }, [onChanged, loadHistory])

  const onStale = useCallback((entry: ReviewHistoryEntry | null) => {
    setNotice(null)
    if (entry) onChanged(withStatus(current.current, entry.to_status))
    else void refresh()
    if (asked.current) void loadHistory()
  }, [onChanged, refresh, loadHistory])

  const onForbidden = useCallback(() => setForbidden(true), [])

  // The server writes a `promoted` line in the history when it makes a lead, and answers with the lead's id only: the card gains the lead. A signal that
  // already had its lead wrote nothing, so there is nothing to read.
  const onPromoted = useCallback((leadId: string, created: boolean) => {
    onChanged(withLead(current.current, leadId))
    if (created && asked.current) void loadHistory()
  }, [onChanged, loadHistory])

  const decision = useSignalDecision({ service, signal, onSaved, onStale, onForbidden })
  const lead = useSignalLead({ service, signal, onPromoted })
  const funnel = useSignalFunnel({ signal, funnel: funnelService, onChanged })

  const begin = (next: ReviewDecisionCode) => {
    setNotice(null)
    lead.clear()
    funnel.clear()
    decision.open(next)
  }
  const requestLead = () => {
    setNotice(null)
    funnel.clear()
    void lead.request()
  }

  return {
    decision, lead, funnel, history, requested, notice, forbidden, openHistory, begin, requestLead,
    retryHistory: () => void loadHistory(),
    saving: decision.saving || lead.saving,
    actions: availableDecisions(signal.review_status),
  }
}

export type SignalCardState = ReturnType<typeof useSignalCard>

const variantOf = (action: DecisionAction) => (action.tone === 'primary' ? 'default' : action.tone === 'danger' ? 'outline' : 'secondary')

/**
 * The card's buttons: the decisions that fit its status (Contacted, Reviewed, Not relevant…, or Reopen… on a dismissed one), "Convert to lead" (or
 * "Lead created" with a link, once there is one), and "Convert to opportunity" (or its opportunity). Each decision opens the dialog; nothing is sent by the button alone. Also holds the dialogs themselves.
 */
export function SignalCardActions({ card, signal, reasons }: { card: SignalCardState; signal: Opportunity; reasons: ReasonOption[] }) {
  const noReasons = reasons.length === 0
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Decide on this signal">
          {card.actions.map((action) => (
            <Button
              key={action.decision}
              type="button"
              size="sm"
              variant={variantOf(action)}
              className={action.tone === 'danger' ? 'border-destructive' : undefined}
              disabled={card.saving || card.forbidden || (action.decision === 'dismissed' && noReasons)}
              onClick={() => card.begin(action.decision)}
            >
              {action.label}
            </Button>
          ))}
        </div>
        <SignalLeadAction lead={leadOf(signal)} saving={card.lead.saving} disabled={card.decision.saving || card.lead.forbidden} onRequest={card.requestLead} />
        <SignalFunnelActions funnel={card.funnel} signal={signal} disabled={card.decision.saving || card.lead.saving} />
      </div>
      <SignalDecisionDialog {...card.decision.dialog} signalTitle={signal.title} currentStatus={signal.review_status} reasons={reasons} />
      {card.lead.confirmDialog}
    </>
  )
}

/** What the last decision or lead action said, under the card's buttons: a confirmation, a refusal, or why "Not relevant…" is unavailable. */
export function SignalCardMessages({ card, reasons }: { card: SignalCardState; reasons: ReasonOption[] }) {
  const needsReasons = reasons.length === 0 && card.actions.some((a) => a.decision === 'dismissed')
  return (
    <>
      {card.notice && <p role="status" className={cn('w-full rounded-lg border p-2.5 text-sm', BANNER_TONE.success)}>{card.notice}</p>}
      {card.forbidden && <p role="alert" className="w-full rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-sm">{FORBIDDEN_TEXT}</p>}
      <LeadFeedbackMessage feedback={card.lead.feedback} />
      <FunnelFeedbackMessage feedback={card.funnel.feedback} />
      {needsReasons && <p className="w-full text-xs text-muted-foreground">“Not relevant” needs the list of reasons, which has not loaded. Reload the page to try again.</p>}
    </>
  )
}

/**
 * The Signal Review drawer's own sections, for the card's "Evidence and details": the source's wording and date, "Fit & score", and "Decision history". The
 * history appears once it has been asked for (the details were opened).
 */
export function SignalCardDetails({ card, signal, products }: { card: SignalCardState; signal: Opportunity; products?: readonly ProductFilterOption[] }) {
  const id = useId()
  return (
    <>
      <SignalEvidence signal={signal} products={products} idPrefix={`${id}-ev`} heading="The source's wording and date" />
      <section aria-labelledby={`${id}-fit`} className="space-y-2">
        <h4 id={`${id}-fit`} className={HEADING}>Fit &amp; score</h4>
        <SignalFitScore signal={signal} products={products} idPrefix={`${id}-fs`} />
      </section>
      {card.requested && (
        <section aria-labelledby={`${id}-history`} className="space-y-2">
          <h4 id={`${id}-history`} className={HEADING}>Decision history</h4>
          <SignalHistoryList entries={card.history.entries} loading={card.history.loading} error={card.history.error} onRetry={card.retryHistory} />
        </section>
      )}
    </>
  )
}
