import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { portfolioService } from '../../services/portfolio/portfolio-service'
import { productMasterService } from '../../services/product-master/product-master-service'
import { signalReviewService } from '../../services/signal-review/signal-review-service'
import { signalRunsService } from '../../services/signal-review/runs-service'

/**
 * The consumers of a product list that are NOT pickers (slice 15, completeness audit 3, finding G-E7): the Signals "Main product" selector, the two services
 * that name a signal's or a run's product from `GET /product-master/options`, and the asset import column `product id`. They stay as they are, correct. This
 * file pins each of them at the network level (address, parameters, bearer header), so a later change to what `/options` or `/portfolio/products` answers, or
 * to who may call them, fails a NAMED test here instead of silently emptying a name on a screen. P2-E1 re-gated `/options`: it is open to any signed-in
 * person, names only, and these two callers rely on exactly that (a person without Product access still sees the runs, with a key where a name would be).
 */
interface Call { url: URL; init?: RequestInit }
const restore: Array<() => void> = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

function signIn(token: string) {
  const g = globalThis as { window?: unknown }
  const original = g.window
  g.window = { localStorage: { getItem: () => JSON.stringify({ token }) }, sessionStorage: { getItem: () => null } }
  restore.push(() => { if (original === undefined) delete g.window; else g.window = original })
}

function fakeFetch(answer: (call: Call) => unknown) {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const call = { url: new URL(String(input), 'http://localhost'), init }
    calls.push(call)
    return new Response(JSON.stringify(answer(call)), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
  return calls
}
const bearer = (call: Call) => (call.init?.headers as Record<string, string>).Authorization
const OPTIONS = { status: 1, data: [{ id: 4, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentId: null, label: 'ScholarClone' }, { id: 9, key: 'scholarclone-erp', name: 'School ERP', kind: 'sub_product', parentId: 4, label: 'ScholarClone › School ERP' }] }

describe('the Signals "Main product" selector (components/domain/signals/product-selector.tsx)', () => {
  beforeEach(() => signIn('tok-7'))

  it('reads GET /portfolio/products with the organisation in the address and the token as a bearer header', async () => {
    const calls = fakeFetch(() => ({ status: 1, data: { products: [], company_profile: null } }))
    await portfolioService.getProducts({ token: 'tok-7', subInstituteId: '6', syear: '2026', userId: '2', organizationId: '6', orgType: 'g2g', profileId: '16' } as never)
    assert.equal(calls.length, 1)
    assert.match(calls[0].url.pathname, /\/portfolio\/products$/, 'the address')
    assert.equal(calls[0].url.searchParams.get('sub_institute_id'), '6', 'the organisation the list is for')
    assert.equal(calls[0].url.searchParams.get('type'), 'API')
    assert.equal(bearer(calls[0]), 'Bearer tok-7')
  })

  it('still calls portfolioService.getProducts (a scan of the file, so a move to another endpoint fails here)', () => {
    const source = readFileSync('components/domain/signals/product-selector.tsx', 'utf8')
    assert.ok(source.includes('portfolioService.getProducts(context)'), 'the selector still reads the configured products')
  })
})

describe('the two services that name a product from GET /product-master/options', () => {
  beforeEach(() => signIn('tok-7'))

  it('productMasterService.options asks /product-master/options with no parameters and the bearer header', async () => {
    const calls = fakeFetch(() => OPTIONS)
    const answer = await productMasterService.options()
    assert.equal(calls.length, 1)
    assert.match(calls[0].url.pathname, /\/product-master\/options$/)
    assert.equal(calls[0].url.search, '', 'no parameter: the organisation comes from the token')
    assert.equal(bearer(calls[0]), 'Bearer tok-7')
    assert.equal(answer.data[0].name, 'ScholarClone', 'and the answer keeps the shape the callers read (id, key, name, kind, label)')
  })

  it('the research run history (runs-service.ts:107) reads the runs AND the options, and names a run\'s product from them', async () => {
    const calls = fakeFetch((call) => (call.url.pathname.endsWith('/signals/research/runs')
      ? { status: 1, data: [{ id: 3, status: 'completed', product_master_id: 4, product: 'scholarclone' }] }
      : OPTIONS))
    const runs = await signalRunsService.list()
    assert.deepEqual(calls.map((c) => c.url.pathname.replace(/^.*\/(signals|product-master)\//, '$1/')).sort(), ['product-master/options', 'signals/research/runs'])
    for (const call of calls) assert.equal(bearer(call), 'Bearer tok-7')
    assert.equal(runs.length, 1)
    assert.ok(JSON.stringify(runs[0]).includes('ScholarClone'), 'the run is named from the options')
  })

  it('the signal service (signal-review-service.ts:80) productOptions asks the same address', async () => {
    const calls = fakeFetch(() => OPTIONS)
    await signalReviewService.productOptions()
    assert.match(calls[0].url.pathname, /\/product-master\/options$/)
    assert.equal(bearer(calls[0]), 'Bearer tok-7')
  })

  it('both services still call productMasterService.options() (a scan, so a move to another endpoint fails here)', () => {
    for (const file of ['services/signal-review/runs-service.ts', 'services/signal-review/signal-review-service.ts']) {
      assert.ok(readFileSync(file, 'utf8').includes('productMasterService.options()'), `${file} still reads the options`)
    }
  })
})

describe('the asset import column "product id" (components/domain/crm/asset-list-view.tsx:29)', () => {
  it('still maps the header "product id" to productId: a person types the CATALOGUE id, and that number never changes', () => {
    const source = readFileSync('components/domain/crm/asset-list-view.tsx', 'utf8')
    assert.ok(source.includes("'product id': 'productId'"), 'the import header is still read as the catalogue id')
  })
})
