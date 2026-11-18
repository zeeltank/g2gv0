import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent } from '../agent/assertions'
import type { FactsApi } from '../../services/facts/api-types'
import type { Lead } from '../../types/crm'
import { lead, signal } from './fixtures'
import { entityData, fakeFacts, leadFact, screenKit } from './screen-kit'

/** A lead's page as a person meets it: the real page, the real sidebar hook, only the network and the facts API replaced. */

const TABS_AS_ALWAYS = ['Details', 'Activity', 'Comments', 'Documents', 'Emails', 'History']

const picklists = { leadStatus: [], leadSource: [], industry: [], rating: [] }

async function open(over: Partial<Lead> = {}, opts: { facts?: Partial<FactsApi>; signalReview?: boolean; onSaved?: () => void } = {}) {
  const screen = await screenKit({ pathname: '/module/crm/marketing/leads/41', signalReview: opts.signalReview })
  const { LeadDetailPage } = await import('../../components/domain/crm/lead-detail-page')
  const { service, entityCalls } = fakeFacts(opts.facts)
  await screen.mount(screen.k.h(LeadDetailPage, { lead: lead(over), onSaved: opts.onSaved ?? (() => undefined), onBack: () => undefined, picklists, factsService: service }), 40)
  const { k } = screen
  const tabs = () => k.all('div.flex.gap-1.border-b button').map((b) => b.textContent)
  const tab = (label: string) => k.withText(label) as HTMLElement
  const openTab = async (label: string) => { await k.click(tab(label)); await k.tick(30); await k.tick(30) }
  const context = () => k.one('[data-lead-context]')
  const detailText = () => k.bodyText()
  return { ...screen, service, entityCalls, tabs, tab, openTab, context, detailText }
}

describe('a lead\'s page against an older server (none of slice 6\'s fields)', () => {
  afterEach(async () => { await disposeAll() })

  it('keeps its header and its tabs, and adds only an Evidence tab beside Details', async () => {
    const s = await open()
    absent(s.context(), 'nothing to say under the name, so nothing is drawn')
    assert.deepEqual(s.tabs(), ['Details', 'Evidence', 'Activity', 'Comments', 'Documents', 'Emails', 'History'])
    assert.deepEqual(s.tabs().filter((t) => t !== 'Evidence'), TABS_AS_ALWAYS, 'the existing tabs are all there, in their order')
    assert.ok(s.k.bodyText().includes('Lead Information'), 'the Details tab is open, as before')
    assert.ok(s.k.bodyText().includes('LEAD-0041'))
    s.restore()
  })

  it('the Evidence tab says honestly that the lead was not made from a signal, and still shows the facts', async () => {
    const s = await open()
    await s.openTab('Evidence')
    const card = s.k.one('[data-section="Source signal"]')!
    assert.equal(card.getAttribute('data-signal-state'), 'none')
    assert.ok(card.textContent!.includes('This lead was not made from a signal'))
    assert.deepEqual(s.entityCalls, [{ type: 'lead', id: '41' }], 'the facts section asked for THIS lead\'s facts, as a lead')
    assert.ok(s.k.one('[data-section="Evidence"]'), 'the facts section is there')
    assert.ok(s.k.bodyText().includes('Phone number'), 'a suggested fact is listed')
    s.restore()
  })

  it('does not ask for the facts until the Evidence tab is opened', async () => {
    const s = await open()
    assert.deepEqual(s.entityCalls, [])
    s.restore()
  })
})

