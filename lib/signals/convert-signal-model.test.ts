import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  defaultSignalOpportunityName, initialSignalConvertForm, personHasCompany, signalConvertPayload, signalConvertProblem, signalOpportunityNameOf, type SignalConvertForm,
} from './convert-signal-model'

const signal = { company_name: 'Greenfield School', industry: 'Education', title: 'Opens a new campus' }
const form = (patch: Partial<SignalConvertForm> = {}): SignalConvertForm => ({ ...initialSignalConvertForm(signal, 'Prospecting'), ...patch })

describe('the Convert to opportunity form', () => {
  it('starts from the signal\'s company (name and industry), with no person, and the opportunity named after the company and the signal', () => {
    const start = initialSignalConvertForm(signal, 'Prospecting')
    assert.equal(start.organizationName, 'Greenfield School')
    assert.equal(start.industry, 'Education')
    assert.equal(start.addPerson, false, 'a signal names a company, not a person')
    assert.equal(start.stage, 'Prospecting')
    assert.equal(defaultSignalOpportunityName(start, signal), 'Greenfield School - Opens a new campus')
    assert.equal(signalOpportunityNameOf(start, signal), 'Greenfield School - Opens a new campus')
    assert.equal(signalOpportunityNameOf({ ...start, opportunityName: 'My deal' }, signal), 'My deal', 'a typed name wins')
  })

  it('names the opportunity after the CHOSEN company when an existing one is used', () => {
    const existing = form({ useExistingOrganization: true, existingOrganizationId: '12', existingOrganizationName: 'Acme Schools' })
    assert.equal(signalOpportunityNameOf(existing, signal), 'Acme Schools - Opens a new campus')
  })

  it('asks for an organization, and a last name or an existing person only when a person is added', () => {
    assert.equal(signalConvertProblem(form()), null, 'the prefilled form can be sent as it is')
    assert.equal(signalConvertProblem(form({ organizationName: ' ' })), 'Name the organization, or use an existing one.')
    assert.equal(signalConvertProblem(form({ useExistingOrganization: true })), 'Choose which existing organization to use.')
    assert.equal(signalConvertProblem(form({ addPerson: true })), 'A new person needs a last name.')
    assert.equal(signalConvertProblem(form({ addPerson: true, linkExisting: true })), 'Choose which existing Contact to attach to.')
    assert.equal(signalConvertProblem(form({ addPerson: true, lastName: 'Rao' })), null)
    assert.equal(signalConvertProblem(form({ amount: '-5' })), 'The amount must be a number of zero or more.')
  })

  it('offers the star and the role only for a person who will be at a company', () => {
    assert.equal(personHasCompany(form()), false)
    assert.equal(personHasCompany(form({ addPerson: true })), true)
    assert.equal(personHasCompany(form({ addPerson: true, organizationName: '' })), false)
    assert.equal(personHasCompany(form({ addPerson: true, useExistingOrganization: true, existingOrganizationId: '12' })), true)
  })

  it('sends the organization and the opportunity alone when there is no person', () => {
    assert.deepEqual(signalConvertPayload(form(), signal), {
      organizationName: 'Greenfield School', industry: 'Education', opportunity: { name: 'Greenfield School - Opens a new campus', stage: 'Prospecting' },
    })
  })

  it('sends a new person with the star and the role, and the opportunity\'s details only when typed', () => {
    const body = signalConvertPayload(form({
      addPerson: true, firstName: 'Asha', lastName: 'Rao', email: 'asha@greenfield.example', title: 'Principal', makePrimary: true, contactRole: 'Decision maker',
      amount: '250000', currency: 'INR', closeDate: '2027-03-31', stage: 'Proposal', assignedTo: '9',
    }), signal)
    assert.deepEqual(body, {
      organizationName: 'Greenfield School', industry: 'Education',
      person: { lastName: 'Rao', firstName: 'Asha', email: 'asha@greenfield.example', title: 'Principal' }, makePrimary: true, contactRole: 'Decision maker',
      opportunity: { name: 'Greenfield School - Opens a new campus', amount: 250000, currency: 'INR', closeDate: '2027-03-31', stage: 'Proposal' }, assignedTo: 9,
    })
  })

  it('sends an existing organization by id (no name) and an existing person by id (no new person)', () => {
    const body = signalConvertPayload(form({ useExistingOrganization: true, existingOrganizationId: '12', existingOrganizationName: 'Acme Schools', addPerson: true, linkExisting: true, existingContactId: '44' }), signal)
    assert.equal(body.existingOrganizationId, 12)
    assert.equal(body.existingContactId, 44)
    assert.equal('organizationName' in body, false)
    assert.equal('person' in body, false)
    assert.equal(body.opportunity?.name, 'Acme Schools - Opens a new campus')
  })
})
