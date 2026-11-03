import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { ApiError } from '../../services/core'
import { AskApiError } from '../../services/agent/ask-errors'
import { absent, same } from '../agent/assertions'
import { deferred } from './fake-service'
import { answer, LEAD, MARKUP, ORG, page } from './fixtures'
import { setup } from './screen-kit'

const askError = (status: number, code: string | null, limit: number | null = null, text = 'x') => new AskApiError(text, status, undefined, undefined, code, limit)

describe('the button and the panel', () => {
  afterEach(disposeAll)

  it('draws nothing for a person who is not signed in', async () => {
    const { k, launcher } = await setup({ session: false })
    same(launcher(), null, 'no button')
    assert.equal(k.all('button').length, 0)
  })

  it('shows the purple button, named, and no panel, until it is pressed', async () => {
    const { launcher, panel } = await setup({ open: false })
    assert.ok(launcher(), 'the button')
    absent(panel(), 'no panel yet')
  })

  it('opens a dialog with a name, the greeting and four questions to start from, and puts the cursor in the box', async () => {
    const { k, panel, box, focused, launcher } = await setup()
    const dialog = panel()
    assert.ok(dialog)
    assert.equal(dialog!.getAttribute('aria-labelledby') !== null, true)
    assert.equal(k.w.document.getElementById(dialog!.getAttribute('aria-labelledby')!)?.textContent, 'CRM AI Assistant')
    assert.ok(k.bodyText().includes('Each answer links to the records it comes from.'))
    assert.deepEqual(k.all('button').filter((b) => b.className.includes('text-left')).length, 4)
    same(focused(), box(), 'the cursor is in the box')
    absent(launcher(), 'the button gives way to the panel')
  })

  it('has named buttons for the conversations, a new chat, closing and sending, and a named box', async () => {
    const { button, box } = await setup()
    for (const label of ['Conversations', 'New chat', 'Close chat', 'Send question']) assert.ok(button(label), label)
    assert.equal(box()!.getAttribute('aria-label'), 'Your question', 'a placeholder is not a name')
  })

  it('calls the transcript a live log named "Conversation", so an answer is announced when it arrives', async () => {
    const { ask, log } = await setup()
    await ask('Q')
    assert.equal(log()?.getAttribute('aria-label'), 'Conversation')
  })
})

describe('asking', () => {
  afterEach(disposeAll)

  it('sends with Enter, shows the question and then the answer with the records it rests on', async () => {
    const { calls, ask, bubbles, k } = await setup({ overrides: { ask: async () => answer({ conversation_id: 8, message: { text: 'Tapovan has one open opportunity.', citations: [ORG, LEAD] } }) } })
    await ask('What is open for Tapovan?')
    assert.deepEqual(calls.ask, [{ message: 'What is open for Tapovan?', conversationId: null, context: null }])
    assert.equal(bubbles('user')[0].textContent, 'You: What is open for Tapovan?')
    const reply = bubbles('assistant')[0]
    assert.ok(reply.textContent!.includes('Tapovan has one open opportunity.'))
    assert.ok(reply.textContent!.includes('Based on:'))
    const links = Array.from(reply.querySelectorAll('a'))
    assert.deepEqual(links.map((a) => [a.textContent, a.getAttribute('href')]), [['Tapovan Vidya Vihar', '/module/crm/marketing/organizations/135'], ['Rahul Sharma (L-0201)', '/module/crm/marketing/leads/201']])
    assert.ok(links.every((a) => a.getAttribute('target') === null), 'a path inside the application opens in the same tab')
    assert.ok(reply.textContent!.includes('Organisation'), 'what kind of record each is')
    assert.equal((k.one('textarea') as HTMLTextAreaElement).value, '', 'the box is empty again')
  })

  it('does not send on Shift+Enter, and puts nothing on the page that sends', async () => {
    const { calls, type, key } = await setup()
    await type('first line')
    const left = await key('Enter', { shiftKey: true })
    assert.equal(left, true, 'the key was left to the box: it breaks the line')
    assert.equal(calls.ask.length, 0)
  })

  it('does not send on the Enter that confirms an input-method composition', async () => {
    const { calls, type, key } = await setup()
    await type('こんにちは')
    await key('Enter', { isComposing: true })
    assert.equal(calls.ask.length, 0)
  })

  it('sends with the Send button, and the button is off for an empty box', async () => {
    const { calls, button, type, press } = await setup()
    assert.equal(button('Send question')!.disabled, true)
    await type('   ')
    assert.equal(button('Send question')!.disabled, true)
    await type('Hello')
    assert.equal(button('Send question')!.disabled, false)
    await press(button('Send question'))
    assert.equal(calls.ask.length, 1)
  })

  it('sends one of the starting questions with a click', async () => {
    const { calls, k, press } = await setup()
    await press(k.withText('How many leads came from signals?'))
    assert.deepEqual(calls.ask.map((c) => c.message), ['How many leads came from signals?'])
  })

  it('says "Thinking" while the answer is on its way, and a second Enter does not send a second question', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    const { k, calls, ask, key, type, button, bubbles } = await setup({ overrides: { ask: () => pending.promise } })
    await ask('Slow question')
    assert.ok(k.one('[role="status"]')!.textContent!.includes('Thinking…'))
    assert.equal(button('Send question')!.disabled, true)
    await type('Impatient')
    assert.equal(button('Send question')!.disabled, true, 'still off while the first question is on its way, although there is text to send')
    await key('Enter')
    await key('Enter')
    assert.equal(calls.ask.length, 1, 'one question in flight')
    pending.resolve(answer())
    await k.tick(10)
    assert.equal(k.bodyText().includes('Thinking…'), false)
    assert.equal(bubbles('assistant').length, 1)
  })

  it('continues the same conversation with the next question', async () => {
    const { calls, ask } = await setup({ overrides: { ask: async () => answer({ conversation_id: 8 }) } })
    await ask('First')
    await ask('And for them?')
    assert.deepEqual(calls.ask.map((c) => c.conversationId), [null, 8])
  })
})

