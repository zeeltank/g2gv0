'use client'

import { useState } from 'react'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/textarea'
import type { CrmComment } from '@/types/crm'

interface Props {
  comments: CrmComment[]
  loading: boolean
  onAdd: (text: string) => Promise<void>
}

/**
 * Purely presentational, reusable comment thread - flat list (oldest-first,
 * as the backend already returns it), author name + timestamp, plus a
 * Textarea+Button to add a new one. One component shared by every entity's
 * own Comments tab (Lead/Contact/Organization/Opportunity) - each entity's
 * detail-page wrapper owns the state/loading/crmService calls and only
 * passes `comments`/`loading`/`onAdd` in, same split CrmTicketController's
 * own (inline, not componentized) Comments tab follows in
 * ticket-detail-page.tsx.
 */
export function CommentThread({ comments, loading, onAdd }: Props) {
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  const submit = async () => {
    if (!text.trim() || posting) return
    setPosting(true)
    try {
      await onAdd(text.trim())
      setText('')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={posting || !text.trim()} onClick={() => void submit()}>
            {posting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" /> : <Send className="mr-1.5 size-3.5" aria-hidden="true" />}
            Post Comment
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading comments…
        </div>
      )}
      {!loading && comments.length === 0 && (
        <EmptyState icon={<MessageSquare className="size-8" aria-hidden="true" />} title="No comments yet" />
      )}
      {!loading && comments.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border">
          {comments.map((row) => (
            <div key={row.id} className="p-3">
              <p className="whitespace-pre-wrap text-sm text-foreground">{row.comment}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">{row.createdByName || 'Unknown'} · {row.createdAt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
