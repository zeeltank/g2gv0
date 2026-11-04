import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, says } from '../agent/assertions'
import type { Campaign } from '../../types/crm'
import { withCampaignExtras } from './model'
import { campaign, contractDetail, FUNNEL } from './fixtures'
import { screenKit } from './screen-kit'

/**
 * A CRM campaign's page as a person meets it: the real page, the real sidebar hook, only the network replaced. The campaign handed to it went through the
 * same reader the service uses (`withCampaignExtras`, which lib/campaigns/campaigns-service.test.ts proves is wired into `crmService.getCampaign`).
 */

const picklists = { campaignType: [], campaignStatus: [], expectedResponse: [] }

async function open(raw: Record<string, unknown>) {
  const screen = await screenKit({ pathname: '/module/crm/marketing/campaigns/7' })
  const { CampaignDetailPage } = await import('../../components/domain/crm/campaign-detail-page')
  const campaignProp = withCampaignExtras(raw as unknown as Campaign)
  await screen.mount(screen.k.h(CampaignDetailPage, { campaign: campaignProp, onSaved: () => undefined, onBack: () => undefined, picklists }), 40)
  const { k } = screen
  const funnel = () => k.one('[data-campaign-funnel]')
  const links = () => k.one('[data-campaign-links]')
  const step = (key: string) => k.one(`[data-funnel-step="${key}"]`)
  const count = (key: string) => k.one(`[data-funnel-count="${key}"]`)?.textContent
  const share = (key: string) => k.one(`[data-funnel-share="${key}"]`)?.textContent ?? null
  const linkValue = (name: string) => k.one(`[data-campaign-link="${name}"] p:last-child`)?.textContent
  return { ...screen, funnel, links, step, count, share, linkValue }
}

describe('a campaign\'s page against an older server (none of slice 9\'s fields)', () => {
  afterEach(async () => { await disposeAll() })

  it('looks exactly as it always did: no Funnel, no Product and links, the same sections and tabs', async () => {
    const s = await open(campaign())
    absent(s.funnel(), 'no funnel was sent, so none is drawn')
    absent(s.links(), 'nothing to say about the product or links')
    const text = s.k.bodyText()
    for (const heading of ['Campaign Details', 'Expectations & Actuals', 'Description']) assert.ok(text.includes(heading), heading)
    assert.equal(text.includes('Funnel'), false)
    assert.deepEqual(s.k.all('div.flex.gap-1.border-b button').map((b) => b.textContent), ['Details', 'Targets', 'History'])
    s.restore()
  })

  it('keeps its header buttons (including the ones it always had)', async () => {
    const s = await open(campaign())
    for (const label of ['Back to Campaigns', 'Send Campaign', 'Edit']) assert.ok(s.k.all('button').some((b) => b.textContent?.includes(label)), label)
    s.restore()
  })
})

