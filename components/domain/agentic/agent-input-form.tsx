'use client'

/**
 * Renders an agent's declared fields as a form.
 *
 * Agents do not share an input contract. The Excel agent takes a spreadsheet,
 * the SEO agent a URL and an analysis mode, the marketing agent a business
 * type, an audience and a goal. Rather than a hand-built screen per agent,
 * each agent carries an `input_schema` and this renders it — so adding a field
 * or an option is a data change, not a release.
 *
 * The server validates the same schema on the way in; this exists to catch
 * mistakes before a round trip, not instead of that check.
 */

import { useState } from 'react'
import { X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { FileUpload } from '@/components/ui/file-upload'
import { cn } from '@/lib/utils'
import type { AgentField, AgentInputValues } from '@/services/agentic'

interface AgentInputFormProps {
  schema: AgentField[]
  values: AgentInputValues
  errors: Record<string, string>
  onChange: (name: string, value: unknown) => void
  /** Files are held separately from values — they cannot round-trip as JSON. */
  onFileChange?: (name: string, file: File | null) => void
  files?: Record<string, File>
  /** Field names already stored server-side, shown as "set" instead of blank. */
  alreadySet?: string[]
  disabled?: boolean
  columns?: 1 | 2
}

/** Seed a value map from a schema's declared defaults. */
export function defaultsFor(schema: AgentField[]): AgentInputValues {
  const values: AgentInputValues = {}

  for (const field of schema) {
    if (field.default !== undefined && field.default !== null) {
      values[field.name] = field.default
    } else if (field.type === 'boolean') {
      values[field.name] = false
    } else if (field.type === 'multiselect' || field.type === 'tags') {
      values[field.name] = []
    }
  }

  return values
}

/**
 * Client-side mirror of the server's required check.
 *
 * Only "required" is duplicated: type and range rules stay server-side so
 * there is one source of truth for them, and a required field is the one
 * mistake worth catching without a round trip.
 */
export function validateAgainstSchema(
  schema: AgentField[],
  values: AgentInputValues,
  files: Record<string, File> = {},
  alreadySet: string[] = [],
): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const field of schema) {
    if (!field.required) continue

    if (field.type === 'file') {
      if (!files[field.name] && !alreadySet.includes(field.name)) {
        errors[field.name] = `${field.label} is required.`
      }
      continue
    }

    const value = values[field.name]
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)

    if (empty) errors[field.name] = `${field.label} is required.`
  }

  return errors
}

export function AgentInputForm({
  schema,
  values,
  errors,
  onChange,
  onFileChange,
  files = {},
  alreadySet = [],
  disabled = false,
  columns = 2,
}: AgentInputFormProps) {
  if (schema.length === 0) return null

  return (
    <div className={cn('grid grid-cols-1 gap-4', columns === 2 && 'md:grid-cols-2')}>
      {schema.map((field) => (
        <Field
          key={field.name}
          field={field}
          value={values[field.name]}
          error={errors[field.name]}
          file={files[field.name] ?? null}
          isSet={alreadySet.includes(field.name)}
          onChange={onChange}
          onFileChange={onFileChange}
          disabled={disabled}
          columns={columns}
        />
      ))}
    </div>
  )
}

interface FieldProps {
  field: AgentField
  value: unknown
  error?: string
  file: File | null
  isSet: boolean
  onChange: (name: string, value: unknown) => void
  onFileChange?: (name: string, file: File | null) => void
  disabled: boolean
  columns: 1 | 2
}

function Field({ field, value, error, file, isSet, onChange, onFileChange, disabled, columns }: FieldProps) {
  const id = `agent-field-${field.name}`

  // Long-form inputs read badly in half a row.
  const fullWidth =
    columns === 2 && ['textarea', 'file', 'multiselect', 'tags'].includes(field.type)

  return (
    <div className={cn('space-y-2', fullWidth && 'md:col-span-2')}>
      <label className="text-sm font-semibold text-foreground" htmlFor={id}>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </label>

      <Control
        id={id}
        field={field}
        value={value}
        file={file}
        isSet={isSet}
        onChange={onChange}
        onFileChange={onFileChange}
        disabled={disabled}
      />

      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  )
}

