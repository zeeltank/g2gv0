import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { installApi, LINES, type Kit } from './harness'
import { NO_PRODUCT, productChoicesOf, productOptionOf } from './use-product-choices'
import type { PmOption } from '../../services/product-master/types'

/**
 * The Product box (level 1) of the lead, campaign and opportunity forms and the Product facet of the leads list (slice 15, WPC). It has no whole screen of its own: the
 * forms prove it in their own tests. This file proves the box itself: what it offers, what it hands back, when it is not drawn, how it names itself, and that the choices
 * come from ONE read of `GET /api/product-master/lines` (names only) with the bearer header, and from nothing when the person is not signed in or the server has no such list.
 */
const OPTIONS: PmOption[] = LINES.map(productOptionOf)

interface Props { options?: readonly PmOption[]; current?: { id: number; name: string } | null; value?: string; label?: string; alwaysShow?: boolean; id?: string; fieldAttribute?: string }

async function render(props: Props = {}) {
  const k = await kit()
  const { ProductPicker } = await import('../../components/domain/portfolio/product-picker-level-one')
  const chosen: string[] = []
  function Harness() {
    const [value, setValue] = k.React.useState(props.value ?? '')
    return k.h(ProductPicker, {
      options: props.options ?? OPTIONS, current: props.current ?? null, value, label: props.label, alwaysShow: props.alwaysShow, id: props.id, fieldAttribute: props.fieldAttribute,
      onChange: (next: string) => { chosen.push(next); setValue(next) },
    })
  }
  await k.render(k.h(Harness))
  await k.tick(10)
  return { k, chosen }
}

const select = (k: Kit) => k.one('[data-product-picker="product"] select') as HTMLSelectElement | null
const optionTexts = (k: Kit) => k.all('[data-product-picker="product"] option').map((o) => o.textContent)

async function choose(k: Kit, value: string) {
  const el = select(k)!
  await k.act(async () => {
    Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!.call(el, value)
    el.dispatchEvent(new k.w.Event('change', { bubbles: true }))
  })
}

describe('the Product box (level 1): what it offers and hands back', () => {
  afterEach(disposeAll)

  it('offers "No product" first, then every Product by name, with the label Product', async () => {
    const { k } = await render()
    assert.deepEqual(optionTexts(k), [NO_PRODUCT, 'ScholarClone', 'LMS-PAL'])
    assert.equal(k.one('[data-product-picker="product"] label')!.textContent, 'Product')
    assert.equal(select(k)!.value, '', 'nothing is chosen at first')
  })

  it('hands back the Product Master id as TEXT, and an empty text for "No product"', async () => {
    const { k, chosen } = await render()
    await choose(k, '2')
    assert.deepEqual(chosen, ['2'], 'the id as text: the form turns it into a number')
    assert.equal(select(k)!.value, '2', 'the box shows the choice')
    await choose(k, '')
    assert.deepEqual(chosen, ['2', ''], 'an empty text for none')
  })

  it('shows the Product a record already holds, by its own name, when the list no longer offers it (archived since)', async () => {
    const { k } = await render({ current: { id: 9, name: 'Archived Product' }, value: '9' })
    assert.deepEqual(optionTexts(k), [NO_PRODUCT, 'ScholarClone', 'LMS-PAL', 'Archived Product'])
    assert.equal(select(k)!.value, '9', 'the box never shows a wrong value')
    assert.ok(!optionTexts(k).includes('Product 9'), 'and never an id where a name should be')
  })

  it('does not add the held Product twice when the list already has it', async () => {
    const { k } = await render({ current: { id: 1, name: 'ScholarClone' }, value: '1' })
    assert.equal(optionTexts(k).filter((text) => text === 'ScholarClone').length, 1)
  })

  it('takes a label of the form\'s own and a data attribute the form\'s tests look for', async () => {
    const { k } = await render({ label: 'Product (optional)', fieldAttribute: 'data-campaign-product-field', id: 'campaign-product' })
    assert.equal(k.one('[data-product-picker="product"] label')!.textContent, 'Product (optional)')
    assert.ok(k.one('[data-campaign-product-field]'), 'the form\'s own attribute is on the box')
    assert.equal(k.one('label')!.getAttribute('for'), 'campaign-product', 'the label points at the box')
    assert.equal(select(k)!.id, 'campaign-product')
  })
})

