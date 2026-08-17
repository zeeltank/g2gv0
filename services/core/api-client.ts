/**
 * Core API Client
 * Base HTTP client for all API calls
 */

function resolveConfiguredBaseUrl() {
  const configuredBase =
    process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_API_BASE_URL_PROD
      : process.env.NEXT_PUBLIC_API_BASE_URL_DEV

  const fallbackBase = process.env.NEXT_PUBLIC_API_URL || ''
  return (configuredBase || fallbackBase).trim().replace(/\/+$/, '')
}

function resolveApiBaseUrl() {
  const rawBase = resolveConfiguredBaseUrl()

  if (!rawBase) return '/api'

  return rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`
}

function resolveWebBaseUrl() {
  const rawBase = resolveConfiguredBaseUrl()
  if (!rawBase) return ''
  return rawBase.endsWith('/api') ? rawBase.slice(0, -4) : rawBase
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

/** Laravel replies with {message, errors} on 4xx - surface that instead of a bare status code. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function buildApiError(response: Response) {
  try {
    const payload = (await response.clone().json()) as {
      message?: string
      errors?: Record<string, string[]>
    }

    if (payload?.message) {
      return new ApiError(payload.message, response.status, payload.errors)
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
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
}

export const apiClient = new ApiClient()
export const webClient = new ApiClient(WEB_BASE_URL)
export { ApiClient }

export function buildApiUrl(endpoint: string, params?: Record<string, string>) {
  const url = `${API_BASE_URL}${endpoint}`
  if (!params) return url
  return `${url}?${new URLSearchParams(params).toString()}`
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
