/**
 * Certification & Compliance Center service.
 *
 * Backed by the Laravel competency certification API:
 *   GET    /competency/certifications                        - list (+ filters/sort/pagination)
 *   GET    /competency/certifications/metrics                - the five KPI cards
 *   GET    /competency/certifications/filters                - filter select options
 *   GET    /competency/certifications/export                 - every filtered row, uncapped
 *   POST   /competency/certifications/bulk                   - bulk verify/reject/status/revoke/delete
 *   POST   /competency/certifications                        - create
 *   GET    /competency/certifications/{id}                   - Overview tab
 *   PUT    /competency/certifications/{id}                   - edit / update status / verify / revoke
 *   DELETE /competency/certifications/{id}                   - soft delete
 *   POST   /competency/certifications/{id}/notes             - append a note
 *   GET    /competency/certifications/{id}/compliance        - Compliance tab
 *   GET    /competency/certifications/{id}/requirements      - Requirements tab
 *   GET    /competency/certifications/{id}/history           - History tab
 *   GET|POST /competency/certifications/{id}/documents       - Documents tab
 *   DELETE /competency/certifications/{id}/documents/{docId}
 *   GET|POST|PUT|DELETE /competency/certification-requirements[/{id}]
 *
 * Every call carries the standard Laravel context (token, sub_institute_id,
 * user_id, syear, type=API) via withLaravelParams, exactly like
 * services/competency/library.ts.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface CertificationApiResponse<T> {
  status: number
  message: string
  data: T
}

export interface CertificationPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface CertificationListResponse<T> extends CertificationApiResponse<T> {
  pagination: CertificationPagination
}

/** valid | expiring | expired | revoked */
export type CertificationStatus = 'valid' | 'expiring' | 'expired' | 'revoked'
/** pending | verified | rejected */
export type VerificationStatus = 'pending' | 'verified' | 'rejected'
/** compliant | expiring | non_compliant */
export type ComplianceKey = 'compliant' | 'expiring' | 'non_compliant'

/** A certification row as returned by list / export / show. */
export interface CertificationItem {
  id: number
  name: string
  user_id: number | null
  employee_name: string | null
  employee_initials: string | null
  employee_no: string | null
  department_id: number | null
  department: string | null
  jobrole: string | null
  issuing_body: string | null
  certification_type: string | null
  credential_id: string | null
  competency_id: number | null
  requirement_id: number | null
  status: CertificationStatus | string
  status_label: string
  compliance: string
  compliance_key: ComplianceKey
  compliance_reason: string
  verification_status: VerificationStatus | null
  issued_date: string | null
  expiry_date: string | null
  issued_date_label: string | null
  expiry_date_label: string | null
  days_to_expiry: number | null
  notes: string | null
  created_at: string | null
}

export interface CertificationEmployee {
  id: number
  name: string
  initials: string
  employee_no: string | null
  email: string | null
  jobrole: string | null
  department: string | null
}

/** show() returns the list row plus the panel-only joins. */
export interface CertificationDetail extends CertificationItem {
  employee: CertificationEmployee | null
  requirement: { id: number; name: string } | null
  competency: string | null
}

export interface CertificationMetrics {
  total: number
  compliant_employees: number
  employees_evaluated: number
  compliant_percent: number
  expiring_soon: number
  expiring_window_days: number
  expired: number
  pending_verification: number
  revoked: number
  verified: number
  requirements: number
}

export interface CertificationFilterOption {
  value: string
  label: string
}

export interface CertificationFilterOptions {
  departments: CertificationFilterOption[]
  certification_types: CertificationFilterOption[]
  issuing_bodies: CertificationFilterOption[]
  jobroles: CertificationFilterOption[]
  statuses: CertificationFilterOption[]
  compliance: CertificationFilterOption[]
  expiry_windows: CertificationFilterOption[]
  verification: CertificationFilterOption[]
}

export interface CertificationRequirement {
  id: number
  name: string
  certification_type: string | null
  issuing_body: string | null
  description: string | null
  department_id: number | null
  department?: string | null
  jobrole: string | null
  competency_id: number | null
  is_mandatory: boolean
  validity_months: number | null
  renewal_reminder_days: number | null
  grace_period_days: number | null
  status: string
  scope: string
  holders?: number
  created_at?: string | null
}

/** A requirement as seen from a credential's Requirements tab. */
export interface CertificationRequirementMatch extends CertificationRequirement {
  is_met: boolean
  held_certification_id: number | null
  held_status: string
  held_expiry: string | null
  is_current: boolean
}

