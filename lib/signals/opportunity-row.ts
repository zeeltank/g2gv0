import type { SignalDecisionResponse } from '@/services/signal-review/signal-types'
import type { ReviewStatus } from '@/services/signal-review/types'
import type { Opportunity, OpportunityListResponse } from '@/services/signals/opportunities'
import { applyStatusChange } from './list-model'

/**
 * A Company Opportunities card changing in place, with no reload: a decision was saved, the status turned out to be someone else's, or a lead was made.
 * Pure, so the counts above the list are proved to agree with the rows under them.
 */

/** The signal after a decision was saved. Only what a decision changes is taken from the answer; every other field of the card keeps its value. */
export function applyDecision(signal: Opportunity, result: SignalDecisionResponse): Opportunity {
  const { review_status, review_notes, reviewed_at } = result.data
  return {
    ...signal,
    review_status,
    review_notes: review_notes !== undefined ? review_notes : signal.review_notes,
    reviewed_at: reviewed_at !== undefined ? reviewed_at : signal.reviewed_at,
  }
}

/** The signal with the status someone else's decision gave it (the 409 told us). */
export function withStatus(signal: Opportunity, status: ReviewStatus): Opportunity {
  return signal.review_status === status ? signal : { ...signal, review_status: status }
}

/**
 * The list with one signal replaced by its new version, and the four counts above the list moved with it, so they agree with the row without asking the
 * server again. A signal that is not on this page changes nothing.
 */
export function replaceRow(response: OpportunityListResponse, next: Opportunity): OpportunityListResponse {
  const before = response.data.find((row) => row.id === next.id)
  if (!before) return response
  return {
    ...response,
    data: response.data.map((row) => (row.id === next.id ? next : row)),
    summary: before.review_status !== next.review_status ? applyStatusChange(response.summary, before, before.review_status, next.review_status) : response.summary,
  }
}
