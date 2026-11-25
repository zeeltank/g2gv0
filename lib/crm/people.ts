import type { Contact, ContactListQuery, CrmBulkActionResponse, Organization } from '@/types/crm'

/**
 * The All people scope of the Organizations list and the Companies columns that go with it (S18, 25 Nov 2026: Contacts were merged into Organizations). Pure, so each rule
 * is proved without a browser: the chips and what each one asks the server for, the words of a row, what a company delete says about its people.
 */

export const PEOPLE_PAGE_SIZE = 20

// ── The list: sorting and the chips ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The columns the server sorts by. `is_primary` and `contact_role` are the new ones (contract section 2). */
export type PeopleSortKey = 'last_name' | 'first_name' | 'email' | 'title' | 'created_at' | 'is_primary' | 'contact_role'

export type PeopleFilter = 'all' | 'primary' | 'mine' | 'do-not-call' | 'no-company'

export const PEOPLE_FILTERS: ReadonlyArray<{ id: PeopleFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'primary', label: 'Primary' },
  { id: 'mine', label: 'Mine' },
  { id: 'do-not-call', label: 'Do not call' },
  { id: 'no-company', label: 'No company' },
]

export interface PeopleListState {
  page: number
  search: string
  sortKey: PeopleSortKey
  sortAsc: boolean
  filter: PeopleFilter
}

export const INITIAL_PEOPLE_STATE: PeopleListState = { page: 1, search: '', sortKey: 'last_name', sortAsc: true, filter: 'all' }

/**
 * What the state asks the server for. "Mine" is the signed-in person's user id (`owner`); a chip never sends more than its own filter, so the chips are exclusive.
 * With no user id there is nobody to be "mine" for, so the chip sends nothing it could be misread as (the screen disables it).
 */
export function peopleQuery(state: PeopleListState, userId: string): ContactListQuery {
  const query: ContactListQuery = {
    page: state.page, perPage: PEOPLE_PAGE_SIZE, sortBy: state.sortKey, sortDir: state.sortAsc ? 'asc' : 'desc',
  }
  if (state.search.trim() !== '') query.search = state.search.trim()
  if (state.filter === 'primary') query.primary = true
  if (state.filter === 'mine' && userId !== '') query.owner = userId
  if (state.filter === 'do-not-call') query.doNotCall = true
  if (state.filter === 'no-company') query.noCompany = true
  return query
}

const SORT_KEYS: readonly string[] = ['last_name', 'first_name', 'email', 'title', 'created_at', 'is_primary', 'contact_role']
const FILTER_IDS: readonly string[] = PEOPLE_FILTERS.map((f) => f.id)

/** What a saved view stores. Read back by the same module only, so an unknown value from an older view is ignored rather than trusted. */
export function viewConditions(state: Pick<PeopleListState, 'search' | 'sortKey' | 'sortAsc' | 'filter'>): Record<string, unknown> {
  return { search: state.search, sortKey: state.sortKey, sortAsc: state.sortAsc, filter: state.filter }
}

export function applyViewConditions(conditions: Record<string, unknown>, current: PeopleListState): PeopleListState {
  const next: PeopleListState = { ...current, page: 1 }
  if (typeof conditions.search === 'string') next.search = conditions.search
  if (typeof conditions.sortKey === 'string' && SORT_KEYS.includes(conditions.sortKey)) next.sortKey = conditions.sortKey as PeopleSortKey
  if (typeof conditions.sortAsc === 'boolean') next.sortAsc = conditions.sortAsc
  next.filter = typeof conditions.filter === 'string' && FILTER_IDS.includes(conditions.filter) ? (conditions.filter as PeopleFilter) : 'all'
  return next
}

// ── The words of a row ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A row of the All people list: a person, and whether the company is in the Recycle Bin (the answer's `organizationDeleted`, optional so an older server still works). */
export type PersonRow = Contact & { organizationDeleted?: boolean | null }

export const NO_VALUE = '—'

export function fullName(person: Pick<Contact, 'firstName' | 'lastName'>): string {
  return [person.firstName, person.lastName].map((part) => (part ?? '').trim()).filter(Boolean).join(' ') || 'Unnamed'
}

