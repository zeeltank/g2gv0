'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readFailure } from '@/lib/agent/queue-model'
import type { AutonomyPhase } from '@/lib/agent/tabs-model'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { AgentApi } from '@/services/agent/api-types'
import type { AutonomyAction, AutonomyState, KillSwitch } from '@/services/agent/types'

/**
 * The autonomy settings as the screen last read them, read ONCE for the whole screen: the answer decides whether the Autonomy tab exists at all (only an
 * administrator may change the levels), carries the kill switch the Waiting tab warns about, and is what the Autonomy tab shows and changes.
 *
 * Only the newest read may change what is held: a slower answer for an earlier read must not replace a newer one, and a change an administrator has just
 * saved is newer than any read that was already on its way (so a late read cannot put the old level back on screen).
 */
export function useAutonomyState(service: AgentApi) {
  const context = useMemo(() => getLaravelContext(), [])
  const [phase, setPhase] = useState<AutonomyPhase>('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState<AutonomyState | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const latest = useRef(0)

  /**
   * Reads the settings. `quiet` reads again behind what is on screen: no "Opening…", and a failure leaves what is shown as it is. It answers whether it worked.
   * Without `quiet` (the first read, Retry) a failure replaces the screen with its explanation.
   */
  const load = useCallback(async (quiet = false): Promise<boolean> => {
    if (!isLaravelContextReady(context)) {
      if (!quiet) {
        setError('Your ERP session is unavailable. Please sign in again.')
        setPhase('error')
      }
      return false
    }
    const mine = ++latest.current
    if (quiet) setRefreshing(true)
    else setPhase('loading')
    try {
      const response = await service.autonomy()
      if (mine !== latest.current) return false
      setData(response.data)
      setPhase('ready')
      setError('')
      setRefreshing(false)
      return true
    } catch (cause) {
      if (mine !== latest.current) return false
      setRefreshing(false)
      if (quiet) return false
      const problem = readFailure(cause, 'autonomy settings', 'The autonomy settings could not be read.')
      setData(null)
      setError(problem.message)
      setPhase(problem.kind)
      return false
    }
  }, [context, service])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  /** One action, as the server answered after a change: it replaces that action and no other. */
  const applyAction = useCallback((action: AutonomyAction) => {
    latest.current += 1
    setRefreshing(false)
    setData((current) => (current ? { ...current, actions: current.actions.map((a) => (a.key === action.key ? action : a)) } : current))
  }, [])

  /** The switch, as the server answered after a change. */
  const applyKillSwitch = useCallback((kill: KillSwitch) => {
    latest.current += 1
    setRefreshing(false)
    setData((current) => (current ? { ...current, kill_switch: kill } : current))
  }, [])

  return { phase, error, data, refreshing, load, applyAction, applyKillSwitch }
}

export type AutonomyStore = ReturnType<typeof useAutonomyState>
