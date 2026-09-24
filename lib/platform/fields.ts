/**
 * Fields Configuration reads and writes.
 *
 * ── `tables` IS AN ALLOWLIST, NOT A CONVENIENCE ─────────────────────────────
 *
 * The server refuses any `table_name` outside `config('platform_services.custom_field_tables')`,
 * so this list is not just what the dropdown offers — it is the complete set of records
 * a field can be attached to. Rendering a free-text input here would produce a form that
 * looks like it works and is refused on save.
 *
 * ── `editable: false` MEANS PLATFORM-WIDE ───────────────────────────────────
 *
 * A `common_to_all` field belongs to the platform, not to this organisation. It is
 * returned so it can be seen — a field visible on a form but absent from this screen
 * reads as a bug — and marked uneditable so nobody tries to change it for everybody.
 */

import { platformRequest } from './client'
import type { RegistryOption } from './workflow'

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'checkbox' | 'dropdown' | 'file'

/** The types that carry a list of options. */
export const OPTION_FIELD_TYPES: FieldType[] = ['checkbox', 'dropdown']

export interface FieldOption {
  id?: number
  display_text: string
  display_value: string
}

export interface CustomField {
  id: number
  table_name: string
  table_alias: string | null
  field_name: string
  field_label: string
  column_header: string | null
  field_type: FieldType
  field_message: string | null
  user_type: string | null
  required: boolean
  common_to_all: boolean
  sort_order: number
  tab_sort_order: number | null
  file_size_max: string | null
  /** False for a platform-wide field. See the file note. */
  editable: boolean
  options: FieldOption[]
}

export interface FieldsPayload {
  installed: boolean
  tables: RegistryOption[]
  rows: CustomField[]
}

export interface FieldInput {
  table_name?: string
  field_name?: string
  field_label?: string
  column_header?: string
  field_type?: FieldType
  field_message?: string
  user_type?: string
  file_size_max?: string
  required?: boolean
  sort_order?: number
  tab_sort_order?: number | null
  options?: FieldOption[]
}

export function fetchCustomFields(): Promise<FieldsPayload> {
  return platformRequest<FieldsPayload>('/fields')
}

export function createCustomField(input: FieldInput): Promise<{ id: number }> {
  return platformRequest<{ id: number }>('/fields', undefined, { method: 'POST', body: input })
}

export function updateCustomField(id: number, input: FieldInput): Promise<{ id: number }> {
  return platformRequest<{ id: number }>(`/fields/${id}`, undefined, { method: 'PUT', body: input })
}

export function deleteCustomField(id: number): Promise<{ deleted: number }> {
  return platformRequest<{ deleted: number }>(`/fields/${id}`, undefined, { method: 'DELETE' })
}
