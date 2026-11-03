import { formatWhen, safeInternalPath } from '@/lib/agent/model'
import type { ChipTone } from '@/lib/org-accounts/tones'
import { safeHttpUrl } from '@/lib/signal-review/signal-display'
import type { FactsQueueParams } from '@/services/facts/api-types'
import type {
  ConsentChannel, ConsentChannelKey, ConsentData, ConsentSource, Fact, FactBand, FactCounts, FactEntityType, FactEvidence, FactStatus,
} from '@/services/facts/types'

/**
 * What the facts screens say, decided in one place and tested without a browser (components render these, they do not invent words). The rules the words
 * keep: a status is a WORD, never only a colour; an unknown stays "unknown", never a made-up value; everything a model or the web wrote (a value, a quote, a
 * source address) is plain text; a link is shown only for an http or https address, or a path inside this application.
 */

export const NO_VALUE = '—'
export const NETWORK_TEXT = 'The request did not reach the server. Check your connection and try again.'
/** The longest reason a person may give when dismissing (the server accepts 500). */
export const MAX_REASON = 500
/** The suggestions queue's page size (the server allows up to 50). */
export const QUEUE_PER_PAGE = 25
/** The most characters of a quote shown; a longer one is cut and says so. */
export const MAX_QUOTE = 600

// ── Words for the kinds of record ───────────────────────────────────────────────────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<FactEntityType, { one: string; many: string }> = {
  contact: { one: 'Contact', many: 'Contacts' },
  organization: { one: 'Organisation', many: 'Organisations' },
  lead: { one: 'Lead', many: 'Leads' },
}

/** A record kind in words; one this screen does not know (a newer server) by its own name, never guessed at. */
export function entityLabel(type: string, plural = false): string {
  const known = ENTITY_LABELS[type as FactEntityType]
  if (known) return plural ? known.many : known.one
  const words = type.replace(/[_-]+/g, ' ').trim()
  return words === '' ? 'Record' : words.charAt(0).toUpperCase() + words.slice(1)
}

/** The menu row each kind of record is opened from, for a link to it. */
const ENTITY_ROWS: Record<FactEntityType, string> = {
  contact: '/module/crm/marketing/contacts',
  organization: '/module/crm/marketing/organizations',
  lead: '/module/crm/marketing/leads',
}

/** The page of the record a fact is about, through the person's own menu (`resolve` is the sidebar's resolveAccessLink); null for a kind with no page. */
export function entityPath(type: string, id: number, resolve: (accessLink: string) => string): string | null {
  const row = ENTITY_ROWS[type as FactEntityType]
  if (!row || !Number.isInteger(id) || id <= 0) return null
  return `${resolve(row)}/${id}`
}

// ── Words for a fact ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The field in words: the server's own label, else the key made readable. */
export function fieldLabel(fact: Pick<Fact, 'field' | 'field_label'>): string {
  const given = fact.field_label?.trim()
  if (given) return given
  const words = fact.field.replace(/[_-]+/g, ' ').trim()
  return words === '' ? 'Field' : words.charAt(0).toUpperCase() + words.slice(1)
}

export interface PillView {
  label: string
  tone: ChipTone
}

export interface BandView extends PillView {
  /** What the band means, in a sentence. */
  meaning: string
}

const BANDS: Record<FactBand, BandView> = {
  verified: { label: 'Verified', tone: 'positive', meaning: 'Strong evidence, including a source that names the person or organisation itself.' },
  probable: { label: 'Probable', tone: 'info', meaning: 'More likely than not, but it rests on fewer or weaker sources.' },
  possible: { label: 'Possible', tone: 'caution', meaning: 'A lead worth checking. Do not rely on it yet.' },
}

export function bandView(band: string): BandView {
  return BANDS[band as FactBand] ?? { label: band === '' ? NO_VALUE : band, tone: 'muted', meaning: '' }
}

/** "87% sure"; null when the score is not a number between 0 and 1 (a score is never shown as 0 when it is not known). */
export function scoreText(score: unknown): string | null {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) return null
  return `${Math.round(score * 100)}% sure`
}

export type StatusLabel = { label: string; tone: ChipTone }

