import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import type { NavModule } from './gtg-navigation'
import { collapseSignalsNav, SIGNALS_TABS, visibleSignalsTabs } from './signals-nav'
import { isPickableDay, rangeText, recentDays, relativeLabel, shiftDay, todayIn } from './signal-dates'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

const tree = (): NavModule[] => [{
  id: '1', label: 'Sales & Marketing', short: 'S&M', accessLink: null,
  children: [
    { id: '10', label: 'Reports', accessLink: '/reports', children: [] },
    {
      id: '489', label: 'Signals', accessLink: null,
      children: SIGNALS_TABS.filter((t) => t.href !== '/signals').map((t, i) => ({ id: String(490 + i), label: t.label, accessLink: t.href, children: [] })),
    },
  ],
}]

describe('Signals sidebar', () => {
  it('shows only the Signals entry: its child rows are folded away and it links to /signals', () => {
    const r = collapseSignalsNav(tree())
    const signals = r.modules[0].children.find((c) => c.id === '489')!
    assert.deepEqual(signals.children, [])
    assert.equal(signals.accessLink, '/signals')
    assert.deepEqual(r.modules[0].children.find((c) => c.id === '10'), tree()[0].children[0], 'unrelated entries are untouched')
  })

  it('keeps every folded route resolvable to the Signals entry (breadcrumb and highlight) and does not mutate its input', () => {
    const input = tree()
    const r = collapseSignalsNav(input)
    for (const p of ['/ingestion', '/portfolio', '/partners']) assert.deepEqual(r.owners[p], { moduleId: '1', menuId: '489', submenuId: '489' }, p)
    assert.equal(input[0].children[1].children.length, 3)
  })

  it('shows all four app sections whether or not the server menu includes their rows', () => {
    assert.deepEqual(visibleSignalsTabs(null).map((t) => t.href), ['/signals', '/ingestion', '/portfolio', '/partners'])
    assert.deepEqual(visibleSignalsTabs(['/signals']).map((t) => t.href), ['/signals', '/ingestion', '/portfolio', '/partners'])
    const none = [{ id: '1', label: 'Reports', short: 'R', accessLink: '/reports', children: [] }] as NavModule[]
    assert.equal(collapseSignalsNav(none).tabs, null)
  })

  it('the four tabs go to the existing routes (nothing is a placeholder)', () => {
    assert.deepEqual(SIGNALS_TABS.map((t) => t.href), ['/signals', '/ingestion', '/portfolio', '/partners'])
    for (const [page, key] of [['app/ingestion/page.tsx', 'ingestion'], ['app/portfolio/page.tsx', 'portfolio'], ['app/partners/page.tsx', 'partners']]) assert.match(read(page), new RegExp(`<SignalsFrame active="${key}">`))
    assert.match(read('components/domain/signals/signals-page-content.tsx'), /<SignalsFrame active="opportunities">/)
  })


  it('folds Signal Inbox into Market Signals so Market Signals is a flat direct link to /signals with zero children', () => {
    const liveTree: NavModule[] = [{
      id: '199', label: 'Sales & Marketing Intelligence', short: 'S&M', accessLink: null,
      children: [
        { id: '442', label: 'Command Center', accessLink: '/module/crm/command-center', children: [] },
        {
          id: '489', label: 'Market Signals', accessLink: '/module/crm/signals',
          children: [
            { id: '501', label: 'Signal Inbox', accessLink: '/module/crm/marketing/signal-inbox', children: [] },
          ],
        },
        { id: '443', label: 'Prospecting', accessLink: '/module/crm/prospecting', children: [] },
      ],
    }]

    const res = collapseSignalsNav(liveTree)
    const marketSignals = res.modules[0].children.find((c) => c.id === '489')!
    assert.equal(marketSignals.label, 'Market Signals')
    assert.equal(marketSignals.accessLink, '/signals')
    assert.deepEqual(marketSignals.children, [])
    assert.deepEqual(res.owners['/signals'], { moduleId: '199', menuId: '489', submenuId: '489' })
    assert.deepEqual(res.owners['/module/crm/signals'], { moduleId: '199', menuId: '489', submenuId: '489' })
    assert.deepEqual(res.owners['/module/crm/marketing/signal-inbox'], { moduleId: '199', menuId: '489', submenuId: '489' })
    assert.equal(res.modules[0].children.some((c) => c.label === 'Signal Inbox'), false)
  })
})