describe('everything is text', () => {
  afterEach(disposeAll)

  it('draws markup in a question, an answer and a citation as the characters it is, and runs nothing', async () => {
    const { k, ask, bubbles } = await setup({ overrides: { ask: async () => answer({ message: { text: MARKUP, citations: [{ type: 'lead', id: '1', label: MARKUP, url: '/module/crm/marketing/leads/1' }] } }) } })
    await ask(MARKUP)
    assert.equal(k.all('img').length, 0, 'no image was made from text')
    assert.equal(k.all('script').length, 0)
    assert.equal(k.all('b').length, 0)
    assert.equal((k.w as unknown as { __owned?: number }).__owned, undefined)
    assert.ok(bubbles('user')[0].textContent!.includes('<img src=x onerror='))
    assert.ok(bubbles('assistant')[0].textContent!.includes('<script>window.__owned=2</script>'))
  })

  it('links only a safe address; any other is a name with no link', async () => {
    const citations = [
      { type: 'lead', id: '1', label: 'Script link', url: 'javascript:alert(1)' },
      { type: 'lead', id: '2', label: 'Data link', url: 'data:text/html,<b>x</b>' },
      { type: 'lead', id: '3', label: 'Same-host trick', url: '//evil.example/x' },
      { type: 'lead', id: '4', label: 'No address', url: null },
      { type: 'signal', id: '5', label: 'Outside link', url: 'https://example.com/report' },
    ]
    const chat = await setup({ overrides: { ask: async () => answer({ message: { citations } }) } })
    await chat.ask('Q')
    const reply = chat.bubbles('assistant')[0]
    const links = Array.from(reply.querySelectorAll('a'))
    assert.deepEqual(links.map((a) => a.textContent!.trim().replace(/\s+/g, ' ')), ['Outside link (opens in a new tab)'])
    assert.equal(links[0].getAttribute('href'), 'https://example.com/report')
    assert.equal(links[0].getAttribute('target'), '_blank')
    assert.equal(links[0].getAttribute('rel'), 'noopener noreferrer')
    for (const label of ['Script link', 'Data link', 'Same-host trick', 'No address']) assert.ok(reply.textContent!.includes(label), `${label} is still named`)
    assert.equal(reply.querySelectorAll('[href^="javascript"], [href^="data"], [href^="//"]').length, 0)
  })
})

