/**
 * Send a saved report to real colleagues from the chat - by e-mail, SMS or WhatsApp.
 *
 * Applies on any page inside a module with an AI Stack (a page from the user's own sidebar). The
 * report is chosen from the organisation's recent saved reports for THIS module, read live; the
 * recipients are ticked from the backend's tenant-scoped list of people who have the contact method
 * the channel needs (an e-mail address, or a mobile number) - nothing is typed in. The backend
 * enforces everything that matters: administrator only, the report and every recipient must belong
 * to the caller's organisation, the channel must be set up for it, a recipient cap, and a double
 * submit does not send twice.
 *
 * ONE DEFINITION PER CHANNEL, SAME MECHANISM
 *
 *   send_report            e-mail           (server, the organisation's mail profile)
 *   send_report_sms        SMS              (server, the organisation's own SMS gateway)
 *   send_report_whatsapp   WhatsApp         (server, the organisation's WhatsApp Business Cloud API account)
 *
 * All three call the same endpoint the report page's Send dialog calls. Nothing here decides whether a
 * message left: `verify` reads the delivery history back and confirms every chosen recipient has a
 * `sent` row for THIS channel, so a send the gateway refused is never reported as done.
 *
 * WHATSAPP WITHOUT A CONNECTED ACCOUNT is not a send. The server then only prepares a click-to-chat
 * link per person (status `prepared`); this action reports that as NOT sent and shows the links.
 *
 * Registry wiring (registry.ts is owned elsewhere):
 *   gate(sendReportAction({ ...defaultSendReportDeps(), record })),
 *   gate(sendReportAction({ ...defaultSendReportDeps(), record }, 'sms')),
 *   gate(sendReportAction({ ...defaultSendReportDeps(), record }, 'whatsapp')),
 */

import {
  fetchRecentReports,
  fetchReportDeliveries,
  searchReportRecipients,
  sendChatReport,
  type DeliveryChannel,
  type SendChannel,
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
  sendReport: (
    reportId: number,
    recipientIds: number[],
    options: { note?: string; requestKey?: string; channel?: SendChannel; reportUrl?: string },
  ) => Promise<SendReportResult>
  listDeliveries: (reportId: number) => Promise<ReportDelivery[]>
  /** A fresh key per execution, so a retried request cannot send twice. */
  newRequestKey?: () => string
  /** The absolute address of a saved report, for the link an SMS or WhatsApp message carries. */
  reportUrl?: (reportId: number) => string | undefined
  record: RecordActivity
}

/** The real client wiring (everything but `record`, which the registry supplies). */
export function defaultSendReportDeps(): Omit<SendReportDeps, 'record'> {
  return {
    listReports: fetchRecentReports,
    // Everyone of the organisation is listed; each channel keeps only the people it can reach.
    listRecipients: async (q) => (await searchReportRecipients(q)).recipients,
    sendReport: sendChatReport,
    listDeliveries: async (reportId) => (await fetchReportDeliveries(reportId)).deliveries,
    reportUrl: (reportId) => (typeof window === 'undefined' ? undefined : `${window.location.origin}/ai/reports/${reportId}`),
  }
}

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

interface ChannelSpec {
  key: string
  label: string
  /** Sentence naming what the action does, in the chat's action list. */
  description: string
  phrases: string[]
  contact: 'email' | 'mobile'
  noun: string
  title: string
  warning: string
}

const CHANNELS: Record<SendChannel, ChannelSpec> = {
  email: {
    key: 'send_report',
    label: 'Send a report',
    description: 'E-mail a saved report to colleagues in your organisation.',
    phrases: ['send report', 'send a report', 'email report', 'email a report', 'send the report', 'share report', 'share a report'],
    contact: 'email',
    noun: 'e-mail',
    title: 'E-mail this report?',
    warning: 'This sends real e-mail to these people and cannot be undone.',
  },
  sms: {
    key: 'send_report_sms',
    label: 'Send a report by SMS',
    description: "Text a saved report's link to colleagues' mobile numbers through your organisation's SMS gateway.",
    phrases: [
      'send report by sms', 'send a report by sms', 'send the report by sms', 'send report via sms', 'send a report via sms',
      'sms report', 'sms a report', 'sms the report', 'text report', 'text a report', 'send report as sms',
    ],
    contact: 'mobile',
    noun: 'SMS',
    title: 'Send this report by SMS?',
    warning: 'This sends a real, billable text message to these numbers and cannot be undone.',
  },
  whatsapp: {
    key: 'send_report_whatsapp',
    label: 'Send a report on WhatsApp',
    description: "Send a saved report's link on WhatsApp from your organisation's WhatsApp Business number.",
    phrases: [
      'send report on whatsapp', 'send a report on whatsapp', 'send the report on whatsapp', 'send report by whatsapp',
      'send a report by whatsapp', 'send report via whatsapp', 'send a report via whatsapp', 'whatsapp report',
      'whatsapp a report', 'whatsapp the report', 'send report as whatsapp',
    ],
    contact: 'mobile',
    noun: 'WhatsApp message',
    title: 'Send this report on WhatsApp?',
    warning: 'This sends a real WhatsApp message to these numbers and cannot be undone.',
  },
  both: {
    key: 'send_report_sms_whatsapp',
    label: 'Send a report by SMS and WhatsApp',
    description: "Send a saved report's link by SMS and on WhatsApp to the same people; each channel is attempted on its own.",
    phrases: [
      'send report by sms and whatsapp', 'send a report by sms and whatsapp', 'send the report by sms and whatsapp',
      'send report on sms and whatsapp', 'send report by both', 'send a report by both', 'send report via sms and whatsapp',
      'sms and whatsapp report', 'send report on both',
    ],
    contact: 'mobile',
    noun: 'SMS and WhatsApp',
    title: 'Send this report by SMS and WhatsApp?',
    warning: 'This sends a real, billable text message and a real WhatsApp message to these numbers and cannot be undone. If one channel fails the other is still sent.',
  },
}

