import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { Field, NativeSelect } from '../../components/shared/scaffolds/form-field'
import { FormErrorSummary, FormSection } from '../../components/shared/scaffolds/form-layout'

const doc = (markup: string) => new JSDOM(`<!doctype html><body>${markup}</body>`).window.document
const field = (props: Record<string, unknown> = {}) => doc(renderToStaticMarkup(
  h(Field, { label: 'Name', ...props } as never, (control: Record<string, unknown>) => h('input', { ...control, type: 'text' })),
))

describe('Field', () => {
  it('ties the label to the control by id and marks neither valid nor invalid when there is no error', () => {
    const d = field()
    const input = d.querySelector('input')!
    assert.ok(input.id)
    assert.equal(d.querySelector('label')!.getAttribute('for'), input.id)
    assert.equal(input.hasAttribute('aria-invalid'), false)
    assert.equal(input.hasAttribute('aria-describedby'), false)
    assert.equal(input.hasAttribute('aria-required'), false)
  })

  it('points the control at its hint', () => {
    const d = field({ hint: 'Shown on quotes.' })
    const input = d.querySelector('input')!
    const hint = d.getElementById(input.getAttribute('aria-describedby')!)
    assert.equal(hint?.textContent, 'Shown on quotes.')
  })

  it('marks the control invalid and points it at the error', () => {
    const d = field({ error: 'This ID is too long for this product.' })
    const input = d.querySelector('input')!
    assert.equal(input.getAttribute('aria-invalid'), 'true')
    assert.equal(d.getElementById(input.getAttribute('aria-describedby')!)?.textContent, 'This ID is too long for this product.')
  })

  it('shows several messages together, ignores blank ones, and lists the hint before the error', () => {
    const d = field({ hint: 'A hint.', error: ['First problem.', '', 'Second problem.'] })
    const input = d.querySelector('input')!
    const ids = input.getAttribute('aria-describedby')!.split(' ')
    assert.equal(ids.length, 2)
    assert.equal(d.getElementById(ids[0])?.textContent, 'A hint.')
    assert.equal(d.getElementById(ids[1])?.textContent, 'First problem. Second problem.')
  })

  it('treats an empty list of errors as no error', () => {
    const input = field({ error: [] }).querySelector('input')!
    assert.equal(input.hasAttribute('aria-invalid'), false)
  })

  it('marks a required field for a screen reader and hides the star from it', () => {
    const d = field({ required: true })
    assert.equal(d.querySelector('input')!.getAttribute('aria-required'), 'true')
    assert.equal(d.querySelector('label span')!.getAttribute('aria-hidden'), 'true')
  })

  it('spans both columns of a section when it is wide', () => {
    assert.ok(field({ wide: true }).querySelector('div')!.className.includes('sm:col-span-2'))
    assert.ok(!field().querySelector('div')!.className.includes('sm:col-span-2'))
  })

  it('gives two fields on one page different ids', () => {
    const d = doc(renderToStaticMarkup(h('div', null,
      h(Field, { label: 'A' }, (c: Record<string, unknown>) => h('input', c)),
      h(Field, { label: 'B' }, (c: Record<string, unknown>) => h('input', c)),
    )))
    const [a, b] = Array.from(d.querySelectorAll('input')).map((i) => i.id)
    assert.ok(a && b && a !== b)
  })
})

describe('NativeSelect', () => {
  it('is a native select that carries the field wiring and its options', () => {
    const d = doc(renderToStaticMarkup(
      h(Field, { label: 'Status', error: 'Choose one of the listed readiness states.' } as never,
        (c: Record<string, unknown>) => h(NativeSelect, { ...c, value: 'a', onChange: () => {} }, h('option', { value: 'a' }, 'A'), h('option', { value: 'b' }, 'B'))),
    ))
    const select = d.querySelector('select')!
    assert.equal(select.getAttribute('aria-invalid'), 'true')
    assert.equal(select.querySelectorAll('option').length, 2)
  })
})

describe('FormSection and FormErrorSummary', () => {
  it('titles a section and says where it saves', () => {
    const d = doc(renderToStaticMarkup(h(FormSection, { title: 'About', saves: 'saves to the Portfolio' }, h('p', null, 'body'))))
    assert.equal(d.querySelector('h3')!.textContent, 'About')
    assert.ok(d.body.textContent!.includes('saves to the Portfolio'))
  })

  it('draws nothing when there are no messages, and an alert listing them when there are', () => {
    assert.equal(renderToStaticMarkup(h(FormErrorSummary, { messages: [] })), '')
    const d = doc(renderToStaticMarkup(h(FormErrorSummary, { messages: ['Only an administrator can create a product.', 'Another one.'] })))
    const alert = d.querySelector('[role="alert"]')!
    assert.ok(alert.textContent!.includes('This could not be saved'))
    assert.deepEqual(Array.from(alert.querySelectorAll('li')).map((li) => li.textContent), ['Only an administrator can create a product.', 'Another one.'])
  })
})
