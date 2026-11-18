/**
 * The facts API (hp_erp `/api/facts` and `/api/consent`; contract: hp_erp docs/agentic-crm/slices/S04-contact-facts-and-consent.md, section "Contract").
 * Names are the API's own snake_case. A fact is something an agent or a source SUGGESTED about a contact, an organisation or a lead (an email address, a
 * phone number, a website), with the evidence it rests on; a person accepts or dismisses it.
 *
 * `null` always means "not known" or "does not apply", never zero or empty. EVERYTHING in a fact that came from the web or a model (the value, a quote, a
 * source address, a label) is PLAIN TEXT and must be shown as text.
 */

/** The three kinds of record that can have facts. */
export type FactEntityType = 'contact' | 'organization' | 'lead'

/** proposed: waiting for a person. applied: a person accepted it. dismissed: a person said no (never offered again). superseded: replaced by a newer accepted value. */
export type FactStatus = 'proposed' | 'applied' | 'dismissed' | 'superseded'

/** How sure the ledger is: verified needs a primary source, probable and possible are the lower bands. */
export type FactBand = 'verified' | 'probable' | 'possible'

/** `role` is the address of a role (principal@, admissions@), `personal` any other; null for a field where it does not apply. */
export type FactValueKind = 'personal' | 'role'

/** One independent source a fact rests on. The label is plain English from the server's weights table. */
export interface FactEvidence {
  kind: string
  label: string
  /** 0..1: how much this kind of evidence counts. */
  weight: number
  source_url: string | null
  /** The wording copied from the source. */
  quote: string | null
  retrieved_at: string | null
}

export interface Fact {
  id: number
  entity_type: FactEntityType
  entity_id: number
  /** The field's key (`email`, `phone`, `website`, `linkedin_url`, `title`, ...). */
  field: string
  /** The field in words ("Email address"). */
  field_label?: string
  value: string
  value_kind: FactValueKind | null
  status: FactStatus
  band: FactBand
  /** 0..1 */
  score: number
  method: string | null
  source_url: string | null
  proposed_by: string | null
  decided_by_name: string | null
  decided_at: string | null
  evidence: FactEvidence[]
  /** Why it has this band, in a sentence from the weights. */
  rationale?: string
  /** True when accepting this fact wrote the record's own column; false means it is kept in the ledger only. Only meaningful once applied. */
  column_written?: boolean
  /** What the record's column holds now, so a person sees it next to the suggestion. null when the field has no column on this kind of record. */
  record_value?: string | null
  /** The reason a person gave when dismissing it. */
  decision_note?: string | null
  supersedes_id?: number | null
  created_at?: string | null
  /** Queue rows only: the name of the record the fact is about. */
  entity_name?: string | null
}

export interface FactCounts {
  proposed: number
  applied: number
  dismissed: number
}

/**
 * What the server says this person may do, where it says so (hp_erp FactsController: `can.decide` on a record's facts is the edit right on that kind of record; on
 * the queue it is "the edit right on at least one kind" and `decide_types` lists the kinds). Absent on a server that does not say: the buttons then show and the
 * server decides, and a 403 takes them away.
 */
export interface FactCan {
  decide: boolean
  /** The queue only: the kinds of record this person may decide facts of. */
  decide_types?: FactEntityType[]
}

export interface FactsEntityData {
  entity: { type: FactEntityType; id: number; name: string | null }
  facts: Fact[]
  counts: FactCounts
  can?: FactCan
}

export interface FactsQueueData {
  rows: Fact[]
  pagination: { page: number; per_page: number; total: number }
  can?: FactCan
}

export interface FactsEnvelope<T> {
  status: 1
  data: T
}

export type FactDecisionOutcome = 'applied' | 'dismissed'

export interface FactDecisionResult {
  status: 1
  data: { outcome: FactDecisionOutcome; fact: Fact }
}

// ── Consent ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ConsentChannelKey = 'email' | 'sms' | 'whatsapp'

/** Why a channel is not allowed, as a code a newer server may extend. */
export type ConsentCode =
  | 'opted_out' | 'suppressed' | 'suppression_list' | 'outreach_contact_blocked' | 'preference_opted_out' | 'no_consent_recorded' | 'no_address' | 'unknown_recipient'

export interface ConsentChannel {
  allowed: boolean
  /** A sentence for a person; null when nothing blocks the channel. */
  reason: string | null
  code?: ConsentCode | (string & {}) | null
}

export interface ConsentSource {
  /** Where the answer was read from (the opt-out flag, a recorded preference, the suppression list, ...). */
  source: string
  value: string | null
  at: string | null
}

export interface ConsentData {
  channels: Partial<Record<ConsentChannelKey, ConsentChannel>>
  sources: ConsentSource[]
}
