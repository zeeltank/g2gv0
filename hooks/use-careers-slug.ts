'use client'

import { useCallback, useEffect, useState } from 'react'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { organizationService } from '@/services/organization'

/**
 * The organisation's public careers slug.
 *
 * ── WHY A HOOK RATHER THAN THE SESSION ──────────────────────────────────────
 *
 * The slug is not in the Laravel session payload, and adding it there would
 * only reach users after they next sign in - so the fallback fetch would be
 * needed anyway, and there would be two sources of the same fact.
 *
 * It rides on `GET /organization/profile`, which already returns the
 * organisation's identity and is already tenant-scoped.
 *
 * ── NULL IS A REAL ANSWER ───────────────────────────────────────────────────
 *
 * `careers_slug` lives on `institute_detail`, which has 5 rows against
 * `school_setup`'s 12. A tenant without one has no careers page, so anything
 * that needs a public job URL is genuinely unavailable rather than broken.
 * Callers should HIDE the affected control, not disable it - a disabled button
 * with no explanation generates a support ticket.
 */

/** One fetch per session, shared by every caller. */
let cached: { slug: string | null } | null = null
let inFlight: Promise<{ slug: string | null }> | null = null

async function load(): Promise<{ slug: string | null }> {
  if (cached) return cached
  if (inFlight) return inFlight

  inFlight = (async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return { slug: null }

    const response = await organizationService.getOrganizationProfile(context)
    const result = { slug: response.identity?.careers_slug ?? null }
    cached = result

    return result
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

export function useCareersSlug() {
  const [slug, setSlug] = useState<string | null>(cached?.slug ?? null)
  const [loading, setLoading] = useState(cached === null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await load()
      setSlug(result.slug)
    } catch {
      // A missing slug and a failed lookup have the same consequence for the
      // caller - no careers page to link to - so both resolve to null rather
      // than surfacing an error nobody can act on.
      setSlug(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (cached !== null) return
    // queueMicrotask: react-hooks/set-state-in-effect is an error in this repo.
    queueMicrotask(() => { void refresh() })
  }, [refresh])

  return { slug, loading }
}
