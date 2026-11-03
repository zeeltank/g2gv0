import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signal-review/router-harness'
import { ApiError } from '../../services/core'
import type { OrgAccountsApi } from '../../services/org-accounts/api-types'
import type { Org360 } from '../../services/org-accounts/types'
import { fakeService } from './fake-service'
import { meta, oldAccount360, org360, org360CrmOnly, org360WithCrm, placeConflictSuggestion, sameSourceSuggestion, suggestion } from './fixtures'
import { DEFAULT_LINKS } from './links'
import type { OldAccount360 } from './old-sections'

interface Setup {
  org?: Org360
  overrides?: Partial<OrgAccountsApi>
  loadOld?: () => Promise<OldAccount360>
  links?: typeof DEFAULT_LINKS
  /** Gives the tab an agent slot: a stand-in component that records what the tab hands to it. */
  agent?: boolean
}

interface Slot { identityId: number; onRecordsChanged: () => void; onOrganisationChanged: (id: number) => void }

/** The Account 360 tab of the Organization 11, in a fake browser, with a fake server. */
async function setup(options: Setup = {}) {
  const k = await kit()
  const router = await routerHarness('', '/module/crm/marketing/organizations/11')
  const { Account360View } = await import('../../components/domain/crm/account-360')

  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const { service, calls } = fakeService({ forCrm: async () => ({ status: 1, created: false, data: options.org ?? org360WithCrm() }), ...options.overrides })
  const old = { calls: 0 }
  const loadOld = options.loadOld ?? (async () => { old.calls += 1; return oldAccount360() })
  const opened: string[] = []
  const slots: Slot[] = []
  const pageRecords: number[] = []
  await k.render(router.wrap(k.h(Account360View, {
    organizationId: '11', service, loadOld, links: options.links ?? DEFAULT_LINKS,
    owners: [{ id: '5', name: 'Anil Shah' }, { id: '9', name: 'Bela Nair' }], onOpenTab: (tab: string) => opened.push(tab),
    onRecordsChanged: () => pageRecords.push(1),
    ...(options.agent ? { agent: (slot: Slot) => { slots.push(slot); return k.h('div', { 'data-agent-stub': String(slot.identityId) }, 'agent') } } : {}),
  })))
  await k.tick(20)
  await k.tick(20)

  const section = (title: string) => k.one(`[data-section="${title}"]`)
  const expand = async (title: string) => {
    const button = section(title)!.querySelector('button[aria-expanded]') as HTMLElement
    if (button.getAttribute('aria-expanded') !== 'true') { await k.click(button); await k.tick(5) }
  }
  const dialogButton = (label: string) => k.all('[role="alertdialog"] button').find((b) => b.textContent?.trim() === label) ?? null
  const press = async (button: Element | null | undefined) => { assert.ok(button, 'the button exists'); await k.click(button); await k.tick(20); await k.tick(20) }
  const row = (key: string) => k.one(`[data-source="${key}"]`)
  const pair = (key: string) => k.one(`li[data-pair="${key}"]`)

  return { k, service, calls, old, opened, slots, pageRecords, section, expand, dialogButton, press, row, pair }
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('Account 360 tab: what it reads', () => {
  afterEach(disposeAll)

  it('ensures the identity of THIS organization on opening, reads its possible matches and the old sections once each', async () => {
    const { calls, old } = await setup()
    assert.deepEqual(calls.forCrm, ['11'], 'asks for the 360 of CRM organization 11')
    assert.deepEqual(calls.suggestions, [1], 'asks for the pairs of the identity it got (1)')
    assert.equal(old.calls, 1)
  })

  it('shows a loading state before the first answer, for the linked records and the old sections', async () => {
    const never = () => new Promise<never>(() => undefined)
    const { k } = await setup({ overrides: { forCrm: never }, loadOld: never })
    assert.ok(k.one('[role="status"][aria-label="Loading the linked records"]'), "k.one('[role=\"status\"][aria-label=\"Loading the linked records\"]')")
    assert.ok(k.one('[role="status"][aria-label="Loading more of this account"]'), "k.one('[role=\"status\"][aria-label=\"Loading more of this account\"]')")
  })
})

describe('Account 360 tab: why now', () => {
  afterEach(disposeAll)

  it('shows the four facts in words', async () => {
    const { k } = await setup()
    const facts = k.all('[data-fact]').map((f) => [f.getAttribute('data-fact'), f.querySelector('dt')!.textContent, f.querySelector('dd')!.textContent])
    assert.deepEqual(facts, [['signals', 'Open signals', '2'], ['next_event', 'Next event', '1 Dec 2026'], ['deals', 'Open deals', '1'], ['last_activity', 'Last activity', '18 Oct 2026']])
  })

  it('says "None dated" and "None yet", and shows real zeros, for an organization nothing has happened to', async () => {
    const { k } = await setup({ org: org360CrmOnly() })
    assert.deepEqual(k.all('[data-fact] dd').map((d) => d.textContent), ['0', 'None dated', '0', 'None yet'])
  })
})

describe('Account 360 tab: the linked records', () => {
  afterEach(disposeAll)

  it('shows the CRM organization, the GTM account and the Signals company, each with why it is linked, and the lifecycle in words', async () => {
    const { k, row } = await setup()
    const card = k.one('section[aria-labelledby]')!
    assert.ok(card.textContent!.includes('Linked records'), "card.textContent!.includes('Linked records')")
    assert.ok(card.textContent!.includes('Engaged'), "card.textContent!.includes('Engaged')")
    assert.ok(card.textContent!.includes('Owner: Anil Shah'), "card.textContent!.includes('Owner: Anil Shah')")
    assert.ok(row('crm')!.textContent!.includes('Riverdale Public School'), "row('crm')!.textContent!.includes('Riverdale Public School')")
    assert.ok(row('crm')!.textContent!.includes('This record'), "row('crm')!.textContent!.includes('This record')")
    assert.ok(row('crm')!.querySelector('[data-basis]')!.textContent === 'confirmed by a person', "row('crm')!.querySelector('[data-basis]')!.textContent === 'confirmed by a person'")
    assert.ok(row('gtm')!.textContent!.includes('Stage: Qualified · 1 deal'), "row('gtm')!.textContent!.includes('Stage: Qualified · 1 deal')")
    assert.equal(row('gtm')!.querySelector('[data-basis]')!.textContent, 'linked by an earlier link')
    assert.equal(row('signals')!.querySelector('[data-basis]')!.textContent, 'linked because the names are identical')
  })

  it('sends the GTM row and the Signals row to their screens (GTM has no page for one account), and the CRM row nowhere', async () => {
    const { row } = await setup()
    assert.equal(row('gtm')!.querySelector('a')!.getAttribute('href'), '/gtm/prospecting')
    assert.equal(row('signals')!.querySelector('a')!.getAttribute('href'), '/signals')
    assert.ok(row('crm')!.querySelector('a') === null, 'the CRM row (this record) has no link')
  })

  it('draws no link to a screen the person has no menu row for', async () => {
    const { row } = await setup({ links: { ...DEFAULT_LINKS, gtm: null, signals: null } })
    assert.ok(row('gtm')!.querySelector('a') === null, 'no GTM link without its menu row')
    assert.ok(row('signals')!.querySelector('a') === null, 'no Signals link without its menu row')
    assert.ok(row('gtm')!.textContent!.includes('Hillcrest Academy'), 'the name is still there as text')
  })

  it('says "No GTM account found" and "No Signals company found" for an organization that is only in the CRM, and "the only record found" for the CRM row (D6)', async () => {
    const { k, row } = await setup({ org: org360CrmOnly() })
    assert.ok(row('gtm')!.textContent!.includes('No GTM account found'), "row('gtm')!.textContent!.includes('No GTM account found')")
    assert.ok(row('signals')!.textContent!.includes('No Signals company found'), "row('signals')!.textContent!.includes('No Signals company found')")
    assert.equal(row('crm')!.querySelector('[data-basis]')!.textContent, 'the only record found for this organisation')
    assert.ok(!k.bodyText().includes('reason not recorded'), "!k.bodyText().includes('reason not recorded')")
  })
})

describe('Account 360 tab: the signals', () => {
  afterEach(disposeAll)

  it('shows each signal with its status in words, its date, and a link to Signal Review on its title', async () => {
    const { k, section } = await setup()
    const signals = section('Signals')!
    assert.ok(signals.textContent!.includes('3 in total · 2 need a decision · 1 decided'), "signals.textContent!.includes('3 in total · 2 need a decision · 1 decided')")
    const first = k.one('[data-signal="301"]')!
    assert.equal(first.querySelector('[data-status]')!.textContent, 'Needs decision')
    assert.equal(first.querySelector('[data-date-kind]')!.textContent, 'Event 12 Oct 2026')
    assert.equal(first.querySelector('a')!.getAttribute('href'), '/signal-review?status=all&q=District%20invites%20bids%20for%20school%20software')
    const second = k.one('[data-signal="302"]')!
    assert.equal(second.querySelector('[data-status]')!.textContent, 'Reviewed')
    assert.equal(second.querySelector('[data-date-kind]')!.textContent, 'Date unknown')
  })

  it('links the evidence page that a signal was found on, safely, and only when there is one', async () => {
    const { k } = await setup()
    const evidence = k.one('[data-signal="301"]')!.querySelectorAll('a')[1]
    assert.equal(evidence.getAttribute('href'), 'https://news.example/district-bids')
    assert.equal(evidence.getAttribute('target'), '_blank')
    assert.ok(/noopener/.test(evidence.getAttribute('rel') ?? ''), "/noopener/.test(evidence.getAttribute('rel') ?? '')")
    assert.ok(evidence.textContent!.includes('opens in a new tab'), "evidence.textContent!.includes('opens in a new tab')")
    assert.equal(k.one('[data-signal="302"]')!.querySelectorAll('a').length, 1, 'no evidence link without an address')
  })

  it('never makes a link of a stored address that is not a web address', async () => {
    const org = org360WithCrm()
    org.signals.latest[0] = { ...org.signals.latest[0], source_url: 'javascript:alert(1)' }
    const { k } = await setup({ org })
    assert.equal(k.one('[data-signal="301"]')!.querySelectorAll('a').length, 1)
    assert.ok(!k.all('a').some((a) => (a.getAttribute('href') ?? '').startsWith('javascript:')), "!k.all('a').some((a) => (a.getAttribute('href') ?? '').startsWith('javascript:'))")
  })

  it('says how many it shows of how many there are, and that there are none', async () => {
    const capped = org360WithCrm()
    capped.signals = { ...capped.signals, total: 45 }
    const { section } = await setup({ org: capped })
    assert.ok(section('Signals')!.textContent!.includes('Showing 2 of 45'), "section('Signals')!.textContent!.includes('Showing 2 of 45')")
    await disposeAll()
    const empty = await setup({ org: org360CrmOnly() })
    assert.ok(empty.section('Signals')!.textContent!.includes('No signals have been found about this organisation yet.'), "empty.section('Signals')!.textContent!.includes('No signals have been found about this organisation yet.')")
  })
})

describe('Account 360 tab: contacts and deals', () => {
  afterEach(disposeAll)

  it('lists the CRM and GTM contacts as plain text with the consent in words, and no mailto or tel link', async () => {
    const { k, section } = await setup()
    const contacts = section('Contacts')!
    assert.ok(contacts.textContent!.includes('Sunita Verma'), "contacts.textContent!.includes('Sunita Verma')")
    assert.ok(contacts.textContent!.includes('Accountant · sunita@riverdale.example · +91 98200 11111'), "contacts.textContent!.includes('Accountant · sunita@riverdale.example · +91 98200 11111')")
    assert.ok(contacts.textContent!.includes('Consent: opted in'), "contacts.textContent!.includes('Consent: opted in')")
    assert.equal(contacts.querySelectorAll('[data-consent]').length, 1, 'a GTM contact has no consent recorded and says nothing')
    assert.ok(!k.all('a').some((a) => /^(mailto|tel):/.test(a.getAttribute('href') ?? '')), "!k.all('a').some((a) => /^(mailto|tel):/.test(a.getAttribute('href') ?? ''))")
  })

  it('lists the open opportunities and the GTM deals, not the closed CRM ones, and links a CRM opportunity to its screen', async () => {
    const { section } = await setup()
    const deals = section('Open opportunities and deals')!
    assert.ok(deals.textContent!.includes('Riverdale ERP rollout'), "deals.textContent!.includes('Riverdale ERP rollout')")
    assert.ok(deals.textContent!.includes('Riverdale pilot'), "deals.textContent!.includes('Riverdale pilot')")
    assert.ok(!deals.textContent!.includes('Riverdale old licence'), 'closed won is not open')
    assert.equal(deals.querySelector('a')!.getAttribute('href'), '/module/crm/sales/opportunities/72')
  })

  it('opens the Opportunities tab from its button, and says when the list was capped', async () => {
    const capped = org360WithCrm()
    capped.totals = { ...capped.totals, deals: 31 }
    const { k, press, opened, section } = await setup({ org: capped })
    assert.ok(section('Open opportunities and deals')!.textContent!.includes('every one is in the Opportunities tab'), "section('Open opportunities and deals')!.textContent!.includes('every one is in the Opportunities tab')")
    await press(k.withText('See every opportunity'))
    assert.deepEqual(opened, ['opportunities'])
  })
})

describe('Account 360 tab: the sections only the old tab had', () => {
  afterEach(disposeAll)

  it('keeps recent campaigns, knowledge sources, relationships and the signal inbox reachable', async () => {
    const { k, expand, section } = await setup()
    for (const title of ['Recent campaigns', 'Knowledge sources', 'Relationships', 'Signal inbox']) assert.ok(section(title), title)
    await expand('Recent campaigns')
    assert.ok(section('Recent campaigns')!.textContent!.includes('Autumn outreach'), "section('Recent campaigns')!.textContent!.includes('Autumn outreach')")
    assert.ok(section('Recent campaigns')!.textContent!.includes('replied'), "section('Recent campaigns')!.textContent!.includes('replied')")
    await expand('Knowledge sources')
    assert.ok(section('Knowledge sources')!.textContent!.includes('Annual report'), "section('Knowledge sources')!.textContent!.includes('Annual report')")
    assert.ok(section('Knowledge sources')!.textContent!.includes('Verified'), "section('Knowledge sources')!.textContent!.includes('Verified')")
    assert.ok(section('Knowledge sources')!.textContent!.includes('Confidence 70%'), "section('Knowledge sources')!.textContent!.includes('Confidence 70%')")
    await expand('Relationships')
    assert.ok(section('Relationships')!.textContent!.includes('subsidiary of → organization #999'), "section('Relationships')!.textContent!.includes('subsidiary of → organization #999')")
    assert.ok(section('Signal inbox')!.textContent!.includes('Riverdale opens a campus'), 'a section with rows opens by itself')
    assert.ok(k.bodyText().includes('buying signal'), "k.bodyText().includes('buying signal')")
  })

  it('opens and closes a section by its button, which says whether it is open', async () => {
    const { k, section } = await setup()
    const button = section('Recent campaigns')!.querySelector('button')!
    assert.equal(button.getAttribute('aria-expanded'), 'false')
    await k.click(button); await k.tick(5)
    assert.equal(button.getAttribute('aria-expanded'), 'true')
    await k.click(button); await k.tick(5)
    assert.equal(button.getAttribute('aria-expanded'), 'false')
  })

  it('says plainly that a role without the Market Signals right cannot read them, and the rest of the tab is unaffected', async () => {
    const { k, section } = await setup({ loadOld: async () => { throw new ApiError('Your role does not have access to this screen.', 403) } })
    assert.ok(k.one('[data-old-sections="forbidden"]')!.textContent!.includes('follow the Market Signals right'), "k.one('[data-old-sections=\"forbidden\"]')!.textContent!.includes('follow the Market Signals right')")
    assert.ok(k.withText('Retry') === null, 'a retry cannot help')
    assert.ok(section('Signals'), 'the identity sections are all there')
    assert.ok(k.one('section[aria-labelledby]')!.textContent!.includes('Linked records'), "k.one('section[aria-labelledby]')!.textContent!.includes('Linked records')")
  })

  it('shows an error with Retry for any other failure, and Retry reads them again', async () => {
    let attempts = 0
    const { k, press, section } = await setup({ loadOld: async () => { attempts += 1; if (attempts === 1) throw new Error('The server is busy.'); return oldAccount360() } })
    assert.ok(k.bodyText().includes('The server is busy.'), "k.bodyText().includes('The server is busy.')")
    await press(k.withText('Retry'))
    assert.equal(attempts, 2)
    assert.ok(section('Recent campaigns'), "section('Recent campaigns')")
  })
})

describe('Account 360 tab: when the linked records cannot be read', () => {
  afterEach(disposeAll)

  it('a server that is not set up says so, offers no retry, and the old sections still show', async () => {
    const { k, section } = await setup({ overrides: { forCrm: async () => { throw new ApiError('Organisation 360 is not set up on this server yet.', 503) } } })
    assert.equal(k.one('[data-identity-problem]')!.getAttribute('data-identity-problem'), 'unavailable')
    assert.ok(k.bodyText().includes('Linked records are not set up on this server yet.'), "k.bodyText().includes('Linked records are not set up on this server yet.')")
    assert.ok(k.withText('Retry') === null, 'no Retry for a server that is not set up')
    assert.ok(k.one('[data-fact]') === null, 'no why-now facts without a 360')
    assert.ok(section('Recent campaigns'), 'the CRM-side sections are unaffected')
  })

  it('no access says so without a retry; not found says it was not found; another failure has a Retry that reads again', async () => {
    const forbidden = await setup({ overrides: { forCrm: async () => { throw new ApiError('no', 403) } } })
    assert.ok(forbidden.k.bodyText().includes('You do not have access to the linked records'), "forbidden.k.bodyText().includes('You do not have access to the linked records')")
    assert.ok(forbidden.k.withText('Retry') === null, 'no Retry when there is no access')
    await disposeAll()

    const missing = await setup({ overrides: { forCrm: async () => { throw new ApiError('gone', 404) } } })
    assert.ok(missing.k.bodyText().includes('can no longer be found'), "missing.k.bodyText().includes('can no longer be found')")
    await disposeAll()

    let attempts = 0
    const flaky = await setup({ overrides: { forCrm: async () => { attempts += 1; if (attempts === 1) throw new Error('Boom.'); return { status: 1, created: false, data: org360WithCrm() } } } })
    assert.ok(flaky.k.bodyText().includes('Boom.'), "flaky.k.bodyText().includes('Boom.')")
    await flaky.press(flaky.k.withText('Retry'))
    assert.equal(attempts, 2)
    assert.ok(flaky.k.one('[data-fact]'), "flaky.k.one('[data-fact]')")
  })

  it('the latest answer wins: a slow first answer cannot replace the second', async () => {
    const slow = deferred<{ status: 1; created: boolean; data: Org360 }>()
    let call = 0
    const { k, press } = await setup({
      overrides: { forCrm: () => { call += 1; return call === 1 ? Promise.reject(new Error('First failed.')) : slow.promise } },
    })
    await press(k.withText('Retry'))
    slow.resolve({ status: 1, created: false, data: org360WithCrm() })
    await k.tick(20)
    assert.ok(k.one('[data-fact]'), "k.one('[data-fact]')")
  })
})

describe('Account 360 tab: possible matches', () => {
  afterEach(disposeAll)

  const matchFor = (over = {}) => suggestion({
    key: 'crm_organization:11|g2g_company:77',
    left: { type: 'crm_organization', id: 11, name: 'Riverdale Public School', place: 'Pune' },
    right: { type: 'g2g_company', id: 77, name: 'Riverdale School Society', place: 'Pune' },
    ...over,
  })

  it('shows the other record of each pair (never this organization\'s own) with its source, its place and how alike the names are', async () => {
    const { k, pair } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: [matchFor()] }) } })
    assert.ok(k.bodyText().includes('Possible matches'), "k.bodyText().includes('Possible matches')")
    const card = pair('crm_organization:11|g2g_company:77')!
    assert.ok(card.textContent!.includes('Riverdale School Society · Signals company · Pune'), "card.textContent!.includes('Riverdale School Society · Signals company · Pune')")
    assert.ok(!card.textContent!.includes('Riverdale Public School'), 'the side that is this organization is not shown as the candidate')
    assert.ok(card.textContent!.includes('80% of the name words match'), "card.textContent!.includes('80% of the name words match')")
  })

  it('picks the other record whichever side of the pair is this organization\'s own, for each of its three records', async () => {
    const flippedCrm = matchFor({
      key: 'g2g_company:77|crm_organization:11',
      left: { type: 'g2g_company', id: 77, name: 'Riverdale School Society', place: 'Pune' },
      right: { type: 'crm_organization', id: 11, name: 'Riverdale Public School', place: 'Pune' },
    })
    const viaGtm = matchFor({
      key: 'gtm_account:21|g2g_company:88',
      left: { type: 'gtm_account', id: 21, name: 'Hillcrest GTM', place: null },
      right: { type: 'g2g_company', id: 88, name: 'Hillcrest Society', place: null },
    })
    const viaCompany = matchFor({
      key: 'g2g_company:31|gtm_account:99',
      left: { type: 'g2g_company', id: 31, name: 'Hillcrest Signals', place: null },
      right: { type: 'gtm_account', id: 99, name: 'Hillcrest Other GTM', place: null },
    })
    const { pair } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: [flippedCrm, viaGtm, viaCompany] }) } })
    const shown = (key: string) => pair(key)!.querySelector('p')!.textContent
    assert.ok(shown(flippedCrm.key)!.startsWith('Riverdale School Society'), 'this organization is the RIGHT side: the left one is the candidate')
    assert.ok(shown(viaGtm.key)!.startsWith('Hillcrest Society'), 'its GTM account is the left side: the right one is the candidate')
    assert.ok(shown(viaCompany.key)!.startsWith('Hillcrest Other GTM'), 'its Signals company is the left side')
  })

  it('shows nothing when there are no possible matches', async () => {
    const { k } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: [] }) } })
    assert.ok(!k.bodyText().includes('Possible matches'), "!k.bodyText().includes('Possible matches')")
  })

  it('D2: marks a pair in two different places on its card, and the confirm question warns before anything is changed', async () => {
    const conflict = placeConflictSuggestion({
      key: 'crm_organization:11|gtm_account:42',
      left: { type: 'crm_organization', id: 11, name: 'Omega Vidyalaya', place: 'Mumbai, Maharashtra' },
      right: { type: 'gtm_account', id: 42, name: 'Omega Vidyalaya', place: 'Surat, Gujarat' },
    })
    const { k, press, calls, pair, dialogButton } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: [conflict] }) } })
    const card = pair(conflict.key)!
    assert.equal(card.querySelector('[data-place-conflict]')!.textContent, 'Different places: Mumbai, Maharashtra / Surat, Gujarat')
    await press(Array.from(card.querySelectorAll('button')).find((b) => b.textContent === 'Confirm: same organisation'))
    const asked = k.one('[role="alertdialog"]')!.textContent!
    assert.ok(asked.includes('Different places: Mumbai, Maharashtra / Surat, Gujarat.'), `the question names both places: ${asked}`)
    assert.ok(asked.includes('usually two organisations'), `the question warns: ${asked}`)
    assert.equal(calls.link.length, 0, 'nothing has been decided yet')
    await press(dialogButton('Cancel'))
    assert.equal(calls.link.length, 0)
  })

  it('D3: a pair of one source can only be turned down: no Confirm button, and it says why', async () => {
    const same = sameSourceSuggestion({
      key: 'crm_organization:11|crm_organization:12',
      left: { type: 'crm_organization', id: 11, name: 'Riverdale', place: null }, right: { type: 'crm_organization', id: 12, name: 'Riverdale Pvt Ltd', place: null },
    })
    const { pair } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: [same] }) } })
    const card = pair(same.key)!
    assert.deepEqual(Array.from(card.querySelectorAll('button')).map((b) => b.textContent), ['Not the same'])
    assert.ok(card.textContent!.includes('can only be marked as different'), "card.textContent!.includes('can only be marked as different')")
  })

  it('confirming asks first, then links the two, then reads the organization and its matches again', async () => {
    let matches = [matchFor()]
    const { k, press, calls, pair, dialogButton } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: matches }) } })
    await press(Array.from(pair(matchFor().key)!.querySelectorAll('button')).find((b) => b.textContent === 'Confirm: same organisation'))
    assert.ok(k.one('[role="alertdialog"]')!.textContent!.includes('Are Riverdale Public School and Riverdale School Society the same organisation?'), "k.one('[role=\"alertdialog\"]')!.textContent!.includes('Are Riverdale Public School and Riverdale School Society")
    assert.equal(calls.link.length, 0)
    matches = []
    await press(dialogButton('Confirm: same organisation'))
    assert.deepEqual(calls.link, [{ left_type: 'crm_organization', left_id: 11, right_type: 'g2g_company', right_id: 77, action: 'confirm' }])
    assert.equal(calls.forCrm.length, 2, 'the 360 was read again')
    assert.ok(calls.suggestions.length >= 2, 'and so were the matches')
    assert.ok(k.one('[role="status"][tabindex]')!.textContent!.includes('are now shown as one organisation'), "k.one('[role=\"status\"][tabindex]')!.textContent!.includes('are now shown as one organisation')")
    assert.ok(pair(matchFor().key) === null, 'the settled pair is gone')
  })

  it('"Not the same" asks first, then records it', async () => {
    const { press, calls, pair, dialogButton, k } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: [matchFor()] }) } })
    await press(Array.from(pair(matchFor().key)!.querySelectorAll('button')).find((b) => b.textContent === 'Not the same'))
    assert.ok(k.one('[role="alertdialog"]')!.textContent!.includes('different organisations?'), "k.one('[role=\"alertdialog\"]')!.textContent!.includes('different organisations?')")
    await press(dialogButton('Not the same'))
    assert.equal(calls.link[0].action, 'reject')
  })

  it('a refused decision shows the server\'s sentence and leaves the pair where it was', async () => {
    const { k, press, calls, pair, dialogButton } = await setup({
      overrides: {
        suggestions: async () => ({ status: 1, data: [matchFor()] }),
        link: async () => { throw new ApiError('That organisation already has a different record from this source.', 409) },
      },
    })
    await press(Array.from(pair(matchFor().key)!.querySelectorAll('button')).find((b) => b.textContent === 'Confirm: same organisation'))
    await press(dialogButton('Confirm: same organisation'))
    assert.equal(calls.link.length, 1)
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('already has a different record from this source'), "k.one('[role=\"alert\"]')!.textContent!.includes('already has a different record from this source')")
    assert.ok(pair(matchFor().key), 'the pair stays')
    assert.equal(calls.forCrm.length, 1, 'nothing was read again after a failure')
  })

  it('without the right to confirm, the pairs are shown and no button is offered', async () => {
    const { pair } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: [matchFor()] }), meta: async () => ({ status: 1, data: meta({ confirm_links: false }) }) } })
    assert.equal(pair(matchFor().key)!.querySelectorAll('button').length, 0)
  })

  it('says the matches could not be loaded, with a Retry that asks again, and the rest of the tab is fine', async () => {
    let attempts = 0
    const { k, press, calls } = await setup({ overrides: { suggestions: async () => { attempts += 1; if (attempts === 1) throw new Error('Busy.'); return { status: 1, data: [] } } } })
    assert.ok(k.bodyText().includes('Possible matches could not be loaded.'), "k.bodyText().includes('Possible matches could not be loaded.')")
    assert.ok(k.one('[data-fact]'), "k.one('[data-fact]')")
    await press(k.all('button').find((b) => b.textContent === 'Retry'))
    assert.equal(calls.suggestions.length, 2)
    assert.ok(!k.bodyText().includes('could not be loaded.'), "!k.bodyText().includes('could not be loaded.')")
  })
})

