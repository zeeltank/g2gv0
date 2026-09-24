'use client'

/**
 * The organisation's own fields on the employee record.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS IS WHAT MAKES FIELDS CONFIGURATION A FEATURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Defining a field and never rendering it is a row in a table. Until this
 * existed, the Platform Services console could describe a field in detail and no
 * employee would ever see it — which is the state LMS K-12 is in for staff
 * records to this day: it serves the definitions from `UserManagementApiController`
 * and has no screen that reads them.
 *
 * ── IT RENDERS NOTHING WHEN NOTHING IS DEFINED ──────────────────────────────
 *
 * Most organisations define no custom fields, and an always-present "Custom
 * fields" heading over an empty panel is clutter on every employee record in the
 * product. The section appears only when the tenant has actually configured
 * something.
 *
 * ── CONTROLLED, NOT SELF-SAVING ─────────────────────────────────────────────
 *
 * The values live in the parent so one "Save changes" writes the profile and
 * these together. A second Save button beside the first would ask somebody to
 * understand that the employee record has two halves that persist separately —
 * and the failure mode of forgetting the second one is silent data loss.
 */

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { toDateOnly, fromDateOnly } from '@/lib/date-only'
import { describePlatformError } from '@/lib/platform/client'
import {
  fetchCustomFieldForm,
  type CustomFieldEntry,
} from '@/lib/platform/custom-field-values'

export function CustomFieldsSection({
  recordTable,
  recordId,
  values,
  onChange,
  onFieldsLoaded,
}: {
  recordTable: string
  recordId: number
  values: Record<number, string | null>
  onChange: (next: Record<number, string | null>) => void
  /** Tells the parent whether there is anything here, so it can show the tab. */
  onFieldsLoaded?: (fields: CustomFieldEntry[]) => void
}) {
  const [fields, setFields] = useState<CustomFieldEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recordId) return

    let cancelled = false

    fetchCustomFieldForm(recordTable, recordId)
      .then((form) => {
        if (cancelled) return
        setFields(form.fields)
        setError(null)
        onFieldsLoaded?.(form.fields)

        /*
         * Seed the parent with what is stored, so an untouched field saves back
         * the value it already had rather than null. Without this, opening the
         * record and pressing Save would blank every custom field the parent had
         * no entry for.
         */
        const seeded: Record<number, string | null> = {}
        for (const field of form.fields) seeded[field.id] = field.value
        onChange(seeded)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(describePlatformError(cause, 'The custom fields could not be loaded.'))
        setFields([])
      })

    return () => {
      cancelled = true
    }
    // The callbacks are deliberately not dependencies: they are recreated every
    // parent render, and including them would refetch on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordTable, recordId])

  if (fields === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading this organisation&rsquo;s fields…
      </div>
    )
  }

  if (error) {
    /*
     * A strip, not a replacement for the tab.
     *
     * These fields are additional to the employee record; failing to load them
     * must not stop somebody editing the name and address that did load.
     */
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{error} The rest of this record can still be saved.</span>
      </div>
    )
  }

  if (fields.length === 0) return null

  const set = (id: number, value: string | null) => onChange({ ...values, [id]: value })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const value = values[field.id] ?? ''

        return (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={`cf-${field.id}`}>
              {field.field_label}
              {field.required && <span className="ml-0.5 text-destructive">*</span>}
            </Label>

            {field.field_type === 'dropdown' ? (
              /* The house Select takes `options` and hands back the value itself —
                 it is not a native <select>, so children and `event.target` do not
                 apply. */
              <Select
                id={`cf-${field.id}`}
                value={value}
                placeholder="Not set"
                onChange={(next) => set(field.id, next || null)}
                options={field.options.map((option) => ({
                  label: option.display_text,
                  value: option.display_value,
                }))}
              />
            ) : field.field_type === 'checkbox' ? (
              /*
               * A checkbox field stores one of its declared option values, not a
               * boolean — that is what the options table is for. Rendered as a
               * group so the stored value keeps meaning what the administrator
               * configured rather than being coerced to true/false.
               */
              <div className="space-y-1">
                {field.options.map((option) => (
                  <label
                    key={option.display_value}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      className="size-3.5"
                      checked={value === option.display_value}
                      onChange={(event) =>
                        set(field.id, event.target.checked ? option.display_value : null)
                      }
                    />
                    {option.display_text}
                  </label>
                ))}
              </div>
            ) : field.field_type === 'date' ? (
              <DatePicker
                value={fromDateOnly(value) ?? undefined}
                onChange={(date) => set(field.id, date ? toDateOnly(date) : null)}
              />
            ) : field.field_type === 'textarea' ? (
              <textarea
                id={`cf-${field.id}`}
                value={value}
                onChange={(event) => set(field.id, event.target.value || null)}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            ) : (
              <Input
                id={`cf-${field.id}`}
                type={field.field_type === 'number' ? 'number' : 'text'}
                value={value}
                onChange={(event) => set(field.id, event.target.value || null)}
              />
            )}

            {field.field_message && (
              <p className="text-xs text-muted-foreground">{field.field_message}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
