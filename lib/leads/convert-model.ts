import type { ConvertLeadPayload, ConvertOpportunityDetails, ConvertTransferTarget, Lead } from '../../types/crm'

/**
 * The choices of the one Convert Lead pop-up (S19), and the rules that turn them into the request: what is asked of the person, what is sent, and which
 * targets "Transfer related records to" can offer (only a record that will exist after the conversion). Pure, so a test reads it without a screen.
 */

export interface ConvertForm {
  createOrganization: boolean
  useExistingOrganization: boolean
  organizationName: string
  industry: string
  existingOrganizationId: string
  existingOrganizationName: string
  createContact: boolean
  linkExisting: boolean
  existingContactId: string
  makePrimary: boolean
  contactRole: string
  createOpportunity: boolean
  /** null until the person types: the name then follows the company ("<Company> - <Lead name>"). */
  opportunityName: string | null
  amount: string
  currency: string
  closeDate: string
  stage: string
  assignedTo: string
  /** null until the person chooses: the default then follows what will exist (the person, else the organization). */
  transferTo: ConvertTransferTarget | 'none' | null
}

export const TRANSFER_LABEL: Record<ConvertTransferTarget, string> = { organization: 'Organization', contact: 'Person', opportunity: 'Opportunity' }

/**
 * Where a conversion starts (27 Nov 2026, owner: product > signal > outreach > lead > opportunity > quote, and only a customer that converts becomes an Organization): a person and an
 * opportunity, NO organization. The Organization is made automatically when the opportunity is won; the switch stays for a lead that belongs to a company that already exists
 * (or one to be made now).
 */
export function initialConvertForm(lead: Lead, defaultStage = ''): ConvertForm {
  return {
    createOrganization: false, useExistingOrganization: false, organizationName: lead.company ?? '', industry: lead.industry ?? '',
    existingOrganizationId: '', existingOrganizationName: '',
    createContact: true, linkExisting: false, existingContactId: '', makePrimary: false, contactRole: '',
    createOpportunity: true, opportunityName: null, amount: '', currency: '', closeDate: '', stage: defaultStage,
    assignedTo: lead.assignedTo ?? '', transferTo: null,
  }
}

/** "Asha Menon" - the lead's own name, as the person would say it. */
export function leadPersonName(lead: Lead): string {
  return [lead.firstName, lead.lastName].filter((part) => part && part.trim() !== '').join(' ').trim()
}

/** The company the lead is turned into: the typed name of a new organization, or the chosen one. */
export function companyName(form: ConvertForm, lead: Lead): string {
  if (form.createOrganization && form.useExistingOrganization) return form.existingOrganizationName.trim()
  if (form.createOrganization) return form.organizationName.trim()
  return (lead.company ?? '').trim()
}

/** "<Company> - <Lead name>", the name the opportunity starts with; the lead's name alone when there is no company. */
export function defaultOpportunityName(form: ConvertForm, lead: Lead): string {
  const company = companyName(form, lead)
  const person = leadPersonName(lead)
  return [company, person].filter((part) => part !== '').join(' - ')
}

export function opportunityNameOf(form: ConvertForm, lead: Lead): string {
  return form.opportunityName ?? defaultOpportunityName(form, lead)
}

/** Whether there is a company after the conversion: a new one with a name, or an existing one that was chosen. */
export function companyWillExist(form: ConvertForm): boolean {
  if (!form.createOrganization) return false
  return form.useExistingOrganization ? form.existingOrganizationId !== '' : form.organizationName.trim() !== ''
}

/** Whether there is a person after the conversion: a chosen one, or a new one when the lead names a person (a lead named after its company makes none). */
export function personWillExist(form: ConvertForm, lead: Lead): boolean {
  if (!form.createContact) return false
  return form.linkExisting ? form.existingContactId !== '' : lead.hasRealName !== false
}

/** The targets the records can move to, in the order they are offered: only the ones that will exist. */
export function transferOptions(form: ConvertForm, lead: Lead): ConvertTransferTarget[] {
  const targets: ConvertTransferTarget[] = []
  if (companyWillExist(form)) targets.push('organization')
  if (personWillExist(form, lead)) targets.push('contact')
  if (form.createOpportunity) targets.push('opportunity')
  return targets
}

/** What is chosen now: the person's own choice while it is still possible, else the default (the person when one is made, else the organization, else nothing). */
export function effectiveTransfer(form: ConvertForm, lead: Lead): ConvertTransferTarget | 'none' {
  const offered = transferOptions(form, lead)
  if (form.transferTo === 'none') return 'none'
  if (form.transferTo !== null && offered.includes(form.transferTo)) return form.transferTo
  if (offered.includes('contact')) return 'contact'
  if (offered.includes('organization')) return 'organization'
  return 'none'
}

/** The first thing to fix before the request is sent, in words; null when it can be sent. The sentences of the first version are kept as they were. */
export function convertProblem(form: ConvertForm): string | null {
  if (!form.createOrganization && !form.createContact && !form.createOpportunity) return 'Select at least one of Organization, Contact or Opportunity to create.'
  if (form.createOrganization && !form.useExistingOrganization && form.organizationName.trim() === '') return 'Organization name is required.'
  if (form.createOrganization && form.useExistingOrganization && form.existingOrganizationId === '') return 'Choose which existing organization to use.'
  if (form.createContact && form.linkExisting && form.existingContactId === '') return 'Choose which existing Contact to attach to.'
  if (form.assignedTo === '') return 'Assigned To is required.'
  if (form.createOpportunity && form.amount.trim() !== '') {
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount < 0) return 'Amount must be a number, zero or more.'
  }
  return null
}

/** The request. Everything the pop-up adds is left out unless it was asked for: no opportunity fields while the opportunity is off, no star without a company, nothing moves unless a target is chosen. */
export function convertPayload(form: ConvertForm, lead: Lead): ConvertLeadPayload {
  const newOrganization = form.createOrganization && !form.useExistingOrganization
  const existingOrganization = form.createOrganization && form.useExistingOrganization
  const withCompany = companyWillExist(form) && form.createContact

  const opportunity: ConvertOpportunityDetails = {}
  if (form.createOpportunity) {
    const name = opportunityNameOf(form, lead).trim()
    if (name !== '') opportunity.name = name
    if (form.amount.trim() !== '') opportunity.amount = Number(form.amount)
    if (form.currency !== '') opportunity.currency = form.currency
    if (form.closeDate !== '') opportunity.closeDate = form.closeDate
    if (form.stage !== '') opportunity.stage = form.stage
  }
  const transfer = effectiveTransfer(form, lead)

  return {
    createOrganization: newOrganization,
    createContact: form.createContact,
    assignedTo: form.assignedTo,
    createOpportunity: form.createOpportunity,
    ...(newOrganization ? { organizationName: form.organizationName.trim(), ...(form.industry !== '' ? { industry: form.industry } : {}) } : {}),
    ...(existingOrganization ? { existingOrganizationId: form.existingOrganizationId } : {}),
    ...(form.createContact && form.linkExisting ? { existingContactId: form.existingContactId } : {}),
    ...(withCompany && form.makePrimary ? { makePrimary: true } : {}),
    ...(withCompany && form.contactRole !== '' ? { contactRole: form.contactRole } : {}),
    ...(form.createOpportunity ? { opportunity } : {}),
    ...(transfer !== 'none' ? { transferRelatedTo: transfer } : {}),
  }
}
