'use client'

import { useEffect } from 'react'

/**
 * WARN BEFORE LEAVING WORK BEHIND.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THERE WAS NO GUARD ANYWHERE IN THIS PRODUCT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A search across `app/ components/ lib/ hooks/ services/` for `beforeunload`
 * returned nothing at all. Six settings sections hold a draft in `useState` and
 * every one of them lost it silently — on a refresh, on Back, on clicking
 * another section in the rail.
 *
 * The worst was Profile, which holds a SELECTED FILE: somebody picks a photo,
 * types a new mobile number, clicks "Preferences" to check something, comes
 * back, and both are gone with no indication they ever existed.
 *
 * Made worse by `SaveButton`, which renders the word "Saved" whenever the form
 * is not dirty. So a freshly-refreshed form whose edits had just been dropped
 * read "Saved".
 *
 * ── WHAT THIS CAN AND CANNOT COVER ──────────────────────────────────────────
 *
 * `beforeunload` covers the browser's own exits: refresh, closing the tab,
 * navigating to another site. That is the case where the work is genuinely
 * unrecoverable, and it is the case this hook handles.
 *
 * It CANNOT cover an in-app route change — Next.js gives no cancellable
 * navigation event in the App Router, and intercepting every link would be a
 * worse cure than the disease. Switching settings SECTIONS is handled where it
 * belongs instead: the shell asks before it changes section, because that is a
 * click it owns and can refuse.
 *
 * ── THE MESSAGE IS THE BROWSER'S, NOT OURS ──────────────────────────────────
 *
 * Every current browser ignores a custom string and shows its own wording, so
 * none is set. `preventDefault()` plus assigning `returnValue` is the pair that
 * actually triggers the prompt; one without the other is silently ignored in at
 * least one major browser, which is why both are here.
 */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      // Deprecated but still required by Chrome to raise the dialog.
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)

    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
}
