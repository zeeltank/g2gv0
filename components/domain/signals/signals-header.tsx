'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { visibleSignalsTabs, type SignalsTabKey } from '@/lib/signals-nav'

/**
 * The top of every Signals screen: the title, one line of guidance, and the four Signals screens as tabs. Each tab is a link to that screen's own
 * route, so deep links keep working and nothing is duplicated in the sidebar. Which tabs appear follows the user's own menu rights.
 */
export function SignalsHeader({ active, className = '' }: { active: SignalsTabKey; className?: string }) {
  const { signalsTabs } = useSidebarNavigation()
  const tabs = visibleSignalsTabs(signalsTabs)

  return (
    <header className={`premium-hero space-y-3 px-4 py-3 @xl:px-6 ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Signals</h1>
        <p className="text-sm text-muted-foreground">Find, review and act on buying signals for each of your products.</p>
      </div>
      <nav aria-label="Signals sections">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {tabs.map((t) => (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={t.key === active ? 'page' : undefined}
                title={t.hint}
                className={`flex h-9 items-center justify-center rounded-lg border px-3 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${t.key === active ? 'border-primary/40 bg-primary text-primary-foreground shadow-sm' : 'border-border/60 bg-card text-muted-foreground hover:text-foreground'}`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}

/** The description and actions of one Signals screen, under the shared header (its title is the active tab, so none is repeated). */
export function SectionBar({ description, actions }: { description?: string; actions?: ReactNode }) {
  if (!description && !actions) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : <span />}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
