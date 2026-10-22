/**
 * Sales & Marketing gap-closure, Wave 3: the anonymous-visitor side of
 * public web-to-lead capture. Deliberately NOT built on `crmService`'s
 * `baseParams(context)` pattern - there is no LaravelContext here, no
 * signed-in session, no sub_institute_id to send (the tenant is resolved
 * server-side from the `publicKey` in the URL, never from anything this
 * page sends). Uses the shared `apiClient` singleton directly: its
 * `authHeader()` simply attaches nothing when there is no stored session,
 * which is exactly the (lack of) auth this page is supposed to have.
 */

import { apiClient } from '@/services/core/api-client'
import type { PublicLeadCaptureSubmission } from '@/types/crm'

export const publicLeadCaptureService = {
  checkForm: (publicKey: string) =>
    apiClient.get<{ status: number; message: string; data: { available: boolean } }>(`/public/lead-capture/${publicKey}`),

  submit: (publicKey: string, payload: PublicLeadCaptureSubmission) =>
    apiClient.post<{ status: number; message: string }>(`/public/lead-capture/${publicKey}`, payload),
}
