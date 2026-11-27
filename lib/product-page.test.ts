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

  // RE-POINTED (S15 WPD2, 23 Nov 2026): the "Select Product" dropdown of the retired portfolio-view.tsx is the Product filter of the unified list's toolbar.
  it('the portfolio has a product dropdown and no product-level ICP badge or Edit ICP button', () => {
    const toolbar = read('components/domain/portfolio/portfolio-list-toolbar.tsx')
    assert.match(toolbar, /<Facet label="Product"[^>]*choices=\{productChoices\(/)
    for (const file of ['portfolio-list.tsx', 'portfolio-list-table.tsx', 'portfolio-list-toolbar.tsx', 'portfolio-more-menu.tsx']) {
      assert.doesNotMatch(read(`components/domain/portfolio/${file}`), /icpHref|IcpStatusBadge|Edit ICP|View ICP/, file)
    }
  })

  it('an unknown key shows a not-found state, not an error', () => {
    assert.match(read('components/domain/portfolio/product-detail-view.tsx'), /title="Product not found"/)
  })

  it('the page has no ICP tab or editor (a product has no ICP of its own) and shows every stored offer detail', () => {
    const detail = read('components/domain/portfolio/product-detail-view.tsx')
    assert.doesNotMatch(detail, /ProductIcpEditor|panel-icp|key: 'icp'|show\('icp'\)/)
    // Owner, 27 Nov 2026: the Product page does not say "N of M sub-products have an ICP" (header or summary card). The setup steps keep their own sentence for the partial case.
    assert.doesNotMatch(detail, /SubProductIcpBadge|icp-status-badge/)
    const panel = read('components/domain/portfolio/product-profile-panel.tsx')
    assert.doesNotMatch(panel, /SubProductIcpBadge|icp-status-badge/)
    for (const f of ['Features and capabilities', 'Customer problems solved', 'Target customers', 'Buying events', 'Benefits and proof', 'Pricing model', 'Typical deal size', 'Delivery owner', 'Notes']) assert.ok(panel.includes(f), f)
    assert.match(panel, /portfolioService\.getOffer/)
  })
})
