import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { DetailPage } from '../../components/shared/scaffolds/detail-page'
import { ListPage } from '../../components/shared/scaffolds/list-page'

const doc = (node: ReactNode) => new JSDOM(`<!doctype html><body>${renderToStaticMarkup(node as never)}</body>`).window.document
const text = (d: Document) => d.body.textContent ?? ''

const list = (props: Record<string, unknown>) => doc(h(ListPage, { title: 'Product Master', status: 'ready', ...props } as never, h('p', { id: 'list' }, 'THE LIST')))
const detail = (props: Record<string, unknown>) => doc(h(DetailPage, { title: 'Scholar Core', backLabel: 'Back to Product Master', onBack: () => {}, status: 'ready', ...props } as never, h('p', { id: 'panels' }, 'THE PANELS')))

describe('ListPage', () => {
  it('shows the title, the description, the actions, the toolbar, the notice and the footer around a ready list', () => {
    const d = list({
      description: 'What you sell, in one place.', actions: h('button', null, 'New…'), toolbar: h('input', { id: 'search' }),
      notice: h('p', { id: 'notice' }, 'Archived.'), footer: h('p', { id: 'footer' }, '22 sub-products'),
    })
    assert.equal(d.querySelector('h1')!.textContent, 'Product Master')
    assert.ok(text(d).includes('What you sell, in one place.'))
    for (const id of ['list', 'search', 'notice', 'footer']) assert.ok(d.getElementById(id), id)
    assert.ok(text(d).includes('New…'))
  })

  it('shows a loading state and not the list while loading', () => {
    const d = list({ status: 'loading' })
    assert.ok(d.querySelector('[role="status"]')!.textContent!.includes('Loading'))
    assert.equal(d.getElementById('list'), null)
  })

  it('shows the error and a Retry button, and not the list, when it could not be loaded', () => {
    const d = list({ status: 'error', error: 'Your ERP session is unavailable.', onRetry: () => {} })
    assert.ok(text(d).includes('This could not be loaded'))
    assert.ok(text(d).includes('Your ERP session is unavailable.'))
    assert.ok(Array.from(d.querySelectorAll('button')).some((b) => b.textContent === 'Retry'))
    assert.equal(d.getElementById('list'), null)
  })

  it('shows no Retry button when there is nothing to retry with', () => {
    const d = list({ status: 'error', error: 'x' })
    assert.ok(!Array.from(d.querySelectorAll('button')).some((b) => b.textContent === 'Retry'))
  })

  it('shows the empty state with its own words and action, and not the list', () => {
    const d = list({ status: 'empty', empty: { title: 'No products yet', description: 'Add your first product.', action: h('button', null, 'New…') } })
    assert.ok(text(d).includes('No products yet'))
    assert.ok(text(d).includes('Add your first product.'))
    assert.ok(Array.from(d.querySelectorAll('button')).some((b) => b.textContent === 'New…'), 'the empty state offers its action')
    assert.equal(d.getElementById('list'), null)
    assert.ok(text(list({ status: 'empty' })).includes('Nothing here yet'), 'a default when none is given')
  })

  it('shows only the state it is in', () => {
    const ready = list({})
    assert.equal(ready.querySelector('[role="status"]'), null)
    assert.ok(!text(ready).includes('could not be loaded'))
    assert.ok(!text(ready).includes('Nothing here yet'))
  })
})

describe('DetailPage', () => {
  it('shows the back button, title, badge, subtitle, actions, notice, tabs and panels once loaded', () => {
    const d = detail({
      badge: h('span', { id: 'badge' }, 'product'), subtitle: 'ScholarClone · P2', actions: h('button', null, 'Edit'),
      notice: h('p', { id: 'notice' }, 'Saved.'), tabs: h('div', { id: 'tabs' }, 'TABS'),
    })
    assert.equal(d.querySelector('h1')!.textContent, 'Scholar Core')
    const back = d.querySelector('button[aria-label="Back to Product Master"]')
    assert.ok(back, 'a back button a screen reader can name')
    for (const id of ['badge', 'notice', 'tabs', 'panels']) assert.ok(d.getElementById(id), id)
    assert.ok(text(d).includes('ScholarClone · P2'))
    assert.ok(text(d).includes('Edit'))
  })

  it('shows an opening state, with no record, while loading', () => {
    const d = detail({ status: 'loading' })
    assert.ok(d.querySelector('[role="status"]')!.textContent!.includes('Opening'))
    assert.equal(d.getElementById('panels'), null)
    assert.equal(d.querySelector('h1'), null)
  })

  it('shows the error with Retry and a way back', () => {
    const d = detail({ status: 'error', error: 'The server did not answer.', onRetry: () => {} })
    assert.ok(text(d).includes('This could not be opened'))
    assert.ok(text(d).includes('The server did not answer.'))
    const labels = Array.from(d.querySelectorAll('button')).map((b) => b.textContent)
    assert.ok(labels.includes('Retry'))
    assert.ok(labels.includes('Back to Product Master'))
    assert.equal(d.getElementById('panels'), null)
  })

  it('says a record was not found, or is not theirs to see, with a way back', () => {
    const d = detail({ status: 'notFound' })
    assert.ok(text(d).includes('or you do not have access to it'))
    assert.ok(Array.from(d.querySelectorAll('button')).some((b) => b.textContent === 'Back to Product Master'))
    assert.ok(text(detail({ status: 'notFound', notFoundText: 'No such product.' })).includes('No such product.'))
    assert.equal(d.getElementById('panels'), null)
  })
})
