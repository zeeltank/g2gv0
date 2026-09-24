'use client'

/**
 * Fields Configuration.
 *
 * The extra fields this organisation needs on records the product ships.
 *
 * ── THE RECORD DROPDOWN IS AN ALLOWLIST ─────────────────────────────────────
 *
 * It is populated from the server, and the server refuses any table outside that list.
 * A free-text input here would produce a form that looks like it works and is refused
 * on save — which is exactly what LMS K-12's equivalent does, except that there the
 * server accepts it and runs `ALTER TABLE` on whatever was typed.
 *
 * ── THREE FIELDS CANNOT BE EDITED, AND THE FORM SAYS SO ─────────────────────
 *
 * The record, the field name and the type are fixed once created, because each one
 * changes what already-captured values MEAN. Renaming a field orphans its data; turning
 * a text field into a dropdown makes every existing value invalid. Delete and re-create
 * is the honest path precisely because it makes that loss visible.
 */

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'

import { describePlatformError, PlatformApiError } from '@/lib/platform/client'
import {
  createCustomField,
  deleteCustomField,
  fetchCustomFields,
  updateCustomField,
  OPTION_FIELD_TYPES,
  type CustomField,
  type FieldOption,
  type FieldsPayload,
  type FieldType,
} from '@/lib/platform/fields'

import { PanelError, PanelLoading, RefreshButton, StaleNotice } from '../_components/console-parts'
import { ServiceShell } from '../_components/ServiceShell'

const TYPES: FieldType[] = ['text', 'textarea', 'number', 'date', 'checkbox', 'dropdown', 'file']

interface FieldForm {
  id: number | null
  table_name: string
  field_name: string
  field_label: string
  field_type: FieldType
  field_message: string
  required: boolean
  sort_order: number
  options: FieldOption[]
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'

export default function FieldsConfigurationPage() {
  const [data, setData] = useState<FieldsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)

