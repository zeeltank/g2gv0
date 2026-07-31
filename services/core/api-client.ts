/**
 * Core API Client
 * Base HTTP client for all API calls
 */

import { resolveApiBaseUrl, resolveWebBaseUrl } from '@/lib/api-config'

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

/**
 * Absolute URL for an API endpoint, for the cases fetch cannot serve: a file
 * download that has to reach the browser's download manager, or an href the
 * user can copy. Everything else should go through apiClient.
 */
export function buildApiUrl(endpoint: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString()
  return `${API_BASE_URL}${endpoint}${query ? `?${query}` : ''}`
}
