/**
 * The fallback shown when a research date saved no signals: when it is looked for, what it says, and that it stays separate from the chosen day.
 * (No React test setup here, so the component is checked through its pure helpers and its source.)
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fallbackHeading, isOtherDay, wantsFallback } from './signal-fallback'
import { formatRunDate } from './run-dates'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const base = { itemCount: 0, search: '', view: 'all', status: '', loaded: true }

describe('wantsFallback', () => {
  it('is wanted on the plain view of a day with no signals', () => {
    assert.equal(wantsFallback(base), true)
  })

  it('is not wanted while the day is still loading, or when the day has signals', () => {
    assert.equal(wantsFallback({ ...base, loaded: false }), false)
    assert.equal(wantsFallback({ ...base, itemCount: 3 }), false)
  })

  it('is not wanted when a filter or search matched nothing: that is not an empty day', () => {
    assert.equal(wantsFallback({ ...base, search: 'podar' }), false)
    assert.equal(wantsFallback({ ...base, view: 'watchlist' }), false)
    assert.equal(wantsFallback({ ...base, status: 'New' }), false)
  })
})

describe('fallback wording and date', () => {
  it('names the actual original research date in the required sentence', () => {
    assert.equal(
      fallbackHeading(formatRunDate('2026-10-14')),
      'No new signals for this date. Showing previously generated signals from 14 Oct 2026.',
    )
  })

  it('only treats another day as a fallback, never the chosen day itself or nothing', () => {
    assert.equal(isOtherDay('2026-10-14', '2026-10-16'), true)
    assert.equal(isOtherDay('2026-10-16', '2026-10-16'), false)
    assert.equal(isOtherDay(null, '2026-10-16'), false)
    assert.equal(isOtherDay(undefined, '2026-10-16'), false)
  })
})

describe('fallback wiring', () => {
  const list = read('components/domain/signals/signal-list.tsx')
  const fb = read('components/domain/signals/fallback-signals.tsx')
  const service = read('services/signals/opportunities.ts')

  it('replaces the old "no qualified signals" message, keeping a setup state only when nothing was ever saved', () => {
    assert.doesNotMatch(list, /No qualified signals on this date/)
    assert.match(list, /<FallbackSignals/)
    assert.match(list, /No saved \$\{productLabel\} signals yet/)
  })

  it('reads stored rows only: it asks for the latest saved day and never starts research', () => {
    assert.match(fb, /latestSaved: true/)
    assert.doesNotMatch(fb, /runResearch|useGenerateSignals|\.generate\(/)
    assert.match(service, /params\.latest_saved = '1'/)
  })

  it('is a separate, labelled section that keeps each card\'s own research date and is not counted for the chosen day', () => {
    assert.match(fb, /data-testid="fallback-signals"/)
    assert.match(fb, /runDateLabel=\{o\.report_date \? formatRunDate\(o\.report_date\) : null\}/)
    assert.match(fb, /These are not new for/)
    assert.doesNotMatch(fb, /onTotal/)
  })

  it('shows nothing of the fallback when the answer is the chosen day itself or empty', () => {
    assert.match(fb, /!isOtherDay\(original, chosenDate\) \|\| data\.data\.length === 0/)
  })
})
