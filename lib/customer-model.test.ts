import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { CUSTOMER_MODELS, fromConfig, toConfig } from './icp-form'
import { buildIcpConfigs, changedIcpModels, emptyIcpStates, icpModelsToSend, icpStatesFromOffer, parseIcpForModel } from './portfolio/icp-state'
import { emptyIcpForm } from './product-icp-draft'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('ICP customer type', () => {
  it('offers B2B, B2C, B2G and Both, each with a note about signals', () => {
    assert.deepEqual(CUSTOMER_MODELS.map((m) => m.value).sort(), ['b2b', 'b2c', 'b2g', 'both'])
    assert.ok(CUSTOMER_MODELS.every((m) => m.note.length > 20))
    assert.match(CUSTOMER_MODELS.find((m) => m.value === 'b2c')!.note, /partner firms/)
  })

  it('is saved and read back, and left out of an ICP that never set it', () => {
    assert.equal(toConfig(fromConfig({ label: 'x', customer_model: 'both' }, '')).customer_model, 'both')
    assert.equal(fromConfig({ label: 'x' }, '').customer_model, '')
    assert.equal('customer_model' in toConfig(fromConfig({ label: 'x' }, '')), false, 'an existing ICP is saved exactly as before')
  })

  it('a new product ICP starts as B2B', () => {
    assert.equal(emptyIcpForm().customer_model, 'b2b')
  })

  it('the sub-product ICP form shows the choice (a product has no ICP form of its own)', () => {
    assert.match(read('components/domain/portfolio/product-icp-section.tsx'), /Customer type/)
    assert.ok(!existsSync(join(__dirname, '..', 'components/domain/portfolio/product-icp-editor.tsx')), 'the main-product ICP editor is gone')
  })
})

describe('Ideal customer text has no short limit', () => {
  it('the sub-product ICP form uses a multi-line box with no maxLength on the ideal-customer field', () => {
    const section = read('components/domain/portfolio/product-icp-section.tsx')
    assert.match(section, /<Textarea id="icp-ideal"[^>]*value=\{form\.industry_label\}(?![^>]*maxLength)/)
  })
})

// RE-POINTED (S15 WPD2, 23 Nov 2026): the retired Portfolio dialog (product-form-dialog.tsx) is replaced by the one form drawer, so these pins read the drawer.
const drawer = read('components/domain/portfolio/product-form-drawer.tsx')

describe('Add product: the ICP is checked before the product is saved', () => {
  it('checks the ICP on the server first and stops with the problems, saving nothing', () => {
    const check = drawer.indexOf('productIcpService.checkConfig')
    assert.ok(check > 0)
    const saves = [drawer.indexOf('productRecordService.create(body)'), drawer.indexOf('productRecordService.update(record.id, body)')]
    assert.ok(saves.every((at) => at > 0), 'both saves of the Sub-product form are found')
    assert.ok(saves.every((at) => check < at), 'the check comes before the product is created or updated')
    assert.match(drawer, /Fix the Ideal customer section\. Nothing was saved\./)
  })
})

