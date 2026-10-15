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

describe('One list and the research-date dropdown', () => {
  const screen = read('components/domain/signals/company-opportunities.tsx')
  const list = read('components/domain/signals/signal-list.tsx')

  it('has no Sales cards / Full detail toggle and shows one list', () => {
    assert.equal(/Sales cards|Full detail|LAYOUT_KEY|pickLayout/.test(screen), false)
    assert.match(screen, /<SignalList/)
    assert.equal(/ScholarSignalsView|<OpportunitiesView/.test(screen), false)
  })

  it('offers dates only: each option is the formatted date and nothing else', () => {
    assert.match(screen, /<option key=\{d\.date\} value=\{d\.date\}>\{formatRunDate\(d\.date\)\}<\/option>/)
    const dropdown = screen.slice(screen.indexOf('id="run-date"'), screen.indexOf('</select>'))
    assert.equal(/Success|status|partial/i.test(dropdown), false)
  })

  it('takes its dates from the backend history, not from the clock', () => {
    assert.match(screen, /getRunDates\(context, key\)/)
    assert.equal(/new Date\(|Date\.now\(/.test(screen), false)
  })

  it('choosing a date only reads: neither the date change nor the list can start research', () => {
    const onChange = screen.slice(screen.indexOf('id="run-date"'), screen.indexOf('</select>'))
    assert.equal(/generate|runResearch/.test(onChange), false)
    assert.equal(/runResearch|generateSignals|\.generate\(/.test(list), false)
    assert.match(list, /opportunitiesService\.list\(/)
  })

  it('has one place that starts research: the Generate Signals button', () => {
    assert.equal((screen.match(/run\.generate\(\)/g) ?? []).length, 1)
    assert.match(screen, /Generate Signals/)
  })

  it('keeps the review actions on each signal', () => {
    const card = read('components/domain/signals/scholar-signals-view.tsx')
    for (const label of ['Mark reviewed', 'Contacted', 'Not relevant']) assert.ok(card.includes(label), label)
  })
})

