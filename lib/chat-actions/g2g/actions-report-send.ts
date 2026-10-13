/**
 * Send a saved report to real colleagues from the chat.
 *
 * Applies on any page inside a module with an AI Stack (a page from the user's own sidebar). The
 * report is chosen from the organisation's recent saved reports for THIS module, read live; the
 * recipients are ticked from the backend's tenant-scoped list of people who have an e-mail
 * address - nothing is typed in. The backend enforces everything that matters: administrator
 * only, the report and every recipient must belong to the caller's organisation, mail must be
 * enabled for it, a recipient cap, and a double submit does not mail twice.
 *
 * `verify` reads the delivery history back and confirms every chosen recipient has a `sent` row,
 * so a send the transport refused is never reported as done.
 *
 * Registry wiring (registry.ts is owned elsewhere):
 *   import { sendReportAction, defaultSendReportDeps } from './actions-report-send'
 *   ... gate(sendReportAction({ ...defaultSendReportDeps(), record })),
 */

import {
  fetchRecentReports,
  fetchReportDeliveries,
  searchReportRecipients,
  sendChatReport,
  type ReportDelivery,
  type ReportRecipient,
  type SavedReportSummary,
  type SendReportResult,
} from '@/lib/intelligence/ai-chat-artifacts'

import { splitMulti, type ActionOption, type ActionResult, type ChatActionDefinition } from '../types'
import type { G2gActionApp } from './actions'
import { failureMessage, writeLedger, type RecordActivity } from './shared'

export interface SendReportDeps {
  listReports: (moduleKey: string) => Promise<SavedReportSummary[]>
  listRecipients: (q: string) => Promise<ReportRecipient[]>
  sendReport: (reportId: number, recipientIds: number[], options: { note?: string; requestKey?: string }) => Promise<SendReportResult>
  listDeliveries: (reportId: number) => Promise<ReportDelivery[]>
  /** A fresh key per execution, so a retried request cannot mail twice. */
  newRequestKey?: () => string
  record: RecordActivity
}

/** The real client wiring (everything but `record`, which the registry supplies). */
export function defaultSendReportDeps(): Omit<SendReportDeps, 'record'> {
  return {
    listReports: fetchRecentReports,
    listRecipients: async (q) => (await searchReportRecipients(q)).recipients,
    sendReport: sendChatReport,
    listDeliveries: async (reportId) => (await fetchReportDeliveries(reportId)).deliveries,
  }
}

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

export function sendReportAction(deps: SendReportDeps): ChatActionDefinition<G2gActionApp> {
  return {
    key: 'send_report',
    label: 'Send a report',
    description: 'E-mail a saved report to colleagues in your organisation.',
    risk: 'write',
    phrases: ['send report', 'send a report', 'email report', 'email a report', 'send the report', 'share report', 'share a report'],
    // Any page the user reached through their own sidebar inside a module with an AI Stack.
    appliesTo: (context) => context.menuId !== null && context.moduleKey !== null,
    inputs: [
      {
        key: 'report',
        label: 'Report',
        type: 'select',
        required: true,
        options: async (context): Promise<ActionOption[]> => {
          const reports = context.moduleKey ? await deps.listReports(context.moduleKey) : []

          return [
            { value: '', label: reports.length === 0 ? 'No saved reports yet - generate one first' : 'Choose a report' },
            ...reports.map((report) => ({
              value: String(report.id),
              label: `${report.title} (${report.created_at})`,
            })),
          ]
        },
      },
      {
        key: 'recipients',
        label: 'Send to',
        type: 'multiselect',
        required: true,
        // Real people of the caller's organisation who have an e-mail address; ids only.
        options: async (): Promise<ActionOption[]> =>
          (await deps.listRecipients('')).map((person) => ({
            value: String(person.id),
            label: `${person.name} <${person.email}>`,
          })),
      },
      { key: 'note', label: 'Note', type: 'textarea', maxLength: 500, placeholder: 'Optional message to include' },
    ],
    validate: (values) => {
      const errors: Record<string, string> = {}

      if (!/^\d+$/.test(values.report ?? '')) errors.report = 'Choose a report.'
      const ids = splitMulti(values.recipients)
      if (ids.some((id) => !/^\d+$/.test(id))) errors.recipients = 'Choose recipients from the list.'
      else if (ids.length === 0) errors.recipients = 'Choose at least one recipient.'
      else if (ids.length > 20) errors.recipients = 'At most 20 recipients per send.'

      return errors
    },
    preview: (values, _context, labels) => ({
      title: 'E-mail this report?',
      lines: [
        { label: 'Report', value: labels.report ?? values.report },
        {
          label: `Recipients (${splitMulti(values.recipients).length})`,
          value: labels.recipients ?? splitMulti(values.recipients).join(', '),
        },
        ...(values.note ? [{ label: 'Note', value: values.note }] : []),
      ],
      warning: 'This sends real e-mail to these people and cannot be undone.',
    }),
    execute: async (values, context): Promise<ActionResult> => {
      const reportId = Number(values.report)
      const ids = splitMulti(values.recipients).map(Number)

      try {
        const outcome = await deps.sendReport(reportId, ids, {
          note: values.note || undefined,
          requestKey: (deps.newRequestKey ?? newKey)(),
        })

        const failures = outcome.results.filter((row) => row.status === 'failed')

        if (context.moduleKey) {
          await writeLedger(deps.record, context.moduleKey, {
            operation: 'chat_send_report',
            operation_label: 'Send report (chat)',
            capability: 'conversational',
            status: failures.length > 0 ? 'failed' : 'completed',
            message: `Sent report "${outcome.title}": ${outcome.sent} sent, ${outcome.failed} failed, ${outcome.duplicate} already sent.`,
            subject_entity_key: 'report',
            subject_id: reportId,
            subject_label: outcome.title,
          })
        }

        if (failures.length > 0) {
          return {
            ok: false,
            message: `Sent to ${outcome.sent}, but ${failures.length} failed: ${failures.map((row) => `${row.name} (${row.error ?? 'error'})`).join('; ')}`,
          }
        }

        return {
          ok: true,
          message:
            outcome.sent > 0
              ? `Sent "${outcome.title}" to ${outcome.sent} ${outcome.sent === 1 ? 'person' : 'people'}${outcome.duplicate ? ` (${outcome.duplicate} had it already)` : ''}.`
              : `"${outcome.title}" had already just been sent to everyone chosen; nothing was sent again.`,
          link: { label: 'Open the report', href: `/ai/reports/${reportId}` },
        }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The report could not be sent.') }
      }
    },
    verify: async (values) => {
      const reportId = Number(values.report)
      const ids = splitMulti(values.recipients).map(Number)

      try {
        const deliveries = await deps.listDeliveries(reportId)
        const missing = ids.filter((id) => !deliveries.some((row) => row.recipient_user_id === id && row.status === 'sent'))

        return missing.length === 0
          ? { ok: true }
          : { ok: false, message: `The send ran, but ${missing.length} recipient(s) have no confirmed delivery on record.` }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The delivery record could not be read back.') }
      }
    },
  }
}
