import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit } from './screen-kit'

/**
 * Every request the Product Portfolio list adds, read at the level of `fetch`: the real address, the method, the parameters or body, and the bearer header
 * (the organisation and the person come from the token, never from a parameter). The service is the real one; only the network is faked.
 */

async function world() {
  const sk = await screenKit({ respond: () => ({ status: 1, message: 'ok', data: [], meta: {} }) })
  const { portfolioListService } = await import('../../services/product-master/portfolio-list-service')
  return { ...sk, service: portfolioListService }
}

describe('the requests of the Product Portfolio list', () => {
  let current: Awaited<ReturnType<typeof world>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })
  const last = () => current!.calls.at(-1)!

  it('GET /product-master/list sends exactly the fields it is given, and nothing for a field it is not', async () => {
    current = await world()
    await current.service.list({ q: 'fees', productId: 7, type: 'service', sold: 'no', readiness: 'Prototype', status: 'all', sort: 'price', dir: 'desc', page: 3, per: 50 })
    assert.equal(last().method, 'GET')
    assert.ok(last().path.endsWith('/product-master/list'), last().path)
    assert.deepEqual(Object.fromEntries(last().query), { q: 'fees', productId: '7', type: 'service', sold: 'no', readiness: 'Prototype', status: 'all', sort: 'price', dir: 'desc', page: '3', per: '50' })
    assert.equal(last().headers.Authorization, 'Bearer test-token')
    await current.service.list({})
    assert.deepEqual(Object.fromEntries(last().query), {}, 'a field that is absent is not sent: the server applies no filter for it')
  })

  it('GET /product-master/lines and /meta read the choices of the filters', async () => {
    current = await world()
    await current.service.lines()
    assert.ok(last().path.endsWith('/product-master/lines') && last().method === 'GET', last().path)
    assert.equal(last().headers.Authorization, 'Bearer test-token')
    await current.service.meta()
    assert.ok(last().path.endsWith('/product-master/meta') && last().method === 'GET', last().path)
    assert.equal(last().headers.Authorization, 'Bearer test-token')
  })

  it('GET /product-master/matches reads the suggestions with the bearer header and no organisation parameter', async () => {
    current = await world()
    await current.service.matches()
    assert.equal(last().method, 'GET')
    assert.ok(last().path.endsWith('/product-master/matches'), last().path)
    assert.equal(last().headers.Authorization, 'Bearer test-token')
    assert.deepEqual(Object.fromEntries(last().query), {}, 'the organisation is the token\'s, never a parameter')
  })

  it('POST /product-master/matches/decide sends the pair, the answer and the name to keep, and nothing about the organisation', async () => {
    current = await world()
    await current.service.decide({ itemMasterId: 31, survivorMasterId: 10, decision: 'same', nameKept: 'catalogue' })
    assert.equal(last().method, 'POST')
    assert.ok(last().path.endsWith('/product-master/matches/decide'), last().path)
    assert.deepEqual(last().body, { itemMasterId: 31, survivorMasterId: 10, decision: 'same', nameKept: 'catalogue' })
    assert.equal(last().headers.Authorization, 'Bearer test-token')
    await current.service.decide({ itemMasterId: 31, survivorMasterId: 10, decision: 'different' })
    assert.deepEqual(last().body, { itemMasterId: 31, survivorMasterId: 10, decision: 'different' })
  })

  it('GET /product-master/by-crm/{id} and /{id} serve the redirects, and encode the id as one path segment', async () => {
    current = await world()
    await current.service.byCrm(63)
    assert.equal(last().method, 'GET')
    assert.ok(last().path.endsWith('/product-master/by-crm/63'), last().path)
    assert.equal(last().headers.Authorization, 'Bearer test-token')
    await current.service.byCrm('5/../../x')
    assert.ok(last().path.endsWith('/product-master/by-crm/5%2F..%2F..%2Fx'), last().path)
    await current.service.head(9)
    assert.ok(last().path.endsWith('/product-master/9') && last().method === 'GET', last().path)
    assert.equal(last().headers.Authorization, 'Bearer test-token')
  })

  it('GET /product-master/{id}/sell gives the catalogue id, or nothing when the answer has none', async () => {
    current = await world()
    const answers: unknown[] = [{ status: 1, data: { crmProductId: 1011 } }, { status: 1, data: null }, { status: 1, data: { crmProductId: 0 } }, { status: 1, data: { crmProductId: 'x' } }]
    const sk = current
    // Each call answers the next canned body.
    let i = 0
    const original = globalThis.fetch
    globalThis.fetch = (async (input: unknown, init?: unknown) => {
      void input; void init
      return new Response(JSON.stringify(answers[i++]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    try {
      assert.equal(await sk.service.crmIdOf(11), 1011)
      assert.equal(await sk.service.crmIdOf(11), null, 'a record with no Sell section')
      assert.equal(await sk.service.crmIdOf(11), null, 'a zero is no id')
      assert.equal(await sk.service.crmIdOf(11), null, 'a word is no id')
    } finally {
      globalThis.fetch = original
    }
  })

  it('GET /product-master/{id}/sell asks the right address with the bearer header', async () => {
    current = await world()
    await current.service.crmIdOf(11)
    assert.ok(last().path.endsWith('/product-master/11/sell') && last().method === 'GET', last().path)
    assert.equal(last().headers.Authorization, 'Bearer test-token')
  })
})
