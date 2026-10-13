'use client'

/**
 * Client for the chat's reports and templates - `/api/ai/chat/*`.
 *
 * The backend picks, from what the module really has, which report answers a message and
 * builds it from the organisation's own rows; nothing is generated here or by a model.
 * Tenant and role come from the token, never from this file.
 */

import { aiRequest } from './client'

/** A report type the module can really build: a published report template and/or a data source. */
export interface ReportSuggestion {
  label: string
  /** A message that, sent to the chat, builds this report. */
  prompt: string
  data_source: string
  template_id: number | null
  template_name: string | null
  module_key: string
  description: string
}

/** A report the backend built and saved. */
export interface ChatReport {
  id: number
  title: string
  module_key: string
  template_id: number | null
  data_source: string
  row_count: number
  /** The saved report page, e.g. `/ai/reports/12`. */
  url_path: string
  generated_at: string
  /** True when the backend can send the report for this caller (administrator, mail enabled for the organisation). */
  can_send: boolean
}

export interface ChatReportResult {
  /** Null when nothing matched or the match had no records; `reason` says why. */
  report: ChatReport | null
  reason: string | null
  matched: string | null
}

export interface TemplateSuggestion {
  id: number
  name: string
  kind: 'prompt' | 'report' | string
  status: string
  module_key: string | null
  module_label: string | null
  data_source: string | null
  description: string | null
  is_platform: boolean
  /** The module screen with its Templates tab selected, or null when the module has no screen. */
  screen_path: string | null
}

export interface TemplatePreview {
  template_id: number
  name: string
  kind: string
  status: string
  module_key: string | null
  /** Report layouts: the layout filled with real rows (not saved). Null when there are none. */
  html: string | null
  row_count: number | null
  data_source?: string
  rendered?: unknown
  note: string | null
}

export async function fetchReportSuggestions(moduleKey: string, message?: string): Promise<ReportSuggestion[]> {
  const query = new URLSearchParams({ module_key: moduleKey })
  if (message?.trim()) query.set('message', message.trim())

  const data = await aiRequest<{ suggestions: ReportSuggestion[] }>(`/chat/report-suggestions?${query}`)

  return data.suggestions
}

export function generateChatReport(moduleKey: string, message: string): Promise<ChatReportResult> {
  return aiRequest<ChatReportResult>('/chat/report', 'POST', { module_key: moduleKey, message })
}

// ---------------------------------------------------------------------------------------------
// Sending a saved report to real people of the organisation (e-mail, through the backend's own
// mail gate). Recipients are chosen from the backend's tenant-scoped list; nothing is typed in.
// ---------------------------------------------------------------------------------------------

export interface ReportRecipient {
  id: number
  name: string
  email: string
  role: string | null
  department: string | null
}

export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'duplicate'

export interface SendResultRow {
  recipient_user_id: number
  name: string
  email: string
  status: DeliveryStatus
  error: string | null
}

export interface SendReportResult {
  report_id: number
  title: string
  sent: number
  failed: number
  duplicate: number
  results: SendResultRow[]
}

export interface ReportDelivery {
  id: number
  recipient_user_id: number | null
  recipient_name: string | null
  recipient_email: string
  status: DeliveryStatus
  error: string | null
  sent_by: number | null
  sent_at: string | null
  created_at: string
}

/** A saved report of the caller's organisation, as listed for a module. */
export interface SavedReportSummary {
  id: number
  title: string
  module_key: string
  row_count: number
  created_at: string
  url_path: string
}

export async function searchReportRecipients(q: string): Promise<{ recipients: ReportRecipient[]; max_recipients: number }> {
  const query = new URLSearchParams()
  if (q.trim()) query.set('q', q.trim())

  return aiRequest(`/chat/report-recipients?${query}`)
}

/** `requestKey` makes a double submit harmless: the backend will not send twice for the same key. */
export function sendChatReport(
  reportId: number,
  recipientIds: number[],
  options: { note?: string; requestKey?: string } = {},
): Promise<SendReportResult> {
  return aiRequest<SendReportResult>(`/chat/reports/${reportId}/send`, 'POST', {
    recipient_ids: recipientIds,
    note: options.note?.trim() || undefined,
    request_key: options.requestKey,
  })
}

export function fetchReportDeliveries(reportId: number): Promise<{ can_send: boolean; deliveries: ReportDelivery[] }> {
  return aiRequest(`/chat/reports/${reportId}/deliveries`)
}

export async function fetchRecentReports(moduleKey: string): Promise<SavedReportSummary[]> {
  const query = new URLSearchParams({ module_key: moduleKey })
  const data = await aiRequest<{ reports: SavedReportSummary[] }>(`/chat/reports?${query}`)

  return data.reports
}

export async function fetchTemplateSuggestions(moduleKey: string): Promise<TemplateSuggestion[]> {
  const query = new URLSearchParams({ module_key: moduleKey })
  const data = await aiRequest<{ templates: TemplateSuggestion[] }>(`/chat/template-suggestions?${query}`)

  return data.templates
}

export async function previewChatTemplate(templateId: number): Promise<TemplatePreview> {
  const data = await aiRequest<{ preview: TemplatePreview }>(`/chat/templates/${templateId}/preview`)

  return data.preview
}
