import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { CUSTOMER_MODELS, fromConfig, toConfig } from './icp-form'
import { emptyIcpForm } from './product-icp-draft'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('ICP customer type', () => {
  it('offers B2B, B2C and Both, each with a note about signals', () => {
    assert.deepEqual(CUSTOMER_MODELS.map((m) => m.value).sort(), ['b2b', 'b2c', 'both'])
    assert.ok(CUSTOMER_MODELS.every((m) => m.note.length > 20))
    assert.match(CUSTOMER_MODELS.find((m) => m.value === 'b2c')!.note, /not supported/)
  })

  it('is saved and read back, and left out of an ICP that never set it', () => {
    assert.equal(toConfig(fromConfig({ label: 'x', customer_model: 'both' }, '')).customer_model, 'both')
    assert.equal(fromConfig({ label: 'x' }, '').customer_model, '')
    assert.equal('customer_model' in toConfig(fromConfig({ label: 'x' }, '')), false, 'an existing ICP is saved exactly as before')
  })

  it('a new product ICP starts as B2B', () => {
    assert.equal(emptyIcpForm().customer_model, 'b2b')
  })

  it('both ICP forms show the choice', () => {
    assert.match(read('components/domain/portfolio/product-icp-section.tsx'), /Customer type/)
    assert.match(read('components/domain/portfolio/product-icp-editor.tsx'), /customer_model: e\.target\.value as CustomerModel/)
  })
})

describe('Ideal customer text has no short limit', () => {
  it('both ICP forms use a multi-line box with no maxLength on the ideal-customer field', () => {
    const section = read('components/domain/portfolio/product-icp-section.tsx')
    const editor = read('components/domain/portfolio/product-icp-editor.tsx')
    assert.match(section, /<Textarea id="icp-ideal"[^>]*value=\{form\.industry_label\}(?![^>]*maxLength)/)
    assert.match(editor, /<Textarea value=\{form\.industry_label\}(?![^>]*maxLength)/)
  })
})

describe('Add product: the ICP is checked before the product is saved', () => {
  it('checks the ICP on the server first and stops with the problems, saving nothing', () => {
    const s = read('components/domain/portfolio/product-form-dialog.tsx')
    assert.ok(s.indexOf('productIcpService.checkConfig') > 0)
    assert.ok(s.indexOf('productIcpService.checkConfig') < s.indexOf('portfolioService.createOffer'), 'the check comes before the product is created')
    assert.match(s, /Fix the Individual ICP section\. Nothing was saved\./)
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

  it('after the server creates the product, the ICP is saved under the key the server returned', () => {
    const s = read('components/domain/portfolio/product-form-dialog.tsx')
    assert.match(s, /key = made\.data\?\.product\?\.key \|\| key/)
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

describe('Add or edit product: nothing gets stuck half-way', () => {
  const s = read('components/domain/portfolio/product-form-dialog.tsx')
  it('uses a product that already exists instead of creating it twice, and shortens a long name for the card', () => {
    assert.match(s, /\(products \?\? \[\]\)\.some\(\(p\) => p\.key === key\)/)
    assert.match(s, /already have a product with this key\|this product already exists/)
    assert.match(s, /fitWords\(saved\.name, 50\)/)
  })
  it('says how to finish when the ICP step fails', () => {
    assert.match(s, /choose Edit ICP/)
  })
  it('guidance allows 1,500 characters in both forms', () => {
    assert.match(read('components/domain/portfolio/product-icp-section.tsx'), /maxLength=\{1500\}/)
    assert.match(read('components/domain/portfolio/product-icp-editor.tsx'), /maxLength=\{1500\}/)
  })
})
