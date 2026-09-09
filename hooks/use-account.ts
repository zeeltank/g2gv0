'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { accountService, type AccountMe, type AccountPreferences } from '@/services/account'
import { useAppPreferences } from '@/components/providers/preferences-provider'

/**
 * ONE LOAD FOR THE WHOLE SETTINGS AREA.
 *
 * `GET /api/account/me` returns the profile, every preference, the role and the
 * list of notifiable events in a single response, so switching between sections
 * is instant and no section refetches what the one before it already had.
 *
 * ── THIS HOOK OWNS EDITING; THE PROVIDER OWNS READING ───────────────────────
 *
 * `PreferencesProvider` fetches the same preferences once for the whole app and
 * applies the theme, so the choice follows somebody to a different machine
 * whatever page they open first. This hook used to do that itself, which meant
 * the stored theme was only ever applied while `/settings` was open — every
 * other route fell back to the local paint hint.
 *
 * What is left here is the settings screen's own copy plus the save path, and
 * every save is pushed back into the provider so the sidebar, the date formats
 * and the landing page follow immediately rather than on the next full load.
 */
export function useAccount() {
  const resolveContext = useLaravelContext()
  const { apply } = useAppPreferences()

  const [data, setData] = useState<AccountMe['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      setError('Your session has expired. Please sign in again.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await accountService.me(context)
      setData(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your account.')
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    // `load` sets loading state synchronously; a microtask keeps that out of the
    // effect body so mounting costs one render rather than two.
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  /**
   * Save some preferences and keep what came back.
   *
   * The response is the FULL set as it now stands, not the fragment that was
   * sent, so the screen cannot drift from the database by merging its own guess
   * at the result.
   */
  const savePreferences = useCallback(
    async (changes: Partial<AccountPreferences>) => {
      const context = resolveContext()
      const response = await accountService.updatePreferences(context, changes)

      setData((current) => (current ? { ...current, preferences: response.data.preferences } : current))

      // One call, not two: `apply` sets the theme as well as the shared copy,
      // so there is no path where the app-wide value and the theme disagree.
      apply(response.data.preferences)

      return response.data.preferences
    },
    [resolveContext, apply],
  )

  return {
    profile: data?.profile ?? null,
    preferences: data?.preferences ?? null,
    role: data?.role ?? null,
    notifiableEvents: data?.notifiable_events ?? [],
    emailableEvents: data?.emailable_events ?? [],
    choices: data?.choices ?? null,
    loading,
    error,
    reload: load,
    savePreferences,
    setData,
  }
}
