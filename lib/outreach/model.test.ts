import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../../services/core/api-client'
import { FAILING, GATE_KEYS, REFUSAL_TEXT, attempt, claim, claimsAnswer, gateAnswer, wireChecks } from './fixtures'
import {
  BUSY_TEXT, CHECK_SENTENCES, CLAIMS_FORBIDDEN_TEXT, CLAIMS_UNAVAILABLE_TEXT, FORBIDDEN_TEXT, GATE_REFUSAL_PREFIX, NETWORK_TEXT, UNAVAILABLE_TEXT,
  attemptNote, checkSentence, claimsHeading, classifyClaimsFailure, classifyGateFailure, gateRefusalMessage, httpUrl, isCheckable, isGateRefusal, messageProductId,
  messageSignature, needsClaims, orderChecks, readChecks, readClaims, readReport, summarize, verdict, whole,
} from './model'
import type { GateCheck } from './types'

const c = (key: string, passed: boolean, detail = '', label = ''): GateCheck => ({ key, label, passed, detail })

describe('reading the checks (fail closed)', () => {
  it('a check passes only when the server sent the boolean true', () => {
    const read = readChecks([
      { key: 'a', label: 'A', passed: true, detail: 'ok' },
      { key: 'b', passed: 'true' },
      { key: 'c', passed: 1 },
      { key: 'd' },
      { key: 'e', passed: null },
      { key: 'f', passed: false },
    ])
    assert.deepEqual(read.map((x) => x.passed), [true, false, false, false, false, false])
  })

  it('keeps the key, the label and the detail, trimmed, and gives a missing one as empty text', () => {
    assert.deepEqual(readChecks([{ key: ' length ', label: ' Short enough ', passed: true, detail: ' fine ' }, { key: 'x', passed: true }]), [
      { key: 'length', label: 'Short enough', passed: true, detail: 'fine' },
      { key: 'x', label: '', passed: true, detail: '' },
    ])
  })

  it('an item that is not an object reads as a failed check of key "unknown", never as nothing', () => {
    assert.deepEqual(readChecks([null, 'ok', 7]).map((x) => [x.key, x.passed]), [['unknown', false], ['unknown', false], ['unknown', false]])
    assert.deepEqual(readChecks([{ passed: true }]).map((x) => x.key), ['unknown'], 'an item with no key is still shown')
  })

  it('anything but a list is no checks', () => {
    assert.deepEqual(readChecks(undefined), [])
    assert.deepEqual(readChecks({ key: 'a' }), [])
    assert.deepEqual(readChecks('checks'), [])
  })

  it('reads the preview envelope, and refuses a body that is not one', () => {
    const report = readReport(gateAnswer(wireChecks(FAILING)))
    assert.equal(report?.checks.length, 10)
    assert.equal(report?.passed, false)
    assert.equal(report?.checkedAt, '2026-11-04T11:30:00+05:30')
    for (const bad of [null, undefined, 'x', 7, [], {}, { data: null }, { data: {} }, { data: { checks: 'none' } }, { status: 1, data: { passed: true } }]) {
      assert.equal(readReport(bad), null, `not an envelope: ${JSON.stringify(bad)}`)
    }
  })

  it('a report passes only when every check passed and the server did not say otherwise', () => {
    assert.equal(readReport(gateAnswer(wireChecks()))?.passed, true)
    assert.equal(readReport(gateAnswer(wireChecks(), { passed: false }))?.passed, false, 'the server said it did not pass')
    assert.equal(readReport(gateAnswer(wireChecks(), { passed: null }))?.passed, true, 'a server that sends no verdict leaves it to the checks')
    assert.equal(readReport(gateAnswer([], { passed: true }))?.passed, false, 'a list with no check in it vouches for nothing, whatever the server says')
    assert.equal(readReport(gateAnswer(wireChecks({ length: 'too long' }), { passed: true }))?.passed, false, 'a failed check beats a "passed" flag')
  })

  it('a missing or blank checked_at is null', () => {
    assert.equal(readReport(gateAnswer(wireChecks(), { checked_at: null }))?.checkedAt, null)
    assert.equal(readReport(gateAnswer(wireChecks(), { checked_at: '  ' }))?.checkedAt, null)
  })
})

