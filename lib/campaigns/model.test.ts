import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Campaign, CampaignFunnel, Lead } from '../../types/crm'
import {
  barPercent, campaignColumnCount, chosenProduct, count, crmCampaignHref, crmCampaignText, FUNNEL_STEPS, funnelView, gtmCampaignText, leadCampaignName, leadsText, noteProductSeen,
  NO_PRODUCT_CHOICE, NO_PRODUCT_TEXT, productChoices, productPayload, productText, readCampaignExtras, readGtmLinks, readLeadCampaign, shareText, showProductChoice, stepShare,
  withCampaignExtras, withLeadCampaign,
} from './model'

const options = [
  { id: 4, key: 'scholarclone', name: 'ScholarClone', kind: 'product' as const, parentId: null, label: 'ScholarClone' },
  { id: 9, key: 'scholarclone-erp', name: 'School ERP', kind: 'sub_product' as const, parentId: 4, label: 'ScholarClone › School ERP' },
]

const funnel = (over: Partial<CampaignFunnel> = {}): CampaignFunnel => ({ targets: 40, sent: 30, opened: 12, replied: 6, meetings: 3, converted: 1, optedOut: 2, ...over })

describe('reading a campaign\'s new fields (every one optional, both casings)', () => {
  it('reads the contract\'s answer: product, funnel, gtm_campaign and leads', () => {
    const extras = readCampaignExtras({
      id: '7', name: 'Diwali', product: { id: 9, key: 'scholarclone-erp', name: 'School ERP' },
      funnel: { targets: 40, sent: 30, opened: 12, replied: 6, meetings: 3, converted: 1, opted_out: 2 },
      gtm_campaign: { id: 5, name: 'Diwali GTM', status: 'active' }, leads: { count: 4 },
    })
    assert.deepEqual(extras, {
      product: { id: 9, key: 'scholarclone-erp', name: 'School ERP' },
      funnel: { targets: 40, sent: 30, opened: 12, replied: 6, meetings: 3, converted: 1, optedOut: 2 },
      gtmCampaign: { id: 5, name: 'Diwali GTM', status: 'active' },
      leads: { count: 4 },
    })
  })

  it('also reads the presenter\'s own camelCase (gtmCampaign, optedOut)', () => {
    const extras = readCampaignExtras({ funnel: { targets: 3, optedOut: 1 }, gtmCampaign: { id: 5, name: 'X', status: null } })
    assert.equal(extras.funnel?.optedOut, 1)
    assert.deepEqual(extras.gtmCampaign, { id: 5, name: 'X', status: null })
  })

  it('reads only what was sent: an older server\'s answer gives nothing, so a screen can tell "not said" from "none"', () => {
    assert.deepEqual(readCampaignExtras({ id: '7', name: 'Old' }), {})
    assert.deepEqual(readCampaignExtras(null), {})
    assert.deepEqual(readCampaignExtras('text'), {})
    assert.deepEqual(readCampaignExtras([1, 2]), {})
    assert.deepEqual(readCampaignExtras({ product: null, funnel: null, gtm_campaign: null, leads: null }), { product: null, funnel: null, gtmCampaign: null, leads: null })
    const onlyProduct = readCampaignExtras({ product: { id: 4, name: 'A' } })
    assert.deepEqual(Object.keys(onlyProduct), ['product'], 'the list answer carries the product alone, and the other three stay out')
  })

  it('a funnel without a readable target count is not a funnel; a missing or unreadable stage is 0', () => {
    assert.equal(readCampaignExtras({ funnel: { sent: 3 } }).funnel, null)
    assert.equal(readCampaignExtras({ funnel: { targets: 'many' } }).funnel, null)
    assert.equal(readCampaignExtras({ funnel: [] }).funnel, null)
    assert.deepEqual(readCampaignExtras({ funnel: { targets: '8', sent: '5', opened: -2, replied: 1.5, meetings: 'x', converted: null } }).funnel, {
      targets: 8, sent: 5, opened: 0, replied: 0, meetings: 0, converted: 0, optedOut: 0,
    })
  })

  it('a target count of 0 is a real funnel (an empty one)', () => {
    assert.deepEqual(readCampaignExtras({ funnel: { targets: 0, sent: 0, opened: 0, replied: 0, meetings: 0, converted: 0, opted_out: 0 } }).funnel?.targets, 0)
  })

  it('names what has no name, and drops what has no id', () => {
    assert.equal(readCampaignExtras({ product: { id: 3, name: '  ' } }).product?.name, 'Product #3')
    assert.equal(readCampaignExtras({ gtm_campaign: { id: 8 } }).gtmCampaign?.name, 'GTM campaign #8')
    assert.equal(readCampaignExtras({ gtm_campaign: { id: 8, name: 'A', status: '  ' } }).gtmCampaign?.status, null)
    assert.equal(readCampaignExtras({ product: { id: 0, name: 'A' } }).product, null)
    assert.equal(readCampaignExtras({ product: { name: 'A' } }).product, null)
    assert.equal(readCampaignExtras({ gtm_campaign: { id: 'x', name: 'A' } }).gtmCampaign, null)
  })

  it('reads a leads count of 0 or more, and nothing else', () => {
    assert.deepEqual(readCampaignExtras({ leads: { count: 0 } }).leads, { count: 0 })
    assert.deepEqual(readCampaignExtras({ leads: { count: '12' } }).leads, { count: 12 })
    assert.equal(readCampaignExtras({ leads: { count: -1 } }).leads, null)
    assert.equal(readCampaignExtras({ leads: 5 }).leads, null)
  })

  it('withCampaignExtras keeps every existing field and adds the read ones', () => {
    const raw = { id: '7', name: 'Diwali', campaignNo: 'CAM-1', productId: '77', product: { id: 9, key: null, name: 'School ERP' }, funnel: { targets: 1 } } as unknown as Campaign
    const read = withCampaignExtras(raw)
    assert.equal(read.name, 'Diwali')
    assert.equal(read.campaignNo, 'CAM-1')
    assert.equal(read.productId, '77', 'the old loose pointer is untouched')
    assert.equal(read.product?.name, 'School ERP')
    assert.equal(read.funnel?.targets, 1)
    assert.equal('gtmCampaign' in read, false, 'a key the server left out is not invented')
  })

  it('count: whole numbers from 0, as numbers or digit strings', () => {
    assert.equal(count(0), 0)
    assert.equal(count('7'), 7)
    assert.equal(count(' 7 '), 7)
    for (const bad of [-1, 1.5, '1.5', 'x', '', null, undefined, NaN, Infinity, {}]) assert.equal(count(bad), null, String(bad))
  })
})

