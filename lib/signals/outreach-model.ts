import type {
  ConsentStatus, NewCompanyBody, NewPersonBody, OutreachListQuery, OutreachPerson, OutreachReach, OutreachReachFilter, OutreachSource, OutreachSummary,
} from '@/services/signals/outreach-types'

/**
 * The words and small rules of the Outreach tab (Market Signals). Pure, so each is proved without a browser. The server decides a row's reach (it holds the consent flags and the
 * rules); this file only names it, colours it, turns a chip into the query it means, and checks a form before it is sent. Plain words on purpose: nobody should have to guess.
 */

export const OUTREACH_PAGE_SIZE = 20

// ── The three views of the tab ───────────────────────────────────────────────────

export const OUTREACH_VIEW_IDS = ['companies', 'people', 'messages'] as const
export type OutreachView = (typeof OUTREACH_VIEW_IDS)[number]
export const OUTREACH_VIEW_PARAM = 'view'

export const OUTREACH_VIEWS: ReadonlyArray<{ id: OutreachView; label: string }> = [
  { id: 'companies', label: 'Companies' },
  { id: 'people', label: 'All people' },
  { id: 'messages', label: 'Messages' },
]

/** The Messages view's own sections (`?section=`): the queue, the do-not-contact list, the SMS log. */
export const MESSAGE_SECTION_IDS = ['queue', 'suppressions', 'sms'] as const
export type MessageSection = (typeof MESSAGE_SECTION_IDS)[number]
export const MESSAGE_SECTION_PARAM = 'section'

export function toOutreachView(value: string | null | undefined): OutreachView {
  return (OUTREACH_VIEW_IDS as readonly string[]).includes(value ?? '') ? (value as OutreachView) : OUTREACH_VIEW_IDS[0]
}

export function toMessageSection(value: string | null | undefined): MessageSection {
  return (MESSAGE_SECTION_IDS as readonly string[]).includes(value ?? '') ? (value as MessageSection) : MESSAGE_SECTION_IDS[0]
}

/** Where the retired Outreach, Outreach Approvals and SMS Notifier addresses lead. */
export const OUTREACH_PATH = '/signals/outreach'
export const outreachHref = (view?: OutreachView, section?: MessageSection): string => {
  const params: string[] = []
  if (view && view !== 'companies') params.push(`${OUTREACH_VIEW_PARAM}=${view}`)
  if (view === 'messages' && section && section !== 'queue') params.push(`${MESSAGE_SECTION_PARAM}=${section}`)
  return params.length ? `${OUTREACH_PATH}?${params.join('&')}` : OUTREACH_PATH
}
export const outreachCompanyHref = (id: number, tab?: 'people'): string => `${OUTREACH_PATH}/${encodeURIComponent(String(id))}${tab ? `?tab=${tab}` : ''}`

/** The company page has exactly two tabs. */
export const COMPANY_TAB_IDS = ['details', 'people'] as const
export type CompanyTab = (typeof COMPANY_TAB_IDS)[number]
export const COMPANY_TABS: ReadonlyArray<{ id: CompanyTab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'people', label: 'People' },
]

// ── Reach: what can be done with a row ───────────────────────────────────────────

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

export const REACH_LABEL: Readonly<Record<OutreachReach, string>> = {
  ready: 'Email and phone',
  email_only: 'Email only',
  phone_only: 'Phone only',
  needs_details: 'Needs details',
  blocked: 'Do not contact',
}

export const REACH_TONE: Readonly<Record<OutreachReach, Tone>> = {
  ready: 'success',
  email_only: 'info',
  phone_only: 'info',
  needs_details: 'warning',
  blocked: 'danger',
}

/** One short sentence for a tooltip or the row's detail, saying what the label means. */
export const REACH_HELP: Readonly<Record<OutreachReach, string>> = {
  ready: 'An email address and a phone number were found, and nothing blocks contacting them.',
  email_only: 'An email address was found. No usable phone number.',
  phone_only: 'A phone number was found. No usable email address.',
  needs_details: 'No email address or phone number yet. Run Find contacts, or add one by hand.',
  blocked: 'They opted out, were suppressed, or are marked do not contact. No message can be written.',
}

export const isReachable = (reach: OutreachReach): boolean => reach === 'ready' || reach === 'email_only' || reach === 'phone_only'

export const SOURCE_LABEL: Readonly<Record<OutreachSource, string>> = { found: 'Found from signals', manual: 'Added by hand' }