describe('Account 360 tab: edit lifecycle and owner', () => {
  afterEach(disposeAll)

  const field = (k: Awaited<ReturnType<typeof setup>>['k'], label: string) =>
    k.all('[role="dialog"] select').find((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent?.startsWith(label)) as HTMLSelectElement
  const choose = async (k: Awaited<ReturnType<typeof setup>>['k'], label: string, value: string) => {
    const select = field(k, label)
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(select, value); select.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.tick(10)
  }

  it('offers the button only with the edit right', async () => {
    const withRight = await setup()
    assert.ok(withRight.k.withText('Edit lifecycle and owner'), "withRight.k.withText('Edit lifecycle and owner')")
    await disposeAll()
    const without = await setup({ overrides: { meta: async () => ({ status: 1, data: meta({ edit: false }) }) } })
    assert.ok(without.k.withText('Edit lifecycle and owner') === null, 'no Edit button without the edit right')
  })

  it('saves only what changed, then reads the organization again and says so', async () => {
    const { k, press, calls } = await setup()
    await press(k.withText('Edit lifecycle and owner'))
    await choose(k, 'Lifecycle', 'customer')
    await press(k.withText('Save changes'))
    assert.deepEqual(calls.patch, [{ id: 1, body: { lifecycle: 'customer' } }])
    assert.equal(calls.forCrm.length, 2)
    assert.ok(k.one('[role="status"][tabindex]')!.textContent!.includes('Saved.'), "k.one('[role=\"status\"][tabindex]')!.textContent!.includes('Saved.')")
  })

  it('announces a field error as an alert, tied to its field, and clears it when the field is edited (D: the error was silent)', async () => {
    const { k, press } = await setup({
      overrides: { patch: async () => { throw new ApiError('Invalid.', 422, { lifecycle: ['Lifecycle must be one of: discovered, target, engaged, customer, archived.'] }) } },
    })
    await press(k.withText('Edit lifecycle and owner'))
    await choose(k, 'Lifecycle', 'customer')
    await press(k.withText('Save changes'))
    const select = field(k, 'Lifecycle')
    const alert = k.one('[role="dialog"] p[role="alert"]')!
    assert.ok(alert.textContent!.includes('Lifecycle must be one of'), "alert.textContent!.includes('Lifecycle must be one of')")
    assert.equal(select.getAttribute('aria-invalid'), 'true')
    assert.ok((select.getAttribute('aria-describedby') ?? '').split(' ').includes(alert.id), 'aria-describedby names the alert')
    await choose(k, 'Lifecycle', 'target')
    assert.ok(k.one('[role="dialog"] p[role="alert"]') === null, 'editing the field clears its error')
    assert.equal(field(k, 'Lifecycle').getAttribute('aria-invalid'), null)
  })

  it('shows a refusal the form has no field for at the top of the form', async () => {
    const { k, press } = await setup({ overrides: { patch: async () => { throw new ApiError('nope', 403) } } })
    await press(k.withText('Edit lifecycle and owner'))
    await choose(k, 'Lifecycle', 'customer')
    await press(k.withText('Save changes'))
    assert.ok(k.one('[role="dialog"]')!.textContent!.includes('You are not allowed to change organisations.'), "k.one('[role=\"dialog\"]')!.textContent!.includes('You are not allowed to change organisations.')")
  })
})

describe('Account 360 tab: the organisation agent', () => {
  afterEach(disposeAll)

  it('shows nothing for an agent when none is given (the tab\'s own tests need no network)', async () => {
    const { k } = await setup()
    assert.ok(k.one('[data-agent-stub]') === null, 'no agent slot without an agent component')
  })

  it('hands the identity of THIS organization to the agent, and shows it between "why now" and the linked records', async () => {
    const { k, slots } = await setup({ agent: true })
    assert.equal(slots.at(-1)!.identityId, 1, 'the id of the identity the 360 answered with')
    const order = k.all('[role="group"][aria-label="Why now"], [data-agent-stub], section[aria-labelledby]').map((el) => (el.hasAttribute('data-agent-stub') ? 'agent' : el.getAttribute('aria-label') === 'Why now' ? 'why-now' : 'linked'))
    assert.deepEqual(order, ['why-now', 'agent', 'linked'], 'the agent sits between the two')
  })

  it('does not show the agent while the linked records are not there (a failed read has no identity to hand over)', async () => {
    const { k } = await setup({ agent: true, overrides: { forCrm: async () => { throw new ApiError('x', 503) } } })
    assert.ok(k.one('[data-agent-stub]') === null, 'no agent without an identity')
  })

  it('when the agent changes notes or tasks: the 360 is read again and the page is told to read its Comments and History', async () => {
    const { slots, calls, pageRecords, k } = await setup({ agent: true })
    assert.equal(calls.forCrm.length, 1)
    await k.act(async () => { slots.at(-1)!.onRecordsChanged() })
    await k.tick(30)
    assert.equal(calls.forCrm.length, 2, 'the organization was read again (its last-activity fact moved)')
    assert.deepEqual(pageRecords, [1], 'and the page was told once')
  })

  it('when accepting a link merges this organization into another: it asks again for THIS CRM organization and lands on the identity that holds it now', async () => {
    let call = 0
    const survivor = org360WithCrm()
    survivor.identity = { ...survivor.identity, id: 77 }
    const { slots, calls, k } = await setup({
      agent: true,
      overrides: { forCrm: async (id) => { call += 1; return { status: 1, created: false, data: call === 1 ? org360WithCrm() : survivor } } },
    })
    assert.equal(slots.at(-1)!.identityId, 1)
    await k.act(async () => { slots.at(-1)!.onOrganisationChanged(77) })
    await k.tick(30); await k.tick(30)
    assert.deepEqual(calls.forCrm, ['11', '11'], 'it asked for the CRM organization again, never for the removed identity')
    assert.equal(slots.at(-1)!.identityId, 77, 'the agent now works on the survivor')
    assert.equal(calls.suggestions.at(-1), 77, 'and the possible matches are those of the survivor')
    assert.ok(k.one('[data-agent-stub="77"]') !== null, 'the agent is shown for the survivor')
  })

  it('is wired for real: the tab renders the agent panel by the identity, passing both callbacks, and the page reloads its Comments and History', () => {
    const source = readFileSync(path.resolve('components/domain/crm/account-360.tsx'), 'utf8')
    assert.match(source, /from '\.\/org-agent-panel'/, 'the real panel is imported')
    assert.match(source, /<OrgAgentPanel orgAccountId=\{identityId\} onRecordsChanged=\{onRecordsChanged\} onOrganisationChanged=\{onOrganisationChanged\} \/>/, 'with the identity and both callbacks')
    assert.match(source, /<Agent key=\{org\.identity\.id\} identityId=\{org\.identity\.id\}/, 'handed the identity of this organization, keyed by it')
    assert.match(source, /agent=\{OrgAgentSlot\}/, 'and the real tab uses the real panel')
    const page = readFileSync(path.resolve('components/domain/crm/organization-detail-page.tsx'), 'utf8')
    assert.match(page, /onRecordsChanged=\{\(\) => \{ void loadComments\(\); void loadHistory\(\) \}\}/, 'the page reads its Comments and History when the agent changes them')
  })
})
