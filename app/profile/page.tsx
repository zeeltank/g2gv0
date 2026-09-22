'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * `/profile` NO LONGER EXISTS AS A PAGE. IT SENDS YOU TO THE ONE THAT DOES.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THERE WERE TWO, AND WHY THERE IS NOW ONE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This product had two URLs for one thing:
 *
 *   /profile             five cards, ENTIRELY READ-ONLY. Fetched the HRMS
 *                        endpoints directly.
 *   /settings?s=profile  the only place anything could actually be changed.
 *                        Fetched /account/me.
 *
 * Two screens, two data sources, no reason to agree — and they did disagree. The
 * reported bug that led here was a person seeing their own details on a
 * colleague's profile, and the first question was "which of the two pages?"
 * That question should not exist.
 *
 * So `/settings?s=profile` is the profile, and this redirects to it.
 *
 * ── NOTHING WAS LOST IN THE MERGE ───────────────────────────────────────────
 *
 * Of the five cards here, personal details and address are the editable fields on
 * that screen, and job title and department are its work block. Bank details
 * existed here and nowhere else, so they moved across as a read-only block rather
 * than disappearing with the page.
 *
 * Reporting line and attendance did not move, and that is not an oversight: both
 * were fed hardcoded empty arrays, so they rendered an empty state for every
 * person on every visit. `reporting_manager_id` is set on 0 of 299 live accounts.
 * Moving two permanently blank cards would have been moving furniture, not content.
 *
 * ── A REDIRECT, NOT A DELETION ──────────────────────────────────────────────
 *
 * The route stays so that anything already pointing here still arrives somewhere
 * useful: a bookmark, a link in an old email, the browser history of 299 people.
 * Deleting the route would turn every one of those into a 404.
 *
 * `replace` rather than `push`, so Back does not bounce the person between the two
 * URLs forever.
 */
export default function ProfileRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/settings?s=profile')
  }, [router])

  /*
   * Deliberately almost nothing. This is on screen for one frame, and a spinner or
   * a "Redirecting…" heading would flash and be gone — noise, in place of nothing.
   * The `sr-only` line is for a screen reader, which does not experience the frame
   * the way an eye does and would otherwise be told nothing at all.
   */
  return <p className="sr-only">Taking you to your profile.</p>
}
