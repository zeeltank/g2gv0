import { apiClient, buildApiUrl } from '@/services/core'
import { readLaravelSession } from '@/lib/laravel-session'
import { AskApiError } from './ask-errors'
import { parseAnswer, parseConversation, parseConversationsPage } from './ask-parse'
import type { AskApi, AskEnvelope, AskRequest } from './ask-types'

/** A question takes two model calls on the server; past this the screen stops waiting (the question may still be answered and stored: it is in Conversations). */
export const ASK_TIMEOUT_MS = 90_000

export const TIMEOUT_TEXT = 'The assistant took too long to answer. If it answers late, you will find the question under Conversations.'
export const UNREADABLE_TEXT = 'The assistant sent an answer this screen could not read. Try again.'

const idPath = (id: number | string) => encodeURIComponent(String(id))

/** Query values as strings, with a missing value left out entirely so the server applies no filter. */
export function askQuery(params: object): Record<string, string> {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query[key] = String(value)
  }
  return query
}

/** The body of a POST /agent/ask as the API takes it: `conversation_id` and `context` are left out when there are none, so the server starts a new chat with no record. */
export function askBody(request: AskRequest): Record<string, unknown> {
  return {
    message: request.message,
    ...(request.conversationId ? { conversation_id: request.conversationId } : {}),
    ...(request.context ? { context: { type: request.context.type, id: request.context.id } } : {}),
  }
}

/**
 * A POST that keeps the refusal's whole body (not apiClient.post: its error keeps only message/errors/detail, and the `code` of a refusal and the day's `limit`
 * would be lost). Same URL, token and headers as the shared client. It gives up after `timeoutMs`, so one question can never hold the chat for ever.
 */
async function post(path: string, body: unknown, timeoutMs: number): Promise<{ status?: unknown; message?: unknown; data?: unknown }> {
  const token = readLaravelSession()?.token
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(buildApiUrl(path), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const payload: unknown = await response.json().catch(() => null)
    const answer = (payload && typeof payload === 'object' ? payload : {}) as { status?: unknown; message?: unknown; data?: unknown; code?: unknown; limit?: unknown; errors?: Record<string, string[]>; detail?: unknown }
    if (response.ok) {
      if (payload === null) throw new AskApiError(UNREADABLE_TEXT, response.status, undefined, undefined, 'bad_response', null)
      return answer
    }
    throw new AskApiError(
      typeof answer.message === 'string' && answer.message !== '' ? answer.message : `API Error: ${response.status} ${response.statusText}`,
      response.status,
      answer.errors,
      typeof answer.detail === 'string' ? answer.detail : undefined,
      typeof answer.code === 'string' ? answer.code : null,
      typeof answer.limit === 'number' && Number.isFinite(answer.limit) && answer.limit > 0 ? Math.trunc(answer.limit) : null,
    )
  } catch (error) {
    if (error instanceof AskApiError) throw error
    if (controller.signal.aborted) throw new AskApiError(TIMEOUT_TEXT, 0, undefined, undefined, 'timeout', null)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The Ask API (hp_erp `/api/agent`). The organisation and the person come from the bearer token the shared client sends, never from a parameter. A refusal
 * arrives as an ApiError with `status` (403 no right, 404, 422 invalid, 429 the day's cap); the question throws an AskApiError, which also keeps the body's
 * `code` and the cap. Everything that comes back is read through ask-parse.ts, so a body this screen does not understand is an error, never a crash.
 */
export function createAskService(options: { timeoutMs?: number } = {}): AskApi {
  const timeoutMs = options.timeoutMs ?? ASK_TIMEOUT_MS
  return {
    async ask(request) {
      const response = await post('/agent/ask', askBody(request), timeoutMs)
      const data = parseAnswer(response.data)
      if (response.status !== 1 || data === null) {
        const said = typeof response.message === 'string' && response.message !== '' ? response.message : UNREADABLE_TEXT
        throw new AskApiError(response.status === 1 ? UNREADABLE_TEXT : said, 502, undefined, undefined, 'bad_response', null)
      }
      return { status: 1, data }
    },

    async conversations(params) {
      const response = await apiClient.get<{ status?: number; message?: string; data?: unknown }>('/agent/conversations', askQuery(params))
      return { status: response.status ?? 1, message: response.message, data: parseConversationsPage(response.data) } satisfies AskEnvelope<ReturnType<typeof parseConversationsPage>>
    },

    async conversation(id) {
      const response = await apiClient.get<{ status?: number; message?: string; data?: unknown }>(`/agent/conversations/${idPath(id)}`)
      const data = parseConversation(response.data)
      if (data === null) throw new AskApiError(UNREADABLE_TEXT, 502, undefined, undefined, 'bad_response', null)
      return { status: response.status ?? 1, message: response.message, data }
    },
  }
}

export const askService: AskApi = createAskService()
