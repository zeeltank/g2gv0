import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { currencyMismatchSentence } from './currency-mismatch'

/**
 * The 422 a document answers when a Sub-product priced in one currency goes on a document in another (S16, hp_erp contract section 4 item (a)): one plain sentence, read from
 * wherever the server puts it. Only a 422 with the sentence's own two halves counts; every other failure is left to the page's notice.
 */

const SENTENCE = 'Scholar Nine is priced in INR, this document is in USD.'

describe('the currency_mismatch sentence', () => {
  it('is read from the message, the detail, or a field message of a 422', () => {
    assert.equal(currencyMismatchSentence(new ApiError(SENTENCE, 422)), SENTENCE)
    assert.equal(currencyMismatchSentence(new ApiError('Validation failed', 422, undefined, SENTENCE)), SENTENCE)
    assert.equal(currencyMismatchSentence(new ApiError('Validation failed', 422, { currency_mismatch: [SENTENCE] })), SENTENCE)
    assert.equal(currencyMismatchSentence(new ApiError('Validation failed', 422, { 'lineItems.0.productId': ['Fee ERP is priced in EUR, this document is in INR.'] })), 'Fee ERP is priced in EUR, this document is in INR.')
  })

  it('is not read from any other status, even with the same words', () => {
    for (const status of [200, 400, 403, 404, 409, 500]) assert.equal(currencyMismatchSentence(new ApiError(SENTENCE, status)), null, String(status))
  })

  it('is not read from a 422 about something else, or from a failure that is not an ApiError', () => {
    assert.equal(currencyMismatchSentence(new ApiError('Validation failed', 422, { quantity: ['The quantity must be at least 0.01.'] })), null)
    assert.equal(currencyMismatchSentence(new ApiError('The currency must be a code.', 422)), null)
    assert.equal(currencyMismatchSentence(new ApiError('Fee ERP is priced in INR.', 422)), null, 'half of the sentence is not the sentence')
    assert.equal(currencyMismatchSentence(new Error(SENTENCE)), null, 'a plain Error is some other failure')
    for (const other of [null, undefined, SENTENCE, { message: SENTENCE, status: 422 }]) assert.equal(currencyMismatchSentence(other), null)
  })
})
