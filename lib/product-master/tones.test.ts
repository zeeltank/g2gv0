import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readinessTone } from './tones'

/** The colour of a readiness state. Moved here with the function from the old product-master model's tests (slice 15, track WPD). */
describe('the tone of a readiness state', () => {
  it('draws every readiness state in its colour', () => {
    const expected: Record<string, string> = {
      'Live – with client': 'success', 'Proven on real client data (pilot)': 'success', 'Built – no production client': 'primary',
      'In development': 'pending', 'Pilot planned': 'pending', 'Prototype': 'pending', 'Proposal / concept': 'inactive', 'Deferred': 'inactive',
    }
    for (const [state, tone] of Object.entries(expected)) assert.equal(readinessTone(state), tone, state)
    assert.equal(readinessTone(null), 'default')
    assert.equal(readinessTone(undefined), 'default')
    assert.equal(readinessTone('Something new'), 'default')
  })
})