  const [form, setForm] = useState<FieldForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchCustomFields()
      .then((next) => {
        if (cancelled) return
        setData(next)
        setError(null)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(describePlatformError(cause, 'The custom fields could not be loaded.'))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const reload = useCallback(() => {
    setLoading(true)
    setToken((value) => value + 1)
  }, [])

  const startNew = () => {
    setFormError(null)
    setForm({
      id: null,
      table_name: data?.tables[0]?.key ?? '',
      field_name: '',
      field_label: '',
      field_type: 'text',
      field_message: '',
      required: false,
      sort_order: (data?.rows.length ?? 0) + 1,
      options: [],
    })
  }

  const startEdit = (field: CustomField) => {
    setFormError(null)
    setForm({
      id: field.id,
      table_name: field.table_name,
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      field_message: field.field_message ?? '',
      required: field.required,
      sort_order: field.sort_order,
      options: field.options.map((option) => ({ ...option })),
    })
  }

  const save = async () => {
    if (!form) return

    setSaving(true)
    setFormError(null)

    try {
      const payload = {
        table_name: form.table_name,
        field_name: form.field_name,
        field_label: form.field_label,
        field_type: form.field_type,
        field_message: form.field_message,
        required: form.required,
        sort_order: form.sort_order,
        options: OPTION_FIELD_TYPES.includes(form.field_type) ? form.options : undefined,
      }

      if (form.id === null) {
        await createCustomField(payload)
      } else {
        await updateCustomField(form.id, payload)
      }

      setForm(null)
      setNotice(form.id === null ? 'Field added.' : 'Field saved.')
      reload()
    } catch (cause: unknown) {
      setFormError(
        cause instanceof PlatformApiError ? cause.message : describePlatformError(cause),
      )
    } finally {
      setSaving(false)
    }
  }

  const remove = async (field: CustomField) => {
    if (
      !window.confirm(
        `Remove "${field.field_label}"? Values already captured against it are kept, but the field stops appearing on the form.`,
      )
    ) {
      return
    }

    try {
      await deleteCustomField(field.id)
      setNotice('Field removed.')
      reload()
    } catch (cause: unknown) {
      setError(describePlatformError(cause))
    }
  }

  const needsOptions = form !== null && OPTION_FIELD_TYPES.includes(form.field_type)

  return (
    <ServiceShell slug="fields-configuration">
      <div className="mt-6 space-y-4">
        {error && !data && <PanelError message={error} onRetry={reload} />}
        {error && data && <StaleNotice message={error} onRetry={reload} />}
        {loading && !data && !error && <PanelLoading label="Loading custom fields…" />}

        {notice && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="size-4 shrink-0" />
            {notice}
          </div>
        )}

        {data && !data.installed && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">Custom fields are not installed here.</span>{' '}
            <span className="font-mono">tblcustom_fields</span> does not exist on this database.
          </div>
        )}

        {data?.installed && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {data.rows.length} field{data.rows.length === 1 ? '' : 's'} across{' '}
                {data.tables.length} record{data.tables.length === 1 ? '' : 's'}.
              </p>
              <div className="flex gap-2">
                <RefreshButton onClick={reload} busy={loading} />
                <button
                  type="button"
                  onClick={startNew}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Plus className="size-3.5" />
                  Add field
                </button>
              </div>
            </div>

            {form && (
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold text-card-foreground">
                    {form.id === null ? 'New field' : `Edit ${form.field_label}`}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setForm(null)}
                    aria-label="Close"
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {formError && (
                  <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {formError}
                  </p>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      Record{form.id !== null && ' (cannot be changed)'}
                    </span>
                    <select
                      value={form.table_name}
                      disabled={form.id !== null}
                      onChange={(event) => setForm({ ...form, table_name: event.target.value })}
                      className={inputClass}
                    >
                      {data.tables.map((table) => (
                        <option key={table.key} value={table.key}>
                          {table.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      Field name{form.id !== null && ' (cannot be changed)'}
                    </span>
                    <input
                      value={form.field_name}
                      disabled={form.id !== null}
                      onChange={(event) => setForm({ ...form, field_name: event.target.value })}
                      placeholder="employee_grade"
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      Type{form.id !== null && ' (cannot be changed)'}
                    </span>
                    <select
                      value={form.field_type}
                      disabled={form.id !== null}
                      onChange={(event) =>
                        setForm({ ...form, field_type: event.target.value as FieldType })
                      }
                      className={inputClass}
                    >
                      {TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      Label shown on the form
                    </span>
                    <input
                      value={form.field_label}
                      onChange={(event) => setForm({ ...form, field_label: event.target.value })}
                      placeholder="Employee grade"
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      Helper text
                    </span>
                    <input
                      value={form.field_message}
                      onChange={(event) => setForm({ ...form, field_message: event.target.value })}
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      Sort order
                    </span>
                    <input
                      type="number"
                      value={form.sort_order}
                      onChange={(event) =>
                        setForm({ ...form, sort_order: Number(event.target.value) })
                      }
                      className={inputClass}
                    />
                  </label>

                  <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
                    <input
                      type="checkbox"
                      checked={form.required}
                      onChange={(event) => setForm({ ...form, required: event.target.checked })}
                      className="size-3.5"
                    />
                    Required — the form cannot be submitted without it
                  </label>
                </div>

                {needsOptions && (
                  <OptionEditor
                    options={form.options}
                    type={form.field_type}
                    onChange={(options) => setForm({ ...form, options })}
                  />
                )}

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="size-3.5 animate-spin" />}
                    {saving ? 'Saving…' : 'Save field'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(null)}
                    className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            )}

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <Th>Field</Th>
                    <Th>Record</Th>
                    <Th>Type</Th>
                    <Th>Required</Th>
                    <Th>Order</Th>
                    <Th> </Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No custom fields yet.
                      </td>
                    </tr>
                  )}

                  {data.rows.map((field) => (
                    <tr key={field.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-3 py-2.5 align-top">
                        <p className="font-medium text-card-foreground">{field.field_label}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {field.field_name}
                        </p>
                        {field.options.length > 0 && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {field.options.length} option
                            {field.options.length === 1 ? '' : 's'}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs text-muted-foreground">
                        {data.tables.find((t) => t.key === field.table_name)?.label ??
                          field.table_name}
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs">
                        <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {field.field_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs text-muted-foreground">
                        {field.required ? 'Yes' : 'No'}
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs tabular-nums text-muted-foreground">
                        {field.sort_order}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {/* A platform-wide field is not this organisation's to change,
                            and saying so beats greying out two buttons with no reason. */}
                        {field.editable ? (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(field)}
                              aria-label={`Edit ${field.field_label}`}
                              className="rounded border border-border p-1 transition-colors hover:bg-muted"
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(field)}
                              aria-label={`Remove ${field.field_label}`}
                              className="rounded border border-border p-1 transition-colors hover:bg-muted"
                            >
                              <Trash2 className="size-3 text-destructive" />
                            </button>
                          </div>
                        ) : (
                          <span className="block text-right text-[11px] text-muted-foreground">
                            Platform-wide
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </ServiceShell>
  )
}

function OptionEditor({
  options,
  type,
  onChange,
}: {
  options: FieldOption[]
  type: FieldType
  onChange: (next: FieldOption[]) => void
}) {
  return (
    <div className="mt-4 rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-semibold text-card-foreground">Options</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        A {type} field needs at least one. The label is what a person sees; the value is what
        gets stored.
      </p>

      <div className="mt-3 space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={option.display_text}
              onChange={(event) =>
                onChange(
                  options.map((o, i) =>
                    i === index ? { ...o, display_text: event.target.value } : o,
                  ),
                )
              }
              placeholder="Label"
              className={inputClass}
            />
            <input
              value={option.display_value}
              onChange={(event) =>
                onChange(
                  options.map((o, i) =>
                    i === index ? { ...o, display_value: event.target.value } : o,
                  ),
                )
              }
              placeholder="Stored value"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => onChange(options.filter((_, i) => i !== index))}
              aria-label="Remove option"
              className="shrink-0 rounded border border-border p-1.5 transition-colors hover:bg-muted"
            >
              <Trash2 className="size-3 text-destructive" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...options, { display_text: '', display_value: '' }])}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        <Plus className="size-3.5" />
        Add an option
      </button>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase">
      {children}
    </th>
  )
}
