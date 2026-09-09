import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * "May I create organisations?"
 *
 * ── WHY A SEPARATE ENDPOINT ─────────────────────────────────────────────────
 *
 * Everything under `/api/platform/*` is behind `platform.owner`, which refuses
 * with 404 - deliberately, so an ordinary administrator is not told a
 * tenant-creation endpoint exists. That is right for the actions and useless
 * for the navigation: a menu cannot tell a 404-because-forbidden from a
 * 404-because-the-server-moved, and it must not hide an entry because the
 * network hiccuped.
 *
 * So the ACTIONS are guarded and the FACT is reported. This endpoint answers
 * truthfully for anybody signed in.
 *
 * ── IT IS A COURTESY, NOT A CONTROL ─────────────────────────────────────────
 *
 * Hiding a menu item is presentation. Somebody who forges `is_platform_owner`
 * in their own browser gets a screen whose every request is still refused
 * server-side. The frontend may be wrong about what to show; never about what
 * it may fetch.
 */

export type PlatformMe = {
  status: boolean
  data: { is_platform_owner: boolean }
}

export const platformMeService = {
  get: (context: LaravelContext) =>
    apiClient.get<PlatformMe>('/platform/me', {
      ...(context.token ? { type: 'api', token: context.token } : {}),
    }),
}
