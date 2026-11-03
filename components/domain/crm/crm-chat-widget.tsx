'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { contextKey, recordContextFromPath } from '@/lib/ask/context'
import { CHAT_ENGINE, type ChatEngine } from '@/lib/ask/engine'
import type { LegacyChat } from '@/lib/ask/session'
import { useAskSession } from '@/lib/ask/use-ask-session'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { askService } from '@/services/agent/ask-service'
import type { AskApi } from '@/services/agent/ask-types'
import { crmService } from '@/services/crm'
import { AskPanel } from './ask-panel'

/**
 * The CRM chat: the purple button at the bottom right of every CRM page, mounted by the shell (components/shell/gtg-app-shell.tsx). Same button, same place.
 *
 * Behind it is the Ask engine (hp_erp POST /api/agent/ask): answers that cite the records they rest on, conversations that are kept, and, on a record's page,
 * an optional "Ask about this record". The old engine (POST /api/crm/ai-chat) is still here: `CHAT_ENGINE` in lib/ask/engine.ts switches back to it, and a server
 * without the new chat falls back to it by itself. The behaviour lives in lib/ask/session.ts; the pieces that draw are ask-panel.tsx, ask-messages.tsx and
 * ask-conversations.tsx.
 */

/** The old endpoint, asked exactly as the old widget asked it: the question and the last messages, never a record. */
const legacyChat: LegacyChat = async (question, history) => {
  const response = await crmService.aiChat(getLaravelContext(), { message: question, history })
  return response.status === 1 ? response.data.reply : 'Sorry, I could not get a response.'
}

/** Whether a person is signed in with a token for a tenant. Nothing to subscribe to: the session is read when the widget draws; it is false on the server. */
const noSubscription = () => () => undefined
const signedIn = () => isLaravelContextReady(getLaravelContext())

interface Props {
  /** The Ask API. Tests hand in a fake. */
  service?: AskApi
  /** The old endpoint. Tests hand in a fake. */
  legacy?: LegacyChat
  engine?: ChatEngine
}

export function CrmChatWidget({ service = askService, legacy = legacyChat, engine = CHAT_ENGINE }: Props = {}) {
  const [open, setOpen] = useState(false)
  const [aboutKey, setAboutKey] = useState<string | null>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const ready = useSyncExternalStore(noSubscription, signedIn, () => false)
  const pathname = usePathname()
  const { session, state } = useAskSession({ service, legacy, engine })

  const record = recordContextFromPath(pathname)
  const about = record !== null && aboutKey === contextKey(record)

  // On the first opening, find out whether the server has the new chat at all.
  useEffect(() => {
    if (open) session.start()
  }, [open, session])

  // Closing the panel puts the focus back on the button that opened it.
  useEffect(() => {
    if (open) wasOpen.current = true
    else if (wasOpen.current) {
      wasOpen.current = false
      launcherRef.current?.focus()
    }
  }, [open])

  if (!ready) return null

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2"
          aria-label="Open CRM AI chat"
        >
          <Sparkles className="size-5" aria-hidden="true" />
        </button>
      )}

      {open && (
        <AskPanel
          session={session}
          state={state}
          record={record}
          about={about}
          onAboutChange={(on) => setAboutKey(on ? contextKey(record) : null)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
