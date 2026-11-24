'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { intelligenceService } from '@/services/intelligence/intelligence-service'
import { classifyIntelligenceError, type IntelligenceFailure } from '@/services/intelligence/errors'
import type { IntelligenceApi } from '@/services/intelligence/types'
import type { Snapshot } from '@/lib/intelligence-center/derive'
import { loadSnapshot } from '@/lib/intelligence-center/load-all'

export type IntelligenceState =
  | { status: 'loading' }
  | { status: 'error'; failure: IntelligenceFailure }
  | {
      status: 'ready'
      snapshot: Snapshot
      /** A refresh is running; the previous answer stays on screen until the new one arrives. */
      refreshing: boolean
      /** The last refresh failed; the previous answer is still shown. */
      refreshFailure: IntelligenceFailure | null
      /** The answer just arrived: Refresh is switched off for a few seconds (the API allows 30 requests a minute per address). */
      cooling: boolean
    }

interface IntelligenceContextValue {
  state: IntelligenceState
  /** Loads again, keeping what is on screen. */
  refresh: () => void
  /** Loads again from the loading state (after an error). */
  retry: () => void
}

const IntelligenceContext = createContext<IntelligenceContextValue | null>(null)

/**
 * Loads the Intelligence snapshot ONCE (the detectors this person may see and every open insight) and shares it with every Intelligence route, so
 * moving from the home to a domain, an area or a finding needs no further request. Mounted by app/intelligence/layout.tsx, which stays mounted while
 * the person navigates between those routes.
 */
export function IntelligenceProvider({
  service = intelligenceService,
  cooldownMs = 5000,
  children,
}: {
  service?: IntelligenceApi
  /** How long Refresh stays off after an answer arrives. */
  cooldownMs?: number
  children: ReactNode
}) {
  const [state, setState] = useState<IntelligenceState>({ status: 'loading' })
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Asks the API and stores the answer. It sets no state until the answer arrives, so it can run from an effect. */
  const request = useCallback(
    (keepOnScreen: boolean) => {
      const mine = ++generation.current
      loadSnapshot(service).then(
        (snapshot) => {
          // An answer that arrives after a newer request was made (or after the screen left) is dropped.
          if (generation.current !== mine) return
          const cooling = cooldownMs > 0
          setState({ status: 'ready', snapshot, refreshing: false, refreshFailure: null, cooling })
          if (timer.current) clearTimeout(timer.current)
          if (cooling) {
            timer.current = setTimeout(() => setState((now) => (now.status === 'ready' ? { ...now, cooling: false } : now)), cooldownMs)
          }
        },
        (error: unknown) => {
          if (generation.current !== mine) return
          const failure = classifyIntelligenceError(error)
          setState((previous) => (keepOnScreen && previous.status === 'ready' ? { ...previous, refreshing: false, refreshFailure: failure, cooling: false } : { status: 'error', failure }))
        },
      )
    },
    [service, cooldownMs],
  )

  /** A person asked to load again: say so on screen at once (keeping the findings when refreshing), then ask. */
  const begin = useCallback(
    (keepOnScreen: boolean) => {
      setState((previous) => (keepOnScreen && previous.status === 'ready' ? { ...previous, refreshing: true, refreshFailure: null } : { status: 'loading' }))
      request(keepOnScreen)
    },
    [request],
  )

  // The first load: the state starts as "loading", so nothing needs setting here.
  useEffect(() => {
    request(false)
    return () => {
      generation.current += 1
      if (timer.current) clearTimeout(timer.current)
    }
  }, [request])

  const value = useMemo<IntelligenceContextValue>(
    () => ({ state, refresh: () => { if (!(state.status === 'ready' && (state.cooling || state.refreshing))) begin(true) }, retry: () => begin(false) }),
    [state, begin],
  )
  return <IntelligenceContext.Provider value={value}>{children}</IntelligenceContext.Provider>
}

export function useIntelligence(): IntelligenceContextValue {
  const value = useContext(IntelligenceContext)
  if (!value) throw new Error('useIntelligence must be used inside <IntelligenceProvider>.')
  return value
}
