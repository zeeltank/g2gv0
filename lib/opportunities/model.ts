import { readableText, whole } from '@/lib/leads/model'
import type { PmOption } from '@/services/product-master/types'
import type {
  CrmOpportunity, CrmOpportunityPipelineResponse, CrmOpportunityStageChangePayload, OpportunityLossReasonOption, OpportunityLossReasonRef, OpportunityProductRef,
} from '@/types/crm'

/**
 * The rules of the opportunity screens' agentic additions (slice 11b, hp_erp docs/agentic-crm/slices/S11-pipeline-and-forecast.md) that need no browser: how the
 * server's new fields are read, when the Product column shows, what the Product and Reason choices offer and send, the words of the loss reason, and how a
 * refusal is understood. Tested on their own (lib/opportunities/model.test.ts).
 *
 * Nothing here is allowed to need the backend: every new field is optional and a missing key means "this server does not say", never "none". `whole` and
 * `readableText` are the Leads screen's own readers (lib/leads/model.ts), reused and not copied.
 */

// ── Reading the server's answer ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null)

/** The first of these names the object has, so the contract's snake_case and a camelCase spelling are both read. `found` tells "sent as null" from "not sent". */
function pick(source: Record<string, unknown>, ...names: string[]): { found: boolean; value: unknown } {
  for (const name of names) if (name in source) return { found: true, value: source[name] }
  return { found: false, value: undefined }
}

function readProduct(value: unknown): OpportunityProductRef | null {
  const r = record(value)
  const id = r ? whole(r.id) : null
  if (!r || id === null) return null
  return { id, key: readableText(r.key), name: readableText(r.name) ?? `Product #${id}` }
}

function readLossReason(value: unknown): OpportunityLossReasonRef | null {
  const r = record(value)
  const code = r ? readableText(r.code) : null
  if (!r || code === null) return null
  return { code, label: readableText(r.label) ?? code }
}

/**
 * The fields slice 11 adds to an opportunity, read from whatever the server sent. Only the fields the server SENT are in the answer: a key it left out stays
 * out, so the screens can tell an older server (no key) from an opportunity with nothing to show (`null`).
 */
export function readOpportunityExtras(raw: unknown): Pick<CrmOpportunity, 'product' | 'lossReason'> {
  const source = record(raw) ?? {}
  const out: Pick<CrmOpportunity, 'product' | 'lossReason'> = {}

  const product = pick(source, 'product')
  if (product.found) out.product = readProduct(product.value)

  const reason = pick(source, 'loss_reason', 'lossReason')
  if (reason.found) out.lossReason = readLossReason(reason.value)

  return out
}

/** An opportunity as the server sent it, with the fields of slice 11 read into the names the screens use. */
export function withOpportunityExtras(raw: CrmOpportunity): CrmOpportunity {
  return { ...raw, ...readOpportunityExtras(raw) }
}

/**
 * The loss reasons the pipeline answer lists. `undefined` when the server did not say (an older server, or an answer that is not a list); an empty list when it
 * said there are none. Entries without a readable code are dropped, a repeated code is kept once, and a label that is missing is the code.
 */
export function readLossReasons(raw: unknown): OpportunityLossReasonOption[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const out: OpportunityLossReasonOption[] = []
  for (const item of raw) {
    const entry = readLossReason(item)
    if (!entry || seen.has(entry.code)) continue
    seen.add(entry.code)
    out.push(entry)
  }
  return out
}

/** The pipeline answer's data with its `lossReasons` read; the key is left out when the server did not say, so an older server's answer comes back as it was. */
export function withPipelineReasons(data: CrmOpportunityPipelineResponse['data']): CrmOpportunityPipelineResponse['data'] {
  const { lossReasons: raw, ...rest } = data as CrmOpportunityPipelineResponse['data'] & { lossReasons?: unknown }
  const read = readLossReasons(raw)
  return read === undefined ? rest : { ...rest, lossReasons: read }
}

// ── The stage ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Closed Lost, however the stage is spelled in the picklist (the server compares without regard to case too). */
export function isClosedLost(stage: string | null | undefined): boolean {
  return (stage ?? '').trim().toLowerCase() === 'closed lost'
}

/** A move INTO Closed Lost: the only moment a reason is asked for (editing a deal that is already lost does not ask again). */
export const entersClosedLost = (fromStage: string | null | undefined, toStage: string | null | undefined): boolean => isClosedLost(toStage) && !isClosedLost(fromStage)

// ── The words ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const NO_PRODUCT_TEXT = 'No product chosen'

/** The product line of an opportunity: null when the server did not say (the line is not drawn), else the name or "No product chosen". */
export function productText(product: OpportunityProductRef | null | undefined): string | null {
  if (product === undefined) return null
  return product ? product.name : NO_PRODUCT_TEXT
}

export interface LossReasonView {
  /** The coded reason in words; null when only free text was given. */
  label: string | null
  /** What the person wrote; null when there is none, or when it is only the label again (the server fills an empty free text with the code's label). */
  note: string | null
}

/** What the "Reason Lost" card says. null when there is nothing to say, so no card is drawn. */
export function lossReasonView(lossReason: OpportunityLossReasonRef | null | undefined, closeReason: string | null | undefined): LossReasonView | null {
  const label = lossReason ? lossReason.label : null
  const text = readableText(closeReason)
  const note = text !== null && label !== null && text.toLowerCase() === label.trim().toLowerCase() ? null : text
  return label === null && note === null ? null : { label, note }
}

// ── The list's Product column ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The Product column shows once any opportunity the list has loaded has a product, and keeps its place while the person pages, so it does not come and go. */
export function noteProductSeen(seen: boolean, opportunities: readonly Pick<CrmOpportunity, 'product'>[]): boolean {
  return seen || opportunities.some((opportunity) => !!opportunity.product)
}

