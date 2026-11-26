import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { health } from './fixtures'
import { healthLine } from './health'

const NOW = new Date('2026-11-26T10:00:00Z')

describe('the status strip', () => {
  it('says "Checked about every 10 minutes" and when it last checked, when the scheduler is running', () => {
    assert.deepEqual(healthLine(health(), NOW), { tone: 'info', text: 'Checked about every 10 minutes. Last check 3 minutes ago.' })
  })

  it('uses the interval the server expects', () => {
    assert.match(healthLine(health({ expected_every_minutes: 5, last_tick_at: null }), NOW).text, /^Checked about every 5 minutes\.$/)
  })

  it('says why automations wait once, in the server\'s words, when its reason already says so', () => {
    const line = healthLine(health({ state: 'stale', message: 'The scheduler has not run for 2 days, so automations wait.' }), NOW)
    assert.equal(line.tone, 'caution')
    assert.equal(line.text, 'The scheduler has not run for 2 days, so automations wait.')
  })

  it('says the scheduler is off, so automations wait, and adds a reason that does not say so itself', () => {
    const line = healthLine(health({ state: 'stale', message: 'The last check was on 15 October.' }), NOW)
    assert.equal(line.text, 'The scheduler is off, so automations wait. The last check was on 15 October.')
    assert.equal(healthLine(health({ state: 'stale', message: '' }), NOW).text, 'The scheduler is off, so automations wait.')
  })

  it('says "Not known" with a reason, and never "running", when it cannot tell', () => {
    const line = healthLine(health({ state: 'unknown', message: 'No record of the scheduler running was found.' }), NOW)
    assert.equal(line.text, 'Not known: No record of the scheduler running was found.')
    assert.ok(line.text.startsWith('Not known'), 'it does not say the scheduler is running')
    assert.match(healthLine(null, NOW).text, /^Not known: the scheduler’s status could not be read/)
    assert.match(healthLine(health({ state: 'unknown', message: '' }), NOW).text, /^Not known: no record of the scheduler running was found\./)
  })

  it('never claims an instant start, even if the server says so', () => {
    for (const line of [
      healthLine(health({ state: 'running', message: 'Runs instantly.' }), NOW),
      healthLine(health({ state: 'unknown', message: 'Instant.' }), NOW),
      healthLine(health({ state: 'stale', message: 'Instant.' }), NOW),
      healthLine(null, NOW),
    ]) assert.ok(!/instant/i.test(line.text), line.text)
  })
})