export const CONSENT_LABEL: Readonly<Record<ConsentStatus, string>> = {
  unknown: 'No answer yet',
  opted_in: 'Agreed to hear from us',
  opted_out: 'Opted out',
  suppressed: 'Suppressed',
}

export const CONSENT_TONE: Readonly<Record<ConsentStatus, Tone>> = { unknown: 'neutral', opted_in: 'success', opted_out: 'danger', suppressed: 'danger' }

// ── The chips ────────────────────────────────────────────────────────────────────

export type OutreachChip = 'all' | 'reachable' | 'needs_details' | 'found' | 'manual' | 'mine' | 'blocked'

export const OUTREACH_CHIPS: ReadonlyArray<{ id: OutreachChip; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'reachable', label: 'Ready to contact' },
  { id: 'needs_details', label: 'Needs details' },
  { id: 'found', label: 'Found from signals' },
  { id: 'manual', label: 'Added by hand' },
  { id: 'mine', label: 'Mine' },
  { id: 'blocked', label: 'Do not contact' },
]

/** The number printed on a chip, from the summary the server sends for the whole list. */
export function chipCount(chip: OutreachChip, summary: OutreachSummary | null | undefined): number | null {
  if (!summary) return null
  switch (chip) {
    case 'all': return summary.all
    case 'reachable': return summary.reachable
    case 'needs_details': return summary.needs_details
    case 'found': return summary.found
    case 'manual': return summary.manual
    case 'mine': return summary.mine
    case 'blocked': return summary.blocked
  }
}

export type OutreachSortKey = 'name' | 'industry' | 'location' | 'signals' | 'people' | 'created' | 'last_contacted' | 'company'

export interface OutreachListState {
  page: number
  search: string
  chip: OutreachChip
  sortKey: OutreachSortKey
  sortAsc: boolean
}

export const INITIAL_OUTREACH_STATE: OutreachListState = { page: 1, search: '', chip: 'all', sortKey: 'name', sortAsc: true }

/** A chip asks for exactly its own filter, so the chips are exclusive. The default order puts the most reachable rows first (the server knows how). */
export function outreachQuery(state: OutreachListState, extra: Pick<OutreachListQuery, 'company_id'> = {}): OutreachListQuery {
  const query: OutreachListQuery = { page: state.page, per_page: OUTREACH_PAGE_SIZE, sort: state.sortKey, dir: state.sortAsc ? 'asc' : 'desc', ...extra }
  const search = state.search.trim()
  if (search) query.search = search
  const reach: Partial<Record<OutreachChip, OutreachReachFilter>> = { reachable: 'reachable', needs_details: 'needs_details', blocked: 'blocked' }
  if (reach[state.chip]) query.reach = reach[state.chip]
  if (state.chip === 'found' || state.chip === 'manual') query.source = state.chip
  if (state.chip === 'mine') query.mine = true

  return query
}

/** A new filter, search or sort goes back to page one; the page number alone does not. */
export function withChange(state: OutreachListState, change: Partial<OutreachListState>): OutreachListState {
  const next = { ...state, ...change }
  const pageOnly = Object.keys(change).length === 1 && 'page' in change

  return pageOnly ? next : { ...next, page: change.page ?? 1 }
}

// ── Words of a row ───────────────────────────────────────────────────────────────

export const NO_VALUE = '—'

/** The name to show: the person's name, else the organisation's own line. */
export function personLabel(person: Pick<OutreachPerson, 'full_name' | 'company_name'>): string {
  const name = (person.full_name ?? '').trim()

  return name || `${person.company_name} (company line)`
}

