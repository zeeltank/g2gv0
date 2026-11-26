'use client'

import { useCallback, useEffect, useState } from 'react'

import type { DecentralizedModuleKey } from '@/lib/platform/access-links'
import { describePlatformError } from '@/lib/platform/client'
import { fetchPlatformRegistry, fetchWorkflowPoints, type PlatformRegistryPayload, type WorkflowPayload } from '@/lib/platform/workflow'

/**
 * The approvals of one module (or of every module, for the central view) and the registry that words them. Both are read together, because the form needs the
 * registry's approver types and the list needs its module names. A refresh that fails keeps what was already loaded: the screen says so and keeps the list.
 */
export function useApprovals(moduleKey: DecentralizedModuleKey | null) {
  const [data, setData] = useState<WorkflowPayload | null>(null)
  const [registry, setRegistry] = useState<PlatformRegistryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchWorkflowPoints(moduleKey ?? undefined), fetchPlatformRegistry()])
      .then(([points, reg]) => {
        if (cancelled) return
        setData(points)
        setRegistry(reg)
        setError(null)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(describePlatformError(cause, 'The approvals could not be loaded. Check your connection and try again.'))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, moduleKey])

  const reload = useCallback(() => {
    setLoading(true)
    setToken((value) => value + 1)
  }, [])

  return { data, registry, loading, error, reload }
}
