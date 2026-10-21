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

  it('starts research only from a click: the Generate Signals button, and Retry on a failed run', () => {
    assert.equal((screen.match(/run\.generate\(\)/g) ?? []).length, 2)
    assert.match(screen, /<ResearchProgress[^>]*onRetry=/)
    assert.match(screen, /Generate Signals/)
  })

  it('keeps the review actions on each signal', () => {
    const card = read('components/domain/signals/scholar-signals-view.tsx')
    for (const label of ['Mark reviewed', 'Contacted', 'Not relevant']) assert.ok(card.includes(label), label)
  })
})

describe('Premium workspace and honest forms', () => {
  it('wraps all four module pages and the hub in the scoped premium theme', () => {
    for (const page of ['signals', 'ingestion', 'portfolio', 'partners']) assert.match(read(`app/${page}/page.tsx`), /<PremiumPage>/, page)
    assert.match(read('components/domain/organization/department-management/signals-hub.tsx'), /g2g-premium/)
  })

  it('keeps the theme scoped to light mode and the signals modules, and respects reduced motion', () => {
    const css = read('app/globals.css')
    assert.match(css, /:root:not\(\.dark\) \.g2g-premium \{/)
    assert.match(css, /prefers-reduced-motion: reduce\)[\s\S]*\.g2g-premium/)
    assert.equal(/^\.g2g-premium[^{]*\{[^}]*--primary:/m.test(css), false, 'the primary colour is not redefined')
  })

  it('shows failures inline: no native alert() in the four modules', () => {
    for (const f of ['components/domain/portfolio/partners-view.tsx', 'components/domain/portfolio/portfolio-view.tsx', 'components/domain/signals/ingestion-engine-view.tsx', 'components/domain/signals/signal-list.tsx']) {
      assert.equal(/alert\(/.test(read(f)), false, f)
    }
  })

  it('starts a new partner blank: no random ID and no invented state, empanelment or margin', () => {
    const src = read('components/domain/portfolio/partners-view.tsx')
    assert.equal(/Math\.random\(\)/.test(src), false)
    const blank = src.slice(src.indexOf('const BLANK_PARTNER'), src.indexOf('export function PartnersView'))
    for (const invented of ['Delhi', 'GeM', 'Margin Share', 'State Government', 'L1/L2', 'referral_margin_pct']) assert.equal(blank.includes(invented), false, invented)
  })

  it('has one guided path from configuration to signals on the Product Portfolio', () => {
    assert.match(read('components/domain/portfolio/portfolio-view.tsx'), /<ProductSetupSteps/)
    assert.match(read('components/domain/portfolio/product-setup-steps.tsx'), /\/signals\?product=/)
  })

  it('gives the page header a dark-mode variant, so its light title text is never on the light wash', () => {
    const css = read('app/globals.css')
    assert.match(css, /\.dark \.g2g-premium \.premium-hero \{/)
    // the pastel gradient is only ever applied in light mode
    const light = css.indexOf(':root:not(.dark) .g2g-premium .premium-hero')
    assert.ok(light > 0)
    assert.equal(/(^|\n)\.g2g-premium \.premium-hero \{[^}]*gradient/.test(css), false)
  })

  // ── defects found by driving the screens in a real browser ──
  it('the Partner Type select has an explicit empty choice (a blank value must not look like "Regional SI")', () => {
    const src = read('components/domain/portfolio/partners-view.tsx')
    assert.match(src, /value=\{formData\.partner_type \?\? ''\}/)
    assert.match(src, /<option value="">Select a type…<\/option>/)
    assert.equal(/partner_type \|\| 'Regional SI'/.test(src), false)
  })

  it('the partner capacity field shows no invented number and allows 0, as the server does', () => {
    const src = read('components/domain/portfolio/partners-view.tsx')
    assert.equal(/max_concurrent_deals \?\? 5/.test(src), false)
    assert.match(src, /min="0"\s+value=\{formData\.max_concurrent_deals \?\? ''\}/)
  })

  it('double-submit guards are synchronous refs, because a state flag changes only on the next render', () => {
    const partners = read('components/domain/portfolio/partners-view.tsx')
    assert.match(partners, /savingRef\.current\) return/)
    assert.match(partners, /deletingRef\.current\) return/)
    assert.match(read('components/domain/signals/ingestion-engine-view.tsx'), /submittingRef\.current\) return/)
    const hub = read('components/domain/organization/department-management/ingestion-view.tsx')
    assert.match(hub, /busyRef\.current\) return/)
    assert.match(hub, /retryingRef\.current\) return/)
  })

  it('the partner "Try again" really reloads the filters and totals, not only the list', () => {
    const src = read('components/domain/portfolio/partners-view.tsx')
    assert.match(src, /const loadMeta = useCallback/)
    assert.match(src, /const handleRefresh = \(\) => \{[^}]*void loadMeta\(\)/)
  })
})

