'use client'

/** Shared "pick an organization" option list for Contact forms and the parent-organization picker. */

import { useEffect, useState } from 'react'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { Organization } from '@/types/crm'

export function useOrganizationOptions(context: LaravelContext, enabled: boolean): Organization[] {
  const [organizations, setOrganizations] = useState<Organization[]>([])

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true

    crmService.getOrganizations(context, { perPage: 100, sortBy: 'name', sortDir: 'asc' })
      .then((response) => { if (active) setOrganizations(response.data.items) })
      .catch(() => { /* the form still works with an empty picker */ })

    return () => { active = false }
  }, [context, enabled])

  return organizations
}
