/**
 * HRIT (HR) chat actions: apply for leave, and decide a leave request.
 *
 * Both go through the same service functions the Leave Requests page's own buttons use
 * (`leaveService`), as the signed-in user, so the SERVER decides - and it does, for both:
 *
 *   apply_leave   POST /api/leave/requests            - the subject is the token's owner; naming
 *                 another employee needs an elevated role, and this action never names one.
 *                 Balance, overlap and leave-year rules are checked server-side.
 *   decide_leave  POST /api/leave/requests/{id}/decision - `approve_leave` in the leave role
 *                 matrix, the caller's scope over the employee, the approval chain's current
 *                 step, and "never your own request" are all enforced by the controller.
 *
 * Tenant comes from the token on the server; nothing here sends or trusts one.
 */

import type { LaravelContext } from '@/lib/laravel-context'
import type { ActionOption, ActionResult, ChatActionDefinition } from '../types'
import type { G2gActionApp } from './actions'
import { failureMessage, isIsoDate, onPage, writeLedger, type RecordActivity } from './shared'

export const LEAVE_REQUESTS_PAGE = '/module/hrit-solutions/leave-management/leave-requests'

const MODULE_KEY = 'hrit_management'

/** A pending request the caller has to decide, as the Leave Requests page lists it. */
export interface PendingLeaveRequest {
  id: number
  employee_name: string
  leave_type: string
  from_date: string | null
  to_date: string | null
  days: number
  reason: string | null
}

export interface LeaveActionDeps {
  /** The organisation's leave types, live. */
  listLeaveTypes: (context: LaravelContext) => Promise<ActionOption[]>
  /** The statuses a decision can set, live (the server's own vocabulary). */
  listDecisionStatuses: (context: LaravelContext) => Promise<ActionOption[]>
  /** Requests waiting for THIS caller's decision (`awaiting_me`). */
  listAwaitingMe: (context: LaravelContext) => Promise<PendingLeaveRequest[]>
  applyLeave: (
    context: LaravelContext,
    payload: { leaveTypeId: string; dayType: 'full'; fromDate: string; toDate: string; comment: string },
  ) => Promise<{ data?: { id?: number } } | unknown>
  decideRequest: (
    context: LaravelContext,
    id: number,
    payload: { status: string; hrRemarks?: string },
  ) => Promise<unknown>
  record: RecordActivity
}

/** Decisions this action will send. Offered only if the server's live status list includes them. */
const DECISIONS = ['approved', 'rejected']

export function applyLeaveAction(deps: LeaveActionDeps): ChatActionDefinition<G2gActionApp> {
  return {
    key: 'apply_leave',
    label: 'Apply for leave',
    description: 'Apply for your own full-day leave.',
    risk: 'write',
    phrases: ['apply for leave', 'apply for a leave', 'apply leave', 'request leave', 'request a leave', 'take leave', 'book leave'],
    appliesTo: (context) => onPage(context, LEAVE_REQUESTS_PAGE),
    inputs: [
      {
        key: 'leave_type_id',
        label: 'Leave type',
        type: 'select',
        required: true,
        options: (context) => deps.listLeaveTypes(context.app.laravel),
      },
      { key: 'from_date', label: 'From date', type: 'text', required: true, maxLength: 10, placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'To date', type: 'text', maxLength: 10, placeholder: 'YYYY-MM-DD (blank = one day)' },
      { key: 'comment', label: 'Reason', type: 'text', required: true, maxLength: 255, placeholder: 'Why you need the leave' },
    ],
    validate: (values) => {
      const errors: Record<string, string> = {}
      const from = values.from_date?.trim() ?? ''
      const to = values.to_date?.trim() ?? ''

      if (from !== '' && !isIsoDate(from)) errors.from_date = 'Use a real date as YYYY-MM-DD.'
      if (to !== '' && !isIsoDate(to)) errors.to_date = 'Use a real date as YYYY-MM-DD.'
      if (!errors.from_date && !errors.to_date && from !== '' && to !== '' && to < from) {
        errors.to_date = 'The end date cannot be before the start date.'
      }

      return errors
    },
    preview: (values, _context, labels) => {
      const to = values.to_date || values.from_date

      return {
        title: 'Apply for this leave?',
        lines: [
          { label: 'Leave type', value: labels.leave_type_id ?? `Leave type ${values.leave_type_id}` },
          { label: 'From', value: values.from_date },
          { label: 'To', value: to },
          { label: 'Day type', value: 'Full day' },
          { label: 'Reason', value: values.comment },
        ],
        warning: 'This files a leave request for you. Your approver is notified and balance and overlap rules apply.',
      }
    },
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const toDate = values.to_date || values.from_date
        const response = (await deps.applyLeave(context.app.laravel, {
          leaveTypeId: values.leave_type_id,
          dayType: 'full',
          fromDate: values.from_date,
          toDate,
          comment: values.comment,
        })) as { data?: { id?: number } } | undefined

        await writeLedger(deps.record, MODULE_KEY, {
          operation: 'chat_apply_leave',
          operation_label: 'Apply for leave (chat)',
          message: `Applied for leave ${values.from_date} to ${toDate} from the chat.`,
          subject_entity_key: 'leave_request',
          subject_id: response?.data?.id,
          subject_label: `${values.from_date} to ${toDate}`,
        })

        return { ok: true, message: `Applied for leave from ${values.from_date} to ${toDate}.` }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The leave request could not be filed.') }
      }
    },
  }
}