describe('a campaign\'s page: the Funnel', () => {
  afterEach(async () => { await disposeAll() })

  it('shows the steps in order, each with its number, and its share of the step before in words', async () => {
    const s = await open(contractDetail())
    assert.deepEqual(s.k.all('[data-funnel-step]').map((li) => li.getAttribute('data-funnel-step')), ['targets', 'sent', 'opened', 'replied', 'meetings', 'converted'])
    assert.deepEqual(s.k.all('[data-funnel-label]').map((e) => e.textContent), ['Targets', 'Sent', 'Opened', 'Replied', 'Meetings booked', 'Converted', 'Opted out'])
    assert.deepEqual(['targets', 'sent', 'opened', 'replied', 'meetings', 'converted', 'opted_out'].map((key) => s.count(key)), ['40', '30', '12', '6', '3', '1', '2'])
    assert.equal(s.share('targets'), null, 'nothing comes before the first step')
    assert.equal(s.share('sent'), '75% of targets')
    assert.equal(s.share('opened'), '40% of sent')
    assert.equal(s.share('replied'), '50% of opened')
    assert.equal(s.share('meetings'), '50% of replied')
    assert.equal(s.share('converted'), '33% of meetings booked')
    absent(s.k.one('[data-funnel-quiet]'), 'there is activity, so the "nothing recorded" wording is not shown')
    absent(s.k.one('[data-funnel-empty]'), 'there are targets, so the "no targets" wording is not shown')
    const list = s.k.one('[data-campaign-funnel] ol')
    assert.ok(list !== null, 'the steps are an ordered list')
    assert.match(list!.getAttribute('aria-label') ?? '', /funnel/i, 'the list is named for a screen reader')
    s.restore()
  })

  it('names its two sections for a screen reader: Funnel, and Product and links', async () => {
    const s = await open(contractDetail())
    const nameOf = (section: Element | null) => {
      const id = section?.getAttribute('aria-labelledby')
      return id ? s.k.w.document.getElementById(id)?.textContent ?? null : null
    }
    assert.equal(nameOf(s.funnel()), 'Funnel')
    assert.equal(nameOf(s.links()), 'Product and links')
    s.restore()
  })

  it('shows Opted out apart from the steps, as a share of the targets', async () => {
    const s = await open(contractDetail())
    const optedOut = s.k.one('[data-funnel-opted-out]')!
    absent(s.step('opted_out'), 'it is not one of the ordered steps')
    says(optedOut.textContent, 'Opted out')
    assert.equal(s.share('opted_out'), '5% of targets')
    s.restore()
  })

  it('carries every number as text; the bars are decoration that a screen reader skips', async () => {
    const s = await open(contractDetail())
    const bars = s.k.all('[data-campaign-funnel] [aria-hidden="true"]')
    assert.equal(bars.length, 7, 'one bar per step and one for Opted out, all hidden from a screen reader')
    for (const key of ['targets', 'sent', 'opened', 'replied', 'meetings', 'converted']) assert.match(s.step(key)!.textContent ?? '', /\d/, `${key} has its number in the text`)
    // The widths are the shares of the targets (40 targets: 40, 30, 12, 6, 3, 1 and 2 opted out), and the number does not depend on them.
    assert.deepEqual(bars.map((bar) => (bar.firstElementChild as HTMLElement).style.width), ['100%', '75%', '30%', '15%', '7.5%', '2.5%', '5%'])
    s.restore()
  })

  it('says what the numbers are, once: recorded against each target, not the mail log', async () => {
    const s = await open(contractDetail())
    const basis = s.k.one('[data-funnel-basis]')!.textContent
    says(basis, 'recorded against each target')
    says(basis, 'Num Sent')
    absent(s.k.one('[data-funnel-above]'), 'nothing is above its predecessor here, so that note is not shown')
    s.restore()
  })

  it('shows a step above its predecessor exactly as it is, with its share over 100%, and explains it', async () => {
    const s = await open(contractDetail({ funnel: { ...FUNNEL, sent: 10, opened: 15, replied: 0, meetings: 0, converted: 0 } }))
    assert.equal(s.count('opened'), '15', 'not capped, not hidden')
    assert.equal(s.share('opened'), '150% of sent')
    assert.equal(s.count('sent'), '10')
    says(s.k.one('[data-funnel-above]')!.textContent, 'A step can be higher than the one before it')
    s.restore()
  })

  it('never divides by zero: a step after a step with none recorded has its number and a plain "no share"', async () => {
    const s = await open(contractDetail({ funnel: { ...FUNNEL, sent: 0, opened: 5, replied: 0, meetings: 0, converted: 0 } }))
    assert.equal(s.count('opened'), '5')
    assert.equal(s.share('opened'), 'no share: 0 sent')
    assert.equal(s.funnel()!.textContent!.includes('NaN') || s.funnel()!.textContent!.includes('Infinity'), false)
    s.restore()
  })

  it('says there are no targets yet, with what to do, instead of a row of zeros', async () => {
    const s = await open(contractDetail({ funnel: { targets: 0, sent: 0, opened: 0, replied: 0, meetings: 0, converted: 0, opted_out: 0 } }))
    const empty = s.k.one('[data-funnel-empty]')!
    says(empty.textContent, 'No targets yet')
    says(empty.textContent, 'Targets tab')
    absent(s.step('sent'), 'no steps are drawn for a funnel with nothing to count')
    s.restore()
  })

  it('says nothing has been recorded yet when there are targets and no activity', async () => {
    const s = await open(contractDetail({ funnel: { targets: 12, sent: 0, opened: 0, replied: 0, meetings: 0, converted: 0, opted_out: 0 } }))
    says(s.k.one('[data-funnel-quiet]')!.textContent, 'Nothing has been recorded')
    assert.equal(s.count('targets'), '12')
    assert.equal(s.count('sent'), '0')
    s.restore()
  })

  it('is not drawn when the server sent a funnel it cannot read', async () => {
    const s = await open(contractDetail({ funnel: { sent: 3 } }))
    absent(s.funnel(), 'no target count, so no funnel')
    s.restore()
  })
})

