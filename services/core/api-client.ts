/**
 * Core API Client
 * Base HTTP client for all API calls
 */

import { resolveApiBaseUrl, resolveWebBaseUrl } from '@/lib/api-config'
import { readLaravelSession } from '@/lib/laravel-session'

/**
 * The caller's Sanctum token as an `Authorization: Bearer` header.
 *
 * Tokens were previously sent only as a `token` query parameter. A URL is not a
 * private place: it is written to web server access logs, browser history,
 * proxy and CDN logs, and leaks through the `Referer` header on any outbound
 * link. A token harvested from a log is a working credential.
 *
 * Laravel accepts either form (`$request->bearerToken() ?: $request->input('token')`),
 * so sending the header costs nothing and is the shape to keep. The query
 * parameter is still sent by individual callers for now; once every one of them
 * has been migrated, the backend's `?: $request->input('token')` fallback can be
 * dropped and the credential will have left the URL entirely.
 */
function authHeader(): Record<string, string> {
  const token = readLaravelSession()?.token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const API_BASE_URL = resolveApiBaseUrl()
const WEB_BASE_URL = resolveWebBaseUrl()

interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  params?: Record<string, string>
  /**
   * Opt-in only. Laravel's session cookie is needed by the /login web route
   * (config/cors.php sets supports_credentials, so the Origin is echoed back).
   * Every other endpoint authenticates with the token query param instead.
   */
  credentials?: RequestCredentials
}

/** Per-call transport overrides, kept separate from the payload arguments. */
export type RequestOptions = Pick<RequestConfig, 'headers' | 'credentials'>
export type MutationOptions = Pick<RequestConfig, 'headers' | 'credentials' | 'params'>

/** A download that is bigger than the caller said it would accept (see ApiClient.getFile). `code` lets callers tell it apart without importing this. */
export class ResponseTooLargeError extends Error {
  readonly code = 'too_large'

  constructor(readonly maxBytes: number) {
    super(`The file is larger than the ${Math.round(maxBytes / (1024 * 1024))} MB that is accepted.`)
    this.name = 'ResponseTooLargeError'
  }
}

/** Laravel replies with {message, errors} on 4xx - surface that instead of a bare status code. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: Record<string, string[]>,
    /**
     * The server's own explanation, where it gave one.
     *
     * Several endpoints answer with a short `message` plus a `detail` that says
     * what to actually DO about it. The AI generators are the clearest case:
     *
     *   message: "The assessment service did not return a usable result."
     *   detail:  "Refusing to call DeepSeek: the balance is USD -0.24, at or
     *             below the USD 1.00 floor... Top up the account, or lower the
     *             floor if this is deliberate."
     *
     * This class kept the first and discarded the second, so a user hit a
     * generic failure while the server had already diagnosed it precisely.
     */
    readonly detail?: string,
    /**
     * `two_factor_required` off the body — the password was right, and a code is
     * still needed.
     *
     * ── WHY A FEATURE FLAG SITS ON THE TRANSPORT CLASS ──────────────────────
     *
     * Because this is the last place the body exists. `buildApiError` parses the
     * response, lifts `message`, and throws the rest away; by the time the sign-in
     * screen has the error there is nothing left to inspect. Either the flag is
     * carried across here or the screen has to guess from the status code — and
     * "401 on /login means ask for a code" is a guess that silently becomes wrong
     * the day anything else there answers 401.
     *
     * It is deliberately NOT a general `payload: unknown` escape hatch: that would
     * invite every caller to dig through untyped server output, and this class
     * exists to stop exactly that.
     */
    readonly twoFactorRequired: boolean = false,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** message plus detail, for anywhere that shows one string to a person. */
  get fullMessage(): string {
    return this.detail ? `${this.message} ${this.detail}` : this.message
  }
}

