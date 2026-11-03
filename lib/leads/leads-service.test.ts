import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { crmService } from '../../services/crm'
import type { LaravelContext } from '../laravel-context'
import { contractLead, lead, signal } from './fixtures'

/** The Leads service: the filters leave under the contract's names, and what comes back has the new fields read. No request leaves the process. */

interface Call { url: URL; init?: RequestInit }

const restore: Array<() => void> = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

function fakeFetch(reply: (call: Call) => unknown) {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const call = { url: new URL(String(input), 'http://test.local'), init }
    calls.push(call)
    return new Response(JSON.stringify(reply(call)), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
  return calls
}

const context: LaravelContext = { token: 'test-token', subInstituteId: '1', syear: '', userId: '2', organizationId: '', orgType: '', profileId: '16' }
const listAnswer = (items: unknown[]) => ({ status: 1, message: 'Leads.', data: { items, pagination: { current_page: 1, last_page: 1, per_page: 20, total: items.length } } })

describe('the list request', () => {
  it('sends no filter parameter at all when nothing is filtered, and keeps every parameter it always sent', async () => {
    const calls = fakeFetch(() => listAnswer([]))
    await crmService.getLeads(context, { page: 2, perPage: 20, search: 'asha', sortBy: 'lead_score', sortDir: 'asc' })
    const q = calls[0].url.searchParams
    assert.equal(calls[0].url.pathname.endsWith('/crm/leads'), true)
    assert.deepEqual([q.get('page'), q.get('per_page'), q.get('search'), q.get('sort_by'), q.get('sort_dir')], ['2', '20', 'asha', 'lead_score', 'asc'])
    for (const name of ['product_id', 'consent', 'has_signal']) assert.equal(q.has(name), false, `${name} is not sent when it is not chosen`)
  })

  it('sends the three filters under the contract\'s names: product_id, consent, has_signal=1', async () => {
    const calls = fakeFetch(() => listAnswer([]))
    await crmService.getLeads(context, { productId: 12, consent: 'blocked', hasSignal: true })
    const q = calls[0].url.searchParams
    assert.equal(q.get('product_id'), '12')
    assert.equal(q.get('consent'), 'blocked')
    assert.equal(q.get('has_signal'), '1')
  })

  it('treats a product id of 0 and a false hasSignal as "all" (nothing is sent)', async () => {
    const calls = fakeFetch(() => listAnswer([]))
    await crmService.getLeads(context, { productId: 0, hasSignal: false })
    const q = calls[0].url.searchParams
    assert.equal(q.has('product_id'), false)
    assert.equal(q.has('has_signal'), false)
  })

  it('sends allowed as well as blocked for consent', async () => {
    const calls = fakeFetch(() => listAnswer([]))
    await crmService.getLeads(context, { consent: 'allowed' })
    assert.equal(calls[0].url.searchParams.get('consent'), 'allowed')
  })
})

describe('the answers', () => {
  it('a list from an older server (none of the new fields) comes back as it was sent, with no field invented', async () => {
    fakeFetch(() => listAnswer([lead({ id: '1' }), lead({ id: '2', firstName: 'Ravi' })]))
    const response = await crmService.getLeads(context)
    assert.equal(response.data.items.length, 2)
    assert.deepEqual(response.data.items[1], lead({ id: '2', firstName: 'Ravi' }))
    assert.equal(response.data.pagination.total, 2, 'the pagination is untouched')
    for (const item of response.data.items) for (const key of ['product', 'organisationAccount', 'sourceSignalId', 'sourceSignal', 'consent']) assert.equal(key in item, false, `${key} is not invented`)
  })

  it('a list from the new server has its contract fields read into the names the screens use', async () => {
    fakeFetch(() => listAnswer([contractLead(), contractLead({ id: '42', product: null, organisation_account: null, source_signal_id: null })]))
    const response = await crmService.getLeads(context)
    assert.deepEqual(response.data.items[0].product, { id: 9, key: 'scholarclone-erp', name: 'School ERP' })
    assert.deepEqual(response.data.items[0].organisationAccount, { id: 58, name: 'Hillcrest Academy' })
    assert.equal(response.data.items[0].sourceSignalId, 77)
    assert.equal(response.data.items[1].product, null)
    assert.equal(response.data.items[1].organisationAccount, null)
    assert.equal(response.data.items[1].sourceSignalId, null)
  })

  it('one lead has its signal and its consent read, in either spelling', async () => {
    fakeFetch(() => ({ status: 1, message: 'Lead.', data: contractLead({
      source_signal: { id: 77, title: 'A signal', source_url: 'https://a.example/x', event_date: '2026-10-12', business_fit: 'g2g' },
      consent: { email: { allowed: false, reason: 'They opted out.' }, sms: { allowed: true, reason: null } },
    }) }))
    const response = await crmService.getLead(context, '41')
    assert.deepEqual(response.data.sourceSignal, {
      id: 77, title: 'A signal', sourceUrl: 'https://a.example/x', eventDate: '2026-10-12', sourcePublishedAt: null, businessFit: 'g2g', quote: null, quoteKind: null,
    })
    assert.deepEqual(response.data.consent, { email: { allowed: false, reason: 'They opted out.' }, sms: { allowed: true, reason: null } })

    fakeFetch(() => ({ status: 1, message: 'Lead.', data: { ...lead(), sourceSignal: signal({ quote: 'We will tender in March.' }) } }))
    const camel = await crmService.getLead(context, '41')
    assert.equal(camel.data.sourceSignal?.quote, 'We will tender in March.')
    assert.equal(camel.data.sourceSignal?.sourceUrl, 'https://news.example.com/hillcrest-erp')
  })

  it('one lead from an older server comes back untouched', async () => {
    fakeFetch(() => ({ status: 1, message: 'Lead.', data: lead() }))
    const response = await crmService.getLead(context, '41')
    assert.deepEqual(response.data, lead())
  })
})
