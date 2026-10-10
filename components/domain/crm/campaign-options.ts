'use client'

/** Shared "pick a campaign" option list - same shape as organization-options.ts's useOrganizationOptions. */

import { useEffect, useState } from 'react'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { Campaign } from '@/types/crm'

export function useCampaignOptions(context: LaravelContext, enabled: boolean): Campaign[] {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true

    crmService.getCampaigns(context, { perPage: 100, sortBy: 'name', sortDir: 'asc' })
      .then((response) => { if (active) setCampaigns(response.data.items) })
      .catch(() => { /* the form still works with an empty picker */ })

    return () => { active = false }
  }, [context, enabled])

  return campaigns
}
