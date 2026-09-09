'use client'

import { cloneElement, isValidElement, useId, type ReactElement } from 'react'
import { Info } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/**
 * The pieces every settings section is built from.
 *
 * One block vocabulary across eleven sections, so a person who has learnt to
 * read Preferences can read Notifications without learning it again. This is the
 * whole reason they live in one file rather than being re-typed per section —
 * eleven near-copies is how two sections end up looking like two products.
 */

export function SectionBlock({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-background p-5', className)}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * A labelled control in a form grid.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE LABEL IS WIRED TO THE CONTROL, NOT JUST PLACED ABOVE IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This rendered `<Label>` and `{children}` as SIBLINGS in a plain div, with no
 * `htmlFor` and no id. `Label` emits a bare `<label>`, so it was associated with
 * nothing: every Input and Select across the whole settings area had no
 * accessible name. A screen reader announced "edit text, blank" for the field
 * holding somebody's mobile number, and clicking the word "Mobile" did not focus
 * anything.
 *
 * A generated id is cloned onto the child, and the hint becomes its
 * `aria-describedby`, so the explanation is read out with the field rather than
 * being visible-only. `useId` is used rather than a counter because it is stable
 * across server and client render - a hand-rolled id would mismatch on hydration.
 *
 * A child that is not a single element (two controls, a fragment) is left alone
 * and wrapped in a `<fieldset>`-style group instead, so this can never throw on
 * a shape it was not designed for.
 */
export function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: (children.props as Record<string, unknown>).id ?? id,
        'aria-describedby':
          (children.props as Record<string, unknown>)['aria-describedby'] ?? hintId,
        ...(required ? { 'aria-required': true } : {}),
      })
    : children

  return (
    <div className={className}>
      <Label
        htmlFor={isValidElement(children) ? id : undefined}
        className="mb-1.5 text-sm font-medium text-foreground"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {control}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * A switch with its own label and explanation, as one clickable row.
 *
 * The whole row is the target, not just the switch — a 20px hit area beside a
 * paragraph of text is how somebody toggles the wrong setting. Wrapping it in a
 * <label> gives that for free, and keeps the control and its name associated
 * for a screen reader without an id to keep in step.
 *
 * The switch itself is `components/ui/switch.tsx`, not a private copy. A
 * hand-rolled one here would be a SECOND switch implementation in the product,
 * and the two would drift the first time either is restyled.
 */
export function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-transparent px-3 py-3 transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted/50',
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && (
          <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
        )}
      </span>

      <Switch
        size="sm"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 shrink-0"
      />
    </label>
  )
}

/** A quiet explanatory line, for a fact rather than a warning. */
export function SectionHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
