import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { AskApiError } from '../../services/agent/ask-errors'
import type { AskApi } from '../../services/agent/ask-types'
import { deferred, fakeAskService } from './fake-service'
import { answer, asked, conversation, LEAD, message, page, row } from './fixtures'
import { GONE_TEXT } from './model'
import { AskSession, legacyFailureText, type LegacyChat } from './session'
import type { ChatEngine } from './engine'

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function make(overrides: Partial<AskApi> = {}, options: { engine?: ChatEngine; legacy?: LegacyChat } = {}) {
  const { service, calls } = fakeAskService(overrides)
  const legacyCalls: Array<{ question: string; history: Array<{ role: string; content: string }>; extra: unknown[] }> = []
  const legacy: LegacyChat = options.legacy ?? (async (...args: unknown[]) => {
    const [question, history, ...extra] = args as [string, Array<{ role: string; content: string }>, ...unknown[]]
    legacyCalls.push({ question, history, extra })
    return 'An old-style reply.'
  })
  const session = new AskSession({ service, legacy, engine: options.engine ?? 'ask' })
  const state = () => session.getState()
  return { session, state, calls, legacyCalls }
}

const askError = (status: number, code: string | null, limit: number | null = null, text = 'x') => new AskApiError(text, status, undefined, undefined, code, limit)
const texts = (entries: ReadonlyArray<{ role: string; text: string }>) => entries.map((e) => `${e.role}: ${e.text}`)

describe('asking', () => {
  it('shows the question at once, then the answer, and remembers the conversation the server opened', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    const { session, state, calls } = make({ ask: () => pending.promise })
    session.setDraft('  What is open?  ')
    const sent = session.send()
    assert.deepEqual(texts(state().entries), ['user: What is open?'], 'trimmed, and on screen before the answer')
    assert.equal(state().draft, '', 'the box is emptied')
    assert.equal(state().busy, true)
    assert.equal(state().thinking, true)
    pending.resolve(answer({ conversation_id: 8, message: { text: 'One deal.' } }))
    await sent
    assert.deepEqual(texts(state().entries), ['user: What is open?', 'assistant: One deal.'])
    assert.equal(state().conversationId, 8)
    assert.equal(state().busy, false)
    assert.equal(state().thinking, false)
    assert.deepEqual(calls.ask, [{ message: 'What is open?', conversationId: null, context: null }])
  })

  it('carries on in the same conversation, and sends the record only when the person brought it', async () => {
    const { session, calls } = make({ ask: async () => answer({ conversation_id: 8 }) })
    await session.send('First')
    await session.send('Second', { type: 'lead', id: 201 })
    assert.deepEqual(calls.ask.map((c) => [c.message, c.conversationId, c.context]), [['First', null, null], ['Second', 8, { type: 'lead', id: 201 }]])
  })

  it('sends a suggestion without touching what the person has typed', async () => {
    const { session, state } = make()
    session.setDraft('half a thought')
    await session.send('How many leads came from signals?')
    assert.equal(state().draft, 'half a thought')
  })

  it('sends nothing for an empty question, and says why for one that is too long', async () => {
    const { session, state, calls } = make()
    session.setDraft('   ')
    await session.send()
    await session.send('')
    assert.equal(calls.ask.length, 0)
    assert.deepEqual(state().entries, [])
    session.setDraft('a'.repeat(1001))
    await session.send()
    assert.equal(calls.ask.length, 0)
    assert.equal(state().notice?.text, 'A question can have at most 1,000 characters.')
    assert.equal(state().draft.length, 1001, 'the question stays in the box to be shortened')
    assert.equal(state().entries.length, 0)
  })

  it('keeps ONE question in flight, even when two are sent in the same tick', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    const { session, state, calls } = make({ ask: () => pending.promise })
    const first = session.send('First')
    const second = session.send('Second')
    const third = session.send('Third')
    assert.equal(calls.ask.length, 1, 'one request, decided before anything was awaited')
    assert.deepEqual(texts(state().entries), ['user: First'])
    pending.resolve(answer())
    await Promise.all([first, second, third])
    assert.equal(calls.ask.length, 1)
    assert.equal(texts(state().entries).length, 2)
    await session.send('Fourth')
    assert.equal(calls.ask.length, 2, 'free again once the first was answered')
  })

  it('frees the lock when the question fails, so the person can try again', async () => {
    let n = 0
    const { session, calls } = make({ ask: async () => { n += 1; if (n === 1) throw new TypeError('Failed to fetch'); return answer() } })
    await session.send('Q')
    await session.send('Q')
    assert.equal(calls.ask.length, 2)
  })
})

