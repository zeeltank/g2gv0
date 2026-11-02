import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './dom-test-kit'

async function setup(initial = '') {
  const k = await kit()
  const { ListSearch } = await import('../../components/shared/scaffolds/list-search')
  const sent: string[] = []
  const element = (value: string) => k.h(ListSearch, { value, onSearch: (q: string) => { sent.push(q) }, delay: 25 })
  await k.render(element(initial))

  const input = () => k.one('input[type="search"]') as HTMLInputElement
  // React tracks an input's value itself, so a typed value has to go in through the native setter, then an input event.
  const type = (text: string) => k.act(async () => {
    Object.getOwnPropertyDescriptor(k.w.HTMLInputElement.prototype, 'value')!.set!.call(input(), text)
    input().dispatchEvent(new k.w.Event('input', { bubbles: true }))
  })

  return { k, sent, input, type, rerender: (value: string) => k.render(element(value)) }
}

describe('ListSearch', () => {
  afterEach(disposeAll)

  it('is a labelled search box', async () => {
    const { input } = await setup()
    assert.equal(input().getAttribute('aria-label'), 'Search')
    assert.equal(input().getAttribute('placeholder'), 'Search…')
  })

  it('sends what was typed once typing pauses, not on every keystroke', async () => {
    const { k, sent, type } = await setup()
    // Keystrokes a few milliseconds apart, well inside the 25 ms pause the test box is given.
    await type('s'); await k.tick(5)
    await type('sc'); await k.tick(5)
    await type('sch'); await k.tick(5)
    assert.deepEqual(sent, [], 'nothing yet: the person is still typing')
    await k.tick(80)
    assert.deepEqual(sent, ['sch'])
  })

  it('sends a later change even before the page has shown the first one back', async () => {
    const { k, sent, type } = await setup()
    await type('abc'); await k.tick(80)
    await type(''); await k.tick(80)   // the parent never re-rendered with "abc": the box must still know it already sent it
    assert.deepEqual(sent, ['abc', ''])
  })

  it('sends the text without the spaces around it', async () => {
    const { k, sent, type } = await setup()
    await type('  scholar  '); await k.tick(80)
    assert.deepEqual(sent, ['scholar'])
  })

  it('sends nothing when the text has not really changed', async () => {
    const { k, sent, type } = await setup('abc')
    await type('abc '); await k.tick(80)
    assert.deepEqual(sent, [])
  })

  it('can send an empty search, to clear it', async () => {
    const { k, sent, type } = await setup('abc')
    await type(''); await k.tick(80)
    assert.deepEqual(sent, [''])
  })

  it('shows a search the URL changed to (Back button, pasted link) without sending it back', async () => {
    const { k, sent, input, rerender } = await setup('')
    await rerender('scholar'); await k.tick(80)
    assert.equal(input().value, 'scholar')
    assert.deepEqual(sent, [])
  })

  it('does not send the same search again when the page re-renders with it', async () => {
    const { k, sent, type, rerender } = await setup()
    await type('abc'); await k.tick(80)
    await rerender('abc'); await k.tick(80)
    assert.deepEqual(sent, ['abc'])
  })
})
