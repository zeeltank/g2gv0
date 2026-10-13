'use client'

import { useState } from 'react'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { IngestionView } from './ingestion-view'
import { OpportunitiesView } from './opportunities-view'
import { PortfolioView } from '@/components/domain/portfolio/portfolio-view'
import { PartnersView } from '@/components/domain/portfolio/partners-view'

type View = 'opportunities' | 'ingestion' | 'portfolio' | 'partners'

const VIEWS: { id: View; label: string }[] = [
  { id: 'opportunities', label: 'Company opportunities' },
  { id: 'ingestion', label: 'Ingestion engine' },
  { id: 'portfolio', label: 'Product Portfolio' },
  { id: 'partners', label: 'Partner Network' },
]

/**
 * The Signals tab: four independent views that share the tab, not state.
 *
 *  - Company opportunities: daily, scheduled public-web research.
 *  - Ingestion engine: user-supplied documents and URLs, analysed on demand.
 *  - Product Portfolio: company offerings, problem capabilities and tags.
 *  - Partner Network: enterprise ecosystem and channel partners.
 */
export function SignalsHub({
  department,
  context,
  canManage,
}: {
  department: Department
  context: LaravelContext
  canManage: boolean
}) {
  const [view, setView] = useState<View>(VIEWS[0].id)

  return (
    <div className="@container">
      <div className="px-4 pt-4 @xl:px-6 @xl:pt-6">
        <div role="tablist" aria-label="Signals views" className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === v.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'opportunities' && <OpportunitiesView context={context} />}
      {view === 'ingestion' && <IngestionView context={context} />}
      {view === 'portfolio' && <PortfolioView context={context} canManage={canManage} />}
      {view === 'partners' && <PartnersView context={context} canManage={canManage} />}
    </div>
  )
}