describe('an answer that arrives late', () => {
  it('is dropped when the person started a new chat meanwhile, and the new chat stays empty', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    const { session, state } = make({ ask: () => pending.promise })
    const sent = session.send('Old question')
    session.newChat()
    assert.equal(state().busy, true, 'the old question is still on its way')
    assert.equal(state().thinking, false, 'but the new chat is not waiting for it')
    pending.resolve(answer({ conversation_id: 8, message: { text: 'Late answer' } }))
    await sent
    assert.deepEqual(state().entries, [])
    assert.equal(state().conversationId, null)
    assert.equal(state().busy, false)
  })

  it('is dropped when the person opened another conversation, and that conversation is not touched', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    const { session, state } = make({
      ask: () => pending.promise,
      conversation: async (id) => conversation({ id, messages: [asked({ id: 1, text: 'Earlier question' }), message({ id: 2, text: 'Earlier answer' })] }),
    })
    const sent = session.send('New question')
    await session.openConversation(7)
    pending.resolve(answer({ conversation_id: 8, message: { text: 'Late answer for chat 8' } }))
    await sent
    await settle()
    assert.deepEqual(texts(state().entries), ['user: Earlier question', 'assistant: Earlier answer'])
    assert.equal(state().conversationId, 7)
  })

  it('does not let a second question be sent while the first is still on its way, even from a new chat', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    const { session, state, calls } = make({ ask: () => pending.promise })
    const sent = session.send('First')
    session.newChat()
    await session.send('Second')
    assert.equal(calls.ask.length, 1)
    assert.deepEqual(state().entries, [])
    pending.resolve(answer())
    await sent
    await session.send('Second')
    assert.equal(calls.ask.length, 2)
  })

  it('appears when the person opened the very conversation the answer belongs to (it is read again)', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    let reads = 0
    const { session, state, calls } = make({
      ask: () => pending.promise,
      conversation: async () => {
        reads += 1
        return conversation({ id: 5, messages: reads === 1 ? [asked({ id: 1, text: 'Q' })] : [asked({ id: 1, text: 'Q' }), message({ id: 2, text: 'The answer' })] })
      },
    })
    const sent = session.send('Q')
    await session.openConversation(5)
    assert.deepEqual(texts(state().entries), ['user: Q'], 'the answer was not stored yet when the conversation was read')
    pending.resolve(answer({ conversation_id: 5, message: { id: 2, text: 'The answer' } }))
    await sent
    await settle()
    assert.deepEqual(calls.conversation, [5, 5])
    assert.deepEqual(texts(state().entries), ['user: Q', 'assistant: The answer'])
  })

  it('does not reload a conversation the person is no longer looking at', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    const { session, calls } = make({ ask: () => pending.promise })
    const sent = session.send('Q')
    session.newChat()
    pending.resolve(answer({ conversation_id: 5 }))
    await sent
    await settle()
    assert.deepEqual(calls.conversation, [])
  })

  it('is dropped when it fails after the person moved on, without a notice in the new chat', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    const { session, state } = make({ ask: () => pending.promise })
    const sent = session.send('Q')
    session.newChat()
    pending.reject(new TypeError('Failed to fetch'))
    await sent
    assert.equal(state().notice, null)
    assert.deepEqual(state().entries, [])
  })
})

