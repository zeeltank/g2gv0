'use client'

import { useCallback, useState } from 'react'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { accountService, type AccountPreferences } from '@/services/account'
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
/** Said on `/settings` when there is no token, where the provider stays quiet. */
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.'

export function useAccount() {
  const resolveContext = useLaravelContext()

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * THE SECOND FETCH OF /account/me IS GONE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * This hook used to call `accountService.me` itself, on top of the call
   * `PreferencesProvider` makes app-wide the moment there is a session. Two
   * requests for one endpoint on every `/settings` load.
   *
   * The duplicate request was the least of it. The two had SEPARATE error state
   * and could land differently — the provider's succeeding while this one failed
   * left the sidebar, theme and header avatar correct while Settings reported it
   * could not load anything at all. They also drew opposite conclusions from the
   * same condition: an unready context meant "nobody is signed in, defaults are
   * correct" to the provider and "your session has expired" here.
   *
   * Now there is one fetch, one error and one copy. Reading comes from the
   * provider; this hook keeps what it was always actually for, which is SAVING —
   * and `apply` pushes every save back into that shared copy, so the two cannot
   * drift.
   */
  const { account: data, loaded, error: providerError, apply, refresh } = useAppPreferences()

  /*
   * AN EXPIRED SESSION IS SILENT APP-WIDE AND FATAL HERE.
   *
   * The provider treats an unready context as "nobody is signed in, and the
   * defaults are correct" — which is right for it, because a signed-out visitor
   * on the login screen must not be shown an error about preferences.
   *
   * On `/settings` it is not right. Every section here needs a token, so a
   * missing one means the page cannot work, and saying nothing would leave
   * somebody looking at factory defaults believing they were their own settings.
   * The old `useAccount` reported this before it stopped fetching; keeping it is
   * not a leftover, it is the one conclusion this screen must draw that the
   * provider must not.
   */
  const sessionGone = !isLaravelContextReady(resolveContext())
  const error = providerError ?? (loaded && sessionGone ? SESSION_EXPIRED : null)

  /*
   * `loaded` is the provider's "the answer has arrived", which is the inverse of
   * what this hook has always returned. Kept as `loading` because eleven sections
   * read it, and renaming it across all of them would be churn for no gain.
   */
  const loading = !loaded

  const load = refresh

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

      /*
       * `apply` is now the ONLY write path, where there used to be a local
       * `setData` beside it. That local copy was the drift: two stores of the
       * same preferences, updated by two statements, and any future edit that
       * touched one and not the other would have shown the screen something the
       * rest of the app disagreed with. `apply` sets the theme, the app-wide
       * preferences and the shared response together.
       */
      apply(response.data.preferences)

      return response.data.preferences
    },
    [resolveContext, apply],
  )

  /**
   * Save one preference immediately, for a control that has no Save button.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * WHY AUTOSAVE, AND WHY IT IS A DIFFERENT FUNCTION
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * The theme picker repainted the whole application the instant it was clicked
   * and persisted NOTHING until a Save button further down the page was pressed.
   * So it looked applied, the person navigated away satisfied, and on the next
   * refresh the stored value — still the old one — overwrote it. `live` held
   * exactly one preference row against one account: proof that the save path
   * worked and that almost nobody ever completed it.
   *
   * A control whose effect is instant and whose persistence is not is a trap. So
   * the appearance and notification controls now persist on change, and only the
   * genuinely multi-field forms — profile, mailbox, org defaults, policy — keep a
   * Save button, because there a half-typed draft is a real thing to protect.
   *
   * `saving` is returned per key rather than as one flag: two switches thrown in
   * quick succession must not make each other look busy.
   */
  const [savingKeys, setSavingKeys] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  const saveNow = useCallback(
    async <K extends keyof AccountPreferences>(key: K, value: AccountPreferences[K]) => {
      setSavingKeys((current) => [...current, String(key)])
      setSaveError(null)

      try {
        await savePreferences({ [key]: value } as Partial<AccountPreferences>)
      } catch (caught) {
        /*
         * The optimistic value is NOT rolled back. It came from the person's own
         * click a moment ago, and yanking the theme back while telling them it
         * failed is worse than leaving it and saying so — they can retry, and a
         * reload shows them the truth either way.
         */
        setSaveError(
          caught instanceof Error ? caught.message : 'That could not be saved. Please try again.',
        )
      } finally {
        setSavingKeys((current) => current.filter((k) => k !== String(key)))
      }
    },
    [savePreferences],
  )

  return {
    profile: data?.profile ?? null,
    preferences: data?.preferences ?? null,
    deviceScope: data?.device_scope ?? null,
    saveNow,
    savingKeys,
    saveError,
    role: data?.role ?? null,
    notifiableEvents: data?.notifiable_events ?? [],
    emailableEvents: data?.emailable_events ?? [],
    choices: data?.choices ?? null,
    loading,
    error,
    reload: load,
    savePreferences,
  }
}
