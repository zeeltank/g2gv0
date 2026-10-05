'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  myCertificationsService,
  type MyCertificationItem,
  type MyCertificationsSummary,
} from '@/services/competency/my-certifications'

/**
 * THE EMPLOYEE'S OWN CERTIFICATIONS.
 *
 * Deliberately takes NO ARGUMENTS. `useCertifications(params)` takes a filter
 * object including `user_id_filter`, because the HR screen has to be able to
 * ask about a named person. This hook has no parameter to pass, so there is
 * nothing a caller could point at a colleague — the same structural guarantee
 * the endpoint behind it makes.
 *
 * Read-only: there is no create, update, remove or bulk here. HR remains the
 * issuer of record.
 */

interface UseMyCertificationsState {
  loading: boolean
  error: string | null
  items: MyCertificationItem[]
  summary: MyCertificationsSummary | null
  /** True when the server's 200-row backstop clipped the list. */
  truncated: boolean
  reload: () => void
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** The Laravel context is rebuilt per call - it reads live storage, not React state. */
function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

export function useMyCertifications(): UseMyCertificationsState {
  const resolveContext = useLaravelContext()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<MyCertificationItem[]>([])
  const [summary, setSummary] = useState<MyCertificationsSummary | null>(null)
  const [truncated, setTruncated] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await myCertificationsService.list(resolveContext())
      setItems(response.data ?? [])
      setSummary(response.summary ?? null)
      setTruncated(Boolean(response.meta?.truncated))
    } catch (loadError) {
      setError(toMessage(loadError, 'Could not load your certifications.'))
      setItems([])
      setSummary(null)
      setTruncated(false)
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    // Deferred out of the effect body: setLoading(true) runs synchronously
    // inside load(), and calling it directly here triggers a cascading render.
    // Same pattern as use-certifications.ts.
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const reload = useCallback(() => {
    void load()
  }, [load])

  return { loading, error, items, summary, truncated, reload }
}
