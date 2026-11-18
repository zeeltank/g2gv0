import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { ApiError } from '../services/core'
import { apiErrorText } from './api-messages'

describe('apiErrorText', () => {
  it('lists the server\'s field messages instead of a bare "Validation failed"', () => {
    const e = new ApiError('Validation failed', 422, { contact_email: ['The contact email field must be a valid email address.'], referral_margin_pct: ['Must be at most 100.'] })
    assert.equal(apiErrorText(e, 'x'), 'contact email: The contact email field must be a valid email address. · referral margin pct: Must be at most 100.')
  })

  it('shows at most four field messages', () => {
    const errors = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((k) => [k, ['bad']]))
    assert.equal(apiErrorText(new ApiError('Validation failed', 422, errors), 'x').split(' · ').length, 4)
  })

  it('uses the server\'s own message when there are no fields', () => {
    assert.equal(apiErrorText(new ApiError('An offer with this Offer ID already exists', 409), 'x'), 'An offer with this Offer ID already exists')
  })

  it('falls back for anything else', () => {
    assert.equal(apiErrorText('nope', 'Could not save.'), 'Could not save.')
    assert.equal(apiErrorText(new Error('network down'), 'Could not save.'), 'network down')
    assert.equal(apiErrorText(undefined, 'Could not save.'), 'Could not save.')
  })
})
