/**
 * Create a template from the chat - the module's own AI Stack templates, through the same
 * endpoint the Templates tab saves to (`POST /api/ai/templates`).
 *
 * Applies on any page inside a module that has an AI Stack. The backend enforces who may create
 * templates (the prompts right) and validates everything; a refusal comes back as the result.
 *
 * What it writes is deliberately modest and visible in the preview: a DRAFT. A draft is never
 * offered to the module's AI panel or used for a report until someone publishes it from the
 * Templates tab, so creating one from a sentence cannot change what anyone else sees.
 *
 * A report template gets a layout that is only a title, the row count and the whole result as a
 * table (`<<rows_table>>`), so it works for any data source without the chat having to know its
 * columns - the author can refine the layout in the Templates tab afterwards.
 */

import type { ActionOption, ActionResult, ChatActionDefinition } from '../types'
import type { G2gActionApp } from './actions'
import { failureMessage, writeLedger, type RecordActivity } from './shared'

export interface TemplateActionDeps {
  /** Read-only data sources the module may bind a report to, read live. */
  listDataSources: (moduleKey: string) => Promise<Array<{ name: string; label: string }>>
  createTemplate: (payload: {
    name: string
    description?: string
    module_key: string
    kind: 'prompt' | 'report'
    status: 'draft'
    user_prompt: string
    html_layout?: string
    data_source?: string
  }) => Promise<{ template?: { id?: number } } | unknown>
  record: RecordActivity
}

/** The layout for a chat-created report template: no column names, so any source fits. */
export const CHAT_REPORT_LAYOUT = '<h1><<title>></h1>\n<p><<row_count>> records</p>\n<<rows_table>>'

export function createTemplateAction(deps: TemplateActionDeps): ChatActionDefinition<G2gActionApp> {
  return {
    key: 'create_template',
    label: 'Create a template',
    description: 'Save a new draft prompt or report template for this module.',
    risk: 'write',
    phrases: [
      'create template',
      'create a template',
      'create new template',
      'new template',
      'add template',
      'add a template',
      'create report template',
      'create a report template',
      'create prompt template',
      'create a prompt template',
    ],
    // Any page the user reached through their own sidebar inside a module with an AI Stack.
    appliesTo: (context) => context.menuId !== null && context.moduleKey !== null,
    inputs: [
      { key: 'name', label: 'Template name', type: 'text', required: true, maxLength: 200, placeholder: 'e.g. Monthly summary' },
      {
        key: 'kind',
        label: 'Kind',
        type: 'select',
        required: true,
        options: async (): Promise<ActionOption[]> => [
          { value: 'report', label: 'Report (filled from this module’s data)' },
          { value: 'prompt', label: 'Prompt (text sent to the model)' },
        ],
      },
      {
        key: 'data_source',
        label: 'Data source (reports)',
        type: 'select',
        // This module's own read-only sources, read live - never a fixed list.
        options: async (context): Promise<ActionOption[]> => {
          const sources = context.moduleKey ? await deps.listDataSources(context.moduleKey) : []

          return [{ value: '', label: 'None (prompt templates)' }, ...sources.map((source) => ({ value: source.name, label: source.label }))]
        },
      },
      { key: 'user_prompt', label: 'Prompt text (prompts)', type: 'textarea', maxLength: 20000, placeholder: 'What the model should be asked' },
      { key: 'description', label: 'Description', type: 'textarea', maxLength: 1000, placeholder: 'Optional' },
    ],
    validate: (values) => {
      const errors: Record<string, string> = {}

      if (values.kind !== 'report' && values.kind !== 'prompt') errors.kind = 'Choose report or prompt.'
      if (values.kind === 'report' && !values.data_source) errors.data_source = 'A report template needs a data source.'
      if (values.kind === 'prompt' && !values.user_prompt) errors.user_prompt = 'A prompt template needs prompt text.'

      return errors
    },
    preview: (values, context, labels) => ({
      title: 'Save this draft template?',
      lines: [
        { label: 'Name', value: values.name },
        { label: 'Module', value: context.moduleKey ?? '—' },
        { label: 'Kind', value: values.kind },
        ...(values.kind === 'report' ? [{ label: 'Data source', value: labels.data_source ?? values.data_source }] : []),
        ...(values.kind === 'prompt' ? [{ label: 'Prompt', value: values.user_prompt }] : []),
        { label: 'Status', value: 'Draft - publish it from the Templates tab' },
      ],
    }),
    execute: async (values, context): Promise<ActionResult> => {
      const moduleKey = context.moduleKey

      if (!moduleKey) return { ok: false, message: 'Open a module first; templates belong to a module.' }

      try {
        const response = (await deps.createTemplate({
          name: values.name,
          description: values.description || undefined,
          module_key: moduleKey,
          kind: values.kind as 'prompt' | 'report',
          status: 'draft',
          // A report keeps no prompt of its own; the API requires none for reports.
          user_prompt: values.kind === 'prompt' ? values.user_prompt : '',
          html_layout: values.kind === 'report' ? CHAT_REPORT_LAYOUT : undefined,
          data_source: values.kind === 'report' ? values.data_source : undefined,
        })) as { template?: { id?: number } } | undefined

        await writeLedger(deps.record, moduleKey, {
          operation: 'chat_create_template',
          operation_label: 'Create template (chat)',
          capability: 'conversational',
          status: 'completed',
          message: `Created the ${values.kind} template "${values.name}" as a draft from the chat.`,
          subject_entity_key: 'template',
          subject_id: response?.template?.id,
          subject_label: values.name,
        })

        return { ok: true, message: `Saved the draft template "${values.name}". Publish it from the module's Templates tab.` }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The template could not be saved.') }
      }
    },
  }
}
