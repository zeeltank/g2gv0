import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { refusalFrom } from '../../services/signals/run-refusal'
import {
  COMPLETED_STATUSES, describeStartFailure, EMPTY_FORM, failedRunText, failureContext, FAILED_STATUSES, finishedNotice, modelWord, nextPollStep, onlyProduct,
  POLL_FAILURES_MAX, POLL_MAX, POLL_MS, productOptions, productReadyFor, progressLines, runGoneFailure, subProductOptions, toRequest, validateGenerate,
} from './generate-model'
import { product, products as fixtureProducts, run } from './generate-fixtures'
import * as runFailure from './run-failure'

// The tests of the refusals of the run endpoint (and of naming what was chosen for them) moved to run-failure.test.ts with the code they test (P1-A2).

describe('the refusal words are still offered to the Signal Review dialog (until step 1.7 removes it with this file)', () => {
  it('re-exports the very functions of run-failure.ts, so the dialog says what Company Opportunities says', () => {
    assert.equal(describeStartFailure, runFailure.describeStartFailure)
    assert.equal(failureContext, runFailure.failureContext)
    assert.equal(runGoneFailure, runFailure.runGoneFailure)
    assert.equal(modelWord, runFailure.modelWord)
    assert.equal(describeStartFailure(refusalFrom(429, { code: 'cooldown', retry_after_seconds: 60 }), { productLabel: 'Scholar', subName: null, model: 'b2b' }).message,
      'Research ran a moment ago. Please wait about 1 minute before running it again.')
  })
})

describe('following a run', () => {
  it('never asks faster than every three seconds', () => {
    assert.ok(POLL_MS >= 3000)
  })

  it('ends the watch with the run when the run finished its work, fully or with limits', () => {
    for (const status of COMPLETED_STATUSES) {
      const step = nextPollStep({ run: run({ status }), failures: 3, attempt: 5 })
      assert.equal(step.kind, 'completed', status)
    }
    assert.deepEqual([...COMPLETED_STATUSES], ['success', 'partial'])
  })

  it('ends the watch as "did not finish" for a failed, skipped or timed-out run', () => {
    for (const status of FAILED_STATUSES) assert.equal(nextPollStep({ run: run({ status }), failures: 0, attempt: 0 }).kind, 'ended', status)
    assert.deepEqual([...FAILED_STATUSES], ['failed', 'skipped', 'timed_out'])
  })

  it('goes on while the run is going, and forgets earlier failed polls', () => {
    assert.deepEqual(nextPollStep({ run: run(), failures: 4, attempt: 10 }), { kind: 'continue', failures: 0 })
  })

  it('counts failed polls, and says contact was lost after a run of them', () => {
    assert.deepEqual(nextPollStep({ run: null, failures: 0, attempt: 0 }), { kind: 'continue', failures: 1 })
    assert.deepEqual(nextPollStep({ run: null, failures: POLL_FAILURES_MAX - 2, attempt: 0 }), { kind: 'continue', failures: POLL_FAILURES_MAX - 1 })
    assert.deepEqual(nextPollStep({ run: null, failures: POLL_FAILURES_MAX - 1, attempt: 0 }), { kind: 'stalled', reason: 'contact' })
  })

  it('stops watching a run that is still going after the backstop, and says the run itself goes on', () => {
    assert.deepEqual(nextPollStep({ run: run(), failures: 0, attempt: POLL_MAX - 2 }), { kind: 'continue', failures: 0 })
    assert.deepEqual(nextPollStep({ run: run(), failures: 0, attempt: POLL_MAX - 1 }), { kind: 'stalled', reason: 'slow' })
  })

  it('shows the server\'s own message and the counters it has, never invented ones', () => {
    assert.deepEqual(progressLines(null), { headline: 'Research is running…', detail: null })
    assert.deepEqual(progressLines(run({ stage_message: 'Reading sources…' })), { headline: 'Reading sources…', detail: null })
    assert.deepEqual(progressLines(run({ queries_run: 6, sources_found: 1 })), { headline: 'Research is running…', detail: '6 searches run, 1 source found so far.' })
    assert.equal(progressLines(run({ queries_run: 0 })).detail, '0 searches run so far.', 'zero is a count, not a missing one')
  })
})

