import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { ApiError } from '../../services/core'
import { AskApiError } from '../../services/agent/ask-errors'
import { axeViolations } from '../agent/a11y'
import { absent, same } from '../agent/assertions'
import { deferred } from './fake-service'
import { answer, asked, conversation, LEAD, message, ORG, page, row, SIGNAL } from './fixtures'
import { setup } from './screen-kit'

const rows = [
  row({ id: 5, title: 'What is open for Tapovan?', message_count: 2, updated_at: '2026-11-03T15:22:48+00:00' }),
  row({ id: 6, title: 'Which signals did we dismiss last month?', context: { type: 'organization', id: 135 }, message_count: 4, updated_at: '2026-11-02T09:00:00+00:00' }),
]

describe('the list of earlier conversations', () => {
  afterEach(disposeAll)

  it('shows each conversation with its title, what it was about, how long it is and when, and goes back to the chat', async () => {
    const { k, button, press, box, focused } = await setup({ overrides: { conversations: async () => page(rows) } })
    await press(button('Conversations'))
    const text = k.bodyText()
    assert.ok(text.includes('What is open for Tapovan?'))
    assert.ok(text.includes('Which signals did we dismiss last month?'))
    assert.ok(text.includes('About an organisation · 4 messages'))
    assert.ok(text.includes('2 messages'))
    assert.equal(k.one('h3')!.textContent, 'Conversations')
    same(focused(), k.one('h3'), 'the cursor moves to the list\'s heading')
    absent(box(), 'the box is not shown over the list')
    await press(button('Back to chat'))
    assert.ok(box())
    same(focused(), box(), 'and returns to the box')
  })

  it('toggles from the header button, which says whether the list is showing', async () => {
    const { button, press, k } = await setup()
    assert.equal(button('Conversations')!.getAttribute('aria-pressed'), 'false')
    await press(button('Conversations'))
    assert.equal(button('Conversations')!.getAttribute('aria-pressed'), 'true')
    await press(button('Conversations'))
    assert.equal(k.one('h3'), null)
  })

  it('opens an older conversation with its messages, its citations and the box ready to carry on', async () => {
    const { k, button, press, bubbles, ask, calls, box, focused } = await setup({
      overrides: {
        conversations: async () => page(rows),
        conversation: async () => conversation({ id: 5, messages: [asked({ id: 1, text: 'What is open for Tapovan?' }), message({ id: 2, text: 'One deal, worth 4 lakh.', citations: [ORG, SIGNAL] })] }),
        ask: async () => answer({ conversation_id: 5, message: { id: 3, text: 'Closing in December.', citations: [ORG] } }),
      },
    })
    await press(button('Conversations'))
    await press(k.all('li button').find((b) => b.textContent!.includes('What is open for Tapovan?')))
    assert.deepEqual(calls.conversation, [5])
    assert.equal(k.one('h3'), null, 'back in the chat')
    assert.equal(bubbles('user')[0].textContent, 'You: What is open for Tapovan?')
    const reply = bubbles('assistant')[0]
    assert.ok(reply.textContent!.includes('One deal, worth 4 lakh.'))
    assert.deepEqual(Array.from(reply.querySelectorAll('a')).map((a) => a.textContent), ['Tapovan Vidya Vihar', 'Tapovan is opening a new CBSE campus'])
    same(focused(), box(), 'the cursor is in the box')
    await ask('And when does it close?')
    assert.equal(calls.ask[0].conversationId, 5, 'carries on in that conversation')
    assert.equal(bubbles('assistant').length, 2)
  })

  it('says it is opening while it reads the conversation', async () => {
    const pending = deferred<ReturnType<typeof conversation>>()
    const { k, button, press, box } = await setup({ overrides: { conversations: async () => page(rows), conversation: () => pending.promise } })
    await press(button('Conversations'))
    await press(k.all('li button')[0])
    assert.ok(k.bodyText().includes('Opening the conversation…'))
    assert.equal(box()!.value, '')
    pending.resolve(conversation({ id: 5 }))
    await k.tick(10)
    assert.equal(k.bodyText().includes('Opening the conversation…'), false)
  })

  it('marks the conversation that is open', async () => {
    const { k, button, press } = await setup({ overrides: { conversations: async () => page(rows), conversation: async () => conversation({ id: 5 }) } })
    await press(button('Conversations'))
    await press(k.all('li button')[0])
    await press(button('Conversations'))
    const current = k.all('li button').filter((b) => b.getAttribute('aria-current') === 'true')
    assert.equal(current.length, 1)
    assert.ok(current[0].textContent!.includes('What is open for Tapovan?'))
  })

  it('says there are no earlier conversations yet', async () => {
    const { k, button, press } = await setup({ overrides: { conversations: async () => page([]) } })
    await press(button('Conversations'))
    assert.ok(k.bodyText().includes('No earlier conversations yet.'))
  })

  it('says it is loading, then shows the rows', async () => {
    let n = 0
    const slow = deferred<ReturnType<typeof page>>()
    const { k, button, press } = await setup({ overrides: { conversations: () => (++n === 1 ? Promise.resolve(page([])) : slow.promise) } })
    await press(button('Conversations'))
    assert.ok(k.bodyText().includes('Loading your conversations…'))
    slow.resolve(page(rows))
    await k.tick(10)
    assert.equal(k.bodyText().includes('Loading your conversations…'), false)
    assert.equal(k.all('li').length, 2)
  })

  it('says an error in words with a Retry that works', async () => {
    let n = 0
    const { k, button, press } = await setup({ overrides: { conversations: async () => { n += 1; if (n === 2) throw new ApiError('Boom', 500); return page(rows) } } })
    await press(button('Conversations'))
    const alert = k.one('[role="alert"]')
    assert.ok(alert && alert.textContent!.includes('Your conversations could not be loaded.'))
    assert.equal(k.bodyText().includes('Boom'), false)
    await press(button('Retry'))
    assert.equal(k.all('li').length, 2)
    assert.equal(k.one('[role="alert"]'), null)
  })

  it('shows more when there are more, and stops when there are no more', async () => {
    const { k, button, press, calls } = await setup({
      overrides: { conversations: async (params) => (params.page === 2 ? page([row({ id: 7, title: 'Third' })], { page: 2, last_page: 2, total: 3 }) : page(rows, { page: 1, last_page: 2, total: 3 })) },
    })
    await press(button('Conversations'))
    assert.equal(k.all('li').length, 2)
    await press(button('Show more'))
    assert.equal(k.all('li').length, 3)
    assert.deepEqual(calls.conversations.map((c) => c.page), [1, 1, 2])
    absent(button('Show more') ?? null, 'the last page has been read')
  })

  it('says a conversation that is gone is gone, and shows the list again', async () => {
    const { k, button, press, calls } = await setup({ overrides: { conversations: async () => page(rows), conversation: async () => { throw new ApiError('Conversation not found.', 404) } } })
    await press(button('Conversations'))
    await press(k.all('li button')[0])
    await k.tick(10)
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('That conversation is no longer available.'))
    assert.ok(k.one('h3'), 'the list is showing')
    assert.ok(calls.conversations.length >= 3, 'and was read again')
  })

  it('does not widen the panel with a long title: it is a text node that wraps', async () => {
    const long = 'x'.repeat(400)
    const { k, button, press } = await setup({ overrides: { conversations: async () => page([row({ title: long })]) } })
    await press(button('Conversations'))
    const title = k.all('li button span')[0]
    assert.equal(title.textContent, long)
    assert.match(title.className, /break-words/)
  })
})

