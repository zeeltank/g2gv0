'use client'

import { Suspense } from 'react'
import { CompanyOpportunities } from '@/components/domain/signals/company-opportunities'
import { SignalsFrame } from '@/components/domain/signals/signals-frame'
import { ContextualInsights } from '@/components/domain/intelligence'
import { Skeleton } from '@/components/ui/skeleton'
import { getLaravelContext } from '@/lib/laravel-context'
import { useAuth } from '@/components/auth/gtg-auth'

/**
 * The /signals page: Company opportunities, with the product chosen at the top. ScholarClone's signals live here as that product's view,
 * so an old link to /signals (or /signals?product=scholarclone) lands on them. The screen keeps its search, filters and product in the address, which
 * needs a Suspense boundary above it (the page is not inside the shell's own).
 */
export function SignalsPageContent() {
  const { user } = useAuth()
  const context = getLaravelContext(user)

  return (
    <SignalsFrame active="opportunities">
      <ContextualInsights surface="signals" className="mb-0" />
      <CompanyOpportunities context={context} />
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-2xl" aria-label="Loading" />}>
        <CompanyOpportunities context={context} />
      </Suspense>
    </SignalsFrame>
  )
}
