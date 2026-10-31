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

  it('refuses a sub-product whose own ICP is not ready, with what is missing, and starts nothing', () => {
    const r = decideGenerate('scholarclone', gp, false, { offer_id: 'SCH-02', name: 'Scholar Core', ready: false, missing: ['no Individual ICP is saved for this sub-product'] })
    assert.equal(r.ok, false)
    if (!r.ok && !r.outcome.started) {
      assert.equal(r.outcome.reason, 'not_ready')
      assert.match(r.outcome.message, /Scholar Core is not ready/)
      assert.deepEqual(r.outcome.missing, ['no Individual ICP is saved for this sub-product'])
    }
    assert.equal(decideGenerate('scholarclone', gp, false, { offer_id: 'SCH-11', name: 'Scholar Learn', ready: true, missing: [] }).ok, true)
    assert.equal(decideGenerate('scholarclone', gp, false, null).ok, true, 'no sub-product: the whole product, as before')
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

  it('the signal screen selects a master product and displays its sub-products beneath it', () => {
    const screen = read('components/domain/signals/company-opportunities.tsx')
    assert.match(screen, /useSelectedProduct\(context, products, \{ allowAll: false, allowSub: false \}\)/)
    assert.match(screen, /selected\.offers\.map\(\(offer\)/)
    assert.match(screen, /useGenerateSignals\(context, selected \? selected\.key : null, products\)/)
    assert.equal(/sub-product-select/.test(screen), false)
  })
})
