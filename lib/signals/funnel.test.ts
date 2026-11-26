import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { signalFunnelService } from '../../services/signal-review/signal-funnel-service'
import { signalReviewService } from '../../services/signal-review/signal-review-service'
import { NETWORK_TEXT, NOT_FOUND_TEXT } from './decision-failure'
import {
  accountIdFrom, ADDED_TO_PROSPECTING, ALREADY_IN_PROSPECTING, classifyFunnelFailure, convertNotice, FUNNEL_FORBIDDEN_TEXT, opportunityHref, opportunityOf, OPPORTUNITY_CREATED,
  OPPORTUNITY_EXISTS, prospectingHref, prospectingNotice, prospectingOf, withOpportunity, withProspecting,
} from './funnel'

describe('where a signal is in the funnel', () => {
  it('reads the Prospecting account the server named, and links to it with the account open', () => {
    const account = prospectingOf({ prospecting: { account_id: 41, stage: 'engaged', contacts_count: 2 } })
    assert.deepEqual(account, { accountId: 41, stage: 'engaged', contactsCount: 2, href: '/gtm/prospecting?account=41' })
    assert.equal(prospectingHref(41), '/gtm/prospecting?account=41')
  })

  it('has no account when the server named none, or named something that is not an id', () => {
    assert.equal(prospectingOf({}), null)
    assert.equal(prospectingOf({ prospecting: null }), null)
    assert.equal(prospectingOf({ prospecting: { account_id: 0, stage: 'target', contacts_count: 0 } }), null)
    assert.equal(prospectingOf({ prospecting: { account_id: '41; drop' as unknown as number, stage: 'target', contacts_count: 0 } }), null)
  })

  it('gains the account once the server says which (a new account starts at target with no people)', () => {
    const row = withProspecting({ id: 1 } as { id: number; prospecting?: { account_id: number; stage: string; contacts_count: number } | null }, 9)
    assert.deepEqual(row.prospecting, { account_id: 9, stage: 'target', contacts_count: 0 })
    assert.equal(withProspecting(row, 9), row, 'the same account changes nothing')
    assert.equal(accountIdFrom({ data: { account_id: 9 } }), 9)
    assert.equal(accountIdFrom({ data: {} }), null)
  })

  it('says "Added to Prospecting" for a new account and "Already in Prospecting" for one that was there', () => {
    assert.equal(prospectingNotice(true), ADDED_TO_PROSPECTING)
    assert.equal(prospectingNotice(false), ALREADY_IN_PROSPECTING)
    assert.deepEqual([ADDED_TO_PROSPECTING, ALREADY_IN_PROSPECTING], ['Added to Prospecting', 'Already in Prospecting'])
  })

  it('reads the opportunity a signal became, links to it, and says so once it has one', () => {
    assert.deepEqual(opportunityOf({ converted_opportunity: { id: 7, name: 'Greenfield - Campus' } }), { id: 7, name: 'Greenfield - Campus', href: '/module/crm/sales/opportunities/7' })
    assert.equal(opportunityHref(7), '/module/crm/sales/opportunities/7')
    assert.equal(opportunityOf({ converted_opportunity: null }), null)
    assert.equal(opportunityOf({ converted_opportunity: { id: -1, name: 'x' } }), null)
    assert.equal(opportunityOf({ converted_opportunity: { id: 7, name: ' ' } })?.name, 'Opportunity #7', 'a nameless one is still a link')
    const row = withOpportunity({ id: 1 } as { id: number; converted_opportunity?: { id: number; name: string } | null }, 7, 'Deal')
    assert.deepEqual(row.converted_opportunity, { id: 7, name: 'Deal' })
    assert.equal(withOpportunity(row, 7, 'Deal'), row)
    assert.equal(convertNotice(true), OPPORTUNITY_CREATED)
    assert.equal(convertNotice(false), OPPORTUNITY_EXISTS)
    assert.equal(OPPORTUNITY_CREATED, 'Opportunity created')
  })
})

describe('what a refusal of the funnel actions means', () => {
  it('a 403 names the right that is missing when the server said so, and a plain sentence when it did not', () => {
    assert.deepEqual(classifyFunnelFailure(new ApiError('You do not have permission to add an organization. Choose an existing one.', 403)), { kind: 'forbidden', message: 'You do not have permission to add an organization. Choose an existing one.' })
    assert.deepEqual(classifyFunnelFailure(Object.assign(new Error(''), { status: 403 })), { kind: 'forbidden', message: FUNNEL_FORBIDDEN_TEXT })
  })

  it('a 404 says the signal is gone; a 422 shows the server\'s own sentence; a request that never arrived can be sent again', () => {
    assert.deepEqual(classifyFunnelFailure(Object.assign(new Error(''), { status: 404 })), { kind: 'missing', message: NOT_FOUND_TEXT })
    assert.deepEqual(classifyFunnelFailure(new ApiError('Choose a company from the list.', 422)), { kind: 'failed', message: 'Choose a company from the list.' })
    assert.deepEqual(classifyFunnelFailure(new TypeError('Failed to fetch')), { kind: 'failed', message: NETWORK_TEXT })
  })
})

describe('the funnel requests', () => {
  const restore: Array<() => void> = []
  afterEach(() => { for (const fn of restore.splice(0)) fn() })

  function fakeFetch(reply: () => Response | Promise<Response>) {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const original = globalThis.fetch
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => { calls.push({ url: String(url), init }); return reply() }) as typeof fetch
    restore.push(() => { globalThis.fetch = original })
    return calls
  }
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('Add to Prospecting posts to the send-to-prospecting path of that signal and returns the account', async () => {
    const calls = fakeFetch(() => json(201, { status: 1, data: { account_id: 41, created: true } }))
    const result = await signalFunnelService.sendToProspecting(7)
    assert.deepEqual(result.data, { account_id: 41, created: true })
    assert.match(calls[0].url, /\/signals\/opportunities\/7\/send-to-prospecting$/)
    assert.equal(calls[0].init?.method, 'POST')
  })

  it('Convert to opportunity posts the choices to the convert-to-opportunity path', async () => {
    const calls = fakeFetch(() => json(201, { status: 1, data: { opportunity_id: 9, organization_id: 3, created: true } }))
    const body = { organizationName: 'Greenfield School', opportunity: { name: 'Greenfield School - Campus' } }
    const result = await signalFunnelService.convertToOpportunity(7, body)
    assert.equal(result.data.opportunity_id, 9)
    assert.match(calls[0].url, /\/signals\/opportunities\/7\/convert-to-opportunity$/)
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), body)
  })

  it('Convert to lead sends the person only when one was chosen', async () => {
    const calls = fakeFetch(() => json(201, { status: 1, data: { lead_id: '501', created: true } }))
    await signalReviewService.promote(7)
    await signalReviewService.promote(7, { contactId: 3 })
    assert.deepEqual(calls.map((c) => JSON.parse(String(c.init?.body))), [{}, { contactId: 3 }])
    assert.ok(calls.every((c) => /\/signals\/opportunities\/7\/promote-to-crm$/.test(c.url)))
  })

  it('a refusal arrives as an ApiError carrying the status and the server\'s sentence', async () => {
    fakeFetch(() => json(422, { status: 0, code: 'contact_not_contactable', message: 'This person asked not to be contacted, so a lead cannot be made for them.' }))
    await assert.rejects(signalReviewService.promote(7, { contactId: 3 }), (error: unknown) => error instanceof ApiError && error.status === 422 && /asked not to be contacted/.test(error.message))
  })
})
