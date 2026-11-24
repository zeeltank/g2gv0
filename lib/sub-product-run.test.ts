import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { choiceOf, resolveSelection, splitChoice } from './product-selection'
import { decideGenerate, generateSignals } from './signals-generate'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('Choosing one sub-product of a product', () => {
  const products = [
    { key: 'scholarclone', label: 'ScholarClone', ready: true, missing: [] as string[], offers: [{ offer_id: 'SCH-11' }, { offer_id: 'SCH-02' }] },
    { key: 'enterprise_brain', label: 'Enterprise Brain', ready: false, missing: ['x'], offers: [{ offer_id: 'EB-01' }] },
  ]

  it('a choice is a product or "product::OFFER-ID", and splits back', () => {
    assert.equal(choiceOf('scholarclone', 'SCH-11'), 'scholarclone::SCH-11')
    assert.equal(choiceOf('scholarclone'), 'scholarclone')
    assert.deepEqual(splitChoice('scholarclone::SCH-11'), { productKey: 'scholarclone', offerId: 'SCH-11' })
    assert.deepEqual(splitChoice('scholarclone'), { productKey: 'scholarclone', offerId: null })
    assert.deepEqual(splitChoice(null), { productKey: null, offerId: null })
  })

  it('a remembered sub-product is kept only where sub-products are allowed and it still exists', () => {
    assert.equal(resolveSelection('scholarclone::SCH-11', products, false, true), 'scholarclone::SCH-11')
    assert.equal(resolveSelection('scholarclone::SCH-11', products, false, false), 'scholarclone', 'a screen that cannot run one falls back to the product')
    assert.equal(resolveSelection('scholarclone::GONE-1', products, false, true), 'scholarclone', 'a deleted sub-product falls back to its product')
    assert.equal(resolveSelection('nothing::X', products, false, true), 'scholarclone')
    assert.equal(resolveSelection('enterprise_brain', products, false, true), 'enterprise_brain', 'a plain product choice is unchanged')
  })

  const gp = [{ key: 'scholarclone', label: 'ScholarClone', ready: true, missing: [] as string[] }]

  it('accepts any sub-product for universal generation', () => {
    const r = decideGenerate('scholarclone', gp, false, { offer_id: 'SCH-02', name: 'Scholar Core', ready: false, missing: [] })
    assert.equal(r.ok, true)
    assert.equal(decideGenerate('scholarclone', gp, false, { offer_id: 'SCH-11', name: 'Scholar Learn', ready: true, missing: [] }).ok, true)
    assert.equal(decideGenerate('scholarclone', gp, false, null).ok, true, 'no sub-product: the whole product, as before')
  })

  it('allows selecting any customer model (b2c, b2g, b2b) universally', () => {
    const sub = { offer_id: 'SCH-11', name: 'Scholar Learn', ready: true, missing: [] }
    const b2c = decideGenerate('scholarclone', gp, false, sub, 'b2c')
    assert.equal(b2c.ok, true)
    const b2g = decideGenerate('scholarclone', gp, false, sub, 'b2g')
    assert.equal(b2g.ok, true)
  })

  it('sends the Offer ID with the product to the run, and nothing extra for the whole product', async () => {
    const calls: unknown[][] = []
    const status = { product: { key: 'scholarclone', label: 'ScholarClone', ready: true, missing: [] as string[] }, requirements: { search_configured: true, ai_configured: true }, running: false }
    const service = { getStatus: async () => ({ data: status }), runResearch: async (...a: unknown[]) => { calls.push(a); return { message: 'ok', data: { run_id: 7 } } } } as never
    const base = { context: {} as never, choice: 'scholarclone', products: gp, running: false, service }
    await generateSignals({ ...base, sub: { offer_id: 'SCH-11', name: 'Scholar Learn', ready: true, missing: [] } })
    await generateSignals(base)
    assert.equal(calls[0][2], 'scholarclone')
    assert.equal(calls[0][4], 'SCH-11')
    assert.equal(calls[1][4], null)
  })

  it('the signal screen selects a master product and one of its sub-products', () => {
    const screen = read('components/domain/signals/company-opportunities.tsx')
    // CHANGED ON PURPOSE (S15 P1-A, 13 Nov 2026): the screen no longer calls useSelectedProduct({ allowAll: false, allowSub: true }); it resolves "all", a
    // Product Master number, a product or a product with one sub-product (`key::SUB-ID`) from the address in one tested function. A sub-product is still
    // chosen as `scope.choice`, and split into the product and the offer exactly as before.
    assert.match(screen, /resolveProductScope\(\{ product: query\.filters\.product \?\? '', asksTheList: asksTheList\(searchParams\), remembered, products \}\)/)
    assert.match(screen, /const choice = scope\?\.kind === 'product' \? scope\.choice : null/)
    assert.match(screen, /const \{ productKey: product, offerId \} = splitChoice\(choice\)/)
    assert.match(screen, /selected\?\.offers\.map\(\(offer\)/)
    assert.match(screen, /useGenerateSignals\(context, selected \? selected\.key : null, products, offerId, regions(?:, \w+)?\)/)
    assert.match(screen, /id="sub-product-select"/)
  })
})