describe('reading what a GTM campaign is linked to', () => {
  it('reads product and crm_campaign from the detail answer', () => {
    assert.deepEqual(
      readGtmLinks({ campaign: { id: 5 }, members: [], product: { id: 9, key: 'scholarclone-erp', name: 'School ERP' }, crm_campaign: { id: 7, name: 'Diwali outreach', status: 'Active' } }),
      { product: { id: 9, key: 'scholarclone-erp', name: 'School ERP' }, crmCampaign: { id: 7, name: 'Diwali outreach', status: 'Active' } },
    )
  })

  it('a key the server left out stays out; null is "none"', () => {
    assert.deepEqual(readGtmLinks({ campaign: { id: 5 }, members: [] }), {})
    assert.deepEqual(readGtmLinks({ product: null, crm_campaign: null }), { product: null, crmCampaign: null })
    assert.deepEqual(Object.keys(readGtmLinks({ product: null })), ['product'])
    assert.deepEqual(readGtmLinks(null), {})
  })

  it('also reads the presenter\'s own camelCase crmCampaign', () => {
    assert.deepEqual(
      readGtmLinks({ crmCampaign: { id: 7, name: 'Diwali outreach', status: 'Active' } }),
      { crmCampaign: { id: 7, name: 'Diwali outreach', status: 'Active' } },
    )
  })

  it('a CRM campaign with no usable id is none, one with no name is named by its number, and a bad status is no status', () => {
    assert.deepEqual(readGtmLinks({ crm_campaign: { id: 0, name: 'A' } }), { crmCampaign: null })
    assert.deepEqual(readGtmLinks({ crm_campaign: 'Diwali' }), { crmCampaign: null })
    assert.deepEqual(readGtmLinks({ crm_campaign: { id: 7, name: '  ', status: 3 } }), { crmCampaign: { id: 7, name: 'CRM campaign #7', status: null } })
  })
})

