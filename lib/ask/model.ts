import { formatWhen, NETWORK_TEXT } from '@/lib/agent/model'
import { ApiError } from '@/services/core'
import { AskApiError } from '@/services/agent/ask-errors'
import type { AskCitation, AskContextType, AskConversationRow, AskMessage } from '@/services/agent/ask-types'
import { CONTEXT_WORD } from './context'
import type { ChatEngine } from './engine'

/**
 * What the CRM chat says and which links it draws, decided in one place and tested without a browser (components render these, they do not invent words).
 * The rules the words keep: a status is a WORD, never only a colour; everything a model or a record wrote is plain text; a link is drawn only for an address
 * inside this application or an http(s) address; a failure says what happened and what to do, never a status code; an answer with no records behind it says so.
 */

export const MAX_QUESTION_CHARS = 1000

// ── The question ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Why this question cannot be sent, or null when it can. An empty question is not "a problem" to shout about: the button is simply off, so it answers null. */
export function questionProblem(text: string): string | null {
  return text.trim().length > MAX_QUESTION_CHARS ? `A question can have at most ${MAX_QUESTION_CHARS.toLocaleString('en-US')} characters.` : null
}

// ── Links ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SafeLink {
  href: string
  /** An address outside this application: opened in a new tab, without sending the page's address along. */
  external: boolean
}

const UNSAFE_CHARACTERS = /[\s\u0000-\u001f\u007f-\u009f\\]/

/**
 * The only addresses the chat draws as links: a path inside this application (one slash, then not another slash or a backslash) or an http(s) address with a
 * host. Anything with a space, a control character or a backslash is refused whole (a browser strips tabs and newlines from the middle of a scheme, so
 * `java<tab>script:` is `javascript:`), and so is an address with a user name or password in it.
 */
export function safeLink(url: unknown): SafeLink | null {
  if (typeof url !== 'string' || url === '' || url.length > 2000 || UNSAFE_CHARACTERS.test(url)) return null
  if (url.startsWith('/')) return url.startsWith('//') ? null : { href: url, external: false }
  // A host must follow the two slashes at once: the URL parser reads `https:///host` as `https://host/`, an address nobody wrote on purpose.
  if (!/^https?:\/\/[^/?#]/i.test(url)) return null
  try {
    const parsed = new URL(url)
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.hostname === '' || parsed.username !== '' || parsed.password !== '') return null
    return { href: url, external: true }
  } catch {
    return null
  }
}

// ── Citations ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const CITATION_TYPES: Record<string, string> = {
  lead: 'Lead',
  contact: 'Contact',
  organization: 'Organisation',
  opportunity: 'Opportunity',
  signal: 'Signal',
  product: 'Product',
  task: 'Task',
  summary: 'Summary',
}

export interface CitationItem {
  key: string
  typeLabel: string
  label: string
  link: SafeLink | null
}

/** The records an answer rests on, once each, with a label even when the server sent none and a link only when the address is safe. */
export function citationItems(citations: readonly AskCitation[]): CitationItem[] {
  const seen = new Set<string>()
  const items: CitationItem[] = []
  for (const citation of citations) {
    const key = `${citation.type}:${citation.id}`
    if (seen.has(key)) continue
    seen.add(key)
    const typeLabel = CITATION_TYPES[citation.type] ?? 'Record'
    items.push({ key, typeLabel, label: citation.label.trim() === '' ? `${typeLabel} ${citation.id}` : citation.label, link: safeLink(citation.url) })
  }
  return items
}

export const BASED_ON = 'Based on:'
export const UNCITED_TEXT = 'No records are cited for this answer.'

// ── Statuses ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface StatusView {
  /** The status in words. The text that follows it is the server's own explanation. */
  label: string
  /** Only the border takes the colour: `caution` (it did not answer), `error` (it could not). */
  tone: 'caution' | 'error'
}

const STATUS_VIEWS: Record<string, StatusView> = {
  no_data: { label: 'Nothing found', tone: 'caution' },
  refused: { label: 'I cannot see that', tone: 'caution' },
  unavailable: { label: 'Unavailable right now', tone: 'error' },
}

/** The status word of an answer that is not a plain answer; null for an answer, and for a status a newer server sends that this screen does not know (shown as an ordinary answer). */
export function statusView(status: string | null): StatusView | null {
  return status !== null && Object.prototype.hasOwnProperty.call(STATUS_VIEWS, status) ? STATUS_VIEWS[status] : null
}

// ── Failures ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type FailureKind = 'daily_limit' | 'conversation_gone' | 'endpoint_missing' | 'forbidden' | 'invalid' | 'timeout' | 'network' | 'server'

export interface Failure {
  kind: FailureKind
  text: string
  /** The day's question cap, on a `daily_limit`. */
  limit: number | null
}

/** "You have used today's 30 questions." The number is the server's; when it did not send one the sentence still stands. */
export function dailyLimitText(limit: number | null): string {
  return limit !== null && limit > 0 ? `You have used today's ${limit} questions. Try again tomorrow.` : "You have used today's questions. Try again tomorrow."
}

