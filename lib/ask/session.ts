import type { AskApi, AskContext, AskConversationRow, AskPagination } from '@/services/agent/ask-types'
import { ApiError } from '@/services/core'
import type { ChatEngine } from './engine'
import { describeFailure, entryFromMessage, questionProblem, type ChatEntry, type Failure, type FailureKind } from './model'

/**
 * The chat's behaviour without a screen: what is on the transcript, whether a question is on its way, which conversation is open, what the list holds. A plain
 * class (no React) so the races can be tested with promises that are settled by hand; use-ask-session.ts hands its state to React.
 *
 * The rules it keeps, each with a test that fails without it (lib/ask/session.test.ts):
 *  1. ONE question is on its way at a time, decided synchronously before anything else, so two Enters in the same tick send one question.
 *  2. An answer that arrives after the person opened another chat (or started a new one) is dropped, never drawn into the wrong transcript. If the chat they
 *     are looking at IS the one the answer belongs to, it is read again from the server instead, so the answer shows up.
 *  3. A question that failed leaves nothing behind in the transcript and comes back into the box, so it can be sent again; the failure is said in words.
 *  4. When the server has no chat yet (404 on a route that answers 404 only when it is missing) the old endpoint answers instead, without a word to the person.
 *  5. When the day's questions are used up the box is switched off for the rest of the visit; the list and the old chats stay readable.
 */

export interface Notice {
  kind: FailureKind
  text: string
}

export interface ListState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  rows: AskConversationRow[]
  pagination: AskPagination | null
  loadingMore: boolean
  error: string | null
}

export interface AskSessionState {
  engine: ChatEngine
  conversationId: number | null
  entries: ChatEntry[]
  draft: string
  /** A question is on its way: nothing else is sent until it is answered, failed or timed out. */
  busy: boolean
  /** ... and it is for the chat on screen, so the chat shows "Thinking". After "New chat" it is busy but not thinking. */
  thinking: boolean
  /** An older conversation is being read. */
  opening: boolean
  notice: Notice | null
  /** The day's questions are used up: the box is off for the rest of the visit. `limit` is the server's number, when it sent one. */
  dailyLimit: { limit: number | null } | null
  view: 'chat' | 'list'
  list: ListState
}

