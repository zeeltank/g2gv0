import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RegionSelector } from '../components/domain/signals/region-selector'
import { generateSignals } from './signals-generate'
import { addSelection, countryOptions, MAX_REGIONS, problemsWith, regionLabel, regionShortLabel, regionsPayload, removeSelection, type RegionSelection } from './region-scope'
import { describeFinishedRun } from './signal-run-notice'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('Region selection', () => {
  it('lists countries from the browser, not from a built-in short list', () => {
    const c = countryOptions()
    assert.ok(c.length > 150)
    for (const n of ['India', 'Germany', 'United States', 'Brazil']) assert.ok(c.some((x) => x.name === n), n)
  })

  it('accepts country only, country + state, and country + state + city, and labels them', () => {
    let l: RegionSelection[] = []
    for (const s of [{ country: 'India' }, { country: 'India', state: 'Gujarat' }, { country: 'India', state: 'Gujarat', city: 'Surat' }]) l = addSelection(l, s).list
    assert.equal(l.length, 3)
    assert.equal(regionLabel(l), 'India; Gujarat, India; Surat, Gujarat, India')
    assert.equal(regionShortLabel(l), 'India +2')
    assert.equal(regionShortLabel([l[2]]), 'Surat')
  })

  it('refuses a city without a state, a missing country, unusable text and a sixth place', () => {
    assert.ok(problemsWith({ country: 'India', city: 'Surat' }).some((p) => /needs its state/.test(p)))
    assert.ok(problemsWith({ country: '' }).length > 0)
    assert.ok(problemsWith({ country: 'India', state: '<b>x</b>' }).length > 0)
    let l: RegionSelection[] = []
    for (let i = 0; i < MAX_REGIONS; i++) l = addSelection(l, { country: 'India', state: `State${i}x` }).list
    assert.equal(l.length, MAX_REGIONS)
    assert.match(addSelection(l, { country: 'India', state: 'One more' }).problems[0], /at most/)
  })

  it('treats the same place typed twice as one and tidies spaces', () => {
    let l = addSelection([], { country: ' India ', state: 'Tamil   Nadu' }).list
    l = addSelection(l, { country: 'india', state: 'tamil nadu' }).list
    assert.equal(l.length, 1)
    assert.equal(l[0].state, 'Tamil Nadu')
  })

  it('removing the last place returns to All Regions', () => {
    const l = addSelection([], { country: 'India' }).list
    assert.equal(regionLabel(removeSelection(l, 0)), 'All Regions')
  })

  it('sends nothing for All Regions, so the existing request is unchanged, and the normalised places otherwise', () => {
    assert.deepEqual(regionsPayload([]), {})
    assert.deepEqual(regionsPayload([{ country: ' India ', state: 'Gujarat', city: '' }]), { regions: [{ country: 'India', state: 'Gujarat' }] })
  })
})

describe('Region reaches the generation request', () => {
  const products = [{ key: 'scholarclone', label: 'ScholarClone', ready: true, missing: [] as string[] }]
  const status = { product: { key: 'scholarclone', label: 'ScholarClone', ready: true, missing: [] as string[] }, requirements: { search_configured: true, ai_configured: true }, running: false }

  async function send(regions?: RegionSelection[]) {
    const calls: unknown[][] = []
    await generateSignals({
      context: {} as never, choice: 'scholarclone', products, running: false, regions,
      service: { getStatus: async () => ({ data: status }), runResearch: async (...a: unknown[]) => { calls.push(a); return { message: 'ok', data: { run_id: 1 } } } } as never,
    })
    return calls
  }

  it('passes the selected places with the product to the backend call', async () => {
    const regions = [{ country: 'India', state: 'Gujarat', city: 'Surat' }]
    const calls = await send(regions)
    assert.equal(calls.length, 1)
    assert.equal(calls[0][2], 'scholarclone')
    assert.deepEqual(calls[0][3], regions)
  })

  it('All Regions sends no places', async () => {
    const calls = await send([])
    assert.deepEqual(calls[0][3], [])
    assert.match(read('services/signals/opportunities.ts'), /regions && regions\.length > 0 \? \{ regions \} : \{\}/)
  })

  it('the screen resets the region when the product changes and sends it with Generate and Retry', () => {
    const s = read('components/domain/signals/company-opportunities.tsx')
    assert.match(s, /setPicked\(null\); setTotal\(null\); setRegions\(\[\]\)/)
    assert.match(s, /void run\.generate\(regions\)/)
    assert.match(s, /onRetry=\{\(\) => void run\.generate\(regions\)\}/)
    assert.match(s, /<RegionSelector value=\{regions\} onChange=\{setRegions\}/)
    assert.ok(s.indexOf('<ProductDropdown') < s.indexOf('<RegionSelector'), 'beside the product control')
  })
})

describe('Region display', () => {
  it('the control shows the current scope and All Regions by default', () => {
    assert.match(renderToStaticMarkup(createElement(RegionSelector, { value: [], onChange: () => {} })), /All Regions/)
    const h = renderToStaticMarkup(createElement(RegionSelector, { value: [{ country: 'India', state: 'Gujarat', city: 'Surat' }], onChange: () => {} }))
    assert.match(h, />Surat</)
    assert.match(h, /Surat, Gujarat, India/)
  })

  it('a finished run says which region it was limited to and how many candidates the source did not place there', () => {
    const run = { status: 'success', opportunities_qualified: 0, opportunities_new: 0, sources_found: 9, stage_stats: { completion: 'completed_no_qualified', region: { label: 'Surat, Gujarat, India', places: 1, confirmed: 0, unconfirmed: 0, outside: 3 }, queries: { attempted: 4, succeeded: 4, with_results: 4, empty: 0, returned: 0, failed: 0 }, outcome: { updated: 0, unchanged_existing: 0 }, results: { returned: 0 }, pages: { fetched: 0 }, zero_reasons: [], next_action: '' } } as never
    const n = describeFinishedRun(run)
    assert.match(n.text, /Limited to Surat, Gujarat, India/)
    assert.match(n.text, /3 candidates left out/)
    assert.match(n.text, /no opportunity had enough evidence/, 'fewer signals, not invented ones')
  })

  it('a signal shows what its source showed about the place', () => {
    assert.match(read('components/domain/signals/scholar-signals-view.tsx'), /Region not named in source/)
  })
})
