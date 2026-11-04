import type { DecisionConflictBody } from './types'

/**
 * The server refused a decision with a 409: either someone decided first (`conflict`) or the decision changes nothing (`unchanged`).
 *
 * It is its own class, not an ApiError, because the shared client's error keeps only `message`, `errors` and `detail`. The body's `code` and `current`
 * (the decision that got there first) are the whole point of a 409 here, and they would be thrown away on the way to the screen.
 */
export class DecisionConflictError extends Error {
  readonly status = 409

  constructor(readonly body: DecisionConflictBody) {
    super(body.message)
    this.name = 'DecisionConflictError'
  }
}

export function isDecisionConflict(error: unknown): error is DecisionConflictError {
  return error instanceof DecisionConflictError
}
