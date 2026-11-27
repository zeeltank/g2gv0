import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  companyWillExist, convertPayload, convertProblem, defaultOpportunityName, effectiveTransfer, initialConvertForm, personWillExist, transferOptions, type ConvertForm,
} from './convert-model'
import { conversionMessage } from './model'
import { lead } from './fixtures'

/** The rules behind the Convert Lead pop-up, read without a screen (the screen's own test is convert-lead-dialog.test.tsx). */

const asha = lead({ assignedTo: '2', industry: 'Education' })
/**
 * The OLD starting point (organization on, opportunity off): most rules below are about what the organization does. The pop-up now starts the NEW way (27 Nov 2026: a person and
 * an opportunity, no organization; the organization is made when the opportunity is won): that is `fresh`, and it has its own tests.
 */
const form = (over: Partial<ConvertForm> = {}): ConvertForm => ({ ...initialConvertForm(asha), createOrganization: true, createOpportunity: false, ...over })
const fresh = (over: Partial<ConvertForm> = {}): ConvertForm => ({ ...initialConvertForm(asha), ...over })

describe('what the pop-up starts with', () => {
  it('starts with a person and an opportunity and NO organization, prefilled from the lead, with the owner from the lead and nothing else', () => {
    const f = initialConvertForm(asha)
    assert.deepEqual([f.createOrganization, f.createContact, f.createOpportunity, f.organizationName, f.industry, f.assignedTo, f.makePrimary, f.transferTo], [false, true, true, 'Hillcrest Academy', 'Education', '2', false, null])
  })

  it('starts with the organization off for a lead with no company', () => {
    const f = initialConvertForm(lead({ company: null }))
    assert.deepEqual([f.createOrganization, f.organizationName], [false, ''])
  })

  it('names the opportunity "<Company> - <Lead name>", or the lead alone without a company', () => {
    assert.equal(defaultOpportunityName(form(), asha), 'Hillcrest Academy - Asha Menon')
    assert.equal(defaultOpportunityName(form({ organizationName: 'Hillcrest Trust' }), asha), 'Hillcrest Trust - Asha Menon')
    assert.equal(defaultOpportunityName(form({ createOrganization: false }), lead({ company: null })), 'Asha Menon')
  })
})

describe('what is asked of the person before the request is sent', () => {
  it('keeps today\'s sentences and adds the organization name and the existing organization', () => {
    assert.equal(convertProblem(form()), null)
    assert.equal(convertProblem(form({ createOrganization: false, createContact: false })), 'Select at least one of Organization, Contact or Opportunity to create.')
    assert.equal(convertProblem(form({ createOrganization: false, createContact: false, createOpportunity: true })), null, 'an opportunity alone is enough')
    assert.equal(convertProblem(form({ organizationName: '  ' })), 'Organization name is required.')
    assert.equal(convertProblem(form({ useExistingOrganization: true })), 'Choose which existing organization to use.')
    assert.equal(convertProblem(form({ useExistingOrganization: true, existingOrganizationId: '12' })), null)
    assert.equal(convertProblem(form({ linkExisting: true })), 'Choose which existing Contact to attach to.')
    assert.equal(convertProblem(form({ assignedTo: '' })), 'Assigned To is required.')
    assert.equal(convertProblem(form({ createOpportunity: true, amount: '-1' })), 'Amount must be a number, zero or more.')
    assert.equal(convertProblem(form({ createOpportunity: false, amount: '-1' })), null, 'an amount of a deal that is off is not judged')
  })
})

describe('the request', () => {
  it('leaves out every opportunity field while the opportunity is off', () => {
    const payload = convertPayload(form({ amount: '5000', currency: 'USD', closeDate: '2026-12-31', stage: 'Prospecting', opportunityName: 'x' }), asha)
    assert.equal('opportunity' in payload, false)
    assert.equal(payload.createOpportunity, false)
  })

  it('sends the opportunity with only the fields that have a value', () => {
    const payload = convertPayload(form({ createOpportunity: true, amount: '5000', stage: 'Prospecting' }), asha)
    assert.deepEqual(payload.opportunity, { name: 'Hillcrest Academy - Asha Menon', amount: 5000, stage: 'Prospecting' })
  })

  it('sends the star and the role only for a person with a company', () => {
    assert.equal(convertPayload(form({ makePrimary: true, contactRole: 'Billing' }), asha).makePrimary, true)
    const noCompany = convertPayload(form({ createOrganization: false, makePrimary: true, contactRole: 'Billing' }), asha)
    assert.deepEqual(['makePrimary' in noCompany, 'contactRole' in noCompany], [false, false])
    const noPerson = convertPayload(form({ createContact: false, makePrimary: true }), asha)
    assert.equal('makePrimary' in noPerson, false)
  })

  it('an existing organization replaces the new one\'s name, industry and create flag', () => {
    const payload = convertPayload(form({ useExistingOrganization: true, existingOrganizationId: '12', existingOrganizationName: 'Acme Schools' }), asha)
    assert.deepEqual([payload.createOrganization, payload.existingOrganizationId, 'organizationName' in payload, 'industry' in payload], [false, '12', false, false])
  })
})