describe('a question that fails', () => {
  it('leaves nothing in the transcript, returns to the box, and says what happened in words', async () => {
    const { session, state } = make({ ask: async () => { throw new TypeError('Failed to fetch') } })
    session.setDraft('Which leads are cold?')
    await session.send()
    assert.deepEqual(state().entries, [])
    assert.equal(state().draft, 'Which leads are cold?')
    assert.equal(state().notice?.kind, 'network')
    assert.match(state().notice!.text, /did not reach the server/)
  })

  it('does not overwrite what the person typed in the meantime', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    const { session, state } = make({ ask: () => pending.promise })
    session.setDraft('First')
    const sent = session.send()
    session.setDraft('Something new')
    pending.reject(new TypeError('Failed to fetch'))
    await sent
    assert.equal(state().draft, 'Something new')
  })

  it('does not put a suggestion into the box', async () => {
    const { session, state } = make({ ask: async () => { throw new TypeError('x') } })
    await session.send('How many leads came from signals?')
    assert.equal(state().draft, '')
  })

  it('clears the notice at the next question', async () => {
    let n = 0
    const { session, state } = make({ ask: async () => { n += 1; if (n === 1) throw new TypeError('x'); return answer() } })
    await session.send('Q')
    assert.notEqual(state().notice, null)
    await session.send('Q')
    assert.equal(state().notice, null)
  })

  it('switches the box off for the rest of the visit when the day\'s questions are used up, and says how many there were', async () => {
    const { session, state, calls } = make({ ask: async () => { throw askError(429, 'daily_limit', 30) } })
    session.setDraft('One more')
    await session.send()
    assert.deepEqual(state().dailyLimit, { limit: 30 })
    assert.equal(state().notice, null, 'the box says it for as long as it is true, not a notice that passes')
    assert.equal(state().draft, 'One more')
    await session.send()
    assert.equal(calls.ask.length, 1, 'no second request once the server said no')
    session.newChat()
    assert.deepEqual(state().dailyLimit, { limit: 30 }, 'a new chat does not give the day\'s questions back')
    await session.send('Another')
    assert.equal(calls.ask.length, 1)
  })

  it('says the conversation is gone, and starts a new one with the next question', async () => {
    let n = 0
    const { session, state, calls } = make({
      ask: async () => { n += 1; if (n === 1) throw askError(404, 'not_found'); return answer({ conversation_id: 12 }) },
      conversation: async () => conversation({ id: 5 }),
    })
    await session.openConversation(5)
    await session.send('Q')
    assert.equal(state().notice?.text, GONE_TEXT)
    assert.equal(state().conversationId, null)
    assert.deepEqual(state().entries, [])
    await session.send('Q')
    assert.deepEqual(calls.ask.map((c) => c.conversationId), [5, null])
  })

  it('says a refusal of the right to ask in words and keeps the question', async () => {
    const { session, state } = make({ ask: async () => { throw new ApiError('Your role does not have access to this screen.', 403) } })
    session.setDraft('Q')
    await session.send()
    assert.equal(state().notice?.kind, 'forbidden')
    assert.equal(state().draft, 'Q')
  })
})

