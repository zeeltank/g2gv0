/** How long a connector action may wait for the server before the screen stops waiting. */
export const REQUEST_TIMEOUT_MS = 45_000

/** The server did not answer in time. The request itself may still finish; the screen simply stops waiting so a button is never locked for good. */
export class RequestTimeoutError extends Error {
  constructor(seconds: number) {
    super(`The server did not answer within ${seconds} seconds, so the screen stopped waiting. It may still have finished: refresh to see what really happened.`)
    this.name = 'RequestTimeoutError'
  }
}

/**
 * Races a request against a timer. The shared API client has no timeout of its own, so without this a request the server never answers leaves its
 * spinner and its disabled buttons in place for ever. The timer is always cleared. The request is not cancelled (the server may complete it).
 */
export function withTimeout<T>(work: Promise<T>, ms: number = REQUEST_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError(Math.max(1, Math.round(ms / 1000)))), ms)
  })

  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
