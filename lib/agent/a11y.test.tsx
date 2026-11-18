import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { axeViolations } from './a11y'

/** The accessibility check has to be able to fail, or "no violations" in the agent screens' tests would mean nothing. */
describe('the accessibility check', () => {
  afterEach(disposeAll)

  it('reports a button with no name, an image with no text alternative and a field with no label', async () => {
    const k = await kit()
    await k.render(k.h('section', { 'data-test-root': true }, k.h('button', null), k.h('img', { src: 'x.png' }), k.h('input', { type: 'text' })))
    const found = await axeViolations(k.one('[data-test-root]')!)
    assert.ok(found.some((line) => line.startsWith('button-name:')), found.join('\n'))
    assert.ok(found.some((line) => line.startsWith('image-alt:')), found.join('\n'))
    assert.ok(found.some((line) => line.startsWith('label:')), found.join('\n'))
  })

  it('reports a link with no name and a select with no name', async () => {
    const k = await kit()
    await k.render(k.h('section', { 'data-test-root': true }, k.h('a', { href: '/x' }), k.h('select', null, k.h('option', { value: 'a' }, 'A'))))
    const found = await axeViolations(k.one('[data-test-root]')!)
    assert.ok(found.some((line) => line.startsWith('link-name:')), found.join('\n'))
    assert.ok(found.some((line) => line.startsWith('select-name:')), found.join('\n'))
  })

  it('reports nothing for markup that is fine', async () => {
    const k = await kit()
    await k.render(k.h('section', { 'data-test-root': true }, k.h('label', { htmlFor: 'a' }, 'Name'), k.h('input', { id: 'a', type: 'text' }), k.h('button', null, 'Save')))
    assert.deepEqual(await axeViolations(k.one('[data-test-root]')!), [])
  })
})
