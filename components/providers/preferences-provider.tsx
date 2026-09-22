'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  accountService,
  type AccountMe,
  type AccountPreferences,
  type AccountProfile,
} from '@/services/account'
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

  /*
   * These mirror `UserPreferences::DEFAULTS` on the server, and the mirroring is
   * the point: this object is what every screen sees before the fetch lands, and
   * what it keeps if the fetch fails. A key missing here is `undefined` in a
   * control that expects a string - a select with no matching option renders
   * blank, which reads as "I have no pronouns set" rather than "not loaded".
   */
  display_name: '',
  pronouns: '',
  about: '',

  // `everyone` matches the server, so a failed fetch cannot silently tighten or
  // loosen somebody's privacy relative to what is actually stored.
  visible_mobile: 'everyone',
  visible_birthdate: 'everyone',
  visible_address: 'everyone',
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
  /**
   * THE WHOLE `/account/me` RESPONSE, SO NOTHING FETCHES IT TWICE.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * TWO FETCHES MEANT TWO ANSWERS THAT COULD DISAGREE
   * ═══════════════════════════════════════════════════════════════════════
   *
   * This provider already fetched the full response and threw most of it away,
   * keeping only `preferences` and `profile`. So `useAccount` — which needs
   * `role`, `choices` and the two event lists — fetched the very same endpoint
   * again on every `/settings` load.
   *
   * The wasted request was the smaller problem. The two calls had SEPARATE error
   * states, and they could land differently: the provider's succeeding while the
   * screen's failed left the sidebar and theme correct while Settings reported it
   * could not load anything. They also disagreed about what an unready context
   * MEANS — this one treats it as "nobody is signed in, defaults are correct",
   * while `useAccount` reported "your session has expired". Same condition, two
   * conclusions, whichever arrived last on screen.
   *
   * One fetch, one error, one copy. `useAccount` keeps ownership of SAVING; this
   * owns reading, which is the split the file header already described.
   *
   * (The plan called for React Query under a shared key. That needs this provider
   * to sit inside `QueryProvider`, and it sits outside it in `app/layout.tsx` —
   * reordering the app-wide provider tree to remove one request was the larger
   * risk of the two, and this provider has already shipped once imported but not
   * rendered. Sharing the response it was already discarding gets the same
   * result without touching the tree.)
   */
  account: AccountMe['data'] | null
  /** False until the server's answer has arrived. Consumers that must not act on a default can wait. */
  loaded: boolean
  /**
   * Set when the fetch FAILED, as opposed to there being nobody signed in.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * WHY THESE TWO MUST NOT LOOK THE SAME
   * ═══════════════════════════════════════════════════════════════════════
   *
   * A swallowed error left the hardcoded defaults in place with nothing shown
   * outside `/settings` — and `role` stayed null, so `sectionsForRole(null)`
   * dropped the whole Organisation half of the settings rail and `?s=audit`
   * silently landed on Profile. To the person using it, one failed request
   * looked exactly like every setting they had ever chosen being wiped.
   *
   * Null here means "no session, and that is fine". A string means something
   * broke and the screen should say so and offer to retry.
   */
  error: string | null
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
  const [account, setAccount] = useState<AccountMe['data'] | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback(
    (next: AccountPreferences) => {
      setPreferences(next)
      setTheme(next.theme)

      // And into the shared copy. Without this a save would update the app but
      // leave `account.preferences` holding the pre-save values, so the settings
      // screen — which now reads from here — would show the old ones back.
      setAccount((current) => (current ? { ...current, preferences: next } : current))
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

          setAccount(response.data)
          setPreferences(response.data.preferences)
          setProfile(response.data.profile)
          setTheme(response.data.preferences.theme)
          setLoaded(true)
        })
        .catch((caught: unknown) => {
          if (!active) return

          /*
           * The defaults stay on screen — a page must still render — but the
           * failure is RECORDED rather than swallowed, so the shell can say
           * "these could not be loaded" instead of quietly presenting factory
           * values as though they were the person's own choices.
           */
          setError(
            caught instanceof Error
              ? caught.message
              : 'Your settings could not be loaded. What you see are defaults.',
          )
          setLoaded(true)
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
      setAccount(response.data)
      setPreferences(response.data.preferences)
      setProfile(response.data.profile)
      setTheme(response.data.preferences.theme)
      setError(null)
    } catch {
      // Keep what is already on screen. A failed refresh must not blank the
      // header's avatar or reset somebody's theme mid-session.
    }
  }, [setTheme])

  return (
    <PreferencesContext.Provider
      value={{ preferences, profile, account, loaded, error, apply, refresh }}
    >
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
    account: null,
    loaded: false,
    error: null,
    apply: () => {},
    refresh: async () => {},
  }
}

export { DEFAULTS as PREFERENCE_DEFAULTS }
