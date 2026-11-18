import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { AskApiError } from '../../services/agent/ask-errors'
import { parseAnswer, parseCitations, parseConversation, parseConversationsPage, parseMessage } from '../../services/agent/ask-parse'
import { askBody, askQuery, createAskService, TIMEOUT_TEXT, UNREADABLE_TEXT } from '../../services/agent/ask-service'
import { answer, conversation, LEAD, message, page, row } from './fixtures'

interface Call { url: string; init?: RequestInit }

/** Replaces fetch for one test and records what was asked of it. No request leaves the process. */
function fakeFetch(reply: (init?: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => { calls.push({ url: String(url), init }); return reply(init) }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
  return calls
}
const restore: Array<() => void> = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const service = createAskService()

describe('reading a message: nothing the server sends can break the chat', () => {
  it('keeps what it understands and gives every other field its empty value', () => {
    assert.deepEqual(parseMessage({ id: 11, role: 'assistant', text: 'Hi', status: 'answered', citations: [{ type: 'lead', id: 201, label: 'A', url: '/x' }], created_at: '2026-11-04T09:30:00+00:00' }), {
      id: 11, role: 'assistant', text: 'Hi', status: 'answered', citations: [{ type: 'lead', id: '201', label: 'A', url: '/x' }], created_at: '2026-11-04T09:30:00+00:00',
    })
    assert.deepEqual(parseMessage({ id: '12', text: 'Hi' }), { id: 12, role: 'assistant', text: 'Hi', status: null, citations: [], created_at: null })
    assert.equal(parseMessage({ id: 1, role: 'user', text: 'Q' })?.role, 'user')
    assert.equal(parseMessage({ id: 1, role: 'system', text: 'Q' })?.role, 'assistant', 'only a user\'s question is drawn as the user\'s')
  })

  it('drops a message that cannot be told from nothing (no id, or no words and no status) and keeps a status with no words', () => {
    for (const bad of [null, undefined, 'text', 5, [], {}, { text: 'no id' }, { id: 0, text: 'x' }, { id: -3, text: 'x' }, { id: 1.5, text: 'x' }, { id: 'abc', text: 'x' }, { id: 1 }, { id: 1, text: '   ' }, { id: 1, text: 7 }]) {
      assert.equal(parseMessage(bad), null, JSON.stringify(bad))
    }
    assert.deepEqual(parseMessage({ id: 3, text: '', status: 'refused' }), { id: 3, role: 'assistant', text: '', status: 'refused', citations: [], created_at: null })
  })

  it('reads citations tolerantly: ids as text, a missing label as empty, a bad row dropped', () => {
    assert.deepEqual(parseCitations([{ type: 'lead', id: 5, label: 'L', url: null }, { type: 'signal', id: 'abc', label: 'S' }, null, 'x', { type: '', id: 1 }, { type: 'lead' }, { id: 4 }, { type: 'task', id: 9, label: 3, url: 5 }]), [
      { type: 'lead', id: '5', label: 'L', url: null }, { type: 'signal', id: 'abc', label: 'S', url: null }, { type: 'task', id: '9', label: '', url: null },
    ])
    assert.deepEqual(parseCitations('nope'), [])
    assert.deepEqual(parseCitations(undefined), [])
  })

  it('needs both a conversation and a readable message to call it an answer', () => {
    assert.deepEqual(parseAnswer({ conversation_id: 5, message: { id: 11, text: 'Hi' } })?.conversation_id, 5)
    assert.equal(parseAnswer({ message: { id: 11, text: 'Hi' } }), null)
    assert.equal(parseAnswer({ conversation_id: 5 }), null)
    assert.equal(parseAnswer({ conversation_id: 5, message: { text: 'Hi' } }), null)
    assert.equal(parseAnswer(null), null)
    assert.equal(parseAnswer('<html>'), null)
  })
})

describe('reading the conversations', () => {
  it('reads the server\'s {rows, pagination}', () => {
    const parsed = parseConversationsPage({ rows: [row({ id: 7, title: 'T', context: { type: 'lead', id: 3 }, message_count: 4 })], pagination: { page: 2, per_page: 20, total: 41, last_page: 3 } })
    assert.deepEqual(parsed.rows, [{ id: 7, title: 'T', context: { type: 'lead', id: 3 }, message_count: 4, created_at: row().created_at, updated_at: row().updated_at }])
    assert.deepEqual(parsed.pagination, { page: 2, per_page: 20, total: 41, last_page: 3 })
  })

  it('also accepts a bare list, drops rows without an id, and ignores a context it does not know', () => {
    const parsed = parseConversationsPage([{ id: 1, title: 'A' }, { title: 'no id' }, null, { id: 2, title: 'B', context: { type: 'quote', id: 1 } }, { id: 3, title: 'C', context: { type: 'lead', id: 0 } }])
    assert.deepEqual(parsed.rows.map((r) => [r.id, r.title, r.context]), [[1, 'A', null], [2, 'B', null], [3, 'C', null]])
    assert.deepEqual(parsed.pagination, { page: 1, per_page: 3, total: 3, last_page: 1 })
  })

  it('answers an empty list for anything else', () => {
    for (const bad of [null, undefined, 'x', 7, {}, { rows: 'x' }]) assert.deepEqual(parseConversationsPage(bad).rows, [], JSON.stringify(bad))
    assert.deepEqual(parseConversationsPage(null).pagination, { page: 1, per_page: 1, total: 0, last_page: 1 })
  })

  it('reads one conversation with its messages, dropping the ones it cannot read, and refuses a body with no id', () => {
    const parsed = parseConversation({ ...row({ id: 9 }), messages: [{ id: 1, role: 'user', text: 'Q' }, { text: 'no id' }, { id: 2, text: 'A', status: 'answered' }] })
    assert.deepEqual(parsed?.messages.map((m) => m.id), [1, 2])
    assert.equal(parsed?.id, 9)
    assert.deepEqual(parseConversation({ id: 9 })?.messages, [])
    assert.equal(parseConversation({ title: 'x', messages: [] }), null)
    assert.equal(parseConversation(null), null)
  })
})

describe('the request bodies', () => {
  it('sends the question alone, and a conversation or a record only when there is one', () => {
    assert.deepEqual(askBody({ message: 'Hi' }), { message: 'Hi' })
    assert.deepEqual(askBody({ message: 'Hi', conversationId: null, context: null }), { message: 'Hi' })
    assert.deepEqual(askBody({ message: 'Hi', conversationId: 5 }), { message: 'Hi', conversation_id: 5 })
    assert.deepEqual(askBody({ message: 'Hi', conversationId: 5, context: { type: 'lead', id: 201 } }), { message: 'Hi', conversation_id: 5, context: { type: 'lead', id: 201 } })
  })

  it('sends only the type and id of a record, whatever else the object carries', () => {
    const body = askBody({ message: 'Hi', context: { type: 'lead', id: 201, name: 'Rahul', email: 'r@example.com' } as never })
    assert.deepEqual(body.context, { type: 'lead', id: 201 })
  })

  it('puts a query in as text and leaves out what was not chosen', () => {
    assert.deepEqual(askQuery({ page: 2, per_page: 20 }), { page: '2', per_page: '20' })
    assert.deepEqual(askQuery({ page: undefined, per_page: '' }), {})
  })
})

describe('asking', () => {
  it('POSTs the question to the ask path with JSON headers and reads the answer', async () => {
    const calls = fakeFetch(() => json(200, answer({ conversation_id: 8, message: { text: 'Done.' } })))
    const response = await service.ask({ message: 'What is open?', conversationId: 8, context: { type: 'organization', id: 135 } })
    assert.match(calls[0].url, /\/agent\/ask$/)
    assert.equal(calls[0].init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { message: 'What is open?', conversation_id: 8, context: { type: 'organization', id: 135 } })
    assert.equal((calls[0].init?.headers as Record<string, string>)['Content-Type'], 'application/json')
    assert.equal((calls[0].init?.headers as Record<string, string>).Accept, 'application/json')
    assert.equal(response.data.conversation_id, 8)
    assert.equal(response.data.message.text, 'Done.')
    assert.ok(calls[0].init?.signal instanceof AbortSignal, 'the request can be given up on: without a signal the timeout could not end it')
  })

  it('keeps the whole body of a daily-limit refusal: the code and the number', async () => {
    fakeFetch(() => json(429, { status: 0, code: 'daily_limit', message: "You have used today's 30 questions. Try again tomorrow.", limit: 30 }))
    await assert.rejects(service.ask({ message: 'Hi' }), (error: unknown) => {
      assert.ok(error instanceof AskApiError)
      assert.deepEqual([error.status, error.code, error.limit], [429, 'daily_limit', 30])
      return true
    })
  })

  it('keeps the code of a conversation that is gone, and gives none to a route that is missing', async () => {
    fakeFetch(() => json(404, { status: 0, code: 'not_found', message: 'Conversation not found.' }))
    await assert.rejects(service.ask({ message: 'Hi', conversationId: 9 }), (error: unknown) => { assert.ok(error instanceof AskApiError); assert.deepEqual([error.status, error.code], [404, 'not_found']); return true })
    fakeFetch(() => json(404, { message: 'The route api/agent/ask could not be found.' }))
    await assert.rejects(service.ask({ message: 'Hi' }), (error: unknown) => { assert.ok(error instanceof AskApiError); assert.deepEqual([error.status, error.code], [404, null]); return true })
  })

  it('takes the server\'s sentence on a 422 and its field errors, and a plain line when the body is not JSON', async () => {
    fakeFetch(() => json(422, { status: 0, message: 'A question can have at most 1000 characters.', errors: { message: ['too long'] } }))
    await assert.rejects(service.ask({ message: 'Hi' }), (error: unknown) => { assert.ok(error instanceof ApiError); assert.equal(error.message, 'A question can have at most 1000 characters.'); assert.deepEqual(error.errors, { message: ['too long'] }); return true })
    fakeFetch(() => new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }))
    await assert.rejects(service.ask({ message: 'Hi' }), (error: unknown) => { assert.ok(error instanceof AskApiError); assert.equal(error.status, 502); assert.match(error.message, /502/); return true })
  })

  it('does not take a 200 it cannot read for an answer', async () => {
    for (const body of [{ status: 1, data: {} }, { status: 1 }, { status: 0, message: 'Nope.', data: answer().data }, { status: 1, data: { conversation_id: 3, message: { text: 'x' } } }]) {
      fakeFetch(() => json(200, body))
      await assert.rejects(service.ask({ message: 'Hi' }), (error: unknown) => { assert.ok(error instanceof AskApiError); assert.equal(error.code, 'bad_response'); return true })
    }
    fakeFetch(() => new Response('<html></html>', { status: 200 }))
    await assert.rejects(service.ask({ message: 'Hi' }), (error: unknown) => { assert.ok(error instanceof AskApiError); assert.equal(error.message, UNREADABLE_TEXT); return true })
  })

  it('gives up after the time it was given, and says so in words', async () => {
    fakeFetch((init) => new Promise<Response>((_, reject) => { init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))) }))
    await assert.rejects(createAskService({ timeoutMs: 15 }).ask({ message: 'Hi' }), (error: unknown) => {
      assert.ok(error instanceof AskApiError)
      assert.deepEqual([error.code, error.message], ['timeout', TIMEOUT_TEXT])
      return true
    })
  })

  it('lets a request that never reached the server fail as itself, so the chat can say "check your connection"', async () => {
    fakeFetch(() => { throw new TypeError('Failed to fetch') })
    await assert.rejects(service.ask({ message: 'Hi' }), (error: unknown) => { assert.ok(error instanceof TypeError); assert.ok(!(error instanceof AskApiError)); return true })
  })
})