describe('the summary line', () => {
  it('counts the failed checks of those shown and says plainly that sending is not possible yet', () => {
    assert.equal(summarize(readChecks(wireChecks(FAILING))).line, '3 of 10 checks failed: you cannot send this yet.')
    assert.equal(summarize([c('a', false), c('b', true)]).line, '1 of 2 checks failed: you cannot send this yet.')
    assert.equal(summarize([c('a', false)]).line, '1 of 1 check failed: you cannot send this yet.', 'singular')
  })

  it('says all passed, and never says anything is allowed to be sent', () => {
    const all = summarize(readChecks(wireChecks()))
    assert.equal(all.line, 'All 10 checks passed.')
    assert.equal(all.passed, true)
    assert.equal(summarize([c('a', true)]).line, 'The check passed.')
    assert.doesNotMatch(all.line, /can send|may send|ready to send/i)
  })

  it('an empty list does not pass', () => {
    const none = summarize([])
    assert.equal(none.passed, false)
    assert.equal(none.total, 0)
    assert.match(none.line, /^No check came back/)
    assert.match(none.line, /you cannot send this yet\.$/)
  })

  it('a server that says "not passed" with no failed check shown still does not pass', () => {
    const odd = summarize([c('a', true)], false)
    assert.equal(odd.passed, false)
    assert.match(odd.line, /did not pass/)
    assert.equal(summarize([c('a', true)], true).passed, true)
    assert.equal(summarize([c('a', true)], null).passed, true)
  })

  it('returns the numbers it counted', () => {
    const s = summarize([c('a', false), c('b', false), c('c', true)])
    assert.deepEqual([s.total, s.failed], [3, 2])
  })
})

describe('the order and the words', () => {
  it('lists the failed checks first and keeps the server\'s order inside each group', () => {
    const ordered = orderChecks([c('a', true), c('b', false), c('c', true), c('d', false), c('e', true)])
    assert.deepEqual(ordered.map((x) => x.key), ['b', 'd', 'a', 'c', 'e'])
  })

  it('does not change the list it is given', () => {
    const given = [c('a', true), c('b', false)]
    orderChecks(given)
    assert.deepEqual(given.map((x) => x.key), ['a', 'b'])
  })

  it('has a sentence for each of the ten keys and the "gate" key, each way, and they differ', () => {
    for (const { key } of GATE_KEYS) {
      assert.ok(CHECK_SENTENCES[key], `a sentence for ${key}`)
      assert.notEqual(CHECK_SENTENCES[key].passed, CHECK_SENTENCES[key].failed)
      assert.equal(checkSentence(c(key, true)), CHECK_SENTENCES[key].passed)
      assert.equal(checkSentence(c(key, false)), CHECK_SENTENCES[key].failed)
    }
    assert.ok(CHECK_SENTENCES.gate)
    assert.deepEqual(Object.keys(CHECK_SENTENCES).sort(), [...GATE_KEYS.map((k) => k.key), 'gate'].sort(), 'no key without a test, no test without a key')
  })

  it('reads in plain words', () => {
    assert.equal(checkSentence(c('banned_phrase', false)), 'The message uses a banned phrase.')
    assert.equal(checkSentence(c('unapproved_claim', false)), 'The message states a claim nobody has approved.')
    assert.equal(checkSentence(c('suppression', true)), 'The address is not on the suppression list.')
  })

  it('a key it has no sentence for takes the server\'s label, then the key written out', () => {
    assert.equal(checkSentence(c('geo_fence', true, '', 'Inside the region')), 'Inside the region.')
    assert.equal(checkSentence(c('geo_fence', false, '', 'Inside the region')), 'Inside the region: this check failed.')
    assert.equal(checkSentence(c('geo_fence', false)), 'Geo fence: this check failed.')
    assert.equal(checkSentence(c('', true)), 'A check.')
  })

  it('a key that is a property of every object is not mistaken for a known one', () => {
    for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const sentence = checkSentence(c(key, false))
      assert.match(sentence, /this check failed\.$/, key)
    }
  })

  it('the verdict is a word', () => {
    assert.equal(verdict(c('a', true)), 'Passed')
    assert.equal(verdict(c('a', false)), 'Failed')
  })

  it('wants the claims only when the claim check failed', () => {
    assert.equal(needsClaims([c('unapproved_claim', false)]), true)
    assert.equal(needsClaims([c('unapproved_claim', true)]), false)
    assert.equal(needsClaims([c('banned_phrase', false)]), false)
    assert.equal(needsClaims([]), false)
  })
})