export function decideLeaveAction(deps: LeaveActionDeps): ChatActionDefinition<G2gActionApp> {
  return {
    key: 'decide_leave',
    label: 'Approve or reject a leave request',
    description: 'Decide a leave request that is waiting for you.',
    risk: 'write',
    phrases: ['approve leave', 'approve a leave', 'reject leave', 'reject a leave', 'decline leave', 'decide leave', 'approve leave request', 'reject leave request'],
    appliesTo: (context) => onPage(context, LEAVE_REQUESTS_PAGE),
    inputs: [
      {
        key: 'request_id',
        label: 'Leave request',
        type: 'select',
        required: true,
        // Only what is waiting for this caller; the server re-checks authority and the chain step.
        options: async (context): Promise<ActionOption[]> => {
          const pending = await deps.listAwaitingMe(context.app.laravel)

          return pending.map((request) => ({
            value: String(request.id),
            label: `${request.employee_name} - ${request.leave_type}, ${request.from_date ?? '?'} to ${request.to_date ?? '?'} (${request.days} day${request.days === 1 ? '' : 's'})`,
          }))
        },
      },
      {
        key: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        options: async (context): Promise<ActionOption[]> => {
          const statuses = await deps.listDecisionStatuses(context.app.laravel)

          return statuses.filter((status) => DECISIONS.includes(status.value))
        },
      },
      { key: 'remark', label: 'Remark', type: 'text', maxLength: 100, placeholder: 'Optional' },
    ],
    validate: (values) => {
      const errors: Record<string, string> = {}

      if (values.request_id && !/^\d+$/.test(values.request_id)) errors.request_id = 'Choose a request from the list.'
      if (values.decision && !DECISIONS.includes(values.decision)) errors.decision = 'Choose approve or reject.'

      return errors
    },
    preview: (values, _context, labels) => ({
      title: values.decision === 'rejected' ? 'Reject this leave request?' : 'Approve this leave request?',
      lines: [
        { label: 'Request', value: labels.request_id ?? `Request ${values.request_id}` },
        { label: 'Decision', value: labels.decision ?? values.decision },
        { label: 'Remark', value: values.remark || '—' },
      ],
      warning: 'The employee is told the outcome and their leave balance is updated.',
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        await deps.decideRequest(context.app.laravel, Number(values.request_id), {
          status: values.decision,
          hrRemarks: values.remark || undefined,
        })

        await writeLedger(deps.record, MODULE_KEY, {
          operation: 'chat_decide_leave',
          operation_label: 'Decide leave request (chat)',
          message: `Marked leave request ${values.request_id} as ${values.decision} from the chat.`,
          subject_entity_key: 'leave_request',
          subject_id: Number(values.request_id),
          subject_label: `Leave request ${values.request_id}`,
        })

        return { ok: true, message: `Leave request ${values.request_id} marked ${values.decision}.` }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The leave request could not be decided.') }
      }
    },
  }
}
