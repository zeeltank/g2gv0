'use client'

/** Shared "pick an opportunity" option list for the Quote form's optional Opportunity link. */

import { useEffect, useState } from 'react'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmOpportunity } from '@/types/crm'

export function useOpportunityOptions(context: LaravelContext, enabled: boolean): CrmOpportunity[] {
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([])

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true

    crmService.getOpportunities(context, { perPage: 100, sortBy: 'name', sortDir: 'asc' })
      .then((response) => { if (active) setOpportunities(response.data.items) })
      .catch(() => { /* the form still works with an empty picker */ })

    return () => { active = false }
  }, [context, enabled])

  return opportunities
}
