import type { ListQueryConfig } from '@/components/shared/scaffolds/list-query'
import { fitLabel } from '@/lib/signal-review/list-model'
import { formatDay, safeHttpUrl } from '@/lib/signal-review/signal-display'
import type { Fact } from '@/services/facts/types'
import type { PmOption } from '@/services/product-master/types'
import type {
  Lead, LeadConsent, LeadConsentChannel, LeadConsentFilter, LeadListQuery, LeadOrganisationAccountRef, LeadProductRef, LeadSourceSignal,
} from '@/types/crm'

/**
 * The rules of the Leads screen's agentic additions (slice 6, hp_erp docs/agentic-crm/slices/S06-leads.md) that need no browser: how the server's new
 * fields are read, how the filters live in the address and become a request, when the extra columns show, what a consent chip and its reason say, what the
 * Evidence tab shows about the signal a lead came from, and which fact writes which field of a lead. Tested on their own (lib/leads/model.test.ts).
 *
 * Nothing here is allowed to need the backend: every new field is optional and a missing one means "this server does not say", never "none".
 */

// ── Reading the server's answer ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null)

/** A whole number from 1 up, from a number or a string of digits; anything else (0, negative, 1.5, "abc", null) is null. */
export function whole(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN
  return Number.isSafeInteger(n) && n >= 1 ? n : null
}

/** Text a person may read: a string with something in it. Blank and non-strings are null. */
export function readableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** The first of these names the object has, so the contract's snake_case and the presenter's camelCase are both read. `found` tells "sent as null" from "not sent". */
function pick(source: Record<string, unknown>, ...names: string[]): { found: boolean; value: unknown } {
  for (const name of names) if (name in source) return { found: true, value: source[name] }
  return { found: false, value: undefined }
}

function readProduct(value: unknown): LeadProductRef | null {
  const r = record(value)
  const id = r ? whole(r.id) : null
  if (!r || id === null) return null
  return { id, key: readableText(r.key), name: readableText(r.name) ?? `Product #${id}` }
}

function readOrganisation(value: unknown): LeadOrganisationAccountRef | null {
  const r = record(value)
  const id = r ? whole(r.id) : null
  if (!r || id === null) return null
  return { id, name: readableText(r.name) ?? `Organisation #${id}` }
}

/** Only the two kinds the server names; anything else is "not said" (null), so a made-up kind never reads as a quote. */
function quoteKindOf(value: unknown): 'excerpt' | 'observed_event' | null {
  return value === 'excerpt' || value === 'observed_event' ? value : null
}

function readSignal(value: unknown): LeadSourceSignal | null {
  const r = record(value)
  const id = r ? whole(r.id) : null
  if (!r || id === null) return null
  return {
    id,
    title: readableText(r.title),
    sourceUrl: readableText(pick(r, 'source_url', 'sourceUrl').value),
    eventDate: readableText(pick(r, 'event_date', 'eventDate').value),
    sourcePublishedAt: readableText(pick(r, 'source_published_at', 'sourcePublishedAt').value),
    businessFit: readableText(pick(r, 'business_fit', 'businessFit').value),
    quote: readableText(r.quote),
    quoteKind: quoteKindOf(pick(r, 'quote_kind', 'quoteKind').value),
  }
}

function readChannel(value: unknown): LeadConsentChannel | null {
  const r = record(value)
  if (!r || typeof r.allowed !== 'boolean') return null
  return { allowed: r.allowed, reason: readableText(r.reason) }
}

function readConsent(value: unknown): LeadConsent | null {
  const r = record(value)
  if (!r) return null
  const email = readChannel(r.email)
  const sms = readChannel(r.sms)
  return { ...(email ? { email } : {}), ...(sms ? { sms } : {}) }
}

/**
 * The fields slice 6 adds, read from whatever the server sent. Only the fields the server SENT are in the answer: a key it left out stays out, so the
 * screens can tell an older server (no key) from a lead with nothing to show (`null`).
 */
export function readLeadExtras(raw: unknown): Pick<Lead, 'product' | 'organisationAccount' | 'sourceSignalId' | 'sourceSignal' | 'consent'> {
  const source = record(raw) ?? {}
  const out: Pick<Lead, 'product' | 'organisationAccount' | 'sourceSignalId' | 'sourceSignal' | 'consent'> = {}

  const product = pick(source, 'product')
  if (product.found) out.product = readProduct(product.value)

  const organisation = pick(source, 'organisation_account', 'organisationAccount')
  if (organisation.found) out.organisationAccount = readOrganisation(organisation.value)

  const signalId = pick(source, 'source_signal_id', 'sourceSignalId')
  if (signalId.found) out.sourceSignalId = whole(signalId.value)

  const signal = pick(source, 'source_signal', 'sourceSignal')
  if (signal.found) out.sourceSignal = readSignal(signal.value)

  const consent = pick(source, 'consent')
  if (consent.found) out.consent = readConsent(consent.value)

  return out
}

