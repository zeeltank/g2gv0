'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService } from '@/services/organization'
import type { DepartmentProcessRun } from '@/services/organization'

/** Runs for one process, newest first - the "View Runs" list. */
export function useProcessRuns(context: LaravelContext, processId: string) {
  const [items, setItems] = useState<DepartmentProcessRun[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await organizationService.getDepartmentProcessRuns(context, { processId })
      setItems(response?.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load runs.')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [context, processId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, isLoading, error, reload }
}

const POLL_MS = 4000

/**
 * One run's live detail - the monitor view's data source.
 *
 * Polls while the run is still `running` so the highlighted current step
 * and activity feed advance on their own (e.g. a colleague completing their
 * step, or the SLA scan command auto-completing a wait_delay) without the
 * viewer needing to refresh. Stops the moment the run leaves `running` -
 * a finished run's detail does not change again.
 */
export function useProcessRun(context: LaravelContext, runId: string) {
  const [run, setRun] = useState<DepartmentProcessRun | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true)
      try {
        const response = await organizationService.getDepartmentProcessRun(context, runId)
        setRun(response?.data ?? null)
        setError('')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to load this run.')
      } finally {
        if (!silent) setIsLoading(false)
      }
    },
    [context, runId],
  )

  useEffect(() => {
    void load()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [load])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (run?.status !== 'running') return undefined

    timerRef.current = setTimeout(() => void load(true), POLL_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [run, load])

  return { run, isLoading, error, reload: () => load() }
}
