'use client'

/**
 * Shared "pick a vendor" option list for the Purchase Order form's required
 * Vendor field. Mirrors organization-options.ts/opportunity-options.ts -
 * `crmService.getVendors` belongs to the Vendors entity's own integration
 * (built in parallel), not this file; this hook is written against its
 * documented shape (see purchase-order-integration.md) and is expected to
 * typecheck clean once that method lands in services/crm/index.ts.
 */

import { useEffect, useState } from 'react'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmVendor } from '@/types/crm'

export function useVendorOptions(context: LaravelContext, enabled: boolean): CrmVendor[] {
  const [vendors, setVendors] = useState<CrmVendor[]>([])

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true

    crmService.getVendors(context, { perPage: 100, sortBy: 'name', sortDir: 'asc' })
      .then((response) => { if (active) setVendors(response.data.items) })
      .catch(() => { /* the form still works with an empty picker */ })

    return () => { active = false }
  }, [context, enabled])

  return vendors
}
