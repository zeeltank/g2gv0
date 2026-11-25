import type { Contact, ContactDealRow } from '@/types/crm'

/** Words and small rules of the Person panel and the People tab. Pure, so each is tested without a browser. */

export const NO_VALUE = '—'

type NameParts = Pick<Contact, 'firstName' | 'lastName'> & Partial<Pick<Contact, 'salutation'>>

/** "Mrs. Meera Patel" (with the salutation) or "Meera Patel". */
export function personName(person: NameParts, withSalutation = false): string {
  return [withSalutation ? person.salutation : null, person.firstName, person.lastName].map((part) => (part ?? '').trim()).filter(Boolean).join(' ')
}

export function personInitials(person: NameParts): string {
  const first = (person.firstName ?? '').trim()[0] ?? ''
  const last = (person.lastName ?? '').trim()[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

/** The Role picklist as the seed command writes it, for a server whose picklist has not been seeded yet. */
export const ROLE_FALLBACK: readonly string[] = ['Decision maker', 'Influencer', 'Billing', 'Technical', 'User', 'Other']

/** "12 Ashram Road, Ahmedabad, Gujarat 380009, India", or null when the address is empty. */
export function addressLine(parts: { street?: string | null; city?: string | null; state?: string | null; code?: string | null; country?: string | null; poBox?: string | null }): string | null {
  const regionWithCode = [parts.state, parts.code].map((p) => (p ?? '').trim()).filter(Boolean).join(' ')
  const line = [parts.street, parts.poBox ? `PO box ${parts.poBox}` : null, parts.city, regionWithCode, parts.country].map((p) => (p ?? '').trim()).filter(Boolean).join(', ')
  return line || null
}

export const mailingAddress = (c: Contact) => addressLine({ street: c.mailingStreet, poBox: c.mailingPoBox, city: c.mailingCity, state: c.mailingState, code: c.mailingCode, country: c.mailingCountry })
export const otherAddress = (c: Contact) => addressLine({ street: c.otherStreet, poBox: c.otherPoBox, city: c.otherCity, state: c.otherState, code: c.otherCode, country: c.otherCountry })

/** "14 Mar" for a `Y-m-d` birthday; the year is not shown (a person's age is not the screen's business). */
export function birthdayText(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]}`
}

/** What a row of the Deals tab is called: the name or subject, else its number, else its id. */
export function dealLabel(row: ContactDealRow): string {
  return row.name || row.subject || row.title || row.number || `#${row.id}`
}

/** The line under it: the number (when the label is not the number), the status or stage, the date. */
export function dealSubline(row: ContactDealRow): string {
  const label = dealLabel(row)
  return [row.number && row.number !== label ? row.number : null, row.status || row.stage, row.date].filter(Boolean).join(' · ')
}

/** "INR 12,50,000" style is the server's money; here it is the number with thousands separators and the currency code in front, or null. */
export function dealAmount(row: ContactDealRow): string | null {
  const raw = row.amount ?? row.total
  if (raw === null || raw === undefined || raw === '') return null
  const value = typeof raw === 'number' ? raw : Number(raw)
  const text = Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(raw)
  return [row.currency, text].filter(Boolean).join(' ')
}

/** The restrictions a person's row can show without reading their consent: the two flags the list carries. */
export type RestrictionTone = 'do-not-call' | 'email-opt-out' | null

export function restriction(person: Pick<Contact, 'doNotCall' | 'emailOptOut'>): { tone: RestrictionTone; label: string | null } {
  if (person.doNotCall) return { tone: 'do-not-call', label: 'Do not call' }
  if (person.emailOptOut) return { tone: 'email-opt-out', label: 'Email opt-out' }
  return { tone: null, label: null }
}
