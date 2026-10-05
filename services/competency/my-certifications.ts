import { apiClient } from '@/services/core'
import { withLaravelParams, getLaravelContext } from '@/lib/laravel-context'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * THE EMPLOYEE'S OWN CERTIFICATIONS — read-only.
 *
 * ── WHY THIS IS NOT certifications.ts ───────────────────────────────────────
 *
 * `certificationsService` is the HR surface. Its list takes `user_id_filter`,
 * and every write takes an `id` or a `user_id_target`, because HR acting on
 * somebody else must name them. The backend behind it enforces the tenant and
 * nothing else, so a request that names a colleague is answered.
 *
 * This file calls ONE endpoint and sends NO SUBJECT. The server resolves the
 * caller from the token, so there is no id here that could ask about anybody
 * else's record. Same structural guarantee as `/competency/my-capability`.
 *
 * ── WHY THERE IS NO DOCUMENTS CALL ──────────────────────────────────────────
 *
 * Downloads come from `documents[]` inside each row of the list response.
 * `GET /competency/certifications/{id}/documents` exists and would have been
 * the obvious reuse, but it is tenant-scoped only — it checks the certification
 * belongs to the caller's institute, not to the caller. Calling it from an
 * employee screen would hand every employee a read of any colleague's evidence
 * one id at a time.
 *
 * So there is deliberately no function here that takes a certification id.
 */

/** compliant | expiring | non_compliant — computed server-side, never here. */
export type MyComplianceKey = 'compliant' | 'expiring' | 'non_compliant'

export interface MyCertificationDocument {
  id: number
  title: string | null
  evidence_type: string | null
  file_name: string | null
  /**
   * The download target: an uploaded file when there is one, otherwise the
   * external link the record carries. Null means the row points nowhere and
   * the control must be disabled rather than linking to "null".
   */
  url: string | null
  is_file: boolean
  uploaded_on: string | null
}

export interface MyCertificationItem {
  id: number
  name: string | null
  issuing_body: string | null
  certification_type: string | null
  credential_id: string | null
  competency_id: number | null
  status: string | null
  status_label: string | null
  compliance: string
  compliance_key: MyComplianceKey
  /** Why it is in that state, in words, e.g. "Expires within 60 days". */
  compliance_reason: string
  /** pending | verified | rejected — visible, but not changeable from here. */
  verification_status: string | null
  issued_date: string | null
  expiry_date: string | null
  issued_date_label: string | null
  expiry_date_label: string | null
  /**
   * Whole days until expiry; negative once past.
   *
   * null and 0 are different and must not be conflated: null is "does not
   * expire", 0 is "expires today".
   */
  days_to_expiry: number | null
  notes: string | null
  documents: MyCertificationDocument[]
}

export interface MyCertificationsSummary {
  total: number
  compliant: number
  expiring: number
  non_compliant: number
}

export interface MyCertificationsResponse {
  status: number
  message: string
  data: MyCertificationItem[]
  /** Counted off the returned rows server-side, so it cannot disagree with them. */
  summary: MyCertificationsSummary
  meta: {
    total: number
    /** True when the 200-row backstop clipped the list. */
    truncated: boolean
  }
}

export const myCertificationsService = {
  /**
   * GET /competency/my-certifications — my credentials, my documents.
   *
   * No user_id is sent and none may be added. The server ignores one if it
   * arrives, so a stale value in localStorage cannot lock a legitimate
   * employee out of their own page.
   */
  list: (context?: LaravelContext) =>
    apiClient.get<MyCertificationsResponse>(
      '/competency/my-certifications',
      withLaravelParams(context ?? getLaravelContext()),
    ),
}
