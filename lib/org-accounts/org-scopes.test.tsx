import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signal-review/router-harness'
import { ApiError } from '../../services/core'
import type { OrgAccountsApi } from '../../services/org-accounts/api-types'
import { OrgAccountsApiError } from '../../services/org-accounts/errors'
import { fakeService } from './fake-service'
import { discoveredItems, listResponse, meta, placeConflictSuggestion, sameSourceSuggestion, suggestion, summary } from './fixtures'
import { DEFAULT_LINKS } from './links'

interface Setup {
  search?: string
  overrides?: Partial<OrgAccountsApi>
}

/** The Organizations scope switch around a stand-in for today's CRM list, in a fake browser with a fake server. */
async function setup(options: Setup = {}) {
  const k = await kit()
  const router = await routerHarness(options.search ?? '', '/module/crm/marketing/organizations')
  const { OrgScopes } = await import('../../components/domain/crm/org-scopes')
  const { getLaravelContext } = await import('../laravel-context')

  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const { service, calls } = fakeService({
    // Today's counts: 5 organisations, 2 with a CRM organisation (so 3 discovered) and 2 possible duplicates. The discovered list is the three without one.
    list: async (params) => (params.has_crm === 0 ? listResponse(discoveredItems(), { summary: summary({ total: 5, with_crm: 2 }) }) : listResponse(undefined, { summary: summary({ total: 5, with_crm: 2, suggestions: 2 }) })),
    ...options.overrides,
  })
  await k.render(router.wrap(k.h(OrgScopes, { context: getLaravelContext(), service, links: DEFAULT_LINKS }, k.h('p', { id: 'crm-list' }, 'THE CRM LIST'))))
  await k.tick(20)
  await k.tick(20)

  const tab = (label: string) => k.all('[role="tab"]').find((t) => t.textContent?.startsWith(label)) as HTMLElement
  const openScope = async (label: string) => { await k.click(tab(label)); await k.tick(20); await k.tick(20) }
  const press = async (button: Element | null | undefined) => { assert.ok(button, 'the button exists'); await k.click(button); await k.tick(20); await k.tick(20) }
  const dialogButton = (label: string) => k.all('[role="alertdialog"] button').find((b) => b.textContent?.trim() === label) ?? null
  const panel = (id: string) => k.one(`#org-scope-panel-${id}`)
  const rowOf = (name: string) => k.all('tbody tr').find((tr) => tr.textContent!.includes(name)) ?? null
  const createButton = (name: string) => k.all('button').find((b) => b.getAttribute('aria-label') === `Create CRM organisation for ${name}`) ?? null
  const pair = (key: string) => k.one(`li[data-pair="${key}"]`)

  return { k, router, service, calls, tab, openScope, press, dialogButton, panel, rowOf, createButton, pair }
}