export function personInitials(person: Pick<OutreachPerson, 'full_name'>): string {
  const parts = (person.full_name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'

  return ((parts[0][0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase()
}

/** "Director · Finance", the title and the department, either or both. */
export function titleLine(person: Pick<OutreachPerson, 'designation' | 'department' | 'contact_role'>): string | null {
  const text = [person.designation, person.department].map((part) => (part ?? '').trim()).filter(Boolean).join(' · ')

  return text || (person.contact_role ?? '').trim() || null
}

/** The line a row's tooltip or the empty state shows when a person cannot be written to, in words. */
export function whyNotReachable(person: Pick<OutreachPerson, 'reach' | 'consent_status' | 'email_opt_out' | 'do_not_call' | 'suppressed_reason'>): string | null {
  if (person.reach !== 'blocked') return null
  if (person.consent_status === 'opted_out') return 'They opted out.'
  if (person.consent_status === 'suppressed') return person.suppressed_reason ? `Suppressed: ${person.suppressed_reason}.` : 'They were suppressed.'
  if (person.email_opt_out && person.do_not_call) return 'They asked for no email and no calls.'
  if (person.email_opt_out) return 'They asked for no email.'
  if (person.do_not_call) return 'They asked for no calls.'

  return REACH_HELP.blocked
}

// ── Forms: checked before anything is sent ───────────────────────────────────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const isEmail = (value: string): boolean => EMAIL.test(value.trim())

/** A phone passes with 7 to 15 digits (an Indian mobile has 10; an international number starts with +). The server normalises and has the last word. */
export function isPhone(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '')

  return digits.length >= 7 && digits.length <= 15
}

export type FormErrors<T> = Partial<Record<keyof T, string>>

export function companyFormErrors(body: NewCompanyBody): FormErrors<NewCompanyBody> {
  const errors: FormErrors<NewCompanyBody> = {}
  if (!body.name || !body.name.trim()) errors.name = 'Name the company.'
  if (body.email && body.email.trim() && !isEmail(body.email)) errors.email = 'This does not look like an email address.'
  if (body.phone && body.phone.trim() && !isPhone(body.phone)) errors.phone = 'This does not look like a phone number.'

  return errors
}

/** A person needs a company and at least one way to find them: a name, an email, a phone or a LinkedIn address. */
export function personFormErrors(body: NewPersonBody): FormErrors<NewPersonBody> {
  const errors: FormErrors<NewPersonBody> = {}
  if (!body.company_id) errors.company_id = 'Choose the company.'
  const any = [body.full_name, body.email, body.phone, body.mobile, body.linkedin_url].some((value) => (value ?? '').trim() !== '')
  if (!any) errors.full_name = 'Give a name, an email or a phone number.'
  if (body.email && body.email.trim() && !isEmail(body.email)) errors.email = 'This does not look like an email address.'
  if (body.secondary_email && body.secondary_email.trim() && !isEmail(body.secondary_email)) errors.secondary_email = 'This does not look like an email address.'
  if (body.phone && body.phone.trim() && !isPhone(body.phone)) errors.phone = 'This does not look like a phone number.'
  if (body.mobile && body.mobile.trim() && !isPhone(body.mobile)) errors.mobile = 'This does not look like a phone number.'

  return errors
}

/** The message form: a subject and a body of at least 20 characters (the server's own rule), and someone to write to. */
export const MESSAGE_BODY_MIN = 20
export const MESSAGE_BODY_MAX = 20000
export const MESSAGE_SUBJECT_MAX = 255

export function messageFormErrors(form: { subject: string; body: string; recipients: number }): { subject?: string; body?: string; recipients?: string } {
  const errors: { subject?: string; body?: string; recipients?: string } = {}
  if (form.recipients < 1) errors.recipients = 'Choose at least one person to write to.'
  if (!form.subject.trim()) errors.subject = 'Write a subject.'
  else if (form.subject.length > MESSAGE_SUBJECT_MAX) errors.subject = `Keep the subject under ${MESSAGE_SUBJECT_MAX} characters.`
  if (form.body.trim().length < MESSAGE_BODY_MIN) errors.body = `Write at least ${MESSAGE_BODY_MIN} characters.`
  else if (form.body.length > MESSAGE_BODY_MAX) errors.body = 'This message is too long.'

  return errors
}

/** The words a message may use to address each person; the server fills them in, one draft per person. */
export const MESSAGE_TOKENS: ReadonlyArray<{ token: string; label: string }> = [
  { token: '{{first_name}}', label: 'First name' },
  { token: '{{company}}', label: 'Company' },
]

/** What a token becomes for one person, so the dialog can show a preview. Mirrors the server (first word of the name; the company name). */
export function fillTokens(text: string, person: Pick<OutreachPerson, 'full_name' | 'company_name'>): string {
  const first = (person.full_name ?? '').trim().split(/\s+/)[0] ?? ''

  return text.replace(/\{\{\s*first_name\s*\}\}/gi, first || 'there').replace(/\{\{\s*company\s*\}\}/gi, person.company_name)
}

/** "2 drafts saved, 1 could not be written": the line for the result of writing to several people. */
export function draftSummary(drafted: number, refused: number): string {
  if (drafted === 0 && refused === 0) return 'Nothing was written.'
  const parts: string[] = []
  if (drafted > 0) parts.push(`${drafted} ${drafted === 1 ? 'draft' : 'drafts'} saved`)
  if (refused > 0) parts.push(`${refused} could not be written`)

  return `${parts.join(', ')}.`
}
