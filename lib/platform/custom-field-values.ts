/**
 * The answers to an organisation's custom fields, for one record.
 *
 * ── WHY THIS IS SEPARATE FROM `lib/platform/fields.ts` ──────────────────────
 *
 * That file is the DEFINITIONS — what fields exist, managed on the Platform
 * Services console by an administrator. This one is the ANSWERS, read and written
 * by whatever form renders the record. They are different endpoints, different
 * audiences, and eventually different permissions, so a single module would mean
 * the employee form importing the administrator's create/delete calls.
 */

import { platformRequest } from './client'

/** A field as a form needs it: the definition, plus this record's answer. */
export interface CustomFieldEntry {
  id: number
  field_name: string
  field_label: string
  field_type: string
  field_message: string | null
  required: boolean
  sort_order: number
  options: { display_text: string; display_value: string }[]
  /** Null means unanswered. */
  value: string | null
}

export interface CustomFieldForm {
  record_table: string
  record_id: number
  fields: CustomFieldEntry[]
}

export interface SaveResult {
  saved: number
  /**
   * Field ids the server declined to store — a stale form naming a field that has
   * since been deleted, or one belonging to another record type or organisation.
   * Reported rather than swallowed so the screen does not claim a full save.
   */
  ignored: number[]
}

export function fetchCustomFieldForm(
  recordTable: string,
  recordId: number,
): Promise<CustomFieldForm> {
  return platformRequest<CustomFieldForm>(`/fields/values/${recordTable}/${recordId}`)
}

export function saveCustomFieldValues(
  recordTable: string,
  recordId: number,
  values: Record<number, string | null>,
): Promise<SaveResult> {
  return platformRequest<SaveResult>(`/fields/values/${recordTable}/${recordId}`, undefined, {
    method: 'POST',
    body: { values },
  })
}