describe('reading the campaign a lead came from', () => {
  it('reads {id, name}', () => {
    assert.deepEqual(readLeadCampaign({ campaign: { id: 7, name: 'Diwali outreach' } }), { campaign: { id: 7, name: 'Diwali outreach' } })
    assert.deepEqual(readLeadCampaign({ campaign: { id: '7', name: 'Diwali outreach' } }), { campaign: { id: 7, name: 'Diwali outreach' } }, 'an id sent as text')
  })

  it('null is "came from no campaign"; a key left out is "this server does not say"', () => {
    assert.deepEqual(readLeadCampaign({ campaign: null }), { campaign: null })
    assert.deepEqual(readLeadCampaign({ firstName: 'Asha' }), {})
    assert.deepEqual(readLeadCampaign(null), {})
    assert.deepEqual(readLeadCampaign('x'), {})
  })

  it('a campaign with no usable id is none, and one with no name is named by its number', () => {
    assert.deepEqual(readLeadCampaign({ campaign: { id: 0, name: 'A' } }), { campaign: null })
    assert.deepEqual(readLeadCampaign({ campaign: { name: 'A' } }), { campaign: null })
    assert.deepEqual(readLeadCampaign({ campaign: 'Diwali' }), { campaign: null }, 'the old free-text value is not a campaign')
    assert.deepEqual(readLeadCampaign({ campaign: { id: 4, name: ' ' } }), { campaign: { id: 4, name: 'Campaign #4' } })
  })

  it('withLeadCampaign keeps every existing field, including the free-text campaign the lead always had', () => {
    const read = withLeadCampaign({ id: '41', lastName: 'Menon', campaignText: 'Diwali', campaign: { id: 7, name: 'Diwali outreach' } } as unknown as Lead)
    assert.equal(read.lastName, 'Menon')
    assert.equal(read.campaignText, 'Diwali')
    assert.deepEqual(read.campaign, { id: 7, name: 'Diwali outreach' })
    assert.equal('campaign' in withLeadCampaign({ id: '41', lastName: 'Menon' } as unknown as Lead), false)
  })
})

