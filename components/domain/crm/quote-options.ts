'use client'

/** Shared "pick a quote" option list - the Sales Order list view's "Create from Quote" entry point. */

import { useEffect, useState } from 'react'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmQuote } from '@/types/crm'

export function useQuoteOptions(context: LaravelContext, enabled: boolean): CrmQuote[] {
  const [quotes, setQuotes] = useState<CrmQuote[]>([])

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true

    crmService.getQuotes(context, { perPage: 100, sortBy: 'subject', sortDir: 'asc' })
      .then((response) => { if (active) setQuotes(response.data.items) })
      .catch(() => { /* the picker still works empty */ })

    return () => { active = false }
  }, [context, enabled])

  return quotes
}
