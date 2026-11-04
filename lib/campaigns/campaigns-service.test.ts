import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { campaignService } from '../../services/gtm/campaigns'
import { crmService } from '../../services/crm'
import type { LaravelContext } from '../laravel-context'
import { contractLead, lead } from '../leads/fixtures'
import { campaign, contractDetail, gtmDetail, listAnswer, PRODUCT } from './fixtures'

/** The campaign services: what comes back has the new fields read, an older server's answer comes back untouched, and a write carries what the form gave it. No request leaves the process. */

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
const leadsAnswer = (items: unknown[]) => ({ status: 1, message: 'Leads.', data: { items, pagination: { current_page: 1, last_page: 1, per_page: 20, total: items.length } } })

describe('the CRM campaign list and detail', () => {
  it('a list from an older server comes back as it was sent, with no field invented', async () => {
    fakeFetch(() => listAnswer([campaign({ id: '1' }), campaign({ id: '2', name: 'Pongal drive' })]))
    const response = await crmService.getCampaigns(context)
    assert.equal(response.data.items.length, 2)
    assert.deepEqual(response.data.items[1], campaign({ id: '2', name: 'Pongal drive' }))
    assert.equal(response.data.pagination.total, 2, 'the pagination is untouched')
    for (const item of response.data.items) for (const key of ['product', 'funnel', 'gtmCampaign', 'leads']) assert.equal(key in item, false, `${key} is not invented`)
  })

  it('a list from the new server has the product of each campaign read (and only the product: the list does not carry the rest)', async () => {
    fakeFetch(() => listAnswer([campaign({ id: '1', product: PRODUCT }), campaign({ id: '2', product: null })]))
    const response = await crmService.getCampaigns(context)
    assert.deepEqual(response.data.items[0].product, PRODUCT)
    assert.equal(response.data.items[1].product, null)
    for (const key of ['funnel', 'gtmCampaign', 'leads']) assert.equal(key in response.data.items[0], false, `${key} is not on the list`)
  })

  it('the list reads each product: an id sent as text is a number, and a product with no name is named by its number', async () => {
    fakeFetch(() => listAnswer([campaign({ id: '1', product: { id: '9', name: '  ' } })]))
    const response = await crmService.getCampaigns(context)
    assert.deepEqual(response.data.items[0].product, { id: 9, key: null, name: 'Product #9' })
  })

  it('the list request is exactly what it was: no new parameter', async () => {
    const calls = fakeFetch(() => listAnswer([]))
    await crmService.getCampaigns(context, { page: 2, perPage: 20, search: 'diwali', sortBy: 'name', sortDir: 'asc', campaignStatus: 'Active' })
    const q = calls[0].url.searchParams
    assert.ok(calls[0].url.pathname.endsWith('/crm/campaigns'))
    assert.deepEqual([q.get('page'), q.get('per_page'), q.get('search'), q.get('sort_by'), q.get('sort_dir'), q.get('campaign_status')], ['2', '20', 'diwali', 'name', 'asc', 'Active'])
    assert.deepEqual(Array.from(q.keys()).filter((key) => /product|funnel|campaign_id/.test(key)), [])
  })

  it('a detail from the new server has its product, funnel, GTM campaign and leads count read into the names the screens use', async () => {
    fakeFetch(() => ({ status: 1, message: 'Campaign.', data: contractDetail() }))
    const response = await crmService.getCampaign(context, '7')
    assert.deepEqual(response.data.product, PRODUCT)
    assert.deepEqual(response.data.funnel, { targets: 40, sent: 30, opened: 12, replied: 6, meetings: 3, converted: 1, optedOut: 2 })
    assert.deepEqual(response.data.gtmCampaign, { id: 5, name: 'Diwali GTM', status: 'active' })
    assert.deepEqual(response.data.leads, { count: 4 })
    assert.equal(response.data.name, 'Diwali outreach', 'the existing fields are untouched')
    assert.equal(response.data.productId, null)
  })

  it('a detail from an older server comes back untouched', async () => {
    fakeFetch(() => ({ status: 1, message: 'Campaign.', data: campaign() }))
    const response = await crmService.getCampaign(context, '7')
    assert.deepEqual(response.data, campaign())
  })

  it('a create and an edit send what the form gave them, product included only when the form put it in', async () => {
    const calls = fakeFetch(() => ({ status: 1, message: 'Campaign saved.', data: campaign() }))
    await crmService.createCampaign(context, { name: 'Diwali', product_master_id: 9 })
    await crmService.updateCampaign(context, '7', { name: 'Diwali', product_master_id: null })
    await crmService.updateCampaign(context, '7', { name: 'Diwali' })
    const bodies = calls.map((call) => JSON.parse(String(call.init?.body)) as Record<string, unknown>)
    assert.equal(bodies[0].product_master_id, 9)
    assert.ok('product_master_id' in bodies[1] && bodies[1].product_master_id === null)
    assert.equal('product_master_id' in bodies[2], false)
    assert.deepEqual(calls.map((call) => call.init?.method), ['POST', 'PUT', 'PUT'])
  })
})