/** How the old endpoint is asked: the question and the last ten messages, as it always was. It answers with the reply text or throws. */
export type LegacyChat = (question: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<string>

export interface AskSessionOptions {
  service: AskApi
  legacy: LegacyChat
  engine: ChatEngine
}

const PER_PAGE = 20
const LEGACY_HISTORY = 10

const EMPTY_LIST: ListState = { status: 'idle', rows: [], pagination: null, loadingMore: false, error: null }

/** What the old chat said when its request failed, kept as it was: the server's own explanation, or a network line. */
export function legacyFailureText(error: unknown): string {
  return error instanceof ApiError ? error.detail ?? error.message : 'Network error. Please try again.'
}

export class AskSession {
  private readonly service: AskApi
  private readonly legacy: LegacyChat
  private readonly listeners = new Set<() => void>()
  private state: AskSessionState
  private sending = false
  private epoch = 0
  private askedEpoch = -1
  private counter = 0
  private listSeq = 0

  constructor(options: AskSessionOptions) {
    this.service = options.service
    this.legacy = options.legacy
    this.state = {
      engine: options.engine, conversationId: null, entries: [], draft: '', busy: false, thinking: false, opening: false, notice: null, dailyLimit: null,
      view: 'chat', list: EMPTY_LIST,
    }
  }

  // ── The store React reads ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getState = (): AskSessionState => this.state

  private set(change: Partial<AskSessionState>): void {
    const next = { ...this.state, ...change }
    this.state = { ...next, thinking: next.busy && this.askedEpoch === this.epoch }
    for (const listener of Array.from(this.listeners)) listener()
  }

  private setList(change: Partial<ListState>): void {
    this.set({ list: { ...this.state.list, ...change } })
  }

  // ── Asking ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  setDraft(text: string): void {
    this.set({ draft: text })
  }

  /**
   * Sends a question: the one typed in the box (no argument), or the given text (a suggestion). `context` is the record the person chose to ask about; the old
   * endpoint never gets it (it takes the whole row of a record into its prompt, with no check of the caller's right on it).
   */
  async send(question?: string, context: AskContext | null = null): Promise<void> {
    if (this.sending) return
    const text = (question ?? this.state.draft).trim()
    if (text === '' || this.state.dailyLimit !== null || this.state.opening) return
    const problem = questionProblem(text)
    if (problem !== null) {
      this.set({ notice: { kind: 'invalid', text: problem } })
      return
    }

    this.sending = true
    const epoch = this.epoch
    this.askedEpoch = epoch
    const fromBox = question === undefined
    const conversationId = this.state.conversationId
    const history = this.state.entries.slice(-LEGACY_HISTORY).map((entry) => ({ role: entry.role, content: entry.text }))
    const asked: ChatEntry = { key: `q${++this.counter}`, role: 'user', text, status: null, citations: [], createdAt: null, engine: this.state.engine }
    this.set({ entries: [...this.state.entries, asked], draft: fromBox ? '' : this.state.draft, notice: null, busy: true })

    try {
      if (this.state.engine === 'ask') {
        try {
          const response = await this.service.ask({ message: text, conversationId, context })
          this.landAnswer(epoch, response.data.conversation_id, response.data.message)
          return
        } catch (error) {
          const failure = describeFailure(error, 'ask')
          if (failure.kind !== 'endpoint_missing') {
            this.fail(epoch, failure, asked, fromBox ? text : null)
            return
          }
          // The server has no chat yet. The old endpoint answers this question and every one after it, and the person is told nothing.
          this.set({ engine: 'legacy', list: EMPTY_LIST })
        }
      }
      try {
        const reply = await this.legacy(text, history)
        this.landLegacy(epoch, reply)
      } catch (error) {
        this.fail(epoch, { kind: 'server', text: legacyFailureText(error), limit: null }, asked, fromBox ? text : null)
      }
    } finally {
      this.sending = false
      this.set({ busy: false })
    }
  }

  private landAnswer(epoch: number, conversationId: number, message: Parameters<typeof entryFromMessage>[0]): void {
    this.setStale()
    if (epoch !== this.epoch) {
      // The person moved on. If what they are looking at is this very conversation (they opened it from the list while the answer was on its way), read it
      // again so the answer appears; any other chat must not get it.
      if (this.state.conversationId === conversationId && this.state.view === 'chat' && !this.state.opening) void this.loadConversation(conversationId, this.epoch)
      return
    }
    this.set({ conversationId, entries: [...this.state.entries, entryFromMessage(message)] })
  }

  private landLegacy(epoch: number, reply: string): void {
    if (epoch !== this.epoch) return
    const answer: ChatEntry = { key: `a${++this.counter}`, role: 'assistant', text: reply, status: null, citations: [], createdAt: null, engine: 'legacy' }
    this.set({ entries: [...this.state.entries, answer] })
  }

  /** A failed question: said in words; the question leaves the transcript and returns to the box (unless the person has typed something else meanwhile). */
  private fail(epoch: number, failure: Failure, asked: ChatEntry, restore: string | null): void {
    if (failure.kind === 'daily_limit') this.set({ dailyLimit: { limit: failure.limit } })
    if (epoch !== this.epoch) return
    const entries = this.state.entries.filter((entry) => entry !== asked)
    const draft = restore !== null && this.state.draft === '' ? restore : this.state.draft
    if (failure.kind === 'conversation_gone') {
      this.set({ conversationId: null, entries: [], draft, notice: { kind: failure.kind, text: failure.text } })
      return
    }
    // The day's cap is not a notice that passes: the box says it for as long as it is true (`dailyLimit`).
    this.set({ entries, draft, notice: failure.kind === 'daily_limit' ? null : { kind: failure.kind, text: failure.text } })
  }

  // ── Chats ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  newChat(): void {
    this.epoch += 1
    this.set({ conversationId: null, entries: [], notice: null, opening: false, view: 'chat' })
  }

  async openConversation(id: number): Promise<void> {
    this.epoch += 1
    this.set({ view: 'chat', conversationId: null, entries: [], notice: null, opening: true })
    await this.loadConversation(id, this.epoch)
  }

  private async loadConversation(id: number, epoch: number): Promise<void> {
    try {
      const response = await this.service.conversation(id)
      if (epoch !== this.epoch) return
      this.set({ opening: false, conversationId: response.data.id, entries: response.data.messages.map(entryFromMessage) })
    } catch (error) {
      if (epoch !== this.epoch) return
      const failure = describeFailure(error, 'open')
      this.set({ opening: false, view: 'list', notice: { kind: failure.kind, text: failure.text } })
      if (failure.kind === 'conversation_gone') void this.loadList(1)
    }
  }

  // ── The list ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  /** Shows the list of earlier conversations, read afresh (a chat asked a moment ago must be in it). */
  showList(): void {
    if (this.state.engine === 'legacy') return
    this.set({ view: 'list', notice: null })
    void this.loadList(1)
  }

  showChat(): void {
    this.set({ view: 'chat' })
  }

  /** On the first opening of the panel: finds out whether the server has the chat at all, so a server that does not is known before the first question. */
  start(): void {
    if (this.state.engine === 'ask' && this.state.list.status === 'idle') void this.loadList(1)
  }

  loadMore(): void {
    const { pagination, loadingMore } = this.state.list
    if (pagination === null || loadingMore || pagination.page >= pagination.last_page) return
    void this.loadList(pagination.page + 1)
  }

  retryList(): void {
    void this.loadList(1)
  }

  /** The list is out of date (a conversation was asked into): the next time it is shown it is read again. */
  private setStale(): void {
    if (this.state.list.status === 'ready') this.setList({ status: 'idle' })
  }

  private async loadList(page: number): Promise<void> {
    if (this.state.engine === 'legacy') return
    const seq = ++this.listSeq
    const appending = page > 1
    this.setList(appending ? { loadingMore: true } : { status: this.state.list.rows.length > 0 ? 'ready' : 'loading', error: null })
    try {
      const response = await this.service.conversations({ page, per_page: PER_PAGE })
      if (seq !== this.listSeq) return
      const known = appending ? this.state.list.rows : []
      const fresh = response.data.rows.filter((row) => !known.some((have) => have.id === row.id))
      this.setList({ status: 'ready', rows: [...known, ...fresh], pagination: response.data.pagination, loadingMore: false, error: null })
    } catch (error) {
      if (seq !== this.listSeq) return
      const failure = describeFailure(error, 'list')
      if (failure.kind === 'endpoint_missing') {
        this.set({ engine: 'legacy', view: 'chat', list: EMPTY_LIST })
        return
      }
      this.setList({ status: 'error', loadingMore: false, error: failure.text })
    }
  }
}
