'use client'

import { useId, type ReactNode, type Ref } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FIELD_ERROR_TEXT } from '@/lib/org-accounts/tones'

/**
 * One labelled box of a form, the same for every Outreach dialog: the label above, the box, a hint if there is one, and the sentence that says what is wrong under the box. The error is
 * tied to the box (`aria-describedby`, `aria-invalid`) so a screen reader reads it with the field, and it is drawn in the dark red the other forms use for errors.
 */
export function TextField({ label, value, onChange, error, hint, required = false, type = 'text', placeholder, multiline = false, rows = 3, autoFocus = false, disabled = false, maxLength, onFocus, inputRef }: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  required?: boolean
  type?: 'text' | 'email' | 'tel' | 'url'
  placeholder?: string
  multiline?: boolean
  rows?: number
  autoFocus?: boolean
  disabled?: boolean
  maxLength?: number
  onFocus?: () => void
  /** The box itself, for a caller that has to know where the caret is (the message form puts a merge word where the person was typing). */
  inputRef?: Ref<HTMLInputElement | HTMLTextAreaElement>
}) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  const shared = { id, value, placeholder, disabled, maxLength, onFocus, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required ? true : undefined }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required ? ' *' : ''}</Label>
      {multiline
        ? <Textarea rows={rows} autoFocus={autoFocus} onChange={(event) => onChange(event.target.value)} ref={inputRef as Ref<HTMLTextAreaElement>} {...shared} />
        : <Input type={type} autoFocus={autoFocus} onChange={(event) => onChange(event.target.value)} ref={inputRef as Ref<HTMLInputElement>} {...shared} />}
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} className={`text-xs ${FIELD_ERROR_TEXT}`}>{error}</p>}
    </div>
  )
}

/** A short block of words in a form that is not a field (a note under a switch, the question a dialog asks). */
export function FormNote({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

/** A refusal that belongs to no field: the whole form's alert. */
export function FormAlert({ text }: { text: string }) {
  return <p role="alert" className="rounded-lg border border-destructive bg-card p-3 text-sm text-foreground">{text}</p>
}