/** A lead as the server sent it, with the fields of slice 6 read into the names the screens use. */
export function withLeadExtras(raw: Lead): Lead {
  return { ...raw, ...readLeadExtras(raw) }
}

// ── The filters ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Defined once, outside any component (useListQuery depends on it). The addresses use the contract's own names: `?product_id=12&consent=blocked&has_signal=1`.
 * Only the three filters live in the address; the Leads screen keeps its search, sort and page as it always has. `product_id` accepts any text here and
 * `leadFilters` makes a number of it, so a mistyped address opens the unfiltered list instead of an error.
 */
export const LEAD_LIST_QUERY: ListQueryConfig = {
  filters: {
    product_id: { default: '' },
    consent: { default: '', allowed: ['', 'allowed', 'blocked'] },
    has_signal: { default: '', allowed: ['', '1'] },
  },
}

export interface LeadFilters {
  productId: number | null
  consent: LeadConsentFilter | null
  hasSignal: boolean
}

/** What the address's filters mean. Anything that is not a real choice is "no filter". */
export function leadFilters(filters: Readonly<Record<string, string>>): LeadFilters {
  const consent = filters.consent
  return {
    productId: whole(filters.product_id),
    consent: consent === 'allowed' || consent === 'blocked' ? consent : null,
    hasSignal: filters.has_signal === '1',
  }
}

/** The value a Product box holds for a filter: the id as text, or '' for every product. */
export const productFilterValue = (productId: number | null): string => (productId === null ? '' : String(productId))

/** The part of the list request these filters make. A filter left on "all" sends nothing, so the server applies none (the contract: `0` or empty = all). */
export function filterRequest(filters: LeadFilters): Pick<LeadListQuery, 'productId' | 'consent' | 'hasSignal'> {
  return {
    ...(filters.productId !== null ? { productId: filters.productId } : {}),
    ...(filters.consent !== null ? { consent: filters.consent } : {}),
    ...(filters.hasSignal ? { hasSignal: true } : {}),
  }
}

export const hasActiveFilters = (filters: LeadFilters): boolean => filters.productId !== null || filters.consent !== null || filters.hasSignal

/** What a saved view keeps of the filters, beside the search and the sort it already kept. */
export function viewConditions(filters: LeadFilters): Record<string, unknown> {
  return { productId: filters.productId, consent: filters.consent, hasSignal: filters.hasSignal }
}

/**
 * The address filters a saved view asks for, or null when the view says nothing about them (a view saved before the filters existed leaves the person's
 * filters alone, the way it already leaves a search alone when it holds none). A value that is not a real choice means "all".
 */
export function filtersFromView(conditions: Record<string, unknown>): Record<string, string> | null {
  const filters: Record<string, string> = {}
  if ('productId' in conditions) filters.product_id = productFilterValue(whole(conditions.productId))
  if ('consent' in conditions) filters.consent = conditions.consent === 'allowed' || conditions.consent === 'blocked' ? conditions.consent : ''
  if ('hasSignal' in conditions) filters.has_signal = conditions.hasSignal === true ? '1' : ''
  return Object.keys(filters).length > 0 ? filters : null
}

export interface Choice {
  value: string
  label: string
}

export const ALL_PRODUCTS = 'All products'

/** "All products" and every Product Master record. A product in the address that the list does not hold is kept, so the box never shows a wrong value. */
export function productChoices(options: readonly PmOption[], current: number | null): Choice[] {
  const choices: Choice[] = [{ value: '', label: ALL_PRODUCTS }, ...options.map((o) => ({ value: String(o.id), label: o.label }))]
  if (current !== null && !choices.some((c) => c.value === String(current))) choices.push({ value: String(current), label: `Product #${current}` })
  return choices
}

/** The Product box is drawn when there is a product to choose, or one is already chosen (so it can be cleared). */
export const showProductFilter = (options: readonly PmOption[], filters: LeadFilters): boolean => options.length > 0 || filters.productId !== null

export const CONSENT_CHOICES: readonly Choice[] = [
  { value: '', label: 'Any consent' },
  { value: 'allowed', label: 'Email allowed' },
  { value: 'blocked', label: 'Email blocked' },
]

export const SOURCE_CHOICES: readonly Choice[] = [
  { value: '', label: 'Any origin' },
  { value: '1', label: 'From a signal' },
]

export const FILTERED_EMPTY_TEXT = 'No leads match these filters.'

