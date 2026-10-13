/**
 * Talent Management chat actions: create a job posting.
 *
 * Calls POST /api/job-postings through `recruitmentService.createJob`, the call the Recruitment
 * page's own form makes, as the signed-in user.
 *
 * SERVER ENFORCEMENT: that route had no permission check at all (an Employee could publish a
 * posting to the careers page). It is now behind `platformright:/module/talent-management/recruitment,add`
 * - the same tblgroupwise_rights_g2g row the sidebar uses for the Recruitment page - and the
 * controller takes the tenant from the token. If the tenant runs a requisition approval chain,
 * the server files the posting as `Requested` instead of live; the result message says so.
 */

import type { LaravelContext } from '@/lib/laravel-context'
import type { ActionOption, ActionResult, ChatActionDefinition } from '../types'
import type { G2gActionApp } from './actions'
import { failureMessage, isIsoDate, onPage, writeLedger, type RecordActivity } from './shared'

export const RECRUITMENT_PAGE = '/module/talent-management/recruitment'

const MODULE_KEY = 'talent_recruitment'

export interface JobPostingPayload {
  title: string
  department_id?: string
  location?: string
  employment_type?: string
  positions?: number
  deadline?: string
  description?: string
}

export interface TalentActionDeps {
  /** The organisation's departments, live. */
  listDepartments: (context: LaravelContext) => Promise<Array<{ id: number; department: string }>>
  createJob: (payload: JobPostingPayload) => Promise<{ message?: string; data?: { id?: number } } | unknown>
  record: RecordActivity
}

export function createJobPostingAction(deps: TalentActionDeps): ChatActionDefinition<G2gActionApp> {
  return {
    key: 'create_job_posting',
    label: 'Create a job posting',
    description: 'Open a job posting in Recruitment.',
    risk: 'write',
    phrases: [
      'create job posting',
      'create a job posting',
      'create job opening',
      'create a job opening',
      'add job posting',
      'add a job posting',
      'new job posting',
      'post a job',
      'open a position',
    ],
    appliesTo: (context) => onPage(context, RECRUITMENT_PAGE),
    inputs: [
      { key: 'title', label: 'Job title', type: 'text', required: true, maxLength: 255, placeholder: 'e.g. Senior Accountant' },
      {
        key: 'department_id',
        label: 'Department',
        type: 'select',
        options: async (context): Promise<ActionOption[]> => [
          { value: '', label: 'Not set' },
          ...(await deps.listDepartments(context.app.laravel)).map((department) => ({
            value: String(department.id),
            label: department.department,
          })),
        ],
      },
      { key: 'location', label: 'Location', type: 'text', maxLength: 255, placeholder: 'Optional' },
      { key: 'employment_type', label: 'Employment type', type: 'text', maxLength: 100, placeholder: 'e.g. Full-time (optional)' },
      { key: 'positions', label: 'Number of positions', type: 'text', maxLength: 5, placeholder: 'Optional' },
      { key: 'deadline', label: 'Apply by', type: 'text', maxLength: 10, placeholder: 'YYYY-MM-DD (optional)' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional' },
    ],
    validate: (values) => {
      const errors: Record<string, string> = {}
      const positions = values.positions?.trim() ?? ''
      const deadline = values.deadline?.trim() ?? ''

      if (positions !== '' && (!/^\d+$/.test(positions) || Number(positions) < 1)) {
        errors.positions = 'Enter a whole number of at least 1.'
      }
      if (deadline !== '' && !isIsoDate(deadline)) errors.deadline = 'Use a real date as YYYY-MM-DD.'

      return errors
    },
    preview: (values, _context, labels) => ({
      title: 'Create this job posting?',
      lines: [
        { label: 'Title', value: values.title },
        { label: 'Department', value: values.department_id ? (labels.department_id ?? `Department ${values.department_id}`) : 'Not set' },
        { label: 'Location', value: values.location || '—' },
        { label: 'Employment type', value: values.employment_type || '—' },
        { label: 'Positions', value: values.positions || '—' },
        { label: 'Apply by', value: values.deadline || '—' },
        { label: 'Description', value: values.description || '—' },
      ],
      warning: 'It is published as active on the careers page, unless your organisation requires approval for new requisitions.',
    }),
    execute: async (values): Promise<ActionResult> => {
      try {
        const response = (await deps.createJob({
          title: values.title,
          department_id: values.department_id || undefined,
          location: values.location || undefined,
          employment_type: values.employment_type || undefined,
          positions: values.positions ? Number(values.positions) : undefined,
          deadline: values.deadline || undefined,
          description: values.description || undefined,
        })) as { message?: string; data?: { id?: number } } | undefined

        await writeLedger(deps.record, MODULE_KEY, {
          operation: 'chat_create_job_posting',
          operation_label: 'Create job posting (chat)',
          message: `Created the job posting "${values.title}" from the chat.`,
          subject_entity_key: 'job_posting',
          subject_id: response?.data?.id,
          subject_label: values.title,
        })

        // A requisition chain files it as "Requested", not live - say so in the server's own words.
        const note = response?.message?.trim() ?? ''

        return { ok: true, message: /approval/i.test(note) ? note : `Created the job posting "${values.title}".` }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The job posting could not be created.') }
      }
    },
  }
}