describe('accessibility (axe, the rules a fake DOM can decide)', () => {
  afterEach(disposeAll)

  it('finds nothing wrong with the closed button', async () => {
    const { launcher } = await setup({ open: false })
    assert.deepEqual(await axeViolations(launcher()!), [])
  })

  it('finds nothing wrong with the greeting', async () => {
    const { panel } = await setup()
    assert.deepEqual(await axeViolations(panel()!), [])
  })

  it('finds nothing wrong with a conversation of every kind of answer, with citations of every kind', async () => {
    const replies = [
      message({ id: 2, text: 'Cited answer.', citations: [ORG, LEAD, { type: 'signal', id: '9', label: 'External', url: 'https://example.com/x' }, { type: 'task', id: '4', label: 'No address', url: null }] }),
      message({ id: 3, text: 'I have nothing on that.', status: 'no_data', citations: [] }),
      message({ id: 4, text: 'I could not tie an answer to your records.', status: 'refused', citations: [] }),
      message({ id: 5, text: "I can't answer right now.", status: 'unavailable', citations: [] }),
      message({ id: 6, text: 'An answer with no record behind it.', citations: [] }),
    ]
    const chat = await setup({ overrides: { conversations: async () => page(rows), conversation: async () => conversation({ id: 5, messages: [asked({ id: 1 }), ...replies] }) } })
    await chat.press(chat.button('Conversations'))
    await chat.press(chat.k.all('li button')[0])
    assert.equal(chat.bubbles('assistant').length, 5)
    assert.deepEqual(await axeViolations(chat.panel()!), [])
  })

  it('finds nothing wrong with the list, the empty list, the loading list and the list with an error', async () => {
    const list = await setup({ overrides: { conversations: async () => page(rows, { last_page: 2 }) } })
    await list.press(list.button('Conversations'))
    assert.deepEqual(await axeViolations(list.panel()!), [])
    await disposeAll()

    const empty = await setup({ overrides: { conversations: async () => page([]) } })
    await empty.press(empty.button('Conversations'))
    assert.deepEqual(await axeViolations(empty.panel()!), [])
    await disposeAll()

    const bad = await setup({ overrides: { conversations: async () => { throw new ApiError('x', 500) } } })
    await bad.press(bad.button('Conversations'))
    assert.ok(bad.k.one('[role="alert"]'))
    assert.deepEqual(await axeViolations(bad.panel()!), [])
  })

  it('finds nothing wrong while thinking, with a failure notice, at the daily limit, or with a long question', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    const thinking = await setup({ overrides: { ask: () => pending.promise } })
    await thinking.ask('Slow')
    assert.ok(thinking.k.bodyText().includes('Thinking…'))
    assert.deepEqual(await axeViolations(thinking.panel()!), [])
    pending.resolve(answer())
    await disposeAll()

    const failed = await setup({ overrides: { ask: async () => { throw new TypeError('x') } } })
    await failed.ask('Q')
    assert.ok(failed.k.one('[role="alert"]'))
    assert.deepEqual(await axeViolations(failed.panel()!), [])
    await disposeAll()

    const limit = await setup({ overrides: { ask: async () => { throw new AskApiError('x', 429, undefined, undefined, 'daily_limit', 30) } } })
    await limit.ask('Q')
    assert.ok(limit.k.bodyText().includes("You have used today's 30 questions."))
    assert.deepEqual(await axeViolations(limit.panel()!), [])
    await disposeAll()

    const long = await setup()
    await long.type('a'.repeat(1200))
    assert.deepEqual(await axeViolations(long.panel()!), [])
  })

  it('finds nothing wrong on a record\'s page, with "Ask about this record" off and on', async () => {
    const chat = await setup({ pathname: '/module/crm/marketing/leads/201' })
    assert.deepEqual(await axeViolations(chat.panel()!), [])
    await chat.press(chat.button('Ask about this record'))
    assert.deepEqual(await axeViolations(chat.panel()!), [])
  })

  it('finds nothing wrong with the old engine\'s panel', async () => {
    const chat = await setup({ engine: 'legacy' })
    await chat.ask('Hello')
    assert.deepEqual(await axeViolations(chat.panel()!), [])
  })
})
