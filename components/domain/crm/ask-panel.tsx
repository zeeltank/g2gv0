'use client'

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Check, History, Plus, Send, Sparkles, X } from 'lucide-react'
import { CONTEXT_WORD } from '@/lib/ask/context'
import { dailyLimitText, questionProblem } from '@/lib/ask/model'
import type { AskSession, AskSessionState } from '@/lib/ask/session'
import { FIELD_ERROR_TEXT, HEADER, HEADER_BUTTON, NOTICE_BASE, NOTICE_LOOK } from '@/lib/ask/tones'
import { cn } from '@/lib/utils'
import type { AskContext } from '@/services/agent/ask-types'
import { ConversationList } from './ask-conversations'
import { Greeting, MessageBubble, Thinking } from './ask-messages'

/**
 * The open chat panel: header (conversations, new chat, close), the transcript or the list of earlier conversations, a notice, and the box.
 *
 * Keys: Enter sends, Shift+Enter breaks the line (and Enter during an input-method composition is not a send); Escape anywhere in the panel closes it, and the
 * widget puts the focus back on the button that opened it. The panel is a dialog that does not trap the page (the person can still use the CRM beside it).
 * Sizes: the panel never wider than the screen (`max-w-[calc(100vw-3rem)]`) nor taller (`max-h-[calc(100dvh-3rem)]`), and every flex child that holds text has
 * `min-w-0`, so a long word wraps instead of widening it at 390 px.
 */

interface Props {
  session: AskSession
  state: AskSessionState
  /** The record on screen, when the page is one record's page. */
  record: AskContext | null
  /** The person asked to bring that record into their questions. */
  about: boolean
  onAboutChange: (on: boolean) => void
  onClose: () => void
}

const CHIP = 'inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600'

function HeaderButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn('inline-flex size-8 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white', HEADER_BUTTON, pressed && 'bg-purple-700')}
    >
      {children}
    </button>
  )
}

export function AskPanel({ session, state, record, about, onAboutChange, onClose }: Props) {
  const titleId = useId()
  const problemId = useId()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { engine, view, entries, draft, busy, thinking, opening, notice, dailyLimit, list, conversationId } = state
  const problem = questionProblem(draft)
  const context = about && record !== null ? record : null
  const canSend = draft.trim() !== '' && problem === null && !busy && !opening && dailyLimit === null

  // The box has the focus whenever the chat is what is shown (on opening, after "New chat", after an old conversation opens); the list takes it to its heading.
  useEffect(() => {
    if (view === 'chat') inputRef.current?.focus()
    else headingRef.current?.focus()
  }, [view])

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [entries, thinking])

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  function onBoxKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void session.send(undefined, context)
    }
  }

  function newChat() {
    session.newChat()
    inputRef.current?.focus()
  }

  return (
    <section
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className="fixed bottom-6 right-6 z-50 flex h-[480px] max-h-[calc(100dvh-3rem)] w-80 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border bg-background text-foreground shadow-2xl sm:w-96"
    >
      <div className={cn('flex items-center justify-between gap-2 border-b px-4 py-3', HEADER)}>
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0" aria-hidden="true" />
          <h2 id={titleId} className="truncate text-sm font-semibold">CRM AI Assistant</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {engine === 'ask' && (
            <HeaderButton label="Conversations" pressed={view === 'list'} onClick={() => (view === 'list' ? session.showChat() : session.showList())}>
              <History className="size-4" aria-hidden="true" />
            </HeaderButton>
          )}
          <HeaderButton label="New chat" onClick={newChat}><Plus className="size-4" aria-hidden="true" /></HeaderButton>
          <HeaderButton label="Close chat" onClick={onClose}><X className="size-4" aria-hidden="true" /></HeaderButton>
        </div>
      </div>

      {view === 'list' ? (
        <ConversationList
          ref={headingRef}
          list={list}
          openId={conversationId}
          onOpen={(id) => void session.openConversation(id)}
          onMore={() => session.loadMore()}
          onRetry={() => session.retryList()}
          onBack={() => session.showChat()}
        />
      ) : opening ? (
        <div className="relative flex-1 p-3"><p role="status" className="text-xs text-muted-foreground">Opening the conversation…</p></div>
      ) : entries.length === 0 && !thinking ? (
        <div className="relative min-h-0 flex-1 overflow-y-auto p-3">
          <Greeting engine={engine} about={context?.type ?? null} disabled={busy || dailyLimit !== null} onPick={(question) => void session.send(question, context)} />
        </div>
      ) : (
        <div role="log" aria-label="Conversation" aria-busy={thinking} className="relative min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {entries.map((entry) => <MessageBubble key={entry.key} entry={entry} />)}
          {thinking && <Thinking />}
          <div ref={bottomRef} />
        </div>
      )}

      {notice !== null && <div role="alert" className={cn(NOTICE_BASE, NOTICE_LOOK, 'break-words')}>{notice.text}</div>}

      {view === 'chat' && (
        <form
          className="border-t p-2"
          onSubmit={(event) => {
            event.preventDefault()
            void session.send(undefined, context)
          }}
        >
          {engine === 'ask' && record !== null && (
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <button type="button" aria-pressed={about} onClick={() => onAboutChange(!about)} className={cn(CHIP, about && 'border-purple-600')}>
                {about && <Check className="size-3" aria-hidden="true" />}
                Ask about this record
              </button>
              {about && <span className="min-w-0 break-words text-xs text-muted-foreground">Your questions will be about this {CONTEXT_WORD[record.type]}.</span>}
            </div>
          )}
          {dailyLimit !== null && <p role="status" className={cn('mb-2 break-words rounded-lg border px-3 py-2 text-xs', NOTICE_LOOK)}>{dailyLimitText(dailyLimit.limit)}</p>}
          {busy && !thinking && <p role="status" className="mb-2 text-xs text-muted-foreground">Still answering your earlier question.</p>}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => session.setDraft(event.target.value)}
              onKeyDown={onBoxKeyDown}
              disabled={dailyLimit !== null}
              aria-label="Your question"
              aria-invalid={problem !== null}
              aria-describedby={problem !== null ? problemId : undefined}
              placeholder={dailyLimit !== null ? 'Come back tomorrow' : 'Ask a question about your CRM'}
              rows={1}
              className="max-h-24 min-h-[38px] min-w-0 flex-1 resize-none overflow-auto rounded-xl border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:opacity-60"
            />
            <button
              type="submit"
              aria-label="Send question"
              disabled={!canSend}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          </div>
          {problem !== null && <p id={problemId} className={cn('mt-1 text-xs', FIELD_ERROR_TEXT)}>{problem}</p>}
        </form>
      )}
    </section>
  )
}