describe('a campaign\'s page: Product and links', () => {
  afterEach(async () => { await disposeAll() })

  it('names the product, the GTM campaign with its status, and the number of leads, as plain text', async () => {
    const s = await open(contractDetail())
    assert.equal(s.linkValue('product'), 'School ERP')
    assert.equal(s.linkValue('gtm'), 'Diwali GTM (active)')
    assert.equal(s.linkValue('leads'), '4 leads first came from this campaign')
    assert.equal(s.links()!.querySelectorAll('a, button').length, 0, 'the leads count is not a link: the Leads screen has no campaign filter to open')
    s.restore()
  })

  it('labels each line: Product, GTM campaign and Leads', async () => {
    const s = await open(contractDetail())
    const label = (name: string) => s.k.one(`[data-campaign-link="${name}"] p:first-child`)?.textContent
    assert.deepEqual([label('product'), label('gtm'), label('leads')], ['Product', 'GTM campaign', 'Leads'])
    s.restore()
  })

  it('says "No product chosen", "None linked" and no leads, when the server says there are none', async () => {
    const s = await open(contractDetail({ product: null, gtm_campaign: null, leads: { count: 0 } }))
    assert.equal(s.linkValue('product'), 'No product chosen')
    assert.equal(s.linkValue('gtm'), 'None linked')
    assert.equal(s.linkValue('leads'), 'No leads have come from this campaign yet')
    s.restore()
  })

  it('says one lead in the singular', async () => {
    const s = await open(contractDetail({ leads: { count: 1 } }))
    assert.equal(s.linkValue('leads'), '1 lead first came from this campaign')
    s.restore()
  })

  it('draws only the lines the server spoke to (the list answer carries the product alone)', async () => {
    const s = await open(campaign({ product: { id: 9, name: 'School ERP' } }))
    assert.equal(s.linkValue('product'), 'School ERP')
    absent(s.k.one('[data-campaign-link="gtm"]'), 'no GTM line without the key')
    absent(s.k.one('[data-campaign-link="leads"]'), 'no leads line without the key')
    absent(s.funnel(), 'no funnel without the key')
    s.restore()
  })
})

describe('a campaign\'s page: nothing is sent, and it reads right', () => {
  afterEach(async () => { await disposeAll() })

  it('adds no button and no link of its own to the page: the new sections only read', async () => {
    const s = await open(contractDetail())
    assert.equal(s.funnel()!.querySelectorAll('button, a, input, select, [role="button"]').length, 0)
    assert.equal(s.links()!.querySelectorAll('button, a, input, select, [role="button"]').length, 0)
    const wasThere = ['Back to Campaigns', 'Send Campaign', 'Edit', 'Details', 'Targets', 'History']
    assert.deepEqual(s.k.all('button').map((b) => b.textContent?.trim()).filter((t) => t && !wasThere.includes(t)), [], 'every button on the page was there before')
    s.restore()
  })

  it('has nothing for the accessibility rules to find, with a funnel, with an empty one and with none', async () => {
    for (const raw of [contractDetail(), contractDetail({ funnel: { ...FUNNEL, sent: 10, opened: 15 } }), contractDetail({ funnel: { targets: 0, sent: 0, opened: 0, replied: 0, meetings: 0, converted: 0, opted_out: 0 } }), campaign()]) {
      const s = await open(raw)
      assert.deepEqual(await axeViolations(s.k.w.document.body), [])
      s.restore()
      await disposeAll()
    }
  })
})
