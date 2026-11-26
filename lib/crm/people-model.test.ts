import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import {
  applyViewConditions, companyDeleteNote, companyDeleteQuestion, companyState, createdText, fullName, INITIAL_PEOPLE_STATE, matchedPersonName, PEOPLE_FILTERS, peopleBulkMessage,
  peopleQuery, phoneOf, titleAndRole, viewConditions, type PeopleListState,
} from './people'

/** The rules of the All people scope and the Companies columns (S18, 25 Nov 2026), without a browser. */

const state = (over: Partial<PeopleListState> = {}): PeopleListState => ({ ...INITIAL_PEOPLE_STATE, ...over })

describe('what a chip asks the server for', () => {
  it('has the five chips of the mock-up, in order', () => {
    assert.deepEqual(PEOPLE_FILTERS.map((f) => f.label), ['All', 'Primary', 'Mine', 'Do not call', 'No company'])
  })

  it('sends only the paging and the sort for All', () => {
    assert.deepEqual(peopleQuery(state(), '2'), { page: 1, perPage: 20, sortBy: 'last_name', sortDir: 'asc' })
  })

  it('sends exactly one filter for each of the other chips', () => {
    assert.deepEqual(peopleQuery(state({ filter: 'primary' }), '2'), { page: 1, perPage: 20, sortBy: 'last_name', sortDir: 'asc', primary: true })
    assert.deepEqual(peopleQuery(state({ filter: 'mine' }), '2'), { page: 1, perPage: 20, sortBy: 'last_name', sortDir: 'asc', owner: '2' })
    assert.deepEqual(peopleQuery(state({ filter: 'do-not-call' }), '2'), { page: 1, perPage: 20, sortBy: 'last_name', sortDir: 'asc', doNotCall: true })
    assert.deepEqual(peopleQuery(state({ filter: 'no-company' }), '2'), { page: 1, perPage: 20, sortBy: 'last_name', sortDir: 'asc', noCompany: true })
  })

  it('sends nothing for Mine when there is no user id, rather than something that reads as everyone\'s', () => {
    assert.equal('owner' in peopleQuery(state({ filter: 'mine' }), ''), false)
  })

  it('sends a trimmed search, the sort in either direction and the page asked for', () => {
    assert.deepEqual(peopleQuery(state({ search: '  meera ', sortKey: 'created_at', sortAsc: false, page: 3 }), '2'), { page: 3, perPage: 20, sortBy: 'created_at', sortDir: 'desc', search: 'meera' })
    assert.equal('search' in peopleQuery(state({ search: '   ' }), '2'), false)
  })
})

describe('saved views', () => {
  it('stores the search, the sort and the chip, and reads them back', () => {
    const saved = viewConditions(state({ search: 'a', sortKey: 'email', sortAsc: false, filter: 'primary', page: 4 }))
    assert.deepEqual(saved, { search: 'a', sortKey: 'email', sortAsc: false, filter: 'primary' })
    assert.deepEqual(applyViewConditions(saved, state({ page: 4 })), { page: 1, search: 'a', sortKey: 'email', sortAsc: false, filter: 'primary' })
  })

  it('reads a view saved before the chips existed (no filter) as All, and ignores a sort or chip it does not know', () => {
    assert.equal(applyViewConditions({ search: 'x', sortKey: 'title', sortAsc: true }, state({ filter: 'mine' })).filter, 'all')
    const odd = applyViewConditions({ sortKey: 'password', filter: 'everything', search: 7, sortAsc: 'yes' }, state())
    assert.deepEqual(odd, state())
  })
})

