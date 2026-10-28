/**
 * The wiring of Company opportunities that can be checked without a browser: the configuration link, the routes that must keep existing, and
 * the navigation (no separate ScholarClone tab, no "All products" in the run workflow).
 */
import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { configureHref, icpHref, icpStatus, resolveTab } from './product-selection'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('Product Details & ICP link', () => {
  it('opens that one product\'s own page, not the whole Product Portfolio', () => {
    assert.equal(configureHref('scholarclone'), '/portfolio/scholarclone')
    assert.equal(configureHref('enterprise_brain'), '/portfolio/enterprise_brain')
    assert.equal(configureHref('g2g'), '/portfolio/g2g')
  })

  it('points at a route that exists, and the old ?product= link still lands on that product', () => {
    assert.ok(existsSync(join(root, 'app/portfolio/[product]/page.tsx')))
    assert.ok(existsSync(join(root, 'app/portfolio/page.tsx')))
    assert.match(read('components/domain/portfolio/portfolio-view.tsx'), /router\.replace\(configureHref\(linked\)\)/)
  })

  it('has an ICP link that opens the ICP tab, and falls back to the overview for an unknown tab', () => {
    assert.equal(icpHref('g2g'), '/portfolio/g2g?tab=icp')
    assert.equal(resolveTab('icp'), 'icp')
    assert.equal(resolveTab('nonsense'), 'overview')
    assert.equal(resolveTab(null), 'overview')
  })

  it('reads the ICP status only from the stored state', () => {
    assert.equal(icpStatus({ state: 'ready', draft_icp: null }).key, 'ready')
    assert.equal(icpStatus({ state: 'needs_setup', draft_icp: { id: 1 } }).key, 'draft')
    assert.equal(icpStatus({ state: 'needs_setup', draft_icp: null }).key, 'incomplete')
    assert.equal(icpStatus({ state: 'invalid', draft_icp: null }).key, 'invalid')
  })

  it('is what the Company opportunities screen links to, for the selected product only', () => {
    const src = read('components/domain/signals/company-opportunities.tsx')
    assert.match(src, /icpHref\(selected\.key\)/)
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

  // The former "keeps the hub tabs and has no separate ScholarClone tab" test lived here,
  // reading the department-local signals-hub.tsx. Sales & Marketing merge, Phase 5 retired
  // that file (it destructured `department` and never used it - the same unscoped feed on
  // every department's page); its 4 tabs already have their own real top-level routes,
  // covered by "keeps the four routes" above, and this file's actual per-department signals
  // now come from DepartmentSignalsPanel, outside this test's scope.

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

describe('One list and the research-date selector', () => {
  const screen = read('components/domain/signals/company-opportunities.tsx')
  const list = read('components/domain/signals/signal-list.tsx')

  it('has no Sales cards / Full detail toggle and shows one list', () => {
    assert.equal(/Sales cards|Full detail|LAYOUT_KEY|pickLayout/.test(screen), false)
    assert.match(screen, /<SignalList/)
    assert.equal(/ScholarSignalsView|<OpportunitiesView/.test(screen), false)
  })

  it('offers dates via a 3-day radiogroup and a date picker', () => {
    assert.match(screen, /role="radiogroup" aria-label="Signal date"/)
    assert.match(screen, /type="date"/)
    assert.match(screen, /Back to the last 3 days/)
    assert.match(screen, /formatRunDate\(d\)/)
  })

  it('takes its dates from the backend history, not from the clock', () => {
    assert.match(screen, /getRunDates\(context, key\)/)
    assert.equal(/new Date\(|Date\.now\(/.test(screen), false)
  })

  it('choosing a date only reads: neither the date change nor the list can start research', () => {
    const pickFn = screen.slice(screen.indexOf('const pick ='), screen.indexOf('return ('))
    assert.equal(/generate|runResearch/.test(pickFn), false)
    assert.equal(/runResearch|generateSignals|\.generate\(/.test(list), false)
    assert.match(list, /opportunitiesService\.list\(/)
  })

  it('starts research only from a click: the Generate Signals button, and Retry on a failed run', () => {
    assert.equal((screen.match(/run\.generate\(/g) ?? []).length, 1)   // one function starts a run; the Generate and Retry buttons only call it
    assert.match(screen, /onClick=\{generate\}/)
    assert.match(screen, /<ResearchProgress[^>]*onRetry=/)
    assert.match(screen, /Generate Signals/)
  })

  it('keeps the review actions on each signal', () => {
    const card = read('components/domain/signals/scholar-signals-view.tsx')
    for (const label of ['Mark reviewed', 'Contacted', 'Not relevant']) assert.ok(card.includes(label), label)
  })
})

describe('Premium workspace and honest forms', () => {
  it('wraps all four module pages in the scoped premium theme', () => {
    for (const page of ['signals', 'ingestion', 'portfolio', 'partners']) assert.match(read(`app/${page}/page.tsx`), /<PremiumPage>/, page)
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
    assert.match(read('components/domain/portfolio/product-detail-view.tsx'), /<ProductSetupSteps/)
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
    // The department-local ingestion-view.tsx this also checked is retired (Sales & Marketing
    // merge, Phase 5) - its guards aren't tested here any more because the file is gone, not
    // because the pattern stopped mattering.
  })

  it('the partner "Try again" really reloads the filters and totals, not only the list', () => {
    const src = read('components/domain/portfolio/partners-view.tsx')
    assert.match(src, /const loadMeta = useCallback/)
    assert.match(src, /const handleRefresh = \(\) => \{[^}]*void loadMeta\(\)/)
  })
})

