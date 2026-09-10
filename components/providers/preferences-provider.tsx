'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { accountService, type AccountPreferences, type AccountProfile } from '@/services/account'
import { useTheme } from '@/components/providers/theme-provider'

/**
 * THE SIGNED-IN PERSON'S PREFERENCES, AVAILABLE EVERYWHERE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY A PROVIDER AND NOT JUST THE SETTINGS HOOK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `useAccount()` is instantiated in exactly one place: the settings shell. So a
 * preference stored on the account was only ever FETCHED while somebody had
 * `/settings` open — which meant the theme "following you to another machine"
 * was true only if the first thing you did on that machine was open Settings.
 * Everywhere else the app used the local paint hint, or a hardcoded default.
 *
 * This fetches once, as soon as there is a session, and holds the answer for
 * the whole app. `useAccount` still owns EDITING; this owns READING.
 *
 * ── IT MUST NEVER BLOCK OR BREAK A PAGE ─────────────────────────────────────
 *
 * Every consumer gets a usable value immediately — the same defaults the server
 * declares — and the real ones replace them a moment later. A failed request,
 * an expired session or a signed-out visitor all leave the defaults in place,
 * because a page must not depend on a preferences call to render. That is why
 * `useAppPreferences()` returns defaults rather than throwing when there is no
 * provider, which is the opposite of the rule `useTheme()` follows: a missing
 * ThemeProvider is a bug that must be loud, whereas a preferences fetch that has
 * not finished yet is the normal first frame of every page load.
 */

/** Mirrors `UserPreferences::DEFAULTS` on the server. */
const DEFAULTS: AccountPreferences = {
  theme: 'system',
  sidebar_collapsed: true,
  density: 'comfortable',
  locale: 'en-GB',
  timezone: 'Asia/Kolkata',
  date_format: 'dd/mm/yyyy',
  landing_page: 'dashboard',
  notify_email: true,
  notify_events: {},
}

type PreferencesContextValue = {
  preferences: AccountPreferences
  /**
   * The signed-in person's own profile, so the shell can show their photo.
   *
   * The header rendered INITIALS ONLY and never an image — so uploading a photo
   * in Settings changed the profile screen and nothing else, which read as
   * "the upload is not saving". It was saving; there was simply nowhere else
   * that displayed it. This is that somewhere.
   */
  profile: AccountProfile | null
  /** False until the server's answer has arrived. Consumers that must not act on a default can wait. */
  loaded: boolean
  /** Called by Settings after a save, so the rest of the app sees it without a reload. */
  apply: (next: AccountPreferences) => void
  /**
   * Re-read the account from the server.
   *
   * Called after a photo upload. Nothing else in the app refetches `/account/me`,
   * so without this the new picture would appear in the header on the next full
   * page load and not before.
   */
  refresh: () => Promise<void>
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme()
  const [preferences, setPreferences] = useState<AccountPreferences>(DEFAULTS)
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [loaded, setLoaded] = useState(false)

  const apply = useCallback(
    (next: AccountPreferences) => {
      setPreferences(next)
      setTheme(next.theme)
    },
    [setTheme],
  )

  useEffect(() => {
    let active = true

    // Deferred, so the fetch is never part of the mount render.
    queueMicrotask(() => {
      const context = getLaravelContext(null)

      if (!isLaravelContextReady(context)) {
        // Nobody is signed in. The defaults are correct, and the sign-in screen
        // must not wait on an account call it has no credentials for.
        if (active) setLoaded(true)
        return
      }

      accountService
        .me(context)
        .then((response) => {
          if (!active) return

          setPreferences(response.data.preferences)
          setProfile(response.data.profile)
          setTheme(response.data.preferences.theme)
          setLoaded(true)
        })
        .catch(() => {
          // An expired token, or the endpoint being unreachable. Neither is a
          // reason to render nothing — the defaults are already in place.
          if (active) setLoaded(true)
        })
    })

    return () => {
      active = false
    }
  }, [setTheme])

  const refresh = useCallback(async () => {
    const context = getLaravelContext(null)

    if (!isLaravelContextReady(context)) return

    try {
      const response = await accountService.me(context)
      setPreferences(response.data.preferences)
      setProfile(response.data.profile)
      setTheme(response.data.preferences.theme)
    } catch {
      // Keep what is already on screen. A failed refresh must not blank the
      // header's avatar or reset somebody's theme mid-session.
    }
  }, [setTheme])

  return (
    <PreferencesContext.Provider value={{ preferences, profile, loaded, apply, refresh }}>
      {children}
    </PreferencesContext.Provider>
  )
}

/**
 * Read the signed-in person's preferences.
 *
 * Returns the declared defaults when there is no provider, so a component can
 * call this without knowing whether it is rendered inside the app shell.
 */
export function useAppPreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext)

  if (context) return context

  /*
   * ═══════════════════════════════════════════════════════════════════════
   * LOUD IN DEVELOPMENT, HARMLESS IN PRODUCTION
   * ═══════════════════════════════════════════════════════════════════════
   *
   * Returning defaults is the right behaviour: a page must never break, or
   * block, because a preferences call has not finished. But that resilience is
   * ALSO a perfect hiding place, and this provider proved it — it was imported
   * into `app/layout.tsx` and never rendered, and every consumer quietly used
   * the defaults for ever. tsc passed, lint passed, the build passed.
   *
   * `useTheme()` solves the same problem by throwing, which it can afford to:
   * a missing ThemeProvider is always a bug. This one cannot throw, because a
   * consumer legitimately renders outside the app shell. So it warns instead —
   * once per mount, in development only, naming the fix.
   */
  if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
    console.warn(
      '[preferences] useAppPreferences() was called outside <PreferencesProvider>. ' +
        'Falling back to defaults, so nothing will break — but the stored theme, ' +
        'sidebar default and landing page will not apply. Mount it in app/layout.tsx.',
    )
  }

  return {
    preferences: DEFAULTS,
    profile: null,
    loaded: false,
    apply: () => {},
    refresh: async () => {},
  }
}

export { DEFAULTS as PREFERENCE_DEFAULTS }
