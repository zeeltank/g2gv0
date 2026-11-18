import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { answer, ORG, page, row } from './fixtures'
import { setup } from './screen-kit'

/**
 * The chat at a phone width (390 px).
 *
 * jsdom has no layout, so these read the source and the classes of what is drawn, for the two causes that widened real screens of this app at 390 px:
 *  1. a long unbroken word (a name, an address, a pasted line) in a flex child with no `min-w-0` / `break-words` pushes the panel past the screen;
 *  2. `sr-only` text is `position: absolute`; inside a scroll box that is not `relative` its containing block is the page, the box does not clip it, and its
 *     static position widens the page (Agent Run History, 4 Nov 2026: scrollWidth 877 on a 390 px screen: lib/agent/mobile-width.test.ts).
 * The caller opens the panel in a real browser at 390 px; this keeps the two known causes from coming back.
 */

describe('the CRM chat at a phone width', () => {
  const read = (name: string) => readFileSync(path.resolve('components/domain/crm', name), 'utf8')
  const files = ['crm-chat-widget.tsx', 'ask-panel.tsx', 'ask-messages.tsx', 'ask-conversations.tsx']

  it('keeps the panel inside the screen, both ways', () => {
    const panel = read('ask-panel.tsx')
    assert.match(panel, /max-w-\[calc\(100vw-3rem\)\]/, 'never wider than the screen less its margins')
    assert.match(panel, /max-h-\[calc\(100dvh-3rem\)\]/, 'never taller than it')
    assert.match(panel, /\bw-80\b/)
  })

  it('keeps every box that scrolls positioned (relative), because the transcript holds sr-only text', () => {
    let boxes = 0
    for (const name of files) {
      for (const line of read(name).split(/\r?\n/)) {
        if (!/overflow-[xy]-auto/.test(line) || /<textarea/.test(line)) continue
        boxes += 1
        assert.match(line, /\brelative\b/, `${name}: a scroll box without relative lets sr-only text widen the page: ${line.trim()}`)
      }
    }
    assert.ok(boxes >= 3, 'the transcript, the greeting and the list are scroll boxes, and were found')
    assert.ok(read('ask-messages.tsx').includes('sr-only'), 'the sr-only text this test is about is still there')
  })

  it('draws no table, which would need its own scroll box', () => {
    for (const name of files) assert.equal(/<table\b/.test(read(name)), false, name)
  })

  it('lets what a person, a model or a record wrote wrap: the bubbles, the citations, the list and the notices', () => {
    const messages = read('ask-messages.tsx')
    assert.equal((messages.match(/break-words/g) ?? []).length >= 5, true, 'the question, the answer, a citation, a suggestion and the greeting wrap')
    assert.match(messages, /min-w-0 max-w-\[85%\]/)
    assert.match(read('ask-conversations.tsx'), /break-words/)
    assert.match(read('ask-panel.tsx'), /NOTICE_BASE, NOTICE_LOOK, 'break-words'/)
  })
})

describe('what is drawn for a very long unbroken word', () => {
  afterEach(disposeAll)
  const LONG = 'W'.repeat(500)

  const wraps = (element: Element | null): boolean => {
    for (let node: Element | null = element; node && node.getAttribute('role') !== 'dialog'; node = node.parentElement) if (/\bbreak-words\b/.test(node.className)) return true
    return false
  }

  it('wraps a long question, a long answer, a long citation label and a long conversation title', async () => {
    const chat = await setup({
      overrides: {
        ask: async () => answer({ message: { text: LONG, citations: [{ ...ORG, label: LONG }] } }),
        conversations: async () => page([row({ title: LONG })]),
      },
    })
    await chat.ask(LONG)
    const question = chat.bubbles('user')[0]
    assert.ok(wraps(question.firstElementChild), 'the question wraps')
    const reply = chat.bubbles('assistant')[0]
    const paragraph = Array.from(reply.querySelectorAll('p')).find((p) => p.textContent === LONG)
    assert.ok(paragraph && wraps(paragraph), 'the answer wraps')
    const item = reply.querySelector('li')
    assert.ok(item && wraps(item), 'the citation wraps')
    for (const bubble of [question, reply]) assert.match(bubble.firstElementChild!.className, /\bmin-w-0\b/, 'and the bubble may shrink')
    await chat.press(chat.button('Conversations'))
    assert.ok(wraps(chat.k.all('li button span')[0]), 'the title wraps')
  })
})
