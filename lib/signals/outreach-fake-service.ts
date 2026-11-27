import type { OutreachApi } from '../../services/signals/outreach'
import type { OutreachListQuery, WriteMessagesBody } from '../../services/signals/outreach-types'
import { companies, companyDetail, listOf, people, person, company } from './outreach-fixtures'

export interface OutreachFakeCalls {
  companies: OutreachListQuery[]
  company: number[]
  people: OutreachListQuery[]
  person: number[]
  addCompany: unknown[]
  updateCompany: Array<{ id: number; body: unknown }>
  deleteCompany: number[]
  addPerson: unknown[]
  updatePerson: Array<{ id: number; body: unknown }>
  deletePerson: number[]
  setConsent: Array<{ id: number; body: unknown }>
  assign: unknown[]
  findContacts: number[]
  convertToLead: Array<{ id: number; body?: { person_id?: number } }>
  writeMessages: WriteMessagesBody[]
  personMessages: number[]
}

/**
 * A stand-in for the Outreach API for component tests. Every call is recorded exactly as the screen made it, and `overrides` replace what a method answers (or throws).
 * Nothing here touches the network, and nothing can send a message: `writeMessages` only answers with drafts.
 */
export function fakeOutreachService(overrides: Partial<OutreachApi> = {}) {
  const calls: OutreachFakeCalls = {
    companies: [], company: [], people: [], person: [], addCompany: [], updateCompany: [], deleteCompany: [], addPerson: [], updatePerson: [], deletePerson: [], setConsent: [], assign: [],
    findContacts: [], convertToLead: [], writeMessages: [], personMessages: [],
  }
  const service: OutreachApi = {
    companies: async (q) => { calls.companies.push(q); return overrides.companies ? overrides.companies(q) : listOf(companies()) },
    company: async (id) => { calls.company.push(id); return overrides.company ? overrides.company(id) : { status: 1, data: companyDetail({ id }) } },
    person: async (id) => { calls.person.push(id); return overrides.person ? overrides.person(id) : { status: 1, data: people().find((p) => p.id === id) ?? person({ id }) } },
    people: async (q) => { calls.people.push(q); return overrides.people ? overrides.people(q) : listOf(people()) },
    addCompany: async (body) => { calls.addCompany.push(body); return overrides.addCompany ? overrides.addCompany(body) : { status: 1, data: company({ id: 99, name: body.name, source: 'manual', signals_count: 0, people_count: 0, reachable_people_count: 0, best_contact: null, reach: 'needs_details', latest_signal: null }) } },
    updateCompany: async (id, body) => { calls.updateCompany.push({ id, body }); return overrides.updateCompany ? overrides.updateCompany(id, body) : { status: 1, data: company({ id, ...body }) } },
    deleteCompany: async (id) => { calls.deleteCompany.push(id); return overrides.deleteCompany ? overrides.deleteCompany(id) : { status: 1 } },
    addPerson: async (body) => { calls.addPerson.push(body); return overrides.addPerson ? overrides.addPerson(body) : { status: 1, data: person({ id: 98, source: 'manual', ...body }) } },
    updatePerson: async (id, body) => { calls.updatePerson.push({ id, body }); return overrides.updatePerson ? overrides.updatePerson(id, body) : { status: 1, data: person({ id, ...body }) } },
    deletePerson: async (id) => { calls.deletePerson.push(id); return overrides.deletePerson ? overrides.deletePerson(id) : { status: 1 } },
    setConsent: async (id, body) => { calls.setConsent.push({ id, body }); return overrides.setConsent ? overrides.setConsent(id, body) : { status: 1, data: person({ id, ...body }) } },
    assign: async (body) => { calls.assign.push(body); return overrides.assign ? overrides.assign(body) : { status: 1, data: { companies: body.company_ids?.length ?? 0, people: body.person_ids?.length ?? 0 } } },
    findContacts: async (id) => { calls.findContacts.push(id); return overrides.findContacts ? overrides.findContacts(id) : { status: 1, message: 'Looking for contacts. Check back in a minute.' } },
    convertToLead: async (id, body) => { calls.convertToLead.push({ id, body }); return overrides.convertToLead ? overrides.convertToLead(id, body) : { status: 1, data: { lead_id: 4001, created: true } } },
    writeMessages: async (body) => {
      calls.writeMessages.push(body)
      if (overrides.writeMessages) return overrides.writeMessages(body)
      const results = body.person_ids.map((person_id, i) => ({ person_id, ok: true, message_id: 7000 + i, code: null, message: null }))
      return { status: 1, data: { results, drafted: results.length, refused: 0 } }
    },
    personMessages: async (id) => { calls.personMessages.push(id); return overrides.personMessages ? overrides.personMessages(id) : { status: 1, data: [] } },
  }
  return { service, calls }
}
