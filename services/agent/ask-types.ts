/**
 * The Ask API (hp_erp `/api/agent/ask` and `/api/agent/conversations`, routes/agent_gateway.php; contract: hp_erp docs/agentic-crm/slices/S08-ask.md, built by
 * track S8a at the same time as this front end). Names are the API's own snake_case.
 *
 * Every field below is read tolerantly (services/agent/ask-parse.ts): the server may not be deployed, or may be a version older or newer than this screen, and
 * a field that is missing or of the wrong kind must never break the chat. `null` means "not known" or "does not apply". Everything the server wrote in `text`
 * and `label` is PLAIN TEXT and is shown as text, never as markup.
 */

/** The kinds of record the chat can be asked "about", the contract's `context.type`. */
export type AskContextType = 'lead' | 'contact' | 'organization' | 'opportunity'

/** The record the person is looking at when they ask. */
export interface AskContext {
  type: AskContextType
  id: number
}

/**
 * answered: a short answer that cites records. no_data: nothing was found (a statement, not a guess). refused: the server would not give an answer it could not
 * tie to the person's own records, or the person may not see them. unavailable: no model, a model that failed, or the assistant switched off. A newer server may
 * send another word; the screen shows it as an ordinary answer.
 */
export type AskAnswerStatus = 'answered' | 'no_data' | 'refused' | 'unavailable'

/** A record an answer rests on. The label and address come from the server's own rows, never from the model. */
export interface AskCitation {
  type: string
  id: string
  label: string
  url: string | null
}

export interface AskMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  status: AskAnswerStatus | (string & {}) | null
  citations: AskCitation[]
  created_at: string | null
}

/** What `POST /agent/ask` answers with. */
export interface AskAnswer {
  conversation_id: number
  message: AskMessage
}

export interface AskConversationRow {
  id: number
  title: string
  context: AskContext | null
  message_count: number
  created_at: string | null
  updated_at: string | null
}

export interface AskPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface AskConversationsPage {
  rows: AskConversationRow[]
  pagination: AskPagination
}

export interface AskConversation extends AskConversationRow {
  messages: AskMessage[]
}

export interface AskEnvelope<T> {
  status: number
  message?: string
  data: T
}

export interface AskRequest {
  /** At most 1000 characters (the server refuses more with a 422). */
  message: string
  /** Continue this conversation; absent or null starts a new one. */
  conversationId?: number | null
  /** The record the person is viewing; absent when they did not ask to bring it. */
  context?: AskContext | null
}

/** What the chat needs from the server. The widget takes this shape, so a test can hand it a fake. */
export interface AskApi {
  /** Asks one question. An `unavailable` or `no_data` answer is an ANSWER (HTTP 200), not an error. Refusals throw an AskApiError (422, 403, 404 `not_found`, 429 `daily_limit`). */
  ask(request: AskRequest): Promise<AskEnvelope<AskAnswer>>
  /** The caller's own conversations, newest first. A 404 means the server has no chat yet (this route answers 404 only when it is not deployed). */
  conversations(params: { page?: number; per_page?: number }): Promise<AskEnvelope<AskConversationsPage>>
  /** One of the caller's own conversations with its messages, oldest first. 404: it is not the caller's, or it is gone (the two are not told apart). */
  conversation(id: number): Promise<AskEnvelope<AskConversation>>
}
