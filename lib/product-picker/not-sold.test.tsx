import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import type { PickedSubProduct } from './model'
import { emptyMessage, firstSelectable, isOffered, isSelectable, moveAmongSelectable, NOT_SOLD_TAG, pickedFromRow, rowKey, rowTag, withoutExcluded } from './model'
import { PICKER_CONSUMER_KEYS, PICKER_RULES } from './consumer-rules'
import { forgetResolved } from './resolver'
import { box, CATALOGUE_WITH_NOT_SOLD, installApi, openPicker, optionNames, searchBox, type ApiOptions, type Kit } from './harness'
import type { PickerRow } from '../../services/product-master/picker-service'

/**
 * Every Sub-product is LISTED, sold or not (S15 follow-up, contract D-7), and one that is not sold is tagged "Not sold in CRM" and cannot be chosen where the form
 * stores the id of the entry in CRM. The REAL picker and the REAL service run; only the network is replaced, so the request the default picker sends (no scope) and
 * the request an opted-in one sends (scope=all) are what the server receives.
 */
interface Props { scope?: 'sold' | 'all'; notSoldSelectable?: boolean; initial?: string | null }

async function open(opts: ApiOptions = {}, props: Props = {}) {
  forgetResolved()
  const k = await kit()
  const api = installApi(k, { catalogue: CATALOGUE_WITH_NOT_SOLD, ...opts })
  const { SubProductPicker } = await import('../../components/domain/portfolio/product-picker')
  const picked: Array<PickedSubProduct | null> = []
  function Harness() {
    const [value, setValue] = k.React.useState<string | null>(props.initial ?? null)
    return k.h(SubProductPicker, {
      value, scope: props.scope, notSoldSelectable: props.notSoldSelectable, 'aria-label': 'Sub-product',
      onChange: (p: PickedSubProduct | null) => { picked.push(p); setValue(p ? p.productId : null) },
    })
  }
  await k.render(k.h(Harness))
  await k.tick(30)
  return { k, api, picked }
}

const tags = (k: Kit) => k.all('[role="option"]').map((o) => `${o.querySelector('span span')?.textContent}:${o.querySelector('[data-picker-tag]')?.textContent ?? ''}`)
const optionOf = (k: Kit, name: string) => k.all('[role="option"]').find((o) => o.querySelector('span span')?.textContent === name)!

describe('the default picker is what it always was', () => {
  afterEach(disposeAll)

  it('sends no scope, lists only what is sold, and draws no tag', async () => {
    const { k, api } = await open()
    await openPicker(k)
    assert.equal(api.searches()[0].query.has('scope'), false, 'no scope in the request: nothing that calls it today changes')
    assert.deepEqual(optionNames(k), ['LMS Basic', 'Implementation Support', 'Scholar Nine', 'Scholar School ERP', 'Loose Add-on'])
    assert.equal(k.all('[data-picker-tag]').length, 0)
  })

  it('does not send scope for scope="sold" either: the default is never written into the request', async () => {
    const { k, api } = await open({}, { scope: 'sold' })
    await openPicker(k)
    assert.equal(api.searches()[0].query.has('scope'), false)
  })

  it('keeps the old sentence for an empty list of sold Sub-products', async () => {
    const { k } = await open({ catalogue: [] })
    await openPicker(k)
    assert.ok(k.one('[data-picker-popover]')!.textContent!.includes('No Sub-product is sold yet.'))
  })
})

