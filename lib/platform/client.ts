/**
 * The Platform Services transport.
 *
 * ── WHY IT REUSES `AiApiError` RATHER THAN DECLARING ITS OWN ────────────────
 *
 * The backend deliberately serves both APIs through the same envelope —
 * `PlatformController` extends `AiController` for exactly that reason — so a second
 * error class would parse an identical payload into an identical shape under a
 * different name. Every `catch` would then have to test for two types that mean the
 * same thing, and the first one somebody forgets is the one that renders a raw status
 * code where the server had already written a sentence.
 *
 * `describeAiError` comes along for the same reason: it lifts the first field error
 * ahead of the generic message, which is the half that says what to do about it.
 *
 * ── WHY NOT `services/core/api-client.ts` ───────────────────────────────────
 *
 * That client parses `{status, message, data}` — this application's older envelope. The
 * platform endpoints answer `{success, message, data, errors}`. Sending them through a
 * parser written for a different shape would read `status` off a body that has none and
 * treat every success as a failure.
 */

import { resolveApiBaseUrl } from '@/lib/api-config'
import { readLaravelSession } from '@/lib/laravel-session'
import { AiApiError } from '@/lib/intelligence/client'

export { AiApiError as PlatformApiError, describeAiError as describePlatformError } from '@/lib/intelligence/client'

interface PlatformEnvelope<T> {
  success: boolean
  message: string
  data: T | null
  errors?: Record<string, string[]> | null
}

function readSession(): { token: string } | null {
  const session = readLaravelSession()

  if (!session?.token) return null

  return { token: String(session.token) }
}

/**
 * `resolveApiBaseUrl()` already ends in `/api`, so platform routes hang off `/platform`
 * to match `routes/platform.php`'s `api/platform` prefix.
 */
function platformUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = `${resolveApiBaseUrl()}/platform${path}`

  if (!params) return url

  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    search.set(key, String(value))
  }

  const query = search.toString()

  return query ? `${url}?${query}` : url
}

export async function platformRequest<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown },
): Promise<T> {
  const session = readSession()

  if (!session) {
    throw new AiApiError('Sign in to use Platform Services.', 401)
  }

  const body = init?.body

  const response = await fetch(platformUrl(path, params), {
    method: init?.method ?? 'GET',
    // These screens report what the platform is doing right now. A cached answer is a
    // stale answer presented as a live one, which on a monitoring screen is the whole
    // failure mode.
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  const text = await response.text()
  let payload: PlatformEnvelope<T>

  try {
    payload = (text.trim() ? JSON.parse(text) : {}) as PlatformEnvelope<T>
  } catch {
    throw new AiApiError('Platform Services returned a non-JSON response.', response.status)
  }

  if (!response.ok || payload.success === false) {
    throw new AiApiError(
      payload.message || `The request failed (${response.status}).`,
      response.status,
      payload.errors ?? {},
    )
  }

  return payload.data as T
}

/** The paged envelope every platform list returns. */
export interface PlatformPage<T> {
  rows: T[]
  total: number
  page: number
  per_page: number
  has_more: boolean
}