describe('a lead\'s page: the header', () => {
  afterEach(async () => { await disposeAll() })

  it('names the product and the organisation account it is for', async () => {
    const s = await open({ product: { id: 9, key: 'scholarclone-erp', name: 'School ERP' }, organisationAccount: { id: 58, name: 'Hillcrest Academy' } })
    assert.equal(s.k.one('[data-lead-product]')!.textContent, 'Product: School ERP')
    assert.equal(s.k.one('[data-lead-organisation]')!.textContent, 'Organisation: Hillcrest Academy')
    s.restore()
  })

  it('says each channel in words with the reason in plain words: blocked email, allowed SMS', async () => {
    const s = await open({ consentStatus: 'opted_out', consent: { email: { allowed: false, reason: 'They opted out of email.' }, sms: { allowed: true, reason: null } } })
    const email = s.k.one('[data-consent="email"]')!
    const sms = s.k.one('[data-consent="sms"]')!
    assert.equal(email.textContent, 'Blocked: opted out')
    assert.equal(email.getAttribute('data-allowed'), 'false')
    assert.equal(sms.textContent, 'Allowed')
    assert.equal(sms.getAttribute('data-allowed'), 'true')
    assert.equal(s.k.one('[data-consent-reason="email"]')!.textContent, 'Email: They opted out of email.')
    absent(s.k.one('[data-consent-reason="sms"]'), 'an allowed channel has no reason to give')
    s.restore()
  })

  it('without the gate it reads the lead\'s own record: an opt-out is a blocked email with its reason', async () => {
    const s = await open({ consentStatus: 'suppressed' })
    assert.equal(s.k.one('[data-consent="email"]')!.textContent, 'Blocked: suppressed')
    assert.equal(s.k.one('[data-consent-reason="email"]')!.textContent, 'Email: This lead is suppressed, so email to them is blocked.')
    absent(s.k.one('[data-consent="sms"]'), 'the record says nothing about SMS, so nothing is said')
    s.restore()
  })

  it('a lead made from a signal has a button to its evidence, and pressing it opens the Evidence tab', async () => {
    const s = await open({ sourceSignalId: 77, sourceSignal: signal() })
    const button = s.k.one('button[data-from-signal]')!
    assert.equal(button.textContent, 'From a signal: see the evidence')
    await s.k.click(button)
    await s.k.tick(40)
    assert.ok(s.k.one('[data-lead-evidence]'), 'the Evidence tab is open')
    s.restore()
  })

  it('leaves the old banners and the Details tab\'s own Consent field as they were', async () => {
    const s = await open({ consentStatus: 'opted_out', isQualifiedForOutreach: false, missingFields: ['a real contact name'] })
    assert.ok(s.k.bodyText().includes('Not Qualified for Outreach'))
    assert.ok(s.k.bodyText().includes('Verified contact person name'))
    assert.ok(s.k.bodyText().includes('Opted Out'), 'the Details tab\'s own Consent field still says Opted Out')
    s.restore()
  })
})