describe('a picker that lists every Sub-product (scope all)', () => {
  afterEach(disposeAll)

  it('asks for scope=all, lists the paused one and the one that is not sold, each tagged, and never the one in the Recycle Bin', async () => {
    const { k, api } = await open({}, { scope: 'all' })
    await openPicker(k)
    assert.equal(api.searches()[0].query.get('scope'), 'all')
    assert.deepEqual(tags(k), [
      'LMS Basic:', 'Admissions Desk:Not sold in CRM', 'Implementation Support:', 'Old Gujarat Edition:Paused', 'Scholar Nine:', 'Scholar School ERP:', 'Loose Add-on:',
    ])
    assert.ok(!optionNames(k).includes('Retired Pack'), 'a record in the Recycle Bin is never offered')
  })

  it('does not choose a row that is not sold when the click comes: nothing is handed to the form and the list stays open', async () => {
    const { k, picked } = await open({}, { scope: 'all' })
    await openPicker(k)
    const row = optionOf(k, 'Admissions Desk')
    assert.equal(row.getAttribute('aria-disabled'), 'true', 'an assistive technology is told it cannot be chosen')
    await k.click(row)
    await k.tick(20)
    assert.equal(picked.length, 0, 'nothing chosen')
    assert.ok(k.one('[data-picker-popover]'), 'the list is still open')
    await k.click(optionOf(k, 'Old Gujarat Edition'))
    assert.equal(picked.length, 0, 'a paused one is not chosen either')
    await k.click(optionOf(k, 'Scholar Nine'))
    await k.tick(20)
    assert.equal(picked.length, 1, 'a sold one still is')
    assert.equal(picked[0]!.productId, '10')
  })

  it('opens with the first row that can be chosen highlighted, and the arrow keys and Enter skip the rows that cannot', async () => {
    const { k, picked } = await open({ catalogue: [{ crmProductId: null, masterId: 30, name: 'Aardvark (not sold)', productName: 'Alpha', sku: null, unitPrice: null, currency: null, taxRateId: null, type: 'product', state: 'not_sold' }, ...CATALOGUE_WITH_NOT_SOLD] }, { scope: 'all' })
    await openPicker(k)
    const input = searchBox(k)!
    assert.equal(input.getAttribute('aria-activedescendant')?.endsWith('-option-1'), true, 'row 0 is not sold: the highlight starts on row 1')
    await k.press('Enter', input)
    await k.tick(20)
    assert.equal(picked[0]?.name, 'LMS Basic', 'Enter chooses the highlighted row, which is a sold one')
  })

  it('the arrow keys step over a row that cannot be chosen', async () => {
    const { k, picked } = await open({}, { scope: 'all' })
    await openPicker(k)
    const input = searchBox(k)!
    // order: LMS Basic, Admissions Desk (not sold), Implementation Support, Old Gujarat Edition (paused), Scholar Nine ...
    await k.press('ArrowDown', input)
    assert.equal(input.getAttribute('aria-activedescendant')?.endsWith('-option-2'), true, 'steps over the not-sold row to Implementation Support')
    await k.press('ArrowDown', input)
    assert.equal(input.getAttribute('aria-activedescendant')?.endsWith('-option-4'), true, 'and over the paused one to Scholar Nine')
    await k.press('Enter', input)
    await k.tick(20)
    assert.equal(picked[0]?.name, 'Scholar Nine')
  })

  it('does nothing on Enter when every row listed is one that cannot be chosen (there is nothing to highlight)', async () => {
    const onlyNotSold = [{ crmProductId: null, masterId: 30, name: 'Admissions Desk', productName: 'ScholarClone', sku: null, unitPrice: null, currency: null, taxRateId: null, type: 'product' as const, state: 'not_sold' as const }]
    const { k, picked } = await open({ catalogue: onlyNotSold }, { scope: 'all' })
    await openPicker(k)
    await k.press('Enter', searchBox(k)!)
    await k.tick(20)
    assert.equal(picked.length, 0, 'nothing is chosen')
    assert.ok(k.one('[data-picker-popover]'), 'and the list stays open')
  })

  it('says "No Sub-product yet." for an empty list, not that none is sold', async () => {
    const { k } = await open({ catalogue: [] }, { scope: 'all' })
    await openPicker(k)
    const message = k.one('[data-picker-popover]')!.textContent!
    assert.ok(message.includes('No Sub-product yet.') && !message.includes('sold yet'))
  })

  it('has no axe violation with tagged rows on screen', async () => {
    const { k } = await open({}, { scope: 'all' })
    await openPicker(k)
    assert.deepEqual(await axeViolations(k.w.document.body), [])
  })
})