/** The state of a fact in words: waiting for a person, accepted (and by whom), dismissed, or replaced. */
export function statusView(fact: Pick<Fact, 'status' | 'decided_by_name'>): StatusLabel {
  switch (fact.status) {
    case 'proposed':
      return { label: 'Waiting for you', tone: 'caution' }
    case 'applied':
      return { label: fact.decided_by_name ? `Accepted by ${fact.decided_by_name}` : 'Accepted', tone: 'positive' }
    case 'dismissed':
      return { label: fact.decided_by_name ? `Dismissed by ${fact.decided_by_name}` : 'Dismissed', tone: 'muted' }
    case 'superseded':
      return { label: 'Replaced by a newer value', tone: 'muted' }
    default:
      return { label: String(fact.status), tone: 'muted' }
  }
}

/** Whether a fact can still be decided by a person. */
export function isWaiting(status: FactStatus | string): boolean {
  return status === 'proposed'
}

/** Fields whose value is a web address a person may want to open. */
const ADDRESS_FIELDS = new Set(['website', 'linkedin_url', 'x_url', 'github_url'])

/** The value as a link, only for a web-address field AND an http or https value (a `javascript:` or `data:` value is never a link); otherwise null. */
export function valueLink(field: string, value: string): string | null {
  return ADDRESS_FIELDS.has(field) ? safeHttpUrl(value) : null
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * What the record holds in the fact's field, next to a suggestion or a decision. Only said when it is known: `record_value` is null when the field has no
 * column on this kind of record, and a blank column says nothing here (the server's `column_written` is what tells whether an accepted fact reached it).
 */
export function recordLine(fact: Pick<Fact, 'status' | 'value' | 'record_value' | 'column_written'>): string | null {
  const held = fact.record_value?.trim() ?? ''
  if (fact.status === 'proposed') {
    if (held === '') return null
    if (same(held, fact.value)) return 'The record already holds this value.'
    return `The record holds “${held}”. Accepting keeps this as a fact and does not replace it.`
  }
  if (fact.status === 'applied') {
    if (fact.column_written === true) return 'Written to the record.'
    if (fact.column_written === false) return held === '' ? 'Kept as a fact. The record was not changed.' : `The record already held “${held}”, so this was kept as a fact and the record was not changed.`
  }
  return null
}

/** "Accepted by Asha on 3 Nov 2026, 20:52" / "Dismissed on 3 Nov 2026, 20:52: reason" for a decided fact; null for one still waiting. */
export function decisionLine(fact: Pick<Fact, 'status' | 'decided_at' | 'decision_note'>): string | null {
  if (fact.status !== 'applied' && fact.status !== 'dismissed') return null
  const verb = fact.status === 'applied' ? 'Accepted' : 'Dismissed'
  const when = formatWhen(fact.decided_at)
  const base = when === NO_VALUE ? verb : `${verb} on ${when}`
  const note = fact.decision_note?.trim()
  return note ? `${base}. Reason given: ${note}` : base
}

/**
 * Who or what suggested a fact, in words. The server stores a short key (`agent:organisation`, `user:12`, `import`): an agent is named, a person is "a team
 * member" (the key carries an id, not a name), an import is "an import", and a key this screen does not know is shown as it was written.
 */
export function proposerText(key: string | null | undefined): string | null {
  const raw = key?.trim() ?? ''
  if (raw === '') return null
  const [kind, rest = ''] = raw.split(':', 2)
  const name = rest.replace(/[_-]+/g, ' ').trim()
  if (kind === 'agent') return name === '' ? 'an agent' : `the ${name.charAt(0).toUpperCase()}${name.slice(1)} agent`
  if (kind === 'user') return 'a team member'
  if (raw === 'import') return 'an import'
  return raw
}

/** "Suggested by the Organisation agent · method: web lookup · found 3 Nov 2026, 20:52"; only what is known. */
export function originLine(fact: Pick<Fact, 'proposed_by' | 'method' | 'created_at'>): string | null {
  const parts: string[] = []
  const by = proposerText(fact.proposed_by)
  if (by) parts.push(`Suggested by ${by}`)
  const method = fact.method?.trim()
  if (method) parts.push(`method: ${method.replace(/[_-]+/g, ' ')}`)
  const when = formatWhen(fact.created_at ?? null)
  if (when !== NO_VALUE) parts.push(`found ${when}`)
  return parts.length ? parts.join(' · ') : null
}

// ── Evidence ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** What a piece of evidence is, as a sentence starting with a capital ("Their email address is on the profile"); the kind made readable when the label is blank. */
export function evidenceLabel(evidence: Pick<FactEvidence, 'kind' | 'label'>): string {
  const text = evidence.label?.trim() || evidence.kind.replace(/[._-]+/g, ' ').trim() || 'Evidence'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** How much a piece of evidence counts, in words. A contradiction counts against the fact; a weight of 0 adds nothing. */
export function strengthText(evidence: Pick<FactEvidence, 'kind' | 'weight'>): string {
  if (evidence.kind === 'contradiction') return 'Counts against it'
  if (typeof evidence.weight !== 'number' || !Number.isFinite(evidence.weight) || evidence.weight <= 0) return 'Adds nothing to the score'
  return `Strength ${Math.round(Math.min(1, evidence.weight) * 100)}%`
}

/** The wording copied from a source, trimmed and cut at MAX_QUOTE (with an ellipsis); null when there is none. It is TEXT. */
export function quoteText(quote: string | null | undefined): string | null {
  const text = quote?.trim() ?? ''
  if (text === '') return null
  return text.length > MAX_QUOTE ? `${text.slice(0, MAX_QUOTE).trimEnd()}…` : text
}

export type SourceView =
  | { kind: 'web'; href: string; text: string }
  | { kind: 'internal'; href: string; text: string }
  | { kind: 'text'; text: string }

const MAX_SOURCE_TEXT = 80

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text)

/**
 * Where a piece of evidence came from. An http or https address is a link (shown as host and path, so a person sees where it goes), a path inside this
 * application is a link, and anything else (a `javascript:` address, a file, a scheme this screen does not know) is shown as plain text and never as a link.
 */
export function sourceView(url: string | null | undefined): SourceView | null {
  const raw = url?.trim() ?? ''
  if (raw === '') return null
  const web = safeHttpUrl(raw)
  if (web) {
    const parsed = new URL(web)
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '')
    return { kind: 'web', href: web, text: clip(`${parsed.host}${path}`, MAX_SOURCE_TEXT) }
  }
  const inside = safeInternalPath(raw)
  if (inside) return { kind: 'internal', href: inside, text: clip(inside, MAX_SOURCE_TEXT) }
  return { kind: 'text', text: clip(raw, MAX_SOURCE_TEXT) }
}

// ── Groups and counts ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FactGroup {
  key: FactStatus | 'other'
  title: string
  facts: Fact[]
}

