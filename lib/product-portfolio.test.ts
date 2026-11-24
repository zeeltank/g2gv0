/**
 * The user-managed Product Portfolio and its link to an ICP: the create / edit form, the ICP's own product list (nothing added for the person),
 * how a comparison reads (never a made-up score), and that the screen's Add, Edit and Delete are really wired to a form and to the API.
 * (No React test setup here, so components are checked through their pure helpers and their source.)
 */
import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { addCustom, customEntries, deleteConfirmation, emptyProductForm, fromOffer, problemLines, removeEntry, serverErrors, splitNeeds, toggle, toPayload, validateProductForm } from './product-form'
import { addProduct, comparisonScope, notChosen, removeProduct, scoreLabel, scoreTone } from './icp-products'
import { fromConfig, toConfig } from './icp-form'
import type { ProductOffer } from '@/services/portfolio/types'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const offer = (o: Partial<ProductOffer> = {}): ProductOffer => ({
  id: 7, offer_id: 'MY-01', name: 'Fee Suite', parent_product: 'Scholar K-12', readiness_status: 'In development', readiness_confirmed: false, partner_sellable: false,
  what_it_does: 'Fee collection.', needs_solved: ['N13'], primary_segments: ['K12-PVT'], trigger_signals: [], pricing_model: null, ...o,
})

describe('product form', () => {
  const valid = () => ({ ...emptyProductForm(), offer_id: 'MY-01', name: 'Fee Suite', parent_product: 'Scholar K-12', readiness_status: 'In development' })

  it('requires an ID (when creating), a name, a category and a status, and nothing else', () => {
    assert.deepEqual(Object.keys(validateProductForm(emptyProductForm(), 'create')).sort(), ['name', 'offer_id', 'parent_product', 'readiness_status'])
    assert.deepEqual(validateProductForm(valid(), 'create'), {})
  })

  it('does not ask for the ID when editing: it cannot change and is not sent', () => {
    const f = { ...valid(), offer_id: '' }
    assert.deepEqual(validateProductForm(f, 'edit'), {})
    assert.equal('offer_id' in toPayload(f, 'edit'), false)
    assert.equal(toPayload(valid(), 'create').offer_id, 'MY-01')
  })

  it('rejects an ID the server would reject, and over-long text', () => {
    assert.ok(validateProductForm({ ...valid(), offer_id: 'bad id!' }, 'create').offer_id)
    assert.ok(validateProductForm({ ...valid(), name: 'x'.repeat(192) }, 'create').name)
    assert.ok(validateProductForm({ ...valid(), typical_deal_band: 'x'.repeat(51) }, 'create').typical_deal_band)
  })

  it('sends blank optional fields as null and never fills one in', () => {
    const p = toPayload({ ...valid(), pricing_model: '   ' }, 'create')
    assert.equal(p.pricing_model, null)
    assert.equal(p.what_it_does, null)
    assert.equal(p.typical_deal_band, null)
    assert.deepEqual(p.primary_segments, [])
  })

  it('round-trips an existing product through the form without changing it', () => {
    const o = offer({ modules_components: 'Fees; receipts', proof_points: 'Live at 3 schools', pricing_model: 'Per student' })
    const p = toPayload(fromOffer(o), 'edit')
    assert.equal(p.name, 'Fee Suite')
    assert.equal(p.modules_components, 'Fees; receipts')
    assert.equal(p.pricing_model, 'Per student')
    assert.deepEqual(p.needs_solved, ['N13'])
  })

  it('serializes individual ICP into icp_config when enabled or populated', () => {
    const f = {
      ...valid(),
      offer_id: 'SUB-FEES',
      name: 'Fee Intelligence',
      icp: {
        enabled: true,
        label: 'Fee Intelligence ICP',
        industry_label: 'Mid-size private schools',
        pitch: 'Automated reconciliation for school trustees',
        guidance: 'Focus on admissions seasons',
        buyer_types: 'Trustee\nPrincipal',
        regions: 'Maharashtra\nGujarat',
        priority_cities: 'Mumbai\nPune',
        competitors: 'Legacy ERP',
        disqualifiers: 'Government schools',
        must_have: 'Student count > 500',
      },
    }
    const p = toPayload(f, 'create') as any
    assert.ok(p.icp_config)
    assert.equal(p.icp_config.label, 'Fee Intelligence ICP')
    assert.equal(p.icp_config.industry_label, 'Mid-size private schools')
    assert.equal(p.icp_config.pitch, 'Automated reconciliation for school trustees')
    assert.deepEqual(p.icp_config.offer_ids, ['SUB-FEES'])
    assert.deepEqual(p.icp_config.regions, ['Maharashtra', 'Gujarat'])
    assert.deepEqual(p.icp_config.buyer_types, ['Trustee', 'Principal'])
  })

  it('extracts existing individual ICP from an offer when editing', () => {
    const o = offer({
      offer_id: 'SUB-01',
      name: 'Sub Product 1',
      individual_icp: {
        label: 'Custom Sub ICP',
        industry_label: 'Target segment',
        pitch: 'Unique value proposition',
        regions: ['North', 'West'],
        buyer_types: ['Buyer A'],
      },
    })
    const f = fromOffer(o)
    assert.equal(f.icp.enabled, true)
    assert.equal(f.icp.label, 'Custom Sub ICP')
    assert.equal(f.icp.industry_label, 'Target segment')
    assert.equal(f.icp.pitch, 'Unique value proposition')
    assert.equal(f.icp.regions, 'North\nWest')
    assert.equal(f.icp.buyer_types, 'Buyer A')
  })

  it('shows the server\'s field errors next to the field', () => {
    assert.deepEqual(serverErrors({ name: ['The name field is required.'], offer_id: 'taken' }), { name: 'The name field is required.', offer_id: 'taken' })
    assert.deepEqual(serverErrors(undefined), {})
  })

  it('toggles a taxonomy code on and off', () => {
    assert.deepEqual(toggle(['A'], 'B'), ['A', 'B'])
    assert.deepEqual(toggle(['A', 'B'], 'A'), ['B'])
  })

  it('splits legacy need codes from free-text problems and cleans problem lines', () => {
    const split = splitNeeds(['N13', 'Fee collection is slow', 'N02', 'Parents lack visibility'])
    assert.deepEqual(split.codes, ['N13', 'N02'])
    assert.equal(split.text, 'Fee collection is slow\nParents lack visibility')

    assert.deepEqual(problemLines('  Fee collection is slow  \n\n Parents lack visibility \nfee collection is slow '), [
      'Fee collection is slow',
      'Parents lack visibility',
    ])
  })

  it('handles custom "Other" entries with trimming and deduplication', () => {
    const initial = ['EXP', 'LEAD']
    const next = addCustom(initial, '  Custom Event  ')
    assert.deepEqual(next, ['EXP', 'LEAD', 'Custom Event'])
    assert.deepEqual(addCustom(next, 'custom event'), next)
    assert.deepEqual(addCustom(next, '   '), next)
    assert.deepEqual(removeEntry(next, 'Custom Event'), initial)
    assert.deepEqual(customEntries(next, ['EXP', 'LEAD']), ['Custom Event'])
  })

  it('validates free-text customer problems limits', () => {
    const f = { ...valid(), problems: 'A'.repeat(401) }
    assert.ok(validateProductForm(f, 'create').problems)

    const manyProblems = Array.from({ length: 61 }, (_, i) => `Problem ${i}`).join('\n')
    assert.ok(validateProductForm({ ...valid(), problems: manyProblems }, 'create').problems)
  })

  it('asks before deleting, names the product, and says an ICP keeps it from being deleted', () => {
    const t = deleteConfirmation('Fee Suite')
    assert.match(t, /Fee Suite/)
    assert.match(t, /cannot be undone/)
    assert.match(t, /ICP/)
  })
})

