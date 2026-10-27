/**
 * The user-managed Product Portfolio and its link to an ICP: the create / edit form, the ICP's own product list (nothing added for the person),
 * how a comparison reads (never a made-up score), and that the screen's Add, Edit and Delete are really wired to a form and to the API.
 * (No React test setup here, so components are checked through their pure helpers and their source.)
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
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

describe('Product Portfolio wiring', () => {
  const view = read('components/domain/portfolio/portfolio-view.tsx')
  const editor = read('components/domain/portfolio/product-icp-editor.tsx')
  const dialog = read('components/domain/portfolio/product-form-dialog.tsx')
  const picker = read('components/domain/portfolio/icp-product-picker.tsx')
  const compare = read('components/domain/portfolio/icp-comparison.tsx')

  it('Add Product and Edit open a real form (they used to set state that nothing rendered)', () => {
    assert.match(view, /<ProductFormDialog/)
    assert.match(view, /open=\{createOpen \|\| editOffer !== null\}/)
    assert.match(view, /product=\{editOffer\}/)
    assert.match(view, /Add Product/)
    assert.match(dialog, /portfolioService\.createOffer/)
    assert.match(dialog, /portfolioService\.updateOffer/)
  })

  it('Delete is a button that confirms first and shows the server\'s reason when a product is in use', () => {
    assert.match(view, /aria-label=\{`Delete \$\{offer\.name\}`\}/)
    assert.match(view, /window\.confirm\(deleteConfirmation\(offer\.name\)\)/)
    assert.match(view, /setActionError\(apiErrorText\(err, 'Failed to delete the product\.'\)\)/)
  })

  it('a change to the portfolio refreshes the list and the products; the product page also refreshes the ICP picker', () => {
    assert.match(view, /reloadProducts\(\)/)
    const detail = read('components/domain/portfolio/product-detail-view.tsx')
    assert.match(detail, /setCatalogVersion\(\(v\) => v \+ 1\)/)
    assert.match(detail, /catalogVersion=\{catalogVersion\}/)
    assert.match(detail, /onCreateProduct=\{\(\) => setCreateOpen\(true\)\}/)
    assert.match(detail, /productKey=\{product\.key\}|productKey=\{product\.key\}/)
  })

  it('the ICP editor has a searchable picker, not an automatic list, and a comparison', () => {
    assert.match(editor, /<IcpProductPicker/)
    assert.match(editor, /<IcpComparison/)
    assert.match(picker, /role="combobox"/)
    assert.match(picker, /if \(q === ''\)/)
    assert.doesNotMatch(editor, /product\.offers\.map/)
  })

  it('the ICP form is five collapsible sections that hide their content instead of removing it', () => {
    for (const t of ['1. Ideal Customer', '2. Buyer / Decision Maker', '3. Problems and Outcomes', '4. Buying Triggers', '5. Qualification Rules']) assert.match(editor, new RegExp(t.replace(/[.\/]/g, '\$&')))
    assert.match(editor, /hidden=\{!shown\}/)
    assert.match(editor, /aria-expanded=\{shown\}/)
    assert.match(editor, /productIcpService\.save/)
  })

  it('the picker reads only the signed-in organisation\'s portfolio through the API and never hard-codes products', () => {
    assert.match(picker, /portfolioService\.getOffers/)
    assert.match(picker, /portfolioService\.getOffer\(/)
    assert.doesNotMatch(picker + dialog + compare, /ScholarClone|Scholar K-12|SCH-0/)
  })

  it('the comparison only reads: it asks the server, claims no AI, and shows Insufficient data as it is', () => {
    assert.match(compare, /productIcpService\.compare/)
    assert.match(compare, /scoreLabel\(r\)/)
    assert.match(compare, /No AI is used|data\.method/)
    assert.doesNotMatch(compare, /runResearch|generate\(/)
  })
})
