import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResearchContextView } from '../components/domain/signals/research-context-notice'
import { RegionSelector } from '../components/domain/signals/region-selector'
import { generateSignals } from './signals-generate'
import { commitPending, draftIsEmpty, emptyDraft, previewRegions, regionsPayload, type RegionSelection } from './region-scope'
import { describeFinishedRun, missingBreakdown } from './signal-run-notice'
import type { ResearchContext } from '../services/portfolio/types'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('A chosen country is used when Generate Signals is pressed, even without Add place', () => {
  it('commits a pending country into the places that are sent', () => {
    const c = commitPending([], { country: 'India', state: '', city: '' })
    assert.deepEqual(c.problems, [])
    assert.deepEqual(c.list, [{ country: 'India' }])
    assert.deepEqual(regionsPayload(c.list), { regions: [{ country: 'India' }] })
  })

  it('sends the pending place together with the ones already added (multi-region is kept)', () => {
    const added: RegionSelection[] = [{ country: 'India', state: 'Kerala' }]
    assert.deepEqual(commitPending(added, { country: 'India', state: 'Goa', city: '' }).list, [{ country: 'India', state: 'Kerala' }, { country: 'India', state: 'Goa' }])
  })

  it('an empty draft changes nothing, so All Regions stays All Regions and the request is unchanged', () => {
    assert.ok(draftIsEmpty(emptyDraft()))
    const c = commitPending([], emptyDraft())
    assert.deepEqual(c, { list: [], problems: [] })
    assert.deepEqual(regionsPayload(c.list), {})
  })

  it('an unusable draft stops the run with a reason and is never turned into another region', () => {
    const noState = commitPending([], { country: 'India', state: '', city: 'Surat' })
    assert.deepEqual(noState.list, [])
    assert.match(noState.problems.join(' '), /needs its state/)
    const noCountry = commitPending([{ country: 'India' }], { country: '', state: 'Gujarat', city: '' })
    assert.deepEqual(noCountry.list, [{ country: 'India' }], 'the added places are not touched')
    assert.ok(noCountry.problems.length > 0)
    assert.deepEqual(previewRegions([], { country: 'India', state: '', city: 'Surat' }), [], 'the preview leaves an unusable draft out')
  })

  it('stale state and city are cleared when the country changes, and a city is cleared when its state is emptied', () => {
    const src = read('components/domain/signals/region-selector.tsx')
    assert.match(src, /const setCountry = \(v: string\) => onDraft\(\{ country: v, state: '', city: '' \}\)/)
    assert.match(src, /city: v\.trim\(\) === '' \? '' : draft\.city/)
    assert.match(src, /onDraft\(emptyDraft\(\)\)/, 'the draft is cleared after Add place')
    const screen = read('components/domain/signals/company-opportunities.tsx')
    assert.match(screen, /setRegions\(\[\]\); setDraft\(emptyDraft\(\)\); setRegionProblems\(\[\]\)/, 'a product change starts clean')
  })

  it('the request carries the committed country to the backend call, and the pending-but-not-added state is visible on the control', async () => {
    const calls: unknown[][] = []
    const products = [{ key: 'scholarclone', label: 'ScholarClone', ready: true, missing: [] as string[] }]
    const status = { product: { key: 'scholarclone', label: 'ScholarClone', ready: true, missing: [] as string[] }, requirements: { search_configured: true, ai_configured: true }, running: false }
    const committed = commitPending([], { country: 'India', state: '', city: '' }).list
    await generateSignals({
      context: {} as never, choice: 'scholarclone', products, running: false, regions: committed,
      service: { getStatus: async () => ({ data: status }), runResearch: async (...a: unknown[]) => { calls.push(a); return { message: 'ok', data: { run_id: 1 } } } } as never,
    })
    assert.deepEqual(calls[0][3], [{ country: 'India' }])
    const h = renderToStaticMarkup(createElement(RegionSelector, { value: [], onChange: () => {}, draft: { country: 'India', state: '', city: '' }, onDraft: () => {} }))
    assert.match(h, /India<\/span>\s*\(not added\)|India \(not added\)|\(not added\)/)
  })

  it('Generate and Retry both go through the one function that commits the draft and blocks on an unusable one', () => {
    const s = read('components/domain/signals/company-opportunities.tsx')
    assert.match(s, /const c = commitPending\(regions, draft\)/)
    assert.match(s, /if \(c\.problems\.length > 0\) \{ setRegionProblems\(c\.problems\); return \}/)
    assert.equal((s.match(/run\.generate\(/g) ?? []).length, 1)
  })
})

describe('The pre-run notice separates this run\'s region from the saved ICP regions', () => {
  const base = (region: ResearchContext['region']): ResearchContext => ({
    product: { key: 'scholarclone', label: 'ScholarClone', custom: false },
    icp: { source: 'template', profile_id: null, name: 'ScholarClone K-12 Bundle', version: 1, regions: ['Gujarat', 'Maharashtra'], saved: false },
    product_fields: [], icp_fields: [], kept_for_people: [], offer_count: 8, warnings: [], region,
  })
  const html = (r: ResearchContext['region']) => renderToStaticMarkup(createElement(ResearchContextView, { data: base(r) }))

  it('a chosen region is shown as the run\'s region, and the saved regions are not presented as the selection', () => {
    const h = html({ source: 'request', label: 'India', places: 1, saved_regions: ['Gujarat', 'Maharashtra'], note: '' })
    assert.match(h, /Region for this run: India \(your selection\)/)
    assert.match(h, /instead of the ICP&#x27;s saved regions \(Gujarat, Maharashtra\)/)
    assert.match(h, /data-region-source="request"/)
    assert.doesNotMatch(h.replace(/instead of[^<]*/, ''), /regions: Gujarat/, 'the first line no longer lists the saved regions as if they were the selection')
  })

  it('with no region chosen it says the saved ICP regions apply as the default', () => {
    const h = html({ source: 'saved ICP', label: 'Gujarat, Maharashtra', places: 2, saved_regions: ['Gujarat', 'Maharashtra'], note: '' })
    assert.match(h, /none chosen\. The ICP&#x27;s saved regions apply as the default: Gujarat, Maharashtra/)
    assert.match(h, /data-region-source="saved ICP"/)
  })

  it('All Regions with nothing saved says the run is not limited to a place', () => {
    assert.match(html({ source: 'All Regions', label: 'All Regions', places: 0, saved_regions: [], note: '' }), /All Regions \(not limited to a place\)/)
  })

  it('the notice asks the backend about the places that will be sent', () => {
    const n = read('components/domain/signals/research-context-notice.tsx')
    assert.match(n, /getResearchContext\(context, productKey, regions\)/)
    assert.match(read('services/portfolio/portfolio-service.ts'), /regions: JSON\.stringify\(regions\)/)
    assert.match(read('components/domain/signals/company-opportunities.tsx'), /<ResearchContextNotice context=\{context\} productKey=\{selected\.key\} regions=\{effective\}/)
  })
})

describe('Run diagnostics are honest when the breakdown is missing', () => {
  const run = (over: Record<string, unknown>) => ({ status: 'partial', opportunities_qualified: 0, opportunities_new: 0, sources_found: 20, queries_run: 20, queries_failed: 11, stage_message: 'some searches failed', stage_stats: null, stage_stats_persisted: false, ...over }) as never

  it('a missing column is reported as a missing migration, with the counters that WERE recorded and the reasons that were not', () => {
    const t = describeFinishedRun(run({})).text
    assert.match(t, /could not be saved: this database does not have the stage_stats column/)
    assert.match(t, /add_stage_stats_to_g2g_research_runs/)
    assert.match(t, /20 searches \(11 failed\), 20 sources found/)
    assert.match(t, /Why a search failed, and why a candidate was left out, was not recorded/)
  })

  it('an older run is described as older, not as a failure to save', () => {
    const t = missingBreakdown(run({ stage_stats_persisted: true }))
    assert.match(t, /made before breakdowns were recorded/)
    assert.doesNotMatch(t, /migration/)
  })

  it('failure categories are shown only when the backend identified them', () => {
    const stats = { completion: 'completed', queries: { attempted: 20, succeeded: 9, with_results: 9, empty: 0, returned: 0, failed: 11 }, outcome: { updated: 0, unchanged_existing: 0 }, results: { returned: 20 }, pages: { fetched: 0 }, errors_by_stage: { search: { rate_limited: 7, timeout: 4 } }, zero_reasons: [], next_action: '' }
    assert.match(describeFinishedRun(run({ stage_stats: stats, stage_stats_persisted: true })).text, /Failed searches by recorded reason: rate limited 7, timeout 4\./)
    const none = describeFinishedRun(run({ stage_stats: { ...stats, errors_by_stage: {} }, stage_stats_persisted: true })).text
    assert.doesNotMatch(none, /by recorded reason/, 'no reason is invented')
  })
})