describe('the message the checks were run on', () => {
  const base = { subject: 'S', body: 'B', contact_email: 'a@b.co', contact_status: 'active', product_master_id: 4 }

  it('the signature changes with each thing the checks read, and with nothing else', () => {
    const was = messageSignature(base)
    for (const [field, value] of [['subject', 'S2'], ['body', 'B2'], ['contact_email', 'c@d.co'], ['contact_status', 'bounced']] as const) {
      assert.notEqual(messageSignature({ ...base, [field]: value }), was, `${field} is read by the checks`)
    }
    assert.equal(messageSignature({ ...base, product_master_id: 99 }), was)
    assert.equal(messageSignature({ ...base, status: 'sent' } as never), was)
  })

  it('does not run two fields together', () => {
    assert.notEqual(messageSignature({ subject: 'ab', body: 'c' }), messageSignature({ subject: 'a', body: 'bc' }))
  })

  it('reads a product id only when it is a real one', () => {
    assert.equal(messageProductId({ product_master_id: 4 }), 4)
    assert.equal(messageProductId({ product_master_id: '12' }), 12)
    for (const bad of [0, -1, 1.5, 'abc', null, undefined, '', {}]) assert.equal(messageProductId({ product_master_id: bad }), null, JSON.stringify(bad))
    assert.equal(messageProductId({}), null)
  })

  it('whole() is the same reading', () => {
    assert.equal(whole(' 7 '), 7)
    assert.equal(whole(Number.MAX_SAFE_INTEGER + 2), null)
  })

  it('checks only the drafts: not sent, sending or cancelled', () => {
    for (const s of ['draft', 'rejected', 'pending_approval', 'approved', 'failed']) assert.equal(isCheckable(s), true, s)
    for (const s of ['sent', 'sending', 'cancelled', '', 'unknown']) assert.equal(isCheckable(s), false, s)
    assert.equal(isCheckable(undefined), false)
  })
})

describe('a refused send', () => {
  it('recognises the gate\'s refusal by status and wording', () => {
    const refusal = new ApiError(REFUSAL_TEXT, 422)
    assert.equal(gateRefusalMessage(refusal), REFUSAL_TEXT)
    assert.equal(isGateRefusal(refusal), true)
    assert.ok(REFUSAL_TEXT.startsWith(GATE_REFUSAL_PREFIX))
  })

  it('does not take another failure for it', () => {
    assert.equal(isGateRefusal(new ApiError(REFUSAL_TEXT, 500)), false, 'the wording alone is not enough')
    assert.equal(isGateRefusal(new ApiError(REFUSAL_TEXT, 403)), false)
    assert.equal(isGateRefusal(new ApiError('The daily cap of 50 was reached.', 422)), false, 'the status alone is not enough')
    assert.equal(isGateRefusal(new ApiError('Sending is not enabled.', 422)), false)
    for (const other of [null, undefined, 'The outreach checks stopped this message.', { status: 422, message: REFUSAL_TEXT }, new TypeError('Failed to fetch')]) assert.equal(isGateRefusal(other), false)
  })

  it('also recognises an error that carries the code itself', () => {
    const coded = Object.assign(new Error('Held back.'), { code: 'gate_blocked' })
    assert.equal(gateRefusalMessage(coded), 'Held back.')
    assert.equal(gateRefusalMessage(Object.assign(new Error('Held back.'), { code: 'locked' })), null)
  })

  it('says something next to an attempt the gate stopped, and nothing next to the others', () => {
    assert.equal(attemptNote(attempt().code), 'Held back by the outreach checks. Nothing was sent.')
    for (const code of ['locked', 'daily_cap', '', null, undefined]) assert.equal(attemptNote(code), null, String(code))
  })
})

