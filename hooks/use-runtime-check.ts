'use client'

/**
 * Asks the simulation runtime itself whether a specification would play (lib/simulation-host.ts: checkSpecWithRuntime, a hidden sandboxed
 * frame running the runtime's own validator). Shared by the Import tab (a pasted or chosen specification) and the Create tab (the
 * specification of a package, once its files' fingerprints are written in), so both are judged by the same code that will play it.
 *
 * ONE CHECK AT A TIME. Starting a check abandons the one in flight (its answer is ignored and its frame removed), and so does leaving
 * the screen. The check starts after `delayMs` so a person still typing does not start one per key. It is called from event handlers, never
 * from an effect, because it answers a person's action.
 */

import { useCallback, useEffect, useRef } from 'react'

import { checkSpecWithRuntime, type SpecVerdict } from '@/lib/simulation-host'

interface InFlight {
  live: boolean
  timer: number
  cancel: (() => void) | null
}

export function useRuntimeCheck(delayMs = 350) {
  const inFlight = useRef<InFlight | null>(null)

  const abandon = useCallback(() => {
    const run = inFlight.current
    if (!run) return
    run.live = false
    window.clearTimeout(run.timer)
    run.cancel?.()
    inFlight.current = null
  }, [])

  // Leaving the screen abandons whatever is running.
  useEffect(() => abandon, [abandon])

  const run = useCallback(
    (spec: unknown, onVerdict: (verdict: SpecVerdict) => void) => {
      abandon()
      const current: InFlight = { live: true, timer: 0, cancel: null }
      inFlight.current = current
      current.timer = window.setTimeout(() => {
        const verdictRun = checkSpecWithRuntime(spec)
        current.cancel = verdictRun.cancel
        void verdictRun.result.then((verdict) => {
          if (current.live) onVerdict(verdict)
        })
      }, delayMs)
    },
    [abandon, delayMs],
  )

  return { run, abandon }
}
