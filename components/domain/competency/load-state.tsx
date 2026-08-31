'use client'

/**
 * THE LADDER: error, then loading, then empty, then content. Never merged.
 *
 * The first version of the assessment console set `rows` to `[]` when a request
 * failed and then rendered "No assessments have been generated yet." underneath
 * the error - so a failed fetch reported itself as an empty organisation. This
 * codebase calls that the dead-bell lie and forbids it in four other places.
 *
 * It lived inside `cm-assessment-console.tsx` until the ESO screens needed the
 * same ladder. Copying it would have made a second answer to one question and
 * given the two copies room to drift, so it moved here and the console imports
 * it. Nothing about its behaviour changed in the move.
 */

import type { ReactNode } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Turn a failure into something a person can act on.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE STATUS CODE DECIDES. THE PROSE ONLY REFINES.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This used to branch on the MESSAGE TEXT alone, and that made the wording of a
 * backend sentence load-bearing: rewording one string on the server silently
 * reclassified the error here, with nothing to catch it.
 *
 * It also could not tell two opposite failures apart. The ESO endpoint returned
 * 502 for "the model's answer did not fit" — the same status nginx returns when
 * PHP never answered at all. One is retryable with a bigger budget; the other
 * means the server is down. The backend now separates them (truncation is 422,
 * a genuinely failed upstream is 502), and this reads the status first so the
 * two can never be confused again.
 *
 * `status` is optional so existing callers that only have a string still work —
 * they simply fall back to the prose tests, as before.
 */
export function describeFailure(
  message: string,
  status?: number,
): { title: string; description: string } {
  // A genuine gateway failure. The server did not answer at all, so there is no
  // application message to read and nothing about the user's data is at fault.
  if (status === 502 || status === 504) {
    return {
      title: 'The server did not respond',
      description:
        'The request reached the gateway but the application never answered. '
        + 'Nothing was written. This is a server problem, not a problem with your data.',
    }
  }

  // Billed and unusable — the one failure that costs money. Say so.
  // 422 is the backend's "the answer would not fit"; the prose test keeps older
  // servers that still send 502 for this working.
  if (status === 422 || /ran out of room before finishing|too large for a single pass/i.test(message)) {
    return {
      title: 'The draft did not fit in one pass',
      description: message,
    }
  }

  if (status === 402 || /balance is too low|Refusing to call DeepSeek/i.test(message)) {
    // Refused BEFORE sending, so nothing was charged. Not a fault to retry —
    // an account that needs topping up.
    return { title: 'AI credit is too low to run this', description: message }
  }

  if (status === 503 || /503|not configured/i.test(message)) {
    return {
      title: 'AI is not configured on this server',
      description:
        'The classification pass needs a DeepSeek key on the server. Nothing was '
        + 'written, and no task was guessed at.',
    }
  }

  /*
   * 404 IS ONLY A MISSING DEPLOYMENT WHEN THE SERVER SAYS NOTHING ELSE.
   *
   * The old version matched /404|not found/ against the message, which caught
   * any server sentence containing the words "not found" — including a real
   * missing record — and told the reader their backend was out of date.
   * The status is checked instead, and a server that sent its own explanation
   * gets to keep it.
   */
  if (status === 404 || (status === undefined && /API Error: 404/i.test(message))) {
    const routeMissing = /API Error: 404/i.test(message)
    return {
      title: routeMissing ? 'This screen needs a newer backend' : 'Not found',
      description: routeMissing
        ? 'These endpoints are not available on the server this app is talking to. '
          + 'Nothing is wrong with your data - the server has not been updated yet.'
        : message,
    }
  }

  return { title: 'Could not load this', description: message }
}

export function LoadState({
  error,
  rows,
  onRetry,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  rowHeight = 'h-14',
  children,
}: {
  error: string | null
  /** `null` means still loading. `[]` means genuinely empty. Never `[]` on failure. */
  rows: unknown[] | null
  onRetry: () => void
  emptyIcon: ReactNode
  emptyTitle: string
  emptyDescription: string
  rowHeight?: string
  children: ReactNode
}) {
  /*
   * DATA THAT LOADED STAYS ON SCREEN WHEN AN ACTION FAILS.
   *
   * This used to check `error` first unconditionally, so a failed Classify or
   * Approve replaced an already-populated list with a full-bleed error - while
   * the caller ALSO rendered the same message inline above it. Two copies of one
   * message, and the data you were looking at gone.
   *
   * An error only takes the whole surface when there is nothing to show. Once
   * rows have arrived, the failure belongs beside them, not instead of them -
   * the caller renders it inline.
   */
  if (error && rows === null) {
    const { title, description } = describeFailure(error)
    return <ErrorState title={title} description={description} retry={onRetry} />
  }
  // Skeletons SHAPED LIKE THE ROWS, not a grey slab - a loading state should
  // tell you what is arriving.
  if (rows === null) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className={cn(rowHeight, 'w-full rounded-xl')} />)}
      </div>
    )
  }
  if (rows.length === 0) {
    return <EmptyState className="border-0" icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
  }
  return <>{children}</>
}