/** Columns of the table, for the rows that span it (loading, empty): the tick box and the five it has always had, plus Product when it shows. */
export const opportunityColumnCount = (showProduct: boolean): number => 6 + (showProduct ? 1 : 0)

// ── The Product choice on the form ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Choice {
  value: string
  label: string
}

export const NO_PRODUCT_CHOICE = 'No product'

/**
 * "No product" and every product the Product Master lists. A product the opportunity already has that the list does not hold (archived since) is kept under its
 * own name, so the box never shows a wrong value and a person can still clear it.
 */
export function productChoices(options: readonly PmOption[], current: OpportunityProductRef | null): Choice[] {
  const choices: Choice[] = [{ value: '', label: NO_PRODUCT_CHOICE }, ...options.map((option) => ({ value: String(option.id), label: option.label }))]
  if (current && !choices.some((choice) => choice.value === String(current.id))) choices.push({ value: String(current.id), label: current.name })
  return choices
}

/** The Product choice is drawn when there is a product to choose, or one is already chosen (so it can be cleared). */
export const showProductChoice = (options: readonly PmOption[], current: OpportunityProductRef | null): boolean => options.length > 0 || current !== null

/** The product a Product box value means: the id, or null for "No product" (and for anything that is not an id). */
export const chosenProduct = (value: string): number | null => whole(value)

/**
 * The product part of a create or edit request. Left out unless the person chose or changed it: a new opportunity with no product sends nothing, an edit that
 * left the product alone sends nothing (so a form can never undo a link it did not show, and an older server that cannot store one is never asked to), and a
 * cleared product is sent as null.
 */
export function productPayload(originalId: number | null, chosenId: number | null, editing: boolean): { productMasterId?: number | null } {
  if (editing) return originalId === chosenId ? {} : { productMasterId: chosenId }
  return chosenId === null ? {} : { productMasterId: chosenId }
}

// ── The Reason choice ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const NO_REASON_CHOICE = 'Choose a reason…'

/** The reasons the server lists, in its order, after the prompt. A code the opportunity already carries that the list no longer holds is kept under its own label. */
export function reasonChoices(reasons: readonly OpportunityLossReasonOption[], current: OpportunityLossReasonRef | null): Choice[] {
  const choices: Choice[] = [{ value: '', label: NO_REASON_CHOICE }, ...reasons.map((reason) => ({ value: reason.code, label: reason.label }))]
  if (current && !choices.some((choice) => choice.value === current.code)) choices.push({ value: current.code, label: current.label })
  return choices
}

/**
 * The reason part of a create or edit request: only for a deal that ends up Closed Lost (the server refuses a code on any other, and clears it when a lost
 * deal is reopened). On an edit it is left out when the person did not change it, and a cleared one is sent as null.
 */
export function lossReasonPayload(stage: string | null | undefined, chosen: string, original: string | null, editing: boolean): { lossReasonCode?: string | null } {
  if (!isClosedLost(stage)) return {}
  const code = chosen.trim()
  if (code === '') return editing && original ? { lossReasonCode: null } : {}
  return editing && original === code ? {} : { lossReasonCode: code }
}

/** The body of a stage move from the board. A reason goes with a move into Closed Lost only; the free text only when the person wrote some. */
export function stageChangePayload(stage: string, answer?: { code: string; note: string }): CrmOpportunityStageChangePayload {
  if (!isClosedLost(stage) || !answer) return { salesStage: stage }
  const code = answer.code.trim()
  const note = answer.note.trim()
  return { salesStage: stage, ...(code !== '' ? { lossReasonCode: code } : {}), ...(note !== '' ? { closeReason: note } : {}) }
}

export const REASON_NEEDED_WITH_LIST = 'Choose why this opportunity was lost, or write it in your own words.'
export const REASON_NEEDED_WITHOUT_LIST = 'Say why this opportunity was lost - it is the only way the pipeline learns from it.'

/**
 * Why a move into Closed Lost cannot be sent yet: null when a reason (a code, or some words) is there. This is the rule the server has always had (a free-text
 * reason is enough, and so is a code); whether the server also REQUIRES a code is its own switch and arrives as a refusal.
 */
export function lossReasonProblem(reasons: readonly OpportunityLossReasonOption[], code: string, note: string): string | null {
  if (code.trim() !== '' || note.trim() !== '') return null
  return reasons.length > 0 ? REASON_NEEDED_WITH_LIST : REASON_NEEDED_WITHOUT_LIST
}

// ── A list the person may not read ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The server said "not allowed" (403) or "no such list" (404). The API client's error carries the status; anything else (a dropped connection, a 500) is not this. */
export function isNoAccess(error: unknown): boolean {
  const status = record(error)?.status
  return status === 403 || status === 404
}

// ── A refusal ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Refusal {
  /** The server's own sentence, or the fallback when it gave none. */
  message: string
  /** The refusal is about the loss reason (the server filed it under `lossReasonCode`), so it belongs next to the Reason box. */
  onReason: boolean
}

/**
 * How a failed save is understood. The API client keeps a refusal's `message` and `errors` but not its `code`, so "a reason is required" is recognised by
 * the field the server filed the refusal under, `lossReasonCode`, which is how the server answers both `loss_reason_required` and `loss_reason_not_lost`.
 */
export function readRefusal(error: unknown, fallback: string): Refusal {
  const message = error instanceof Error && error.message.trim() !== '' ? error.message.trim() : fallback
  const errors = record(record(error)?.errors)
  return { message, onReason: !!errors && ('lossReasonCode' in errors || 'loss_reason_code' in errors) }
}
