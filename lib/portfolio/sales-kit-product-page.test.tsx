import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signals/router-harness'
import { portfolioProducts } from '../signals/opportunity-fixtures'
import { absent, says } from '../agent/assertions'
import { ApiError } from '../../services/core'
import { fakeSalesKitService, scholarcloneItems, type KitFakeOptions } from '../../services/product-master/kit-fake-service'
import { everything, listRow, meta } from './fixtures'
import { installWorld, openTab, tabLabels } from './screen-kit'
import type { PmCan } from '../../services/product-master/types'

/**
 * The Sales Kit tab on a Product's own page, through the real page: who gets the tab, what it counts, what a pasted `?tab=kit` does for somebody who may not have it, and that nothing is
 * read from the Sales Kit for a caller who may not view it.
 */

let restore: (() => void) | null = null
afterEach(async () => {
  restore?.()
  restore = null
  await disposeAll()
})

async function openProduct({ can = {}, kitOptions = {}, productKey = 'scholarclone', tab }: { can?: Partial<PmCan>; kitOptions?: KitFakeOptions; productKey?: string; tab?: string } = {}) {
  const k = await kit()
  const router = await routerHarness('', `/portfolio/${productKey}`)
  const world = everything()
  if (productKey === 'bundle') world.data.products.push({ ...world.data.products[0], id: 5, key: 'bundle', name: 'Commercial Bundle', signalKey: null, portfolioName: null, subProductCount: 2 })
  const calls = await installWorld(k, { everything: world, listRows: [listRow()], meta: meta({}, can) })
  const { portfolioService } = await import('../../services/portfolio/portfolio-service')
  Object.assign(portfolioService, { getProducts: async () => portfolioProducts() })

  const { salesKitService } = await import('../../services/product-master/kit-service')
  const fake = fakeSalesKitService(kitOptions)
  const original = { ...salesKitService }
  Object.assign(salesKitService, fake.service)
  restore = () => { Object.assign(salesKitService, original); k.w.history.replaceState(null, '', `/portfolio/${productKey}`) }
  k.w.history.replaceState(null, '', tab ? `/portfolio/${productKey}?tab=${tab}` : `/portfolio/${productKey}`)

  const { ProductDetailView } = await import('../../components/domain/portfolio/product-detail-view')
  await k.render(router.wrap(k.h(ProductDetailView, { context: { token: 'test-token', subInstituteId: '1', syear: '', userId: '2', organizationId: '', orgType: '', profileId: '1' } as never, productKey })))
  await k.tick(80)
  return { k, calls, kitCalls: fake.calls }
}

const names = (k: Awaited<ReturnType<typeof kit>>) => tabLabels(k).map((t) => t.replace(/\d+$/, '').trim())