const GROUP_TITLES: Array<{ key: FactStatus; title: string }> = [
  { key: 'proposed', title: 'Waiting for you' },
  { key: 'applied', title: 'Accepted' },
  { key: 'dismissed', title: 'Dismissed' },
  { key: 'superseded', title: 'Replaced by a newer value' },
]

/** A record's facts in the order a person works: what waits, then what was accepted, dismissed and replaced. An empty group is left out; a status this screen does not know is "Other", never dropped. */
export function groupFacts(facts: readonly Fact[]): FactGroup[] {
  const known = new Set<string>(GROUP_TITLES.map((g) => g.key))
  const groups: FactGroup[] = GROUP_TITLES.map((g) => ({ key: g.key, title: g.title, facts: facts.filter((f) => f.status === g.key) }))
  groups.push({ key: 'other', title: 'Other', facts: facts.filter((f) => !known.has(f.status)) })
  return groups.filter((g) => g.facts.length > 0)
}

/** "2 waiting, 1 accepted, 1 dismissed"; "No facts yet" when all are zero. */
export function countsText(counts: FactCounts): string {
  const parts: string[] = []
  if (counts.proposed) parts.push(`${counts.proposed} waiting`)
  if (counts.applied) parts.push(`${counts.applied} accepted`)
  if (counts.dismissed) parts.push(`${counts.dismissed} dismissed`)
  return parts.length ? parts.join(', ') : 'No facts yet'
}

/** "Showing the 200 newest of 240 facts." when the server cut the list short (it answers a record's newest facts only); null when every fact is here. */
export function cappedText(counts: FactCounts, facts: readonly Pick<Fact, 'status'>[]): string | null {
  const total = counts.proposed + counts.applied + counts.dismissed
  const shown = facts.filter((fact) => fact.status !== 'superseded').length
  return total > shown ? `Showing the ${shown} newest of ${total} facts.` : null
}

// ── The suggestions queue ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type TypeFilter = '' | FactEntityType

export const TYPE_FILTERS: ReadonlyArray<{ value: TypeFilter; label: string }> = [
  { value: '', label: 'All records' },
  { value: 'contact', label: 'Contacts' },
  { value: 'organization', label: 'Organisations' },
  { value: 'lead', label: 'Leads' },
]

