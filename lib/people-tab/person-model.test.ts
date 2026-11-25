import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { addressLine, birthdayText, dealAmount, dealLabel, dealSubline, personInitials, personName, restriction, ROLE_FALLBACK } from '../../components/domain/crm/people/person-model'
import { whoLabel } from '../../components/domain/crm/people/who-chip'
import { railOrder } from '../../components/domain/crm/people/people-tab'
import { personPayload } from '../../components/domain/crm/create-contact-modal'
import { meera, nidhi, person, rakesh } from './kit'

describe('names and addresses', () => {
  it('writes a name with or without the salutation, and the initials from the first and last name', () => {
    assert.equal(personName(meera(), true), 'Mrs. Meera Patel')
    assert.equal(personName(meera()), 'Meera Patel')
    assert.equal(personName({ firstName: null, lastName: 'Patel' }), 'Patel')
    assert.equal(personInitials(meera()), 'MP')
    assert.equal(personInitials({ firstName: null, lastName: 'patel' }), 'P')
  })

  it('joins an address in reading order and says nothing for an empty one', () => {
    assert.equal(addressLine({ street: '12 Ashram Road', city: 'Ahmedabad', state: 'Gujarat', code: '380009', country: 'India' }), '12 Ashram Road, Ahmedabad, Gujarat 380009, India')
    assert.equal(addressLine({ poBox: '77', city: 'Surat' }), 'PO box 77, Surat')
    assert.equal(addressLine({ street: ' ', city: null }), null)
  })

  it('shows a birthday as day and month only, and nothing for a date it cannot read', () => {
    assert.equal(birthdayText('1980-03-14'), '14 Mar')
    assert.equal(birthdayText('1980-13-14'), null)
    assert.equal(birthdayText('not a date'), null)
    assert.equal(birthdayText(null), null)
  })

  it('has the roles the seed command writes, for a server whose picklist is not seeded yet', () => {
    assert.deepEqual([...ROLE_FALLBACK], ['Decision maker', 'Influencer', 'Billing', 'Technical', 'User', 'Other'])
  })
})

describe('the Deals rows', () => {
  it('are called by name, subject or number, with the number under a name, and the amount with its currency', () => {
    assert.equal(dealLabel({ id: 1, name: 'ERP rollout 2026', number: 'OPP-1' }), 'ERP rollout 2026')
    assert.equal(dealLabel({ id: 2, number: 'QT-0042' }), 'QT-0042')
    assert.equal(dealLabel({ id: 3 }), '#3')
    assert.equal(dealSubline({ id: 1, name: 'ERP rollout 2026', number: 'OPP-1', status: 'Proposal', date: '2026-11-01' }), 'OPP-1 · Proposal · 2026-11-01')
    assert.equal(dealSubline({ id: 2, number: 'QT-0042', status: 'Sent' }), 'Sent', 'the number is the label already')
    assert.equal(dealAmount({ id: 1, amount: 1250000, currency: 'INR' }), `INR ${(1250000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
    assert.equal(dealAmount({ id: 1, total: '99.5' }), (99.5).toLocaleString(undefined, { maximumFractionDigits: 2 }))
    assert.equal(dealAmount({ id: 1 }), null, 'a ticket has no amount')
  })
})

describe('whose row it is', () => {
  it('is the person\'s name, "Company" for a row of the company, and nothing when the list was not asked for people', () => {
    assert.equal(whoLabel({ personName: 'Meera Patel' }), 'Meera Patel')
    assert.equal(whoLabel({ personName: null }), 'Company')
    assert.equal(whoLabel({}), null)
  })
})

describe('the rail and the form', () => {
  it('lists the primary first, then by last name', () => {
    assert.deepEqual(railOrder([rakesh(), nidhi(), meera()]).map((p) => p.lastName), ['Patel', 'Joshi', 'Shah'])
  })

  it('reports what a row can show without reading consent: the two flags', () => {
    assert.deepEqual(restriction(nidhi()), { tone: 'do-not-call', label: 'Do not call' })
    assert.deepEqual(restriction(person({ emailOptOut: true })), { tone: 'email-opt-out', label: 'Email opt-out' })
    assert.deepEqual(restriction(person()), { tone: null, label: null })
  })

  it('sends null, not an empty string, for the values the server checks against a list or a format', () => {
    const body = personPayload({ ...person(), lastName: ' Patel ', contactRole: '', reportsToId: '', birthday: '', linkedinUrl: ' ', organizationId: '' })
    assert.equal(body.lastName, 'Patel')
    assert.equal(body.contactRole, null)
    assert.equal(body.reportsToId, null)
    assert.equal(body.birthday, null)
    assert.equal(body.linkedinUrl, null)
    assert.equal(body.organizationId, null)
    assert.equal(personPayload({ ...person(), contactRole: 'Billing', birthday: '1980-03-14' }).birthday, '1980-03-14')
  })
})