describe('a server with no chat yet', () => {
  it('answers through the old endpoint, silently, on a 404 that is not a missing conversation', async () => {
    const { session, state, calls, legacyCalls } = make({ ask: async () => { throw new ApiError('The route api/agent/ask could not be found.', 404) } })
    await session.send('Hello')
    assert.equal(state().engine, 'legacy')
    assert.equal(state().notice, null, 'nothing alarming')
    assert.deepEqual(texts(state().entries), ['user: Hello', 'assistant: An old-style reply.'])
    assert.equal(state().entries[1].engine, 'legacy')
    assert.deepEqual(legacyCalls.map((c) => c.question), ['Hello'])
    await session.send('Again')
    assert.equal(calls.ask.length, 1, 'the new route is not tried again')
    assert.equal(legacyCalls.length, 2)
  })

  it('sends the old endpoint the last ten messages and nothing about a record', async () => {
    const { session, legacyCalls } = make({}, { engine: 'legacy' })
    for (let i = 1; i <= 7; i += 1) await session.send(`Question ${i}`, { type: 'lead', id: 201 })
    const last = legacyCalls[6]
    assert.equal(last.history.length, 10)
    assert.deepEqual(last.history[0], { role: 'user', content: 'Question 2' })
    assert.deepEqual(last.history[9], { role: 'assistant', content: 'An old-style reply.' })
    assert.deepEqual(last.extra, [], 'the record is not handed to the old endpoint: it would put the whole row in the prompt')
  })

  it('never calls the new endpoint when the constant says legacy, and offers no list', async () => {
    const { session, state, calls } = make({}, { engine: 'legacy' })
    session.start()
    session.showList()
    await session.send('Hello')
    await settle()
    assert.deepEqual([calls.ask.length, calls.conversations.length, calls.conversation.length], [0, 0, 0])
    assert.equal(state().view, 'chat')
    assert.equal(state().entries.length, 2)
  })

  it('finds out from the list, before the first question, when the server has no chat', async () => {
    const { session, state, calls } = make({ conversations: async () => { throw new ApiError('Not Found', 404) } })
    session.start()
    await settle()
    assert.equal(state().engine, 'legacy')
    assert.equal(state().notice, null)
    await session.send('Hello')
    assert.equal(calls.ask.length, 0)
  })

  it('says the old endpoint\'s own explanation when it fails, as it always did', async () => {
    const { session, state } = make({}, { engine: 'legacy', legacy: async () => { throw new ApiError('Model busy', 503, undefined, 'Try later') } })
    await session.send('Hello')
    assert.equal(state().notice?.text, 'Try later')
    assert.equal(legacyFailureText(new TypeError('x')), 'Network error. Please try again.')
    assert.equal(legacyFailureText(new ApiError('Only a message', 500)), 'Only a message')
  })
})

describe('the list of earlier conversations', () => {
  it('is read once when the panel first opens, and again every time it is shown', async () => {
    const { session, state, calls } = make({ conversations: async () => page([row({ id: 1 }), row({ id: 2 })]) })
    session.start()
    session.start()
    await settle()
    assert.equal(calls.conversations.length, 1)
    assert.deepEqual(calls.conversations[0], { page: 1, per_page: 20 })
    assert.equal(state().list.status, 'ready')
    session.showList()
    assert.equal(state().view, 'list')
    await settle()
    assert.equal(calls.conversations.length, 2)
    assert.deepEqual(state().list.rows.map((r) => r.id), [1, 2])
  })

  it('goes out of date when a question is answered, so the new chat is in it next time', async () => {
    const { session, state, calls } = make({ conversations: async () => page([row()]) })
    session.start()
    await settle()
    await session.send('Q')
    assert.equal(state().list.status, 'idle')
    session.start()
    await settle()
    assert.equal(calls.conversations.length, 2)
  })

  it('adds the next page below the first, without a conversation twice', async () => {
    const { session, state, calls } = make({
      conversations: async (params) => (params.page === 2 ? page([row({ id: 2 }), row({ id: 3 })], { page: 2, last_page: 2, total: 3 }) : page([row({ id: 1 }), row({ id: 2 })], { page: 1, last_page: 2, total: 3 })),
    })
    session.showList()
    await settle()
    session.loadMore()
    await settle()
    assert.deepEqual(state().list.rows.map((r) => r.id), [1, 2, 3])
    assert.deepEqual(calls.conversations.map((c) => c.page), [1, 2])
    session.loadMore()
    await settle()
    assert.equal(calls.conversations.length, 2, 'no page past the last')
  })

  it('shows an error with a way to try again, and the old rows stay while a refresh is on its way', async () => {
    let n = 0
    const { session, state } = make({ conversations: async () => { n += 1; if (n === 2) throw new ApiError('boom', 500); return page([row({ id: 1 })]) } })
    session.showList()
    await settle()
    session.showList()
    await settle()
    assert.equal(state().list.status, 'error')
    assert.equal(state().list.error, 'Your conversations could not be loaded.')
    session.retryList()
    await settle()
    assert.equal(state().list.status, 'ready')
    assert.equal(state().list.error, null)
  })

  it('ignores a slow older answer that arrives after a newer one', async () => {
    const slow = deferred<ReturnType<typeof page>>()
    const fast = deferred<ReturnType<typeof page>>()
    let n = 0
    const { session, state } = make({ conversations: () => (++n === 1 ? slow.promise : fast.promise) })
    session.showList()
    session.showList()
    fast.resolve(page([row({ id: 2 })]))
    await settle()
    slow.resolve(page([row({ id: 1 })]))
    await settle()
    assert.deepEqual(state().list.rows.map((r) => r.id), [2])
  })
})

