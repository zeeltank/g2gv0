'use client'

import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'

export type ListStatus = 'loading' | 'error' | 'empty' | 'ready'

/**
 * The frame of a list screen: a title row, a toolbar, one of four states (loading, error, empty, ready) and a footer.
 *
 * It does not draw the list itself, so a nested table, a flat table and a card grid can all use it. The screen decides the status and puts the list in
 * `children`; the frame keeps the wording and the look of the four states the same on every screen.
 */
export function ListPage({ title, description, actions, toolbar, notice, status, error, onRetry, empty, children, footer }: {
  title: string
  description?: ReactNode
  /** Buttons on the right of the title. */
  actions?: ReactNode
  /** The search box and the filters. */
  toolbar?: ReactNode
  /** A confirmation shown above the list, for example "Archived." */
  notice?: ReactNode
  status: ListStatus
  error?: string
  onRetry?: () => void
  empty?: { title: string; description?: string; action?: ReactNode }
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>

      {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      {notice}

      {status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      )}
      {status === 'error' && <ErrorState title="This could not be loaded" description={error} retry={onRetry} />}
      {status === 'empty' && <EmptyState title={empty?.title ?? 'Nothing here yet'} description={empty?.description} action={empty?.action} />}
      {status === 'ready' && children}

      {footer}
    </div>
  )
}
