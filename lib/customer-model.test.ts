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
