import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { buildIcpConfig, emptyIcpForm, emptyIcpLines, icpTouched, slugKey } from './product-icp-draft'
import { emptyProductForm, toPayload, validateProductForm } from './product-form'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
const offer = { offer_id: 'MY-01', name: 'Payroll Cloud', what_it_does: 'Monthly payroll and compliance' }

// RE-POINTED (S15 WPD2, 23 Nov 2026): the retired Portfolio dialog (product-form-dialog.tsx) is replaced by the one form drawer: its About section
// (product-form-about.tsx) carries the Portfolio's fields under their live words, its ICP section the three ideal customers.
describe('Add Product form: all original fields, one form', () => {
  const about = read('components/domain/portfolio/product-form-about.tsx')
  const drawer = read('components/domain/portfolio/product-form-drawer.tsx')

  it('has every one of the 15 product fields', () => {
    // The old words and the live ones: Category is Product, Status is Readiness, Product ID is ID, Description is What it does.
    for (const label of ['Product', 'ID', 'Name', 'Readiness', 'What it does', 'Features and capabilities', 'Customer problems solved', 'Benefits and proof', 'Pricing model', 'Typical deal size', 'Deployment', 'Delivery owner', 'Notes']) assert.ok(about.includes(`label="${label}"`), label)
    assert.ok(about.includes('legend="Target customers"'))
    assert.ok(about.includes('legend="Buying events it responds to"'))
    assert.ok(about.includes('Other target customer, then Add'))
    assert.ok(about.includes('Other buying event, then Add'))
  })

  it('is one form again (no steps), with the Individual ICP below the product details', () => {
    assert.doesNotMatch(drawer, /WIZARD_STEPS|STEP_FIELDS|setStep/)
    // One drawer, three sections in this order: the product details, then Sell in CRM, then the ideal customer.
    const at = (id: string) => drawer.indexOf(`{ id: '${id}', label:`)
    assert.ok(at('about') > 0 && at('about') < at('sell') && at('sell') < at('icp'))
    assert.ok(drawer.indexOf('<AboutSection') < drawer.indexOf('<IcpSection'))
    assert.match(read('components/domain/portfolio/product-icp-section.tsx'), /Individual Ideal Customer Profile \(ICP\)/)
  })

  it('requires the four required fields, and nothing else', () => {
    const e = validateProductForm(emptyProductForm(), 'create')
    assert.deepEqual(Object.keys(e).sort(), ['name', 'offer_id', 'parent_product', 'readiness_status'])
    assert.equal(toPayload({ ...emptyProductForm(), offer_id: 'MY-01', name: 'X', parent_product: 'EB', readiness_status: 'Prototype' }, 'create').pricing_model, null, 'no price is invented')
  })

  it('takes the dropdown options from the server taxonomy, not from hard-coded lists', () => {
    // The Products are the server's own list (`choices`, from the Product record API) and the readiness words the server accepts (`readinessCodes`), not `taxonomy.parent_products`.
    assert.match(about, /choices\.filter\(/)
    assert.match(about, /readinessCodes/)
    assert.match(about, /taxonomy\?\.readiness_statuses/)
    assert.match(about, /taxonomy\?\.deployment_models/)
    assert.match(about, /taxonomy\?\.segments/)
    assert.match(about, /taxonomy\?\.signal_families/)
  })
})

describe('Individual ICP of a product', () => {
  it('an untouched ICP section creates nothing', () => {
    assert.equal(icpTouched(emptyIcpForm(), emptyIcpLines()), false)
    assert.equal(icpTouched({ ...emptyIcpForm(), label: 'x' }, emptyIcpLines()), true)
  })

  it('is linked to this product only and carries its own part, triggers, searches and exclusions', () => {
    const form = { ...emptyIcpForm(), label: 'Payroll for SMEs', industry_label: 'small manufacturers', buyer_types: 'manufacturer', regions: 'Gujarat' }
    const c = buildIcpConfig(form, { ...emptyIcpLines(), triggers: 'new plant opened', queries: 'manufacturer announces new plant', exclusions: 'trading company', freshness: '60' }, offer)
    assert.deepEqual(c.offer_ids, ['MY-01'])
    assert.deepEqual(Object.keys(c.parts ?? {}), ['my_01'])
    assert.equal(c.parts?.my_01, 'Monthly payroll and compliance')
    const t = Object.values(c.triggers ?? {})[0]
    assert.equal(t.part, 'my_01')
    assert.equal(t.decay, 60)
    assert.equal(c.queries?.[0].q, 'manufacturer announces new plant')
    assert.deepEqual(c.disqualifiers, [{ label: 'trading company', phrases: ['trading company'] }])
    assert.deepEqual(c.regions, ['Gujarat'])
  })

  it('invents nothing: blank boxes give no triggers, searches or exclusions, and a blank freshness means "until closing date"', () => {
    const c = buildIcpConfig({ ...emptyIcpForm(), label: 'L' }, emptyIcpLines(), offer)
    assert.deepEqual(c.triggers, {})
    assert.deepEqual(c.queries, [])
    assert.deepEqual(c.disqualifiers, [])
    const withTrigger = buildIcpConfig({ ...emptyIcpForm(), label: 'L' }, { ...emptyIcpLines(), triggers: 'a tender' }, offer)
    assert.equal(Object.values(withTrigger.triggers ?? {})[0].decay, null)
  })

  it('makes valid product keys from product ids', () => {
    assert.equal(slugKey('MY-01'), 'my_01')
    assert.equal(slugKey('01-ABC'), 'p_01_abc')
    // the server wants 3 to 20 characters starting with a letter: a short ID such as P3 must still make a valid key
    for (const id of ['P3', 'P1', 'A', '7', 'X-', 'G2G-01', 'EB-1']) assert.match(slugKey(id), /^[a-z][a-z0-9_]{2,19}$/, id)
    assert.equal(slugKey('P3'), 'prod_p3')
    assert.ok(slugKey('A very long product identifier here').length <= 20)
  })

  it('saves the sub-product with its individual ICP directly and never creates a top-level product in the master product list', () => {
    const src = read('components/domain/portfolio/product-form-drawer.tsx')
    assert.match(src, /productRecordService\.(create|update)\(/)
    assert.match(src, /icp: Object\.keys\(built\.configs\)\.length > 0 \? built\.configs : undefined/)
    assert.doesNotMatch(src, /productIcpService\.createProduct/)
    assert.doesNotMatch(src, /localStorage|sessionStorage/)
  })
})
