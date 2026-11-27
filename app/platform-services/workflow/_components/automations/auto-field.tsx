'use client'

import { useId, type ReactNode } from 'react'
import type { FieldControlProps } from '@/components/shared/scaffolds/form-field'
import { FIELD_ERROR_TEXT } from '@/lib/workflows/tones'
import { cn } from '@/lib/utils'

/**
 * A labelled field whose error is announced. It does what the shared Field does (the label, the hint and the error are tied to the control, which is
 * marked invalid while there is an error), and the error is a `role="alert"` in a dark red that passes 4.5:1: the shared Field's message appears silently
 * in a 3.97:1 red. It is the same local copy the organisation form keeps (components/domain/crm/org-account-edit-form.tsx), for the same reason, and the
 * shared Field is left as it is.
 */
export function AutoField({ label, required, hint, error, wide, children }: {
  label: string
  required?: boolean
  hint?: ReactNode
  error?: string
  wide?: boolean
  children: (control: FieldControlProps) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', wide && 'sm:col-span-2')}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span aria-hidden="true" className="ml-0.5 text-primary">*</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required ? true : undefined })}
      {hint && <p id={hintId} className="break-words text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={errorId} role="alert" className={cn('break-words text-xs', FIELD_ERROR_TEXT)}>{error}</p>}
    </div>
  )
}
