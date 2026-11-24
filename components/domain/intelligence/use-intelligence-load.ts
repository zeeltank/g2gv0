'use client'

import { useCallback, useEffect, useState } from 'react'
import { classifyIntelligenceError, type IntelligenceFailure } from '@/services/intelligence/errors'

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; failure: IntelligenceFailure }

/**
 * Loads one thing and keeps its state: loading, ready, or a failure that means something to the person (see classifyIntelligenceError).
 * `key` names what is being loaded: when it changes the load runs again, and an answer that arrives after the key changed (or the screen left) is dropped,
 * so a slow earlier request can never overwrite a newer one.
 */
export function useIntelligenceLoad<T>(load: () => Promise<T>, key: string): { state: LoadState<T>; reload: () => void } {
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState<{ key: string; value: LoadState<T> }>({ key, value: { status: 'loading' } })

  useEffect(() => {
    let current = true
    load().then(
      (data) => {
        if (current) setState({ key, value: { status: 'ready', data } })
      },
      (error: unknown) => {
        if (current) setState({ key, value: { status: 'error', failure: classifyIntelligenceError(error) } })
      },
    )
    return () => {
      current = false
    }
    // `load` is rebuilt on every render by design; `key` + `nonce` are what say "load again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce])

  const reload = useCallback(() => {
    setState((previous) => ({ key: previous.key, value: { status: 'loading' } }))
    setNonce((n) => n + 1)
  }, [])

  // While a different key is loading, show loading rather than the previous key's answer.
  const value: LoadState<T> = state.key === key ? state.value : { status: 'loading' }
  return { state: value, reload }
}