describe('what a finished run says', () => {
  it('says how many new signals a finished run found', () => {
    assert.deepEqual(finishedNotice(run({ status: 'success', opportunities_new: 4 })), { tone: 'success', text: 'Run finished: 4 new signals.' })
    assert.equal(finishedNotice(run({ status: 'success', opportunities_new: 1 }))?.text, 'Run finished: 1 new signal.')
    assert.equal(finishedNotice(run({ status: 'success', opportunities_new: 0 }))?.text, 'Run finished: 0 new signals.')
  })

  it('does not invent a count when the server sent none', () => {
    assert.equal(finishedNotice(run({ status: 'success', opportunities_new: null }))?.text, 'Run finished.')
  })

  it('warns when the run finished with limits', () => {
    const notice = finishedNotice(run({ status: 'partial', opportunities_new: 2 }))
    assert.equal(notice?.tone, 'warning')
    assert.ok(notice?.text.startsWith('Run finished: 2 new signals.'))
    assert.ok(notice?.text.includes('could not be read'))
  })

  it('says nothing of a run that did not finish; the dialog explains that one', () => {
    for (const status of FAILED_STATUSES) assert.equal(finishedNotice(run({ status })), null, status)
    assert.equal(finishedNotice(run()), null)
  })

  it('explains a run that did not finish with the server\'s reason', () => {
    assert.equal(failedRunText(run({ status: 'failed', error_message: 'The search provider refused the key.' })), 'The search provider refused the key.')
    assert.equal(failedRunText(run({ status: 'failed', stage_message: 'Stopped.' })), 'Stopped.')
    assert.equal(failedRunText(run({ status: 'failed' })), 'The run did not complete.')
  })
})

describe('the form', () => {
  const products = fixtureProducts()

  it('opens on B2B with nothing chosen, so a run is never started on a guess', () => {
    assert.deepEqual(EMPTY_FORM, { product: '', model: 'b2b', offer: '' })
    assert.deepEqual(validateGenerate(EMPTY_FORM, products), { product: 'Choose a product to continue.' })
  })

  it('accepts a product that exists and refuses one that does not', () => {
    assert.deepEqual(validateGenerate({ ...EMPTY_FORM, product: 'g2g' }, products), {})
    assert.equal(validateGenerate({ ...EMPTY_FORM, product: 'gone' }, products).product, 'That product is not available. Choose another.')
  })

  it('sends the product and model, and a sub-product only when one is chosen', () => {
    assert.deepEqual(toRequest({ product: 'scholar', model: 'b2b', offer: '' }), { product: 'scholar', customer_model: 'b2b' })
    assert.deepEqual(toRequest({ product: 'scholar', model: 'b2g', offer: 'SCH-11' }), { product: 'scholar', customer_model: 'b2g', offer_id: 'SCH-11' })
  })

  it('marks a product whose ICP for the chosen model is not set up, and leaves the others plain', () => {
    assert.deepEqual(productOptions(products, 'b2b'), [{ value: 'scholar', label: 'Scholar' }, { value: 'g2g', label: 'G2G — B2B ICP not set up' }])
    assert.deepEqual(productOptions(products, 'b2g'), [{ value: 'scholar', label: 'Scholar — B2G ICP not set up' }, { value: 'g2g', label: 'G2G' }])
  })

  it('reads readiness from the per-model status, and falls back to the product\'s own flag for B2B only', () => {
    assert.equal(productReadyFor(product({ ready: true }), 'b2b'), true)
    assert.equal(productReadyFor(product({ ready: true }), 'b2c'), false)
    assert.equal(productReadyFor(products[1], 'b2g'), true)
  })

  it('offers the sub-products of the chosen product, after "The whole product", and none for a product without any', () => {
    assert.deepEqual(subProductOptions(products, 'scholar', 'b2b'), [
      { value: '', label: 'The whole product' },
      { value: 'SCH-11', label: 'Fees module' },
      { value: 'SCH-12', label: 'Attendance — B2B ICP not set up' },
    ])
    assert.deepEqual(subProductOptions(products, 'g2g', 'b2b'), [])
    assert.deepEqual(subProductOptions(products, '', 'b2b'), [])
  })

  it('picks the product for a person who has only one', () => {
    assert.equal(onlyProduct([products[0]]), 'scholar')
    assert.equal(onlyProduct(products), '')
    assert.equal(onlyProduct([]), '')
  })
})