/** "Principal · Decision maker", or whichever of the two there is. */
export function titleAndRole(person: Pick<Contact, 'title' | 'contactRole'>): string {
  return [person.title, person.contactRole].map((part) => (part ?? '').trim()).filter(Boolean).join(' · ') || NO_VALUE
}

export const phoneOf = (person: Pick<Contact, 'phone' | 'mobile'>): string => (person.phone ?? '').trim() || (person.mobile ?? '').trim() || NO_VALUE

/**
 * Where a person's company stands: none, in the Recycle Bin (the person stays, marked, and is linked back if the company is restored), or live. The server says "in the
 * Recycle Bin" with `organizationDeleted`; an older server never does, so such a person reads as live.
 */
export type CompanyState = 'none' | 'recycle-bin' | 'live'

export function companyState(person: Pick<PersonRow, 'organizationId' | 'organizationDeleted'>): CompanyState {
  if (!person.organizationId) return 'none'
  return person.organizationDeleted === true ? 'recycle-bin' : 'live'
}

/** "12 Oct 2026", or a dash for a missing or unreadable date. The server's `Y-m-d H:i:s` is read as written, not shifted to another time zone. */
export function createdText(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  if (!match) return NO_VALUE
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return NO_VALUE
  return `${day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]} ${match[1]}`
}

/** The result of a bulk action in words ("Deleted 3 people."). The shared message adds an "s" to its noun, which is wrong for "person". */
export function peopleBulkMessage(action: string, data: CrmBulkActionResponse['data']): string {
  const { succeeded, failed } = data.summary
  const noun = (n: number) => (n === 1 ? 'person' : 'people')
  if (failed === 0) return `${action} ${succeeded} ${noun(succeeded)}.`
  const reasons = Array.from(new Set(data.results.filter((row) => !row.ok && row.reason).map((row) => row.reason as string)))
  return `${action} ${succeeded} of ${succeeded + failed} ${noun(succeeded + failed)}. ${failed} failed: ${reasons.join(' ')}`
}

// ── The Companies list ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What the Companies list may carry beyond a company's own fields. All optional, so an older server still works: `peopleCount` and `primaryContactName` fill the People and
 * Primary contact columns, and `matchedPerson` says the search found this company through one of its people (the "Matched person" pill).
 */
export interface CompanyRow extends Organization {
  peopleCount?: number | null
  primaryContactName?: string | null
  matchedPerson?: { id?: number | string | null; name: string } | null
}

export function matchedPersonName(row: Pick<CompanyRow, 'matchedPerson'>): string | null {
  const name = row.matchedPerson?.name?.trim()
  return name ? name : null
}

const peopleWord = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`

/**
 * What deleting companies says about the people in them. Nothing about a person is deleted: they stay in All people, marked "Company in Recycle Bin", and are linked back if
 * the company is restored. Null when no row says how many people it has (an older server) or when none has any, so the plain question is asked.
 */
export function companyDeleteNote(companies: ReadonlyArray<Pick<CompanyRow, 'name' | 'peopleCount'>>): string | null {
  const counted = companies.filter((c) => typeof c.peopleCount === 'number')
  const total = counted.reduce((sum, c) => sum + (c.peopleCount ?? 0), 0)
  if (counted.length === 0 || total === 0) return null
  const whose = companies.length === 1 ? `${companies[0].name} has ${peopleWord(total)}` : `These companies have ${peopleWord(total)} between them`
  return `${whose}. They stay in All people, marked "Company in Recycle Bin", and are linked back if the company is restored. Nothing about a person is deleted.`
}

/** The question the browser asks before a company delete: what moves to the Recycle Bin, then the note about the people. */
export function companyDeleteQuestion(companies: ReadonlyArray<Pick<CompanyRow, 'name' | 'peopleCount'>>): string {
  const n = companies.length
  const head = `Delete ${n} organization${n === 1 ? '' : 's'}? This moves ${n === 1 ? 'it' : 'them'} to the Recycle Bin.`
  const note = companyDeleteNote(companies)
  return note ? `${head}\n\n${note}` : head
}
