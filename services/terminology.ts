/**
 * Q-F1 — the tenant's vocabulary, `/api/terminology`.
 *
 * NOT A NOTIFICATION CONCERN, despite arriving with X-06. The same map is meant
 * to drive SCREEN LABELS and REPORT HEADINGS: if a customer calls a Job Role a
 * "Position", the whole product should say Position, not just their email.
 *
 * WHAT A TENANT CAN AND CANNOT CHANGE:
 *   CAN — the noun. `job_role` → "Position", `competency` → "Capability".
 *   CANNOT — the sentence. Wording is fixed in `g2g_notification_template`, which
 *            has no tenant column at all. That is enforced by the schema.
 *
 * ADOPTION IS DELIBERATELY INCOMPLETE. This ships the map and the hook; the
 * screens that still hardcode "Job Role" are a follow-on, and pretending
 * otherwise would make a half-applied vocabulary look finished.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams, isLaravelContextReady } from '@/lib/laravel-context'

export interface Term {
  singular: string
  plural: string
}

export type TerminologyMap = Record<string, Term>

interface TerminologyResponse {
  status: number
  locale: string
  terms: TerminologyMap
  overridden: string[]
}

export const terminologyService = {
  get: (context: LaravelContext, locale?: string) =>
    apiClient.get<TerminologyResponse>(
      '/terminology',
      withLaravelParams(context, locale ? { locale } : {}),
    ),

  /** Admin/HR only — the server enforces it, this is not a UI decision. */
  set: (context: LaravelContext, term: { term_key: string; singular: string; plural: string }) =>
    apiClient.put<TerminologyResponse>('/terminology', withLaravelParams(context, term)),
}

/**
 * `t('job_role')` → the tenant's word.
 *
 * UNKNOWN KEYS RENDER AS THE KEY, not as an empty string. A screen reading
 * "job_role" is a visible bug someone fixes; a screen reading "" is an invisible
 * one that ships.
 */
export function useTerminology(context: LaravelContext) {
  const [terms, setTerms] = useState<TerminologyMap>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    let cancelled = false

    terminologyService
      .get(context)
      .then((res) => {
        if (!cancelled) setTerms(res.terms ?? {})
      })
      // A vocabulary that fails to load must not blank the screen. Falling back
      // to the keys keeps every label readable and the failure obvious.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [context])

  const t = useCallback(
    (key: string, form: 'singular' | 'plural' = 'singular') => terms[key]?.[form] ?? key,
    [terms],
  )

  return { t, terms, loaded }
}
