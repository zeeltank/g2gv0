'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { LibraryPayload, LibraryRow } from '@/services/competency'

import { FORM_KEY_OVERRIDES, type LibraryFieldDef, type LibraryTabConfig } from './library-config'

interface LibraryFormProps {
  config: LibraryTabConfig
  /** null when creating. */
  initial: LibraryRow | null
  saving: boolean
  categories: string[]
  subCategoriesOf: (category: string) => string[]
  onSubmit: (payload: LibraryPayload) => Promise<{ ok: boolean; message: string }>
  onCancel: () => void
  onSaved: () => void
}

function initialValues(config: LibraryTabConfig, initial: LibraryRow | null): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of config.fields) {
    const raw = initial?.[field.key]
    values[field.key] = raw === null || raw === undefined ? '' : String(raw)
  }
  return values
}

/**
 * Create / edit form for any library tab.
 *
 * The field list comes from the tab config, so all eight tabs share one form
 * and a new column is one config entry rather than a new screen.
 */
export function LibraryForm({
  config,
  initial,
  saving,
  categories,
  subCategoriesOf,
  onSubmit,
  onCancel,
  onSaved,
}: LibraryFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(config, initial))
  const [error, setError] = useState<string | null>(null)

  const editing = Boolean(initial)
  const editable = useMemo(() => config.fields.filter((field) => !field.readOnly), [config])

  const categoryValue = config.categoryKey ? values[config.categoryKey] ?? '' : ''

  const set = (key: string, value: string) => {
    setValues((current) => {
      const next = { ...current, [key]: value }
      // A sub-category only means something under its parent, so changing the
      // category clears it rather than leaving an orphaned pair.
      if (config.categoryKey && key === config.categoryKey && config.subCategoryKey) {
        next[config.subCategoryKey] = ''
      }
      return next
    })
  }

  const optionsFor = (field: LibraryFieldDef): { label: string; value: string }[] => {
    if (field.taxonomy === 'category') {
      const list = categories
      // Keep the current value selectable even if the taxonomy has not loaded.
      const current = values[field.key]
      const merged = current && !list.includes(current) ? [current, ...list] : list
      return [{ label: `Select ${field.label.toLowerCase()}`, value: '' }, ...merged.map((c) => ({ label: c, value: c }))]
    }

    if (field.taxonomy === 'sub_category') {
      const list = categoryValue ? subCategoriesOf(categoryValue) : []
      const current = values[field.key]
      const merged = current && !list.includes(current) ? [current, ...list] : list
      return [{ label: categoryValue ? 'Select sub category' : 'Pick a category first', value: '' }, ...merged.map((c) => ({ label: c, value: c }))]
    }

    return [
      { label: `Select ${field.label.toLowerCase()}`, value: '' },
      ...(field.options ?? []).map((option) => ({ label: option, value: option })),
    ]
  }

  const handleSubmit = async () => {
    for (const field of editable) {
      if (field.required && !values[field.key]?.trim()) {
        setError(`${field.label} is required.`)
        return
      }
    }
    setError(null)

    const overrides = FORM_KEY_OVERRIDES[config.id] ?? {}
    const payload: LibraryPayload = {}

    for (const field of editable) {
      const value = (values[field.key] ?? '').trim()
      const original = initial?.[field.key]
      const originalText = original === null || original === undefined ? '' : String(original)

      // On edit only send what changed, so a partial form never blanks a column
      // it did not show. On create send everything that has a value.
      if (editing ? value === originalText : value === '') continue

      payload[overrides[field.key] ?? field.key] = value
    }

    if (editing && Object.keys(payload).length === 0) {
      setError('Nothing has changed yet.')
      return
    }

    const result = await onSubmit(payload)
    if (result.ok) onSaved()
    else setError(result.message)
  }

  return (
    <>
      <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
        <DialogTitle className="text-xl font-bold text-foreground">
          {editing ? `Edit ${config.singular}` : `Add ${config.singular}`}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {editing
            ? 'Only the fields you change are saved.'
            : `Add a new entry to the ${config.plural.toLowerCase()} library.`}
        </DialogDescription>
      </DialogHeader>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[65vh] overflow-y-auto g2g-scrollbar">
        {editable.map((field) => {
          const isWide = field.type === 'textarea'
          return (
            <div key={field.key} className={isWide ? 'md:col-span-2 space-y-2' : 'space-y-2'}>
              <label className="text-sm font-semibold text-foreground" htmlFor={`lib-${field.key}`}>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </label>

              {field.type === 'textarea' ? (
                <Textarea
                  id={`lib-${field.key}`}
                  value={values[field.key] ?? ''}
                  onChange={(event) => set(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className="bg-background border-border min-h-[90px]"
                />
              ) : field.type === 'select' || field.taxonomy ? (
                <Select
                  id={`lib-${field.key}`}
                  value={values[field.key] ?? ''}
                  onChange={(value) => set(field.key, value)}
                  options={optionsFor(field)}
                  disabled={field.taxonomy === 'sub_category' && !categoryValue}
                  className="bg-background border-border h-9"
                  aria-label={field.label}
                />
              ) : (
                <Input
                  id={`lib-${field.key}`}
                  type={field.type === 'url' ? 'url' : 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(event) => set(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className="bg-background border-border"
                />
              )}

              {/* Without this the dropdown is an empty box with no way forward. */}
              {field.taxonomy === 'category' && categories.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No {field.label.toLowerCase()} defined yet — add one from the Taxonomy panel first.
                </p>
              ) : (
                field.help && <p className="text-xs text-muted-foreground">{field.help}</p>
              )}
            </div>
          )
        })}

        {error && <p className="md:col-span-2 text-sm font-medium text-destructive">{error}</p>}
      </div>

      <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="h-9 px-6 rounded-lg font-bold border-border bg-background"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="h-9 px-6 rounded-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? 'Saving…' : editing ? 'Save Changes' : `Add ${config.singular}`}
        </Button>
      </DialogFooter>
    </>
  )
}