describe('the ICP\'s product list', () => {
  it('adds a product once, keeps the order, and removes one', () => {
    assert.deepEqual(addProduct(['A'], 'B'), ['A', 'B'])
    assert.deepEqual(addProduct(['A', 'B'], 'A'), ['A', 'B'])
    assert.deepEqual(addProduct(['A'], '  '), ['A'])
    assert.deepEqual(removeProduct(['A', 'B', 'C'], 'B'), ['A', 'C'])
  })

  it('offers only products that are not already chosen', () => {
    assert.deepEqual(notChosen([{ offer_id: 'A' }, { offer_id: 'B' }], ['A']), [{ offer_id: 'B' }])
  })

  it('keeps "none chosen" as a choice and sends nothing for an older ICP with no list', () => {
    assert.deepEqual(toConfig(fromConfig({ label: 'x', offer_ids: [] }, '')).offer_ids, [])
    assert.equal('offer_ids' in toConfig(fromConfig({ label: 'x' }, '')), false)
    assert.deepEqual(toConfig(fromConfig({ label: 'x', offer_ids: ['A', 'B'] }, '')).offer_ids, ['A', 'B'])
    assert.equal(fromConfig({ label: 'x' }, '').offer_ids, null)
  })

  it('never adds a product by itself when an ICP is loaded', () => {
    assert.deepEqual(fromConfig({ label: 'x', offer_ids: ['A'] }, '').offer_ids, ['A'])
    assert.equal(fromConfig({}, '').offer_ids, null)
  })
})

