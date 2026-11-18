import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { signalReviewService } from '../../services/signal-review/signal-review-service'
import { FORBIDDEN_TEXT, NETWORK_TEXT, NOT_FOUND_TEXT } from './decision-failure'
import {
  classifyPromoteFailure, LEAD_CONFIRM, LEAD_FORBIDDEN_TEXT, leadHref, leadIdFrom, leadOf, promoteNotice, withLead,
} from './lead-action'
import { signalRow } from './signal-fixtures'

describe('the lead of a signal', () => {
  it('is the lead the server names, with its number and status when it named them', () => {
    const lead = leadOf(signalRow({ promoted_lead_id: '501', promoted_lead_no: 'LD-00012', promoted_lead_status: 'New' }))
    assert.deepEqual(lead, { id: '501', number: 'LD-00012', status: 'New', href: '/module/crm/marketing/leads/501' })
  })

  it('is null for a signal without one, in every shape "without" arrives', () => {
    assert.equal(leadOf(signalRow()), null)
    assert.equal(leadOf(signalRow({ promoted_lead_id: null })), null)
    assert.equal(leadOf(signalRow({ promoted_lead_id: '' })), null)
    assert.equal(leadOf(signalRow({ promoted_lead_id: '0' })), null)
  })

  it('is never built from something that is not a lead id, so it cannot change where the link goes', () => {
    for (const bad of ['abc', '12/../../login', '1 2', '-5', 'javascript:alert(1)', '12?x=1']) {
      assert.equal(leadOf(signalRow({ promoted_lead_id: bad })), null, bad)
    }
  })

  it('accepts a numeric id and trims a padded one', () => {
    assert.equal(leadOf(signalRow({ promoted_lead_id: 77 as unknown as string }))?.id, '77')
    assert.equal(leadOf(signalRow({ promoted_lead_id: ' 88 ' }))?.id, '88')
  })

  it('leaves out a number or status that is blank', () => {
    const lead = leadOf(signalRow({ promoted_lead_id: '5', promoted_lead_no: '  ', promoted_lead_status: null }))!
    assert.equal(lead.number, null)
    assert.equal(lead.status, null)
  })

  it('opens in the Leads screen of CRM', () => {
    assert.equal(leadHref('9'), '/module/crm/marketing/leads/9')
  })
})

describe('the answer of the promote endpoint', () => {
  it('names the lead by its id', () => {
    assert.equal(leadIdFrom({ data: { lead_id: '501' } }), '501')
    assert.equal(leadIdFrom({ data: { lead_id: 501 } }), '501')
  })

  it('has no lead when the answer does not name one', () => {
    assert.equal(leadIdFrom(null), null)
    assert.equal(leadIdFrom({}), null)
    assert.equal(leadIdFrom({ data: {} }), null)
    assert.equal(leadIdFrom({ data: { lead_id: '' } }), null)
    assert.equal(leadIdFrom({ data: { lead_id: '../x' } }), null)
  })

  it('puts the lead on the signal and drops a number that belonged to another lead', () => {
    const before = signalRow({ promoted_lead_id: '4', promoted_lead_no: 'LD-00004', promoted_lead_status: 'New' })
    const after = withLead(before, '9')
    assert.equal(after.promoted_lead_id, '9')
    assert.equal(after.promoted_lead_no, null)
    assert.equal(after.promoted_lead_status, null)
    assert.equal(after.title, before.title, 'every other field stays')
    assert.equal(before.promoted_lead_id, '4', 'the old row is not changed')
  })

  it('keeps the number and status when it is the same lead found again', () => {
    const before = signalRow({ promoted_lead_id: '4', promoted_lead_no: 'LD-00004', promoted_lead_status: 'Qualified' })
    const after = withLead(before, '4')
    assert.equal(after.promoted_lead_no, 'LD-00004')
    assert.equal(after.promoted_lead_status, 'Qualified')
  })

  it('tells a new lead from one that was already there, and neither is an error', () => {
    assert.match(promoteNotice(true), /Lead created/)
    assert.match(promoteNotice(true), /history/)
    assert.match(promoteNotice(false), /already has a lead/)
    assert.match(promoteNotice(false), /no second one/)
  })
})