describe('the words of a row', () => {
  it('writes the name, the title and role, and the phone', () => {
    assert.equal(fullName({ firstName: 'Meera', lastName: 'Patel' }), 'Meera Patel')
    assert.equal(fullName({ firstName: null, lastName: 'Patel' }), 'Patel')
    assert.equal(fullName({ firstName: ' ', lastName: ' ' }), 'Unnamed')
    assert.equal(titleAndRole({ title: 'Principal', contactRole: 'Decision maker' }), 'Principal · Decision maker')
    assert.equal(titleAndRole({ title: null, contactRole: 'Billing' }), 'Billing')
    assert.equal(titleAndRole({ title: 'Trustee' }), 'Trustee')
    assert.equal(titleAndRole({ title: '', contactRole: null }), '—')
    assert.equal(phoneOf({ phone: '079 4000 1200', mobile: '98250 11122' }), '079 4000 1200')
    assert.equal(phoneOf({ phone: null, mobile: '98250 11122' }), '98250 11122')
    assert.equal(phoneOf({ phone: null, mobile: null }), '—')
  })

  it('says where a company stands: none, in the Recycle Bin, or live (an older server never says Recycle Bin)', () => {
    assert.equal(companyState({ organizationId: null }), 'none')
    assert.equal(companyState({ organizationId: '' }), 'none')
    assert.equal(companyState({ organizationId: '9', organizationDeleted: true }), 'recycle-bin')
    assert.equal(companyState({ organizationId: '9', organizationDeleted: false }), 'live')
    assert.equal(companyState({ organizationId: '9' }), 'live')
  })

  it('writes the created date as it was stored, not shifted, and a dash for one it cannot read', () => {
    assert.equal(createdText('2026-10-12 23:59:59'), '12 Oct 2026')
    assert.equal(createdText('2026-01-05'), '5 Jan 2026')
    for (const bad of [null, undefined, '', 'yesterday', '2026-13-01', '2026-00-10', '2026-05-00']) assert.equal(createdText(bad), '—', String(bad))
  })

  it('says a bulk result with people, not "persons"', () => {
    const data = (succeeded: number, failed: number, reasons: string[] = []) => ({ summary: { succeeded, failed }, results: reasons.map((reason) => ({ id: 1, ok: false, reason })) }) as never
    assert.equal(peopleBulkMessage('Deleted', data(1, 0)), 'Deleted 1 person.')
    assert.equal(peopleBulkMessage('Deleted', data(3, 0)), 'Deleted 3 people.')
    assert.equal(peopleBulkMessage('Reassigned', data(2, 1, ['No right.'])), 'Reassigned 2 of 3 people. 1 failed: No right.')
    assert.equal(peopleBulkMessage('Deleted', data(0, 1, ['Gone.'])), 'Deleted 0 of 1 person. 1 failed: Gone.')
  })
})

describe('the Companies columns', () => {
  it('reads the person a search matched, and nothing for a missing or blank one', () => {
    assert.equal(matchedPersonName({ matchedPerson: { id: 4, name: 'Meera Patel' } }), 'Meera Patel')
    assert.equal(matchedPersonName({ matchedPerson: { name: '  ' } }), null)
    assert.equal(matchedPersonName({ matchedPerson: null }), null)
    assert.equal(matchedPersonName({}), null)
  })

  it('says how many people a company delete moves and what happens to them', () => {
    const note = companyDeleteNote([{ name: 'Greenfield Public School', peopleCount: 6 }])!
    assert.ok(note.startsWith('Greenfield Public School has 6 people.'), note)
    assert.ok(note.includes('They stay in All people, marked "Company in Recycle Bin"'), note)
    assert.ok(note.includes('linked back if the company is restored'), note)
    assert.ok(note.includes('Nothing about a person is deleted.'), note)
    assert.ok(companyDeleteNote([{ name: 'A', peopleCount: 1 }])!.startsWith('A has 1 person.'))
    assert.ok(companyDeleteNote([{ name: 'A', peopleCount: 4 }, { name: 'B', peopleCount: 2 }])!.startsWith('These companies have 6 people between them.'))
  })

  it('asks the plain question when no row says how many people it has, or none has any', () => {
    assert.equal(companyDeleteNote([{ name: 'A' }, { name: 'B', peopleCount: null }]), null, 'an older server')
    assert.equal(companyDeleteNote([{ name: 'A', peopleCount: 0 }]), null)
    assert.equal(companyDeleteQuestion([{ name: 'A' }]), 'Delete 1 organization? This moves it to the Recycle Bin.')
    assert.equal(companyDeleteQuestion([{ name: 'A' }, { name: 'B' }]), 'Delete 2 organizations? This moves them to the Recycle Bin.')
  })

  it('puts the note after the question when there are people', () => {
    const question = companyDeleteQuestion([{ name: 'Greenfield', peopleCount: 6 }])
    assert.ok(question.startsWith('Delete 1 organization? This moves it to the Recycle Bin.\n\nGreenfield has 6 people.'), question)
  })
})