describe('reading the conversations over the wire', () => {
  it('lists at the conversations path with the page asked for', async () => {
    const calls = fakeFetch(() => json(200, page([row()], { page: 2, last_page: 3, total: 41 })))
    const response = await service.conversations({ page: 2, per_page: 20 })
    assert.match(calls[0].url, /\/agent\/conversations\?page=2&per_page=20$/)
    assert.equal(calls[0].init?.method, 'GET')
    assert.equal(response.data.rows.length, 1)
    assert.equal(response.data.pagination.last_page, 3)
  })

  it('reads one conversation at its own path and puts the id in as text', async () => {
    const calls = fakeFetch(() => json(200, conversation()))
    const response = await service.conversation(5)
    assert.match(calls[0].url, /\/agent\/conversations\/5$/)
    assert.equal(response.data.messages.length, 2)
    await service.conversation('7/../9?x=1' as never)
    assert.match(calls[1].url, /\/agent\/conversations\/7%2F\.\.%2F9%3Fx%3D1$/)
  })

  it('answers a 404 with an ApiError that carries the status, and a conversation with no id as unreadable', async () => {
    fakeFetch(() => json(404, { status: 0, message: 'Conversation not found.' }))
    await assert.rejects(service.conversation(5), (error: unknown) => { assert.ok(error instanceof ApiError); assert.equal(error.status, 404); return true })
    fakeFetch(() => json(200, { status: 1, data: { messages: [] } }))
    await assert.rejects(service.conversation(5), (error: unknown) => { assert.ok(error instanceof AskApiError); assert.equal(error.code, 'bad_response'); return true })
  })

  it('draws an unreadable list as an empty one, not a crash', async () => {
    fakeFetch(() => json(200, { status: 1, data: 'garbage' }))
    assert.deepEqual((await service.conversations({})).data.rows, [])
  })

  it('keeps the citations of a stored message', async () => {
    fakeFetch(() => json(200, conversation({ messages: [message({ citations: [LEAD] })] })))
    assert.deepEqual((await service.conversation(5)).data.messages[0].citations, [LEAD])
  })
})
