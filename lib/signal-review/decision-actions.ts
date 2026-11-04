import type { DecisionDialogSubmit, DecisionRequest, HistoryDecisionCode, ReviewDecisionCode, ReviewStatus } from '@/services/signal-review/types'

/** One button in the drawer: the decision it opens the dialog for, its words and how prominent it is. */
export interface DecisionAction {
  decision: ReviewDecisionCode
  label: string
  /** "Not relevant" and "Reopen" ask for more than a click, so their labels end in an ellipsis. */
  tone: 'primary' | 'secondary' | 'danger'
}

const CONTACTED: DecisionAction = { decision: 'follow_up', label: 'Contacted', tone: 'primary' }
const REVIEWED: DecisionAction = { decision: 'reviewed', label: 'Reviewed', tone: 'secondary' }
const NOT_RELEVANT: DecisionAction = { decision: 'dismissed', label: 'Not relevant…', tone: 'danger' }
const REOPEN: DecisionAction = { decision: 'reopened', label: 'Reopen…', tone: 'secondary' }

/**
 * The decisions a person can take on a signal in its current status. A button for the status it already has is not offered (the server would answer
 * "unchanged"), a signal that needs a decision cannot be reopened (same answer), and a dismissed signal can only be reopened: that is the way back.
 */
export function availableDecisions(status: ReviewStatus): DecisionAction[] {
  switch (status) {
    case 'New': return [CONTACTED, REVIEWED, NOT_RELEVANT]
    case 'Follow-up': return [REVIEWED, NOT_RELEVANT]
    case 'Reviewed': return [CONTACTED, NOT_RELEVANT]
    case 'Dismissed': return [REOPEN]
    default: return []
  }
}

/**
 * The request for an answer from the dialog. `expected_status` is always the status the person was looking at, so the server can tell them when someone
 * decided first. A reason is sent only with a dismissal, and a blank note is not sent at all.
 */
export function buildDecisionRequest(answer: DecisionDialogSubmit, expectedStatus: ReviewStatus): DecisionRequest {
  const note = answer.note?.trim()
  return {
    decision: answer.decision,
    ...(answer.decision === 'dismissed' && answer.reason_code ? { reason_code: answer.reason_code } : {}),
    ...(note ? { note } : {}),
    expected_status: expectedStatus,
  }
}

/** The confirmation shown in the drawer once a decision is saved. Plain words, so a screen reader announcing it is understood. */
export function decisionNotice(decision: HistoryDecisionCode): string {
  switch (decision) {
    case 'reviewed': return 'Marked as reviewed.'
    case 'dismissed': return 'Marked as not relevant.'
    case 'follow_up': return 'Marked as contacted.'
    case 'reopened': return 'Reopened. It is back in the list that needs a decision.'
    default: return 'Saved.'
  }
}

/** What a decision turns the signal into; the same table as the contract's. */
export function statusAfter(decision: ReviewDecisionCode): ReviewStatus {
  switch (decision) {
    case 'reviewed': return 'Reviewed'
    case 'dismissed': return 'Dismissed'
    case 'follow_up': return 'Follow-up'
    case 'reopened': return 'New'
  }
}
