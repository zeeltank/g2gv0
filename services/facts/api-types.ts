import type { ConsentData, FactDecisionResult, FactEntityType, FactsEntityData, FactsEnvelope, FactsQueueData, FactStatus } from './types'

/** The queue's query as the API takes it. A missing value is left out, so the server applies no filter for it. */
export interface FactsQueueParams {
  /** Only the facts about one kind of record. Without it: every kind the person may view. */
  type?: FactEntityType
  /** The suggestions screen asks for `proposed` (waiting for a person). */
  status?: FactStatus
  page?: number
  per_page?: number
}

/** What the facts screens need from the server. Components take this shape, so a test can hand them a fake. */
export interface FactsApi {
  /** Every fact about one record, with its evidence, and how many are waiting, accepted and dismissed. */
  entity(type: FactEntityType, id: number | string): Promise<FactsEnvelope<FactsEntityData>>
  /** The suggestions waiting for a person across the organisation, newest first, each with the name of its record. */
  queue(params: FactsQueueParams): Promise<FactsEnvelope<FactsQueueData>>
  /** Accepts a waiting fact: it is kept in the ledger and written to the record's own field only when that field is blank. Accepting twice changes nothing: a 409 `not_pending`. */
  accept(factId: number | string): Promise<FactDecisionResult>
  /** Dismisses a waiting fact; the same value is never offered again. The reason is optional. */
  dismiss(factId: number | string, reason?: string): Promise<FactDecisionResult>
  /** Whether each channel may be used for this record, and why not (read through the one consent gate). */
  consent(type: FactEntityType, id: number | string): Promise<FactsEnvelope<ConsentData>>
}
