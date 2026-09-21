'use client'

/**
 * The one HTTP client for the AI & Intelligence API.
 *
 * WHY THIS IS NOT `services/core/api-client.ts`
 *
 * That client returns Laravel's `{status, message, data}` shape and throws `ApiError`.
 * The AI API answers with `{success, message, data, errors}` — the envelope LMS K-12's
 * AI API uses — because the screens above it are ported from there and giving them a
 * second envelope to handle would mean rewriting every one of them for no gain. The
 * two clients therefore exist side by side, and the AI one is deliberately small.
 *
 * NOTHING HERE NAMES AN ORGANISATION
 *
 * The organisation is not a parameter. `AiContextHydrator` derives it on the server
 * from the caller's Sanctum token, so the only thing this file sends is that token.
 * There is no default `sub_institute_id` in this file and there must never be one —
 * a fallback tenant id is how one organisation's console ends up showing another
 * organisation's rows.
 *
 * The header below is the one exception, and it is not a way around that rule: it is
 * read from the signed-in session and the server ignores it for any caller who has an
 * organisation of their own. It exists for the platform-owner case, where the token's
 * owner legitimately has none.
 */

import { resolveAiBaseUrl } from '@/lib/api-config'
import { readLaravelSession } from '@/lib/laravel-session'

/** The envelope every `/api/ai/*` route returns. */
export interface AiEnvelope<T> {
  success: boolean
  message: string
  data: T | null
  errors?: Record<string, string[]> | null
}

/**
 * A failed AI API call.
 *
 * `fieldErrors` carries Laravel's per-field validator messages so a form can mark its
 * own inputs, rather than showing one sentence above a form with six fields in it.
 */
export class AiApiError extends Error {
  readonly status: number

  readonly fieldErrors: Record<string, string[]>

  constructor(message: string, status: number, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.name = 'AiApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/**
 * The signed-in session, read from where the rest of the app keeps it.
 *
 * Returns null when there is no token — the caller renders a signed-out state rather
 * than firing a request that can only 401.
 */
function readSession(): { token: string; instituteId: string } | null {
  const session = readLaravelSession()

  if (!session?.token) return null

  return {
    token: String(session.token),
    instituteId: String(session.sub_institute_id ?? '').trim(),
  }
}

/**
 * `resolveAiBaseUrl()` already ends in `/api`, so AI routes hang off `/ai`.
 *
 * It is that function rather than `resolveApiBaseUrl()` so the AI backend can be
 * pointed at a different host from the rest of the API — see its note. On a
 * single-host deployment the two are the same value.
 */
function aiUrl(path: string): string {
  return `${resolveAiBaseUrl()}/ai${path}`
}

export async function aiRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const session = readSession()

  if (!session) {
    throw new AiApiError('Sign in to use AI & Intelligence.', 401)
  }

  const response = await fetch(aiUrl(path), {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      // Only sent when the session actually carries one. An empty header is worse
      // than none: it reads as a deliberate request for organisation "".
      ...(session.instituteId ? { 'X-AI-Institute-Id': session.instituteId } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  const text = await response.text()
  let payload: AiEnvelope<T>

  try {
    payload = (text.trim() ? JSON.parse(text) : {}) as AiEnvelope<T>
  } catch {
    throw new AiApiError('The AI console returned a non-JSON response.', response.status)
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

/**
 * The most useful sentence an error carries.
 *
 * Laravel answers a rejected write with a generic `message` ("The request was not
 * valid.") and the reason in `errors`, one entry per field. Showing only `message`
 * throws away the half that says what to do — the template validator's "a published
 * template must include at least one data variable…" is a paragraph of guidance that
 * arrived and was discarded, leaving the author staring at a form that says nothing
 * is wrong with it.
 *
 * So the first field error wins where there is one, and `message` is the fallback.
 * Non-`AiApiError` failures (a dropped connection) keep their own message, and an
 * unrecognised throw gets a sentence rather than "[object Object]".
 */
export function describeAiError(cause: unknown, fallback = 'The request failed.'): string {
  if (cause instanceof AiApiError) {
    const first = Object.values(cause.fieldErrors ?? {}).flat()[0]

    return first || cause.message || fallback
  }

  return cause instanceof Error ? cause.message : fallback
}