/** The queue's query: only what was chosen. The suggestions screen only ever asks for what is waiting for a person. */
export function queueParams(type: TypeFilter, page: number): FactsQueueParams {
  const params: FactsQueueParams = { status: 'proposed', page, per_page: QUEUE_PER_PAGE }
  if (type !== '') params.type = type
  return params
}

export function lastPage(pagination: { per_page: number; total: number } | null | undefined): number {
  if (!pagination || pagination.per_page <= 0) return 1
  return Math.max(1, Math.ceil(pagination.total / pagination.per_page))
}

/** "Showing 26–50 of 61", or null when there is nothing to count. */
export function rangeText(pagination: { page: number; per_page: number; total: number } | null | undefined, rows: number): string | null {
  if (!pagination || pagination.total <= 0 || rows <= 0) return null
  const from = (pagination.page - 1) * pagination.per_page + 1
  return `Showing ${from}–${from + rows - 1} of ${pagination.total}`
}

// ── What a decision answers with ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Notice {
  tone: 'success' | 'error'
  text: string
}

/** The sentence after accepting: says whether the record itself was changed, because that is the thing a person needs to know. */
export function acceptNotice(fact: Pick<Fact, 'field' | 'field_label' | 'column_written' | 'record_value'>): string {
  const label = fieldLabel(fact)
  if (fact.column_written === true) return `Accepted. The ${label.toLowerCase()} was written to the record.`
  if (fact.column_written === false) {
    const held = fact.record_value?.trim() ?? ''
    return held === ''
      ? 'Accepted and kept as a fact. The record was not changed.'
      : `Accepted and kept as a fact. The record was not changed because it already holds “${held}”.`
  }
  return 'Accepted.'
}

export const DISMISS_NOTICE = 'Dismissed. This value will not be suggested again.'

/** Whether accepting wrote the contact's or organisation's own field, so a page that shows that field must show the new value. */
export function wroteRecord(fact: Pick<Fact, 'status' | 'column_written'>): boolean {
  return fact.status === 'applied' && fact.column_written === true
}

/** The part of a contact an accepted fact wrote, in the contact's own property names (the contact page shows it without a reload); null when it wrote nothing there. */
export function contactPatch(fact: Pick<Fact, 'entity_type' | 'field' | 'value' | 'status' | 'column_written'>): Record<string, string> | null {
  if (fact.entity_type !== 'contact' || !wroteRecord(fact)) return null
  const property = CONTACT_PROPERTY[fact.field]
  return property ? { [property]: fact.value } : null
}

const CONTACT_PROPERTY: Record<string, string> = { email: 'email', secondary_email: 'secondaryEmail', phone: 'phone', mobile: 'mobile', title: 'title' }

// ── Failures ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A state in one lower-case word for a sentence ("it is now accepted"); a person's name is never put through this. */
const STATE_WORD: Record<string, string> = { proposed: 'waiting again', applied: 'accepted', dismissed: 'dismissed', superseded: 'replaced by a newer value' }

export const NO_DECIDE_TEXT = 'You can read these suggestions, but accepting or dismissing needs the edit right on this screen.'

const statusOf = (error: unknown): number | null => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

const messageOf = (error: unknown): string | null => {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.trim() !== '' ? message : null
}

export function codeOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : null
}

/** The fact a 409 carries (what became of it), when it carries one. */
export function factOf(error: unknown): Fact | null {
  const fact = (error as { fact?: unknown } | null)?.fact
  return fact && typeof fact === 'object' ? (fact as Fact) : null
}

/** A refused decision: the answer was 403 (the person may read this but not decide it). */
export function isNoRight(error: unknown): boolean {
  return statusOf(error) === 403
}

/** What went wrong with a decision, in a sentence: the situation in words when the code says it, otherwise the server's own sentence. */
export function failureText(error: unknown, fallback: string): string {
  const status = statusOf(error)
  const code = codeOf(error)
  if (status === 403) return NO_DECIDE_TEXT
  if (status === 404) return 'This suggestion can no longer be found. The record it belongs to may have been removed.'
  if (status === 409 && code === 'entity_gone') return 'The record this belongs to has been removed, so nothing was changed.'
  if (status === 409 && code === 'not_pending') {
    const word = STATE_WORD[factOf(error)?.status ?? '']
    return word ? `Someone had already decided this: it is now ${word}. Nothing was changed.` : 'Someone had already decided this. Nothing was changed.'
  }
  if (status !== null) return messageOf(error) ?? `The server answered ${status}.`
  if (error instanceof TypeError) return NETWORK_TEXT
  return messageOf(error) ?? fallback
}

