/**
 * What a failed Intelligence request means to the person looking at the screen.
 *
 * The server's answers are few and each says something different: 401 the session ended, 403 Intelligence is not available for THIS account (not a fault: a
 * role or a right, and a host screen must show nothing intrusive), 503 it is switched off, 429 too many requests, anything else a plain failure. The message
 * is fixed wording written here: a server message (which may carry a table name or a stack trace on a bad day) is never shown.
 */
export type IntelligenceFailureKind = 'unauthenticated' | 'forbidden' | 'unavailable' | 'rate_limited' | 'generic'

export interface IntelligenceFailure {
  kind: IntelligenceFailureKind
  /** Fixed, friendly wording. */
  message: string
  /** Whether a retry can help (forbidden and unauthenticated cannot be fixed by pressing a button). */
  retryable: boolean
}

const FAILURES: Record<IntelligenceFailureKind, IntelligenceFailure> = {
  unauthenticated: { kind: 'unauthenticated', message: 'Your session has ended. Sign in again to see Intelligence.', retryable: false },
  forbidden: { kind: 'forbidden', message: 'Intelligence is not available for your account.', retryable: false },
  unavailable: { kind: 'unavailable', message: 'Intelligence is switched off for this organisation right now.', retryable: true },
  rate_limited: { kind: 'rate_limited', message: 'Too many requests just now. Wait a moment and try again.', retryable: true },
  generic: { kind: 'generic', message: 'Intelligence could not be loaded. Try again.', retryable: true },
}

/** Reads the HTTP status off whatever was thrown, without importing the transport (an ApiError carries `status`). */
function statusOf(error: unknown): number | null {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status
    if (typeof status === 'number') return status
  }
  return null
}

export function classifyIntelligenceError(error: unknown): IntelligenceFailure {
  switch (statusOf(error)) {
    case 401:
      return FAILURES.unauthenticated
    case 403:
      return FAILURES.forbidden
    case 503:
      return FAILURES.unavailable
    case 429:
      return FAILURES.rate_limited
    default:
      return FAILURES.generic
  }
}