describe('answers that are not answers', () => {
  afterEach(disposeAll)

  for (const [status, label, text] of [
    ['no_data', 'Nothing found', 'I have nothing on that.'],
    ['refused', 'I cannot see that', 'I could not tie an answer to your records, so I am not giving one.'],
    ['unavailable', 'Unavailable right now', "I can't answer right now: the AI service is not available for your organisation."],
  ] as const) {
    it(`says "${label}" in words for ${status}, with the server's own explanation under it`, async () => {
      const { ask, bubbles } = await setup({ overrides: { ask: async () => answer({ message: { status, text, citations: [] } }) } })
      await ask('Q')
      const reply = bubbles('assistant')[0]
      assert.ok(reply.textContent!.includes(label))
      assert.ok(reply.textContent!.includes(text))
      assert.equal(reply.querySelector('[data-uncited]'), null, 'a non-answer is not told it lacks citations')
      assert.equal(reply.getAttribute('data-status'), status)
    })
  }

  it('says an answer rests on no record when it claims to answer and cites none', async () => {
    const { ask, bubbles } = await setup({ overrides: { ask: async () => answer({ message: { citations: [] } }) } })
    await ask('Q')
    assert.ok(bubbles('assistant')[0].textContent!.includes('No records are cited for this answer.'))
  })

  it('draws a status word a newer server invents as an ordinary answer', async () => {
    const { ask, bubbles } = await setup({ overrides: { ask: async () => answer({ message: { status: 'brand_new', text: 'Fine.', citations: [ORG] } }) } })
    await ask('Q')
    assert.ok(bubbles('assistant')[0].textContent!.includes('Fine.'))
  })
})

describe('when asking fails', () => {
  afterEach(disposeAll)

  it('says the day\'s questions are used up with the number, switches the box off, and keeps the question', async () => {
    const { k, ask, box, button, calls } = await setup({ overrides: { ask: async () => { throw askError(429, 'daily_limit', 30) } } })
    await ask('One more?')
    assert.ok(k.bodyText().includes("You have used today's 30 questions. Try again tomorrow."))
    assert.equal(box()!.disabled, true)
    assert.equal(box()!.value, 'One more?')
    assert.equal(button('Send question')!.disabled, true)
    assert.equal(calls.ask.length, 1)
  })

  it('says a connection failure in words with an alert, and puts the question back in the box', async () => {
    const { k, ask, box, bubbles } = await setup({ overrides: { ask: async () => { throw new TypeError('Failed to fetch') } } })
    await ask('Will this work?')
    const alert = k.one('[role="alert"]')
    assert.ok(alert && alert.textContent!.includes('did not reach the server'))
    assert.equal(box()!.value, 'Will this work?')
    assert.equal(bubbles('user').length, 0, 'the unsent question left the transcript')
  })

  it('says a server error in a sentence of ours, never the server\'s internals or a status code', async () => {
    const { k, ask } = await setup({ overrides: { ask: async () => { throw new ApiError('SQLSTATE[HY000] 500 Internal Server Error', 500) } } })
    await ask('Q')
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('The assistant could not answer. Nothing was changed.'))
    assert.equal(k.bodyText().includes('SQLSTATE'), false)
    assert.equal(k.bodyText().includes('500'), false)
  })

  it('says there is no access on a 403', async () => {
    const { k, ask } = await setup({ overrides: { ask: async () => { throw new ApiError('Your role does not have access to this screen.', 403) } } })
    await ask('Q')
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('You do not have access to the CRM assistant.'))
  })

  it('says a question that is too long, before sending it, and sends nothing', async () => {
    const { k, type, key, calls, button } = await setup()
    await type('a'.repeat(1001))
    assert.ok(k.bodyText().includes('A question can have at most 1,000 characters.'))
    assert.equal(button('Send question')!.disabled, true)
    assert.equal(k.one('textarea')!.getAttribute('aria-invalid'), 'true')
    await key('Enter')
    assert.equal(calls.ask.length, 0)
  })
})

describe('a late answer', () => {
  afterEach(disposeAll)

  it('is not drawn into the new chat the person started while waiting', async () => {
    const pending = deferred<ReturnType<typeof answer>>()
    const { k, ask, button, press, bubbles } = await setup({ overrides: { ask: () => pending.promise } })
    await ask('Old question')
    await press(button('New chat'))
    assert.equal(k.bodyText().includes('Thinking…'), false, 'the new chat is not waiting')
    assert.ok(k.bodyText().includes('Still answering your earlier question.'), 'and says why it will not send yet')
    pending.resolve(answer({ message: { text: 'LATE ANSWER' } }))
    await k.tick(10)
    assert.equal(k.bodyText().includes('LATE ANSWER'), false)
    assert.equal(bubbles('assistant').length, 0)
    assert.equal(k.bodyText().includes('Still answering'), false, 'and the hint goes when the earlier question is over')
  })
})

