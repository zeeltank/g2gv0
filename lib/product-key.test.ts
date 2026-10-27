import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { serverProblems, suggestKey, validateNewProduct } from './product-key'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('new product key', () => {
  it('suggests a valid key from the name', () => {
    assert.equal(suggestKey('Payroll Cloud'), 'payroll_cloud')
    assert.equal(suggestKey('  HR & Talent Suite 2  '), 'hr_talent_suite_2')
    assert.equal(suggestKey('A very long product name that goes on and on').length <= 20, true)
    assert.equal(suggestKey('123 Go'), 'go')
    assert.deepEqual(validateNewProduct(suggestKey('Payroll Cloud'), 'Payroll Cloud'), {})
  })

  it('refuses invalid keys, reserved words and bad names before asking the server', () => {
    for (const k of ['', 'ab', 'Has Space', '1abc', 'a-b-c', 'x'.repeat(21)]) assert.ok(validateNewProduct(k, 'Name').key, k)
    assert.ok(validateNewProduct('all', 'Name').key)
    assert.ok(validateNewProduct('fine_key', '').label)
    assert.ok(validateNewProduct('fine_key', 'x'.repeat(51)).label)
  })

  it('shows the server\'s reasons next to the right field', () => {
    const r = serverProblems({ key: ['already used by a built-in product'], label: ['another product already has this name'], general: ['Not available'] })
    assert.equal(r.fields.key, 'already used by a built-in product')
    assert.equal(r.fields.label, 'another product already has this name')
    assert.deepEqual(r.general, ['Not available'])
    assert.deepEqual(serverProblems(undefined), { fields: { key: undefined, label: undefined }, general: [] })
  })
})

describe('New Product and the opportunity comparison are separate from what existed', () => {
  const view = read('components/domain/portfolio/portfolio-view.tsx')
  const dialog = read('components/domain/portfolio/new-product-dialog.tsx')

  it('New Product is its own admin-only action and Add Product still adds an offer', () => {
    assert.match(view, /setNewProductOpen\(true\)/)
    assert.match(view, /\{isAdmin && \(\s*<Button size="sm" onClick=\{\(\) => setNewProductOpen\(true\)\}/)
    assert.match(view, /Add Product/)
    assert.match(view, /onClick=\{\(\) => setCreateOpen\(true\)\}/)
    assert.match(view, /<NewProductDialog/)
  })

  it('creating a product calls only the product-creation API and then opens that product\'s ICP', () => {
    assert.match(dialog, /productIcpService\.createProduct/)
    assert.doesNotMatch(dialog, /portfolioService/)
    assert.match(view, /router\.push\(icpHref\(key\)\)/)
  })

  it('the signal card offers the comparison, which only reads', () => {
    const card = read('components/domain/signals/scholar-signals-view.tsx')
    const panel = read('components/domain/signals/opportunity-icp-comparison.tsx')
    assert.match(card, /<OpportunityIcpComparison opportunityId=\{o\.id\} \/>/)
    assert.match(panel, /opportunitiesService\.getIcpComparison/)
    assert.doesNotMatch(panel, /\.act\(|promoteToCrm|post\(|put\(|patch\(/)
    assert.match(panel, /None stored/)
  })
})
