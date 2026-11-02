'use client'

import type { ReactNode } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'

export type DetailStatus = 'loading' | 'error' | 'notFound' | 'ready'

/**
 * The frame of a record's page: a back button, the title with a badge and a subtitle, the actions, an optional notice, the tabs and their panels.
 * Until the record has loaded it shows one of three states instead (loading, error, not found), each with a way back.
 *
 * The caller supplies the tabs (a <PageTabs>) and the panels (<TabPanel>s) as `tabs` and `children`, so the frame knows nothing about a record's
 * sections. The route that renders this adds the app shell and the breadcrumb around it.
 */
export function DetailPage({ title, subtitle, badge, backLabel, onBack, actions, notice, status, error, onRetry, notFoundText, tabs, children }: {
  title: string
  subtitle?: ReactNode
  badge?: ReactNode
  /** Names the back button, for example "Back to Product Master". */
  backLabel: string
  onBack: () => void
  actions?: ReactNode
  notice?: ReactNode
  status: DetailStatus
  error?: string
  onRetry?: () => void
  notFoundText?: string
  tabs?: ReactNode
  children: ReactNode
}) {
  const back = <Button variant="outline" size="sm" onClick={onBack}>{backLabel}</Button>

  if (status === 'loading') {
    return (
      <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Opening…
      </div>
    )
  }
  if (status === 'error') return <ErrorState title="This could not be opened" description={error} retry={onRetry} action={back} />
  if (status === 'notFound') {
    return <EmptyState title="Not found" description={notFoundText ?? 'This could not be found, or you do not have access to it.'} action={back} />
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label={backLabel} title={backLabel}>
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-foreground">{title}</h1>
              {badge}
            </div>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>

      {notice}
      {tabs}
      {children}
    </div>
  )
}
