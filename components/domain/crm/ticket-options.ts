'use client'

/**
 * Shared "pick an asset" / "pick a service contract" option lists for the
 * Ticket create/edit form - same shape as organization-options.ts/
 * contact-options.ts. Assets and Service Contracts are sibling entities
 * built in parallel by other agents in this same phase; `CrmAsset`/
 * `CrmServiceContract` and `crmService.getAssets`/`getServiceContracts` are
 * NOT yet defined anywhere in this repo - this file references them exactly
 * as they are expected to land (mirroring crmService.getProducts's own
 * (context, query) shape), so this one file is the only edit needed here
 * once those land.
 */

import { useEffect, useState } from 'react'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmAsset, CrmServiceContract } from '@/types/crm'

export function useAssetOptions(context: LaravelContext, enabled: boolean): CrmAsset[] {
  const [assets, setAssets] = useState<CrmAsset[]>([])

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true

    crmService.getAssets(context, { perPage: 100, sortBy: 'asset_name', sortDir: 'asc' })
      .then((response) => { if (active) setAssets(response.data.items) })
      .catch(() => { /* the form still works with an empty picker */ })

    return () => { active = false }
  }, [context, enabled])

  return assets
}

export function useServiceContractOptions(context: LaravelContext, enabled: boolean): CrmServiceContract[] {
  const [contracts, setContracts] = useState<CrmServiceContract[]>([])

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true

    crmService.getServiceContracts(context, { perPage: 100, sortBy: 'created_at', sortDir: 'desc' })
      .then((response) => { if (active) setContracts(response.data.items) })
      .catch(() => { /* the form still works with an empty picker */ })

    return () => { active = false }
  }, [context, enabled])

  return contracts
}
