'use client'

/**
 * Shared "pick a campaign" option list - same shape as organization-options.ts's useOrganizationOptions.
 *
 * `unavailable` is true when the server answered that this person may not read campaigns (403) or that there is no such list on this server (404). That is an
 * answer, not a failure: the form then leaves the Campaign box out, and nothing is shown or thrown. Any other failure (a dropped connection, a 500) leaves the
 * box in, with nothing to choose from, as it always was.
 */

import { useEffect, useState } from 'react'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { isNoAccess } from '@/lib/opportunities/model'
import { crmService } from '@/services/crm'
import type { Campaign } from '@/types/crm'

export interface CampaignOptions {
  campaigns: Campaign[]
  unavailable: boolean
}

export function useCampaignOptions(context: LaravelContext, enabled: boolean): CampaignOptions {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true

    crmService.getCampaigns(context, { perPage: 100, sortBy: 'name', sortDir: 'asc' })
      .then((response) => { if (active) { setCampaigns(response.data.items); setUnavailable(false) } })
      .catch((reason: unknown) => { if (active && isNoAccess(reason)) setUnavailable(true) /* any other failure: the form still works with an empty picker */ })

    return () => { active = false }
  }, [context, enabled])

  return { campaigns, unavailable }
}