// ── Which columns show ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What the list has shown so far: a column that has had something to show keeps its place while the person pages and filters, so it does not come and go.
 * Only the Product column is conditional. The consent chip is drawn inside the Email cell (so a blocked lead is visible at every width, where a column
 * would be hidden on a narrow screen) and the "from a signal" marker inside the Company cell; neither adds a column.
 */
export interface SeenColumns {
  product: boolean
}

export const NOTHING_SEEN: SeenColumns = { product: false }

/** The columns after another page of leads has arrived. The same object when nothing changed, so a re-render is not asked for. */
export function noteSeen(seen: SeenColumns, leads: readonly Lead[]): SeenColumns {
  const product = seen.product || leads.some((lead) => !!lead.product)
  return product === seen.product ? seen : { product }
}

/** The Product column, shown only when there is something to show: a lead has had a product, or a filter on the product is on. */
export function visibleColumns(seen: SeenColumns, filters: LeadFilters): SeenColumns {
  return { product: seen.product || filters.productId !== null }
}

/** The number of columns of the table, for the rows that span it (loading, empty): the tick box and the eight columns it has always had. */
export const leadColumnCount = (columns: SeenColumns): number => 9 + (columns.product ? 1 : 0)

// ── Consent ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ConsentView {
  channel: 'email' | 'sms'
  label: 'Email' | 'SMS'
  allowed: boolean
  /** The state in words, so it never depends on a colour: "Blocked: opted out", "Opted in". */
  word: string
  /** Why, in a sentence a person can read; null when nothing blocks the channel. */
  reason: string | null
  /** Where the answer came from: the one consent gate, or only what the lead record itself says. */
  from: 'gate' | 'record'
}

type RecordConsent = Pick<Lead, 'consentStatus' | 'emailOptOut' | 'suppressedAt'>

/** Why the lead's own record blocks email, as one or two words; null when it does not. Suppressed is checked first: it is the stronger of the two. */
function recordWhy(lead: RecordConsent): 'suppressed' | 'opted out' | null {
  if (lead.consentStatus === 'suppressed' || !!lead.suppressedAt) return 'suppressed'
  if (lead.consentStatus === 'opted_out' || lead.emailOptOut === true) return 'opted out'
  return null
}

const RECORD_REASON: Record<'suppressed' | 'opted out', string> = {
  suppressed: 'This lead is suppressed, so email to them is blocked.',
  'opted out': 'They opted out of email, so email to them is blocked.',
}

/**
 * What email may do for this lead. The gate's answer (`consent.email`, on the detail answer) is the truth when the server sends it: its own sentence is the
 * reason. Without it the lead's own record is read: an opt-out or a suppression BLOCKS (and wins over an opt-in, because the opt-out always wins), an
 * opt-in is "Opted in", and a lead nobody has recorded anything for says nothing (null) rather than "allowed".
 */
export function emailConsent(lead: Pick<Lead, 'consent' | 'consentStatus' | 'emailOptOut' | 'suppressedAt'>): ConsentView | null {
  const why = recordWhy(lead)
  const gate = lead.consent?.email

  if (gate) {
    if (!gate.allowed) {
      return { channel: 'email', label: 'Email', allowed: false, word: why ? `Blocked: ${why}` : 'Blocked', reason: gate.reason ?? (why ? RECORD_REASON[why] : 'No reason was given.'), from: 'gate' }
    }
    return { channel: 'email', label: 'Email', allowed: true, word: lead.consentStatus === 'opted_in' ? 'Opted in' : 'Allowed', reason: gate.reason, from: 'gate' }
  }

  if (why) return { channel: 'email', label: 'Email', allowed: false, word: `Blocked: ${why}`, reason: RECORD_REASON[why], from: 'record' }
  if (lead.consentStatus === 'opted_in') return { channel: 'email', label: 'Email', allowed: true, word: 'Opted in', reason: null, from: 'record' }
  return null
}

/** SMS, from the gate only: the lead's own record holds no SMS state, so without the gate nothing is said. */
export function smsConsent(lead: Pick<Lead, 'consent'>): ConsentView | null {
  const gate = lead.consent?.sms
  if (!gate) return null
  return { channel: 'sms', label: 'SMS', allowed: gate.allowed, word: gate.allowed ? 'Allowed' : 'Blocked', reason: gate.allowed ? gate.reason : (gate.reason ?? 'No reason was given.'), from: 'gate' }
}

/** Every channel the page can say something about, email first. */
export function consentViews(lead: Pick<Lead, 'consent' | 'consentStatus' | 'emailOptOut' | 'suppressedAt'>): ConsentView[] {
  return [emailConsent(lead), smsConsent(lead)].filter((view): view is ConsentView => view !== null)
}