/** A number is shown by its last four digits only: enough to tell two people apart, not a directory. */
const maskedNumber = (mobile: string) => `••••${mobile.replace(/\D+/g, '').slice(-4)}`

export function sendReportAction(deps: SendReportDeps, channel: SendChannel = 'email'): ChatActionDefinition<G2gActionApp> {
  const spec = CHANNELS[channel]

  return {
    key: spec.key,
    label: spec.label,
    description: spec.description,
    risk: 'write',
    phrases: spec.phrases,
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
        // Real people of the caller's organisation who have what this channel needs; ids only travel.
        options: async (): Promise<ActionOption[]> =>
          (await deps.listRecipients(''))
            .filter((person) => (spec.contact === 'email' ? person.email : person.mobile))
            .map((person) => ({
              value: String(person.id),
              label:
                spec.contact === 'email'
                  ? `${person.name}${person.email ? ` <${person.email}>` : ''}`
                  : `${person.name} (${maskedNumber(person.mobile ?? '')})`,
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
      title: spec.title,
      lines: [
        { label: 'Report', value: labels.report ?? values.report },
        {
          label: `Recipients (${splitMulti(values.recipients).length})`,
          value: labels.recipients ?? splitMulti(values.recipients).join(', '),
        },
        ...(values.note ? [{ label: 'Note', value: values.note }] : []),
      ],
      warning: spec.warning,
    }),
    execute: async (values, context): Promise<ActionResult> => {
      const reportId = Number(values.report)
      const ids = splitMulti(values.recipients).map(Number)

      try {
        // E-mail is the endpoint's default, so its request is exactly what it always was.
        const reportUrl = channel === 'email' ? undefined : deps.reportUrl?.(reportId)
        const outcome = await deps.sendReport(reportId, ids, {
          note: values.note || undefined,
          requestKey: (deps.newRequestKey ?? newKey)(),
          ...(channel === 'email' ? {} : { channel }),
          ...(reportUrl ? { reportUrl } : {}),
        })

        const failures = outcome.results.filter((row) => row.status === 'failed')
        const prepared = outcome.results.filter((row) => row.status === 'prepared')

        if (context.moduleKey) {
          await writeLedger(deps.record, context.moduleKey, {
            operation: channel === 'email' ? 'chat_send_report' : `chat_send_report_${channel}`,
            operation_label: `Send report by ${spec.noun} (chat)`,
            capability: 'conversational',
            status: failures.length > 0 || (prepared.length > 0 && outcome.sent === 0) ? 'failed' : 'completed',
            message: `Report "${outcome.title}" by ${spec.noun}: ${outcome.sent} sent, ${outcome.failed} failed, ${outcome.duplicate} already sent${prepared.length ? `, ${prepared.length} only prepared (not sent)` : ''}.`,
            subject_entity_key: 'report',
            subject_id: reportId,
            subject_label: outcome.title,
          })
        }

        // WhatsApp with no connected Business account: the server sent nothing. Say so, and give the links.
        if (prepared.length > 0 && outcome.sent === 0 && failures.length === 0) {
          return {
            ok: false,
            message: `Nothing was sent: this organisation has no WhatsApp Business account connected, so the server only prepared ${prepared.length} click-to-chat link${prepared.length === 1 ? '' : 's'} (${prepared
              .map((row) => `${row.name}: ${row.link ?? 'no link'}`)
              .join(' | ')}). An administrator connects it under Platform Services → Integration.`,
          }
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
              ? `Sent "${outcome.title}" by ${spec.noun}: ${outcome.sent} message${outcome.sent === 1 ? '' : 's'} accepted${outcome.duplicate ? ` (${outcome.duplicate} had it already)` : ''}${prepared.length ? `; ${prepared.length} WhatsApp message${prepared.length === 1 ? ' was' : 's were'} only prepared, NOT sent (no WhatsApp Business account connected): ${prepared.map((row) => `${row.name}: ${row.link ?? 'no link'}`).join(' | ')}` : ''}. "Sent" means the ${channel === 'email' ? 'mail server' : channel === 'sms' ? 'SMS gateway' : channel === 'whatsapp' ? 'WhatsApp service' : 'SMS gateway or WhatsApp service'} accepted it.`
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
        const missing = ids.filter(
          (id) =>
            !deliveries.some(
              (row) =>
                row.recipient_user_id === id &&
                row.status === 'sent' &&
                // "Both" counts a person as reached when at least one channel's provider accepted it; execute() names any channel that failed.
                (channel === 'both' ? row.channel === 'sms' || row.channel === 'whatsapp' : (row.channel ?? 'email') === channel),
            ),
        )

        return missing.length === 0
          ? { ok: true }
          : { ok: false, message: `The send ran, but ${missing.length} recipient(s) have no confirmed ${spec.noun} delivery on record.` }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The delivery record could not be read back.') }
      }
    },
  }
}