describe('the funnel as ordered steps', () => {
  it('has the steps in order with plain-English labels, and Opted out apart from them', () => {
    const view = funnelView(funnel())!
    assert.deepEqual(view.steps.map((s) => s.label), ['Targets', 'Sent', 'Opened', 'Replied', 'Meetings booked', 'Converted'])
    assert.deepEqual(view.steps.map((s) => s.key), FUNNEL_STEPS.map((s) => s.key))
    assert.deepEqual(view.steps.map((s) => s.count), [40, 30, 12, 6, 3, 1])
    assert.equal(view.optedOut.label, 'Opted out')
    assert.equal(view.optedOut.count, 2)
    assert.equal(view.steps.some((s) => s.label === 'Opted out'), false, 'Opted out is not a step after Converted')
  })

  it('says each step as a share of the one before it, in words', () => {
    const view = funnelView(funnel())!
    assert.equal(view.steps[0].shareText, null, 'nothing comes before the first step')
    assert.deepEqual(view.steps.slice(1).map((s) => s.shareText), ['75% of targets', '40% of sent', '50% of opened', '50% of replied', '33% of meetings booked'])
  })

  it('rounds a share to the nearest whole percent: 2 of 3 is 67% (not 66%), and a half rounds up', () => {
    const view = funnelView(funnel({ targets: 3, sent: 2, opened: 1, replied: 0, meetings: 0, converted: 0, optedOut: 0 }))!
    assert.equal(view.steps[1].shareText, '67% of targets')
    assert.equal(view.steps[2].shareText, '50% of sent')
    assert.equal(shareText(stepShare(8, 1, 'Sent'), 1), '13% of sent', '12.5% is 13%')
  })

  it('measures Opted out against the targets', () => {
    assert.equal(funnelView(funnel())!.optedOut.shareText, '5% of targets')
  })

  it('never divides by zero: a step after a step with none recorded has no share, is shown as it is, and breaks nothing', () => {
    const view = funnelView(funnel({ sent: 0, opened: 5, replied: 0, meetings: 0, converted: 0, optedOut: 1 }))!
    const opened = view.steps[2]
    assert.equal(opened.count, 5, 'the number is shown as it is')
    assert.deepEqual(opened.share, { kind: 'none', of: 'sent' })
    assert.equal(opened.shareText, 'no share: 0 sent')
    assert.equal(view.steps[3].shareText, '0% of opened', 'none after some is an honest 0%')
    assert.equal(view.steps[4].shareText, null, 'none after none: nothing to say')
    for (const step of view.steps) {
      assert.ok(Number.isFinite(step.barPercent), `${step.label}: the bar is a real number`)
      if (step.share?.kind === 'share') assert.ok(Number.isFinite(step.share.percent), `${step.label}: the share is a real number`)
      assert.equal(/NaN|Infinity/.test(step.shareText ?? ''), false, `${step.label}: the words hold no NaN or Infinity`)
    }
    const noTargets = funnelView(funnel({ targets: 0, optedOut: 3 }))!
    assert.equal(noTargets.optedOut.shareText, 'no share: 0 targets', 'opted out with no targets has nothing to divide by either')
    assert.equal(noTargets.optedOut.barPercent, 0)
  })

  it('a step above its predecessor is shown as it is, not capped, not hidden, and the view says so', () => {
    const view = funnelView(funnel({ sent: 10, opened: 15, replied: 0, meetings: 0, converted: 0 }))!
    const opened = view.steps[2]
    assert.equal(opened.count, 15)
    assert.equal(opened.shareText, '150% of sent')
    assert.deepEqual(opened.share, { kind: 'share', percent: 150, of: 'sent', above: true })
    assert.equal(view.anyAbove, true)
    assert.equal(view.steps.length, 6, 'no step is hidden')
  })

  it('a funnel that never rises above a step does not claim it does', () => {
    assert.equal(funnelView(funnel())!.anyAbove, false)
    assert.equal(funnelView(funnel({ sent: 40, opened: 40 }))!.anyAbove, false, 'equal is not above')
  })

  it('a share that rounds to nothing but is not nothing reads "less than 1%"', () => {
    const view = funnelView(funnel({ targets: 1000, sent: 3, opened: 0, replied: 0, meetings: 0, converted: 0 }))!
    assert.equal(view.steps[1].shareText, 'less than 1% of targets')
    assert.equal(shareText(stepShare(10, 0, 'Sent'), 0), '0% of sent', 'an honest 0 is 0%')
  })

  it('a funnel with no targets is empty, and says so rather than showing zeros as if they were results', () => {
    const view = funnelView(funnel({ targets: 0, sent: 0, opened: 0, replied: 0, meetings: 0, converted: 0, optedOut: 0 }))!
    assert.equal(view.empty, true)
    assert.equal(view.quiet, false)
    for (const step of view.steps) assert.equal(step.barPercent, 0)
  })

  it('targets with nothing recorded are quiet, not empty', () => {
    const view = funnelView(funnel({ sent: 0, opened: 0, replied: 0, meetings: 0, converted: 0, optedOut: 0 }))!
    assert.equal(view.empty, false)
    assert.equal(view.quiet, true)
    assert.equal(funnelView(funnel())!.quiet, false)
    assert.equal(funnelView(funnel({ sent: 0, opened: 0, replied: 0, meetings: 0, converted: 0, optedOut: 1 }))!.quiet, false, 'an opt-out is something recorded')
  })

  it('a target with only one kind of activity recorded is not quiet, whichever kind it is', () => {
    const none = { sent: 0, opened: 0, replied: 0, meetings: 0, converted: 0, optedOut: 0 }
    for (const stage of ['sent', 'opened', 'replied', 'meetings', 'converted', 'optedOut'] as const) {
      assert.equal(funnelView(funnel({ ...none, [stage]: 1 }))!.quiet, false, `${stage} alone is something recorded`)
    }
  })

  it('no funnel from the server means no section', () => {
    assert.equal(funnelView(null), null)
    assert.equal(funnelView(undefined), null)
  })

  it('draws a bar as the step\'s share of the targets, with a sliver for a small real number and never past the full width', () => {
    assert.equal(barPercent(0, 40), 0)
    assert.equal(barPercent(1, 1000), 2)
    assert.equal(barPercent(20, 40), 50)
    assert.equal(barPercent(40, 40), 100)
    assert.equal(barPercent(90, 40), 100, 'the bar is capped; the number beside it is not')
    assert.equal(barPercent(5, 0), 0)
    const view = funnelView(funnel({ opened: 90 }))!
    assert.equal(view.steps[2].barPercent, 100)
    assert.equal(view.steps[2].count, 90)
  })
})

