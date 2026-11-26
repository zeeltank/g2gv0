import type { SignalConvertBody } from '@/services/signal-review/signal-funnel-service'

/**
 * The choices of a signal's "Convert to opportunity" pop-up (S20), and the rules that turn them into the request. It is the Convert Lead pop-up's own set of
 * choices (an organization, a person, an opportunity, an owner) with two differences: the person is OPTIONAL (a signal names a company, not someone), and the
 * organization and the opportunity are always made. Pure, so a test reads it without a screen.
 */

export interface SignalConvertForm {
  useExistingOrganization: boolean
  organizationName: string
  industry: string
  existingOrganizationId: string
  existingOrganizationName: string
  /** "Add a person (optional)": off until the person decides there is somebody to add. */
  addPerson: boolean
  linkExisting: boolean
  existingContactId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  title: string
  makePrimary: boolean
  contactRole: string
  /** null until the person types: the name then follows the company ("<Company> - <Signal title>"). */
  opportunityName: string | null
  amount: string
  currency: string
  closeDate: string
  stage: string
  assignedTo: string
}

/** What of a signal the pop-up reads: its company, the company's industry and its title (both the Signal Review row and the Company Opportunities row have them). */
export interface SignalSource {
  company_name?: string | null
  industry?: string | null
  title?: string | null
}

type Source = SignalSource

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export function initialSignalConvertForm(signal: Source, defaultStage = ''): SignalConvertForm {
  return {
    useExistingOrganization: false, organizationName: text(signal.company_name), industry: text(signal.industry), existingOrganizationId: '', existingOrganizationName: '',
    addPerson: false, linkExisting: false, existingContactId: '', firstName: '', lastName: '', email: '', phone: '', title: '',
    makePrimary: false, contactRole: '',
    opportunityName: null, amount: '', currency: '', closeDate: '', stage: defaultStage, assignedTo: '',
  }
}

/** The company the signal is converted for: the typed name of a new organization, or the chosen one. */
export function signalCompanyName(form: SignalConvertForm): string {
  return (form.useExistingOrganization ? form.existingOrganizationName : form.organizationName).trim()
}

/** "<Company> - <Signal title>", the name the opportunity starts with. */
export function defaultSignalOpportunityName(form: SignalConvertForm, signal: Source): string {
  return [signalCompanyName(form), text(signal.title)].filter((part) => part !== '').join(' - ')
}

export function signalOpportunityNameOf(form: SignalConvertForm, signal: Source): string {
  return form.opportunityName ?? defaultSignalOpportunityName(form, signal)
}

/** Will the person be at a company? (They always are: the organization is always made or chosen.) */
export const personHasCompany = (form: SignalConvertForm): boolean => form.addPerson && (form.useExistingOrganization ? form.existingOrganizationId !== '' : form.organizationName.trim() !== '')

/** The first thing to correct before anything is sent, as a sentence; null when the choices can be sent. */
export function signalConvertProblem(form: SignalConvertForm): string | null {
  if (form.useExistingOrganization) {
    if (form.existingOrganizationId === '') return 'Choose which existing organization to use.'
  } else if (form.organizationName.trim() === '') {
    return 'Name the organization, or use an existing one.'
  }
  if (form.addPerson) {
    if (form.linkExisting && form.existingContactId === '') return 'Choose which existing Contact to attach to.'
    if (!form.linkExisting && form.lastName.trim() === '') return 'A new person needs a last name.'
  }
  const amount = form.amount.trim()
  if (amount !== '' && !(Number(amount) >= 0)) return 'The amount must be a number of zero or more.'

  return null
}

/** What is sent. Only what the person chose: a person only when "Add a person" is on, the amount only when typed, an existing organization instead of a name. */
export function signalConvertPayload(form: SignalConvertForm, signal: Source): SignalConvertBody {
  const body: SignalConvertBody = {}
  if (form.useExistingOrganization) {
    body.existingOrganizationId = Number(form.existingOrganizationId)
  } else {
    body.organizationName = form.organizationName.trim()
    if (form.industry.trim() !== '') body.industry = form.industry.trim()
  }
  if (form.addPerson) {
    if (form.linkExisting) {
      body.existingContactId = Number(form.existingContactId)
    } else {
      const person: NonNullable<SignalConvertBody['person']> = { lastName: form.lastName.trim() }
      if (form.firstName.trim() !== '') person.firstName = form.firstName.trim()
      if (form.email.trim() !== '') person.email = form.email.trim()
      if (form.phone.trim() !== '') person.phone = form.phone.trim()
      if (form.title.trim() !== '') person.title = form.title.trim()
      body.person = person
    }
    if (form.makePrimary) body.makePrimary = true
    if (form.contactRole !== '') body.contactRole = form.contactRole
  }
  const opportunity: NonNullable<SignalConvertBody['opportunity']> = { name: signalOpportunityNameOf(form, signal) }
  if (form.amount.trim() !== '') opportunity.amount = Number(form.amount)
  if (form.currency !== '') opportunity.currency = form.currency
  if (form.closeDate !== '') opportunity.closeDate = form.closeDate
  if (form.stage !== '') opportunity.stage = form.stage
  body.opportunity = opportunity
  if (form.assignedTo !== '') body.assignedTo = Number(form.assignedTo)

  return body
}
