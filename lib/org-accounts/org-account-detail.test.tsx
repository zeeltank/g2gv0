import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signal-review/router-harness'
import { ApiError } from '../../services/core'
import type { OrgAccountsApi } from '../../services/org-accounts/api-types'
import { OrgAccountsApiError } from '../../services/org-accounts/errors'
import type { Org360, OrgContactLine } from '../../services/org-accounts/types'
import { fakeService } from './fake-service'
import { meta, org360, org360WithCrm, signalLine } from './fixtures'
import { DEFAULT_LINKS } from './links'

/** One organisation's page in a fake browser, with the address kept by a stand-in router and the server replaced by a fake. */
interface Setup {
  search?: string
  overrides?: Partial<OrgAccountsApi>
  owners?: Array<{ id: string; name: string }>
}

async function setup(options: Setup = {}) {
  const k = await kit()
  const router = await routerHarness(options.search ?? '', '/module/crm/organisation-360/2')
  const { OrgAccountDetailPage } = await import('../../components/domain/crm/org-account-detail-page')

  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const { service, calls } = fakeService(options.overrides)
  let backs = 0
  const names: string[] = []
  await k.render(router.wrap(k.h(OrgAccountDetailPage, {
    id: '2', service, links: DEFAULT_LINKS, owners: options.owners ?? [{ id: '5', name: 'Anil Shah' }, { id: '9', name: 'Bela Nair' }],
    onBack: () => { backs += 1 }, onNameKnown: (name: string) => names.push(name),
  })))
  await k.tick(10)

  const tab = (label: string) => k.all('[role="tab"]').find((t) => t.textContent?.startsWith(label)) as HTMLElement
  const openTab = async (label: string) => { await k.click(tab(label)); await k.tick(10) }
  const dialogButton = (label: string) => k.all('[role="alertdialog"] button').find((b) => b.textContent?.trim() === label) ?? null
  const press = async (button: Element | null | undefined) => { assert.ok(button, 'the button exists'); await k.click(button); await k.tick(10) }
  const drawer = () => k.one('[role="dialog"]')
  const field = (label: string) => k.all('[role="dialog"] select').find((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent?.startsWith(label)) as HTMLSelectElement
  const choose = async (label: string, value: string) => {
    const select = field(label)
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(select, value); select.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.tick(10)
  }
  const create = () => k.withText('Create CRM organisation')
  const notice = () => k.one('[role="status"][tabindex], [role="alert"][tabindex]')

  return { k, router, service, calls, tab, openTab, dialogButton, press, drawer, field, choose, create, notice, backs: () => backs, names }
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const many = <T,>(count: number, make: (i: number) => T): T[] => Array.from({ length: count }, (_, i) => make(i))

describe('OrgAccountDetailPage: the states', () => {
  afterEach(disposeAll)

  it('shows an opening state before the first answer', async () => {
    const { k } = await setup({ overrides: { get: () => new Promise(() => undefined) } })
    assert.ok(k.bodyText().includes('Opening…'))
    assert.equal(k.all('[role="tab"]').length, 0)
  })

  it('shows an error with Retry, and Retry opens the page', async () => {
    let attempts = 0
    const { k, calls } = await setup({ overrides: { get: async () => { attempts += 1; if (attempts === 1) throw new Error('The server is busy.'); return { status: 1, data: org360() } } } })
    assert.ok(k.bodyText().includes('This could not be opened'))
    assert.ok(k.bodyText().includes('The server is busy.'))
    await k.click(k.withText('Retry')!)
    await k.tick(10)
    assert.equal(calls.get.length, 2)
    assert.ok(k.one('h1')!.textContent === 'Hillcrest Academy')
    assert.ok(!k.bodyText().includes('The server is busy.'))
  })

  it('says plainly that there is no access on a 403, with a way back, no Retry and no crash', async () => {
    const { k, backs } = await setup({ overrides: { get: async () => { throw new ApiError('This action is unauthorized.', 403) } } })
    assert.ok(k.bodyText().includes('You do not have access to Organisation 360'))
    assert.ok(!k.bodyText().includes('could not be opened'))
    assert.equal(k.withText('Retry'), null)
    assert.equal(k.all('[role="tab"]').length, 0)
    await k.click(k.withText('Back to Organisation 360')!)
    assert.equal(backs(), 1)
  })

  it('says it could not be found on a 404', async () => {
    const { k } = await setup({ overrides: { get: async () => { throw new ApiError('No such organisation.', 404) } } })
    assert.ok(k.bodyText().includes('Not found'))
    assert.ok(k.bodyText().includes('could not be found, or you do not have access'))
    assert.equal(k.withText('Retry'), null)
  })

  it('reports the name once it is known, for the breadcrumb', async () => {
    const { names } = await setup()
    assert.deepEqual(names, ['Hillcrest Academy'])
  })
})

describe('OrgAccountDetailPage: the header', () => {
  afterEach(disposeAll)

  it('shows the name, the lifecycle in words, the website, the owner and the day it was updated', async () => {
    const { k } = await setup()
    assert.equal(k.one('h1')!.textContent, 'Hillcrest Academy')
    assert.ok(k.bodyText().includes('Target'))
    assert.ok(k.bodyText().includes('hillcrest.example · Owner: Anil Shah · Updated 20 Oct 2026'))
  })

  it('shows a badge only for the sources the identity points at, each with why it is linked', async () => {
    const { k } = await setup()
    const header = k.one('ul[aria-label="Where this organisation is known"]')!
    assert.deepEqual(Array.from(header.querySelectorAll('[data-source]')).map((li) => li.getAttribute('data-source')), ['gtm', 'signals'])
    assert.ok(header.textContent!.includes('GTMlinked because the names are identical'))
    assert.ok(header.textContent!.includes('Signalslinked because the websites are the same'))
    assert.ok(!header.textContent!.includes('CRM'), 'no CRM badge when there is no CRM organisation')
  })

  it('words every kind of link basis', async () => {
    const { k } = await setup({ overrides: { get: async () => ({ status: 1, data: org360WithCrm() }) } })
    const header = k.one('ul[aria-label="Where this organisation is known"]')!
    assert.ok(header.textContent!.includes('CRMconfirmed by a person'))
    assert.ok(header.textContent!.includes('GTMlinked by an earlier link'))
    assert.ok(header.textContent!.includes('Signalslinked because the names are identical'))
  })

  it('names the tabs, with the counts the server gave', async () => {
    const { tab } = await setup({ overrides: { get: async () => ({ status: 1, data: org360({ totals: { contacts: 7, deals: 0, activity: 12 } }) }) } })
    assert.deepEqual(['Overview', 'Signals', 'Contacts', 'Deals', 'Activity'].map((l) => tab(l).textContent), ['Overview', 'Signals3', 'Contacts7', 'Deals0', 'Activity12'])
  })

  it('moves between the tabs with the arrow keys, keeps the open tab in the address, and the focus goes with it', async () => {
    const { k, router, tab } = await setup()
    await k.act(async () => { tab('Overview').focus() })
    await k.press('ArrowRight')
    await k.tick(10)
    assert.equal(tab('Signals').getAttribute('aria-selected'), 'true')
    assert.equal(router.lastSearch(), 'tab=signals')
    assert.ok(k.w.document.activeElement === tab('Signals'))
    await k.press('End')
    await k.tick(10)
    assert.equal(tab('Activity').getAttribute('aria-selected'), 'true')
  })

  it('opens straight on a tab from a pasted link', async () => {
    const { k } = await setup({ search: 'tab=deals' })
    assert.ok(k.bodyText().includes('Hillcrest pilot'))
  })
})

describe('OrgAccountDetailPage: the overview', () => {
  afterEach(disposeAll)

  it('says what each source that exists knows', async () => {
    const { k } = await setup()
    const text = k.bodyText()
    for (const part of ['Qualified', 'hillcrest.example', '82', 'Anil Shah', 'Education', 'Pune, Maharashtra', 'School', '15 Sep 2026']) assert.ok(text.includes(part), part)
  })

  it('says "No CRM organisation yet" and offers Create CRM organisation when the server allows it', async () => {
    const { k, create } = await setup()
    assert.ok(k.bodyText().includes('No CRM organisation yet'))
    assert.ok(create())
  })

  it('says a missing source is missing without offering to create a GTM account or a Signals company', async () => {
    const { k } = await setup({ overrides: { get: async () => ({ status: 1, data: org360({ gtm: null, company: null, identity: { ...org360().identity, links: { crm: null, gtm: null, company: null } } }) }) } })
    assert.ok(k.bodyText().includes('No GTM account yet'))
    assert.ok(k.bodyText().includes('No Signals company yet'))
    assert.equal(k.all('button').filter((b) => b.textContent?.includes('Create')).length, 1, 'only the CRM organisation can be created from here')
  })

  it('does not offer to create without the right', async () => {
    const { k, create } = await setup({ overrides: { meta: async () => ({ status: 1, data: meta({ create_crm_organization: false }) }) } })
    assert.ok(k.bodyText().includes('No CRM organisation yet'))
    assert.equal(create(), null)
  })

  it('does not offer to create until the server has said what is allowed', async () => {
    const { create } = await setup({ overrides: { meta: async () => { throw new Error('down') } } })
    assert.equal(create(), null)
  })

  it('does not offer to create when the organisation already has a CRM organisation', async () => {
    const { k, create } = await setup({ overrides: { get: async () => ({ status: 1, data: org360WithCrm() }) } })
    assert.equal(create(), null)
    assert.ok(!k.bodyText().includes('No CRM organisation yet'))
    for (const part of ['ACC-0011', 'Education', '+91 20 5550 1234', 'office@riverdale.example']) assert.ok(k.bodyText().includes(part), part)
  })

  it('links the CRM card to the CRM organisation\'s own page', async () => {
    const { k } = await setup({ overrides: { get: async () => ({ status: 1, data: org360WithCrm() }) } })
    const link = k.all('a').find((a) => a.textContent === 'Open in CRM')!
    assert.equal(link.getAttribute('href'), '/module/crm/marketing/organizations/11')
  })
})

describe('OrgAccountDetailPage: signals, contacts, deals and activity', () => {
  afterEach(disposeAll)

  it('shows the signal counts and each signal with its date badge and status, linking to Signal Review', async () => {
    const { k, openTab } = await setup()
    await openTab('Signals')
    const text = k.bodyText()
    for (const part of ['in total3', 'need a decision2', 'decided1', 'District invites bids for school software', 'Event 12 Oct 2026', 'Needs decision', 'Principal posts about a new ERP', 'Date unknown', 'Reviewed']) assert.ok(text.includes(part), part)
    const link = k.all('a').find((a) => a.textContent === 'District invites bids for school software')!
    assert.equal(link.getAttribute('href'), '/module/crm/signal-review?status=all&q=District%20invites%20bids%20for%20school%20software')
  })

  it('says "Showing 20 of 45" for a capped list of signals, never "all"', async () => {
    const latest = many(20, (i) => signalLine({ id: 400 + i, title: `Signal ${i}` }))
    const { k, openTab } = await setup({ overrides: { get: async () => ({ status: 1, data: org360({ signals: { total: 45, needing_decision: 30, decided: 15, latest } }) }) } })
    await openTab('Signals')
    assert.ok(k.bodyText().includes('Showing 20 of 45'))
    assert.ok(!k.bodyText().includes('Showing all'))
  })

  it('says "Showing all 2" when the list is complete', async () => {
    const { k, openTab } = await setup({ overrides: { get: async () => ({ status: 1, data: org360({ signals: { total: 2, needing_decision: 1, decided: 1, latest: org360().signals.latest } }) }) } })
    await openTab('Signals')
    assert.ok(k.bodyText().includes('Showing all 2'))
  })

  it('says there are no signals when there are none, with real zeros', async () => {
    const { k, openTab } = await setup({ overrides: { get: async () => ({ status: 1, data: org360({ signals: { total: 0, needing_decision: 0, decided: 0, latest: [] } }) }) } })
    await openTab('Signals')
    assert.ok(k.bodyText().includes('No signals have been found'))
    assert.ok(k.bodyText().includes('in total0'))
    assert.ok(!k.bodyText().includes('Showing'))
  })

  it('shows contacts with their emails and phones as plain text, never as links that send something', async () => {
    const { k, openTab } = await setup({ overrides: { get: async () => ({ status: 1, data: org360WithCrm() }) } })
    await openTab('Contacts')
    const row = k.all('tbody tr')[0]
    for (const part of ['Sunita Verma', 'CRM', 'Accountant', 'sunita@riverdale.example', '+91 98200 11111']) assert.ok(row.textContent!.includes(part), part)
    const hrefs = k.all('a').map((a) => a.getAttribute('href') ?? '')
    assert.ok(!hrefs.some((h) => /^(mailto|tel|sms):/i.test(h)), 'no mailto:, tel: or sms: link anywhere')
    assert.equal(k.all('a').find((a) => a.textContent === 'Sunita Verma')!.getAttribute('href'), '/module/crm/marketing/contacts/62')
  })

  it('shows a GTM contact without a link, since there is no screen for it', async () => {
    const { k, openTab } = await setup()
    await openTab('Contacts')
    assert.ok(k.bodyText().includes('Meera Rao'))
    assert.equal(k.all('a').find((a) => a.textContent === 'Meera Rao'), undefined)
  })

  it('says "Showing 20 of 134" for capped contacts and "Showing 20 of 61" for capped deals', async () => {
    const contacts = many<OrgContactLine>(20, (i) => ({ source: 'crm', id: 500 + i, name: `Person ${i}`, email: null, phone: null, role: null }))
    const deals = many(20, (i) => ({ source: 'crm' as const, id: 600 + i, name: `Deal ${i}`, stage: null, amount: null, currency: null, closing_date: null }))
    const { k, openTab } = await setup({ overrides: { get: async () => ({ status: 1, data: org360({ contacts, deals, totals: { contacts: 134, deals: 61, activity: 1 } }) }) } })
    await openTab('Contacts')
    assert.ok(k.bodyText().includes('Showing 20 of 134'))
    await openTab('Deals')
    assert.ok(k.bodyText().includes('Showing 20 of 61'))
    assert.ok(!k.bodyText().includes('Showing all'))
  })

  it('shows deals with their stage, amount and closing day, linking a CRM deal to the opportunity', async () => {
    const { k, openTab } = await setup({ overrides: { get: async () => ({ status: 1, data: org360WithCrm()}) } })
    await openTab('Deals')
    const row = k.all('tbody tr')[0]
    for (const part of ['Riverdale ERP rollout', 'CRM', 'Negotiation', 'INR 500000.00']) assert.ok(row.textContent!.includes(part), part)
    assert.equal(k.all('a').find((a) => a.textContent === 'Riverdale ERP rollout')!.getAttribute('href'), '/module/crm/sales/opportunities/72')
    assert.ok(row.textContent!.includes('—'), 'no closing day is a dash')
  })

  it('shows the activity with its kind, day, person and text', async () => {
    const { k, openTab } = await setup()
    await openTab('Activity')
    for (const part of ['Decision', '18 Oct 2026', 'Anil Shah', 'Marked the bid signal as contacted.', 'Showing all 1']) assert.ok(k.bodyText().includes(part), part)
  })

  it('says each list is empty in words', async () => {
    const empty: Org360 = org360({ contacts: [], deals: [], activity: [], totals: { contacts: 0, deals: 0, activity: 0 } })
    const { k, openTab } = await setup({ overrides: { get: async () => ({ status: 1, data: empty }) } })
    await openTab('Contacts')
    assert.ok(k.bodyText().includes('No contacts yet.'))
    await openTab('Deals')
    assert.ok(k.bodyText().includes('No deals yet.'))
    await openTab('Activity')
    assert.ok(k.bodyText().includes('No activity yet.'))
  })

  it('has no sideways page scroll: wide tables scroll inside their own container', async () => {
    const { k, openTab } = await setup()
    for (const label of ['Contacts', 'Deals']) {
      await openTab(label)
      let box = k.one('table')!.parentElement
      while (box && !/overflow-(x-)?auto/.test(box.className)) box = box.parentElement
      assert.ok(box, `${label}: an ancestor of the table scrolls on its own`)
    }
  })
})

describe('OrgAccountDetailPage: editing lifecycle and owner', () => {
  afterEach(disposeAll)

  it('offers Edit only with the right to edit, and nothing before the server has said', async () => {
    const without = await setup({ overrides: { meta: async () => ({ status: 1, data: meta({ edit: false }) }) } })
    assert.equal(without.k.withText('Edit'), null)
    await disposeAll()
    const unknown = await setup({ overrides: { meta: async () => { throw new Error('down') } } })
    assert.equal(unknown.k.withText('Edit'), null)
    await disposeAll()
    const allowed = await setup()
    assert.ok(allowed.k.withText('Edit'))
  })

  it('opens a drawer with the current lifecycle and owner, the server\'s lifecycles and the people to choose from', async () => {
    const { k, press, drawer, field } = await setup()
    await press(k.withText('Edit'))
    assert.ok(drawer()!.textContent!.includes('Edit Hillcrest Academy'))
    assert.equal(field('Lifecycle').value, 'target')
    assert.deepEqual(Array.from(field('Lifecycle').options).map((o) => o.textContent), ['Discovered', 'Target', 'Engaged', 'Customer', 'Archived'])
    assert.equal(field('Owner').value, '5')
    assert.deepEqual(Array.from(field('Owner').options).map((o) => o.textContent), ['No owner', 'Anil Shah', 'Bela Nair'])
    assert.equal((k.withText('Save changes') as HTMLButtonElement).disabled, true, 'nothing to save yet')
  })

  it('sends only the changed field, closes, reads the page again and says it was saved', async () => {
    const { k, calls, press, choose, drawer } = await setup()
    await press(k.withText('Edit'))
    await choose('Lifecycle', 'customer')
    await press(k.withText('Save changes'))
    assert.deepEqual(calls.patch, [{ id: 2, body: { lifecycle: 'customer' } }])
    assert.equal(calls.get.length, 2, 'the page was read again, in place')
    assert.equal(drawer(), null)
    assert.ok(k.bodyText().includes('Saved.'))
  })

  it('takes the owner off with null, and picks another with their id', async () => {
    const first = await setup()
    await first.press(first.k.withText('Edit'))
    await first.choose('Owner', '')
    await first.press(first.k.withText('Save changes'))
    assert.deepEqual(first.calls.patch[0].body, { owner_user_id: null })
    await disposeAll()

    const second = await setup()
    await second.press(second.k.withText('Edit'))
    await second.choose('Owner', '9')
    await second.press(second.k.withText('Save changes'))
    assert.deepEqual(second.calls.patch[0].body, { owner_user_id: 9 })
  })

  it('returns the focus to the Edit button when the drawer closes', async () => {
    const { k, press, choose } = await setup()
    // Clicking does not focus the button here, as in some browsers: the focus must still come back to it.
    const edit = k.withText('Edit')!
    await press(edit)
    await choose('Lifecycle', 'customer')
    await press(k.withText('Save changes'))
    assert.ok(k.w.document.activeElement === edit, 'focus is back on Edit; dialog open=' + String(k.one('[role=dialog]') !== null) + ' inBody=' + String(k.w.document.body.contains(k.w.document.activeElement)) + ' text=' + (k.w.document.activeElement as HTMLElement).tagName)
  })

  it('disables the buttons and says Saving… while the save runs', async () => {
    const wait = deferred<{ status: 1; data: unknown }>()
    const { k, press, choose } = await setup({ overrides: { patch: () => wait.promise } })
    await press(k.withText('Edit'))
    await choose('Lifecycle', 'customer')
    await press(k.withText('Save changes'))
    const saving = k.withText('Saving…') as HTMLButtonElement
    assert.ok(saving && saving.disabled)
    assert.equal((k.withText('Cancel') as HTMLButtonElement).disabled, true)
    await k.act(async () => { wait.resolve({ status: 1, data: {} }) })
    await k.tick(10)
    assert.equal(k.withText('Saving…'), null)
  })

  it('shows a 422 beside its field and keeps the drawer open with the choice intact', async () => {
    const { k, press, choose, drawer, field } = await setup({ overrides: { patch: async () => { throw new ApiError('Invalid.', 422, { owner_user_id: ['Choose a person of this organisation.'] }) } } })
    await press(k.withText('Edit'))
    await choose('Owner', '9')
    await press(k.withText('Save changes'))
    assert.ok(drawer())
    assert.ok(drawer()!.textContent!.includes('Choose a person of this organisation.'))
    assert.equal(field('Owner').getAttribute('aria-invalid'), 'true')
    assert.equal(field('Owner').value, '9')
    assert.equal(k.all('[role="dialog"] [role="alert"]').length, 0, 'a field error is not repeated at the top')
  })

  it('says so on a 403, and shows another 409 as a conflict, both without closing the drawer', async () => {
    const forbidden = await setup({ overrides: { patch: async () => { throw new ApiError('nope', 403) } } })
    await forbidden.press(forbidden.k.withText('Edit'))
    await forbidden.choose('Lifecycle', 'customer')
    await forbidden.press(forbidden.k.withText('Save changes'))
    assert.ok(forbidden.drawer()!.textContent!.includes('You are not allowed to change organisations.'))
    await disposeAll()

    const conflict = await setup({ overrides: { patch: async () => { throw new OrgAccountsApiError('Someone else changed this organisation first.', 409, undefined, undefined, 'conflict', null) } } })
    await conflict.press(conflict.k.withText('Edit'))
    await conflict.choose('Lifecycle', 'customer')
    await conflict.press(conflict.k.withText('Save changes'))
    assert.ok(conflict.drawer()!.textContent!.includes('Someone else changed this organisation first.'))
  })

  it('asks before throwing away a change, and Cancel with no change closes at once', async () => {
    const { k, press, choose, drawer, dialogButton } = await setup()
    await press(k.withText('Edit'))
    await press(k.withText('Cancel'))
    assert.equal(drawer(), null, 'nothing changed, nothing to ask')

    await press(k.withText('Edit'))
    await choose('Lifecycle', 'customer')
    await press(k.withText('Cancel'))
    assert.ok(drawer(), 'still open: the question came first')
    assert.ok(k.bodyText().includes('Discard your changes?'))
    await press(dialogButton('Discard changes'))
    assert.equal(drawer(), null)
  })

  it('starts the next edit from the saved values, not from the earlier draft', async () => {
    let reads = 0
    const { k, press, choose, field } = await setup({
      overrides: { get: async () => { reads += 1; return { status: 1, data: reads === 1 ? org360() : org360({ identity: { ...org360().identity, lifecycle: 'customer' } }) } } },
    })
    await press(k.withText('Edit'))
    await choose('Lifecycle', 'customer')
    await press(k.withText('Save changes'))
    await press(k.withText('Edit'))
    assert.equal(field('Lifecycle').value, 'customer')
  })
})

describe('OrgAccountDetailPage: creating the CRM organisation', () => {
  afterEach(disposeAll)

  const withCrmAfterCreate = () => {
    let reads = 0
    return async () => { reads += 1; return { status: 1 as const, data: reads === 1 ? org360() : org360WithCrm() } }
  }

  it('asks first, in words, and sends nothing on Cancel', async () => {
    const { k, calls, press, create, dialogButton } = await setup()
    await press(create())
    const text = k.one('[role="alertdialog"]')!.textContent!
    assert.ok(text.includes('Create a CRM organisation for Hillcrest Academy?'))
    assert.ok(text.includes('Nothing is sent to anyone.'))
    await press(dialogButton('Cancel'))
    assert.equal(calls.create.length, 0)
    assert.ok(create(), 'the button is still there')
  })

  it('returns the focus to the Create button when the question is cancelled, and when the server refuses', async () => {
    const cancelled = await setup()
    const button = cancelled.create()!
    await cancelled.press(button)
    await cancelled.press(cancelled.dialogButton('Cancel'))
    assert.ok(cancelled.k.w.document.activeElement === button, 'back on the button after Cancel')
    await disposeAll()

    const refused = await setup({ overrides: { createCrmOrganisation: async () => { throw new ApiError('nope', 403) } } })
    const again = refused.create()!
    await refused.press(again)
    await refused.press(refused.dialogButton('Create CRM organisation'))
    assert.ok(refused.k.w.document.activeElement === again, 'back on the button after a refusal')
  })

  it('creates it, updates the page in place, says so, and moves the focus to the notice', async () => {
    const { k, calls, press, create, dialogButton, notice } = await setup({ overrides: { get: withCrmAfterCreate() } })
    await press(create())
    await press(dialogButton('Create CRM organisation'))
    assert.deepEqual(calls.create, [{ id: '2', body: {} }])
    assert.equal(calls.get.length, 2, 'the page was read again, in place')
    assert.ok(k.bodyText().includes('The CRM organisation was created and linked.'))
    assert.equal(create(), null, 'the page now has its CRM organisation, so the button is gone')
    assert.ok(k.bodyText().includes('ACC-0011'))
    assert.ok(k.w.document.activeElement === notice(), 'the focus did not fall to the page')
  })

  it('says nothing new was created when the server already had one (200, created: false)', async () => {
    const { k, press, create, dialogButton } = await setup({ overrides: { createCrmOrganisation: async () => ({ status: 1, data: { created: false, crm_organization_id: 91, restored: false } }) } })
    await press(create())
    await press(dialogButton('Create CRM organisation'))
    assert.ok(k.bodyText().includes('already has a CRM organisation, so nothing new was created'))
  })

  it('asks whether to restore a deleted organisation of the same name, and sends restore_deleted: true on Restore', async () => {
    const attempts: Array<{ restore_deleted?: boolean } | undefined> = []
    const { k, calls, press, create, dialogButton } = await setup({
      overrides: {
        get: withCrmAfterCreate(),
        createCrmOrganisation: async (_id, body) => {
          attempts.push(body)
          if (!body?.restore_deleted) throw new OrgAccountsApiError('A deleted organisation has this name.', 409, undefined, undefined, 'deleted_name_exists', 41)
          return { status: 1, data: { created: false, crm_organization_id: 41, restored: true } }
        },
      },
    })
    await press(create())
    await press(dialogButton('Create CRM organisation'))
    const question = k.one('[role="alertdialog"]')!.textContent!
    assert.ok(question.includes('A deleted organisation with this name exists. Restore it instead?'))
    assert.ok(dialogButton('Restore') && dialogButton('Cancel'))
    assert.equal(calls.create.length, 1, 'nothing is restored until the person says so')
    await press(dialogButton('Restore'))
    assert.deepEqual(attempts, [{}, { restore_deleted: true }])
    assert.ok(k.bodyText().includes('The deleted CRM organisation was restored and linked.'))
    assert.equal(create(), null)
  })

  it('creates nothing when the person cancels the restore question', async () => {
    const { k, calls, press, create, dialogButton } = await setup({
      overrides: { createCrmOrganisation: async () => { throw new OrgAccountsApiError('A deleted organisation has this name.', 409, undefined, undefined, 'deleted_name_exists', 41) } },
    })
    await press(create())
    await press(dialogButton('Create CRM organisation'))
    await press(dialogButton('Cancel'))
    assert.equal(calls.create.length, 1)
    assert.ok(k.bodyText().includes('Nothing was created'))
    assert.ok(create(), 'it can be tried again')
  })

  it('shows "You are not allowed to create CRM organisations." on a 403', async () => {
    const { k, press, create, dialogButton } = await setup({ overrides: { createCrmOrganisation: async () => { throw new ApiError('This action is unauthorized.', 403) } } })
    await press(create())
    await press(dialogButton('Create CRM organisation'))
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('You are not allowed to create CRM organisations.'))
    assert.equal(k.one('h1')!.textContent, 'Hillcrest Academy', 'the page stays')
  })

  it('shows the server\'s message for a 422 and for another 409, with no restore question', async () => {
    const invalid = await setup({ overrides: { createCrmOrganisation: async () => { throw new ApiError('Invalid.', 422, { name: ['The name is too long.'] }) } } })
    await invalid.press(invalid.create())
    await invalid.press(invalid.dialogButton('Create CRM organisation'))
    assert.ok(invalid.k.one('[role="alert"]')!.textContent!.includes('The name is too long.'))
    await disposeAll()

    const clash = await setup({ overrides: { createCrmOrganisation: async () => { throw new OrgAccountsApiError('A CRM organisation was created a moment ago.', 409, undefined, undefined, 'already_linked', null) } } })
    await clash.press(clash.create())
    await clash.press(clash.dialogButton('Create CRM organisation'))
    assert.ok(clash.k.one('[role="alert"]')!.textContent!.includes('A CRM organisation was created a moment ago.'))
    assert.equal(clash.k.all('[role="alertdialog"]').length, 0, 'no restore question for another kind of 409')
  })

  it('disables the button and says it is working while it runs, so it cannot be sent twice', async () => {
    const wait = deferred<{ status: 1; data: { created: boolean; crm_organization_id: number; restored: boolean } }>()
    const { k, calls, press, create, dialogButton } = await setup({ overrides: { createCrmOrganisation: () => wait.promise } })
    await press(create())
    await press(dialogButton('Create CRM organisation'))
    const working = k.withText('Working…') as HTMLButtonElement
    assert.ok(working && working.disabled)
    await k.act(async () => { wait.resolve({ status: 1, data: { created: true, crm_organization_id: 91, restored: false } }) })
    await k.tick(10)
    assert.equal(calls.create.length, 1)
  })

  it('still says it was created when the page cannot be read again afterwards', async () => {
    let reads = 0
    const { k, press, create, dialogButton } = await setup({ overrides: { get: async () => { reads += 1; if (reads > 1) throw new Error('down'); return { status: 1, data: org360() } } } })
    await press(create())
    await press(dialogButton('Create CRM organisation'))
    assert.ok(k.bodyText().includes('The CRM organisation was created and linked. Reload the page to see it here.'))
  })
})
