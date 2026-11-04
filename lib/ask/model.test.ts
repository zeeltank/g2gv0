import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { AskApiError } from '../../services/agent/ask-errors'
import { NETWORK_TEXT } from '../agent/model'
import {
  citationItems, conversationMeta, conversationTitle, dailyLimitText, describeFailure, entryFromMessage, lacksCitations, MAX_QUESTION_CHARS, questionProblem, safeLink, statusView, suggestions,
  UNTITLED_CONVERSATION,
} from './model'
import { LEAD, message, ORG, row } from './fixtures'

const askError = (status: number, code: string | null, limit: number | null = null, text = 'x') => new AskApiError(text, status, undefined, undefined, code, limit)

describe('the question', () => {
  it('allows exactly the longest question and refuses one character more, in words', () => {
    assert.equal(MAX_QUESTION_CHARS, 1000)
    assert.equal(questionProblem('a'.repeat(1000)), null)
    assert.equal(questionProblem('a'.repeat(1001)), 'A question can have at most 1,000 characters.')
  })

  it('counts the question as it will be sent, without the spaces around it, and an empty one is not a problem to shout about', () => {
    assert.equal(questionProblem(`  ${'a'.repeat(1000)}  `), null)
    assert.equal(questionProblem(''), null)
    assert.equal(questionProblem('   '), null)
  })
})

describe('links: only a path inside the application or an http(s) address is ever drawn as a link', () => {
  it('accepts a path from the root, with its query', () => {
    assert.deepEqual(safeLink('/module/crm/marketing/leads/201'), { href: '/module/crm/marketing/leads/201', external: false })
    assert.deepEqual(safeLink('/module/crm/signal-review?status=all&q=Tapovan%20School'), { href: '/module/crm/signal-review?status=all&q=Tapovan%20School', external: false })
  })

  it('accepts http and https addresses and marks them as outside the application', () => {
    assert.deepEqual(safeLink('https://example.com/a?b=1'), { href: 'https://example.com/a?b=1', external: true })
    assert.deepEqual(safeLink('http://example.com'), { href: 'http://example.com', external: true })
    assert.deepEqual(safeLink('HTTPS://Example.com/x'), { href: 'HTTPS://Example.com/x', external: true })
  })

  it('refuses every other kind of address, however it is spelled', () => {
    const bad = [
      'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x',
      'file:///etc/passwd', 'ftp://example.com/x', 'mailto:a@b.co', 'tel:123', '//evil.example/x', '/\\evil.example', '\\\\evil.example', 'module/crm', 'example.com',
      'https://', 'https:///nohost', 'https://user:secret@example.com/', 'https://user@example.com/', ' /x', '/x y', '/x\ny', '/x\u0000y', 'https://exa mple.com', '',
      'https://a.com/' + 'x'.repeat(2000), null, undefined, 5, {}, [],
    ]
    for (const url of bad) assert.equal(safeLink(url), null, `not a link: ${JSON.stringify(url)}`)
  })
})

describe('citations: the records an answer rests on', () => {
  it('names each record by its label, says what kind it is, and links it when it has a safe address', () => {
    const [lead, org] = citationItems([LEAD, ORG])
    assert.deepEqual([lead.typeLabel, lead.label, lead.link], ['Lead', 'Rahul Sharma (L-0201)', { href: '/module/crm/marketing/leads/201', external: false }])
    assert.deepEqual([org.typeLabel, org.label], ['Organisation', 'Tapovan Vidya Vihar'])
  })

  it('lists a record once, however many times the answer cited it', () => {
    assert.equal(citationItems([LEAD, ORG, LEAD, { ...LEAD, label: 'again' }]).length, 2)
    assert.equal(citationItems([LEAD, { ...LEAD, id: '202' }]).length, 2, 'the same kind with another id is another record')
    assert.equal(citationItems([LEAD, { ...LEAD, type: 'contact' }]).length, 2, 'the same id with another kind is another record')
  })

  it('has a label even when the server sent none, and a kind word even for a kind it does not know', () => {
    const [blank, unknown] = citationItems([{ type: 'lead', id: '9', label: '   ', url: null }, { type: 'brand_new', id: '7', label: 'Thing', url: null }])
    assert.equal(blank.label, 'Lead 9')
    assert.equal(unknown.typeLabel, 'Record')
  })

  it('draws no link for an address that is not safe, but still names the record', () => {
    const items = citationItems([{ type: 'lead', id: '1', label: 'A', url: 'javascript:alert(1)' }, { type: 'lead', id: '2', label: 'B', url: null }, { type: 'lead', id: '3', label: 'C', url: '//evil.example' }])
    assert.deepEqual(items.map((i) => [i.label, i.link]), [['A', null], ['B', null], ['C', null]])
  })
})

