'use client'

import { Suspense, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { Skeleton } from '@/components/ui/skeleton'
import { PremiumPage } from '@/components/domain/signals/premium-page'
import { CompanyOpportunities } from '@/components/domain/signals/company-opportunities'
import { IngestionEngineView } from '@/components/domain/signals/ingestion-engine-view'
import { PortfolioList } from '@/components/domain/portfolio/portfolio-list'

type SignalsSection = 'market' | 'ingestion' | 'portfolio'

const SECTIONS: { id: SignalsSection; label: string }[] = [
  { id: 'market', label: 'Market Signals' },
  { id: 'ingestion', label: 'Ingestion Engine' },
  { id: 'portfolio', label: 'Product Portfolio' },
]

/**
 * The "Signals" tab of the Recruitment page: the same three Signals screens (Market Signals, Ingestion Engine, Product Portfolio), shown here by
 * reusing the existing components, so there is no second copy to keep in step. The Signals pages and their own tabs are unchanged; the three
 * sections switch on this page (state, not navigation) and nothing outside this tab is touched.
 */
export function RecruitmentSignalsTab() {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const canManage = user?.role === 'administrator' || user?.role === 'hr_manager' || user?.role === 'executive'
  const [section, setSection] = useState<SignalsSection>('market')

  return (
    <PremiumPage>
      <div className="@container w-full space-y-5">
        <nav aria-label="Signals sections">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSection(s.id)}
                  aria-current={s.id === section ? 'page' : undefined}
                  className={cn(
                    'flex h-9 w-full items-center justify-center rounded-lg border px-3 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    s.id === section
                      ? 'border-primary/40 bg-primary text-primary-foreground shadow-sm'
                      : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <Suspense fallback={<Skeleton className="h-40 w-full rounded-2xl" aria-label="Loading" />}>
          {section === 'market' && <CompanyOpportunities context={context} />}
          {section === 'ingestion' && <IngestionEngineView />}
          {section === 'portfolio' && <PortfolioList canManage={canManage} embedded />}
        </Suspense>
      </div>
    </PremiumPage>
  )
}
