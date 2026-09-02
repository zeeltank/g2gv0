'use client'

/**
 * ONE section wrapper, and ONE "Add" button, for the whole module.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * The workstream page grew five different affordances for the single verb
 * "Add": an outline button with a label (deliverables, metrics, risks), an
 * icon-only `h-7` outline (checkpoints), an icon-only `h-6` ghost
 * (dependencies), an `h-9` outline sitting *below* an input (statements), and
 * a bare Select with no button at all (contributors). Five answers to "how do
 * I add one of these?" on one screen is why the page reads as clumsy — the
 * user has to relearn the control in every panel.
 *
 * `SectionAddButton` is the single answer. `Section` is the single frame.
 *
 * ── WHY NOT `SectionCard` FROM components/shared/business ───────────────────
 *
 * That one exists and has a working `actions` slot, so reusing it was the
 * obvious move. It renders its title at `text-xl` inside `CardHeader` (p-6)
 * plus `CardContent` (p-6 pt-0), and its `className` reaches only the outer
 * `Card` — so its padding cannot be tightened from the call site.
 *
 * Adopting it would import a second type scale and 24px of padding into the
 * page whose entire problem is bulk. This keeps the rhythm the module already
 * proved: Card > CardContent p-5 > h2 text-base font-semibold tracking-tight.
 */

import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function Section({
  title, icon: Icon, actions, children, className, bodyClassName, flush,
}: {
  title: string
  icon?: React.ElementType
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /**
   * Render without the Card frame.
   *
   * A section nested inside another section must not draw a second border —
   * that nesting is what produced 40-60 visible borders on one screen.
   */
  flush?: boolean
}) {
  const body = (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
          <span className="truncate">{title}</span>
        </h2>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </>
  )

  if (flush) return <section className={className}>{body}</section>

  return (
    <Card className={className}>
      <CardContent className={cn('p-5')}>{body}</CardContent>
    </Card>
  )
}

/** The only "Add" control in the module. Label required — an icon alone made
 *  three of the five old variants unreadable without hovering. */
export function SectionAddButton({
  label, onClick, disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={disabled}>
      <Plus className="mr-1.5 size-3.5" />
      {label}
    </Button>
  )
}

/** A list that draws ONE set of dividers instead of a border per row. */
export function SectionList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('divide-y divide-border', className)}>{children}</ul>
}

/** Absence, rendered. Never a blank region the reader has to interpret. */
export function SectionEmpty({ children }: { children: ReactNode }) {
  return <p className="py-1 text-sm text-muted-foreground">{children}</p>
}
