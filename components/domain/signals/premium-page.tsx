import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The warm light workspace shared by Company Opportunities, Ingestion Engine, Product Portfolio and Partner Network (styles: `.g2g-premium`
 * in globals.css, scoped to light mode and to these modules).
 */
export function PremiumPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('g2g-premium', className)}>{children}</div>
}

/** The header of a page: title, one line of guidance, optional actions, over a soft wash with a gold rule. */
export function PremiumHeader({ title, description, badge, actions }: { title: string; description?: string; badge?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="premium-hero flex flex-wrap items-center justify-between gap-4 px-5 py-4 @xl:px-6">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {badge}
        </div>
        <div className="premium-rule" aria-hidden="true" />
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
