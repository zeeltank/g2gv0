import { apiClient } from '@/services/core'
import type {
  AssignBody, ConsentBody, ConvertToLeadResponse, FindContactsResponse, NewCompanyBody, NewPersonBody, OutreachCompany, OutreachCompanyDetail, OutreachListQuery,
  OutreachListResponse, OutreachOneResponse, OutreachPerson, PersonMessage, UpdateCompanyBody, UpdatePersonBody, WriteMessagesBody, WriteMessagesResponse,
} from './outreach-types'

/** What the Outreach tab needs from the server. Components take this shape, so a test can hand them a fake. */
export interface OutreachApi {
  companies(query: OutreachListQuery): Promise<OutreachListResponse<OutreachCompany>>
  company(id: number): Promise<OutreachOneResponse<OutreachCompanyDetail>>
  addCompany(body: NewCompanyBody): Promise<OutreachOneResponse<OutreachCompany>>
  updateCompany(id: number, body: UpdateCompanyBody): Promise<OutreachOneResponse<OutreachCompany>>
  /** Only a company added by hand can be removed here; one that signals found stays, because the signals still point at it. */
  deleteCompany(id: number): Promise<{ status: number; message?: string }>
  people(query: OutreachListQuery): Promise<OutreachListResponse<OutreachPerson>>
  /** One person by id: a link to a person opens even when they are not on the page of the list a viewer has. */
  person(id: number): Promise<OutreachOneResponse<OutreachPerson>>
  addPerson(body: NewPersonBody): Promise<OutreachOneResponse<OutreachPerson>>
  updatePerson(id: number, body: UpdatePersonBody): Promise<OutreachOneResponse<OutreachPerson>>
  deletePerson(id: number): Promise<{ status: number; message?: string }>
  setConsent(id: number, body: ConsentBody): Promise<OutreachOneResponse<OutreachPerson>>
  assign(body: AssignBody): Promise<{ status: number; data: { companies: number; people: number } }>
  /** Queues the public contact search for the company's latest signal. Information only. */
  findContacts(companyId: number): Promise<FindContactsResponse>
  /** One lead per person (or per company with no people). Idempotent: pressing it again returns the same lead with `created: false`. */
  convertToLead(companyId: number, body?: { person_id?: number }): Promise<ConvertToLeadResponse>
  /** One DRAFT per person. Nothing is submitted, approved or sent. */
  writeMessages(body: WriteMessagesBody): Promise<WriteMessagesResponse>
  personMessages(personId: number): Promise<{ status: number; data: PersonMessage[] }>
}

const BASE = '/signals/outreach'

/** Query values as strings; a missing value is left out entirely so the server applies no filter, and `all` is never sent. */
export function outreachQueryParams(query: OutreachListQuery): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    if ((key === 'reach' || key === 'source') && value === 'all') continue
    params[key] = value === true ? '1' : String(value)
  }
  return params
}

const id = (value: number) => encodeURIComponent(String(value))

/** The Outreach API (hp_erp `/api/signals/outreach/...`). The organisation and the user come from the bearer token the shared client sends, never from a parameter. */
export const outreachService: OutreachApi = {
  companies: (query) => apiClient.get(`${BASE}/companies`, outreachQueryParams(query)),
  company: (companyId) => apiClient.get(`${BASE}/companies/${id(companyId)}`),
  addCompany: (body) => apiClient.post(`${BASE}/companies`, body),
  updateCompany: (companyId, body) => apiClient.patch(`${BASE}/companies/${id(companyId)}`, body),
  deleteCompany: (companyId) => apiClient.delete(`${BASE}/companies/${id(companyId)}`),
  people: (query) => apiClient.get(`${BASE}/people`, outreachQueryParams(query)),
  person: (personId) => apiClient.get(`${BASE}/people/${id(personId)}`),
  addPerson: (body) => apiClient.post(`${BASE}/people`, body),
  updatePerson: (personId, body) => apiClient.patch(`${BASE}/people/${id(personId)}`, body),
  deletePerson: (personId) => apiClient.delete(`${BASE}/people/${id(personId)}`),
  setConsent: (personId, body) => apiClient.post(`${BASE}/people/${id(personId)}/consent`, body),
  assign: (body) => apiClient.post(`${BASE}/assign`, body),
  findContacts: (companyId) => apiClient.post(`${BASE}/companies/${id(companyId)}/find-contacts`, {}),
  convertToLead: (companyId, body) => apiClient.post(`${BASE}/companies/${id(companyId)}/convert-to-lead`, body ?? {}),
  writeMessages: (body) => apiClient.post(`${BASE}/message-drafts`, body),
  personMessages: (personId) => apiClient.get(`${BASE}/people/${id(personId)}/messages`),
}