describe('the Sales Kit tab on a Product page', () => {
  it('is the fifth tab, before History, for a caller who may view it, and counts what the kit holds', async () => {
    const { k, kitCalls } = await openProduct({ can: { kitView: true } })
    assert.deepEqual(names(k), ['Overview', 'Sub-products', 'Signals & ICP', 'Sales Kit', 'History'])
    const tab = k.all('[role="tab"]').find((t) => t.textContent?.startsWith('Sales Kit'))!
    assert.equal(tab.textContent, 'Sales Kit5', 'the count is the number of entries, drawn on the tab before it is opened')
    assert.equal(tab.getAttribute('aria-label'), 'Sales Kit 5')
    assert.deepEqual(kitCalls.get, [1], 'the kit was read with the Product\'s own record id')
  })

  it('is not drawn at all for a caller who may not view it, and nothing is read from the kit for them', async () => {
    const { k, kitCalls } = await openProduct()
    assert.deepEqual(names(k), ['Overview', 'Sub-products', 'Signals & ICP', 'History'])
    assert.deepEqual(kitCalls.get, [], 'no request to the Sales Kit')
    assert.ok(!k.bodyText().includes('Sales Kit'), 'not a word about it')
  })

  it('is not drawn when the server says view is false, even though the host knows the field', async () => {
    const { k, kitCalls } = await openProduct({ can: { kitView: false, kitAdd: true } })
    assert.equal(names(k).includes('Sales Kit'), false)
    assert.equal(kitCalls.get.length, 0)
  })

  it('opens on the Sales Kit for ?tab=kit, with the shelf, and writes ?tab=kit when the tab is pressed', async () => {
    const pasted = await openProduct({ can: { kitView: true }, tab: 'kit' })
    assert.equal(pasted.k.one('[role="tab"][aria-selected="true"]')!.textContent, 'Sales Kit5')
    assert.equal(pasted.k.all('[role="tabpanel"]:not([hidden]) h2')[0]?.textContent, 'Sales Kit')
    says(pasted.k.bodyText(), 'What is your school not seeing?')
    await disposeAll()
    const pressed = await openProduct({ can: { kitView: true } })
    await openTab(pressed.k, 'Sales Kit')
    await pressed.k.tick(30)
    assert.match(pressed.k.w.location.search, /tab=kit/)
    says(pressed.k.bodyText(), 'Open interactive deck')
  })

  it('lands on the Overview, not on an empty tab, when ?tab=kit is pasted by somebody who may not view the kit', async () => {
    const { k, kitCalls } = await openProduct({ tab: 'kit' })
    assert.equal(k.one('[role="tab"][aria-selected="true"]')!.textContent, 'Overview')
    says(k.bodyText(), 'Customer and buyer summary')
    assert.equal(kitCalls.get.length, 0)
  })

  it('shows a manager the Add button and a viewer none, through the page, from what the kit\'s own answer says', async () => {
    const manager = await openProduct({ can: { kitView: true }, tab: 'kit' })
    assert.ok(manager.k.withText('Add to Sales Kit'))
    await disposeAll()
    restore?.()
    const viewer = await openProduct({ can: { kitView: true }, tab: 'kit', kitOptions: { can: { view: true, add: false, edit: false, delete: false } } })
    absent(viewer.k.withText('Add to Sales Kit'), 'a viewer has no Add button')
    assert.ok(viewer.k.withText('Download PowerPoint'), 'but has the shelf')
  })

  it('is not on the page of a Product that only the Portfolio has, whatever the caller may view', async () => {
    const { k, kitCalls } = await openProduct({ can: { kitView: true }, productKey: 'bundle' })
    assert.deepEqual(names(k), ['Sub-products', 'History'])
    assert.equal(kitCalls.get.length, 0)
  })

  it('keeps the tab and says why when the server has no Sales Kit yet, with a Retry', async () => {
    const { k, kitCalls } = await openProduct({
      can: { kitView: true },
      tab: 'kit',
      kitOptions: { overrides: { get: async () => { throw new ApiError('The Sales Kit is not set up on this server yet.', 503) } } },
    })
    const tab = k.all('[role="tab"]').find((t) => t.textContent?.startsWith('Sales Kit'))!
    assert.equal(tab.textContent, 'Sales Kit', 'no number to show, so none is invented')
    says(k.one('[role="alert"]')!.textContent, 'The Sales Kit is not set up on this server yet.')
    assert.ok(k.withText('Retry'))
    const before = kitCalls.get.length
    await k.click(k.withText('Retry')!)
    await k.tick(40)
    assert.ok(kitCalls.get.length > before, 'Retry reads it again')
  })

  it('has the kit\'s items in the tab\'s panel only while that tab is open', async () => {
    const { k } = await openProduct({ can: { kitView: true }, kitOptions: { items: scholarcloneItems() } })
    assert.ok(!k.bodyText().includes('Fee collection one-pager'), 'the Overview does not draw the shelf')
    await openTab(k, 'Sales Kit')
    await k.tick(30)
    says(k.bodyText(), 'Fee collection one-pager')
  })
})