describe('where the records can move to', () => {
  it('offers only what will exist, in this order', () => {
    assert.deepEqual(transferOptions(form(), asha), ['organization', 'contact'])
    assert.deepEqual(transferOptions(form({ createOpportunity: true }), asha), ['organization', 'contact', 'opportunity'])
    assert.deepEqual(transferOptions(form({ createOrganization: false, createContact: false, createOpportunity: true }), asha), ['opportunity'])
    assert.deepEqual(transferOptions(form({ createOrganization: false, createContact: false }), asha), [])
  })

  it('a company with no name yet, and an existing one not yet chosen, are not targets; a lead naming no person makes no person to move to', () => {
    assert.equal(companyWillExist(form({ organizationName: '' })), false)
    assert.equal(companyWillExist(form({ useExistingOrganization: true })), false)
    assert.equal(personWillExist(form(), lead({ hasRealName: false })), false)
    assert.equal(personWillExist(form({ linkExisting: true, existingContactId: '9' }), lead({ hasRealName: false })), true)
  })

  it('defaults to the person, else the organization, honours a choice that is still possible, and drops one that is not', () => {
    assert.equal(effectiveTransfer(form(), asha), 'contact')
    assert.equal(effectiveTransfer(form({ createContact: false }), asha), 'organization')
    assert.equal(effectiveTransfer(form({ transferTo: 'organization' }), asha), 'organization')
    assert.equal(effectiveTransfer(form({ transferTo: 'none' }), asha), 'none')
    assert.equal(effectiveTransfer(form({ transferTo: 'opportunity' }), asha), 'contact', 'the opportunity is off')
    assert.equal(effectiveTransfer(form({ createOrganization: false, createContact: false }), asha), 'none')
  })
})

describe('what the page says after a conversion', () => {
  it('is the plain message when the pop-up chose nothing to say, or an older server answers nothing more', () => {
    assert.equal(conversionMessage({ message: 'Lead converted.', data: { organizationId: '5' } }), 'Lead converted.')
    assert.equal(conversionMessage({ message: 'Lead converted.', data: {} }, {}), 'Lead converted.')
    assert.equal(conversionMessage({ message: 'Lead converted.' }, { transferTo: 'contact' }), 'Lead converted.')
  })

  it('says what was created, what was attached, and the star', () => {
    assert.equal(conversionMessage({ message: 'Lead converted.', data: { organizationId: '5', contactId: '6', opportunityId: null } }, {}), 'Lead converted. Created organization and person.')
    assert.equal(conversionMessage({ message: 'Lead converted.', data: { organizationId: '5', contactId: '6', primarySet: true } }, { organizationExisting: true }), 'Lead converted. Created person. Added to the existing organization. Set as the primary contact of the company.')
    assert.equal(conversionMessage({ message: 'Lead converted.', data: { organizationId: '5', contactId: '6', primarySet: false } }, {}), 'Lead converted. Created organization and person.', 'a star that was not given is not claimed')
  })

  it('says what moved and where, with the right plurals, and when there was nothing to move', () => {
    const data = (transferred: Record<string, number>) => ({ message: 'Lead converted.', data: { transferred } })
    assert.equal(conversionMessage(data({ comments: 1, emails: 2, documents: 1, events: 3 }), { transferTo: 'organization' }), 'Lead converted. Moved 1 comment, 2 emails, 1 document and 3 events to the organization.')
    assert.equal(conversionMessage(data({ comments: 0, emails: 1, documents: 0, events: 0 }), { transferTo: 'opportunity' }), 'Lead converted. Moved 1 email to the opportunity.')
    assert.equal(conversionMessage(data({ comments: 0, emails: 0, documents: 0, events: 0 }), { transferTo: 'contact' }), 'Lead converted. There was nothing to move.')
  })

  it('keeps the notice about a missing person first and says what moved after it, without listing what was created', () => {
    const answer = { message: 'Lead converted.', data: { organizationId: '5', notice: 'No contact was created: the lead names no person.', transferred: { comments: 1, emails: 0, documents: 0, events: 0 } } }
    assert.equal(conversionMessage(answer, { transferTo: 'organization' }), 'No contact was created: the lead names no person. Moved 1 comment to the organization.')
  })
})

describe('the new lifecycle: a lead becomes an opportunity with no organization', () => {
  it('sends no organization and no organization fields, with the person and the opportunity on', () => {
    const payload = convertPayload(fresh(), asha)
    assert.deepEqual([payload.createOrganization, payload.createContact, payload.createOpportunity], [false, true, true])
    for (const key of ['organizationName', 'industry', 'existingOrganizationId', 'makePrimary', 'contactRole']) assert.ok(!(key in payload), `no ${key}`)
    assert.equal(payload.opportunity?.name, 'Hillcrest Academy - Asha Menon', 'the opportunity is still named after the company the lead names')
  })

  it('is valid as it starts, and when only the opportunity is kept', () => {
    assert.equal(convertProblem(fresh()), null)
    assert.equal(convertProblem(fresh({ createContact: false })), null)
    assert.equal(convertProblem(fresh({ createContact: false, createOpportunity: false })), 'Select at least one of Organization, Contact or Opportunity to create.')
  })

  it('offers the person and the opportunity to move related records to, never an organization that will not exist', () => {
    assert.deepEqual(transferOptions(fresh(), asha), ['contact', 'opportunity'])
    assert.equal(effectiveTransfer(fresh(), asha), 'contact')
    assert.equal(companyWillExist(fresh()), false)
  })
})