async function buildApiError(response: Response) {
  try {
    const payload = (await response.clone().json()) as {
      message?: string
      errors?: Record<string, string[]>
      detail?: string
      error?: string
      two_factor_required?: boolean
    }

    if (payload?.message) {
      return new ApiError(
        payload.message,
        response.status,
        payload.errors,
        // `error` is the other name this codebase uses for the same thing.
        payload.detail ?? payload.error,
        payload.two_factor_required === true,
      )
    }
  } catch {
    // Non-JSON error body - fall through to the generic message.
  }

  return new ApiError(`API Error: ${response.status} ${response.statusText}`, response.status)
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { method = 'GET', headers = {}, body, params, credentials } = config

    let url = `${this.baseUrl}${endpoint}`
    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
    const response = await fetch(url, {
      method,
      headers: {
        /*
         * Accept is not optional, and its absence was silently costing every
         * field-level validation message in the product.
         *
         * Laravel decides between a 422 JSON body and a 302 redirect on
         * $request->expectsJson(). Without this header a failed validation came
         * back as a redirect to an HTML page, fetch followed it, buildApiError()
         * could not parse the body and fell through to the generic branch below.
         * The user was told "API Error" instead of which field was wrong, while
         * the server had generated the exact per-field messages and thrown them
         * away in transit.
         */
        Accept: 'application/json',
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...authHeader(),
        ...headers,
      },
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
      ...(credentials ? { credentials } : {}),
    })

    if (!response.ok) {
      throw await buildApiError(response)
    }

    return response.json()
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, string>,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params, ...options })
  }

  /**
   * A file, not a JSON envelope.
   *
   * F-209. The payslip route is `auth:sanctum`, so the browser cannot reach it
   * by navigation: an `<a href>` sends no Authorization header, and Laravel
   * answered 302 to /login. That redirect - not a payslip - is what every
   * employee got when they pressed Download on My HR.
   *
   * Appending `?token=` to the URL would also work, and is what the legacy
   * payroll routes still do. It is not done here: it would put a live
   * credential into browser history, access logs and Referer headers, which is
   * precisely what authHeader() above exists to stop. So the file is fetched
   * with the header and handed to the browser as a blob instead.
   *
   * Failures still arrive as JSON - 404 "You have no payslip for that month",
   * 409 "there is no salary structure on record for you" - so the same error
   * builder runs and the caller gets the server's own sentence rather than a
   * status code.
   */
  async getBlob(endpoint: string, params?: Record<string, string>): Promise<Blob> {
    /*
     * An absolute URL is passed through untouched. The payslip's is built by
     * the server and handed to the client in the payslip row, so the client
     * never assembles one - it cannot name a month, or a person, it was not
     * given. Relative endpoints resolve against the API base as usual.
     */
    let url = /^https?:\/\//.test(endpoint) ? endpoint : `${this.baseUrl}${endpoint}`
    if (params) url += `?${new URLSearchParams(params).toString()}`

    const response = await fetch(url, {
      // Accept both: a success is the file, a failure is JSON.
      headers: { Accept: 'application/pdf, application/json', ...authHeader() },
    })

    if (!response.ok) throw await buildApiError(response)

    return response.blob()
  }

  /**
   * A file as raw bytes and its Content-Type, with a ceiling on how much will be read.
   *
   * For files the page itself consumes rather than hands to the browser (a 3D model or an image that is posted into a sandboxed frame),
   * where a blob is the wrong shape and an unbounded read would let a wrong or hostile response fill the tab's memory. The ceiling is
   * enforced twice: on the declared `Content-Length`, before any of the body is read, and on the bytes actually received, because the
   * header can be absent or wrong. `maxBytes` may be a function of the response's Content-Type, so a picture can be held to less than a
   * model; it runs once, after the headers arrive and before the body is read. Anything but a plain 200 is an error; the server's own JSON
   * message is surfaced for a failure, as in getBlob.
   */
  async getFile(
    endpoint: string,
    {
      accept = '*/*',
      maxBytes = Number.POSITIVE_INFINITY,
      signal,
    }: { accept?: string; maxBytes?: number | ((contentType: string | null) => number); signal?: AbortSignal } = {},
  ): Promise<{ bytes: ArrayBuffer; contentType: string | null }> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      // The file on success, JSON on failure.
      headers: { Accept: `${accept}, application/json`, ...authHeader() },
      signal,
    })

    if (!response.ok) throw await buildApiError(response)
    if (response.status !== 200) {
      void response.body?.cancel().catch(() => undefined)
      throw new ApiError(`API Error: ${response.status} ${response.statusText}`, response.status)
    }

    const contentType = response.headers.get('Content-Type')
    const limit = typeof maxBytes === 'function' ? maxBytes(contentType) : maxBytes

    const declared = response.headers.get('Content-Length')
    if (declared !== null && declared.trim() !== '' && Number(declared) > limit) {
      void response.body?.cancel().catch(() => undefined)
      throw new ResponseTooLargeError(limit)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      const whole = await response.arrayBuffer()
      if (whole.byteLength > limit) throw new ResponseTooLargeError(limit)
      return { bytes: whole, contentType }
    }

    const chunks: Uint8Array[] = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > limit) {
        await reader.cancel().catch(() => undefined)
        throw new ResponseTooLargeError(limit)
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { bytes: bytes.buffer, contentType }
  }

  async post<T>(endpoint: string, body: unknown, options?: MutationOptions): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body, ...options })
  }

  async postForm<T>(endpoint: string, body: FormData): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body })
  }

  async put<T>(endpoint: string, body: unknown, options?: MutationOptions): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body, ...options })
  }

  async patch<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body })
  }

  async putForm<T>(endpoint: string, body: FormData): Promise<T> {
    body.append('_method', 'PUT')
    return this.request<T>(endpoint, { method: 'POST', body })
  }

  async delete<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', params })
  }

  /**
   * DELETE with a JSON body, for the rare endpoint that needs to send more
   * than scalar ids - e.g. an array of task ids to bulk-delete. `delete()`
   * only carries `params` (a flat query string), which cannot express an
   * array the way PHP's `task_ids[]=` convention would without hand-built
   * query encoding; a real body is simpler and matches put()/patch() below.
   */
  async deleteWithBody<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', body })
  }
}

export const apiClient = new ApiClient()
export const webClient = new ApiClient(WEB_BASE_URL)
export { ApiClient }

/**
 * Absolute URL for an API endpoint, for the cases fetch cannot serve: a file
 * download that has to reach the browser's download manager, or an href the
 * user can copy. Everything else should go through apiClient.
 */
export function buildApiUrl(endpoint: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString()
  return `${API_BASE_URL}${endpoint}${query ? `?${query}` : ''}`
}

/**
 * Same as buildApiUrl but for the Laravel *web* root (no /api prefix) - the
 * routes declared in routes/web.php, routes/settings.php and routes/lms.php,
 * such as /table_data and /settings/organization_data. Server-side callers
 * (the conversational AI gateway) need the absolute form.
 */
export function buildWebUrl(endpoint: string, params?: Record<string, string>) {
  const url = `${WEB_BASE_URL}${endpoint}`
  if (!params) return url
  return `${url}?${new URLSearchParams(params).toString()}`
}
