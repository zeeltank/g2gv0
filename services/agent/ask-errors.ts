import { ApiError } from '@/services/core'

/**
 * A refusal from the Ask API that keeps the whole body. ApiError keeps only message, errors and detail; Ask also answers with a `code` that decides what the
 * chat says: `daily_limit` (429, with the day's `limit`), `not_found` (404, a conversation that is not the caller's or is gone: a 404 WITHOUT this code means
 * the route is not deployed), `empty_question` (422). `timeout` is made here, when the server did not answer in time.
 */
export class AskApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    errors: Record<string, string[]> | undefined,
    detail: string | undefined,
    readonly code: string | null,
    /** The day's question cap, on a `daily_limit` refusal; null when the server did not say. */
    readonly limit: number | null,
  ) {
    super(message, status, errors, detail)
    this.name = 'AskApiError'
  }
}