export interface RequirementSummary {
  total: number
  met: number
  unmet: number
  mandatory: number
  met_percent: number
}

export interface CertificationCompliance {
  compliance: string
  compliance_key: ComplianceKey
  reason: string
  days_to_expiry: number | null
  validity_percent: number | null
  issued_date: string | null
  expiry_date: string | null
  verification_status: VerificationStatus | null
  verified_at: string | null
  verified_by: string | null
  requirement: CertificationRequirement | null
  is_required: boolean
  window_days: number
  holder: {
    total: number
    compliant: number
    expiring: number
    non_compliant: number
    is_compliant: boolean
    missing: string[]
  } | null
}

export interface CertificationHistoryEntry {
  id: number
  action: string
  description: string | null
  by: string
  date: string | null
  at: string | null
}

export interface CertificationAuditEntry {
  label: string
  by: string
  date: string | null
}

export interface CertificationDocument {
  id: number
  title: string
  evidence_type: string | null
  description: string | null
  link: string | null
  file_name: string | null
  file_url: string | null
  url: string | null
  status: string
  uploaded_by: string | null
  uploaded_on: string | null
}

export type CertificationSortField = 'name' | 'status' | 'issued_date' | 'expiry_date' | 'created_at'

export interface CertificationListParams {
  search?: string
  status?: string
  compliance?: string
  expiry_window?: string
  department_id?: string
  jobrole?: string
  certification_type?: string
  issuing_body?: string
  verification_status?: string
  /** the "My Certifications" tab - plain user_id is the context actor */
  user_id_filter?: string | number
  issued_from?: string
  issued_to?: string
  expiry_from?: string
  expiry_to?: string
  sort?: CertificationSortField
  direction?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

export interface CertificationPayload {
  name: string
  /**
   * The employee who holds the credential. Named _target because plain
   * `user_id` is the Laravel CONTEXT ACTOR on every /competency/* call - sending
   * the holder as `user_id` would let an update reassign the credential to
   * whoever performed it.
   */
  user_id_target?: number | null
  competency_id?: number | null
  requirement_id?: number | null
  issuing_body?: string
  certification_type?: string
  credential_id?: string
  department_id?: number | null
  jobrole?: string
  status?: string
  verification_status?: string
  issued_date?: string
  expiry_date?: string
  notes?: string
}

export interface CertificationRequirementPayload {
  name: string
  certification_type?: string
  issuing_body?: string
  description?: string
  department_id?: number | null
  jobrole?: string
  competency_id?: number | null
  is_mandatory?: boolean
  validity_months?: number | null
  renewal_reminder_days?: number | null
  grace_period_days?: number | null
  status?: string
}

export type BulkCertificationAction = 'verify' | 'reject' | 'update_status' | 'revoke' | 'delete'

const BASE = '/competency/certifications'
const REQUIREMENTS = '/competency/certification-requirements'

/** Serialise a mixed param bag into the string map apiClient.get expects, dropping blanks. */
function toStringParams(input: Record<string, string | number | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue
    const normalized = String(value).trim()
    if (normalized === '') continue
    out[key] = normalized
  }
  return out
}

