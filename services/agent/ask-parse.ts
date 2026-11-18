import type {
  AskAnswer, AskCitation, AskContext, AskConversation, AskConversationRow, AskConversationsPage, AskMessage, AskPagination,
} from './ask-types'

/**
 * Reads what the Ask API sent into the shapes in ask-types.ts without trusting any of it. The server may be a different version from this screen, and the
 * body may be anything (an HTML error page, a proxy's message): a field that is missing or of the wrong kind becomes its empty value, a row that cannot be
 * told from nothing (no id) is dropped, and nothing here throws. A message with neither words nor a status is dropped too, so a chat never shows an empty bubble.
 */

type Raw = Record<string, unknown>

const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)

/** A positive whole number from a number or a string of digits (the server may send an id either way); anything else is null. */
function positiveInt(value: unknown): number | null {
  const n = typeof value === 'string' && /^\d{1,15}$/.test(value) ? Number(value) : value
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const nullableText = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null)

const CONTEXT_TYPES = new Set(['lead', 'contact', 'organization', 'opportunity'])

function parseContext(value: unknown): AskContext | null {
  if (!isObject(value) || typeof value.type !== 'string' || !CONTEXT_TYPES.has(value.type)) return null
  const id = positiveInt(value.id)
  return id === null ? null : { type: value.type as AskContext['type'], id }
}

export function parseCitations(value: unknown): AskCitation[] {
  if (!Array.isArray(value)) return []
  const citations: AskCitation[] = []
  for (const item of value) {
    if (!isObject(item) || typeof item.type !== 'string' || item.type === '') continue
    const id = typeof item.id === 'number' || typeof item.id === 'string' ? String(item.id) : ''
    if (id === '') continue
    citations.push({ type: item.type, id, label: text(item.label), url: nullableText(item.url) })
  }
  return citations
}

export function parseMessage(value: unknown): AskMessage | null {
  if (!isObject(value)) return null
  const id = positiveInt(value.id)
  const body = text(value.text)
  const status = nullableText(value.status)
  // A message with no words and no status says nothing. One with a status but no words is still an answer ("refused", "no_data"): the status carries it.
  if (id === null || (body.trim() === '' && status === null)) return null
  return {
    id,
    role: value.role === 'user' ? 'user' : 'assistant',
    text: body,
    status,
    citations: parseCitations(value.citations),
    created_at: nullableText(value.created_at),
  }
}

export function parseAnswer(data: unknown): AskAnswer | null {
  if (!isObject(data)) return null
  const conversationId = positiveInt(data.conversation_id)
  const message = parseMessage(data.message)
  return conversationId === null || message === null ? null : { conversation_id: conversationId, message }
}

function parseRow(value: unknown): AskConversationRow | null {
  if (!isObject(value)) return null
  const id = positiveInt(value.id)
  if (id === null) return null
  const count = typeof value.message_count === 'number' && Number.isFinite(value.message_count) ? Math.max(0, Math.trunc(value.message_count)) : 0
  return {
    id,
    title: text(value.title),
    context: parseContext(value.context),
    message_count: count,
    created_at: nullableText(value.created_at),
    updated_at: nullableText(value.updated_at),
  }
}

function parsePagination(value: unknown, rows: number): AskPagination {
  const raw = isObject(value) ? value : {}
  const page = positiveInt(raw.page) ?? 1
  return {
    page,
    per_page: positiveInt(raw.per_page) ?? Math.max(rows, 1),
    total: typeof raw.total === 'number' && raw.total >= 0 ? Math.trunc(raw.total) : rows,
    last_page: positiveInt(raw.last_page) ?? page,
  }
}

/** `{rows, pagination}`, which is what the server sends; a bare list of rows is accepted too. */
export function parseConversationsPage(data: unknown): AskConversationsPage {
  const list = Array.isArray(data) ? data : isObject(data) && Array.isArray(data.rows) ? data.rows : []
  const rows = list.map(parseRow).filter((row): row is AskConversationRow => row !== null)
  return { rows, pagination: parsePagination(isObject(data) ? data.pagination : undefined, rows.length) }
}

export function parseConversation(data: unknown): AskConversation | null {
  const row = parseRow(data)
  if (row === null || !isObject(data)) return null
  const messages = (Array.isArray(data.messages) ? data.messages : []).map(parseMessage).filter((message): message is AskMessage => message !== null)
  return { ...row, messages }
}
