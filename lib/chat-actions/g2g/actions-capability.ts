/**
 * Capability Intelligence chat actions: add a competency to the Competency Library.
 *
 * Calls POST /api/competency-library/competency through `competencyLibraryService.create`, the
 * call the library's own form makes, as the signed-in user.
 *
 * SERVER ENFORCEMENT: that route is `profile:admin,hr` (administrator / HR manager / HR
 * executive, resolved from the token's user - never from the request); the controller stamps
 * the token's tenant, refuses a code already used in the organisation, and generates a code
 * when none is given.
 *
 * The other Capability Library creates (skills, job roles, KASA) are in `actions-capability-library.ts`:
 * the server now gates them with a rule that keeps the department panel's in-place "add a role" working.
 */

import type { LaravelContext } from '@/lib/laravel-context'
import type { ActionResult, ChatActionDefinition } from '../types'
import type { G2gActionApp } from './actions'
import { failureMessage, onPage, writeLedger, type RecordActivity } from './shared'

export const COMPETENCY_LIBRARY_PAGE = '/module/capability-intelligence/competency-library'

const MODULE_KEY = 'capability_intelligence'

export interface CapabilityActionDeps {
  createCompetency: (
    context: LaravelContext,
    payload: { name: string; code?: string; description?: string },
  ) => Promise<{ data?: { id?: number } } | unknown>
  record: RecordActivity
}

export function createCompetencyAction(deps: CapabilityActionDeps): ChatActionDefinition<G2gActionApp> {
  return {
    key: 'create_competency',
    label: 'Add a competency',
    description: 'Add a competency to the Competency Library.',
    risk: 'write',
    phrases: ['create competency', 'create a competency', 'add competency', 'add a competency', 'new competency', 'make a competency'],
    appliesTo: (context) => onPage(context, COMPETENCY_LIBRARY_PAGE),
    inputs: [
      { key: 'name', label: 'Competency name', type: 'text', required: true, maxLength: 191, placeholder: 'e.g. Stakeholder management' },
      { key: 'code', label: 'Code', type: 'text', maxLength: 64, placeholder: 'Optional - generated when blank' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional' },
    ],
    preview: (values) => ({
      title: 'Add this competency?',
      lines: [
        { label: 'Name', value: values.name },
        { label: 'Code', value: values.code || 'Generated' },
        { label: 'Description', value: values.description || '—' },
      ],
      warning: 'It is added without capability items or level descriptors; add those from the library.',
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const response = (await deps.createCompetency(context.app.laravel, {
          name: values.name,
          code: values.code || undefined,
          description: values.description || undefined,
        })) as { data?: { id?: number } } | undefined

        await writeLedger(deps.record, MODULE_KEY, {
          operation: 'chat_create_competency',
          operation_label: 'Add competency (chat)',
          message: `Added the competency "${values.name}" from the chat.`,
          subject_entity_key: 'competency',
          subject_id: response?.data?.id,
          subject_label: values.name,
        })

        return { ok: true, message: `Added the competency "${values.name}".` }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The competency could not be added.') }
      }
    },
  }
}