function Control({
  id,
  field,
  value,
  file,
  isSet,
  onChange,
  onFileChange,
  disabled,
}: Omit<FieldProps, 'error' | 'columns'> & { id: string }) {
  const options = field.options ?? []

  switch (field.type) {
    case 'textarea':
      return (
        <Textarea
          id={id}
          value={String(value ?? '')}
          onChange={(event) => onChange(field.name, event.target.value)}
          placeholder={field.placeholder}
          rows={field.rows ?? 3}
          disabled={disabled}
          className="border-border bg-background"
        />
      )

    case 'number':
      return (
        <Input
          id={id}
          type="number"
          value={value === undefined || value === null ? '' : String(value)}
          min={field.min}
          max={field.max}
          // Blank stays blank rather than collapsing to 0, so an optional
          // number can be genuinely left unanswered.
          onChange={(event) =>
            onChange(field.name, event.target.value === '' ? '' : Number(event.target.value))
          }
          placeholder={field.placeholder}
          disabled={disabled}
          className="border-border bg-background"
        />
      )

    case 'select':
      return (
        <Select
          value={String(value ?? '')}
          onChange={(next) => onChange(field.name, next)}
          options={
            field.required
              ? options
              : [{ value: '', label: field.placeholder ?? 'Not specified' }, ...options]
          }
          disabled={disabled}
          className="h-9 border-border bg-background"
          aria-label={field.label}
        />
      )

    case 'multiselect':
      return (
        <MultiSelect
          options={options}
          selected={Array.isArray(value) ? (value as string[]) : []}
          onChange={(next) => onChange(field.name, next)}
          disabled={disabled}
        />
      )

    case 'tags':
      return (
        <TagInput
          tags={Array.isArray(value) ? (value as string[]) : []}
          onChange={(next) => onChange(field.name, next)}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      )

    case 'boolean':
      return (
        <label className="flex cursor-pointer items-center gap-2.5 pt-1">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(field.name, checked)}
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground">
            {field.placeholder ?? 'Enabled'}
          </span>
        </label>
      )

    case 'file':
      return (
        <div className="space-y-1.5">
          <FileUpload
            accept={field.accept}
            disabled={disabled}
            onFileSelect={(selected) => onFileChange?.(field.name, selected)}
            hint={field.accept ? `${field.accept} files` : undefined}
          />
          {/* A stored secret file cannot be shown back, so say it is set
              rather than rendering an empty control that looks unsaved. */}
          {!file && isSet && (
            <p className="text-xs font-medium text-muted-foreground">
              A file is already saved. Choose another only to replace it.
            </p>
          )}
        </div>
      )

    case 'date':
      return (
        <Input
          id={id}
          type="date"
          value={String(value ?? '')}
          onChange={(event) => onChange(field.name, event.target.value)}
          disabled={disabled}
          className="border-border bg-background"
        />
      )

    default:
      return (
        <Input
          id={id}
          type={field.type === 'password' ? 'password' : field.type === 'email' ? 'email' : 'text'}
          value={String(value ?? '')}
          onChange={(event) => onChange(field.name, event.target.value)}
          placeholder={field.placeholder}
          maxLength={field.max_length}
          disabled={disabled}
          className={cn('border-border bg-background', field.type === 'url' && 'font-mono text-xs')}
        />
      )
  }
}

/** Toggle chips — clearer than a multi-select listbox at these list sizes. */
function MultiSelect({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = selected.includes(option.value)

        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() =>
              onChange(
                active ? selected.filter((item) => item !== option.value) : [...selected, option.value],
              )
            }
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:bg-accent',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Free-form list: type and press Enter. Backspace on empty removes the last. */
function TagInput({
  tags,
  onChange,
  placeholder,
  disabled,
}: {
  tags: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled: boolean
}) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const value = draft.trim()
    if (!value) return
    if (!tags.includes(value)) onChange([...tags, value])
    setDraft('')
  }

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            commit()
            return
          }

          if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
            onChange(tags.slice(0, -1))
          }
        }}
        onBlur={commit}
        placeholder={placeholder ?? 'Type and press Enter'}
        disabled={disabled}
        className="border-border bg-background"
      />

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground"
            >
              {tag}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(tags.filter((item) => item !== tag))}
                aria-label={`Remove ${tag}`}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