describe('Long lines are kept whole, short comma lists still split', () => {
  it('a sentence with commas is one item; "a, b, c" is three', async () => {
    const { lines } = await import('./icp-form')
    const sentence = 'Priority Gujarat markets: Ahmedabad, Surat, Vadodara, Rajkot, Gandhinagar, and other districts with suitable target schools.'
    assert.deepEqual(lines(sentence), [sentence])
    assert.deepEqual(lines('Gujarat, Maharashtra'), ['Gujarat', 'Maharashtra'])
    assert.deepEqual(lines('Gujarat\nMaharashtra\n\n'), ['Gujarat', 'Maharashtra'])
  })

  it('a trigger sentence with commas stays one trigger', async () => {
    const { buildIcpConfig, emptyIcpForm, emptyIcpLines } = await import('./product-icp-draft')
    const l = emptyIcpLines()
    const t = 'School publishes a tender for an LMS, digital-learning platform, or learning technology.'
    l.triggers = `${t}\nSchool announces a digital-learning programme`
    const cfg = buildIcpConfig({ ...emptyIcpForm(), label: 'x', industry_label: 'schools' }, l, { offer_id: 'P3', name: 'Scholar Learn' })
    assert.equal(Object.keys(cfg.triggers ?? {}).length, 2)
  })

  it('sub-products are saved with their individual ICP directly without creating a top-level product', () => {
    assert.match(drawer, /buildPayload\(\{[^\n]*icp: Object\.keys\(built\.configs\)\.length > 0 \? built\.configs : undefined/)
    assert.doesNotMatch(drawer, /productIcpService\.createProduct/)
  })
})

describe('A long product description fits the ICP part (500 characters)', () => {
  it('is kept whole up to 500 characters, and cut at a whole word beyond that', async () => {
    const { buildIcpConfig, emptyIcpForm, emptyIcpLines } = await import('./product-icp-draft')
    const long = 'Scholar Learn combines a Learning Management System (LMS) with Personalised Adaptive Learning (PAL). It supports teaching and learning through curriculum-aligned resources, teacher teaching-support, end-to-end assessments, learning progress tracking, and adaptive learning experiences that respond to student progress where supported.'
    const cfg = buildIcpConfig({ ...emptyIcpForm(), label: 'x', industry_label: 'schools' }, emptyIcpLines(), { offer_id: 'P3', name: 'Scholar Learn', what_it_does: long })
    const what = Object.values(cfg.parts ?? {})[0] as string
    assert.equal(what, long, 'a 330-character description now fits whole')
    assert.equal(Object.keys(cfg.parts ?? {})[0], 'prod_p3')
    const huge = `${long} ${long} ${long}`
    const cut = Object.values(buildIcpConfig({ ...emptyIcpForm(), label: 'x', industry_label: 'schools' }, emptyIcpLines(), { offer_id: 'P3', name: 'Scholar Learn', what_it_does: huge }).parts ?? {})[0] as string
    assert.ok(cut.length <= 500 && huge.startsWith(cut) && !/\s$/.test(cut))
  })
})

describe('Add or edit sub-product: saves directly to offers', () => {
  it('sub-products belong to their parent product and never create a master product', () => {
    // Only the Sub-product form is read: the drawer's other form, "Add product", exists to make a Product, through the Product record API (not the ICP one).
    const subProductForm = drawer.slice(drawer.indexOf('// ====', drawer.indexOf('function AddProductForm')))
    assert.ok(subProductForm.includes('function SubProductForm'), 'the Sub-product form is the part read')
    assert.doesNotMatch(subProductForm, /productIcpService\.createProduct/)
    assert.doesNotMatch(subProductForm, /kind: 'product'/)
  })
  it('guidance allows 5,000 characters in the sub-product ICP form', () => {
    assert.match(read('components/domain/portfolio/product-icp-section.tsx'), /maxLength=\{5000\}/)
  })
})

// NARROWED (S15 WPD2, 23 Nov 2026): the "Delete" button of the retired portfolio-view.tsx (administrators, own products only, window.confirm) is gone; the owner's
// decisions D-8 and D-9 replaced it with Archive, which is proved by behaviour in lib/portfolio/sub-product-page*.test.tsx. The confirmation text and the service call stay.
describe('Delete one of your own products', () => {
  it('words the confirmation (what is deleted, what is kept) and the service deletes by key', async () => {
    const { deleteProductConfirmation } = await import('./product-form')
    const t = deleteProductConfirmation('Scholar Learn', 0)
    assert.match(t, /Scholar Learn/)
    assert.match(t, /deleted from the database/)
    assert.match(t, /cannot be undone/)
    assert.doesNotMatch(t, /archived/)
    assert.match(t, /offers in the Product Portfolio are not deleted/)
    assert.doesNotMatch(t, /existing opportunit/)
    assert.match(deleteProductConfirmation('X', 2), /2 existing opportunities/)
    assert.match(deleteProductConfirmation('X', 1), /1 existing opportunity;/)
    assert.match(read('services/signals/product-icp.ts'), /apiClient\.delete<[^>]*>\(`\$\{path\(product\)\}\?\$\{qs\(c\)\}`\)/)
  })
})

describe('Editing a saved sub-product shows its saved ICP', () => {
  it('opens the edit form with the full offer, and fills the form from the saved ICP', () => {
    // The edit form reads the offer row itself (the list rows do not carry the saved ICPs) and fills the three models from it with lib/portfolio/icp-state.ts.
    assert.match(drawer, /portfolioService\.getOffer\(context, record\.offer\.id\)/)
    assert.match(drawer, /icp: record\?\.offer \? icpStatesFromOffer\(offer, record\.offer\.name\) : emptyIcpStates\(\)/)
    // The Sub-product page opens that same form on its own record, in edit mode.
    assert.match(read('components/domain/portfolio/sub-product-page.tsx'), /<ProductFormDrawer\s+open=\{drawer\}\s+onOpenChange=\{setDrawer\}\s+mode="edit"\s+recordId=\{record\.id\}/)
    assert.match(read('components/domain/portfolio/product-icp-section.tsx'), /This is this product&apos;s saved ICP/)
  })
})

describe('The ICP state of a saved sub-product (lib/portfolio/icp-state.ts)', () => {
  // The parse moved here from the retired Portfolio dialog; these run it, where they used to read the dialog's text.
  const stored = {
    label: 'Fee ICP',
    industry_label: 'Mid-size private schools',
    pitch: 'Fee reconciliation',
    buyer_types: ['Trustee', 'Principal'],
    regions: ['Gujarat', 'Maharashtra'],
    triggers: { a: { pain: 'School announces a fee-collection tender', phrases: ['fee tender'], decay: 60, source: 'tender' }, b: { phrases: ['new admissions season', 'new session'] } },
    queries: [{ q: 'school fee software tender' }],
    disqualifiers: [{ label: 'Government schools', phrases: ['government school'] }, 'trading company'],
  }

  it('reads a stored ICP the way the old dialog did: a trigger in full, freshness and source from the first trigger, lists one per line', () => {
    const { form, lines } = parseIcpForModel(stored, 'Fee Suite', 'b2b')
    assert.equal(form.customer_model, 'b2b')
    assert.equal(form.label, 'Fee ICP')
    assert.equal(form.buyer_types, 'Trustee\nPrincipal')
    assert.equal(form.regions, 'Gujarat\nMaharashtra')
    assert.equal(lines.triggers, 'School announces a fee-collection tender\nnew admissions season, new session', 'a trigger is shown in full (its pain, else its phrases), not a shortened phrase')
    assert.equal(lines.freshness, '60')
    assert.equal(lines.source, 'tender')
    assert.equal(lines.queries, 'school fee software tender')
    assert.equal(lines.exclusions, 'Government schools\ntrading company')
    const bare = parseIcpForModel({ industry_label: 'x' }, 'Fee Suite', 'b2g')
    assert.equal(bare.form.label, 'Fee Suite B2G ICP', 'a stored ICP with no name is named after the product and the model')
    assert.equal(bare.lines.freshness, '', 'no trigger, no invented freshness')
    assert.equal(bare.lines.source, 'news')
    assert.deepEqual(parseIcpForModel(undefined, 'Fee Suite', 'b2c'), emptyIcpStates().b2c)
  })

  it('finds the three models in an offer, in one single ICP by its customer model (none means B2B), or none at all', () => {
    const multi = icpStatesFromOffer({ individual_icps: { b2b: { label: 'B' }, b2g: { label: 'G' } } }, 'Fee Suite')
    assert.equal(multi.b2b.form.label, 'B')
    assert.equal(multi.b2g.form.label, 'G')
    assert.equal(multi.b2c.form.label, '', 'a model nobody stored stays empty')
    assert.equal(icpStatesFromOffer({ individual_icp: { label: 'Old' } }, 'Fee Suite').b2b.form.label, 'Old')
    const partner = icpStatesFromOffer({ icp_config: { label: 'Partners', customer_model: 'b2c' } }, 'Fee Suite')
    assert.equal(partner.b2c.form.label, 'Partners')
    assert.equal(partner.b2b.form.label, '', 'a single ICP of another model is not copied into B2B')
    assert.deepEqual(icpStatesFromOffer(null, 'Fee Suite'), emptyIcpStates())
    assert.deepEqual(icpStatesFromOffer({}, 'Fee Suite'), emptyIcpStates())
  })

  it('sends only the models the person changed and filled in, and names a model that has no name as a problem, not a config', () => {
    const loaded = icpStatesFromOffer({ individual_icps: { b2b: stored } }, 'Fee Suite')
    assert.deepEqual(changedIcpModels(loaded, loaded), [])
    assert.deepEqual(icpModelsToSend(loaded, loaded), [], 'nothing changed, nothing sent')
    const edited = { ...loaded, b2b: { ...loaded.b2b, form: { ...loaded.b2b.form, pitch: 'A new pitch' } } }
    assert.deepEqual(changedIcpModels(loaded, edited), ['b2b'])
    assert.deepEqual(icpModelsToSend(loaded, edited), ['b2b'])
    const cleared = { ...loaded, b2b: emptyIcpStates().b2b }
    assert.deepEqual(changedIcpModels(loaded, cleared), ['b2b'])
    assert.deepEqual(icpModelsToSend(loaded, cleared), [], 'a model the person emptied is changed but has nothing to send')
    const offer = { offer_id: 'FEE-01', name: 'Fee Suite', what_it_does: 'Fee collection' }
    const built = buildIcpConfigs(['b2b'], edited, offer)
    assert.deepEqual(Object.keys(built.configs), ['b2b'])
    assert.equal(built.configs.b2b?.customer_model, 'b2b')
    assert.equal(built.configs.b2b?.pitch, 'A new pitch')
    assert.deepEqual(built.problems, {})
    const unnamed = { ...loaded, b2g: { ...loaded.b2g, form: { ...loaded.b2g.form, pitch: 'Only a pitch' } } }
    const refused = buildIcpConfigs(['b2g'], unnamed, offer)
    assert.deepEqual(refused.configs, {})
    assert.match(refused.problems.b2g?.[0] ?? '', /ICP name: give the B2G ICP a name/)
  })
})