describe('closing', () => {
  afterEach(disposeAll)

  it('closes on Escape, from the box, and puts the cursor back on the button that opened it', async () => {
    const { panel, key, launcher, focused } = await setup()
    await key('Escape')
    absent(panel(), 'the panel is gone')
    assert.ok(launcher(), 'the button is back')
    same(focused(), launcher(), 'with the cursor on it')
  })

  it('closes on Escape from anywhere in the panel, the header included', async () => {
    const { panel, key, launcher, button } = await setup()
    await key('Escape', {}, button('New chat'))
    absent(panel(), 'closed')
    assert.ok(launcher())
  })

  it('closes with the Close button and puts the cursor on the opening button', async () => {
    const { panel, button, press, launcher, focused } = await setup()
    await press(button('Close chat'))
    absent(panel(), 'closed')
    same(focused(), launcher(), 'focus')
  })

  it('opens again with the cursor in the box, and keeps the conversation', async () => {
    const { ask, button, press, open, box, focused, bubbles } = await setup()
    await ask('Q')
    await press(button('Close chat'))
    await open()
    same(focused(), box(), 'the cursor is in the box')
    assert.equal(bubbles('assistant').length, 1)
  })

  it('starts an empty chat with New chat and puts the cursor in the box', async () => {
    const { ask, button, press, bubbles, box, focused, k } = await setup()
    await ask('Q')
    await press(button('New chat'))
    assert.equal(bubbles('user').length, 0)
    assert.ok(k.bodyText().includes('Each answer links to the records it comes from.'))
    same(focused(), box(), 'focus')
  })
})

describe('asking about the record on screen', () => {
  afterEach(disposeAll)

  it('offers "Ask about this record" on a lead\'s page, off, and sends no record until it is switched on', async () => {
    const { calls, button, ask, press } = await setup({ pathname: '/module/crm/marketing/leads/201' })
    const chip = button('Ask about this record')!
    assert.ok(chip)
    assert.equal(chip.getAttribute('aria-pressed'), 'false')
    await ask('First')
    assert.equal(calls.ask[0].context, null)
    await press(chip)
    assert.equal(button('Ask about this record')!.getAttribute('aria-pressed'), 'true')
    await ask('Second')
    assert.deepEqual(calls.ask[1].context, { type: 'lead', id: 201 })
    await press(button('Ask about this record'))
    await ask('Third')
    assert.equal(calls.ask[2].context, null, 'switched off again')
  })

  it('says which kind of record the questions are about, and offers questions about it only once it is switched on (a question about "this organisation" with no record sent could not be answered)', async () => {
    const { k, press, button, calls } = await setup({ pathname: '/module/crm/marketing/organizations/135' })
    assert.equal(k.bodyText().includes('about this organisation?'), false, 'off: the ordinary questions')
    await press(button('Ask about this record'))
    assert.ok(k.bodyText().includes('Your questions will be about this organisation.'))
    await press(k.withText('What should I know about this organisation?'))
    assert.deepEqual(calls.ask.map((c) => [c.message, c.context]), [['What should I know about this organisation?', { type: 'organization', id: 135 }]])
  })

  it('knows a contact, an opportunity and an organisation by their pages', async () => {
    for (const [pathname, type, id] of [['/module/crm/support/contacts/45', 'contact', 45], ['/module/crm/sales/opportunities/256', 'opportunity', 256], ['/module/crm/support/organizations/9', 'organization', 9]] as const) {
      const { calls, button, ask, press } = await setup({ pathname })
      await press(button('Ask about this record'))
      await ask('Q')
      assert.deepEqual(calls.ask[0].context, { type, id }, pathname)
      await disposeAll()
    }
  })

  it('offers nothing on a list or any page that is not one record\'s', async () => {
    for (const pathname of ['/module/crm/marketing/leads', '/module/crm/sales/quotes/12', '/module/crm/marketing/leads/new', '/module/crm/reports']) {
      const { button } = await setup({ pathname })
      absent(button('Ask about this record') ?? null, pathname)
      await disposeAll()
    }
  })

  it('offers nothing to the old engine, which takes no record', async () => {
    const { button, k } = await setup({ pathname: '/module/crm/marketing/leads/201', engine: 'legacy' })
    absent(button('Ask about this record') ?? null, 'no chip')
    assert.equal(k.bodyText().includes('What should I know about this lead?'), false)
  })
})