describe('the Product box (level 1): when it is not drawn', () => {
  afterEach(disposeAll)

  it('draws nothing when there is nothing to choose and nothing chosen (no right to see Products, or a server without them)', async () => {
    const { k } = await render({ options: [] })
    assert.ok(k.one('[data-product-picker="product"]') === null, 'the box is not drawn')
  })

  it('draws the box for a record that holds a Product the list does not offer, so the person can still clear it', async () => {
    const { k } = await render({ options: [], current: { id: 4, name: 'Gone Product' }, value: '4' })
    assert.deepEqual(optionTexts(k), [NO_PRODUCT, 'Gone Product'])
  })

  it('draws the box with only "No product" when the form says always', async () => {
    const { k } = await render({ options: [], alwaysShow: true })
    assert.deepEqual(optionTexts(k), [NO_PRODUCT])
  })

  it('has no axe violation, with its label, with a held Product and with nothing chosen', async () => {
    const plain = await render()
    assert.deepEqual(await axeViolations(plain.k.w.document.body), [], 'plain')
    await disposeAll()
    const held = await render({ current: { id: 9, name: 'Archived Product' }, value: '9', id: 'p' })
    assert.deepEqual(await axeViolations(held.k.w.document.body), [], 'holding a Product the list lost')
  })
})

describe('the choices of Products: one read of /product-master/lines', () => {
  afterEach(disposeAll)

  async function readChoices(enabled: boolean, setup?: (k: Kit) => ReturnType<typeof installApi>, options: Parameters<typeof installApi>[1] = {}) {
    const k = await kit()
    const api = setup ? setup(k) : installApi(k, options)
    const { useProductChoices } = await import('./use-product-choices')
    const seen: PmOption[][] = []
    function Probe() {
      const choices = useProductChoices(enabled)
      seen.push(choices)
      return null
    }
    await k.render(k.h(Probe))
    await k.tick(30)
    return { k, api, last: seen[seen.length - 1] }
  }

  it('reads the list once, with the bearer header, and turns each row into a Product option (no parent, the name as its label)', async () => {
    const { api, last } = await readChoices(true)
    assert.equal(api.to('/product-master/lines').length, 1, 'one read')
    assert.equal(api.calls.length, 1, 'and nothing else is asked')
    assert.equal(api.calls[0].headers.Authorization, 'Bearer test-token')
    assert.deepEqual(last, [
      { id: 1, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentId: null, label: 'ScholarClone' },
      { id: 2, key: 'lms-pal', name: 'LMS-PAL', kind: 'product', parentId: null, label: 'LMS-PAL' },
    ])
  })

  it('reads nothing while it is not enabled (a closed dialog, a session that is not ready)', async () => {
    const { api, last } = await readChoices(false)
    assert.equal(api.calls.length, 0, 'no request')
    assert.deepEqual(last, [])
  })

  it('is empty, and the form works as before, when the server answers an error or has no such list', async () => {
    const failing = await readChoices(true, (k) => installApi(k, { extra: (call) => (call.path === '/product-master/lines' ? { status: 500, body: { status: 0, message: 'Server error.' } } : undefined) }))
    assert.deepEqual(failing.last, [], 'an error leaves the box out')
    await disposeAll()
    const missing = await readChoices(true, (k) => installApi(k, { extra: (call) => (call.path === '/product-master/lines' ? { status: 404, body: { status: 0, message: 'No.' } } : undefined) }))
    assert.deepEqual(missing.last, [], 'a server without the list leaves the box out')
  })

  it('is empty when the answer is not a list', async () => {
    const { last } = await readChoices(true, (k) => installApi(k, { extra: (call) => (call.path === '/product-master/lines' ? { body: { status: 1, data: null } } : undefined) }))
    assert.deepEqual(last, [])
  })

  it('reads again when it becomes enabled (the dialog opens later), and not before', async () => {
    const k = await kit()
    const api = installApi(k)
    const { useProductChoices } = await import('./use-product-choices')
    let seen: PmOption[] = []
    function Probe({ enabled }: { enabled: boolean }) {
      seen = useProductChoices(enabled)
      return null
    }
    await k.render(k.h(Probe, { enabled: false }))
    await k.tick(20)
    assert.equal(api.calls.length, 0, 'closed: nothing asked')
    await k.render(k.h(Probe, { enabled: true }))
    await k.tick(30)
    assert.equal(api.to('/product-master/lines').length, 1, 'opened: one read')
    assert.equal(seen.length, 2)
  })
})

describe('the choices of a Product as plain functions', () => {
  it('productChoicesOf puts "No product" first, keeps the order of the list, and adds a held Product the list lacks at the end', () => {
    assert.deepEqual(productChoicesOf(OPTIONS, null).map((c) => c.value), ['', '1', '2'])
    assert.deepEqual(productChoicesOf(OPTIONS, { id: 7, name: 'Seven' }).map((c) => c.label), [NO_PRODUCT, 'ScholarClone', 'LMS-PAL', 'Seven'])
    assert.deepEqual(productChoicesOf(OPTIONS, { id: 2, name: 'LMS-PAL' }).map((c) => c.value), ['', '1', '2'], 'a held Product that is in the list is not added again')
  })

  it('productOptionOf keeps a key that is missing as an empty text and the id as a number', () => {
    assert.deepEqual(productOptionOf({ id: 5, key: null, name: 'Loose' }), { id: 5, key: '', name: 'Loose', kind: 'product', parentId: null, label: 'Loose' })
  })
})
