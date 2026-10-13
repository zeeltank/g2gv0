'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useChatActions } from './chat-actions-context'

/**
 * The approval queue inside the chat.
 *
 * Two lists, both from the server's ledger and both empty for most people: requests awaiting an
 * administrator's decision (the server refuses everyone else, so an ordinary user sees none),
 * and the caller's own requests that were approved while the chat was closed and still need to
 * run. Renders nothing when there is nothing to do.
 */
export function ApprovalsPanel() {
  const actions = useChatActions()
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!actions) return null

  const { pending, mine, decide, resume } = actions.approvals
  if (pending.length === 0 && mine.length === 0) return null

  const act = async (id: number, decision: 'approved' | 'rejected') => {
    setBusy(id)
    setError(null)
    try {
      await decide(id, decision)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The decision could not be saved.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mb-3 space-y-2 rounded-2xl border border-border/70 bg-card p-3 text-sm shadow-sm">
      {pending.length > 0 && (
        <>
          <p className="flex items-center gap-2 text-xs font-medium text-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Waiting for your approval ({pending.length})
          </p>
          {pending.map((request) => (
            <div key={request.id} className="space-y-1 rounded-xl border border-border/60 p-2">
              <p className="font-medium text-foreground">{request.preview?.title ?? request.action_key}</p>
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 text-xs">
                {(request.preview?.lines ?? []).map((line) => (
                  <div key={line.label} className="contents">
                    <dt className="text-muted-foreground">{line.label}</dt>
                    <dd className="break-words text-foreground">{line.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex gap-2 pt-1">
                <Button type="button" size="sm" disabled={busy === request.id} onClick={() => act(request.id, 'approved')}>
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === request.id}
                  onClick={() => act(request.id, 'rejected')}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </>
      )}
      {mine.length > 0 && (
        <>
          <p className="text-xs font-medium text-foreground">Approved - ready to run ({mine.length})</p>
          {mine.map((request) => (
            <div key={request.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 p-2">
              <span className="min-w-0 truncate">{request.preview?.title ?? request.action_key}</span>
              <Button type="button" size="sm" onClick={() => resume(request)}>
                Run
              </Button>
            </div>
          ))}
        </>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