/** The whole sentence of a chip for a screen reader and a tooltip: "Email: Blocked: opted out. They opted out of email, so email to them is blocked." */
export function consentSentence(view: ConsentView): string {
  return `${view.label}: ${view.word}.${view.reason ? ` ${view.reason}` : ''}`
}

// ── The signal a lead came from ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A lead made from a signal: the new id when the server sends it, or the older column every presenter already sends. */
export function isFromSignal(lead: Pick<Lead, 'sourceSignalId' | 'sourceCompanyOpportunityId' | 'sourceSignal'>): boolean {
  return whole(lead.sourceSignalId) !== null || whole(lead.sourceCompanyOpportunityId) !== null || !!lead.sourceSignal
}

export type SignalEvidence =
  | { kind: 'none' }
  /** The lead says it came from a signal, but the server sent nothing about it (an older server, or the signal was removed). */
  | { kind: 'unreadable'; id: string | null }
  | {
      kind: 'signal'; id: number; title: string; url: string | null; host: string | null; dateText: string; fitText: string | null
      quote: string | null; quoteKind: 'excerpt' | 'observed_event' | null
    }

export const MAX_QUOTE = 600

/**
 * What the text under a signal IS, in words. The source's own excerpt is "copied from it"; a signal's description of what happened is "a description, not a
 * quote" (hp_erp LeadSignalEvidence: "never passed off as a quote"); a text whose kind the server did not say is only "as recorded with the signal".
 */
export function quoteCaption(kind: 'excerpt' | 'observed_event' | null): string {
  if (kind === 'excerpt') return 'What the source said, copied from it.'
  if (kind === 'observed_event') return 'What the signal observed: a description, not a quote from the source.'
  return 'As recorded with the signal.'
}

/** The date of a signal in words: the event's when one is stated, else the day the source was published (said so, because it is not the event's), else "Date unknown". */
export function signalDateText(eventDate: string | null | undefined, publishedAt: string | null | undefined): string {
  const event = formatDay(eventDate)
  if (event) return `Event date: ${event}`
  const published = formatDay(publishedAt)
  return published ? `Published: ${published} (the event date is not stated)` : 'Date unknown'
}

/** "hillcrest.example.edu" from an address, without a leading "www."; null when it is not an address. */
export function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '') || null
  } catch {
    return null
  }
}

export function cappedQuote(quote: string | null | undefined): string | null {
  const text = readableText(quote)
  if (!text) return null
  return text.length > MAX_QUOTE ? `${text.slice(0, MAX_QUOTE).trimEnd()}…` : text
}

/** What the Evidence tab says about the signal a lead came from. The link is kept only when it is an http(s) address: a stored `javascript:` address is never clickable. */
export function signalEvidence(lead: Pick<Lead, 'sourceSignalId' | 'sourceCompanyOpportunityId' | 'sourceSignal'>): SignalEvidence {
  const signal = lead.sourceSignal
  if (signal) {
    const url = safeHttpUrl(signal.sourceUrl)
    const quote = cappedQuote(signal.quote)
    return {
      kind: 'signal',
      id: signal.id,
      title: signal.title ?? `Signal #${signal.id}`,
      url,
      host: hostOf(url),
      dateText: signalDateText(signal.eventDate, signal.sourcePublishedAt),
      fitText: signal.businessFit ? fitLabel(signal.businessFit) : null,
      quote,
      quoteKind: quote ? (signal.quoteKind ?? null) : null,
    }
  }
  if (!isFromSignal(lead)) return { kind: 'none' }
  const id = whole(lead.sourceSignalId) ?? whole(lead.sourceCompanyOpportunityId)
  return { kind: 'unreadable', id: id === null ? null : String(id) }
}

// ── A fact accepted in the Evidence tab ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Which property of a lead each fact field writes (hp_erp config/facts.php `targets.lead`: a field whose target is null is kept in the ledger only). */
const LEAD_PROPERTY: Record<string, keyof Lead> = {
  email: 'email', secondary_email: 'secondaryEmail', phone: 'phone', mobile: 'mobile', website: 'website', title: 'designation',
}

/**
 * The part of a lead an accepted fact wrote, in the lead's own property names, so the page shows the new value without a reload; null when the fact wrote
 * nothing there (not accepted, kept in the ledger only, or a field a lead has no column for).
 */
export function leadPatch(fact: Pick<Fact, 'entity_type' | 'field' | 'value' | 'status' | 'column_written'>): Record<string, string> | null {
  if (fact.entity_type !== 'lead' || fact.status !== 'applied' || fact.column_written !== true) return null
  const property = LEAD_PROPERTY[fact.field]
  return property ? { [property]: fact.value } : null
}