describe('the confirmation', () => {
  it('says what will happen: a lead in CRM from this signal, and the history records it', () => {
    assert.match(LEAD_CONFIRM.description, /lead is created in CRM from this signal/)
    assert.match(LEAD_CONFIRM.description, /history records it/)
    assert.equal(LEAD_CONFIRM.confirmLabel, 'Create lead')
  })
})

describe('what a refused or failed request becomes', () => {
  it('a 403 says leads, not decisions', () => {
    const failure = classifyPromoteFailure(new ApiError('Forbidden', 403))
    assert.deepEqual(failure, { kind: 'forbidden', message: 'You are not allowed to create leads from signals.' })
    assert.equal(LEAD_FORBIDDEN_TEXT, 'You are not allowed to create leads from signals.')
    assert.notEqual(failure.message, FORBIDDEN_TEXT)
  })

  it('a 404 says the signal is gone', () => {
    assert.deepEqual(classifyPromoteFailure(new ApiError('Opportunity not found', 404)), { kind: 'missing', message: NOT_FOUND_TEXT })
  })

  it('a request that never reached the server can be sent again', () => {
    assert.deepEqual(classifyPromoteFailure(new TypeError('Failed to fetch')), { kind: 'failed', message: NETWORK_TEXT })
  })

  it('any other answer shows the server\'s own sentence, or the status when it gave none', () => {
    assert.deepEqual(classifyPromoteFailure(new ApiError('The lead could not be saved.', 500)), { kind: 'failed', message: 'The lead could not be saved.' })
    assert.deepEqual(classifyPromoteFailure(Object.assign(new Error(''), { status: 502 })), { kind: 'failed', message: 'The server answered 502.' })
  })

  it('does not break on something that is not an error at all', () => {
    assert.equal(classifyPromoteFailure(undefined).kind, 'failed')
    assert.equal(classifyPromoteFailure('boom').kind, 'failed')
  })
})

describe('the promote request', () => {
  const restore: Array<() => void> = []
  afterEach(() => { for (const fn of restore.splice(0)) fn() })

  /** Replaces fetch for one test and records what was asked of it. No request leaves the process. */
  function fakeFetch(reply: () => Response | Promise<Response>) {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const original = globalThis.fetch
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => { calls.push({ url: String(url), init }); return reply() }) as typeof fetch
    restore.push(() => { globalThis.fetch = original })
    return calls
  }
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('posts to the promote path of that signal and returns the lead', async () => {
    const calls = fakeFetch(() => json(201, { status: 1, data: { lead_id: '501', created: true } }))
    const result = await signalReviewService.promote(7)
    assert.deepEqual(result.data, { lead_id: '501', created: true })
    assert.match(calls[0].url, /\/signals\/opportunities\/7\/promote-to-crm$/)
    assert.equal(calls[0].init?.method, 'POST')
  })

  it('reads a 200 for a signal that already had its lead as the same kind of answer', async () => {
    fakeFetch(() => json(200, { status: 1, data: { lead_id: '501', created: false } }))
    assert.deepEqual((await signalReviewService.promote(7)).data, { lead_id: '501', created: false })
  })

  it('answers a 403 and a 404 with an ApiError carrying the status', async () => {
    fakeFetch(() => json(403, { status: 0, message: 'Forbidden' }))
    await assert.rejects(signalReviewService.promote(7), (error: unknown) => error instanceof ApiError && error.status === 403)
    fakeFetch(() => json(404, { status: 0, message: 'Opportunity not found' }))
    await assert.rejects(signalReviewService.promote(7), (error: unknown) => error instanceof ApiError && error.status === 404)
  })

  it('lets a request that never reached the server fail as it is, so the drawer can offer a retry', async () => {
    fakeFetch(() => { throw new TypeError('Failed to fetch') })
    await assert.rejects(signalReviewService.promote(7), TypeError)
  })
})
