'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * The competency a screen was opened "for".
 *
 * The Competency Library's detail panel links out to Employee Profiles,
 * Development & Career and Certifications with `?competency_id=&competency=`.
 * Those screens read it here so the drill-through lands on a filtered list
 * instead of the full one, and can offer a one-click way back to everything.
 *
 * Returns nulls when the screen was opened normally, so callers can treat the
 * focus as an optional narrowing rather than a required parameter.
 */
export function useCompetencyFocus() {
  const router = useRouter()
  const params = useSearchParams()

  const rawId = params.get('competency_id')
  const competencyId = rawId && /^\d+$/.test(rawId) ? rawId : null
  const competencyName = params.get('competency')

  /** Drop the focus and show the unfiltered screen. */
  const clearFocus = useCallback(() => {
    const next = new URLSearchParams(params.toString())
    next.delete('competency_id')
    next.delete('competency')
    const query = next.toString()
    router.replace(query ? `?${query}` : '?')
  }, [params, router])

  return { competencyId, competencyName, clearFocus }
}
