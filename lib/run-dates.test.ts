import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { chooseRunDate, formatRunDate } from './run-dates'

describe('formatRunDate', () => {
  it('shows a day as day, short month, year and nothing else', () => {
    assert.equal(formatRunDate('2026-10-15'), '15 Oct 2026')
    assert.equal(formatRunDate('2026-01-05'), '5 Jan 2026')
    assert.equal(formatRunDate('2026-12-31'), '31 Dec 2026')
  })

  it('is not moved by the machine\'s timezone (it never builds a Date)', () => {
    const was = process.env.TZ
    for (const tz of ['Pacific/Kiritimati', 'Pacific/Honolulu', 'UTC']) {
      process.env.TZ = tz
      assert.equal(formatRunDate('2026-10-14'), '14 Oct 2026')
    }
    process.env.TZ = was
  })

  it('leaves a value that is not a day alone', () => {
    assert.equal(formatRunDate('soon'), 'soon')
    assert.equal(formatRunDate('2026-13-01'), '2026-13-01')
  })
})

describe('chooseRunDate', () => {
  const dates = [{ date: '2026-10-12' }, { date: '2026-10-15' }, { date: '2026-10-14' }]

  it('defaults to the newest date', () => {
    assert.equal(chooseRunDate(dates, null), '2026-10-15')
  })

  it('keeps the date the person chose while it still exists', () => {
    assert.equal(chooseRunDate(dates, '2026-10-12'), '2026-10-12')
  })

  it('falls back to the newest when the chosen date is gone (for example after switching product)', () => {
    assert.equal(chooseRunDate(dates, '2026-09-01'), '2026-10-15')
  })

  it('jumps to the newest right after a run finishes', () => {
    assert.equal(chooseRunDate(dates, '2026-10-12', true), '2026-10-15')
  })

  it('has no date when there is no successful run, and never makes one up', () => {
    assert.equal(chooseRunDate([], null), null)
    assert.equal(chooseRunDate([], '2026-10-15', true), null)
  })
})