describe('the old endpoint', () => {
  afterEach(disposeAll)

  it('answers by itself, with nothing said, when the server has no chat yet', async () => {
    const { k, ask, bubbles, legacyCalls, calls } = await setup({ overrides: { ask: async () => { throw new ApiError('The route api/agent/ask could not be found.', 404) }, conversations: async () => { throw new ApiError('Not Found', 404) } } })
    await ask('Hello')
    assert.equal(calls.ask.length, 0, 'the probe found out first: the new route was never asked')
    assert.deepEqual(legacyCalls.map((c) => c.question), ['Hello'])
    assert.ok(bubbles('assistant')[0].textContent!.includes('An old-style reply.'))
    assert.equal(k.one('[role="alert"]'), null, 'nothing alarming')
    assert.equal(k.bodyText().includes('404'), false)
    assert.equal(k.bodyText().includes('No records are cited'), false, 'the old engine is never told it lacks citations')
  })

  it('also falls back when only the question is what meets the 404', async () => {
    const { k, ask, legacyCalls, button } = await setup({ overrides: { ask: async () => { throw new ApiError('Not Found', 404) } } })
    await ask('Hello')
    assert.equal(legacyCalls.length, 1)
    assert.equal(k.one('[role="alert"]'), null)
    absent(button('Conversations') ?? null, 'and there is no list of conversations on the old engine')
  })

  it('is asked exactly as it always was: the question and the history, and never the record, even on a record\'s page', async () => {
    const sent: Array<{ url: string; body: Record<string, unknown> }> = []
    const original = globalThis.fetch
    globalThis.fetch = (async (url: unknown, init?: { body?: string }) => {
      sent.push({ url: String(url), body: JSON.parse(init?.body ?? '{}') })
      return new Response(JSON.stringify({ status: 1, data: { reply: 'From the old endpoint.', sources: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    try {
      const { ask, bubbles } = await setup({ engine: 'legacy', realLegacy: true, pathname: '/module/crm/marketing/leads/201' })
      await ask('Hello old friend')
      await ask('And again')
      assert.equal(sent.length, 2)
      assert.match(sent[0].url, /\/crm\/ai-chat$/)
      assert.equal(sent[0].body.message, 'Hello old friend')
      assert.deepEqual(sent[0].body.conversation_history, [])
      assert.equal(sent[1].body.conversation_history instanceof Array && (sent[1].body.conversation_history as unknown[]).length, 2, 'the question and the reply before it')
      for (const call of sent) {
        assert.equal('context_type' in call.body, false, 'no record type')
        assert.equal('context_id' in call.body, false, 'no record id')
      }
      assert.ok(bubbles('assistant')[0].textContent!.includes('From the old endpoint.'))
    } finally {
      globalThis.fetch = original
    }
  })

  it('is the only endpoint asked when the constant says legacy, and shows its own suggestions', async () => {
    const { k, ask, calls, legacyCalls, button } = await setup({ engine: 'legacy' })
    assert.ok(k.bodyText().includes('Draft a follow-up for my top lead'))
    absent(button('Conversations') ?? null, 'no list')
    await ask('Hello')
    assert.deepEqual([calls.ask.length, calls.conversations.length, legacyCalls.length], [0, 0, 1])
  })

  it('says the old endpoint\'s own explanation when it fails', async () => {
    const { k, ask } = await setup({ engine: 'legacy', legacy: async () => { throw new ApiError('Model busy', 503, undefined, 'Try again in a minute.') } })
    await ask('Hello')
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('Try again in a minute.'))
  })
})

describe('the list is read when the panel opens', () => {
  afterEach(disposeAll)

  it('asks for the first page once, quietly', async () => {
    const { calls, k } = await setup({ overrides: { conversations: async () => page([]) } })
    assert.equal(calls.conversations.length, 1)
    assert.equal(k.one('[role="alert"]'), null)
  })
})
