import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { configureHref, icpHref } from './product-selection'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('Product page routes', () => {
  it('every built-in product (and any key) has an ICP link that points at the dynamic route that exists', () => {
    assert.ok(existsSync(join(root, 'app/portfolio/[product]/page.tsx')))
    for (const key of ['scholarclone', 'enterprise_brain', 'g2g']) {
      assert.equal(configureHref(key), `/portfolio/${key}`)
      assert.equal(icpHref(key), `/portfolio/${key}?tab=icp`)
    }
  })

  it('the portfolio cards open View details and Edit ICP on that product\'s page', () => {
    const view = read('components/domain/portfolio/portfolio-view.tsx')
    assert.match(view, /href=\{configureHref\(p\.key\)\}/)
    assert.match(view, /href=\{icpHref\(p\.key\)\}/)
  })

  it('an unknown key shows a not-found state, not an error', () => {
    assert.match(read('components/domain/portfolio/product-detail-view.tsx'), /title="Product not found"/)
  })

  it('the page loads the ICP of the product in the address and shows every stored offer detail', () => {
    const detail = read('components/domain/portfolio/product-detail-view.tsx')
    assert.match(detail, /productKey=\{product\.key\}/)
    const panel = read('components/domain/portfolio/product-profile-panel.tsx')
    for (const f of ['Features and capabilities', 'Customer problems solved', 'Target customers', 'Buying events', 'Benefits and proof', 'Pricing model', 'Typical deal size', 'Delivery owner', 'Notes']) assert.ok(panel.includes(f), f)
    assert.match(panel, /portfolioService\.getOffer/)
  })
})