export const certificationService = {
  list: (context: LaravelContext, params?: CertificationListParams) =>
    apiClient.get<CertificationListResponse<CertificationItem[]>>(
      BASE,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  /** Every row matching the current filters, for the Export button. */
  exportRows: (context: LaravelContext, params?: CertificationListParams) =>
    apiClient.get<CertificationApiResponse<CertificationItem[]>>(
      `${BASE}/export`,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  metrics: (context: LaravelContext) =>
    apiClient.get<CertificationApiResponse<CertificationMetrics>>(
      `${BASE}/metrics`,
      withLaravelParams(context),
    ),

  filterOptions: (context: LaravelContext) =>
    apiClient.get<CertificationApiResponse<CertificationFilterOptions>>(
      `${BASE}/filters`,
      withLaravelParams(context),
    ),

  get: (context: LaravelContext, id: number) =>
    apiClient.get<CertificationApiResponse<CertificationDetail>>(
      `${BASE}/${id}`,
      withLaravelParams(context),
    ),

  create: (context: LaravelContext, payload: CertificationPayload) =>
    apiClient.post<CertificationApiResponse<{ id: number }>>(BASE, {
      ...withLaravelParams(context),
      ...payload,
    }),

  update: (context: LaravelContext, id: number, payload: Partial<CertificationPayload>) =>
    apiClient.put<CertificationApiResponse<{ id: number }>>(`${BASE}/${id}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  remove: (context: LaravelContext, id: number) =>
    apiClient.delete<CertificationApiResponse<null>>(`${BASE}/${id}`, withLaravelParams(context)),

  bulk: (
    context: LaravelContext,
    action: BulkCertificationAction,
    ids: number[],
    status?: string,
  ) =>
    apiClient.post<CertificationApiResponse<{ affected: number }>>(`${BASE}/bulk`, {
      ...withLaravelParams(context),
      action,
      ids,
      ...(status ? { status } : {}),
    }),

  addNote: (context: LaravelContext, id: number, note: string) =>
    apiClient.post<CertificationApiResponse<{ notes: string }>>(`${BASE}/${id}/notes`, {
      ...withLaravelParams(context),
      note,
    }),

  compliance: (context: LaravelContext, id: number) =>
    apiClient.get<CertificationApiResponse<CertificationCompliance>>(
      `${BASE}/${id}/compliance`,
      withLaravelParams(context),
    ),

  requirementsFor: (context: LaravelContext, id: number) =>
    apiClient.get<
      CertificationApiResponse<CertificationRequirementMatch[]> & { summary: RequirementSummary }
    >(`${BASE}/${id}/requirements`, withLaravelParams(context)),

  history: (context: LaravelContext, id: number) =>
    apiClient.get<
      CertificationApiResponse<CertificationHistoryEntry[]> & { audit: CertificationAuditEntry[] }
    >(`${BASE}/${id}/history`, withLaravelParams(context)),

  documents: (context: LaravelContext, id: number) =>
    apiClient.get<CertificationApiResponse<CertificationDocument[]>>(
      `${BASE}/${id}/documents`,
      withLaravelParams(context),
    ),

  /**
   * Attach a document. Sent as multipart so the same call covers an uploaded
   * file and an external link; Laravel context travels in the query string
   * because apiClient.postForm does not merge body params.
   */
  addDocument: (
    context: LaravelContext,
    id: number,
    payload: { title: string; description?: string; link?: string; file?: File | null },
  ) => {
    const form = new FormData()
    form.append('title', payload.title)
    if (payload.description) form.append('description', payload.description)
    if (payload.link) form.append('link', payload.link)
    if (payload.file) form.append('file', payload.file)

    return apiClient.postForm<CertificationApiResponse<{ id: number }>>(
      `${BASE}/${id}/documents?${new URLSearchParams(withLaravelParams(context)).toString()}`,
      form,
    )
  },

  removeDocument: (context: LaravelContext, id: number, documentId: number) =>
    apiClient.delete<CertificationApiResponse<null>>(
      `${BASE}/${id}/documents/${documentId}`,
      withLaravelParams(context),
    ),

  /* ------------------------- requirements master ------------------------- */

  listRequirements: (
    context: LaravelContext,
    params?: { search?: string; status?: string; department_id?: string; jobrole?: string; per_page?: number },
  ) =>
    apiClient.get<CertificationListResponse<CertificationRequirement[]>>(
      REQUIREMENTS,
      withLaravelParams(context, toStringParams({ ...params })),
    ),

  createRequirement: (context: LaravelContext, payload: CertificationRequirementPayload) =>
    apiClient.post<CertificationApiResponse<{ id: number }>>(REQUIREMENTS, {
      ...withLaravelParams(context),
      ...payload,
    }),

  updateRequirement: (
    context: LaravelContext,
    id: number,
    payload: Partial<CertificationRequirementPayload>,
  ) =>
    apiClient.put<CertificationApiResponse<{ id: number }>>(`${REQUIREMENTS}/${id}`, {
      ...withLaravelParams(context),
      ...payload,
    }),

  removeRequirement: (context: LaravelContext, id: number) =>
    apiClient.delete<CertificationApiResponse<null>>(
      `${REQUIREMENTS}/${id}`,
      withLaravelParams(context),
    ),

  /** Employee picker, shared with the Development & Career workspace. */
  employeeOptions: (context: LaravelContext, search?: string) =>
    apiClient.get<
      CertificationApiResponse<
        { id: number; name: string; initials: string; employee_no: string | null; jobrole: string | null; department_id: number | null }[]
      >
    >('/competency/employee-options', withLaravelParams(context, toStringParams({ search }))),
}
