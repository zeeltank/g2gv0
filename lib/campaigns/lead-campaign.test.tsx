import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent } from '../agent/assertions'
import { lead } from '../leads/fixtures'
import { fakeFacts, screenKit } from '../leads/screen-kit'
import type { Lead } from '../../types/crm'
import { withLeadCampaign } from './model'

/**
 * A lead's page names the campaign the lead first came from, in the header line the Leads screen already has. The lead handed to the page went through the
 * same reader the service uses (`withLeadCampaign`, which lib/campaigns/campaigns-service.test.ts proves is wired into `crmService.getLead`).
 */

const picklists = { leadStatus: [], leadSource: [], industry: [], rating: [] }

async function open(over: Record<string, unknown> = {}) {
  const screen = await screenKit({ pathname: '/module/crm/marketing/leads/41' })
  const { LeadDetailPage } = await import('../../components/domain/crm/lead-detail-page')
  const { service } = fakeFacts()
  const read = withLeadCampaign({ ...lead(), ...over } as unknown as Lead)
  await screen.mount(screen.k.h(LeadDetailPage, { lead: read, onSaved: () => undefined, onBack: () => undefined, picklists, factsService: service }), 40)
  const { k } = screen
  return { ...screen, context: () => k.one('[data-lead-context]'), campaign: () => k.one('[data-lead-campaign]'), tabs: () => k.all('div.flex.gap-1.border-b button').map((b) => b.textContent) }
}

describe('a lead\'s page: the campaign it came from', () => {
  afterEach(async () => { await disposeAll() })

  it('says "Campaign: <name>" in the header line, beside the product and the organisation', async () => {
    const s = await open({ campaign: { id: 7, name: 'Diwali outreach' }, product: { id: 9, key: null, name: 'School ERP' }, organisationAccount: { id: 58, name: 'Hillcrest Academy' } })
    assert.equal(s.campaign()!.textContent, 'Campaign: Diwali outreach')
    assert.equal(s.k.one('[data-lead-product]')!.textContent, 'Product: School ERP')
    assert.equal(s.k.one('[data-lead-organisation]')!.textContent, 'Organisation: Hillcrest Academy')
    assert.ok(s.context()!.contains(s.campaign()), 'it is in the existing line, not a new block')
    s.restore()
  })

  it('draws the line for a lead whose only fact is its campaign', async () => {
    const s = await open({ campaign: { id: 7, name: 'Diwali outreach' } })
    assert.equal(s.campaign()!.textContent, 'Campaign: Diwali outreach')
    s.restore()
  })

  it('names nothing for a lead that came from no campaign, and for an older server, and draws no empty line', async () => {
    const none = await open({ campaign: null })
    absent(none.campaign(), 'campaign: null')
    absent(none.context(), 'nothing else to say, so no line')
    none.restore()
    await disposeAll()
    const older = await open()
    absent(older.campaign(), 'no key at all')
    absent(older.context(), 'the header is as it was')
    older.restore()
  })

  it('does not turn the free text a lead always had into a campaign: the old campaign text is not shown as one', async () => {
    const s = await open({ campaignText: 'Diwali', campaign: 'Diwali' })
    absent(s.campaign(), 'a text is not a campaign {id, name}')
    s.restore()
  })

  it('shows a campaign name as text, never as markup', async () => {
    const s = await open({ campaign: { id: 7, name: '<img src=x onerror=alert(1)> Diwali' } })
    assert.equal(s.campaign()!.textContent, 'Campaign: <img src=x onerror=alert(1)> Diwali')
    absent(s.campaign()!.querySelector('img'), 'no element was made from the name')
    s.restore()
  })

  it('adds no tab, no button and no link to the page', async () => {
    const withCampaign = await open({ campaign: { id: 7, name: 'Diwali outreach' } })
    const tabs = withCampaign.tabs()
    const buttons = withCampaign.k.all('button').length
    assert.equal(withCampaign.campaign()!.querySelectorAll('a, button').length, 0)
    withCampaign.restore()
    await disposeAll()
    const older = await open()
    assert.deepEqual(tabs, older.tabs())
    assert.equal(buttons, older.k.all('button').length)
    older.restore()
  })

  it('has nothing for the accessibility rules to find in the header line', async () => {
    const s = await open({ campaign: { id: 7, name: 'Diwali outreach' }, product: { id: 9, key: null, name: 'School ERP' } })
    assert.deepEqual(await axeViolations(s.context()!), [])
    s.restore()
  })
})
