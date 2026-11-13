import { buildApiUrl } from '@/services/core'
import { readLaravelSession } from '@/lib/laravel-session'

/**
 * Starting a research run, and the server's refusals of it. The shared client's error (`ApiError`) keeps only `message`, `errors` and `detail`; the refusal
 * of a run carries more that the person needs: a `code` ("product_not_configured", "already_running", "cooldown"), the list of what a product still
 * `missing`, and how long to wait. This module keeps them. Both the Generate Signals button and the Signal Review's Generate dialog start runs through it.
 */

/** The server refused to start a run. Its own class, not an ApiError, because the refusal's `code`, `missing` list and wait time are the whole point. */
export class RunRefusalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    /** What the product or sub-product still lacks, in the server's words (empty for any other refusal). */
    readonly missing: string[],
    readonly retryAfterSeconds: number | null,
  ) {
    super(message)
    this.name = 'RunRefusalError'
  }
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null)
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/** The server's refusal as an error that keeps everything the screen needs to explain it. */
export function refusalFrom(status: number, payload: unknown, retryAfterHeader: string | null = null): RunRefusalError {
  const body = (payload && typeof payload === 'object' ? payload : {}) as { message?: unknown; code?: unknown; missing?: unknown; retry_after_seconds?: unknown }
  const missing = Array.isArray(body.missing) ? body.missing.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : []
  const header = retryAfterHeader !== null && retryAfterHeader.trim() !== '' ? Number(retryAfterHeader) : null
  const retry = count(body.retry_after_seconds) ?? (header !== null && Number.isFinite(header) ? header : null)

  return new RunRefusalError(text(body.message) ?? `The run could not be started (${status}).`, status, text(body.code), missing, retry)
}

/**
 * POSTs JSON the way the shared client does (the same base address, `Accept`, `Content-Type` and the bearer token), but a refusal keeps its whole body:
 * it is thrown as a RunRefusalError. A request that never got an answer (no connection) is thrown as it is, a TypeError, so a screen can tell it from a refusal.
 */
export async function postRefusing<T>(endpoint: string, body: unknown): Promise<T> {
  const token = readLaravelSession()?.token
  const response = await fetch(buildApiUrl(endpoint), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) throw refusalFrom(response.status, payload, response.headers.get('Retry-After'))
  // An "ok" answer that is not JSON is neither a refusal nor a start: it is said as what it is, not left to fail later as a missing connection.
  if (payload === null) throw new Error('The server answered with something this screen cannot read.')
  return payload as T
}
