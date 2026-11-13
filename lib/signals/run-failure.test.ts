import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { refusalFrom, RunRefusalError } from '../../services/signals/run-refusal'
import { portfolioProducts } from './opportunity-fixtures'
import { describeStartFailure, failureContext, failureNotice, runGoneFailure, type FailureContext, type StartFailure } from './run-failure'

/**
 * Why a research run did not start, in plain words: what the server's refusals are called, and how the Generate Signals button on Company Opportunities
 * shows them. The first group moved here from generate-model.test.ts together with the code it tests (P1-A2); the Review's dialog still reads the same words.
 */

const CONTEXT: FailureContext = { productLabel: 'Scholar', subName: null, model: 'b2b' }
const refusal = (status: number, body: Record<string, unknown> = {}) => refusalFrom(status, body)

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
    assert.ok(failure.title.toLowerCase().includes('already running'), 'failure.title.toLowerCase().includes(\'already running\')')
    assert.ok(failure.message.includes('already running'), 'failure.message.includes(\'already running\')')
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
    assert.ok(failure.message.includes('about 8 minutes'), 'failure.message.includes(\'about 8 minutes\')')
    assert.ok(describeStartFailure(refusal(429, { code: 'cooldown', retry_after_seconds: 30 }), CONTEXT).message.includes('about 1 minute '), 'describeStartFailure(refusal(429, { code: \'cooldown\', retry_after_seconds: 30 }), CONTEXT).mess...')
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
    assert.ok(failure.message.includes('try again'), 'failure.message.includes(\'try again\')')
  })

  it('does not show a server error\'s technical text', () => {
    const failure = describeStartFailure(refusal(500, { message: 'SQLSTATE[HY000]: General error' }), CONTEXT)
    assert.equal(failure.kind, 'server')
    assert.ok(!failure.message.includes('SQLSTATE'), '!failure.message.includes(\'SQLSTATE\')')
  })

  it('keeps the code and the missing list when the service builds the error', () => {
    const error = refusalFrom(422, { code: 'product_not_configured', message: 'Not ready.', missing: ['A', '', 7, 'B'] }, null)
    assert.ok(error instanceof RunRefusalError, 'error instanceof RunRefusalError')
    assert.deepEqual([error.status, error.code, error.missing], [422, 'product_not_configured', ['A', 'B']])
    assert.equal(refusalFrom(429, { code: 'cooldown' }, '90').retryAfterSeconds, 90)
    assert.equal(refusalFrom(502, null).message, 'The run could not be started (502).')
  })

  it('has its own words when the run to watch has already ended', () => {
    assert.equal(runGoneFailure().kind, 'rejected')
    assert.ok(runGoneFailure().message.includes('just finished'), 'runGoneFailure().message.includes(\'just finished\')')
  })

  it('names what was chosen, for the refusal', () => {
    const products = portfolioProducts().data.products
    assert.deepEqual(failureContext({ product: 'scholarclone', model: 'b2c', offer: 'SCH-11' }, products), { productLabel: 'ScholarClone', subName: 'Scholar Learn', model: 'b2c' })
    assert.deepEqual(failureContext({ product: 'g2g', model: 'b2b', offer: '' }, products), { productLabel: 'G2G', subName: null, model: 'b2b' })
    assert.deepEqual(failureContext({ product: 'gone', model: 'b2b', offer: 'X' }, products), { productLabel: 'gone', subName: 'X', model: 'b2b' }, 'a product that is not in the list is named by what was asked for')
    assert.deepEqual(failureContext({ product: 'scholarclone', model: 'b2b', offer: 'NOPE' }, products), { productLabel: 'ScholarClone', subName: 'NOPE', model: 'b2b' }, 'a sub-product that is not in the list is named by what was asked for')
  })
})

