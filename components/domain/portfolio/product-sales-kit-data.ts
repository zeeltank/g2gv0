'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SalesKitApi } from '@/services/product-master/kit-service'
import type { KitData } from '@/services/product-master/kit-types'

export interface KitState {
  /** `loading`: nothing has been read yet. `ready`: `data` is the kit (it may be a moment old while a re-read is under way). `error`: the first read failed. */
  status: 'loading' | 'ready' | 'error'
  data: KitData | null
  /** The server's own sentence for a failed read ("not set up on this host"), or ''. */
  error: string
}

const LOADING: KitState = { status: 'loading', data: null, error: '' }

/**
 * Reads a Product's Sales Kit, and again whenever `reload` is called. The Product page reads it as soon as the Product is known, so the tab can show its count before it is opened.
 * A re-read keeps the old kit on screen until the new one arrives; a failed re-read keeps it too and reports the sentence in `error` instead of blanking the shelf. `productId`
 * undefined, or `enabled` false (a caller who may not view the kit), reads nothing at all.
 */
export function useSalesKit(service: SalesKitApi, productId: number | undefined, enabled: boolean) {
  const [state, setState] = useState<KitState>(LOADING)
  // Only the newest read may write: a slow answer for another Product, or an older read, must not overwrite the one being shown.
  const latest = useRef(0)

  const reload = useCallback(async () => {
    if (!enabled || productId === undefined) return
    const mine = ++latest.current
    try {
      const response = await service.get(productId)
      if (mine === latest.current) setState({ status: 'ready', data: response.data, error: '' })
    } catch (cause) {
      if (mine !== latest.current) return
      const error = cause instanceof Error && cause.message ? cause.message : 'The Sales Kit could not be loaded.'
      setState((current) => (current.data ? { ...current, error } : { status: 'error', data: null, error }))
    }
  }, [service, productId, enabled])

  useEffect(() => {
    // A different Product starts from nothing; the read itself is deferred so the state it sets is not set inside the effect.
    queueMicrotask(() => { setState(LOADING); void reload() })
    return () => { latest.current += 1 }
  }, [reload])

  /** The Retry button of a failed first read: back to the skeletons, then read again. */
  const retry = useCallback(() => { setState(LOADING); void reload() }, [reload])

  return { state, reload, retry }
}
