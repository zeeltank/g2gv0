'use client'

/**
 * Conversational AI — the assistant, its grounding, and its transcripts.
 *
 * A static route, so it takes precedence over `app/ai/[capability]/page.tsx`.
 *
 * WHY THE GROUNDING PANEL IS THE FIRST THING ON THE SCREEN
 *
 * "This assistant is grounded in your data" is a claim, and an administrator has no
 * way to check it from a chat window — a wrong answer looks the same whether the
 * model was given bad figures or none at all. The panel shows exactly what the
 * assistant was told, so a wrong answer becomes diagnosable: either the figure it
 * used is listed here and the model misread it, or it is not listed and the model
 * should have refused.
 *
 * WHY FAILED TURNS ARE RENDERED
 *
 * A transcript that quietly drops the turns that failed shows a person asking three
 * questions and receiving two answers, with nothing to say the third ever happened.
 * The API returns the error on the turn, and this screen shows it in place.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, RefreshCw, Send, ServerCrash, Sparkles } from 'lucide-react'

import {
  askAssistant,
  fetchConversation,
  fetchConversations,
  fetchGroundingContext,
  type ConversationSummary,
  type ConversationTurn,
  type GroundingFact,
} from '@/lib/intelligence/ai-conversations'
import { describeAiError } from '@/lib/intelligence/client'

import { CapabilityShell } from '../_components/CapabilityShell'

export default function AiConversationalPage() {
  return (
    <CapabilityShell slug="conversational-ai">
      <ConversationalConsole />
    </CapabilityShell>
  )
}

function ConversationalConsole() {
  const [facts, setFacts] = useState<GroundingFact[] | null>(null)
  const [grounded, setGrounded] = useState<boolean | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [turns, setTurns] = useState<ConversationTurn[]>([])

  const [message, setMessage] = useState('')
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')
  /** Set when the failure is "no credential" rather than "the provider broke". */
  const [needsCredential, setNeedsCredential] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  /*
   * The session key is generated once and kept in a ref.
   *
   * A ref rather than state because it must NOT change: every question carries it,
   * and a new key opens a new conversation — which is how a chat loses its memory
   * with nothing appearing to be wrong.
   *
   * Generated inside `ensureSessionKey` rather than during render. `crypto.randomUUID()`
   * is impure and writing a ref while rendering is not allowed, so doing it here
   * tripped two React rules at once — and both were right: a render that assigns a
   * ref can run twice in development and produce two different keys.
   */
  const sessionKey = useRef<string | null>(null)

  /** Called from the submit handler, where a side effect is legitimate. */
  const ensureSessionKey = useCallback(() => {
    sessionKey.current ??=
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(16).slice(2)}`

    return sessionKey.current
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchGroundingContext(), fetchConversations()])
      .then(([context, list]) => {
        if (cancelled) return
        setFacts(context.facts)
        setGrounded(context.grounded)
        setConversations(list.conversations)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeAiError(cause))
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  useEffect(() => {
    if (selected === null) return

    let cancelled = false

    fetchConversation(selected)
      .then((data) => {
        if (!cancelled) setTurns(data.turns)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeAiError(cause))
      })

    return () => {
      cancelled = true
    }
  }, [selected, reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()

    const text = message.trim()
    if (text === '' || asking) return

    setAsking(true)
    setError('')
    setNeedsCredential(false)

    // Shown immediately, before the round trip. A chat that swallows the question
    // until the answer arrives reads as though the send button did nothing.
    setTurns((current) => [
      ...current,
      {
        id: -Date.now(),
        turn_index: current.length + 1,
        role: 'user',
        content: text,
        provider: null,
        model: null,
        input_tokens: null,
        output_tokens: null,
        latency_ms: null,
        error: null,
        created_at: null,
      },
    ])
    setMessage('')

    try {
      const result = await askAssistant({ message: text, session_key: ensureSessionKey() })

      if (result.answer === null) {
        setError(result.error ?? 'The assistant could not answer.')
        setNeedsCredential(result.configured === false)
      }

      // Re-read from the server rather than appending the answer locally: the
      // transcript is the record, and a screen built from optimistic appends drifts
      // from it the first time a turn fails.
      setSelected(result.conversation_id)
      reload()
    } catch (cause) {
      setError(describeAiError(cause))
    } finally {
      setAsking(false)
    }
  }

  return (
    <section className="mt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Assistant</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Answers questions about this organisation from the figures below. It has no access to
            any individual person&rsquo;s record.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </header>

      <GroundingPanel facts={facts} grounded={grounded} />

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>{error}</p>
            {needsCredential && (
              <Link href="/ai/providers" className="mt-1 inline-block font-medium underline">
                Add a credential under AI Providers
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 rounded-lg border border-border bg-card">
          <div className="max-h-[26rem] min-h-[12rem] overflow-y-auto px-4 py-4">
            {turns.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Ask something to start. Try &ldquo;how many competencies do we have?&rdquo;
              </p>
            ) : (
              <ul className="space-y-3">
                {turns.map((turn) => (
                  <TurnBubble key={turn.id} turn={turn} />
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask about competencies, departments, tasks…"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <button
              type="submit"
              disabled={asking || message.trim() === ''}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {asking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Ask
            </button>
          </form>
        </div>

        <ConversationList
          conversations={conversations}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </section>
  )
}

/** What the assistant was told. See the file note for why this leads. */
function GroundingPanel({ facts, grounded }: { facts: GroundingFact[] | null; grounded: boolean | null }) {
  if (facts === null) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading grounding context…
      </p>
    )
  }

  if (grounded === false || facts.length === 0) {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-4">
        <ServerCrash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-sm leading-6 text-muted-foreground">
          No figures could be read for this organisation, so the assistant has nothing to ground an
          answer in. It will answer questions about how the platform works and say when it would
          need data it does not have.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
        <Sparkles className="size-3.5 text-primary" />
        What the assistant knows about this organisation
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        These figures are read live and sent with every question. Counts and taxonomy only — never
        an individual&rsquo;s record.
      </p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex items-baseline justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
          >
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function TurnBubble({ turn }: { turn: ConversationTurn }) {
  const isUser = turn.role === 'user'

  if (turn.error) {
    return (
      <li className="flex justify-start">
        <div className="max-w-[85%] rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-3.5" />
            No answer
          </p>
          <p className="mt-1 text-xs leading-5">{turn.error}</p>
        </div>
      </li>
    )
  }

  return (
    <li className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-6 ${
          isUser ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-foreground'
        }`}
      >
        <p className="whitespace-pre-wrap">{turn.content}</p>
        {/* Which model answered and what it cost, on the turn rather than the
            conversation — a model can be reconfigured mid-conversation. */}
        {!isUser && turn.model && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {turn.model}
            {turn.output_tokens !== null && ` · ${turn.output_tokens} tokens`}
            {turn.latency_ms !== null && ` · ${turn.latency_ms}ms`}
          </p>
        )}
      </div>
    </li>
  )
}

function ConversationList({
  conversations,
  selected,
  onSelect,
}: {
  conversations: ConversationSummary[]
  selected: number | null
  onSelect: (id: number) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-card-foreground">
        Conversations
      </h3>
      {conversations.length === 0 ? (
        <p className="px-4 py-4 text-xs text-muted-foreground">
          Nothing yet. Transcripts are stored, so they survive a restart.
        </p>
      ) : (
        <ul className="max-h-[24rem] divide-y divide-border overflow-y-auto">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={`w-full px-4 py-2.5 text-left transition-colors hover:bg-muted ${
                  selected === conversation.id ? 'bg-muted' : ''
                }`}
              >
                <span className="block truncate text-xs font-medium text-foreground">
                  {conversation.title ?? `Conversation ${conversation.id}`}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {conversation.turn_count} turns
                  {conversation.last_turn_at && ` · ${conversation.last_turn_at.slice(0, 16)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
