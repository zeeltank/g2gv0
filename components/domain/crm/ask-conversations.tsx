'use client'

import { forwardRef } from 'react'
import { conversationMeta, conversationTitle } from '@/lib/ask/model'
import type { ListState } from '@/lib/ask/session'
import { cn } from '@/lib/utils'

/**
 * The person's earlier conversations. Each is a button that opens it; the title and the details wrap (a long question never widens the panel). The states are
 * said in words: loading, empty, an error with a way to try again, and "Show more" while there are more pages.
 */

interface Props {
  list: ListState
  openId: number | null
  onOpen: (id: number) => void
  onMore: () => void
  onRetry: () => void
  onBack: () => void
}

const BUTTON = 'rounded-lg border bg-card px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600'

export const ConversationList = forwardRef<HTMLHeadingElement, Props>(function ConversationList({ list, openId, onOpen, onMore, onRetry, onBack }, headingRef) {
  const hasMore = list.pagination !== null && list.pagination.page < list.pagination.last_page
  return (
    <div className="relative min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 ref={headingRef} tabIndex={-1} className="text-sm font-semibold focus:outline-none">Conversations</h3>
        <button type="button" onClick={onBack} className={BUTTON}>Back to chat</button>
      </div>

      {list.status === 'loading' && <p role="status" className="text-xs text-muted-foreground">Loading your conversations…</p>}

      {list.status === 'error' && (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive bg-card px-3 py-2 text-xs text-foreground">
          <p className="break-words">{list.error}</p>
          <button type="button" onClick={onRetry} className={BUTTON}>Retry</button>
        </div>
      )}

      {list.status === 'ready' && list.rows.length === 0 && <p className="text-xs text-muted-foreground">No earlier conversations yet. Ask a question and it will be kept here.</p>}

      {list.rows.length > 0 && (
        <ul className="space-y-1.5">
          {list.rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onOpen(row.id)}
                aria-current={row.id === openId ? 'true' : undefined}
                className={cn('block w-full min-w-0 text-left', BUTTON)}
              >
                <span className="block break-words text-sm font-medium text-foreground">{conversationTitle(row)}</span>
                <span className="mt-0.5 block break-words text-muted-foreground">{conversationMeta(row)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasMore && <button type="button" disabled={list.loadingMore} onClick={onMore} className={cn('w-full', BUTTON)}>{list.loadingMore ? 'Loading…' : 'Show more'}</button>}
    </div>
  )
})
