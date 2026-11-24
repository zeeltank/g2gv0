'use client'

/**
 * The two lists the opportunity form (create and edit) offers beyond what it always had: the products of the Product Master and the coded loss reasons. Each
 * is read when the form opens and is empty when it cannot be read (no right, a server without it), and then the form works exactly as it did before.
 */

import { useEffect, useState } from 'react'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import { useProductChoices } from '@/lib/product-picker/use-product-choices'
import type { PmOption } from '@/services/product-master/types'
import type { OpportunityLossReasonOption } from '@/types/crm'

/** The Products (level 1) the shared Product list offers, for the form's Product box (one read, `GET /product-master/lines`; slice 15, P3-C). */
export function useProductOptions(context: LaravelContext, enabled: boolean): PmOption[] {
  return useProductChoices(enabled && isLaravelContextReady(context))
}

/** The coded reasons the server accepts, from the stage list the board reads; an older server does not send them, and then the form asks for words only. */
export function useLossReasons(context: LaravelContext, enabled: boolean): OpportunityLossReasonOption[] {
  const [reasons, setReasons] = useState<OpportunityLossReasonOption[]>([])

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true
    crmService.getOpportunityPipeline(context)
      .then((response) => { if (active) setReasons(response.data.lossReasons ?? []) })
      .catch(() => { /* the form asks for words only */ })
    return () => { active = false }
  }, [context, enabled])

  return reasons
}
