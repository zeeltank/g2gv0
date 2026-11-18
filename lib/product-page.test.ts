import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { configureHref, offersHref } from './product-selection'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('Product page routes', () => {
  it('every built-in product (and any key) has a sub-products link that points at the dynamic route that exists', () => {
    assert.ok(existsSync(join(root, 'app/portfolio/[product]/page.tsx')))
    for (const key of ['scholarclone', 'enterprise_brain', 'g2g']) {
      assert.equal(configureHref(key), `/portfolio/${key}`)
      assert.equal(offersHref(key), `/portfolio/${key}?tab=offers`)
    }
  })

  it('the portfolio has a product dropdown and no product-level ICP badge or Edit ICP button', () => {
    const view = read('components/domain/portfolio/portfolio-view.tsx')
    assert.match(view, /Select Product/)
    assert.doesNotMatch(view, /icpHref|IcpStatusBadge|Edit ICP|View ICP/)
  })

  it('an unknown key shows a not-found state, not an error', () => {
    assert.match(read('components/domain/portfolio/product-detail-view.tsx'), /title="Product not found"/)
  })

  it('the page has no ICP tab or editor (a product has no ICP of its own) and shows every stored offer detail', () => {
    const detail = read('components/domain/portfolio/product-detail-view.tsx')
    assert.doesNotMatch(detail, /ProductIcpEditor|panel-icp|key: 'icp'|show\('icp'\)/)
    assert.match(detail, /<SubProductIcpBadge product=\{product\} \/>/)
    const panel = read('components/domain/portfolio/product-profile-panel.tsx')
    for (const f of ['Features and capabilities', 'Customer problems solved', 'Target customers', 'Buying events', 'Benefits and proof', 'Pricing model', 'Typical deal size', 'Delivery owner', 'Notes']) assert.ok(panel.includes(f), f)
    assert.match(panel, /portfolioService\.getOffer/)
  })
})
