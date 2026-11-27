'use client'

import { useId, type ReactNode } from 'react'
import { Input, inputVariants } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FIELD_ERROR_TEXT } from '@/lib/org-accounts/tones'
import { cn } from '@/lib/utils'

/*
 * The small parts the Sales Kit's dialogs share: a failed call in words, the per-field sentences of a refused form, and a labelled box whose error is tied to it and drawn in the dark red
 * the other forms use (the status red as text fails contrast on a card).
 */

const NETWORK_TEXT = 'The server could not be reached. Check your connection and try again.'

/** A failed call in words. No status code is ever shown; the server's own sentence is kept where it gave one. */
export function kitErrorText(cause: unknown, fallback: string): string {
  const status = (cause as { status?: unknown } | null)?.status
  if (status === 403) return 'You are not allowed to do this. Ask an administrator if you need access.'
  if (status === 413) return 'That file is bigger than the server accepts.'
  const full = (cause as { fullMessage?: unknown } | null)?.fullMessage
  const message = (typeof full === 'string' && full.trim() !== '' ? full : cause instanceof Error ? cause.message : '').trim()
  if (typeof status === 'number') return message || fallback

  return cause instanceof TypeError ? NETWORK_TEXT : (message || fallback)
}

/** The per-field sentences of a refused form (a 422), so each can be shown under its own box. */
export function kitFieldErrors(cause: unknown): Record<string, string> {
  const errors = (cause as { errors?: unknown } | null)?.errors
  if (!errors || typeof errors !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [field, raw] of Object.entries(errors as Record<string, unknown>)) {
    const text = (Array.isArray(raw) ? raw : [raw]).filter((part): part is string => typeof part === 'string' && part !== '').join(' ')
    if (text) out[field] = text
  }

  return out
}

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  return [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
}

function FieldFrame({ id, label, required, hint, error, children }: { id: string; label: string; required?: boolean; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required ? ' *' : ''}</Label>
      {children}
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} className={`text-xs ${FIELD_ERROR_TEXT}`}>{error}</p>}
    </div>
  )
}

export function KitTextField({ label, value, onChange, error, hint, required = false, multiline = false, rows = 3, autoFocus = false, disabled = false, placeholder }: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  required?: boolean
  multiline?: boolean
  rows?: number
  autoFocus?: boolean
  disabled?: boolean
  placeholder?: string
}) {
  const id = useId()
  const shared = { id, value, placeholder, disabled, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy(id, hint, error), 'aria-required': required ? true : undefined }

  return (
    <FieldFrame id={id} label={label} required={required} hint={hint} error={error}>
      {multiline
        ? <Textarea rows={rows} autoFocus={autoFocus} onChange={(event) => onChange(event.target.value)} {...shared} />
        : <Input autoFocus={autoFocus} onChange={(event) => onChange(event.target.value)} {...shared} />}
    </FieldFrame>
  )
}

export function KitSelectField({ label, value, onChange, options, error, hint, disabled = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<{ value: string; label: string }>
  error?: string
  hint?: string
  disabled?: boolean
}) {
  const id = useId()

  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(inputVariants({}), 'pr-8 disabled:cursor-not-allowed disabled:opacity-60')}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </FieldFrame>
  )
}

/** A refusal that belongs to no box: the whole form's alert. */
export function KitFormAlert({ text }: { text: string }) {
  return <p role="alert" className="rounded-lg border border-destructive bg-card p-3 text-sm text-foreground">{text}</p>
}