describe('statuses are words', () => {
  it('says what a non-answer is: nothing found, cannot see, unavailable', () => {
    assert.deepEqual(statusView('no_data'), { label: 'Nothing found', tone: 'caution' })
    assert.deepEqual(statusView('refused'), { label: 'I cannot see that', tone: 'caution' })
    assert.deepEqual(statusView('unavailable'), { label: 'Unavailable right now', tone: 'error' })
  })

  it('draws an answer, and a status a newer server invents, as an ordinary answer (no word, no crash)', () => {
    for (const status of ['answered', 'brand_new', '', null, 'constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(statusView(status), null, `ordinary: ${String(status)}`)
  })
})

describe('failures are said in words, never as a status code', () => {
  it('names the day\'s cap on a 429 daily_limit, and still makes a sentence when the server sent no number', () => {
    assert.deepEqual(describeFailure(askError(429, 'daily_limit', 30), 'ask'), { kind: 'daily_limit', text: "You have used today's 30 questions. Try again tomorrow.", limit: 30 })
    assert.equal(describeFailure(askError(429, 'daily_limit', null), 'ask').text, "You have used today's questions. Try again tomorrow.")
    assert.equal(dailyLimitText(0), "You have used today's questions. Try again tomorrow.")
    assert.equal(dailyLimitText(1), "You have used today's 1 questions. Try again tomorrow.", 'the server\'s number, whatever it is')
  })

  it('does not call any other 429 the daily limit', () => {
    const failure = describeFailure(askError(429, null), 'ask')
    assert.equal(failure.kind, 'server')
    assert.ok(!failure.text.includes("today's"))
  })

  it('tells a conversation that is gone (404 not_found, or any 404 on reading one) from a server with no chat (a 404 on asking or listing with no such code)', () => {
    assert.equal(describeFailure(askError(404, 'not_found'), 'ask').kind, 'conversation_gone')
    assert.equal(describeFailure(new ApiError('Conversation not found.', 404), 'open').kind, 'conversation_gone')
    assert.equal(describeFailure(askError(404, null), 'ask').kind, 'endpoint_missing')
    assert.equal(describeFailure(new ApiError('The route api/agent/ask could not be found.', 404), 'ask').kind, 'endpoint_missing')
    assert.equal(describeFailure(new ApiError('Not Found', 404), 'list').kind, 'endpoint_missing')
  })

  it('says there is no access on a 403, with a sentence of its own and not the server\'s', () => {
    const failure = describeFailure(new ApiError('Your role does not have access to this screen.', 403), 'ask')
    assert.deepEqual([failure.kind, failure.text], ['forbidden', 'You do not have access to the CRM assistant.'])
  })

  it('shows the server\'s own sentence for a 422 (it says which rule was broken), and a sentence of ours for a server error', () => {
    assert.equal(describeFailure(askError(422, 'empty_question', null, 'Type a question.'), 'ask').text, 'Type a question.')
    const failure = describeFailure(new ApiError('SQLSTATE[HY000]: General error', 500), 'ask')
    assert.equal(failure.kind, 'server')
    assert.ok(!failure.text.includes('SQLSTATE'), 'a server\'s internals are not shown')
    assert.equal(describeFailure(new ApiError('boom', 500), 'list').text, 'Your conversations could not be loaded.')
  })

  it('says a timeout in the words it was made with, and a request that never reached the server as the network line', () => {
    assert.deepEqual(describeFailure(askError(0, 'timeout', null, 'The assistant took too long to answer.'), 'ask'), { kind: 'timeout', text: 'The assistant took too long to answer.', limit: null })
    assert.deepEqual(describeFailure(new TypeError('Failed to fetch'), 'ask'), { kind: 'network', text: NETWORK_TEXT, limit: null })
    assert.equal(describeFailure(new Error('weird'), 'ask').kind, 'server')
  })
})

describe('the transcript', () => {
  it('turns a server message into an entry of the new engine', () => {
    const entry = entryFromMessage(message({ id: 12, text: 'Hello', citations: [LEAD] }))
    assert.deepEqual([entry.key, entry.role, entry.text, entry.status, entry.engine, entry.citations.length], ['m12', 'assistant', 'Hello', 'answered', 'ask', 1])
  })

  it('says an answer cites nothing only when it claims to answer: not a non-answer, not a user\'s question, not the old engine\'s reply', () => {
    assert.equal(lacksCitations(entryFromMessage(message({ citations: [] }))), true)
    assert.equal(lacksCitations(entryFromMessage(message({ citations: [ORG] }))), false)
    assert.equal(lacksCitations(entryFromMessage(message({ citations: [], status: 'no_data' }))), false)
    assert.equal(lacksCitations(entryFromMessage(message({ citations: [], status: 'unavailable' }))), false)
    assert.equal(lacksCitations(entryFromMessage(message({ citations: [], role: 'user', status: null }))), false)
    assert.equal(lacksCitations({ ...entryFromMessage(message({ citations: [] })), engine: 'legacy' }), false)
    assert.equal(lacksCitations(entryFromMessage(message({ citations: [], text: '  ' }))), false, 'no words, nothing to say it lacks')
  })
})

describe('words for the panel', () => {
  it('offers questions the new engine can answer from records, never "draft", and the old engine\'s own list when it is the old engine', () => {
    const fresh = suggestions('ask', null)
    assert.equal(fresh.length, 4)
    assert.ok(fresh.every((s) => !/draft/i.test(s)))
    assert.ok(suggestions('legacy', null).includes('Draft a follow-up for my top lead'))
  })

  it('puts the record first on a record\'s page', () => {
    assert.deepEqual(suggestions('ask', 'organization').slice(0, 2), ['What should I know about this organisation?', 'What is open for this organisation?'])
    assert.equal(suggestions('ask', 'lead')[0], 'What should I know about this lead?')
    assert.equal(suggestions('legacy', 'lead'), suggestions('legacy', null), 'the old engine never gets the record')
  })

  it('titles a conversation, and says what it was about, how long it is and when', () => {
    assert.equal(conversationTitle(row({ title: '' })), UNTITLED_CONVERSATION)
    assert.equal(conversationTitle(row({ title: '  ' })), UNTITLED_CONVERSATION)
    assert.equal(conversationTitle(row({ title: 'Which signals?' })), 'Which signals?')
    assert.equal(conversationMeta(row({ context: { type: 'lead', id: 3 }, message_count: 4, updated_at: '2026-11-03T15:22:48+00:00' }), 'UTC'), 'About a lead · 4 messages · 3 Nov 2026, 15:22')
    assert.equal(conversationMeta(row({ context: { type: 'organization', id: 3 }, message_count: 1, updated_at: null })), 'About an organisation · 1 message · —')
    assert.equal(conversationMeta(row({ context: null, message_count: 2, updated_at: '2026-11-03T15:22:48+00:00' }), 'UTC'), '2 messages · 3 Nov 2026, 15:22')
  })
})
