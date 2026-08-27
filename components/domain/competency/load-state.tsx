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
 * A 404 here means ONE precise thing, and it is worth saying.
 *
 * These endpoints are new. A server running an older build has no route for
 * them, so it answers 404 - which as raw text ("API Error: 404 Not Found")
 * sends people looking for a missing record. It is not missing data, it is a
 * missing deployment, and only one of those is the reader's problem.
 */
export function describeFailure(message: string): { title: string; description: string } {
  if (/404|not found/i.test(message)) {
    return {
      title: 'This screen needs a newer backend',
      description:
        'These endpoints are not available on the server this app is talking to. '
        + 'Nothing is wrong with your data - the server has not been updated yet.',
    }
  }
  if (/503|not configured/i.test(message)) {
    return {
      title: 'AI is not configured on this server',
      description:
        'The classification pass needs a DeepSeek key on the server. Nothing was '
        + 'written, and no task was guessed at.',
    }
  }
  // The server refused BEFORE sending, so nothing was charged. Worth its own
  // title: this is not a fault to retry, it is an account that needs topping up.
  if (/balance is too low|Refusing to call DeepSeek/i.test(message)) {
    return { title: 'AI credit is too low to run this', description: message }
  }
  // Billed and unusable — the one failure that costs money. Say so.
  if (/ran out of room before finishing|too large for a single pass/i.test(message)) {
    return { title: 'That role is too large for one pass', description: message }
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