describe('the scope switch', () => {
  afterEach(disposeAll)

  it('opens on today\'s CRM list, unchanged, with a clean address, and keeps the other two scopes out of the page', async () => {
    const { k, router, panel } = await setup()
    assert.ok(k.one('#crm-list'), 'the CRM list is there')
    assert.equal(panel('crm')!.hasAttribute('hidden'), false)
    assert.equal(panel('discovered')!.hasAttribute('hidden'), true)
    assert.equal(panel('duplicates')!.hasAttribute('hidden'), true)
    assert.equal(panel('discovered')!.textContent, '', 'a scope that is not open builds nothing')
    assert.deepEqual(router.written, [], 'the address was not touched')
  })

  it('has three tabs, with the counts of the org-accounts summary on the other two and none on the CRM scope', async () => {
    const { k, tab } = await setup()
    assert.deepEqual(k.all('[role="tab"]').map((t) => t.textContent), ['Organizations', 'Discovered3', 'Possible duplicates2'])
    assert.equal(tab('Organizations').getAttribute('aria-label'), null)
    assert.equal(tab('Discovered').getAttribute('aria-label'), 'Discovered 3', 'D8: the name says the count with a space')
    assert.equal(tab('Possible duplicates').getAttribute('aria-label'), 'Possible duplicates 2')
  })

  it('asks for the counts once, with the smallest page, and nothing else of the discovered or duplicates data until a scope is opened', async () => {
    const { calls } = await setup()
    assert.deepEqual(calls.list, [{ per_page: 1 }])
    assert.deepEqual(calls.suggestions, [])
  })

  it('writes the scope into the address, and leaves the plain address for the CRM scope', async () => {
    const { router, openScope } = await setup()
    await openScope('Discovered')
    assert.equal(router.lastSearch(), 'scope=discovered')
    await openScope('Possible duplicates')
    assert.equal(router.lastSearch(), 'scope=duplicates')
    await openScope('Organizations')
    assert.equal(router.lastSearch(), '', 'the first scope is the default')
  })

  it('opens on the scope a pasted link names, and on the CRM list for a scope that does not exist', async () => {
    const direct = await setup({ search: 'scope=discovered' })
    assert.ok(direct.k.one('#crm-list') === null, 'the CRM list is not the open scope')
    assert.ok(direct.k.bodyText().includes('Discovered organisations'), "direct.k.bodyText().includes('Discovered organisations')")
    await disposeAll()
    const bad = await setup({ search: 'scope=nonsense' })
    assert.ok(bad.k.one('#crm-list'), "bad.k.one('#crm-list')")
  })

  it('shows no counts when they cannot be read, and the CRM list is unaffected', async () => {
    const { k } = await setup({ overrides: { list: async () => { throw new ApiError('Organisation 360 is not set up on this server yet.', 503) } } })
    assert.deepEqual(k.all('[role="tab"]').map((t) => t.textContent), ['Organizations', 'Discovered', 'Possible duplicates'])
    assert.ok(k.one('#crm-list'), "k.one('#crm-list')")
  })
})

