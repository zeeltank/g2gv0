import type { ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Document Library-scoped layout primitives, following the same rule the
 * Signals views (`signals-ui.tsx`) settled on and explicitly keep local to
 * their own feature:
 *
 *   Page (bg-background)  ->  Surface (one bordered card)  ->  content
 *
 * ONE bordered container per level; anything nested inside a Surface
 * separates by whitespace or a soft fill, never a second border. Widths
 * respond to the container this page sits in (the shell's content area,
 * which narrows when the sidebar or an agent panel is open), not the
 * viewport - hence `@container` rather than `lg:`/`xl:` throughout this
 * feature's components.
 */

export function DocumentsPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('@container space-y-6 p-4 @xl:p-6', className)}>{children}</div>
}

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

const NOTICE_TONES = {
  info: 'bg-muted text-foreground',
  warning: 'bg-warning/10 text-foreground',
  error: 'bg-destructive/10 text-foreground',
} as const

/** Inline banner, since this product has no toast library. */
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
      role={tone === 'info' ? 'status' : 'alert'}
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

export function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs leading-snug text-muted-foreground">{hint}</span>}
    </label>
  )
}
