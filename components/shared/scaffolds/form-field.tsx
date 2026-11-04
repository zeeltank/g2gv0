'use client'

import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { inputVariants } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** What a control needs from its field: put these on the input, textarea or select. */
export interface FieldControlProps {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
  'aria-required'?: true
}

/**
 * A labelled form field. It gives the control an id, ties the label, the hint and the error message to it (so a screen reader reads them when the
 * control gets focus), and marks it invalid while there is an error. The control comes from a function so any control can be used:
 *
 *   <Field label="Name" required error={errors.name}>{(control) => <Input {...control} value={name} onChange={…} />}</Field>
 *
 * The existing FormField in shared/business has no error and no wiring; this is its accessible replacement for new forms.
 */
export function Field({ label, children, hint, error, required, wide }: {
  label: string
  children: (control: FieldControlProps) => ReactNode
  hint?: ReactNode
  /** One message or several, usually from the server's answer to a save. */
  error?: string | readonly string[]
  required?: boolean
  /** Spans both columns of a form section. */
  wide?: boolean
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const messages = ([] as string[]).concat(error ?? []).filter(Boolean)
  const describedBy = [hint ? hintId : null, messages.length > 0 ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', wide && 'sm:col-span-2')}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span aria-hidden="true" className="ml-0.5 text-primary">*</span>}
      </label>
      {children({
        id,
        'aria-invalid': messages.length > 0 ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required ? true : undefined,
      })}
      {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {messages.length > 0 && <p id={errorId} className="text-xs text-destructive">{messages.join(' ')}</p>}
    </div>
  )
}

/**
 * A native select, styled like Input. A native control takes the field's error wiring (the app's custom Select does not) and needs nothing special
 * inside a drawer; use it for short lists. For a long list that needs a search box, use the app's Select.
 */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(inputVariants({}), 'pr-8 disabled:cursor-not-allowed disabled:opacity-60', className)} {...props}>
      {children}
    </select>
  ),
)
NativeSelect.displayName = 'NativeSelect'
