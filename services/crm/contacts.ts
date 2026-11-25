/**
 * The people of a company (S18, 25 Nov 2026): every contacts call the Person panel, the People tab, the Add and Edit person dialog and the company-wide tabs
 * make. `crmService` keeps the same older calls for the screens that have not moved (bulk, merge, import); these add what the merge needs on top: Primary,
 * the deals of a person, and the `include=people` option of the company's own lists.
 *
 * A person belongs to at most one company (`organizationId`); the "Primary" person of a company is set and cleared through its own call, never through the
 * update. One explicit function per endpoint, the same style as services/crm/index.ts.
 */

import { apiClient, buildApiUrl } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import type {
  CompanyActivityScope,
  Contact,
  ContactDealsResponse,
  ContactListQuery,
  ContactListResponse,
  ContactPayload,
  ContactResponse,
  CrmAddCommentResponse,
  CrmAuditEntryResponse,
  CrmCommentsResponse,
  CrmDuplicateGroupsResponse,
  CrmEmailLinkEntriesResponse,
  CrmImportResponse,
  CrmLinkedDocumentResponse,
  CrmLinkedDocumentsResponse,
  CrmQuoteListResponse,
  PersonTag,
} from '@/types/crm'
import type { CalendarEvent } from '@/types/task-management'

function baseParams(context: LaravelContext): Record<string, string> {
  return { token: context.token, sub_institute_id: context.subInstituteId }
}

/**
 * The answer names the postal code `mailingCode` (and `otherCode`); the S18 contract says `mailingPostalCode`. A screen reads `mailingCode` only, so whichever
 * name the server used, the other is filled in from it.
 */
export function withContactExtras(contact: Contact): Contact {
  return {
    ...contact,
    mailingCode: contact.mailingCode ?? contact.mailingPostalCode ?? null,
    otherCode: contact.otherCode ?? contact.otherPostalCode ?? null,
  }
}

/** What a write sends: the postal code under both of its names, so the server that reads either one stores it. */
export function contactWriteBody(payload: ContactPayload): ContactPayload {
  const body: ContactPayload = { ...payload }
  if ('mailingCode' in body) body.mailingPostalCode = body.mailingCode
  if ('otherCode' in body) body.otherPostalCode = body.otherCode
  return body
}

/** The `include` the company's lists are asked for: the default is everyone (the company's own rows and its people's), `company` is the company's own only. */
export const includeParam = (scope: CompanyActivityScope): Record<string, string> => ({ include: scope })

type CalendarEntry = CalendarEvent & PersonTag
export interface CompanyScheduleResponse {
  status: number
  message: string
  data: { entries: CalendarEntry[] }
}

