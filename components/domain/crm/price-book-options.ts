'use client'

/** Shared "pick an active price book" option list for the Quote form's optional Price Book link. */

import { useEffect, useState } from 'react'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmPriceBook } from '@/types/crm'

export function usePriceBookOptions(context: LaravelContext, enabled: boolean): CrmPriceBook[] {
  const [priceBooks, setPriceBooks] = useState<CrmPriceBook[]>([])

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true

    crmService.getActivePriceBooks(context)
      .then((response) => { if (active) setPriceBooks(response.data) })
      .catch(() => { /* the form still works with an empty picker */ })

    return () => { active = false }
  }, [context, enabled])

  return priceBooks
}
