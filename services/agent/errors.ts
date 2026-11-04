import { ApiError } from '@/services/core'
import type { AgentProposal } from './types'

/**
 * A refusal from the agent API that keeps the whole body. ApiError keeps only message, errors and detail; the agent API also answers with a `code`
 * (`agent_off`, `daily_cap`, `already_running`, `already_decided`, `could_not_apply`) that decides what a screen says, and a 409 on a proposal carries the
 * proposal as it now stands, so the screen can show what became of it without asking again.
 */
export class AgentApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    errors: Record<string, string[]> | undefined,
    detail: string | undefined,
    readonly code: string | null,
    readonly proposal: AgentProposal | null,
  ) {
    super(message, status, errors, detail)
    this.name = 'AgentApiError'
  }
}