describe('opening an older conversation', () => {
  it('shows its messages as the new engine\'s entries and continues it with the next question', async () => {
    const { session, state, calls } = make({ conversation: async () => conversation({ id: 7, messages: [asked({ id: 1 }), message({ id: 2, text: 'Old answer', citations: [LEAD] })] }), ask: async () => answer({ conversation_id: 7 }) })
    session.showList()
    await session.openConversation(7)
    assert.equal(state().view, 'chat')
    assert.equal(state().conversationId, 7)
    assert.equal(state().entries[1].citations.length, 1)
    assert.equal(state().opening, false)
    await session.send('And for them?')
    assert.equal(calls.ask[0].conversationId, 7)
  })

  it('says a conversation that is gone is gone, goes back to the list and reads the list again', async () => {
    const { session, state, calls } = make({ conversation: async () => { throw new ApiError('Conversation not found.', 404) } })
    await session.openConversation(7)
    await settle()
    assert.equal(state().view, 'list')
    assert.equal(state().notice?.text, GONE_TEXT)
    assert.equal(calls.conversations.length, 1)
    assert.equal(state().opening, false)
  })

  it('sends nothing while a conversation is being opened', async () => {
    const pending = deferred<ReturnType<typeof conversation>>()
    const { session, state, calls } = make({ conversation: () => pending.promise })
    const opened = session.openConversation(7)
    assert.equal(state().opening, true)
    await session.send('Q')
    assert.equal(calls.ask.length, 0)
    pending.resolve(conversation({ id: 7 }))
    await opened
  })

  it('shows the last conversation asked for when two are asked for in a row', async () => {
    const first = deferred<ReturnType<typeof conversation>>()
    const second = deferred<ReturnType<typeof conversation>>()
    let n = 0
    const { session, state } = make({ conversation: () => (++n === 1 ? first.promise : second.promise) })
    const a = session.openConversation(1)
    const b = session.openConversation(2)
    second.resolve(conversation({ id: 2, messages: [asked({ id: 1, text: 'Second chat' })] }))
    await b
    first.resolve(conversation({ id: 1, messages: [asked({ id: 1, text: 'First chat' })] }))
    await a
    assert.equal(state().conversationId, 2)
    assert.deepEqual(texts(state().entries), ['user: Second chat'])
  })

  it('starts a new chat that is empty, keeps what is typed, and shows the chat', async () => {
    const { session, state } = make({ ask: async () => answer({ conversation_id: 3 }) })
    await session.send('Q')
    session.showList()
    session.setDraft('typed')
    session.newChat()
    assert.deepEqual([state().entries.length, state().conversationId, state().view, state().draft], [0, null, 'chat', 'typed'])
  })
})

describe('the store', () => {
  it('tells its listeners about every change, and stops telling one that left', async () => {
    const { session } = make()
    let heard = 0
    const stop = session.subscribe(() => { heard += 1 })
    session.setDraft('a')
    assert.equal(heard, 1)
    stop()
    session.setDraft('b')
    assert.equal(heard, 1)
  })

  it('gives a new state object on every change and the same one between changes (React compares them)', () => {
    const { session } = make()
    const before = session.getState()
    assert.equal(session.getState(), before)
    session.setDraft('a')
    assert.notEqual(session.getState(), before)
  })
})