describe('Signals dates', () => {
  it('uses the application\'s timezone, not the machine\'s, at the day boundary', () => {
    const instant = new Date('2026-10-26T20:30:00Z')   // 02:00 on the 27th in Asia/Kolkata, still the 26th in UTC
    assert.equal(todayIn('Asia/Kolkata', instant), '2026-10-27')
    assert.equal(todayIn('UTC', instant), '2026-10-26')
  })

  it('default view is today and the two days before it, across month and year ends', () => {
    assert.deepEqual(recentDays('2026-10-27'), ['2026-10-27', '2026-10-26', '2026-10-25'])
    assert.deepEqual(recentDays('2026-03-01'), ['2026-03-01', '2026-02-28', '2026-02-27'])
    assert.deepEqual(recentDays('2027-01-01'), ['2027-01-01', '2026-12-31', '2026-12-30'])
    assert.equal(shiftDay('2026-10-25', 0), '2026-10-25')
    assert.equal(relativeLabel('2026-10-27', '2026-10-27'), 'Today')
    assert.equal(relativeLabel('2026-10-26', '2026-10-27'), 'Yesterday')
    assert.equal(relativeLabel('2026-10-25', '2026-10-27'), null)
  })

  it('accepts only real, non-future days for the calendar', () => {
    assert.equal(isPickableDay('2026-10-01', '2026-10-27'), true)
    assert.equal(isPickableDay('2026-10-28', '2026-10-27'), false)
    assert.equal(isPickableDay('2026-02-31', '2026-10-27'), false)
    assert.equal(isPickableDay('', '2026-10-27'), false)
  })

  it('reports the real range of five per page and nothing when there are no signals', () => {
    assert.equal(rangeText(1, 5, 12), '1–5 of 12')
    assert.equal(rangeText(3, 5, 12), '11–12 of 12')
    assert.equal(rangeText(1, 5, 0), null)
  })

  it('the signal list asks the server for five per page, and resets to page one on a filter change', () => {
    const list = read('components/domain/signals/signal-list.tsx')
    assert.match(list, /SIGNALS_PER_PAGE = 5/)
    assert.match(list, /perPage: SIGNALS_PER_PAGE/)
    assert.match(list, /setPage\(1\); setData\(null\)/)
    const opps = read('components/domain/signals/company-opportunities.tsx')
    assert.match(opps, /void run\.generate\(c\.list\)/)
    assert.match(opps, /disabled=\{!selected \|\| run\.running \|\| !ready\}/)
    assert.doesNotMatch(opps, /useEffect\([^)]*generate/)
  })
})

describe('Run notice: not finished is not the same as nothing found', () => {
  it('says the research did not finish when the backend reports an incomplete run with no qualified signal', async () => {
    const { describeFinishedRun } = await import('./signal-run-notice')
    const run = { status: 'success', opportunities_qualified: 0, opportunities_new: 0, sources_found: 12, stage_message: null, error_message: null, stage_stats: { completion: 'incomplete', completion_reasons: ['ai_failed'], queries: { attempted: 5, succeeded: 5, with_results: 5, empty: 0, returned: 0, failed: 0 }, outcome: { updated: 0, unchanged_existing: 0 }, results: { returned: 0 }, pages: { fetched: 0 }, zero_reasons: [], next_action: 'Retry later.' } } as never
    const n = describeFinishedRun(run)
    assert.equal(n.tone, 'warning')
    assert.match(n.text, /did not finish/)
    assert.doesNotMatch(n.text, /no opportunity had enough evidence/)
  })

  it('still says no opportunity qualified when the run completed', async () => {
    const { describeFinishedRun } = await import('./signal-run-notice')
    const run = { status: 'success', opportunities_qualified: 0, opportunities_new: 0, sources_found: 12, stage_stats: { completion: 'completed_no_qualified', queries: { attempted: 5, succeeded: 5, with_results: 5, empty: 0, returned: 0, failed: 0 }, outcome: { updated: 0, unchanged_existing: 0 }, results: { returned: 0 }, pages: { fetched: 0 }, zero_reasons: [], next_action: '' } } as never
    assert.match(describeFinishedRun(run).text, /no opportunity had enough evidence/)
  })
})

describe('Generation shows what it will use, and snippet evidence is not called verified', () => {
  it('keeps the product and ICP selector concise and removes the configuration dump', () => {
    const opps = read('components/domain/signals/company-opportunities.tsx')
    assert.match(opps, /id="main-product-select"/)
    assert.match(opps, /id="sub-product-select"/)
    assert.match(opps, /id="icp-type-select"/)
    assert.doesNotMatch(opps, /ResearchContextNotice|What the research uses/)
  })

  it('says so when the quoted wording was seen only in a search snippet', async () => {
    const { summariseEvidence } = await import('./evidence-summary')
    const o = { assessment: { evidence: { quote_verified: false, read_as: 'search_snippet', source_published_at: '2026-10-20' } }, source_published_at: '2026-10-20' } as never
    const s = summariseEvidence(o)
    assert.ok(s.missing.some((m) => /snippet only/.test(m)))
    assert.ok(!s.verified.some((v) => /quoted wording was found/.test(v)))
  })
})
