'use client'

import { CompanyOpportunities } from '@/components/domain/signals/company-opportunities'
import { SignalsFrame } from '@/components/domain/signals/signals-frame'
import { ContextualInsights } from '@/components/domain/intelligence'
import { getLaravelContext } from '@/lib/laravel-context'
import { useAuth } from '@/components/auth/gtg-auth'

/**
 * The /signals page: Company opportunities, with the product chosen at the top. ScholarClone's signals live here as that product's view,
 * so an old link to /signals (or /signals?product=scholarclone) lands on them.
 */
export function SignalsPageContent() {
  const { user } = useAuth()
  const context = getLaravelContext(user)

  return (
    <SignalsFrame active="opportunities">
      <ContextualInsights surface="signals" className="mb-0" />
      <CompanyOpportunities context={context} />
    </SignalsFrame>
  )
}