describe('a form that can store a Sub-product that is not sold (notSoldSelectable)', () => {
  afterEach(disposeAll)

  it('chooses it: the form is handed an empty productId, no catalogue id, and the Sub-product\'s own id, and the list closes', async () => {
    const { k, picked } = await open({}, { scope: 'all', notSoldSelectable: true })
    await openPicker(k)
    const row = optionOf(k, 'Admissions Desk')
    assert.equal(row.getAttribute('aria-disabled'), null, 'it can be chosen')
    assert.equal(row.querySelector('[data-picker-tag]')!.textContent, NOT_SOLD_TAG, 'and still says it is not sold')
    await k.click(row)
    await k.tick(20)
    assert.equal(picked.length, 1)
    assert.equal(picked[0]!.productId, '')
    assert.equal(picked[0]!.crmProductId, null)
    assert.equal(picked[0]!.masterId, 30)
    assert.ok(!k.one('[data-picker-popover]'), 'the list closes')
  })
})

describe('the rules of a row that cannot be chosen, as plain functions', () => {
  const row = (over: Partial<PickerRow> = {}): PickerRow => ({ crmProductId: 10, masterId: 23, name: 'Scholar Nine', productName: 'ScholarClone', sku: null, unitPrice: 1, currency: 'INR', taxRateId: null, type: 'product', ...over })

  it('offers a row of the default answer (no sold, no state) and one marked sold; not one marked not sold, paused, or with no entry in CRM', () => {
    assert.equal(isOffered(row()), true)
    assert.equal(isOffered(row({ sold: true, state: 'sold' })), true)
    assert.equal(isOffered(row({ sold: false, state: 'not_sold' })), false)
    assert.equal(isOffered(row({ sold: false, state: 'paused' })), false)
    assert.equal(isOffered(row({ state: 'paused' })), false, 'a state that is not sold is enough')
    assert.equal(isOffered(row({ sold: false })), false, 'sold: false is enough')
    assert.equal(isOffered(row({ crmProductId: null })), false, 'no entry in CRM is nothing to store')
  })

  it('chooses an offered row always, and a row that is not offered only when the form opted in', () => {
    const notSold = row({ crmProductId: null, sold: false, state: 'not_sold' })
    assert.equal(isSelectable(row(), false), true)
    assert.equal(isSelectable(notSold, false), false)
    assert.equal(isSelectable(notSold, true), true)
  })

  it('tags a row that is not offered with Paused or Not sold in CRM, and an offered row with nothing', () => {
    assert.equal(rowTag(row()), null)
    assert.equal(rowTag(row({ sold: false, state: 'paused' })), 'Paused')
    assert.equal(rowTag(row({ crmProductId: null, sold: false, state: 'not_sold' })), 'Not sold in CRM')
    assert.equal(rowTag(row({ sold: false })), 'Not sold in CRM')
  })

  it('knows a row by its catalogue id, or by its master id when it has none', () => {
    assert.equal(rowKey(row()), '10')
    assert.equal(rowKey(row({ crmProductId: null })), 'master-23')
  })

  it('hands a row with no entry in CRM back with an empty productId', () => {
    const picked = pickedFromRow(row({ crmProductId: null }))
    assert.equal(picked.productId, '')
    assert.equal(picked.crmProductId, null)
    assert.equal(picked.masterId, 23)
  })

  it('never hides a row with no entry in CRM because the form excluded some ids', () => {
    const rows = [row({ crmProductId: null, masterId: 30 }), row({ crmProductId: 2 })]
    assert.deepEqual(withoutExcluded(rows, new Set(['2', 'null'])).map((r) => r.masterId), [30])
  })

  it('moves the highlight over the rows that can be chosen only', () => {
    const flags = [false, true, false, false, true, false]
    assert.equal(firstSelectable(flags), 1)
    assert.equal(firstSelectable([false, false]), 0, 'nothing to highlight')
    assert.equal(moveAmongSelectable(1, 'ArrowDown', flags), 4)
    assert.equal(moveAmongSelectable(4, 'ArrowUp', flags), 1)
    assert.equal(moveAmongSelectable(4, 'ArrowDown', flags), 4, 'nothing further down: stays')
    assert.equal(moveAmongSelectable(4, 'Home', flags), 1)
    assert.equal(moveAmongSelectable(1, 'End', flags), 4)
    assert.equal(moveAmongSelectable(2, 'a', flags), 2)
    assert.equal(moveAmongSelectable(0, 'ArrowDown', [false, false]), 0)
    assert.equal(moveAmongSelectable(3, 'ArrowDown', []), 0)
  })

  it('words an empty list by what it lists', () => {
    assert.equal(emptyMessage('', 'all'), 'No Sub-product yet.')
    assert.equal(emptyMessage('x', 'all'), 'No sub-product matches')
    assert.equal(emptyMessage('', 'sold'), 'No Sub-product is sold yet.')
    assert.equal(emptyMessage('x'), 'No sold sub-product matches')
  })
})

