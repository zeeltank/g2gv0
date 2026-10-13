/**
 * LMS chat actions: request a course for yourself, and approve or reject a learner's request.
 *
 * Both call the endpoints the LMS pages' own buttons call, through `assignmentApprovalService`,
 * as the signed-in user. The server enforces both (assignmentController):
 *
 *   request_enrollment        POST /api/lmsAssignment/request   the requester is the token's owner (never a
 *                             body field), the course must belong to the token's tenant, and a duplicate or
 *                             already-assigned course is refused. It files a PENDING request; nothing is
 *                             enrolled until an administrator approves.
 *   review_enrollment_request POST /api/lmsAssignment/review/{id}  `guardLmsProfile(['admin','hr'])` on the
 *                             token's user (a profile name in the request is ignored), tenant-scoped row,
 *                             only `pending` rows.
 *
 * Assigning a course to other people (`POST /api/lmsAssignment`) is in `actions-lms-courses.ts`: the
 * server now gates it (middleware `anyaccess`), so it is exposed there.
 */

import type { LaravelContext } from '@/lib/laravel-context'
import type { ActionOption, ActionResult, ChatActionDefinition } from '../types'
import type { G2gActionApp } from './actions'
import { failureMessage, onPage, writeLedger, type RecordActivity } from './shared'

export const LEARNING_CATALOG_PAGE = '/module/lms/learning/learning-catalog'
export const LMS_ASSIGNMENTS_PAGE = '/module/lms/training-and-records/assignments'

const CATALOG_MODULE_KEY = 'lms_learning_catalog'
const LMS_MODULE_KEY = 'lms'

export interface CatalogCourseRow {
  id: number
  display_name: string | null
}

export interface PendingEnrollmentRow {
  id: number
  learner_name: string
  course_name: string
}

export interface LmsActionDeps {
  /** Active courses in the organisation's catalogue, live. */
  listCourses: (context: LaravelContext) => Promise<CatalogCourseRow[]>
  requestEnrollment: (context: LaravelContext, courseId: number) => Promise<unknown>
  /** Requests still waiting for a decision. */
  listPending: (context: LaravelContext) => Promise<PendingEnrollmentRow[]>
  reviewRequest: (
    context: LaravelContext,
    id: number,
    decision: 'approved' | 'rejected',
    note?: string,
  ) => Promise<unknown>
  record: RecordActivity
}

export function requestEnrollmentAction(deps: LmsActionDeps): ChatActionDefinition<G2gActionApp> {
  return {
    key: 'request_enrollment',
    label: 'Request a course',
    description: 'Ask to be enrolled in a course from the catalogue. An administrator approves it.',
    risk: 'write',
    phrases: ['request a course', 'request course', 'request enrollment', 'request enrolment', 'enroll me', 'enrol me', 'enroll me in', 'sign me up'],
    appliesTo: (context) => onPage(context, LEARNING_CATALOG_PAGE),
    inputs: [
      {
        key: 'course_id',
        label: 'Course',
        type: 'select',
        required: true,
        options: async (context): Promise<ActionOption[]> =>
          (await deps.listCourses(context.app.laravel)).map((course) => ({
            value: String(course.id),
            label: course.display_name?.trim() || `Course ${course.id}`,
          })),
      },
    ],
    validate: (values): Record<string, string> =>
      values.course_id && !/^\d+$/.test(values.course_id) ? { course_id: 'Choose a course from the list.' } : {},
    preview: (values, _context, labels) => ({
      title: 'Request this course?',
      lines: [{ label: 'Course', value: labels.course_id ?? `Course ${values.course_id}` }],
      warning: 'This files a request for you. You are enrolled once an administrator approves it.',
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        await deps.requestEnrollment(context.app.laravel, Number(values.course_id))

        await writeLedger(deps.record, CATALOG_MODULE_KEY, {
          operation: 'chat_request_enrollment',
          operation_label: 'Request course enrolment (chat)',
          message: `Requested enrolment in course ${values.course_id} from the chat.`,
          subject_entity_key: 'course',
          subject_id: Number(values.course_id),
          subject_label: `Course ${values.course_id}`,
        })

        return { ok: true, message: 'Your request was submitted for approval.' }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The request could not be submitted.') }
      }
    },
  }
}

export function reviewEnrollmentRequestAction(deps: LmsActionDeps): ChatActionDefinition<G2gActionApp> {
  return {
    key: 'review_enrollment_request',
    label: 'Approve or reject a course request',
    description: 'Decide a learner\'s pending course request.',
    risk: 'write',
    phrases: ['approve course request', 'reject course request', 'approve enrollment request', 'reject enrollment request', 'approve enrolment request', 'reject enrolment request', 'review course request', 'approve request', 'reject request'],
    appliesTo: (context) => onPage(context, LMS_ASSIGNMENTS_PAGE),
    inputs: [
      {
        key: 'request_id',
        label: 'Request',
        type: 'select',
        required: true,
        options: async (context): Promise<ActionOption[]> =>
          (await deps.listPending(context.app.laravel)).map((row) => ({
            value: String(row.id),
            label: `${row.learner_name} - ${row.course_name}`,
          })),
      },
      {
        key: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        // The two values the review endpoint accepts - a protocol choice, not organisation data.
        options: async () => [
          { value: 'approved', label: 'Approve' },
          { value: 'rejected', label: 'Reject' },
        ],
      },
      { key: 'note', label: 'Note', type: 'text', maxLength: 500, placeholder: 'Optional' },
    ],
    validate: (values) => {
      const errors: Record<string, string> = {}

      if (values.request_id && !/^\d+$/.test(values.request_id)) errors.request_id = 'Choose a request from the list.'
      if (values.decision && values.decision !== 'approved' && values.decision !== 'rejected') {
        errors.decision = 'Choose approve or reject.'
      }

      return errors
    },
    preview: (values, _context, labels) => ({
      title: values.decision === 'rejected' ? 'Reject this course request?' : 'Approve this course request?',
      lines: [
        { label: 'Request', value: labels.request_id ?? `Request ${values.request_id}` },
        { label: 'Decision', value: values.decision === 'rejected' ? 'Reject' : 'Approve' },
        { label: 'Note', value: values.note || '—' },
      ],
      warning: values.decision === 'rejected'
        ? 'Any enrolment the learner has for this course is withdrawn.'
        : 'The learner is enrolled in the course.',
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const decision = values.decision === 'rejected' ? 'rejected' : 'approved'
        await deps.reviewRequest(context.app.laravel, Number(values.request_id), decision, values.note || undefined)

        await writeLedger(deps.record, LMS_MODULE_KEY, {
          operation: 'chat_review_enrollment_request',
          operation_label: 'Review course request (chat)',
          message: `Marked course request ${values.request_id} as ${decision} from the chat.`,
          subject_entity_key: 'course_request',
          subject_id: Number(values.request_id),
          subject_label: `Course request ${values.request_id}`,
        })

        return { ok: true, message: decision === 'approved' ? 'Request approved.' : 'Request rejected.' }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The request could not be decided.') }
      }
    },
  }
}
