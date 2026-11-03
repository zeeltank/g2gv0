'use client'

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import { RecordDrawer } from '@/components/shared/scaffolds/record-drawer'
import { availableDecisions, decisionNotice } from '@/lib/signal-review/decision-actions'
import { FORBIDDEN_TEXT } from '@/lib/signal-review/decision-failure'
import type { SignalReviewApi } from '@/services/signal-review/signal-review-service'
import type { ProductFilterOption, SignalDecisionResponse, SignalRow } from '@/services/signal-review/signal-types'
import type { DecisionDialogProps, HistoryListProps, ReasonOption, ReviewHistoryEntry } from '@/services/signal-review/types'
import { SignalDecisionDialog } from './signal-decision-dialog'
import { SignalHistoryList } from './signal-history-list'
import { useSignalDecision } from './signal-review-decision'
import { SignalDateBadge, SignalEvidence, SignalProductChip, SignalStatusChip } from './signal-review-parts'

/** The two parts built separately. A screen leaves this out; a test hands in stand-ins to see exactly what they are given. */
export interface SignalReviewDrawerParts {
  DecisionDialog?: ComponentType<DecisionDialogProps>
  HistoryList?: ComponentType<HistoryListProps>
}

export interface SignalReviewDrawerProps {
  signal: SignalRow
  open: boolean
  service: Pick<SignalReviewApi, 'decide' | 'get' | 'history'>
  /** The reasons for "Not relevant", from the server. */
  reasons: ReasonOption[]
  products?: readonly ProductFilterOption[]
  /** The signal changed (a decision saved, or its status turned out to be different): the screen updates the row. */
  onChanged: (signal: SignalRow) => void
  onClose: () => void
  parts?: SignalReviewDrawerParts
}

/**
 * One signal in a side drawer: why it matters, the evidence it rests on, every decision made on it, and the buttons to decide. It opens on the row the
 * screen already holds (nothing waits for the network) and fetches the history when it opens. Deciding goes through the dialog; on success the row and the
 * drawer change in place, with no reload.
 */
export function SignalReviewDrawer(props: SignalReviewDrawerProps) {
  // One mount per signal, so a decision's half-finished state can never leak from one signal to the next.
  return <DrawerBody key={props.signal.id} {...props} />
}

type HistoryState = { entries: ReviewHistoryEntry[] | null; loading: boolean; error: string | null }

function DrawerBody({ signal, open, service, reasons, products, onChanged, onClose, parts }: SignalReviewDrawerProps) {
  const DecisionDialog = parts?.DecisionDialog ?? SignalDecisionDialog
  const HistoryList = parts?.HistoryList ?? SignalHistoryList

  const [history, setHistory] = useState<HistoryState>({ entries: null, loading: true, error: null })
  const [notice, setNotice] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  // The row the screen holds can be replaced under the drawer (a decision, a refresh): later work must act on the newest one.
  const current = useRef(signal)
  useEffect(() => { current.current = signal })
  useEffect(() => { historyNow.current = history })

  const historyNow = useRef<HistoryState>({ entries: null, loading: true, error: null })
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

  useEffect(() => {
    if (open) queueMicrotask(() => { void loadHistory() })
  }, [open, loadHistory])

  // The server's version of this signal, for when the screen's copy turned out to be out of date and the 409 did not say what is current.
  const refresh = useCallback(async () => {
    try {
      const response = await service.get(current.current.id)
      onChanged({ ...current.current, ...response.data })
    } catch {
      // The row stays as it is; the next load of the list corrects it.
    }
  }, [service, onChanged])

  const onSaved = useCallback((result: SignalDecisionResponse) => {
    // The answer is the signal's new version; fields it leaves out keep their value (a decision changes none of them).
    onChanged({ ...current.current, ...result.data })
    setNotice(decisionNotice(result.review.decision))
    const loaded = historyNow.current.entries
    // The history already on screen gains the new row at the top; a history that never loaded is fetched, and then includes it.
    if (loaded) setHistory({ entries: loaded.some((e) => e.id === result.review.id) ? loaded : [result.review, ...loaded], loading: false, error: null })
    else void loadHistory()
  }, [onChanged, loadHistory])

  const onStale = useCallback((entry: ReviewHistoryEntry | null) => {
    setNotice(null)
    if (entry) onChanged({ ...current.current, review_status: entry.to_status })
    else void refresh()
    void loadHistory()
  }, [onChanged, refresh, loadHistory])

  const onForbidden = useCallback(() => setForbidden(true), [])

  const decision = useSignalDecision({ service, signal, onSaved, onStale, onForbidden })
  const actions = availableDecisions(signal.review_status)
  const noReasons = reasons.length === 0
  const company = signal.company_name

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        busy={decision.saving}
        title={signal.title}
        description={<>{company}<span className="sr-only"> · </span> <SignalStatusChip status={signal.review_status} /></>}
        footer={(requestClose) => (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Decide on this signal">
              {actions.map((action) => (
                <Button
                  key={action.decision}
                  type="button"
                  size="sm"
                  variant={action.tone === 'primary' ? 'default' : action.tone === 'danger' ? 'outline' : 'secondary'}
                  className={action.tone === 'danger' ? 'border-destructive text-destructive hover:bg-destructive/10' : undefined}
                  disabled={decision.saving || forbidden || (action.decision === 'dismissed' && noReasons)}
                  onClick={() => { setNotice(null); decision.open(action.decision) }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={requestClose}>Close</Button>
          </div>
        )}
      >
        <div className="space-y-5">
          {notice && <p role="status" className="rounded-lg border border-success/30 bg-success/10 p-2.5 text-sm text-success">{notice}</p>}
          {forbidden && <p role="alert" className="rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-sm">{FORBIDDEN_TEXT}</p>}
          {noReasons && actions.some((a) => a.decision === 'dismissed') && (
            <p className="text-xs text-muted-foreground">“Not relevant” needs the list of reasons, which has not loaded. Reload the page to try again.</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <SignalDateBadge info={signal.date_info} />
            <SignalProductChip name={signal.product_master_name} />
          </div>

          <section aria-labelledby="sr-why-heading" className="space-y-1">
            <h3 id="sr-why-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why it matters</h3>
            <p className="text-sm">{signal.why_indicates_need || signal.observed_event || 'No explanation was recorded for this signal.'}</p>
          </section>

          <SignalEvidence signal={signal} products={products} />

          <section aria-labelledby="sr-history-heading" className="space-y-2">
            <h3 id="sr-history-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</h3>
            <HistoryList entries={history.entries} loading={history.loading} error={history.error} onRetry={() => void loadHistory()} />
          </section>
        </div>
      </RecordDrawer>

      <DecisionDialog
        {...decision.dialog}
        signalTitle={signal.title}
        currentStatus={signal.review_status}
        reasons={reasons}
      />
    </>
  )
}
