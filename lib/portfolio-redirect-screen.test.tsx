import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from './scaffolds/dom-test-kit'
import { axeViolations } from './agent/a11y'
import { screenKit, type Call, type Responder } from './portfolio-list/screen-kit'
import type { RedirectLookup } from '../components/domain/portfolio/portfolio-redirect'
import type { RawSearchParams } from './portfolio-redirect'

/** The record redirects in a fake browser: the real component and service client, the address kept by a stand-in router, only the network faked. */

async function open(lookup: RedirectLookup, params: RawSearchParams, respond: Responder) {
  const sk = await screenKit({ pathname: '/module/crm/sales/products/63', respond })
  const { PortfolioRedirect } = await import('../components/domain/portfolio/portfolio-redirect')
  await sk.mount(sk.k.h(PortfolioRedirect, { lookup, params }), 60)
  return { ...sk, text: () => sk.k.bodyText() }
}

const found = (id: number, kind = 'sub_product') => ({ status: 1, data: { id, kind } })

describe('a catalogue id (the old /products/{id} and /services/{id})', () => {
  let current: Awaited<ReturnType<typeof open>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('looks the id up through by-crm with the bearer header, and replaces the address with the Sub-product page, keeping the query', async () => {
    current = await open({ kind: 'catalogue', id: '63' }, { tab: 'history', q: 'a b' }, () => found(11))
    const [call] = current.to('/product-master/by-crm/63')
    assert.equal(call.method, 'GET')
    assert.equal(call.headers.Authorization, 'Bearer test-token')
    assert.deepEqual(current.router.written, ['/portfolio/products/11?tab=history&q=a%20b'])
  })

  it('goes to the Sub-product page of a record in the Recycle Bin too (by-crm finds it; the page says where it is)', async () => {
    current = await open({ kind: 'catalogue', id: '8' }, {}, () => found(31, 'item'))
    assert.deepEqual(current.router.written, ['/portfolio/products/31'])
  })

  it('says "could not be found" for an id that is not this organisation\'s or no longer exists (404), and offers the Portfolio', async () => {
    current = await open({ kind: 'catalogue', id: '999' }, {}, () => ({ __status: 404, status: 0, message: 'Not found.' }))
    const { text, k, router } = current
    assert.ok(text().includes('This product could not be found'))
    assert.deepEqual(router.written, [], 'it does not redirect anywhere')
    assert.equal(k.all('a').find((a) => a.textContent === 'Go to the Product Portfolio')?.getAttribute('href'), '/portfolio')
  })

  it('says the same for a refusal (403) and never shows the server\'s words', async () => {
    current = await open({ kind: 'catalogue', id: '5' }, {}, () => ({ __status: 403, status: 0, message: 'Secret internal reason.' }))
    assert.ok(current.text().includes('This product could not be found'))
    assert.ok(!current.text().includes('Secret internal reason.'))
  })

  it('does not even ask the server about an id that is not a number', async () => {
    for (const bad of ['abc', '0', '5/../../x', '1e3', '']) {
      current = await open({ kind: 'catalogue', id: bad }, {}, () => found(1))
      assert.equal(current.calls.length, 0, `no request for ${JSON.stringify(bad)}`)
      assert.ok(current.text().includes('This product could not be found'))
      current.restore()
      await disposeAll()
    }
    current = null
  })

  it('shows an error with a Retry for anything else (a server fault), and works on the second try', async () => {
    let failing = true
    current = await open({ kind: 'catalogue', id: '63' }, { tab: 'usage' }, () => (failing ? { __status: 500, status: 0, message: 'The database is down.' } : found(11)))
    const { text, k, router, to } = current
    assert.ok(text().includes('This product could not be opened') && text().includes('The database is down.'))
    failing = false
    await k.click(k.all('button').find((b) => b.textContent?.trim() === 'Retry')!)
    await k.tick(60)
    assert.equal(to('/by-crm/63').length, 2)
    assert.deepEqual(router.written, ['/portfolio/products/11?tab=usage'])
  })

  it('redirects once, however often it is drawn again', async () => {
    current = await open({ kind: 'catalogue', id: '63' }, {}, () => found(11))
    assert.equal(current.to('/by-crm/63').length, 1)
    assert.equal(current.router.written.length, 1)
  })

  it('says it is opening while it waits, and has no accessibility violations the markup can show', async () => {
    current = await open({ kind: 'catalogue', id: '63' }, {}, () => new Promise(() => undefined))
    assert.ok(current.text().includes('Opening the Product Portfolio…'))
    assert.deepEqual(await axeViolations(current.k.one('body')!), [])
    await disposeAll()
    current.restore()
    current = await open({ kind: 'catalogue', id: '999' }, {}, () => ({ __status: 404, status: 0, message: 'x' }))
    assert.deepEqual(await axeViolations(current.k.one('body')!), [])
  })
})

describe('a Product line id (the old /products/lines/{id})', () => {
  let current: Awaited<ReturnType<typeof open>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })
  const head = (id: number, kind: string, key: string) => ({ status: 1, data: { id, kind, key, name: 'x' } })

  it('goes to the Product page for a Product, by its key, keeping the query', async () => {
    current = await open({ kind: 'line', id: '1' }, { tab: 'offers' }, (call: Call) => (call.path.endsWith('/product-master/1') ? head(1, 'product', 'scholarclone') : undefined))
    assert.equal(current.to('/product-master/1')[0].headers.Authorization, 'Bearer test-token')
    assert.deepEqual(current.router.written, ['/portfolio/scholarclone?tab=offers'])
  })

  it('goes to the Sub-product page for a Sub-product, and for a catalogue-only record', async () => {
    current = await open({ kind: 'line', id: '10' }, { tab: 'signals' }, () => head(10, 'sub_product', 'scholarclone/sch-01'))
    assert.deepEqual(current.router.written, ['/portfolio/products/10?tab=signals'])
    current.restore()
    await disposeAll()
    current = await open({ kind: 'line', id: '14' }, {}, () => head(14, 'item', 'crm/prd-w1'))
    assert.deepEqual(current.router.written, ['/portfolio/products/14'])
  })

  it('says "could not be found" for an unknown or another organisation\'s id', async () => {
    current = await open({ kind: 'line', id: '404' }, {}, () => ({ __status: 404, status: 0, message: 'Not found.' }))
    assert.ok(current.text().includes('This product could not be found'))
    assert.deepEqual(current.router.written, [])
  })
})
