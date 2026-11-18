import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { refusalFrom, RunRefusalError } from '../../services/signal-review/signal-run-service'
import {
  COMPLETED_STATUSES, describeStartFailure, EMPTY_FORM, failedRunText, failureContext, FAILED_STATUSES, finishedNotice, nextPollStep, onlyProduct, POLL_FAILURES_MAX,
  POLL_MAX, POLL_MS, productOptions, productReadyFor, progressLines, runGoneFailure, subProductOptions, toRequest, validateGenerate, type FailureContext,
} from './generate-model'
import { product, products as fixtureProducts, run } from './generate-fixtures'

const CONTEXT: FailureContext = { productLabel: 'Scholar', subName: null, model: 'b2b' }
const refusal = (status: number, body: Record<string, unknown> = {}) => refusalFrom(status, body)

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

  it('names what was chosen, for the refusal', () => {
    assert.deepEqual(failureContext({ product: 'scholar', model: 'b2c', offer: 'SCH-11' }, products), { productLabel: 'Scholar', subName: 'Fees module', model: 'b2c' })
    assert.deepEqual(failureContext({ product: 'g2g', model: 'b2b', offer: '' }, products), { productLabel: 'G2G', subName: null, model: 'b2b' })
  })
})

describe('the refusals of the run endpoint', () => {
  it('lists what is missing, as the server sent it, when the product is not ready', () => {
    const failure = describeStartFailure(refusal(422, {
      code: 'product_not_configured', message: 'Scholar (B2B ICP) is not ready for discovery.', missing: ['Ideal customer', 'At least one search'],
    }), CONTEXT)
    assert.equal(failure.kind, 'not_ready')
    assert.equal(failure.message, 'Scholar (B2B ICP) is not ready for discovery.')
    assert.deepEqual(failure.missing, ['Ideal customer', 'At least one search'])
    assert.equal(failure.canWatch, false)
  })

  it('names the sub-product and lists what it is missing', () => {
    const failure = describeStartFailure(refusal(422, { code: 'sub_product_not_ready', message: 'Fees module (B2G ICP) is not ready: long text with the list.', missing: ['Buyer types'] }), { productLabel: 'Scholar', subName: 'Fees module', model: 'b2g' })
    assert.equal(failure.kind, 'not_ready')
    assert.equal(failure.message, 'Fees module (B2G ICP) is not ready for discovery.')
    assert.deepEqual(failure.missing, ['Buyer types'])
  })

  it('says research is already running on a 409, and offers to watch it', () => {
    const failure = describeStartFailure(refusal(409, { code: 'already_running', message: 'Research is already running.' }), CONTEXT)
    assert.equal(failure.kind, 'running')
    assert.equal(failure.canWatch, true)
    assert.ok(failure.title.toLowerCase().includes('already running'))
    assert.ok(failure.message.includes('already running'))
  })

  it('says "You are not allowed to start research." on a 403', () => {
    const failure = describeStartFailure(refusal(403, { message: 'Forbidden' }), CONTEXT)
    assert.equal(failure.kind, 'forbidden')
    assert.equal(failure.message, 'You are not allowed to start research.')
  })

  it('tells a person whose session ended to sign in again', () => {
    assert.equal(describeStartFailure(refusal(401, { message: 'Invalid token' }), CONTEXT).message, 'Your session has ended. Please sign in again.')
  })

  it('explains the cool-down with how long to wait', () => {
    const failure = describeStartFailure(refusal(429, { code: 'cooldown', message: 'Research ran a moment ago.', retry_after_seconds: 421 }), CONTEXT)
    assert.equal(failure.kind, 'wait')
    assert.ok(failure.message.includes('about 8 minutes'))
    assert.ok(describeStartFailure(refusal(429, { code: 'cooldown', retry_after_seconds: 30 }), CONTEXT).message.includes('about 1 minute '))
    assert.equal(describeStartFailure(refusal(429, {}), CONTEXT).kind, 'wait', 'a plain throttle is also a wait')
  })

  it('says research is not set up, without the names of settings, when no provider is configured', () => {
    for (const code of ['research_not_configured', 'ai_not_configured']) {
      const failure = describeStartFailure(refusal(422, { code, message: 'Set SIGNALS_SEARCH_DRIVER and its API key in the backend environment.' }), CONTEXT)
      assert.equal(failure.kind, 'not_configured', code)
      assert.ok(failure.message.includes('Ask an administrator'), code)
      assert.ok(!failure.message.includes('SIGNALS_'), code)
    }
  })

  it('passes on the server\'s sentence for any other refused request', () => {
    const failure = describeStartFailure(refusal(422, { code: 'invalid_region', message: 'Choose a state inside India.' }), CONTEXT)
    assert.deepEqual([failure.kind, failure.message], ['rejected', 'Choose a state inside India.'])
  })

  it('tells a failed connection apart from a refusal, so the person knows to try again', () => {
    const failure = describeStartFailure(new TypeError('fetch failed'), CONTEXT)
    assert.equal(failure.kind, 'network')
    assert.ok(failure.message.includes('try again'))
  })

  it('does not show a server error\'s technical text', () => {
    const failure = describeStartFailure(refusal(500, { message: 'SQLSTATE[HY000]: General error' }), CONTEXT)
    assert.equal(failure.kind, 'server')
    assert.ok(!failure.message.includes('SQLSTATE'))
  })

  it('keeps the code and the missing list when the service builds the error', () => {
    const error = refusalFrom(422, { code: 'product_not_configured', message: 'Not ready.', missing: ['A', '', 7, 'B'] }, null)
    assert.ok(error instanceof RunRefusalError)
    assert.deepEqual([error.status, error.code, error.missing], [422, 'product_not_configured', ['A', 'B']])
    assert.equal(refusalFrom(429, { code: 'cooldown' }, '90').retryAfterSeconds, 90)
    assert.equal(refusalFrom(502, null).message, 'The run could not be started (502).')
  })

  it('has its own words when the run to watch has already ended', () => {
    assert.equal(runGoneFailure().kind, 'rejected')
    assert.ok(runGoneFailure().message.includes('just finished'))
  })
})
