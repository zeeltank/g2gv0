'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionCard } from '@/components/shared/business/shared'
import { outreachHref } from '@/lib/signals/outreach-model'
import type { OutreachApi } from '@/services/signals/outreach'
import type { PersonMessage } from '@/services/signals/outreach-types'
import { dayText, errorText, messageStatusWord } from './outreach-parts'

type Phase = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; items: PersonMessage[] }

/**
 * The messages written to one person: the drafts and the mail that went out, newest first, each with its subject, its status in words and the day it was written or sent. It only lists;
 * every message is worked on in Messages, so the link says so. `version` goes up when a draft was just saved, so the list reads itself again.
 */
export function OutreachPersonMessages({ service, personId, version }: { service: OutreachApi; personId: number; version: number }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })

  const load = useCallback(async () => {
    setPhase({ kind: 'loading' })
    try {
      const response = await service.personMessages(personId)
      setPhase({ kind: 'ready', items: response.data })
    } catch (cause) {
      setPhase({ kind: 'error', message: errorText(cause, 'The messages could not be loaded.') })
    }
  }, [service, personId])

  // `version` is read so a draft saved from the panel's own Write message button is listed without leaving the tab.
  useEffect(() => { void version; queueMicrotask(() => { void load() }) }, [load, version])

  return (
    <SectionCard title="Messages" description="Everything written to this person.">
      {phase.kind === 'loading' && (
        <p role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading messages…</p>
      )}
      {phase.kind === 'error' && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-foreground">
          <span>{phase.message}</span>
          <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
        </div>
      )}
      {phase.kind === 'ready' && phase.items.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">No message has been written to this person yet. Use Write message.</p>
      )}
      {phase.kind === 'ready' && phase.items.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {phase.items.map((message) => (
            <li key={message.id} data-message={message.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{message.subject || '(no subject)'}</p>
                <p className="text-xs text-muted-foreground">{message.sent_at ? `Sent ${dayText(message.sent_at, '')}` : `Written ${dayText(message.created_at, 'a while ago')}`}</p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground">{messageStatusWord(message.status)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Checking, approving and sending happen in <Link href={outreachHref('messages')} className="font-medium text-foreground underline underline-offset-2 hover:no-underline">Messages</Link>.
      </p>
    </SectionCard>
  )
}