describe('the one list of how each form treats a Sub-product that is not sold (lib/product-picker/consumer-rules.ts)', () => {
  const FILE_OF = {
    quote: 'components/domain/crm/quote-line-item-table.tsx',
    salesOrder: 'components/domain/crm/sales-order-line-item-table.tsx',
    invoice: 'components/domain/crm/invoice-detail-page.tsx',
    purchaseOrder: 'components/domain/crm/purchase-order-line-item-table.tsx',
    opportunityProduct: 'components/domain/crm/opportunity-detail-page.tsx',
    ticket: 'components/domain/crm/create-ticket-modal.tsx',
    asset: 'components/domain/crm/create-asset-modal.tsx',
    faq: 'components/domain/crm/create-faq-modal.tsx',
    bundle: 'components/domain/portfolio/sub-product-bundle.tsx',
  } as const

  it('names nine consumers (the price book is not one: Price Books were removed in S16)', () => {
    assert.deepEqual([...PICKER_CONSUMER_KEYS].sort(), Object.keys(FILE_OF).sort())
  })

  it('puts every one of them on the default of D-7: every Sub-product listed, a not-sold one not chosen (all of them store the id of the entry in CRM)', () => {
    for (const key of PICKER_CONSUMER_KEYS) {
      assert.equal(PICKER_RULES[key].scope, 'all', `${key} lists every Sub-product`)
      assert.equal(PICKER_RULES[key].notSoldSelectable, false, `${key} cannot choose one that is not sold`)
      assert.match(PICKER_RULES[key].stores, /crm_products\.id/, `${key} says what it stores`)
    }
  })

  for (const key of PICKER_CONSUMER_KEYS) {
    it(`${key}: its screen reads the rule from the list and not a value of its own (${FILE_OF[key]})`, () => {
      const source = readFileSync(FILE_OF[key], 'utf8')
      assert.ok(source.includes('@/lib/product-picker/consumer-rules'), 'imports the list')
      assert.ok(source.includes(`PICKER_RULES.${key}`), `reads PICKER_RULES.${key}`)
      assert.ok(!/notSoldSelectable=\{(true|false)\}/.test(source), 'no hard-coded true or false: flipping the line in the list is the only change')
      assert.ok(!/scope="(all|sold)"/.test(source), 'and no hard-coded scope')
    })
  }

  it('the quote table is handed the invoice\'s rule by the invoice page, so the two can be flipped apart', () => {
    assert.ok(readFileSync('components/domain/crm/invoice-detail-page.tsx', 'utf8').includes('pickerRule={PICKER_RULES.invoice}'))
    assert.ok(readFileSync('components/domain/crm/quote-line-item-table.tsx', 'utf8').includes('pickerRule = PICKER_RULES.quote'))
  })
})
