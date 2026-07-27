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
}

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
    const { method = 'GET', headers = {}, body, params } = config

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
    })

    if (!response.ok) {
      throw await buildApiError(response)
    }

    return response.json()
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params })
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body })
  }

  async postForm<T>(endpoint: string, body: FormData): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body })
  }

  async put<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body })
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
