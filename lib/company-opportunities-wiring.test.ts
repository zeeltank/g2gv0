/**
 * The wiring of Company opportunities that can be checked without a browser: the configuration link, the routes that must keep existing, and
 * the navigation (no separate ScholarClone tab, no "All products" in the run workflow).
 */
import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { configureHref } from './product-selection'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('Product Details & ICP link', () => {
  it('opens the existing Product Portfolio on the selected product', () => {
    assert.equal(configureHref('scholarclone'), '/portfolio?product=scholarclone')
    assert.equal(configureHref('enterprise_brain'), '/portfolio?product=enterprise_brain')
    assert.equal(configureHref('g2g'), '/portfolio?product=g2g')
  })

  it('points at a route that exists, and the portfolio reads ?product=', () => {
    assert.ok(existsSync(join(root, 'app/portfolio/page.tsx')))
    assert.match(read('components/domain/signals/product-selector.tsx'), /URLSearchParams\(window\.location\.search\)\.get\('product'\)/)
  })

  it('is what the Company opportunities screen links to, for the selected product only', () => {
    const src = read('components/domain/signals/company-opportunities.tsx')
    assert.match(src, /configureHref\(selected\.key\)/)
  })
})

describe('Routes and navigation', () => {
  it('keeps the four routes', () => {
    for (const r of ['signals', 'ingestion', 'portfolio', 'partners']) assert.ok(existsSync(join(root, `app/${r}/page.tsx`)), r)
  })

  it('/signals renders Company opportunities (so /signals?product=... keeps working)', () => {
    assert.match(read('components/domain/signals/signals-page-content.tsx'), /<CompanyOpportunities context=\{context\} \/>/)
    assert.match(read('app/signals/page.tsx'), /SignalsPageContent/)
  })

  it('keeps the hub tabs and has no separate ScholarClone tab', () => {
    const hub = read('components/domain/organization/department-management/signals-hub.tsx')
    for (const label of ['Company opportunities', 'Ingestion engine', 'Product Portfolio', 'Partner Network']) assert.ok(hub.includes(label), label)
    assert.equal(/ScholarClone signals|id: 'scholar'/i.test(hub), false)
  })

  it('offers no "All products" choice and never passes "all" to a run on the Company opportunities screen', () => {
    const screen = read('components/domain/signals/company-opportunities.tsx')
    assert.match(screen, /allowAll: false/)
    const dropdown = read('components/domain/signals/product-selector.tsx')
    assert.equal(/All products/.test(dropdown.slice(dropdown.indexOf('export function ProductDropdown'))), false)
  })

  it('keeps the secondary tools reachable under Advanced tools', () => {
    const tools = read('components/domain/signals/advanced-tools.tsx')
    for (const label of ['Providers', 'Report history', 'Company profile', 'Refresh', 'Advanced tools']) assert.ok(tools.includes(label), label)
    assert.match(read('components/domain/signals/company-opportunities.tsx'), /<AdvancedTools/)
  })

  it('does not enable automatic generation anywhere in the frontend', () => {
    const tools = read('components/domain/signals/advanced-tools.tsx')
    assert.match(tools, /Automatic daily generation is off/)
  })
})