describe('a lead\'s page: the Evidence tab', () => {
  afterEach(async () => { await disposeAll() })

  it('shows the signal it came from: title, date, fit, and the source as a link that opens safely', async () => {
    const s = await open({ sourceSignalId: 77, sourceSignal: signal() })
    await s.openTab('Evidence')
    assert.equal(s.k.one('[data-signal-title]')!.textContent, 'Hillcrest Academy plans a new ERP rollout')
    assert.equal(s.k.one('[data-signal-date]')!.textContent, 'Event date: 12 Oct 2026')
    assert.equal(s.k.one('[data-signal-fit]')!.textContent, 'Scholarclone')
    const link = s.k.one('[data-signal-source] a')!
    assert.equal(link.getAttribute('href'), 'https://news.example.com/hillcrest-erp')
    assert.equal(link.getAttribute('target'), '_blank')
    assert.ok(link.getAttribute('rel')!.includes('noopener'))
    assert.ok(link.textContent!.startsWith('news.example.com'))
    s.restore()
  })

  it('shows a quote only when the server sends one', async () => {
    const without = await open({ sourceSignalId: 77, sourceSignal: signal() })
    await without.openTab('Evidence')
    absent(without.k.one('[data-signal-quote]'), 'no quote was sent, none is invented')
    without.restore()
    await disposeAll()
    const withQuote = await open({ sourceSignalId: 77, sourceSignal: signal({ quote: 'We will tender for a new ERP in March.' }) })
    await withQuote.openTab('Evidence')
    assert.equal(withQuote.k.one('[data-signal-quote]')!.textContent, 'We will tender for a new ERP in March.')
    withQuote.restore()
  })

  it('calls the source\'s own words a quotation and a description of what happened a description, never a quote', async () => {
    const excerpt = await open({ sourceSignalId: 77, sourceSignal: signal({ quote: 'We will tender in March.', quoteKind: 'excerpt' }) })
    await excerpt.openTab('Evidence')
    assert.equal(excerpt.k.one('[data-signal-quote]')!.tagName, 'BLOCKQUOTE')
    assert.ok(excerpt.k.one('[data-quote-kind="excerpt"]')!.textContent!.includes('What the source said, copied from it.'))
    excerpt.restore()
    await disposeAll()

    const observed = await open({ sourceSignalId: 77, sourceSignal: signal({ quote: 'The trust announced a new campus.', quoteKind: 'observed_event' }) })
    await observed.openTab('Evidence')
    assert.equal(observed.k.one('[data-signal-quote]')!.tagName, 'P', 'an observed event is not drawn as a quotation')
    assert.equal(observed.k.all('[data-section="Source signal"] blockquote').length, 0, 'no quotation in the signal card (the facts section below draws its own)')
    assert.ok(observed.k.one('[data-quote-kind="observed_event"]')!.textContent!.includes('a description, not a quote from the source.'))
    observed.restore()
    await disposeAll()

    const unsaid = await open({ sourceSignalId: 77, sourceSignal: signal({ quote: 'Some text.' }) })
    await unsaid.openTab('Evidence')
    assert.ok(unsaid.k.one('[data-quote-kind="unsaid"]')!.textContent!.includes('As recorded with the signal.'))
    assert.equal(unsaid.k.bodyText().includes('copied from it'), false, 'a text of unknown kind is not claimed to be copied from the source')
    unsaid.restore()
  })

  it('shows the day the source was published when no event date is stated, and says so', async () => {
    const s = await open({ sourceSignalId: 77, sourceSignal: signal({ eventDate: null, sourcePublishedAt: '2026-10-03' }) })
    await s.openTab('Evidence')
    assert.equal(s.k.one('[data-signal-date]')!.textContent, 'Published: 3 Oct 2026 (the event date is not stated)')
    s.restore()
  })

  it('says "Date unknown" for an undated signal, and leaves the fit out when none is recorded', async () => {
    const s = await open({ sourceSignalId: 77, sourceSignal: signal({ eventDate: null, businessFit: null }) })
    await s.openTab('Evidence')
    assert.equal(s.k.one('[data-signal-date]')!.textContent, 'Date unknown')
    absent(s.k.one('[data-signal-fit]'), 'no fit recorded, none shown')
    s.restore()
  })

  it('never makes a link of an address that is not http(s), and says no source was recorded', async () => {
    const s = await open({ sourceSignalId: 77, sourceSignal: signal({ sourceUrl: 'javascript:alert(1)' }) })
    await s.openTab('Evidence')
    absent(s.k.one('[data-signal-source] a'), 'no link')
    assert.equal(s.k.one('[data-signal-source]')!.textContent, 'No source address was recorded.')
    assert.equal(s.k.bodyText().includes('javascript:'), false, 'the bad address is not printed either')
    s.restore()
  })

  it('shows what the signal said as TEXT, never as markup', async () => {
    const s = await open({ sourceSignalId: 77, sourceSignal: signal({ title: '<img src=x onerror=alert(1)>', quote: '<b>bold</b>' }) })
    await s.openTab('Evidence')
    assert.equal(s.k.one('[data-signal-title]')!.textContent, '<img src=x onerror=alert(1)>')
    assert.equal(s.k.all('[data-lead-evidence] img, [data-lead-evidence] b').length, 0, 'no element was made from it')
    s.restore()
  })

  it('links to Signal Review for that signal when the person\'s menu has it, and draws no link when it does not', async () => {
    const withReview = await open({ sourceSignalId: 77, sourceSignal: signal({ title: 'A & B plan' }) })
    await withReview.openTab('Evidence')
    assert.equal(withReview.k.one('[data-signal-review-link]')!.getAttribute('href'), '/signal-review?status=all&q=A%20%26%20B%20plan')
    withReview.restore()
    await disposeAll()
    const without = await open({ sourceSignalId: 77, sourceSignal: signal() }, { signalReview: false })
    await without.openTab('Evidence')
    absent(without.k.one('[data-signal-review-link]'), 'no Signal Review row in the menu, no link')
    assert.ok(without.k.one('[data-signal-title]'), 'the rest of the card is there')
    without.restore()
  })

  it('a lead that says it came from a signal the server did not send says so honestly, with the number', async () => {
    const s = await open({ sourceCompanyOpportunityId: '40' })
    await s.openTab('Evidence')
    const card = s.k.one('[data-section="Source signal"]')!
    assert.equal(card.getAttribute('data-signal-state'), 'unreadable')
    assert.ok(card.textContent!.includes('number 40'))
    assert.ok(card.textContent!.includes('did not send the signal itself'))
    s.restore()
  })

  it('a fact accepted here that wrote the lead\'s own field shows in the Details tab at once', async () => {
    const accepted = leadFact({ id: 501, field: 'phone', value: '+91 98765 43210', status: 'applied', column_written: true, decided_by_name: 'Anil Shah' })
    const s = await open({ phone: null }, { facts: { accept: async () => ({ status: 1, data: { outcome: 'applied', fact: accepted } }), entity: async () => ({ status: 1, data: entityData([leadFact()]) }) } })
    await s.openTab('Evidence')
    const accept = s.k.all('button').find((b) => b.textContent?.trim().startsWith('Accept'))
    assert.ok(accept, 'an Accept button')
    await s.k.click(accept)
    await s.k.tick(40)
    await s.openTab('Details')
    assert.ok(s.k.bodyText().includes('+91 98765 43210'), 'the accepted phone number is on the Details tab')
    s.restore()
  })

  it('a fact accepted but kept in the ledger only (the field already held a value) changes nothing on the page', async () => {
    const kept = leadFact({ id: 501, field: 'phone', value: '+91 98765 43210', status: 'applied', column_written: false, record_value: '+91 11111 22222' })
    const s = await open({ phone: '+91 11111 22222' }, { facts: { accept: async () => ({ status: 1, data: { outcome: 'applied', fact: kept } }) } })
    await s.openTab('Evidence')
    await s.k.click(s.k.all('button').find((b) => b.textContent?.trim().startsWith('Accept'))!)
    await s.k.tick(40)
    await s.openTab('Details')
    assert.ok(s.k.bodyText().includes('+91 11111 22222'))
    assert.equal(s.k.bodyText().includes('+91 98765 43210'), false)
    s.restore()
  })

  it('a person who cannot read facts (403) sees a plain sentence in the Evidence section, and the source card is still there', async () => {
    const { ApiError } = await import('../../services/core')
    const s = await open({ sourceSignalId: 77, sourceSignal: signal() }, { facts: { entity: async () => { throw new ApiError('Forbidden', 403) } } })
    await s.openTab('Evidence')
    assert.equal(s.k.one('[data-section="Evidence"]')!.getAttribute('data-evidence-state'), 'forbidden')
    assert.ok(s.k.one('[data-signal-title]'), 'the lead\'s own signal card does not depend on the facts API')
    s.restore()
  })

  it('has no accessibility violation a fake browser can find, header and Evidence tab together', async () => {
    const s = await open({
      product: { id: 9, key: null, name: 'School ERP' }, organisationAccount: { id: 58, name: 'Hillcrest Academy' }, consentStatus: 'opted_out',
      consent: { email: { allowed: false, reason: 'They opted out of email.' }, sms: { allowed: false, reason: null } },
      sourceSignalId: 77, sourceSignal: signal({ quote: 'We will tender in March.' }),
    })
    await s.openTab('Evidence')
    assert.deepEqual(await axeViolations(s.k.w.document.body), [])
    s.restore()
  })
})
