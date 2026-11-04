import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent } from '../agent/assertions'
import { gtmDetail, PRODUCT } from './fixtures'
import { screenKit } from './screen-kit'

/** The GTM campaign's page as a person meets it: the real page, the real sidebar hook and service client, only the network replaced. */

const CRM = { id: 7, name: 'Diwali outreach', status: 'Active' }

async function open(detail: Record<string, unknown>, opts: { campaigns?: boolean } = {}) {
  const screen = await screenKit({
    pathname: '/gtm/campaigns',
    campaigns: opts.campaigns,
    respond: (call) => (call.path.endsWith('/gtm/campaigns/5') ? { status: 1, data: detail } : undefined),
  })
  const { CampaignDetailView } = await import('../../components/domain/gtm/campaigns-detail')
  await screen.mount(screen.k.h(CampaignDetailView, { id: 5, segments: [], ownerName: () => 'Asha Menon', onBack: () => undefined, onEdit: () => undefined, onChanged: () => undefined }), 60)
  const { k } = screen
  const line = () => k.one('[data-gtm-links]')
  return { ...screen, line, productLine: () => k.one('[data-gtm-product]')?.textContent ?? null, crmLine: () => k.one('[data-gtm-crm-campaign]')?.textContent ?? null, crmLink: () => k.one('[data-gtm-crm-link]') as HTMLAnchorElement | null }
}

describe('the GTM campaign page against an older server (no product, no crm_campaign)', () => {
  afterEach(async () => { await disposeAll() })

  it('looks exactly as it always did: its heading, its owner line, its sections, and no link line', async () => {
    const s = await open(gtmDetail())
    assert.ok(s.k.bodyText().includes('Diwali GTM'), 'the page really loaded')
    assert.ok(s.k.bodyText().includes('Owner: Asha Menon'))
    assert.ok(s.k.bodyText().includes('Results'))
    assert.ok(s.k.bodyText().includes('Targets (0 accounts)'))
    absent(s.line(), 'the server said nothing about a product or a CRM campaign, so no line is drawn')
    s.restore()
  })
})

describe('the GTM campaign page: product and linked CRM campaign', () => {
  afterEach(async () => { await disposeAll() })

  it('shows the product and the CRM campaign it is the same as, as read-only lines', async () => {
    const s = await open(gtmDetail({ product: PRODUCT, crm_campaign: CRM }))
    assert.equal(s.productLine(), 'Product: School ERP')
    assert.equal(s.crmLine(), 'CRM campaign: Diwali outreach (Active)')
    assert.equal(s.line()!.textContent, 'Product: School ERP · CRM campaign: Diwali outreach (Active)', 'one line, the two parts told apart by a separator')
    s.restore()
  })

  it('links the CRM campaign to its page when the person\'s menu holds the Campaigns row', async () => {
    const s = await open(gtmDetail({ product: PRODUCT, crm_campaign: CRM }))
    const link = s.crmLink()!
    assert.ok(link, 'a link')
    assert.equal(link.getAttribute('href'), '/module/crm/marketing/campaigns/7')
    assert.equal(link.textContent, 'Diwali outreach (Active)')
    s.restore()
  })

  it('shows the name as plain text, and no link to a page they cannot open, when the menu does not hold the Campaigns row', async () => {
    const s = await open(gtmDetail({ product: PRODUCT, crm_campaign: CRM }), { campaigns: false })
    absent(s.crmLink(), 'no link')
    assert.equal(s.crmLine(), 'CRM campaign: Diwali outreach (Active)')
    assert.equal(s.line()!.querySelectorAll('a').length, 0)
    s.restore()
  })

  it('says so plainly when there is no product and no linked CRM campaign', async () => {
    const s = await open(gtmDetail({ product: null, crm_campaign: null }))
    assert.equal(s.productLine(), 'Product: No product chosen')
    assert.equal(s.crmLine(), 'CRM campaign: Not linked to a CRM campaign')
    absent(s.crmLink(), 'nothing to link to')
    s.restore()
  })

  it('draws only the line the server spoke to', async () => {
    const s = await open(gtmDetail({ product: PRODUCT }))
    assert.equal(s.productLine(), 'Product: School ERP')
    absent(s.k.one('[data-gtm-crm-campaign]'), 'no CRM line without the key')
    s.restore()
  })

  it('is read-only: the lines hold no button, no input and no select, and the page gains no send or schedule control', async () => {
    const s = await open(gtmDetail({ product: PRODUCT, crm_campaign: CRM }))
    assert.equal(s.line()!.querySelectorAll('button, input, select, textarea').length, 0)
    const before = await open(gtmDetail())
    const labels = (x: typeof s) => x.k.all('button').map((b) => b.textContent?.trim())
    const withLinks = labels(s)
    before.restore()
    s.restore()
    assert.ok(withLinks.length >= 2, 'the page is really there')
    assert.deepEqual(withLinks.filter((l) => /send|schedule/i.test(l ?? '')), [])
  })

  it('has nothing for the accessibility rules to find in the new lines, and adds nothing to what the page already had', async () => {
    const s = await open(gtmDetail({ product: PRODUCT, crm_campaign: CRM }))
    assert.deepEqual(await axeViolations(s.line()!), [], 'the new lines themselves')
    const withLines = await axeViolations(s.k.w.document.body)
    s.restore()
    await disposeAll()
    const older = await open(gtmDetail())
    const before = await axeViolations(older.k.w.document.body)
    older.restore()
    // The page's own shared controls (a segment Select, a checkbox) were already named by nothing: older than this work, and the same with or without the lines.
    assert.deepEqual(withLines, before, `the lines add no violation (the page's own: ${before.join(' | ')})`)
  })
})
