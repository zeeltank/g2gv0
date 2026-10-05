import type { ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Signals-scoped layout primitives.
 *
 * WHY THIS FILE EXISTS
 * The Signals views used to draw a full border at every level - page, card, field
 * group, list row, result, evidence - with 8-12px gaps between siblings, so adjacent
 * edges nearly touched and every piece of text sat inside a box. The rules here:
 *
 *   Page (bg-background)  ->  Surface (one bordered card)  ->  content
 *
 *  - ONE bordered container per level. Anything nested inside a Surface separates by
 *    whitespace, a hairline divider, or a soft fill (bg-muted/40) - never a second border.
 *  - Sibling surfaces are always 16px+ apart (gap-4), sections 24px (space-y-6).
 *  - Widths respond to the DRAWER's width (container queries), not the viewport: this
 *    UI lives in a side drawer whose width has nothing to do with the screen size.
 *
 * Scoped to Signals on purpose. Nothing here touches shared components or global CSS.
 */

/** Root of every Signals view: establishes the container-query context and page padding. */
export function SignalsPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('@container space-y-6 p-4 @xl:p-6', className)}>{children}</div>
}

/** The single bordered card surface. */
export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm', className)}>
      {children}
    </div>
  )
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-64">
        <h3 className="text-lg font-semibold leading-tight tracking-tight text-foreground">{title}</h3>
        {description && <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** A short group heading inside a view (e.g. "Results", "Filters"). */
export function GroupHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {aside && <div className="text-xs text-muted-foreground">{aside}</div>}
    </div>
  )
}

const NOTICE_TONES = {
  info: 'bg-muted text-foreground',
  warning: 'bg-warning/10 text-foreground',
  error: 'bg-destructive/10 text-foreground',
} as const

/** Inline banner. Borderless: the tint is the separation. */
export function Notice({
  tone = 'info',
  children,
  action,
}: {
  tone?: keyof typeof NOTICE_TONES
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg px-4 py-3 text-sm leading-relaxed', NOTICE_TONES[tone])}
    >
      {tone === 'info' ? (
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      ) : (
        <AlertTriangle className={cn('mt-0.5 size-4 shrink-0', tone === 'error' ? 'text-destructive' : 'text-warning')} />
      )}
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function StatTile({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <Surface className="p-4">
      <p className="text-xs leading-snug text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums leading-none text-foreground">{value ?? '—'}</p>
    </Surface>
  )
}

/** Centered empty / idle state that lives inside a Surface (no dashed box of its own). */
export function Placeholder({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Label / value pair used in card bodies. No box - typography does the work. */
export function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm leading-relaxed text-foreground">{children}</dd>
    </div>
  )
}

export function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs leading-snug text-muted-foreground">{hint}</span>}
    </label>
  )
}