describe('what a campaign is linked to, in words', () => {
  it('the product line: not drawn when the server did not say, "No product chosen" when it said none, else the name', () => {
    assert.equal(productText(undefined), null)
    assert.equal(productText(null), NO_PRODUCT_TEXT)
    assert.equal(productText({ id: 9, key: null, name: 'School ERP' }), 'School ERP')
  })

  it('the GTM campaign: its name and status, "None linked", or nothing when the server did not say', () => {
    assert.equal(gtmCampaignText(undefined), null)
    assert.equal(gtmCampaignText(null), 'None linked')
    assert.equal(gtmCampaignText({ id: 5, name: 'Diwali GTM', status: 'active' }), 'Diwali GTM (active)')
    assert.equal(gtmCampaignText({ id: 5, name: 'Diwali GTM', status: null }), 'Diwali GTM')
  })

  it('the leads count: a sentence for none, one and many, and nothing when the server did not say', () => {
    assert.equal(leadsText(undefined), null)
    assert.equal(leadsText(null), null)
    assert.equal(leadsText({ count: 0 }), 'No leads have come from this campaign yet')
    assert.equal(leadsText({ count: 1 }), '1 lead first came from this campaign')
    assert.equal(leadsText({ count: 12 }), '12 leads first came from this campaign')
  })

  it('the CRM campaign a GTM campaign is the same as', () => {
    assert.equal(crmCampaignText(undefined), null)
    assert.equal(crmCampaignText(null), 'Not linked to a CRM campaign')
    assert.equal(crmCampaignText({ id: 7, name: 'Diwali outreach', status: 'Active' }), 'Diwali outreach (Active)')
    assert.equal(crmCampaignText({ id: 7, name: 'Diwali outreach', status: null }), 'Diwali outreach')
  })

  it('links to the CRM campaign only when the person\'s menu holds the Campaigns row', () => {
    assert.equal(crmCampaignHref('/module/crm/marketing/campaigns', 7), '/module/crm/marketing/campaigns/7')
    assert.equal(crmCampaignHref('/module/crm/marketing/campaigns/', 7), '/module/crm/marketing/campaigns/7', 'no double slash')
    assert.equal(crmCampaignHref('/dashboard', 7), null, 'the hook answers /dashboard for a row the menu does not hold')
    assert.equal(crmCampaignHref('', 7), null)
  })

  it('the campaign a lead came from', () => {
    assert.equal(leadCampaignName(undefined), null)
    assert.equal(leadCampaignName(null), null)
    assert.equal(leadCampaignName({ id: 7, name: 'Diwali outreach' }), 'Diwali outreach')
  })
})

describe('the list\'s Product column', () => {
  it('shows once any campaign has a product, and then stays', () => {
    assert.equal(noteProductSeen(false, [{ product: null }, {}]), false)
    assert.equal(noteProductSeen(false, [{ product: null }, { product: { id: 4, key: null, name: 'A' } }]), true)
    assert.equal(noteProductSeen(true, [{ product: null }]), true, 'a page without products does not take the column away')
    assert.equal(noteProductSeen(false, []), false)
  })

  it('spans the tick box, five columns, and Product when it shows', () => {
    assert.equal(campaignColumnCount(false), 6)
    assert.equal(campaignColumnCount(true), 7)
  })
})

describe('the Product choice on the form', () => {
  it('offers "No product" and every product, with the parent shown on a sub-product', () => {
    assert.deepEqual(productChoices(options, null), [
      { value: '', label: NO_PRODUCT_CHOICE }, { value: '4', label: 'ScholarClone' }, { value: '9', label: 'ScholarClone › School ERP' },
    ])
  })

  it('keeps a product the campaign has that the list no longer holds, under its own name', () => {
    const choices = productChoices(options, { id: 77, key: 'old', name: 'Old Product' })
    assert.deepEqual(choices.at(-1), { value: '77', label: 'Old Product' })
    assert.equal(choices.length, 4)
    assert.equal(productChoices(options, { id: 9, key: null, name: 'School ERP' }).length, 3, 'a product that is in the list is not added twice')
  })

  it('is drawn when there is a product to choose, or one is chosen already', () => {
    assert.equal(showProductChoice([], null), false)
    assert.equal(showProductChoice(options, null), true)
    assert.equal(showProductChoice([], { id: 77, key: null, name: 'Old' }), true, 'so that it can be cleared')
  })

  it('reads the box: an id, or none', () => {
    assert.equal(chosenProduct(''), null)
    assert.equal(chosenProduct('9'), 9)
    assert.equal(chosenProduct('0'), null)
    assert.equal(chosenProduct('abc'), null)
  })

  it('sends the product only when the person chose or changed it', () => {
    assert.deepEqual(productPayload(null, null, false), {}, 'a new campaign with no product sends nothing')
    assert.deepEqual(productPayload(null, 9, false), { product_master_id: 9 }, 'a new campaign with a product')
    assert.deepEqual(productPayload(9, 9, true), {}, 'an edit that left it alone sends nothing')
    assert.deepEqual(productPayload(null, null, true), {})
    assert.deepEqual(productPayload(9, 4, true), { product_master_id: 4 }, 'changed')
    assert.deepEqual(productPayload(null, 4, true), { product_master_id: 4 }, 'chosen on an edit')
    assert.deepEqual(productPayload(9, null, true), { product_master_id: null }, 'cleared is sent as null, which the server reads as "no product"')
  })
})
