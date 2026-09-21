'use client'

/**
 * Client for Template Management — `/api/ai/templates`.
 *
 * Shaped like `ai-configuration.ts` and `ai-policies.ts` on purpose: same transport,
 * same envelope handling, same "the organisation is never a parameter" rule. All three
 * go through `aiRequest`, so there is one place a token is read and one place an error
 * is turned into something a form can show.
 *
 * ── WHY THE LISTING PATH IS `/templates` AND NOT `/templates/catalog` ────────
 *
 * LMS K-12's client calls `/templates/catalog`, and the comment in its route file
 * says why: `GET /templates` was already taken there by its generation layer's "which
 * templates can I render" list, so the management listing needed a different URI.
 * G2G has no generation layer and therefore no collision, so the listing sits at the
 * obvious path. This is the one endpoint whose URL differs between the two products,
 * and it differs because copying the workaround would have meant importing a
 * constraint that does not exist here.
 */

import { aiRequest } from './client'

/** The module selector's value for "not one module — all of them". */
export const SHARED_MODULE_KEY = '__shared__'

export interface TemplateModule {
  key: string
  label: string
  description: string | null
  icon: string | null
  shared: boolean
}

export interface TemplateVariableDoc {
  key: string
  label: string
  description: string
  /** Whether this variable carries the data a grounded answer has to rest on. */
  grounding: boolean
}

export interface TemplateVariable {
  key: string
  label?: string | null
  required?: boolean
  type?: string | null
  grounding?: boolean
}

/**
 * What a template is.
 *
 * `prompt` only in G2G — see the note on the backend's `TemplateCatalog`. The union
 * is kept as a union rather than collapsed to a string literal so adding `report`
 * later is a one-word change here instead of a refactor.
 */
export type TemplateKind = 'prompt'

export interface AiTemplateRow {
  id: number
  template_key: string
  name: string
  description: string | null
  module_key: string
  module_label: string
  kind: TemplateKind
  domain: string
  category: string | null
  version: number
  status: string
  system_prompt: string | null
  user_prompt: string
  variables: TemplateVariable[]
  output_format: string
  output_schema: Record<string, unknown> | unknown[]
  provider: string | null
  model: string | null
  temperature: number | null
  max_tokens: number | null
  safety_rules: string[]
  allow_as_evidence: boolean
  requires_review: boolean

  sub_institute_id: number | null
  /** A shared baseline row. Visible to every organisation, editable by none of them. */
  is_platform: boolean
  /** False when editing would write this organisation its own copy instead. */
  editable_in_place: boolean

  /** Whether the module's AI panel currently offers this template. */
  offered_in_module: boolean
  offer_label: string | null
  offer_module_key: string | null
  /** Whether the binding is set to appear only when a record is selected. */
  offer_requires_entity: boolean

  grounding_variables: string[]
  unresolvable_variables: string[]

  updated_at: string | null
}

export interface AiTemplateOptions {
  modules: TemplateModule[]
  shared_key: string
  variables: TemplateVariableDoc[]
  grounding_variables: string[]
  statuses: string[]
  kinds: TemplateKind[]
  output_formats: string[]
  categories: string[]
}

export interface AiTemplateIndex {
  sub_institute_id: string | number
  module_key: string | null
  module_label: string
  templates: AiTemplateRow[]
  counts: { total: number; published: number; offered: number }
}

export interface AiTemplatePayload {
  name: string
  description?: string | null
  template_key?: string | null
  module_key: string
  kind?: TemplateKind
  /** Save for every organisation rather than only the signed-in one. */
  shared?: boolean
  domain?: string | null
  category?: string | null
  status: string
  system_prompt?: string | null
  user_prompt: string
  variables?: TemplateVariable[]
  output_format?: string
  safety_rules?: string[]
  allow_as_evidence?: boolean
  requires_review?: boolean
  offer_in_module?: boolean
  suggestion_label?: string | null
  requires_entity?: boolean
  /** Publish as a new version and archive the current one, instead of editing in place. */
  new_version?: boolean
}

export interface TemplatePreview {
  system: string | null
  user: string
  /** Placeholders nothing filled — each one reaches the model as literal `{{name}}`. */
  unresolved: string[]
  values: Record<string, string>
}

export function fetchTemplateOptions(): Promise<AiTemplateOptions> {
  return aiRequest<AiTemplateOptions>('/templates/options')
}

/** Templates for one module. Omit `moduleKey` for every template the organisation can see. */
export function fetchTemplates(moduleKey?: string | null): Promise<AiTemplateIndex> {
  const query = moduleKey ? `?module_key=${encodeURIComponent(moduleKey)}` : ''

  return aiRequest<AiTemplateIndex>(`/templates${query}`)
}

export function fetchTemplate(id: number): Promise<{ template: AiTemplateRow }> {
  return aiRequest(`/templates/${id}`)
}

export function createTemplate(payload: AiTemplatePayload): Promise<{ template: AiTemplateRow }> {
  return aiRequest('/templates', 'POST', payload)
}

export function updateTemplate(
  id: number,
  payload: AiTemplatePayload,
): Promise<{ template: AiTemplateRow; action: string }> {
  return aiRequest(`/templates/${id}`, 'PUT', payload)
}

export function retireTemplate(id: number): Promise<{ id: number }> {
  return aiRequest(`/templates/${id}`, 'DELETE')
}

/**
 * Render the prompts with sample values. No model is called and nothing is stored —
 * this answers "did my placeholder land where I meant it to", which is a question
 * about the text and not about the model.
 */
export function previewTemplate(input: {
  system_prompt?: string | null
  user_prompt: string
  values?: Record<string, string>
}): Promise<TemplatePreview> {
  return aiRequest<TemplatePreview>('/templates/preview', 'POST', input)
}