export const contactsService = {
  list: (context: LaravelContext, query: ContactListQuery = {}) =>
    apiClient.get<ContactListResponse>('/crm/contacts', {
      ...baseParams(context),
      ...(query.page ? { page: String(query.page) } : {}),
      ...(query.perPage ? { per_page: String(query.perPage) } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sortBy ? { sort_by: query.sortBy } : {}),
      ...(query.sortDir ? { sort_dir: query.sortDir } : {}),
      ...(query.organizationId ? { organization_id: query.organizationId } : {}),
      ...(query.primary ? { primary: '1' } : {}),
      ...(query.owner ? { owner: query.owner } : {}),
      ...(query.consent ? { consent: query.consent } : {}),
      ...(query.doNotCall ? { do_not_call: '1' } : {}),
      ...(query.noCompany ? { no_company: '1' } : {}),
    }).then((response) => ({ ...response, data: { ...response.data, items: response.data.items.map(withContactExtras) } })),

  get: (context: LaravelContext, id: string) =>
    apiClient.get<ContactResponse>(`/crm/contacts/${id}`, baseParams(context)).then((response) => ({ ...response, data: withContactExtras(response.data) })),

  create: (context: LaravelContext, payload: ContactPayload) =>
    apiClient.post<ContactResponse>('/crm/contacts', { ...contactWriteBody(payload), ...baseParams(context) }),

  update: (context: LaravelContext, id: string, payload: ContactPayload) =>
    apiClient.put<ContactResponse>(`/crm/contacts/${id}`, { ...contactWriteBody(payload), ...baseParams(context) }),

  delete: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: number; message: string }>(`/crm/contacts/${id}`, baseParams(context)),

  /** Makes the person the primary of their company; the server clears the flag on the company's other people in one transaction. */
  setPrimary: (context: LaravelContext, id: string) =>
    apiClient.post<ContactResponse>(`/crm/contacts/${id}/primary`, baseParams(context)),

  clearPrimary: (context: LaravelContext, id: string) =>
    apiClient.delete<ContactResponse>(`/crm/contacts/${id}/primary`, baseParams(context)),

  deals: (context: LaravelContext, id: string) =>
    apiClient.get<ContactDealsResponse>(`/crm/contacts/${id}/deals`, baseParams(context)),

  transferOwnership: (context: LaravelContext, id: string, assignedTo: string) =>
    apiClient.post<{ status: number; message: string }>(`/crm/contacts/${id}/transfer-ownership`, { assignedTo, ...baseParams(context) }),

  comments: (context: LaravelContext, id: string) =>
    apiClient.get<CrmCommentsResponse>(`/crm/contacts/${id}/comments`, baseParams(context)),
  addComment: (context: LaravelContext, id: string, comment: string) =>
    apiClient.post<CrmAddCommentResponse>(`/crm/contacts/${id}/comments`, { comment, ...baseParams(context) }),

  documents: (context: LaravelContext, id: string) =>
    apiClient.get<CrmLinkedDocumentsResponse>(`/crm/contacts/${id}/documents`, baseParams(context)),
  attachDocument: (context: LaravelContext, id: string, file: File) => {
    const body = new FormData()
    body.append('token', context.token)
    body.append('sub_institute_id', String(context.subInstituteId))
    body.append('document', file)
    return apiClient.postForm<CrmLinkedDocumentResponse>(`/crm/contacts/${id}/documents`, body)
  },

  emails: (context: LaravelContext, id: string) =>
    apiClient.get<CrmEmailLinkEntriesResponse>(`/crm/contacts/${id}/emails`, baseParams(context)),

  history: (context: LaravelContext, id: string) =>
    apiClient.get<CrmAuditEntryResponse>(`/crm/contacts/${id}/history`, baseParams(context)),

  /** The person's own slice of the calendar (the same endpoint the Schedule tab of every CRM record reads). */
  schedule: (context: LaravelContext, id: string) =>
    apiClient.get<CompanyScheduleResponse>(`/task-management/calendar/events/linked/CONTACT/${id}`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),

  /** The export of the people of one company (`organizationId`) or, without it, of everyone. */
  exportUrl: (context: LaravelContext, options: { search?: string; organizationId?: string } = {}) =>
    buildApiUrl('/crm/contacts/export', {
      ...baseParams(context),
      ...(options.search ? { search: options.search } : {}),
      ...(options.organizationId ? { organization_id: options.organizationId } : {}),
    }),

  /** Imports rows; with `organizationId` every row is put on that company, whatever its own `organizationId` says. */
  importRows: (context: LaravelContext, rows: Record<string, unknown>[], organizationId?: string) =>
    apiClient.post<CrmImportResponse>('/crm/contacts/import', {
      rows: organizationId ? rows.map((row) => ({ ...row, organizationId })) : rows,
      ...baseParams(context),
    }),

  /** The possible duplicates; with `organizationId` only the groups whose people are all in that company. */
  duplicates: async (context: LaravelContext, organizationId?: string): Promise<CrmDuplicateGroupsResponse> => {
    const response = await apiClient.get<CrmDuplicateGroupsResponse>('/crm/contacts/duplicates', baseParams(context))
    if (!organizationId) return response
    return { ...response, data: response.data.filter((group) => group.rows.length > 0 && group.rows.every((row) => String(row.organizationId ?? '') === String(organizationId))) }
  },
}

/**
 * The company's own lists, with the people's rows alongside (S18). `scope` is what the Company only | Everyone switch holds: `people` (the default) sends
 * `include=people`, `company` sends `include=company`. Every row of the answer may carry `personId` and `personName` (null for a row of the company itself).
 */
export const companyActivityService = {
  comments: (context: LaravelContext, organizationId: string, scope: CompanyActivityScope) =>
    apiClient.get<CrmCommentsResponse>(`/crm/organizations/${organizationId}/comments`, { ...baseParams(context), ...includeParam(scope) }),
  documents: (context: LaravelContext, organizationId: string, scope: CompanyActivityScope) =>
    apiClient.get<CrmLinkedDocumentsResponse>(`/crm/organizations/${organizationId}/documents`, { ...baseParams(context), ...includeParam(scope) }),
  emails: (context: LaravelContext, organizationId: string, scope: CompanyActivityScope) =>
    apiClient.get<CrmEmailLinkEntriesResponse>(`/crm/organizations/${organizationId}/emails`, { ...baseParams(context), ...includeParam(scope) }),
  history: (context: LaravelContext, organizationId: string, scope: CompanyActivityScope) =>
    apiClient.get<CrmAuditEntryResponse>(`/crm/organizations/${organizationId}/history`, { ...baseParams(context), ...includeParam(scope) }),
  schedule: (context: LaravelContext, organizationId: string, scope: CompanyActivityScope) =>
    apiClient.get<CompanyScheduleResponse>(`/task-management/calendar/events/linked/ORGANIZATION/${organizationId}`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear, ...includeParam(scope),
    }),
  quotes: (context: LaravelContext, organizationId: string, scope: CompanyActivityScope, perPage = 50) =>
    apiClient.get<CrmQuoteListResponse>('/crm/quotes', {
      ...baseParams(context), organization_id: organizationId, per_page: String(perPage), ...includeParam(scope),
    }),
}