describe('a failed request', () => {
  it('404 and 403 mean the checks are not available here, and a retry cannot help', () => {
    assert.deepEqual(classifyGateFailure(new ApiError('Message not found.', 404)), { kind: 'unavailable', message: UNAVAILABLE_TEXT })
    assert.deepEqual(classifyGateFailure(new ApiError('Your role does not have access.', 403)), { kind: 'unavailable', message: FORBIDDEN_TEXT })
    assert.match(UNAVAILABLE_TEXT, /^The outreach checks are not available on this server yet\./)
    assert.match(FORBIDDEN_TEXT, /^The outreach checks are not available on this server yet/)
  })

  it('429 is a wait, not a failure of the server', () => {
    assert.deepEqual(classifyGateFailure(new ApiError('Too Many Attempts.', 429)), { kind: 'busy', message: BUSY_TEXT })
  })

  it('anything else is an error a retry may help, in the server\'s own words where it gave them', () => {
    assert.deepEqual(classifyGateFailure(new ApiError('Server error.', 500)), { kind: 'error', message: 'Server error.' })
    assert.deepEqual(classifyGateFailure(new ApiError('Say which message.', 422)), { kind: 'error', message: 'Say which message.' })
    assert.deepEqual(classifyGateFailure(new TypeError('Failed to fetch')), { kind: 'error', message: NETWORK_TEXT })
    assert.deepEqual(classifyGateFailure(new Error('boom')), { kind: 'error', message: 'boom' })
    assert.deepEqual(classifyGateFailure('weird'), { kind: 'error', message: 'The checks could not be run.' })
    assert.deepEqual(classifyGateFailure(null, 'Nope.'), { kind: 'error', message: 'Nope.' })
  })

  it('the claims list says its own thing for 403 and 404, and otherwise as above', () => {
    assert.deepEqual(classifyClaimsFailure(new ApiError('x', 403)), { kind: 'unavailable', message: CLAIMS_FORBIDDEN_TEXT })
    assert.deepEqual(classifyClaimsFailure(new ApiError('x', 404)), { kind: 'unavailable', message: CLAIMS_UNAVAILABLE_TEXT })
    assert.deepEqual(classifyClaimsFailure(new ApiError('x', 429)), { kind: 'busy', message: BUSY_TEXT })
    assert.deepEqual(classifyClaimsFailure(new ApiError('Bad.', 500)), { kind: 'error', message: 'Bad.' })
  })
})

describe('the approved claims', () => {
  it('keeps the claims the server marks approved and nothing else', () => {
    const list = readClaims(claimsAnswer([
      claim({ id: 1 }), claim({ id: 2, status: 'proposed' }), claim({ id: 3, status: 'retired' }), claim({ id: 4, status: undefined }), claim({ id: 5, status: 'APPROVED' }), claim({ id: 6 }),
    ]))
    assert.deepEqual(list?.claims.map((x) => x.id), [1, 6])
  })

  it('drops a claim with no readable id or text', () => {
    const list = readClaims(claimsAnswer([claim({ id: 0 }), claim({ id: 'x' }), claim({ claim: '  ' }), claim({ claim: null }), null, 'text', claim({ id: 8 })]))
    assert.deepEqual(list?.claims.map((x) => x.id), [8])
  })

  it('reads the product, the source and the total', () => {
    const list = readClaims(claimsAnswer([claim({ id: 1, product_master_id: 9, product_name: 'School ERP', source_url: 'https://example.org/x' })], 5))
    assert.deepEqual(list, { claims: [{ id: 1, productId: 9, productName: 'School ERP', claim: 'Used by over 200 schools in India.', sourceUrl: 'https://example.org/x' }], total: 5 })
    assert.equal(readClaims(claimsAnswer([claim()], 0))?.total, 1, 'a total smaller than what came back is not believed')
    assert.equal(readClaims({ status: 1, data: { claims: [claim()] } })?.total, 1, 'no total: what came back')
  })

  it('is null when the body is not a claims answer', () => {
    for (const bad of [null, {}, { data: {} }, { data: { claims: 'x' } }, 'x']) assert.equal(readClaims(bad), null)
  })

  it('makes a link only of an http or https address', () => {
    assert.equal(httpUrl('https://example.org/a b'), 'https://example.org/a%20b')
    assert.equal(httpUrl('http://example.org'), 'http://example.org/')
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://example.org', '/relative', 'example.org', '', null, 7]) assert.equal(httpUrl(bad), null, String(bad))
  })

  it('names the list for the product, or for all of them', () => {
    assert.equal(claimsHeading(9), 'Approved claims for this product')
    assert.equal(claimsHeading(null), 'Approved claims (all products)')
  })
})
