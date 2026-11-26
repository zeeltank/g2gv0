import type { GtmContact } from '@/services/gtm/gtm'

/**
 * "Qualify as lead" (S20): after prospecting, ONE person at a target account becomes a CRM lead that names them, and the account moves to Engaged. These are the
 * rules the dialog and the signal's "Convert to lead" person list share: who can be chosen, why one cannot, what is sent and what is said. Pure, so a test reads
 * them without a screen.
 */

export const QUALIFY_SENTENCE = 'This creates a lead for this person and marks the account Engaged.'
export const NEEDS_A_PERSON = 'Add a person to this account first.'
export const NO_PERSON_YET = 'No person yet'

const UNREACHABLE: Record<string, string> = {
  do_not_contact: 'asked not to be contacted',
  unsubscribed: 'unsubscribed',
  bounced: 'their email bounced',
}

/** Why this person cannot become a lead, in a few words; null when they can. The server refuses the same people, with its own sentence. */
export function contactBlock(contact: Pick<GtmContact, 'status'>): string | null {
  return UNREACHABLE[contact.status] ?? null
}

/** "Rahul Verma · Principal", or the name alone. */
export const contactLabel = (contact: Pick<GtmContact, 'full_name' | 'title'>): string => [contact.full_name, contact.title].filter((part) => part && part.trim() !== '').join(' · ')

/** The people who can be chosen first, so a list never opens on someone who is disabled; the order within each group is kept. */
export function chooseable(contacts: readonly GtmContact[]): GtmContact[] {
  return [...contacts.filter((c) => contactBlock(c) === null), ...contacts.filter((c) => contactBlock(c) !== null)]
}

export interface QualifyForm {
  contactId: string
  assignedTo: string
}

/** The first thing to correct before anything is sent; null when it can be sent. */
export function qualifyProblem(form: QualifyForm, contacts: readonly GtmContact[]): string | null {
  const chosen = contacts.find((c) => String(c.id) === form.contactId)
  if (!chosen) return 'Choose the person this lead is for.'
  const block = contactBlock(chosen)
  return block ? `${chosen.full_name} ${block}, so a lead cannot be made for them.` : null
}

/** What is sent: the person, and the owner only when somebody other than the caller was chosen (the server defaults to the caller). */
export function qualifyBody(form: QualifyForm, me: string | null): { contactId: number; assignedTo?: number } {
  const body: { contactId: number; assignedTo?: number } = { contactId: Number(form.contactId) }
  if (form.assignedTo !== '' && form.assignedTo !== me) body.assignedTo = Number(form.assignedTo)
  return body
}

/** The confirmation after the answer. A person who already had their lead is told so; nothing was made. */
export const qualifyNotice = (created: boolean, personName: string): string =>
  created ? `Lead created for ${personName}. The account is now Engaged.` : `${personName} already has a lead, so no second one was made.`