describe('the Discovered scope', () => {
  afterEach(disposeAll)

  it('lists the organisations that have no CRM organisation, with their lifecycle in words and where each is known', async () => {
    const { k, calls, openScope, rowOf } = await setup()
    await openScope('Discovered')
    assert.deepEqual(calls.list.at(-1), { has_crm: 0, page: 1, per_page: 20 }, 'always asks for the ones without a CRM organisation')
    assert.deepEqual(k.all('tbody tr td:first-child .font-semibold').map((n) => n.textContent), ['Hillcrest Academy', 'Lakeview School', 'Old Town School'])
    assert.ok(rowOf('Hillcrest Academy')!.textContent!.includes('Discovered'), "rowOf('Hillcrest Academy')!.textContent!.includes('Discovered')")
    assert.ok(rowOf('Hillcrest Academy')!.textContent!.includes('1 open signal'), "rowOf('Hillcrest Academy')!.textContent!.includes('1 open signal')")
    assert.ok(rowOf('Lakeview School')!.textContent!.includes('Target'), "rowOf('Lakeview School')!.textContent!.includes('Target')")
    assert.ok(rowOf('Lakeview School')!.textContent!.includes('New'), 'the GTM stage')
    assert.ok(rowOf('Hillcrest Academy')!.textContent!.includes('No website'), "rowOf('Hillcrest Academy')!.textContent!.includes('No website')")
  })

  it('searches and filters by lifecycle, in the address, and asks again with them', async () => {
    const { k, router, calls, openScope } = await setup()
    await openScope('Discovered')
    const select = k.all('select').find((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent === 'Lifecycle') as HTMLSelectElement
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(select, 'target'); select.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.tick(20); await k.tick(20)
    assert.ok(/lifecycle=target/.test(router.lastSearch()), "/lifecycle=target/.test(router.lastSearch())")
    assert.deepEqual(calls.list.at(-1), { has_crm: 0, page: 1, per_page: 20, lifecycle: 'target' })
  })

  it('says so when there is nothing left to discover, and when a filter leaves nothing, with a way to clear it', async () => {
    const empty = await setup({ search: 'scope=discovered', overrides: { list: async () => listResponse([], { summary: summary({ total: 2, with_crm: 2 }) }) } })
    assert.ok(empty.k.bodyText().includes('Nothing left to discover'), "empty.k.bodyText().includes('Nothing left to discover')")
    await disposeAll()
    const filtered = await setup({ search: 'scope=discovered&q=zzz', overrides: { list: async () => listResponse([]) } })
    assert.ok(filtered.k.bodyText().includes('No organisations match these filters'), "filtered.k.bodyText().includes('No organisations match these filters')")
    assert.ok(filtered.k.withText('Clear filters'), "filtered.k.withText('Clear filters')")
  })

  it('a 403 says there is no access, a 503 says it is not set up, an error has a Retry; none breaks the CRM scope', async () => {
    const forbidden = await setup({ search: 'scope=discovered', overrides: { list: async () => { throw new ApiError('no', 403) } } })
    assert.ok(forbidden.k.bodyText().includes('You do not have access to the linked records'), "forbidden.k.bodyText().includes('You do not have access to the linked records')")
    assert.ok(forbidden.k.withText('Retry') === null, 'no Retry when there is no access')
    await disposeAll()
    const down = await setup({ search: 'scope=discovered', overrides: { list: async () => { throw new ApiError('x', 503) } } })
    assert.ok(down.k.bodyText().includes('Discovered organisations are not set up yet'), "down.k.bodyText().includes('Discovered organisations are not set up yet')")
    assert.ok(down.k.withText('Retry') === null, 'no Retry for a server that is not set up')
    await disposeAll()
    let attempts = 0
    const flaky = await setup({ search: 'scope=discovered', overrides: { list: async (p) => { attempts += 1; if (attempts <= 2) throw new Error('Busy.'); return p.has_crm === 0 ? listResponse(discoveredItems()) : listResponse() } } })
    assert.ok(flaky.k.bodyText().includes('Busy.'), "flaky.k.bodyText().includes('Busy.')")
    await flaky.press(flaky.k.withText('Retry'))
    assert.ok(flaky.k.bodyText().includes('Hillcrest Academy'), "flaky.k.bodyText().includes('Hillcrest Academy')")
  })
})

describe('creating a CRM organisation from a discovered one', () => {
  afterEach(disposeAll)

  it('offers the button only with the add right', async () => {
    const withRight = await setup({ search: 'scope=discovered' })
    assert.ok(withRight.createButton('Hillcrest Academy'), "withRight.createButton('Hillcrest Academy')")
    await disposeAll()
    const without = await setup({ search: 'scope=discovered', overrides: { meta: async () => ({ status: 1, data: meta({ create_crm_organization: false }) }) } })
    assert.ok(without.createButton('Hillcrest Academy') === null, 'no Create button without the add right')
    assert.ok(without.k.bodyText().includes('Hillcrest Academy'), 'the row is still shown')
  })

  it('asks first, and Cancel creates nothing', async () => {
    const { k, press, calls, createButton, dialogButton } = await setup({ search: 'scope=discovered' })
    await press(createButton('Hillcrest Academy'))
    assert.ok(k.one('[role="alertdialog"]')!.textContent!.includes('Create a CRM organisation for Hillcrest Academy?'), "k.one('[role=\"alertdialog\"]')!.textContent!.includes('Create a CRM organisation for Hillcrest Academy?')")
    assert.ok(k.one('[role="alertdialog"]')!.textContent!.includes('Nothing is sent to anyone.'), "k.one('[role=\"alertdialog\"]')!.textContent!.includes('Nothing is sent to anyone.')")
    assert.deepEqual(calls.create, [])
    await press(dialogButton('Cancel'))
    assert.deepEqual(calls.create, [])
  })

  it('creates it, says so with a link to the new organization, and reads the list and the counts again', async () => {
    const { k, press, calls, createButton, dialogButton } = await setup({ search: 'scope=discovered' })
    const listsBefore = calls.list.length
    await press(createButton('Hillcrest Academy'))
    await press(dialogButton('Create CRM organisation'))
    assert.deepEqual(calls.create, [{ id: 2, body: {} }])
    const notice = k.one('[role="status"][tabindex]')!
    assert.ok(notice.textContent!.includes('The CRM organisation Hillcrest Academy was created and linked.'), "notice.textContent!.includes('The CRM organisation Hillcrest Academy was created and linked.')")
    assert.equal(Array.from(notice.querySelectorAll('a')).find((a) => a.textContent === 'Open the CRM organisation')!.getAttribute('href'), '/module/crm/marketing/organizations/91')
    assert.ok(calls.list.length >= listsBefore + 2, 'the list and the counts were read again')
  })

  it('a deleted organisation with the same name: asks to restore it, and restores only when the person says yes', async () => {
    let first = true
    const conflict = new OrgAccountsApiError('A deleted CRM organization already has this name. Restore it instead?', 409, undefined, undefined, 'deleted_name_exists', 41)
    const { k, press, calls, createButton, dialogButton } = await setup({
      search: 'scope=discovered',
      overrides: {
        createCrmOrganisation: async (_id, body) => {
          if (first && !body?.restore_deleted) { first = false; throw conflict }
          return { status: 1, data: { created: false, crm_organization_id: 41, restored: true } }
        },
      },
    })
    await press(createButton('Hillcrest Academy'))
    await press(dialogButton('Create CRM organisation'))
    assert.ok(k.one('[role="alertdialog"]')!.textContent!.includes('A deleted organisation with this name exists. Restore it instead?'), "k.one('[role=\"alertdialog\"]')!.textContent!.includes('A deleted organisation with this name exists. Restore it")
    assert.deepEqual(calls.create, [{ id: 2, body: {} }], 'nothing is restored behind the person\'s back')
    await press(dialogButton('Restore'))
    assert.deepEqual(calls.create, [{ id: 2, body: {} }, { id: 2, body: { restore_deleted: true } }])
    assert.ok(k.one('[role="status"][tabindex]')!.textContent!.includes('The deleted CRM organisation Hillcrest Academy was restored and linked.'), "k.one('[role=\"status\"][tabindex]')!.textContent!.includes('The deleted CRM organisation Hillcrest Academy was ")
  })

  it('declining the restore question leaves the deleted organisation alone and says so', async () => {
    const conflict = new OrgAccountsApiError('Restore it instead?', 409, undefined, undefined, 'deleted_name_exists', 41)
    const { k, press, calls, createButton, dialogButton } = await setup({ search: 'scope=discovered', overrides: { createCrmOrganisation: async () => { throw conflict } } })
    await press(createButton('Hillcrest Academy'))
    await press(dialogButton('Create CRM organisation'))
    await press(dialogButton('Cancel'))
    assert.equal(calls.create.length, 1)
    assert.ok(k.one('[role="status"][tabindex]')!.textContent!.includes('Nothing was created. The deleted organisation was left as it is.'), "k.one('[role=\"status\"][tabindex]')!.textContent!.includes('Nothing was created. The deleted organisation was l")
  })

  it('shows a refusal as an alert in the server\'s words, and keeps the row', async () => {
    const forbidden = await setup({ search: 'scope=discovered', overrides: { createCrmOrganisation: async () => { throw new ApiError('no', 403) } } })
    await forbidden.press(forbidden.createButton('Hillcrest Academy'))
    await forbidden.press(forbidden.dialogButton('Create CRM organisation'))
    assert.equal(forbidden.k.one('[role="alert"][tabindex]')!.textContent!.includes('You are not allowed to create CRM organisations.'), true)
    assert.ok(forbidden.rowOf('Hillcrest Academy'), "forbidden.rowOf('Hillcrest Academy')")
    await disposeAll()
    const clash = await setup({ search: 'scope=discovered', overrides: { createCrmOrganisation: async () => { throw new ApiError('An organization with that name already exists in the CRM. Link it instead of creating another.', 422) } } })
    await clash.press(clash.createButton('Hillcrest Academy'))
    await clash.press(clash.dialogButton('Create CRM organisation'))
    assert.ok(clash.k.one('[role="alert"][tabindex]')!.textContent!.includes('already exists in the CRM'), "clash.k.one('[role=\"alert\"][tabindex]')!.textContent!.includes('already exists in the CRM')")
  })
})

describe('the Possible duplicates scope', () => {
  afterEach(disposeAll)

  it('reads the pairs only when the scope is opened, and shows each pair side by side with its places and how alike the names are', async () => {
    const { calls, openScope, pair, k } = await setup()
    assert.deepEqual(calls.suggestions, [], 'not read while another scope is open')
    await openScope('Possible duplicates')
    assert.equal(calls.suggestions.length, 1)
    const card = pair('crm_organization:11|g2g_company:32')!
    assert.ok(card.textContent!.includes('Riverdale Public School'), "card.textContent!.includes('Riverdale Public School')")
    assert.ok(card.textContent!.includes('Place: Pune, Maharashtra'), "card.textContent!.includes('Place: Pune, Maharashtra')")
    assert.ok(card.textContent!.includes('No place recorded'), "card.textContent!.includes('No place recorded')")
    assert.ok(card.textContent!.includes('80% of the name words match'), "card.textContent!.includes('80% of the name words match')")
    assert.ok(k.bodyText().includes('Showing all 2'), "k.bodyText().includes('Showing all 2')")
  })

  it('D2: a pair in two different places says so on its card, and the question warns before confirming', async () => {
    const conflict = placeConflictSuggestion()
    const { k, press, calls, openScope, pair, dialogButton } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: [conflict] }) } })
    await openScope('Possible duplicates')
    const card = pair(conflict.key)!
    assert.equal(card.querySelector('[data-place-conflict]')!.textContent, 'Different places: Mumbai, Maharashtra / Surat, Gujarat')
    await press(Array.from(card.querySelectorAll('button')).find((b) => b.textContent === 'Confirm: same organisation'))
    assert.ok(k.one('[role="alertdialog"]')!.textContent!.includes('Different places: Mumbai, Maharashtra / Surat, Gujarat.'), "k.one('[role=\"alertdialog\"]')!.textContent!.includes('Different places: Mumbai, Maharashtra / Surat, Gujarat.'")
    await press(dialogButton('Cancel'))
    assert.deepEqual(calls.link, [])
  })

  it('D3: a pair that can never be confirmed offers only "Not the same", and says why', async () => {
    const same = sameSourceSuggestion()
    const { openScope, pair } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: [same, suggestion()] }) } })
    await openScope('Possible duplicates')
    assert.deepEqual(Array.from(pair(same.key)!.querySelectorAll('button')).map((b) => b.textContent), ['Not the same'])
    assert.ok(pair(same.key)!.querySelector('[data-not-confirmable]')!.textContent!.includes('One organisation holds only one record of each kind'), "pair(same.key)!.querySelector('[data-not-confirmable]')!.textContent!.includes('One organisation holds only on")
    assert.deepEqual(Array.from(pair(suggestion().key)!.querySelectorAll('button')).map((b) => b.textContent), ['Confirm: same organisation', 'Not the same'])
  })

  it('D3: after a confirm the pairs are read again (a pair that could now only fail is no longer offered) and so are the counts', async () => {
    const first = suggestion()
    const second = suggestion({ key: 'g2g_company:32|gtm_account:99', left: { type: 'g2g_company', id: 32, name: 'Riverdale', place: null }, right: { type: 'gtm_account', id: 99, name: 'Riverdale School', place: null } })
    let served = [first, second]
    const { k, press, calls, openScope, pair, dialogButton } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: served }) } })
    await openScope('Possible duplicates')
    assert.equal(calls.suggestions.length, 1)
    const listsBefore = calls.list.length
    served = []   // the server no longer offers the other pair: confirming the first made it impossible
    await press(Array.from(pair(first.key)!.querySelectorAll('button')).find((b) => b.textContent === 'Confirm: same organisation'))
    assert.ok(k.one('[role="alertdialog"]')!.textContent!.includes('same organisation?'), "k.one('[role=\"alertdialog\"]')!.textContent!.includes('same organisation?')")
    await press(dialogButton('Confirm: same organisation'))
    assert.deepEqual(calls.link, [{ left_type: 'crm_organization', left_id: 11, right_type: 'g2g_company', right_id: 32, action: 'confirm' }])
    assert.equal(calls.suggestions.length, 2, 'the pairs were read again')
    assert.ok(calls.list.length > listsBefore, 'and so were the counts')
    assert.ok(pair(second.key) === null, 'the pair that could now only fail is gone')
    assert.ok(k.one('[role="status"][tabindex]')!.textContent!.includes('are now shown as one organisation'), "k.one('[role=\"status\"][tabindex]')!.textContent!.includes('are now shown as one organisation')")
    assert.equal(k.all('[role="tab"]').find((t) => t.textContent!.startsWith('Possible duplicates'))!.getAttribute('aria-label'), 'Possible duplicates 0', 'the live count fell')
  })

  it('the 409 of a pair that cannot be linked is shown in the server\'s words and the pair stays', async () => {
    const { k, press, calls, openScope, pair, dialogButton } = await setup({
      overrides: { link: async () => { throw new ApiError('Both organisations already have a record from the same source, so they cannot be one.', 409) } },
    })
    await openScope('Possible duplicates')
    await press(Array.from(pair(suggestion().key)!.querySelectorAll('button')).find((b) => b.textContent === 'Confirm: same organisation'))
    await press(dialogButton('Confirm: same organisation'))
    assert.equal(calls.link.length, 1)
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('cannot be one'), "k.one('[role=\"alert\"]')!.textContent!.includes('cannot be one')")
    assert.ok(pair(suggestion().key), 'the pair stays')
    assert.equal(calls.suggestions.length, 1, 'nothing was read again after a failure')
  })

  it('"Not the same" asks first and records the answer; Cancel records nothing', async () => {
    const { k, press, calls, openScope, pair, dialogButton } = await setup()
    await openScope('Possible duplicates')
    const reject = () => Array.from(pair(suggestion().key)!.querySelectorAll('button')).find((b) => b.textContent === 'Not the same')
    await press(reject())
    assert.ok(k.one('[role="alertdialog"]')!.textContent!.includes('different organisations?'), "k.one('[role=\"alertdialog\"]')!.textContent!.includes('different organisations?')")
    await press(dialogButton('Cancel'))
    assert.equal(calls.link.length, 0)
    await press(reject())
    await press(dialogButton('Not the same'))
    assert.equal(calls.link[0].action, 'reject')
  })

  it('without the right to confirm the pairs are shown and no button is offered', async () => {
    const { k, openScope, pair } = await setup({ overrides: { meta: async () => ({ status: 1, data: meta({ confirm_links: false }) }) } })
    await openScope('Possible duplicates')
    assert.equal(pair(suggestion().key)!.querySelectorAll('button').length, 0)
    assert.ok(k.bodyText().includes('you are not allowed to confirm or reject them'), "k.bodyText().includes('you are not allowed to confirm or reject them')")
  })

  it('says there are no possible duplicates, and a failure has a Retry', async () => {
    const none = await setup({ search: 'scope=duplicates', overrides: { suggestions: async () => ({ status: 1, data: [] }) } })
    assert.ok(none.k.bodyText().includes('No possible duplicates.'), "none.k.bodyText().includes('No possible duplicates.')")
    await disposeAll()
    let attempts = 0
    const flaky = await setup({ search: 'scope=duplicates', overrides: { suggestions: async () => { attempts += 1; if (attempts === 1) throw new Error('Busy.'); return { status: 1, data: [suggestion()] } } } })
    assert.ok(flaky.k.bodyText().includes('Busy.'), "flaky.k.bodyText().includes('Busy.')")
    await flaky.press(flaky.k.withText('Retry'))
    assert.ok(flaky.pair(suggestion().key), "flaky.pair(suggestion().key)")
  })
})