describe('the CRM lead list and detail: the campaign a lead came from', () => {
  it('a lead with a campaign has it read, and the slice-6 fields are still read beside it', async () => {
    fakeFetch(() => leadsAnswer([contractLead({ campaign: { id: 7, name: 'Diwali outreach' } }), contractLead({ id: '42', campaign: null })]))
    const response = await crmService.getLeads(context)
    assert.deepEqual(response.data.items[0].campaign, { id: 7, name: 'Diwali outreach' })
    assert.equal(response.data.items[1].campaign, null)
    assert.deepEqual(response.data.items[0].product, { id: 9, key: 'scholarclone-erp', name: 'School ERP' })
    assert.deepEqual(response.data.items[0].organisationAccount, { id: 58, name: 'Hillcrest Academy' })
  })

  it('the lead list reads each campaign: an id sent as text is a number, and a campaign with no name is named by its number', async () => {
    fakeFetch(() => leadsAnswer([contractLead({ campaign: { id: '7', name: 'Diwali outreach' } }), contractLead({ id: '42', campaign: { id: 8, name: '  ' } })]))
    const response = await crmService.getLeads(context)
    assert.deepEqual(response.data.items[0].campaign, { id: 7, name: 'Diwali outreach' })
    assert.deepEqual(response.data.items[1].campaign, { id: 8, name: 'Campaign #8' })
  })

  it('one lead has its campaign read; a lead from an older server comes back untouched', async () => {
    fakeFetch(() => ({ status: 1, message: 'Lead.', data: { ...lead(), campaign: { id: '7', name: 'Diwali outreach' } } }))
    const response = await crmService.getLead(context, '41')
    assert.deepEqual(response.data.campaign, { id: 7, name: 'Diwali outreach' })

    fakeFetch(() => ({ status: 1, message: 'Lead.', data: lead() }))
    const older = await crmService.getLead(context, '41')
    assert.deepEqual(older.data, lead())
    assert.equal('campaign' in older.data, false)
  })

  it('a list from an older server comes back untouched', async () => {
    fakeFetch(() => leadsAnswer([lead({ id: '1' })]))
    const response = await crmService.getLeads(context)
    assert.deepEqual(response.data.items[0], lead({ id: '1' }))
  })
})

describe('the GTM campaign service', () => {
  it('hands the detail answer over as it is, with product and crm_campaign in it, for the screen to read', async () => {
    fakeFetch(() => ({ status: 1, data: gtmDetail({ product: PRODUCT, crm_campaign: { id: 7, name: 'Diwali outreach', status: 'Active' } }) }))
    const response = await campaignService.get(5)
    assert.deepEqual(response.data.product, PRODUCT)
    assert.deepEqual(response.data.crm_campaign, { id: 7, name: 'Diwali outreach', status: 'Active' })
    assert.equal(response.data.campaign.name, 'Diwali GTM')
  })
})
