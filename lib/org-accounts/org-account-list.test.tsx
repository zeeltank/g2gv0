import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signal-review/router-harness'
import { ApiError } from '../../services/core'
import type { OrgAccountsApi } from '../../services/org-accounts/api-types'
import { fakeService } from './fake-service'
import { DEFAULT_LINKS } from './links'
import { listResponse, meta, orgItems, suggestion, suggestions, summary } from './fixtures'

/** The Organisation 360 list in a fake browser, with the address kept by a stand-in router and the server replaced by a fake. */
interface Setup {
  search?: string
  overrides?: Partial<OrgAccountsApi>
}

async function setup(options: Setup = {}) {
  const k = await kit()
  const router = await routerHarness(options.search ?? '', '/module/crm/organisation-360')
  const { OrgAccountList } = await import('../../components/domain/crm/org-account-list')

  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const { service, calls } = fakeService(options.overrides)
  await k.render(router.wrap(k.h(OrgAccountList, { service, links: DEFAULT_LINKS })))
  await k.tick(10)

  const rowOf = (name: string) => k.all('tbody tr').find((tr) => tr.textContent?.includes(name)) ?? null
  const facet = (label: string) => k.all('select').find((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent === label) as HTMLSelectElement
  const choose = async (label: string, value: string) => {
    const select = facet(label)
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(select, value); select.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.tick(10)
  }
  const tab = (label: string) => k.all('[role="tab"]').find((t) => t.textContent?.startsWith(label)) as HTMLElement
  const openDuplicates = async () => { await k.click(tab('Possible duplicates')); await k.tick(10) }
  const pairOf = (name: string) => k.all('[data-pair]').find((li) => li.textContent?.includes(name)) ?? null
  const dialog = () => k.one('[role="alertdialog"]')
  const dialogButton = (label: string) => k.all('[role="alertdialog"] button').find((b) => b.textContent?.trim() === label) ?? null
  const press = async (button: Element | null | undefined) => { assert.ok(button, 'the button exists'); await k.click(button); await k.tick(10) }

  return { k, router, service, calls, rowOf, facet, choose, tab, openDuplicates, pairOf, dialog, dialogButton, press }
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('OrgAccountList: the organisations', () => {
  afterEach(disposeAll)

  it('shows each organisation with its name, website, lifecycle in words, owner and the day it was updated', async () => {
    const { k, rowOf } = await setup()
    assert.equal(k.all('tbody tr').length, 5)
    const first = rowOf('Riverdale Public School')!.textContent!
    for (const part of ['riverdale.example', 'Engaged', 'Anil Shah', '20 Oct 2026']) assert.ok(first.includes(part), part)
    assert.ok(rowOf('Hillcrest Academy')!.textContent!.includes('Unassigned'))
    assert.ok(rowOf('Hillcrest Academy')!.textContent!.includes('No website'))
    assert.ok(rowOf('Old Town School')!.textContent!.includes('Archived'), 'the status is a word, not only a colour')
  })

  it('links the name to the organisation\'s own page', async () => {
    const { rowOf } = await setup()
    const link = rowOf('Lakeview School')!.querySelector('a')!
    assert.equal(link.getAttribute('href'), '/module/crm/organisation-360/3')
  })

  it('shows a badge only for the sources an organisation has, and the open signals as a count', async () => {
    const { rowOf } = await setup()
    const sources = (name: string) => Array.from(rowOf(name)!.querySelectorAll('[data-source]')).map((el) => el.getAttribute('data-source'))
    assert.deepEqual(sources('Riverdale Public School'), ['crm', 'gtm', 'signals'])
    assert.deepEqual(sources('Hillcrest Academy'), ['signals'])
    assert.deepEqual(sources('Lakeview School'), ['gtm'])
    assert.deepEqual(sources('Maple Grove College'), ['crm'])
    assert.ok(rowOf('Riverdale Public School')!.textContent!.includes('3 open signals'))
    assert.ok(rowOf('Hillcrest Academy')!.textContent!.includes('1 open signal'))
    assert.ok(!rowOf('Hillcrest Academy')!.textContent!.includes('CRM'), 'no CRM badge for an organisation with no CRM row')
  })

  it('shows the counts the server returned, and the number of possible duplicates', async () => {
    const { k } = await setup()
    const tiles = k.one('[aria-label="Summary"]')!.textContent!
    for (const part of ['5organisations', '2discovered', '1target', '1engaged', '1customers', '2possible duplicates']) assert.ok(tiles.includes(part), part)
  })

  it('asks for the first page with no filter, and offers every lifecycle and Any / Yes / No', async () => {
    const { calls, facet } = await setup()
    assert.deepEqual(calls.list[0], { page: 1, per_page: 20 })
    assert.deepEqual(Array.from(facet('Lifecycle').options).map((o) => o.textContent), ['All', 'Discovered', 'Target', 'Engaged', 'Customer', 'Archived'])
    for (const label of ['Has CRM', 'Has GTM', 'Has Signals']) assert.deepEqual(Array.from(facet(label).options).map((o) => o.textContent), ['Any', 'Yes', 'No'])
  })

  it('writes a chosen filter to the address and asks the server for it', async () => {
    const { router, calls, choose, facet } = await setup()
    await choose('Lifecycle', 'target')
    assert.equal(router.lastSearch(), 'lifecycle=target')
    assert.equal(calls.list.at(-1)?.lifecycle, 'target')
    assert.equal(facet('Lifecycle').value, 'target', 'the box shows the choice that is now in the address')

    await choose('Has CRM', 'no')
    assert.equal(router.lastSearch(), 'lifecycle=target&crm=no')
    assert.equal(calls.list.at(-1)?.has_crm, 0)
    await choose('Has GTM', 'yes')
    assert.equal(calls.list.at(-1)?.has_gtm, 1)
    await choose('Has Signals', 'yes')
    assert.equal(router.lastSearch(), 'lifecycle=target&crm=no&gtm=yes&signals=yes')
    assert.deepEqual(calls.list.at(-1), { page: 1, per_page: 20, lifecycle: 'target', has_crm: 0, has_gtm: 1, has_signals: 1 })
  })

  it('opens a pasted link on the same view: the boxes and the request come from the address', async () => {
    const { calls, facet } = await setup({ search: 'lifecycle=customer&crm=yes&gtm=no&signals=any&q=maple' })
    assert.deepEqual(calls.list[0], { page: 1, per_page: 20, q: 'maple', lifecycle: 'customer', has_crm: 1, has_gtm: 0 })
    assert.equal(facet('Lifecycle').value, 'customer')
    assert.equal(facet('Has CRM').value, 'yes')
    assert.equal(facet('Has GTM').value, 'no')
    assert.equal(facet('Has Signals').value, 'any')
  })

  it('shows a loading state before the first answer', async () => {
    const { k } = await setup({ overrides: { list: () => new Promise(() => undefined) } })
    assert.ok(k.bodyText().includes('Loading organisations'))
    assert.equal(k.all('tbody tr').length, 0)
  })

  it('shows an error with Retry, and Retry loads the list', async () => {
    let attempts = 0
    const { k, calls } = await setup({ overrides: { list: async () => { attempts += 1; if (attempts === 1) throw new Error('The server is busy.'); return listResponse() } } })
    assert.ok(k.bodyText().includes('Organisations could not be loaded'))
    assert.ok(k.bodyText().includes('The server is busy.'))
    assert.equal(k.all('tbody tr').length, 0)
    await k.click(k.withText('Retry')!)
    await k.tick(10)
    assert.equal(calls.list.length, 2)
    assert.equal(k.all('tbody tr').length, 5)
    assert.ok(!k.bodyText().includes('The server is busy.'))
  })

  it('says plainly that there is no access on a 403, with no Retry and no crash', async () => {
    const { k } = await setup({ overrides: { list: async () => { throw new ApiError('This action is unauthorized.', 403) } } })
    assert.ok(k.bodyText().includes('You do not have access to Organisation 360'))
    assert.ok(!k.bodyText().includes('could not be loaded'))
    assert.equal(k.withText('Retry'), null)
    assert.equal(k.all('[role="tab"]').length, 0)
    assert.equal(k.all('tbody tr').length, 0)
  })

  it('says the backfill has not run when the organisation has no organisations at all', async () => {
    const { k } = await setup({ overrides: { list: async () => listResponse([], { summary: summary({ total: 0, suggestions: 0 }) }) } })
    assert.ok(k.bodyText().includes('No organisations yet'))
    assert.ok(k.bodyText().includes('backfill'))
    assert.ok(k.bodyText().includes('has not run'))
    assert.equal(k.withText('Clear filters'), null)
  })

  it('says "No organisations match these filters" when some exist, and Clear filters shows everything', async () => {
    const { k, router, calls } = await setup({ search: 'q=zzz&lifecycle=archived', overrides: { list: async (p) => (p.q ? listResponse([]) : listResponse()) } })
    assert.ok(k.bodyText().includes('No organisations match these filters'))
    assert.ok(!k.bodyText().includes('No organisations yet'))
    await k.click(k.withText('Clear filters')!)
    await k.tick(10)
    assert.equal(router.lastSearch(), '')
    assert.deepEqual(calls.list.at(-1), { page: 1, per_page: 20 })
    assert.equal(k.all('tbody tr').length, 5)
  })

  it('keeps the search and the filters on screen when nothing matches', async () => {
    const { k } = await setup({ search: 'crm=no', overrides: { list: async () => listResponse([]) } })
    assert.ok(k.bodyText().includes('No organisations match these filters'))
    assert.equal(k.all('select').length, 4)
    assert.ok(k.one('input'))
  })

  it('offers paging when there is more than a page, and asks for the next page', async () => {
    const { k, router, calls } = await setup({ overrides: { list: async () => listResponse(orgItems(), { meta: { page: 1, per_page: 20, total: 45, last_page: 3 } }) } })
    assert.ok(k.bodyText().includes('Showing 1–5 of 45'))
    assert.ok(k.bodyText().includes('Page 1 of 3'))
    assert.equal((k.withText('Previous') as HTMLButtonElement).disabled, true)
    await k.click(k.withText('Next')!)
    await k.tick(10)
    assert.equal(router.lastSearch(), 'page=2')
    assert.equal(calls.list.at(-1)?.page, 2)
  })

  it('has no sideways page scroll: the table scrolls inside its own container', async () => {
    const { k } = await setup()
    let box = k.one('table')!.parentElement
    while (box && !/overflow-(x-)?auto/.test(box.className)) box = box.parentElement
    assert.ok(box, 'an ancestor of the table scrolls on its own')
    assert.ok(box!.contains(k.one('table')) && !box!.contains(k.one('h1')), 'and it is not the page')
  })
})

describe('OrgAccountList: the tabs', () => {
  afterEach(disposeAll)

  it('names the second tab with the number of possible duplicates', async () => {
    const { tab } = await setup()
    assert.equal(tab('Possible duplicates').textContent, 'Possible duplicates2')
    assert.equal(tab('Organisations').getAttribute('aria-selected'), 'true')
  })

  it('opens the duplicates tab from a click, keeps it in the address, and hides the organisation filters', async () => {
    const { k, router, openDuplicates, tab } = await setup()
    await openDuplicates()
    assert.equal(router.lastSearch(), 'tab=duplicates')
    assert.equal(tab('Possible duplicates').getAttribute('aria-selected'), 'true')
    assert.equal(k.all('select').length, 0)
    assert.equal(k.all('tbody tr').length, 0)
  })

  it('moves between the tabs with the arrow keys, and the focus goes with the selection', async () => {
    const { k, tab } = await setup()
    await k.act(async () => { tab('Organisations').focus() })
    await k.press('ArrowRight')
    await k.tick(10)
    assert.equal(tab('Possible duplicates').getAttribute('aria-selected'), 'true')
    assert.ok(k.w.document.activeElement === tab('Possible duplicates'))
    await k.press('ArrowLeft')
    await k.tick(10)
    assert.equal(tab('Organisations').getAttribute('aria-selected'), 'true')
  })

  it('opens straight on the duplicates tab from a pasted link', async () => {
    const { pairOf } = await setup({ search: 'tab=duplicates' })
    assert.ok(pairOf('Riverdale School Society'))
  })
})

describe('OrgAccountList: possible duplicates', () => {
  afterEach(disposeAll)

  it('shows each pair as two names side by side, what each is, and how much of the name words match', async () => {
    const { k, openDuplicates, pairOf } = await setup()
    await openDuplicates()
    const pair = pairOf('Riverdale Public School')!
    for (const part of ['Riverdale Public School', 'CRM organisation', 'Riverdale School Society', 'Signals company', '80% of the name words match']) assert.ok(pair.textContent!.includes(part), part)
    assert.ok(pairOf('Lake View Higher School')!.textContent!.includes('67% of the name words match'))
    assert.ok(k.withText('Confirm: same organisation', '[data-pair] button'))
    assert.equal(k.all('[data-pair] button').length, 4)
  })

  it('asks what will happen before it sends anything, and Cancel sends nothing', async () => {
    const { k, calls, openDuplicates, pairOf, dialog, dialogButton, press } = await setup()
    await openDuplicates()
    await press(pairOf('Riverdale Public School')!.querySelector('button'))
    assert.ok(dialog()!.textContent!.includes('These two will be shown as one organisation. Nothing in either record is changed.'))
    await press(dialogButton('Cancel'))
    assert.equal(calls.link.length, 0)
    assert.ok(pairOf('Riverdale School Society'), 'the pair is still there')
    assert.equal(k.all('[role="alertdialog"]').length, 0)
  })

  it('sends "confirm" with the pair\'s two rows, removes the pair in place and counts one fewer', async () => {
    const { k, calls, openDuplicates, pairOf, dialogButton, press, tab } = await setup()
    await openDuplicates()
    await press(pairOf('Riverdale Public School')!.querySelector('button'))
    await press(dialogButton('Confirm: same organisation'))
    assert.deepEqual(calls.link, [{ left_type: 'crm_organization', left_id: 11, right_type: 'g2g_company', right_id: 32, action: 'confirm' }])
    assert.equal(pairOf('Riverdale School Society'), null, 'the decided pair is gone')
    assert.ok(pairOf('Lake View Higher School'), 'the other pair stays')
    assert.equal(tab('Possible duplicates').textContent, 'Possible duplicates1')
    assert.ok(k.bodyText().includes('are now shown as one organisation'))
    assert.ok(k.one('[aria-label="Summary"]')!.textContent!.includes('1possible duplicates'))
  })

  it('reads the organisations again after a confirm, because two of them are now one', async () => {
    const { calls, openDuplicates, pairOf, dialogButton, press } = await setup()
    await openDuplicates()
    const before = calls.list.length
    await press(pairOf('Riverdale Public School')!.querySelector('button'))
    await press(dialogButton('Confirm: same organisation'))
    assert.equal(calls.list.length, before + 1)
  })

  it('sends "reject" for Not the same, and the pair goes without the list being read again', async () => {
    const { calls, openDuplicates, pairOf, dialog, dialogButton, press } = await setup()
    await openDuplicates()
    const before = calls.list.length
    const buttons = pairOf('Lake View Higher School')!.querySelectorAll('button')
    await press(buttons[1])
    assert.ok(dialog()!.textContent!.includes('will not be suggested as the same organisation again'))
    await press(dialogButton('Not the same'))
    assert.equal(calls.link.length, 1)
    assert.equal(calls.link[0].action, 'reject')
    assert.equal(calls.link[0].left_id, 22)
    assert.equal(pairOf('Lake View Higher School'), null)
    assert.equal(calls.list.length, before)
  })

  it('disables both buttons while a decision is being saved, and says so', async () => {
    const wait = deferred<{ status: 1; data: null }>()
    const { k, openDuplicates, pairOf, dialogButton, press } = await setup({ overrides: { link: () => wait.promise } })
    await openDuplicates()
    await press(pairOf('Riverdale Public School')!.querySelector('button'))
    await press(dialogButton('Confirm: same organisation'))
    const buttons = k.all('[data-pair] button') as HTMLButtonElement[]
    assert.ok(buttons.every((b) => b.disabled), 'no second decision while one is running')
    assert.ok(pairOf('Riverdale Public School')!.textContent!.includes('Saving…'))
    await k.act(async () => { wait.resolve({ status: 1, data: null }) })
    await k.tick(10)
    assert.equal(pairOf('Riverdale Public School'), null)
  })

  for (const [status, message, shown] of [
    [422, 'These two cannot be linked.', 'These two cannot be linked.'],
    [404, 'One of these records was deleted.', 'One of these records was deleted.'],
    [409, 'One of these is already in another organisation.', 'One of these is already in another organisation.'],
    [403, 'This action is unauthorized.', 'You are not allowed to confirm or reject links.'],
  ] as const) {
    it(`shows the answer to a refused confirm (${status}) and keeps the list and the pair`, async () => {
      const { k, calls, openDuplicates, pairOf, dialogButton, press } = await setup({ overrides: { link: async () => { throw new ApiError(message, status) } } })
      await openDuplicates()
      await press(pairOf('Riverdale Public School')!.querySelector('button'))
      await press(dialogButton('Confirm: same organisation'))
      assert.equal(calls.link.length, 1)
      assert.ok(k.one('[role="alert"]')!.textContent!.includes(shown))
      assert.ok(pairOf('Riverdale School Society'), 'the pair is still there')
      assert.ok(pairOf('Lake View Higher School'), 'so is the rest of the list')
      assert.equal(k.all('[role="alertdialog"]').length, 0)
      assert.equal((k.all('[data-pair] button') as HTMLButtonElement[]).filter((b) => b.disabled).length, 0, 'the buttons work again')
    })
  }

  it('moves the focus to the tab\'s heading when the pressed button leaves with its pair', async () => {
    const { k, openDuplicates, pairOf, dialogButton, press } = await setup()
    await openDuplicates()
    await press(pairOf('Riverdale Public School')!.querySelector('button'))
    await press(dialogButton('Confirm: same organisation'))
    assert.equal((k.w.document.activeElement as HTMLElement).textContent, 'Possible duplicates')
  })

  it('returns the focus to the button that was pressed when the question is cancelled', async () => {
    const { k, openDuplicates, pairOf, dialogButton, press } = await setup()
    await openDuplicates()
    const button = pairOf('Riverdale Public School')!.querySelector('button')!
    await press(button)
    await press(dialogButton('Cancel'))
    assert.ok(k.w.document.activeElement === button)
  })

  it('says what an empty tab means', async () => {
    const { k, openDuplicates } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: [] }) } })
    await openDuplicates()
    assert.ok(k.bodyText().includes('No possible duplicates. Names that match exactly are linked automatically.'))
  })

  it('shows no Confirm or Not the same without the right to confirm links, and says why', async () => {
    const { k, openDuplicates, pairOf } = await setup({ overrides: { meta: async () => ({ status: 1, data: meta({ confirm_links: false }) }) } })
    await openDuplicates()
    assert.ok(pairOf('Riverdale Public School'), 'the pairs can still be seen')
    assert.equal(k.all('[data-pair] button').length, 0)
    assert.ok(k.bodyText().includes('not allowed to confirm or reject'))
  })

  it('offers nothing to decide with when the rights could not be read', async () => {
    const { k, openDuplicates } = await setup({ overrides: { meta: async () => { throw new Error('down') } } })
    await openDuplicates()
    assert.equal(k.all('[data-pair] button').length, 0)
  })

  it('shows an error with Retry for the pairs, and Retry loads them', async () => {
    let attempts = 0
    const { k, openDuplicates, pairOf } = await setup({ overrides: { suggestions: async () => { attempts += 1; if (attempts === 1) throw new Error('Suggestions are busy.'); return { status: 1, data: suggestions() } } } })
    await openDuplicates()
    assert.ok(k.bodyText().includes('Possible duplicates could not be loaded'))
    assert.ok(k.bodyText().includes('Suggestions are busy.'))
    await k.click(k.withText('Retry')!)
    await k.tick(10)
    assert.ok(pairOf('Riverdale School Society'))
  })

  it('says so when the server holds back some pairs, instead of claiming to show all', async () => {
    const one = [suggestion()]
    const { k, openDuplicates } = await setup({ overrides: { suggestions: async () => ({ status: 1, data: one }) } })
    await openDuplicates()
    assert.ok(k.bodyText().includes('Showing 1 of 2'), 'the summary counts 2, the server sent 1')
    assert.ok(!k.bodyText().includes('Showing all'))
  })

  it('says it shows all pairs when it does', async () => {
    const { k, openDuplicates } = await setup()
    await openDuplicates()
    assert.ok(k.bodyText().includes('Showing all 2'))
  })
})