export const FORBIDDEN_TEXT = 'You do not have access to the CRM assistant.'
export const GONE_TEXT = 'That conversation is no longer available. Start a new chat.'
export const SERVER_TEXT = 'The assistant could not answer. Nothing was changed. Try again in a moment.'
export const LIST_ERROR_TEXT = 'Your conversations could not be loaded.'

export type FailureWhere = 'ask' | 'list' | 'open'

/**
 * A failed request in words.
 *
 * A 404 means two different things, told apart by what was asked: reading one conversation by its id, or asking into one, answers 404 `not_found` (it is not
 * the caller's, or it is gone); asking with no `not_found` code, or listing, answers 404 only when the server has no chat at all (the route is not deployed),
 * and then the widget quietly uses the old endpoint.
 */
export function describeFailure(error: unknown, where: FailureWhere): Failure {
  if (error instanceof ApiError) {
    const code = error instanceof AskApiError ? error.code : null
    const limit = error instanceof AskApiError ? error.limit : null
    if (code === 'timeout') return { kind: 'timeout', text: error.message, limit: null }
    if (error.status === 429 && code === 'daily_limit') return { kind: 'daily_limit', text: dailyLimitText(limit), limit }
    if (error.status === 429) return { kind: 'server', text: 'The assistant is busy. Try again in a moment.', limit: null }
    if (error.status === 403) return { kind: 'forbidden', text: FORBIDDEN_TEXT, limit: null }
    if (error.status === 404) {
      if (where === 'open' || code === 'not_found') return { kind: 'conversation_gone', text: GONE_TEXT, limit: null }
      return { kind: 'endpoint_missing', text: '', limit: null }
    }
    if (error.status === 422 && error.message !== '') return { kind: 'invalid', text: error.message, limit: null }
    return { kind: 'server', text: where === 'ask' ? SERVER_TEXT : LIST_ERROR_TEXT, limit: null }
  }
  if (error instanceof TypeError) return { kind: 'network', text: NETWORK_TEXT, limit: null }
  return { kind: 'server', text: where === 'ask' ? SERVER_TEXT : LIST_ERROR_TEXT, limit: null }
}

// ── The transcript ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ChatEntry {
  /** Stable for the life of the entry: a server message's id, or a local one for a question that has not been answered yet. */
  key: string
  role: 'user' | 'assistant'
  text: string
  status: string | null
  citations: AskCitation[]
  createdAt: string | null
  /** Which engine wrote it. The old engine's answers are never cited, and are not marked as lacking citations. */
  engine: ChatEngine
}

export function entryFromMessage(message: AskMessage): ChatEntry {
  return { key: `m${message.id}`, role: message.role, text: message.text, status: message.status, citations: message.citations, createdAt: message.created_at, engine: 'ask' }
}

/** Whether to say that an answer cites nothing: a new-engine answer that claims to answer (no status word of its own) and rests on no record. */
export function lacksCitations(entry: ChatEntry): boolean {
  return entry.role === 'assistant' && entry.engine === 'ask' && statusView(entry.status) === null && entry.text.trim() !== '' && citationItems(entry.citations).length === 0
}

// ── Words for the panel ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const GENERIC_SUGGESTIONS = [
  'How many leads came from signals?',
  'Summarize my pipeline by stage',
  'Which signals are new this week?',
  'Which products do we sell?',
]

const LEGACY_SUGGESTIONS = [
  'Which leads need follow-up today?',
  'Summarize my pipeline health',
  'Draft a follow-up for my top lead',
  'What are the latest buying signals?',
]

/** Questions to start from. The new engine answers from records and cannot draft anything, so it is never offered "draft"; on a record's page the first two are about that record. */
export function suggestions(engine: ChatEngine, about: AskContextType | null): string[] {
  if (engine === 'legacy') return LEGACY_SUGGESTIONS
  if (about === null) return GENERIC_SUGGESTIONS
  const word = CONTEXT_WORD[about]
  return [`What should I know about this ${word}?`, `What is open for this ${word}?`, ...GENERIC_SUGGESTIONS.slice(0, 2)]
}

export const UNTITLED_CONVERSATION = 'Untitled chat'

export function conversationTitle(row: Pick<AskConversationRow, 'title'>): string {
  return row.title.trim() === '' ? UNTITLED_CONVERSATION : row.title
}

/** "About a lead · 4 messages · 3 Nov 2026, 20:52": what a person needs to tell two chats apart. `timeZone` is for tests. */
export function conversationMeta(row: Pick<AskConversationRow, 'context' | 'message_count' | 'updated_at'>, timeZone?: string): string {
  const parts: string[] = []
  if (row.context) parts.push(`About ${/^[aeiou]/.test(CONTEXT_WORD[row.context.type]) ? 'an' : 'a'} ${CONTEXT_WORD[row.context.type]}`)
  parts.push(`${row.message_count} ${row.message_count === 1 ? 'message' : 'messages'}`)
  parts.push(formatWhen(row.updated_at, timeZone))
  return parts.join(' · ')
}