describe('how a comparison reads', () => {
  it('says "Insufficient data" instead of a number whenever there is no score', () => {
    assert.equal(scoreLabel({ status: 'insufficient_data', score: null }), 'Insufficient data')
    assert.equal(scoreLabel({ status: 'scored', score: null }), 'Insufficient data')
    assert.equal(scoreLabel({ status: 'scored', score: 62 }), '62% match')
    assert.equal(scoreTone(null), 'unknown')
  })

  it('groups scores as strong, partial or weak', () => {
    assert.equal(scoreTone(85), 'strong')
    assert.equal(scoreTone(70), 'strong')
    assert.equal(scoreTone(55), 'partial')
    assert.equal(scoreTone(10), 'weak')
  })

  it('says what the comparison is of, and when it is not of the unsaved edits', () => {
    assert.match(comparisonScope({ saved: true, dirty: true, count: 1 }), /unsaved/i)
    assert.match(comparisonScope({ saved: false, dirty: false, count: 1 }), /built-in/)
    assert.match(comparisonScope({ saved: true, dirty: false, count: 0 }), /Choose one or more/)
    assert.match(comparisonScope({ saved: true, dirty: false, count: 2 }), /No AI is used/)
  })
})

// RE-POINTED (S15 WPD2, 23 Nov 2026): portfolio-view.tsx and product-form-dialog.tsx are retired; the screen is the unified list (portfolio-list.tsx) and the form is the one
// drawer (product-form-drawer.tsx). The old test "Delete is a button that confirms first and shows the server's reason when a product is in use" is deleted: it read only the
// retired view's offer hard delete, which owner decisions D-8 and D-9 replaced with Archive (proved by behaviour in lib/portfolio/sub-product-page.test.tsx "asks before
// archiving, keeps the record when the answer is no, and archives when it is yes" and lib/portfolio/sub-product-page-carried.test.tsx "says what the server answered when archiving is refused, and the record stays as it was").
describe('Product Portfolio wiring', () => {
  const list = read('components/domain/portfolio/portfolio-list.tsx')
  const drawer = read('components/domain/portfolio/product-form-drawer.tsx')

  it('Add Product and Edit open a real form (they used to set state that nothing rendered)', () => {
    assert.match(list, /<ProductFormDrawer\s+open=\{drawer !== null\}/)
    assert.match(list, /Add product/)
    assert.match(list, /Add sub-product/)
    assert.match(read('components/domain/portfolio/sub-product-page.tsx'), /<ProductFormDrawer\s+open=\{drawer\}\s+onOpenChange=\{setDrawer\}\s+mode="edit"/)
    assert.match(drawer, /productRecordService\.create\(body\)/)
    assert.match(drawer, /productRecordService\.update\(record\.id, body\)/)
  })

  it('a change to the portfolio refreshes the list and the products, on the portfolio and on the product page', () => {
    assert.match(list, /onSaved=\{\(\) => \{ setDrawer\(null\); setNotice\(\{ tone: 'success', text: 'Saved\.' \}\); void load\(\) \}\}/)
    const detail = read('components/domain/portfolio/product-detail-view.tsx')
    // REWRITTEN ON PURPOSE (slice 15, P3-B, 14 Nov 2026): the Product page adds a Sub-product through the one form drawer (ProductFormDrawer), not the old dialog.
    // Same strictness: a save must reload the products (the counts and the setup steps) AND the Sub-products list, in the same handler.
    assert.match(detail, /<ProductFormDrawer[\s\S]*onSaved=\{async \(saved\) => \{[\s\S]*reload\(\)[\s\S]*void loadSubs\(1\)/)
    assert.doesNotMatch(detail, /ProductFormDialog/, 'the old dialog is not used on the Product page any more')
  })

  it('the main-product ICP editor, its product picker and its comparison are gone: ICPs are set on sub-products', () => {
    // The five components retired on 23 Nov 2026 (S15 WPD2) stay retired with them: nothing renders them, and a copy would be a second form for the same thing.
    for (const f of ['product-icp-editor.tsx', 'icp-product-picker.tsx', 'icp-comparison.tsx', 'portfolio-view.tsx', 'product-form-dialog.tsx', 'main-product-form-dialog.tsx', 'main-product-delete-dialog.tsx', 'new-product-dialog.tsx']) {
      assert.ok(!existsSync(join(root, 'components/domain/portfolio', f)), `${f} was removed`)
    }
    const service = read('services/signals/product-icp.ts')
    for (const removed of [/\bsave:/, /\bsetStatus:/, /\bcompare:/, /\bcheck:/, /\bget:/]) assert.doesNotMatch(service, removed)
    assert.match(service, /createProduct:/)
    assert.match(service, /deleteProduct:/)
  })
})
