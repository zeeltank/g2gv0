import { ApiError } from '@/services/core'
import type { Fact } from './types'

/**
 * A refusal from the facts API that keeps the whole body. ApiError keeps only message, errors and detail; the facts API also answers with a `code`
 * (`not_pending`, `entity_gone`, `no_right`) that decides what a screen says, and a 409 on a fact carries the fact as it now stands, so the screen can show
 * what became of it without asking again.
 */
export class FactsApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    errors: Record<string, string[]> | undefined,
    detail: string | undefined,
    readonly code: string | null,
    readonly fact: Fact | null,
  ) {
    super(message, status, errors, detail)
    this.name = 'FactsApiError'
  }
}
