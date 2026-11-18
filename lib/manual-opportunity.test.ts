import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { emptyManualForm, toManualPayload, validateManual, viewAfterManualSave, type ManualForm } from './manual-opportunity'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10))

const good = (over: Partial<ManualForm> = {}): ManualForm => ({
  ...emptyManualForm(), company_name: 'Acme Plastics', summary: 'Opening a second plant and hiring a plant IT head.', source_url: 'https://www.linkedin.com/posts/acme-1', ...over,
})

describe('Adding an opportunity by hand: the form rules', () => {
  it('a complete form has no problems and the optional fields can be left empty', () => {
    assert.deepEqual(validateManual(good(), '2026-11-02'), {})
  })

  it('the company, the story and a real web link are required', () => {
    const e = validateManual(emptyManualForm(), '2026-11-02')
    assert.deepEqual(Object.keys(e).sort(), ['company_name', 'source_url', 'summary'])
    assert.ok(validateManual(good({ source_url: 'linkedin' }), null).source_url)
    assert.ok(validateManual(good({ source_url: 'ftp://x.example.com/a' }), null).source_url)
    assert.ok(validateManual(good({ website: 'acme' }), null).website)
  })

  it('the post date is optional, must be a real date, and cannot be in the future', () => {
    assert.equal(validateManual(good({ source_published_at: '2026-09-01' }), '2026-11-02').source_published_at, undefined, 'an older post is fine')
    assert.equal(validateManual(good({ source_published_at: '2026-11-02' }), '2026-11-02').source_published_at, undefined, 'a post from today is fine')
    assert.ok(validateManual(good({ source_published_at: '2026-11-03' }), '2026-11-02').source_published_at)
    assert.ok(validateManual(good({ source_published_at: '2026-13-45' }), '2026-11-02').source_published_at)
  })
})

describe('The request keeps the saved day and the post date apart', () => {
  const scope = { productKey: 'enterprise_brain', offerId: 'EB-01', customerModel: 'b2g' as const }

  it('sends the product, sub-product and customer type the screen is on, trimmed, and leaves empty optional fields out', () => {
    const p = toManualPayload(good({ company_name: '  Acme Plastics  ', contact: '  ' }), scope)
    assert.equal(p.company_name, 'Acme Plastics')
    assert.deepEqual([p.product, p.offer_id, p.customer_model], ['enterprise_brain', 'EB-01', 'b2g'])
    assert.equal('contact' in p, false)
    assert.equal('offer_id' in toManualPayload(good(), { ...scope, offerId: null }), false)
  })

  it('carries the post date only as source_published_at and can never carry a saved-on date', () => {
    const p = toManualPayload(good({ source_published_at: '2026-09-01' }), scope) as Record<string, unknown>
    assert.equal(p.source_published_at, '2026-09-01')
    for (const k of ['created_at', 'first_discovered_at', 'observed_at', 'event_date', 'report_date', 'captured_on']) {
      assert.equal(k in p, false, `${k} is the server's to decide`)
    }
    assert.equal('source_published_at' in toManualPayload(good(), scope), false, 'no post date typed: none sent')
  })
})

describe('After a save the screen shows the day it was saved', () => {
  it('a day the person was looking at is replaced by the day of the save, so the new record is visible', () => {
    assert.deepEqual(viewAfterManualSave({ picked: '2026-10-20', allSignals: false }, '2026-11-02'), { picked: '2026-11-02', allSignals: false })
    assert.deepEqual(viewAfterManualSave({ picked: null, allSignals: false }, '2026-11-02'), { picked: '2026-11-02', allSignals: false })
  })

  it('the same day stays, and All Signals stays All Signals (the record is in it anyway)', () => {
    assert.deepEqual(viewAfterManualSave({ picked: '2026-11-02', allSignals: false }, '2026-11-02'), { picked: '2026-11-02', allSignals: false })
    assert.deepEqual(viewAfterManualSave({ picked: null, allSignals: true }, '2026-11-02'), { picked: null, allSignals: true })
  })
})

describe('Wiring on the existing screen', () => {
  const screen = read('components/domain/signals/company-opportunities.tsx')

  it('the button sits in the existing filter row, and no page, route or navigation was added', () => {
    assert.match(screen, /Add Opportunity Manually/)
    assert.ok(screen.indexOf('All Signals\n            </Button>') < screen.indexOf('Add Opportunity Manually'), 'beside the date and All Signals controls')
    assert.ok(read('services/signals/opportunities.ts').includes('apiClient.post<ManualOpportunityResponse>(`/signals/opportunities/manual?'), 'one existing-style API call, to the one new route')
  })

  it('a save closes the form, drops the single-run view, re-reads the list and the days without a reload, and says where it is listed', () => {
    const handler = screen.slice(screen.indexOf('const manualSaved'), screen.indexOf('const manualSaved') + 900)
    assert.match(handler, /setManualOpen\(false\)/)
    assert.match(handler, /setViewRunId\(null\)/)
    assert.match(handler, /viewAfterManualSave\(\{ picked, allSignals \}, res\.data\.captured_on\)/)
    assert.match(handler, /run\.refresh\(\)/)
    assert.match(handler, /is listed under \$\{formatRunDate\(res\.data\.captured_on\)\}/)
  })

  it('a manual day is a day the date list can show (it has no research run)', () => {
    assert.match(read('services/signals/opportunities.ts'), /'success' \| 'partial' \| 'manual'/)
  })
})
