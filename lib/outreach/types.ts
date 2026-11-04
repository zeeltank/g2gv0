/**
 * The shapes of the outreach checks (hp_erp slice 10, docs/agentic-crm/slices/S10-outreach-gate.md). They live here and not in types/crm.ts because the checks
 * belong to the GTM Outreach screen and that file is another track's.
 *
 * Every field is what the CLIENT keeps after reading the server's answer through lib/outreach/model.ts; nothing here is the raw wire format.
 */

/** The two tables a draft can be in. This screen only ever asks about the first. */
export type GateTable = 'gtm_outreach_messages' | 'crm_emails'

export const GTM_MESSAGES: GateTable = 'gtm_outreach_messages'

/** One check, as a person sees it: a key (what was checked), the server's label, whether it passed, and why in the server's words. */
export interface GateCheck {
  key: string
  label: string
  passed: boolean
  detail: string
}

/** The answer of one run of the checks. `passed` is the CLIENT's verdict (see summarize): it is false unless every check passed. */
export interface GateReport {
  checks: GateCheck[]
  /** True only when at least one check was returned, every one passed, and the server did not say otherwise. */
  passed: boolean
  /** When the server ran them (ISO 8601), or null when it did not say. */
  checkedAt: string | null
}

/** One approved sentence of a product (g2g_product_claims). Read-only on this screen. */
export interface ApprovedClaim {
  id: number
  productId: number | null
  productName: string | null
  claim: string
  sourceUrl: string | null
}

export interface ClaimList {
  claims: ApprovedClaim[]
  /** How many approved claims the server holds for the question asked, which can be more than `claims` holds. */
  total: number
}

/** What a failed request means for the section. The rest of the screen works the same in every case. */
export type GateFailure =
  /** 404 or 403: this server has no gate, or this person has no right to it. Retrying cannot help. */
  | { kind: 'unavailable'; message: string }
  /** 429: too many checks in a minute. Retrying helps after a moment. */
  | { kind: 'busy'; message: string }
  /** Anything else: a network failure, a 5xx, an answer that is not the contract. A retry may help. */
  | { kind: 'error'; message: string }

/** The shape of what `lib/outreach/model.ts` needs from a message of the Outreach list; every field is optional. */
export interface MessageFacts {
  subject?: unknown
  body?: unknown
  contact_email?: unknown
  contact_status?: unknown
  product_master_id?: unknown
}
