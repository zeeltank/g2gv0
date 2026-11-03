'use client'

import { ExternalLink } from 'lucide-react'
import { BASED_ON, citationItems, lacksCitations, statusView, suggestions, UNCITED_TEXT, type CitationItem, type ChatEntry } from '@/lib/ask/model'
import type { ChatEngine } from '@/lib/ask/engine'
import { ANSWER_BUBBLE, OWN_BUBBLE, STATUS_STRIP_BASE, STATUS_STRIP_TONE } from '@/lib/ask/tones'
import { cn } from '@/lib/utils'
import type { AskContextType } from '@/services/agent/ask-types'

/**
 * What the chat draws for the conversation: the person's questions, the answers with the records they rest on, the status words of an answer that is not one,
 * the thinking line and the greeting. Everything a person, a model or a record wrote is drawn as TEXT (a React text node, never markup), and a long unbroken
 * word wraps instead of widening the panel (`break-words`, `min-w-0`). The colours are lib/ask/tones.ts's.
 */

const LINK = 'text-foreground underline underline-offset-2 hover:no-underline'

function Citation({ item }: { item: CitationItem }) {
  return (
    <li className="min-w-0 break-words">
      {item.link === null ? (
        <span className="text-foreground">{item.label}</span>
      ) : item.link.external ? (
        <a href={item.link.href} target="_blank" rel="noopener noreferrer" className={LINK}>
          {item.label}
          <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <a href={item.link.href} className={LINK}>{item.label}</a>
      )}
      <span className="text-muted-foreground"> · {item.typeLabel}</span>
    </li>
  )
}

export function MessageBubble({ entry }: { entry: ChatEntry }) {
  if (entry.role === 'user') {
    return (
      <div className="flex justify-end" data-role="user">
        <div className={cn('min-w-0 max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm whitespace-pre-wrap break-words', OWN_BUBBLE)}>
          <span className="sr-only">You: </span>
          {entry.text}
        </div>
      </div>
    )
  }
  const status = statusView(entry.status)
  const cited = citationItems(entry.citations)
  return (
    <div className="flex justify-start" data-role="assistant" data-status={entry.status ?? undefined}>
      <div className={cn('min-w-0 max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm', ANSWER_BUBBLE)}>
        <span className="sr-only">Assistant: </span>
        {status !== null && <p className={cn(STATUS_STRIP_BASE, STATUS_STRIP_TONE[status.tone])}>{status.label}</p>}
        {entry.text.trim() !== '' && <p className="whitespace-pre-wrap break-words">{entry.text}</p>}
        {cited.length > 0 && (
          <div className="mt-2 text-xs" data-citations="">
            <p className="text-muted-foreground">{BASED_ON}</p>
            <ul className="mt-0.5 space-y-0.5">{cited.map((item) => <Citation key={item.key} item={item} />)}</ul>
          </div>
        )}
        {lacksCitations(entry) && <p className="mt-2 text-xs text-muted-foreground" data-uncited="">{UNCITED_TEXT}</p>}
      </div>
    </div>
  )
}

/** The wait for an answer. The words are there for everyone; the dots are only decoration. */
export function Thinking() {
  return (
    <div className="flex justify-start" role="status">
      <div className={cn('inline-flex items-center gap-2 rounded-2xl rounded-bl-sm px-3 py-2 text-sm', ANSWER_BUBBLE)}>
        <span className="inline-flex h-4 items-end gap-0.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted-foreground opacity-60" style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }} />
          ))}
        </span>
        <span>Thinking…</span>
      </div>
    </div>
  )
}

/** The first thing in an empty chat: what it can answer, and questions to start from. */
export function Greeting({ engine, about, disabled, onPick }: { engine: ChatEngine; about: AskContextType | null; disabled: boolean; onPick: (question: string) => void }) {
  return (
    <div className="space-y-2 pt-2">
      <p className="text-center text-xs text-muted-foreground">
        {engine === 'ask'
          ? 'Ask about your leads, contacts, organisations, opportunities, signals and products. Each answer links to the records it comes from.'
          : 'Ask me anything about your CRM'}
      </p>
      <div className="grid grid-cols-1 gap-1.5">
        {suggestions(engine, about).map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onPick(question)}
            className="break-words rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:bg-muted disabled:opacity-60"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  )
}