describe('how the Generate Signals button says it', () => {
  const noticeOf = (error: unknown, context: FailureContext = CONTEXT) => failureNotice(describeStartFailure(error, context))

  it('says a wait is a wait: a warning with the minutes, not an error', () => {
    const notice = noticeOf(refusalFrom(429, { code: 'cooldown', message: 'Research ran a moment ago.', retry_after_seconds: 540 }))
    assert.deepEqual(notice, { tone: 'warning', text: 'Research ran a moment ago. Please wait about 9 minutes before running it again.' })
  })

  it('says a product that is not ready is a warning, with what it lacks and where to complete it', () => {
    const notice = noticeOf(refusalFrom(422, { code: 'product_not_configured', message: 'Scholar (B2B ICP) is not ready for discovery.', missing: ['Ideal customer', 'At least one search'] }))
    assert.equal(notice.tone, 'warning')
    assert.equal(notice.text, 'Scholar (B2B ICP) is not ready for discovery.')
    assert.deepEqual(notice.missing, ['Ideal customer', 'At least one search'])
    assert.ok(notice.nextStep?.includes('Product Portfolio'), 'notice.nextStep?.includes(\'Product Portfolio\')')
  })

  it('names the sub-product that is not ready', () => {
    const notice = noticeOf(refusalFrom(422, { code: 'sub_product_not_ready', message: 'long server text', missing: ['Buyer types'] }), { productLabel: 'Scholar', subName: 'Fees module', model: 'b2g' })
    assert.equal(notice.text, 'Fees module (B2G ICP) is not ready for discovery.')
    assert.deepEqual(notice.missing, ['Buyer types'])
  })

  it('leaves out an empty list of what is missing', () => {
    const notice = noticeOf(refusalFrom(422, { code: 'product_not_configured', message: 'Not ready.' }))
    assert.equal('missing' in notice, false)
  })

  it('says research is already running as information, and does not offer to "watch it here"', () => {
    const notice = noticeOf(refusalFrom(409, { code: 'already_running', message: 'Research is already running.' }))
    assert.equal(notice.tone, 'info')
    assert.ok(notice.text.includes('already running'), 'notice.text.includes(\'already running\')')
    assert.ok(!/watch/i.test(notice.text), 'this screen follows the run itself; there is no Watch it button')
  })

  it('says a missing provider is a set-up matter, in plain words', () => {
    for (const code of ['research_not_configured', 'ai_not_configured']) {
      const notice = noticeOf(refusalFrom(422, { code, message: 'Set SIGNALS_SEARCH_DRIVER and its API key in the backend environment.' }))
      assert.equal(notice.tone, 'warning', code)
      assert.ok(notice.text.includes('Ask an administrator'), code)
      assert.ok(!notice.text.includes('SIGNALS_'), code)
    }
  })

  it('says everything the person cannot fix by waiting is an error', () => {
    const cases: Array<[unknown, string]> = [
      [refusalFrom(403, { message: 'This action is unauthorized.' }), 'You are not allowed to start research.'],
      [refusalFrom(401, { message: 'Unauthenticated.' }), 'Your session has ended. Please sign in again.'],
      [new TypeError('Failed to fetch'), 'The server could not be reached. Check your connection and try again.'],
      [refusalFrom(500, { message: 'SQLSTATE[HY000]: General error' }), 'The server had a problem starting the run. Try again in a moment.'],
      [refusalFrom(422, { code: 'invalid_region', message: 'Choose a state inside India.' }), 'Choose a state inside India.'],
    ]
    for (const [error, text] of cases) {
      const notice = noticeOf(error)
      assert.deepEqual([notice.tone, notice.text], ['error', text], text)
    }
  })

  it('reads a refusal that came through the shared client (a status and a message, no code) as well', () => {
    class Plain extends Error { constructor(message: string, readonly status: number) { super(message) } }
    const throttled: StartFailure = describeStartFailure(new Plain('Too Many Attempts.', 429), CONTEXT)
    assert.equal(throttled.kind, 'wait')
    assert.equal(failureNotice(throttled).text, 'Too many tries in a short time. Wait a moment and try again.')
    assert.equal(noticeOf(new Plain('Forbidden', 403)).text, 'You are not allowed to start research.')
  })
})