export type LoadFailureKind = 'forbidden' | 'notFound' | 'unavailable' | 'error'

/** How a failed read is shown: not allowed (no retry can help), not found, not set up on this server (a 503), or an error to retry. */
export function loadFailure(error: unknown, fallback: string, subject = 'facts'): { kind: LoadFailureKind; message: string } {
  const status = statusOf(error)
  if (status === 403) return { kind: 'forbidden', message: `You do not have access to ${subject} here.` }
  if (status === 404) return { kind: 'notFound', message: 'This record could not be found. It may have been removed, or it is not in your organisation.' }
  if (status === 503) return { kind: 'unavailable', message: `${subject.charAt(0).toUpperCase()}${subject.slice(1)} are not set up on this server yet.` }
  return { kind: 'error', message: failureText(error, fallback) }
}

// ── Consent ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const CHANNEL_ORDER: ReadonlyArray<{ key: ConsentChannelKey; label: string }> = [
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
  { key: 'whatsapp', label: 'WhatsApp' },
]

const CODE_TEXT: Record<string, string> = {
  opted_out: 'They opted out of email.',
  suppressed: 'They are on the suppression list.',
  suppression_list: 'This address or its domain is on the suppression list.',
  outreach_contact_blocked: 'The outreach record for them is blocked (bounced, unsubscribed or do not contact).',
  preference_opted_out: 'They recorded a preference not to be contacted on this channel.',
  no_consent_recorded: 'No consent has been recorded for this channel.',
  no_address: 'There is no address for this channel.',
  unknown_recipient: 'The recipient could not be identified.',
}

export interface ConsentRow {
  key: ConsentChannelKey
  label: string
  allowed: boolean
  /** The answer in a word, so it never depends on a colour. */
  word: 'Allowed' | 'Not allowed'
  /** Why, in a sentence; null when nothing blocks the channel. */
  reason: string | null
}

/** Why a channel is not allowed: the server's own sentence, else the code in words, else an honest "no reason was given". Nothing is said when it is allowed and nothing blocks it. */
export function consentReason(channel: ConsentChannel): string | null {
  const given = channel.reason?.trim()
  if (given) return given
  const code = channel.code ?? null
  if (code && CODE_TEXT[code]) return CODE_TEXT[code]
  return channel.allowed ? null : 'No reason was given.'
}

/** The channels the server reported, in a fixed order (email, SMS, WhatsApp). A channel it did not report is left out, never assumed allowed. */
export function consentRows(data: Pick<ConsentData, 'channels'> | null | undefined): ConsentRow[] {
  const rows: ConsentRow[] = []
  for (const { key, label } of CHANNEL_ORDER) {
    const channel = data?.channels?.[key]
    if (!channel || typeof channel.allowed !== 'boolean') continue
    rows.push({ key, label, allowed: channel.allowed, word: channel.allowed ? 'Allowed' : 'Not allowed', reason: consentReason(channel) })
  }
  return rows
}

/** One line: "Email allowed · SMS not allowed · WhatsApp not allowed". */
export function consentSummary(rows: readonly ConsentRow[]): string {
  return rows.map((row) => `${row.label} ${row.word.toLowerCase()}`).join(' · ')
}

/** The places the consent gate reads (hp_erp App\Domain\Facts\ConsentGate), in words. A source a newer server adds is shown by its own name made readable. */
const SOURCE_LABELS: Record<string, string> = {
  email_opt_out: 'Email opt-out flag',
  consent_status: 'Consent status on the record',
  suppressed_at: 'Suppressed on the record',
  crm_consent_preferences: 'Recorded consent preference',
  gtm_suppressions: 'Suppression list',
  gtm_contacts: 'Outreach contact status',
}

/** One place the answer was read from, in words: "Email opt-out flag: opted out", "Consent status on the record: opted out (3 Nov 2026)". */
export function consentSourceText(source: ConsentSource): string {
  const name = SOURCE_LABELS[source.source] ?? source.source.replace(/[_.-]+/g, ' ').trim()
  const label = name === '' ? 'Source' : name.charAt(0).toUpperCase() + name.slice(1)
  const raw = source.value?.trim() ?? ''
  // The opt-out flag is stored as 1; a status is stored with underscores (opted_out).
  const value = raw === '' ? NO_VALUE : source.source === 'email_opt_out' && raw === '1' ? 'opted out' : raw.replace(/_/g, ' ')
  const when = formatWhen(source.at)
  return when === NO_VALUE ? `${label}: ${value}` : `${label}: ${value} (${when})`
}
