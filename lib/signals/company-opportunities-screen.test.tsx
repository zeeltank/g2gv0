import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { DecisionConflictError } from '../../services/signal-review/decision-error'
import type { SignalDecisionResponse, SignalDetailResponse, SignalHistoryResponse, SignalPromoteResponse } from '../../services/signal-review/signal-types'
import type { DecisionRequest } from '../../services/signal-review/types'
import type { OpportunityListResponse, OpportunityQuery } from '../../services/signals/opportunities'
import { opportunities, opportunity, opportunityList, portfolioProducts } from './opportunity-fixtures'
import { routerHarness } from './router-harness'
import { historyEntry } from './signal-fixtures'
import { FORBIDDEN_TEXT, NETWORK_TEXT, NOT_FOUND_TEXT } from './decision-failure'
import { LEAD_FORBIDDEN_TEXT, NO_LEAD_ID_TEXT } from './lead-action'

/**
 * The whole Company Opportunities screen in a fake browser: the address kept by a stand-in router, and the four services (the opportunity feed, the
 * Product Portfolio, the Signal Review's decisions and the research runs) replaced by fakes that record what they are asked. These are the proofs that
 * the screen can do what the Signal Review screen did: the filters in the address, a link that only searches, a number or a key in `product`, the
 * server's counts, the page size, the decision dialog, the history and the fit, and the lead.
 */
interface Setup {
  search?: string
  remembered?: string
  list?: (q: OpportunityQuery) => Promise<OpportunityListResponse>
  decide?: (id: number, body: DecisionRequest) => Promise<SignalDecisionResponse>
  history?: (id: number) => Promise<SignalHistoryResponse>
  promote?: (id: number) => Promise<SignalPromoteResponse>
  masterOptions?: Array<{ id: number; key: string; name: string; kind: 'product' | 'sub_product'; parentId: number | null; label: string }>
}

const CONTEXT = { organizationId: 1, subInstituteId: 1, userId: 2 } as never
const CONFLICT = historyEntry({ id: 77, decision: 'reviewed', from_status: 'New', to_status: 'Reviewed', decided_by_name: 'Anil Shah', note: 'Looked at it.' })

async function setup(options: Setup = {}, mount = true) {
  const k = await kit()
  const router = await routerHarness(options.search ?? '', '/signals')
  const { opportunitiesService } = await import('../../services/signals/opportunities')
  const { portfolioService } = await import('../../services/portfolio/portfolio-service')
  const { signalReviewService } = await import('../../services/signal-review/signal-review-service')
  const { CompanyOpportunities } = await import('../../components/domain/signals/company-opportunities')

  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  if (options.remembered) k.w.localStorage.setItem('g2g_product_1', options.remembered)
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const listCalls: OpportunityQuery[] = []
  const decideCalls: Array<{ id: number; body: DecisionRequest }> = []
  const historyCalls: number[] = []
  const promoteCalls: number[] = []
  const getCalls: number[] = []
  const runCalls = { runDates: 0, status: 0, runResearch: 0 }

  Object.assign(opportunitiesService, {
    list: async (_c: unknown, q: OpportunityQuery) => { listCalls.push(q); return options.list ? options.list(q) : opportunityList() },
    getRunDates: async () => { runCalls.runDates += 1; return { status: 1, data: { product: 'x', timezone: 'Asia/Kolkata', dates: [] } } },
    getStatus: async () => {
      runCalls.status += 1
      return { status: 1, data: { requirements: { profile_complete: true, profile_missing: [], search_configured: true, search_driver: 'x', ai_configured: true, research_enabled: true }, running: false, latest_run: null, last_successful_run: null, next_scheduled_at: null, timezone: 'Asia/Kolkata' } }
    },
    runResearch: async () => { runCalls.runResearch += 1; return { status: 1, message: 'ok' } },
  })
  Object.assign(portfolioService, { getProducts: async () => portfolioProducts() })
  Object.assign(signalReviewService, {
    decide: async (id: number, body: DecisionRequest) => {
      decideCalls.push({ id, body })
      if (options.decide) return options.decide(id, body)
      return { status: 1, data: { ...opportunity({ id }), review_status: 'Follow-up' }, review: historyEntry({ id: 99 }) }
    },
    history: async (id: number) => { historyCalls.push(id); return options.history ? options.history(id) : { status: 1, data: [historyEntry({ id: 5, note: 'Called the office.' })] } },
    promote: async (id: number) => { promoteCalls.push(id); return options.promote ? options.promote(id) : { status: 1, data: { lead_id: '501', created: true } } },
    get: async (id: number): Promise<SignalDetailResponse> => { getCalls.push(id); return { status: 1, data: { ...opportunity({ id }), review_status: 'Reviewed' } as never } },
    productOptions: async () => ({ status: 1, data: options.masterOptions ?? [{ id: 4, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentId: null, label: 'ScholarClone' }] }),
  })

  const element = () => router.wrap(k.h(CompanyOpportunities, { context: CONTEXT }))
  if (mount) {
    await k.render(element())
    await k.tick(20)
  }

  const facet = (label: string) => k.all('select').find((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent === label) as HTMLSelectElement
  const setSelect = async (select: HTMLSelectElement, value: string) => {
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(select, value); select.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.tick(20)
  }
  const choose = (label: string, value: string) => setSelect(facet(label), value)
  const mainProduct = () => k.one('#main-product-select') as HTMLSelectElement
  const cardOf = (title: string) => k.all('article').find((a) => a.textContent?.includes(title)) as HTMLElement
  const inCard = (card: HTMLElement, text: string) => Array.from(card.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLElement
  const generate = () => k.withText('Generate Signals') as HTMLButtonElement

  return { k, router, listCalls, decideCalls, historyCalls, promoteCalls, getCalls, runCalls, facet, choose, setSelect, mainProduct, cardOf, inCard, generate, element }
}

describe('Company Opportunities: a link that only searches', () => {
  afterEach(disposeAll)

  it('opens on All products, with every status and the search applied, and asks the server for exactly that', async () => {
    const title = 'District office invites bids for a school management system'
    const { listCalls, mainProduct, facet, k } = await setup({ search: `status=all&q=${encodeURIComponent(title)}` })

    assert.equal(mainProduct().value, 'all')
    assert.equal(mainProduct().options[mainProduct().selectedIndex].textContent, 'All products')
    assert.equal(facet('Status').value, 'all')
    assert.equal((k.one('input[aria-label="Search signals"]') as HTMLInputElement).value, title)

    assert.equal(listCalls.length, 1, 'one request, not one per step of the screen opening')
    assert.equal(listCalls[0].search, title)
    assert.equal(listCalls[0].product, 'all', 'no single product')
    assert.equal(listCalls[0].reviewStatus, undefined, 'no review_status: every status')
    assert.equal(listCalls[0].productMasterId, undefined)
    assert.equal(listCalls[0].freshness, undefined)
    assert.equal(listCalls[0].businessFit, undefined)
  })

  it('does not start a run or look up a product\'s research days, and Generate says why it is off', async () => {
    const { runCalls, generate, k } = await setup({ search: 'status=all&q=Hillcrest' })
    assert.equal(runCalls.runDates, 0)
    assert.equal(runCalls.status, 0)
    assert.equal(generate().disabled, true)
    assert.equal(generate().title, 'Choose one product to generate signals for it.')
    await k.click(generate())
    assert.equal(runCalls.runResearch, 0)
  })

  it('writes the choice into the address, so clearing the search does not move the screen to another product', async () => {
    const { router, k, listCalls, mainProduct } = await setup({ search: 'q=Hillcrest' })
    assert.equal(router.lastSearch(), 'q=Hillcrest&product=all')

    // The person clears the search: the address now has no search at all, and the screen is still on All products.
    const input = k.one('input[aria-label="Search signals"]') as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLInputElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(input, ''); input.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
    await k.tick(400)
    assert.equal(router.lastSearch(), 'product=all')
    assert.equal(mainProduct().value, 'all')
    assert.equal(listCalls.at(-1)?.search, undefined)
    assert.equal(listCalls.at(-1)?.product, 'all')
  })

  it('keeps a page number in the link when it writes the product into the address', async () => {
    const { router } = await setup({ search: 'q=Hillcrest&page=3' })
    assert.equal(router.lastSearch(), 'q=Hillcrest&page=3&product=all')
  })

  it('with no parameters at all the screen is what it was: the first ready product, whose research days it looks up, and nothing is written', async () => {
    const { mainProduct, listCalls, runCalls, router, facet } = await setup()
    assert.equal(mainProduct().value, 'scholarclone')
    assert.equal(facet('Status').value, 'all')
    assert.equal(facet('Page size').value, '5')
    assert.equal(runCalls.runDates > 0, true)
    assert.equal(router.written.length, 0, 'the address is left clean')
    assert.equal(listCalls.at(-1)?.product, 'scholarclone')
    assert.equal(listCalls.at(-1)?.perPage, 5)
    assert.equal(listCalls.at(-1)?.reviewStatus, undefined)
  })

  it('with no parameters it opens on the product this browser remembered', async () => {
    const { mainProduct, listCalls } = await setup({ remembered: 'g2g' })
    assert.equal(mainProduct().value, 'g2g')
    assert.equal(listCalls.at(-1)?.product, 'g2g')
  })
})

describe('Company Opportunities: what stays as it was for one product', () => {
  afterEach(disposeAll)

  it('a product keeps its research days, the calendar, adding by hand and the Advanced tools; All products has none of them (they belong to one product)', async () => {
    const product = await setup({ search: 'product=g2g' })
    const has = (k: Awaited<ReturnType<typeof kit>>) => ({
      today: k.withText('Today') !== null,
      days: k.one('select[aria-label="Recent signal dates"]') !== null,
      calendar: k.one('input[aria-label="Calendar date picker"]') !== null,
      manual: k.withText('Add Opportunity Manually') !== null,
      advanced: k.bodyText().includes('Advanced tools'),
      icp: k.one('#icp-type-select') !== null && !(k.one('#icp-type-select') as HTMLSelectElement).disabled,
    })
    assert.deepEqual(has(product.k), { today: true, days: true, calendar: true, manual: true, advanced: true, icp: true })
    await disposeAll()

    const every = await setup({ search: 'product=all' })
    assert.deepEqual(has(every.k), { today: false, days: false, calendar: false, manual: false, advanced: false, icp: false })
    assert.equal((every.k.one('#sub-product-select') as HTMLSelectElement).disabled, true)
    assert.equal((every.k.one('#icp-type-select') as HTMLSelectElement).disabled, true)
  })

  it('changing what the list is about (here the ICP type) sends it back to page one, and leaves the other filters alone', async () => {
    const { k, router, listCalls, setSelect } = await setup({
      search: 'product=g2g&page=3&status=reviewed',
      list: async (q) => opportunityList(opportunities(), { meta: { page: q.page ?? 1, per_page: 5, total: 25, last_page: 5 } }),
    })
    assert.equal(listCalls.at(-1)?.page, 3)
    await setSelect(k.one('#icp-type-select') as HTMLSelectElement, 'b2g')
    assert.equal(listCalls.at(-1)?.page, 1)
    assert.equal(listCalls.at(-1)?.customerModel, undefined, 'a whole product reads every ICP type')
    assert.equal(router.lastSearch(), 'product=g2g&status=reviewed')
  })

  it('the source tabs (All, Generated, Manually Added) still narrow the list, and go back to page one', async () => {
    const { k, listCalls, router } = await setup({ search: 'product=all&page=2' })
    assert.equal(listCalls.at(-1)?.source, 'all')
    await k.click(k.all('[role="tab"]').find((t) => t.textContent === 'Manually Added')!)
    await k.tick(20)
    assert.equal(listCalls.at(-1)?.source, 'manual')
    assert.equal(router.lastSearch(), 'product=all', 'the page went back to one')
  })
})

describe('Company Opportunities: product in the address', () => {
  afterEach(disposeAll)

  it('a product key selects that product and sends it', async () => {
    const { mainProduct, listCalls, generate } = await setup({ search: 'product=g2g' })
    assert.equal(mainProduct().value, 'g2g')
    assert.equal(listCalls.at(-1)?.product, 'g2g')
    assert.equal(listCalls.at(-1)?.productMasterId, undefined)
    assert.equal(generate().disabled, false, 'one product: a run can start')
  })

  it('a sub-product of a product selects it too', async () => {
    const { k, listCalls } = await setup({ search: 'product=scholarclone%3A%3ASCH-11' })
    assert.equal((k.one('#sub-product-select') as HTMLSelectElement).value, 'SCH-11')
    assert.equal(listCalls.at(-1)?.offerId, 'SCH-11')
  })

  it('a number is a Product Master record: the request carries product_master_id and the box names the record', async () => {
    const { mainProduct, listCalls, runCalls, generate } = await setup({ search: 'product=4', masterOptions: [{ id: 4, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentId: null, label: 'ScholarClone' }, { id: 9, key: 'x', name: 'School ERP', kind: 'sub_product', parentId: 4, label: 'ScholarClone › School ERP' }] })
    assert.equal(listCalls.at(-1)?.productMasterId, 4)
    assert.equal(listCalls.at(-1)?.product, 'all')
    assert.equal(mainProduct().value, '4')
    assert.equal(mainProduct().options[mainProduct().selectedIndex].textContent, 'ScholarClone')
    assert.equal(runCalls.runDates, 0, 'a record is not a product with research days')
    assert.equal(generate().disabled, true)
  })

  it('a number the options do not know is still kept, named by its number, so the box never shows a wrong product', async () => {
    const { mainProduct, listCalls } = await setup({ search: 'product=99' })
    assert.equal(listCalls.at(-1)?.productMasterId, 99)
    assert.equal(mainProduct().options[mainProduct().selectedIndex].textContent, 'Product #99')
  })

  it('choosing a product writes it to the address and remembers it; choosing All products writes "all" and remembers nothing new', async () => {
    const { router, mainProduct, setSelect, listCalls, k } = await setup()
    await setSelect(mainProduct(), 'g2g')
    assert.equal(router.lastSearch(), 'product=g2g')
    assert.equal(k.w.localStorage.getItem('g2g_product_1'), 'g2g')
    assert.equal(listCalls.at(-1)?.product, 'g2g')

    await setSelect(mainProduct(), 'all')
    assert.equal(router.lastSearch(), 'product=all')
    assert.equal(k.w.localStorage.getItem('g2g_product_1'), 'g2g', '"all" is not remembered: a bare /signals still opens on a product')
    assert.equal(listCalls.at(-1)?.product, 'all')
  })
})

describe('Company Opportunities: the filters live in the address', () => {
  afterEach(disposeAll)

  it('a chosen filter is written to the address under the Signal Review\'s names and asked of the server', async () => {
    const { router, listCalls, choose, facet } = await setup({ search: 'product=all' })
    await choose('Freshness', 'last_30_days')
    assert.equal(router.lastSearch(), 'product=all&freshness=last_30_days')
    assert.equal(listCalls.at(-1)?.freshness, 'last_30_days')
    assert.equal(facet('Freshness').value, 'last_30_days')

    await choose('Status', 'contacted')
    assert.equal(listCalls.at(-1)?.reviewStatus, 'Follow-up')
    await choose('Fit', 'g2g')
    assert.equal(listCalls.at(-1)?.businessFit, 'g2g')
    await choose('Sort', 'recent')
    assert.equal(listCalls.at(-1)?.sort, 'recent')
    assert.equal(router.lastSearch(), 'sort=recent&product=all&status=contacted&freshness=last_30_days&fit=g2g')
  })

  it('survives a re-render from the address: the boxes and the request come from the link', async () => {
    const link = 'product=all&status=dismissed&freshness=undated&fit=eb&sort=priority&per=20&page=2&q=fee'
    const first = await setup({ search: link })
    assert.equal(first.facet('Status').value, 'dismissed')
    assert.equal(first.facet('Freshness').value, 'undated')
    assert.equal(first.facet('Fit').value, 'eb')
    assert.equal(first.facet('Sort').value, 'priority')
    assert.equal(first.facet('Page size').value, '20')
    assert.deepEqual(
      { ...first.listCalls[0], regions: undefined },
      { product: 'all', reviewStatus: 'Dismissed', freshness: 'undated', businessFit: 'eb', sort: 'priority', perPage: 20, page: 2, search: 'fee', expired: 'include', allSignals: true, source: 'all', regions: undefined, offerId: undefined, customerModel: undefined, productMasterId: undefined, runDate: undefined, from: undefined, to: undefined, runId: undefined },
    )
    assert.equal((first.k.one('input[aria-label="Search signals"]') as HTMLInputElement).value, 'fee')
    assert.equal(first.listCalls.length, 1, 'opening on page two does not send the list back to page one')
    await disposeAll()

    // The same address, a new render: the same view.
    const second = await setup({ search: link })
    assert.equal(second.facet('Status').value, 'dismissed')
    assert.equal(second.listCalls[0].page, 2)
    assert.equal(second.listCalls[0].reviewStatus, 'Dismissed')
  })

  it('an old Signal Review link opens the same view here', async () => {
    const { facet, listCalls, mainProduct } = await setup({ search: 'product=5&status=new&freshness=last_90_days&fit=scholar&sort=recent&q=tender' })
    assert.equal(mainProduct().value, '5')
    assert.equal(facet('Status').value, 'new')
    assert.equal(listCalls.at(-1)?.productMasterId, 5)
    assert.equal(listCalls.at(-1)?.reviewStatus, 'New')
    assert.equal(listCalls.at(-1)?.freshness, 'last_90_days')
    assert.equal(listCalls.at(-1)?.businessFit, 'scholar')
    assert.equal(listCalls.at(-1)?.sort, 'recent')
    assert.equal(listCalls.at(-1)?.search, 'tender')
  })

  it('changing a filter goes back to page one', async () => {
    const { router, listCalls, choose } = await setup({ search: 'product=all&page=3' })
    assert.equal(listCalls[0].page, 3)
    await choose('Status', 'reviewed')
    assert.equal(router.lastSearch(), 'product=all&status=reviewed')
    assert.equal(listCalls.at(-1)?.page, 1)
  })

  it('the page size is 5, 20 or 50, kept in the address as per', async () => {
    const { router, listCalls, choose, facet } = await setup({ search: 'product=all&page=2' })
    assert.deepEqual(Array.from(facet('Page size').options).map((o) => o.textContent), ['5 per page', '20 per page', '50 per page'])
    await choose('Page size', '20')
    assert.equal(router.lastSearch(), 'product=all&per=20')
    assert.equal(listCalls.at(-1)?.perPage, 20)
    assert.equal(listCalls.at(-1)?.page, 1)
    await choose('Page size', '50')
    assert.equal(listCalls.at(-1)?.perPage, 50)
    await choose('Page size', '5')
    assert.equal(router.lastSearch(), 'product=all', 'five is the default and leaves no mark')
  })

  it('a page past the end (a stale link) goes to the last page instead of showing an empty list', async () => {
    const { router, listCalls, k } = await setup({
      search: 'product=all&page=9',
      list: async (q) => (q.page === 9
        ? opportunityList([], { meta: { page: 9, per_page: 5, total: 12, last_page: 3 } })
        : opportunityList(opportunities(), { meta: { page: q.page ?? 1, per_page: 5, total: 12, last_page: 3 } })),
    })
    assert.deepEqual(listCalls.map((q) => q.page), [9, 3])
    assert.equal(router.lastSearch(), 'page=3&product=all')
    assert.equal(k.all('article').length, 3)
    assert.ok(k.bodyText().includes('Page 3 of 3'))
  })

  it('pages with Previous and Next, in the address', async () => {
    const { k, router, listCalls } = await setup({ search: 'product=all', list: async () => opportunityList(opportunities(), { meta: { page: 1, per_page: 5, total: 12, last_page: 3 } }) })
    assert.ok(k.bodyText().includes('1–5 of 12'))
    assert.ok(k.bodyText().includes('Page 1 of 3'))
    await k.click(k.withText('Next')!)
    await k.tick(20)
    assert.equal(router.lastSearch(), 'page=2&product=all')
    assert.equal(listCalls.at(-1)?.page, 2)
  })
})

describe('Company Opportunities: the counts', () => {
  afterEach(disposeAll)

  it('shows the server\'s counts, not a count of the rows on the page', async () => {
    // Three rows on the page, but the server says 73 signals match: the tiles must say 73.
    const { k } = await setup({ search: 'product=all' })
    const tiles = k.one('[aria-label="Summary"]')!.textContent!
    for (const part of ['73', 'signals in total', '68', 'need a decision', '5', 'decided so far', '12', 'high priority']) assert.ok(tiles.includes(part), part)
    assert.equal(k.all('article').length, 3)
    assert.ok(!tiles.includes('Generated') && !tiles.includes('Manually Added') && !tiles.includes('New Today'), 'the old counts, worked out from the visible rows, are gone')
  })

  it('moves the counts with a decision, without loading the list again', async () => {
    const { k, listCalls, cardOf, inCard } = await setup({ search: 'product=all' })
    await k.click(inCard(cardOf('District office'), 'Contacted'))
    await k.tick(10)
    await k.click(k.withText('Mark contacted')!)
    await k.tick(20)
    const tiles = k.one('[aria-label="Summary"]')!.textContent!
    assert.ok(tiles.includes('67'), 'need a decision went from 68 to 67')
    assert.ok(cardOf('District office').textContent!.includes('Contacted'), 'the card changed')
    assert.equal(listCalls.length, 1, 'the list was not loaded again')
  })
})

describe('Company Opportunities: deciding on a signal', () => {
  afterEach(disposeAll)

  it('replaces the three lenient buttons with the Signal Review\'s decisions for the card\'s status', async () => {
    const { k, cardOf } = await setup({ search: 'product=all' })
    const labels = (title: string) => Array.from(cardOf(title).querySelectorAll('[role="group"][aria-label="Decide on this signal"] button')).map((b) => b.textContent)
    assert.deepEqual(labels('District office'), ['Contacted', 'Reviewed', 'Not relevant…'])
    assert.deepEqual(labels('Principal posts'), ['Reviewed', 'Not relevant…'], 'already contacted')
    assert.deepEqual(labels('Board announces'), ['Reopen…'], 'dismissed: the way back')
    assert.ok(!k.bodyText().includes('Mark reviewed') && !k.bodyText().includes('Promote to CRM Lead'))
  })

  it('sends the status the person was looking at (expected_status) with the decision', async () => {
    const { k, decideCalls, cardOf, inCard } = await setup({ search: 'product=all' })
    await k.click(inCard(cardOf('District office'), 'Contacted'))
    await k.tick(10)
    assert.ok(k.all('[role="dialog"]').some((d) => d.textContent?.includes('Now: Needs decision')))
    await k.click(k.withText('Mark contacted')!)
    await k.tick(20)
    assert.deepEqual(decideCalls, [{ id: 1, body: { decision: 'follow_up', expected_status: 'New' } }])
  })

  it('"Not relevant" needs a reason from the server\'s list, and sends it', async () => {
    const { k, decideCalls, cardOf, inCard, setSelect } = await setup({ search: 'product=all' })
    await k.click(inCard(cardOf('District office'), 'Not relevant…'))
    await k.tick(10)
    await k.click(k.withText('Mark not relevant')!)
    await k.tick(10)
    assert.deepEqual(decideCalls, [], 'blocked in the dialog: nothing was sent')
    assert.ok(k.bodyText().includes('Choose a reason to continue.'))
    await setSelect(k.one('[role="dialog"] select') as HTMLSelectElement, 'wrong_product')
    await k.click(k.withText('Mark not relevant')!)
    await k.tick(20)
    assert.deepEqual(decideCalls, [{ id: 1, body: { decision: 'dismissed', reason_code: 'wrong_product', expected_status: 'New' } }])
  })

  it('says someone decided first when the server answers 409, and does not overwrite their decision', async () => {
    const { k, decideCalls, cardOf, inCard } = await setup({
      search: 'product=all',
      decide: async () => { throw new DecisionConflictError({ status: 0, code: 'conflict', message: 'Someone decided first.', current: CONFLICT }) },
    })
    await k.click(inCard(cardOf('District office'), 'Contacted'))
    await k.tick(10)
    await k.click(k.withText('Mark contacted')!)
    await k.tick(20)
    assert.equal(decideCalls.length, 1)
    const dialog = k.all('[role="dialog"]').find((d) => d.textContent?.includes('Someone decided first'))!
    assert.ok(dialog, 'the 409 text is shown')
    assert.ok(dialog.textContent!.includes('Anil Shah already decided on this signal'))
    assert.ok(dialog.textContent!.includes('Looked at it.'))
    assert.ok(cardOf('District office').textContent!.includes('Reviewed'), 'the card shows the status that got there first')
    await k.click(k.withText('Continue anyway')!)
    await k.tick(20)
    assert.deepEqual(decideCalls[1], { id: 1, body: { decision: 'follow_up', expected_status: 'Reviewed' } }, 'continuing is against the status the person has now seen')
  })

  it('tells a person who may view but not decide so (403), and turns the buttons off', async () => {
    const { k, cardOf, inCard } = await setup({
      search: 'product=all',
      decide: async () => { const { ApiError } = await import('../../services/core'); throw new ApiError('Forbidden', 403) },
    })
    await k.click(inCard(cardOf('District office'), 'Contacted'))
    await k.tick(10)
    await k.click(k.withText('Mark contacted')!)
    await k.tick(20)
    assert.ok(k.bodyText().includes('You can view signals but you are not allowed to decide on them.'))
    assert.equal((inCard(cardOf('District office'), 'Reviewed') as HTMLButtonElement).disabled, true)
  })

  it('keeps "Not relevant…" off, and says why, while the list of reasons has not loaded (the other decisions need no reason)', async () => {
    const { cardOf, inCard } = await setup({
      search: 'product=all',
      list: async () => opportunityList(opportunities(), { filters: { ...opportunityList().filters, review_reasons: [] } }),
    })
    const card = cardOf('District office')
    assert.equal((inCard(card, 'Not relevant…') as HTMLButtonElement).disabled, true, 'a dismissal needs a reason, and there is none to choose')
    assert.equal((inCard(card, 'Reviewed') as HTMLButtonElement).disabled, false)
    assert.equal((inCard(card, 'Contacted') as HTMLButtonElement).disabled, false)
    assert.ok(card.textContent?.includes('which has not loaded'), 'and the card says why')
  })

  it('Reopen puts a not-relevant signal back, and the counts follow', async () => {
    const { k, decideCalls, cardOf, inCard } = await setup({
      search: 'product=all',
      decide: async (id) => ({ status: 1, data: { ...opportunity({ id }), review_status: 'New' } as never, review: historyEntry({ id: 98, decision: 'reopened', from_status: 'Dismissed', to_status: 'New' }) }),
    })
    await k.click(inCard(cardOf('Board announces'), 'Reopen…'))
    await k.tick(10)
    await k.click(k.withText('Reopen')!)
    await k.tick(20)
    assert.deepEqual(decideCalls, [{ id: 3, body: { decision: 'reopened', expected_status: 'Dismissed' } }])
    assert.ok(k.one('[aria-label="Summary"]')!.textContent!.includes('69'), 'need a decision went from 68 to 69')
  })
})

describe('Company Opportunities: history, fit and score', () => {
  afterEach(disposeAll)

  /** Opens a card's "Evidence and details" the way a browser does: the open attribute changes and the details report a toggle. */
  async function openDetails(k: Awaited<ReturnType<typeof kit>>, card: HTMLElement) {
    const details = card.querySelector('details') as HTMLDetailsElement
    await k.act(async () => { details.open = true; details.dispatchEvent(new k.w.Event('toggle')) })
    await k.tick(20)
  }

  it('reads a card\'s decision history only when its details are opened, and shows it', async () => {
    const { k, historyCalls, cardOf } = await setup({ search: 'product=all' })
    assert.deepEqual(historyCalls, [], 'three cards on the page, no history asked for')
    assert.ok(!cardOf('District office').textContent!.includes('Decision history'))

    await openDetails(k, cardOf('District office'))
    assert.deepEqual(historyCalls, [1])
    const text = cardOf('District office').textContent!
    assert.ok(text.includes('Decision history'))
    assert.ok(text.includes('Called the office.'))
    assert.ok(text.includes('Anil'))

    await openDetails(k, cardOf('District office'))
    assert.deepEqual(historyCalls, [1], 'opening it again does not ask again')
  })

  it('shows the source\'s own wording, its link and how the date was found: what a decision rests on', async () => {
    const { k, cardOf } = await setup({ search: 'product=all' })
    const text = cardOf('District office').textContent!
    assert.ok(text.includes('The source\'s wording and date'))
    assert.ok(text.includes('“invites sealed bids for the supply and rollout of a school management system across 14 schools”'), 'the wording copied from the source')
    assert.ok(text.includes('The source states the date the event happens or happened.'))
    assert.ok(text.includes('Event 12 Oct 2026'), 'the kind of date, as a badge')
    const link = Array.from(cardOf('District office').querySelectorAll('a')).find((a) => a.getAttribute('href') === 'https://district-notices.example/tenders/42' && a.textContent?.includes('opens in a new tab'))
    assert.ok(link, 'the source opens in a new tab')
    assert.equal(link!.getAttribute('rel'), 'noopener noreferrer')
    assert.ok(cardOf('Board announces').textContent!.includes('Date unknown'), 'a signal with no date says so')
    assert.ok(k.all('article').length === 3)
  })

  it('shows Fit & score from the signal\'s own fields', async () => {
    const { k, cardOf } = await setup({ search: 'product=all' })
    const text = cardOf('District office').textContent!
    assert.ok(text.includes('Fit & score'))
    assert.ok(text.includes('Fit with the product'))
    assert.ok(text.includes('71'), 'the fit total')
    assert.ok(text.includes('band: High'))
    assert.ok(text.includes('Asks for a school management system'), 'the reason the server gave for the part')
    assert.ok(text.includes('24'), 'the total score')
    assert.ok(text.includes('Problem fit'))
    assert.ok(k.all('article').length >= 2)
  })

  it('gives every card its own heading ids, so fifty cards on a page have no duplicate id', async () => {
    const { k } = await setup({ search: 'product=all' })
    const ids = k.all('article [id]').map((el) => el.id)
    assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`)
  })

  it('adds a decision to the history on screen without asking for it again', async () => {
    const { k, historyCalls, cardOf, inCard } = await setup({ search: 'product=all' })
    await openDetails(k, cardOf('District office'))
    await k.click(inCard(cardOf('District office'), 'Contacted'))
    await k.tick(10)
    await k.click(k.withText('Mark contacted')!)
    await k.tick(20)
    assert.deepEqual(historyCalls, [1])
    const text = cardOf('District office').textContent!
    assert.ok(text.includes('Called the office.') && text.includes('Marked as contacted.'))
  })
})

describe('Company Opportunities: turning a signal into a lead', () => {
  afterEach(disposeAll)

  it('asks first, and makes the lead only once the person confirms', async () => {
    const { k, promoteCalls, cardOf, inCard } = await setup({ search: 'product=all' })
    await k.click(inCard(cardOf('District office'), 'Turn into a lead'))
    await k.tick(10)
    assert.deepEqual(promoteCalls, [], 'the question is open; nothing was sent')
    const dialog = k.all('[role="alertdialog"], [role="dialog"]').find((d) => d.textContent?.includes('Turn this signal into a lead?'))
    assert.ok(dialog, 'the confirmation is shown')

    await k.click(k.withText('Create lead')!)
    await k.tick(20)
    assert.deepEqual(promoteCalls, [1])
    const text = cardOf('District office').textContent!
    assert.ok(text.includes('Lead created'))
    assert.equal(k.all('a').find((a) => a.getAttribute('href') === '/module/crm/marketing/leads/501')?.textContent, 'Open lead')
    assert.equal(inCard(cardOf('District office'), 'Turn into a lead'), undefined, 'the button is gone: a second lead cannot be made from here')
    assert.ok(text.includes('Lead created in CRM.'))
  })

  it('a cancelled question makes nothing', async () => {
    const { k, promoteCalls, cardOf, inCard } = await setup({ search: 'product=all' })
    await k.click(inCard(cardOf('District office'), 'Turn into a lead'))
    await k.tick(10)
    await k.click(k.withText('Cancel')!)
    await k.tick(20)
    assert.deepEqual(promoteCalls, [])
    assert.ok(inCard(cardOf('District office'), 'Turn into a lead'), 'the button is still offered')
  })

  it('a double click makes one question and one request', async () => {
    const { k, promoteCalls, cardOf, inCard } = await setup({ search: 'product=all' })
    const button = inCard(cardOf('District office'), 'Turn into a lead')
    await k.act(async () => {
      button.dispatchEvent(new k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
      button.dispatchEvent(new k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await k.tick(10)
    assert.equal(k.all('[role="alertdialog"], [role="dialog"]').filter((d) => d.textContent?.includes('Turn this signal into a lead?')).length, 1, 'one question')
    await k.click(k.withText('Create lead')!)
    await k.tick(20)
    assert.deepEqual(promoteCalls, [1], 'one request')
  })

  it('says a signal that already has a lead is not given a second, and links to the lead it has', async () => {
    const { k, cardOf, inCard } = await setup({ search: 'product=all', list: async () => opportunityList([opportunity({ id: 1, promoted_lead_id: '77', promoted_lead_no: 'LD-00077', promoted_lead_status: 'New' })]) })
    assert.equal(inCard(cardOf('District office'), 'Turn into a lead'), undefined)
    assert.equal(k.all('a').find((a) => a.getAttribute('href') === '/module/crm/marketing/leads/77')?.textContent, 'Open lead LD-00077')
  })

  it('tells a person who may not create leads (403) in the words of the Signal Review', async () => {
    const { k, cardOf, inCard } = await setup({ search: 'product=all', promote: async () => { const { ApiError } = await import('../../services/core'); throw new ApiError('Forbidden', 403) } })
    await k.click(inCard(cardOf('District office'), 'Turn into a lead'))
    await k.tick(10)
    await k.click(k.withText('Create lead')!)
    await k.tick(20)
    assert.ok(k.bodyText().includes('You are not allowed to create leads from signals.'))
  })
})

// ── What the Signal Review's drawer and list tests pinned and the cards did not (P1-C, 13 Nov 2026) ───────────────────────────────────────
// The Review screen was removed; its decisions, lead action and list all live on these cards now. The groups below carry the behaviours that only the
// Review's own tests proved, on the screen that stays. Every `assert.ok` has a message: a failing one without it can hang a long file (found on 13 Nov).

type Screen = Awaited<ReturnType<typeof setup>>
type K = Screen['k']

const LEAD_HREF = '/module/crm/marketing/leads/501'
const leadAnswer = (over: Partial<SignalPromoteResponse['data']> = {}): SignalPromoteResponse => ({ status: 1, data: { lead_id: '501', created: true, ...over } })
const statusTexts = (k: K) => k.all('[role="status"]').map((el) => el.textContent ?? '')
const alertTexts = (k: K) => k.all('[role="alert"]').map((el) => el.textContent ?? '')
const decisionButtons = (card: HTMLElement) => Array.from(card.querySelectorAll('[role="group"][aria-label="Decide on this signal"] button')) as HTMLButtonElement[]
const leadLink = (k: K) => k.all('a').find((a) => a.getAttribute('href') === LEAD_HREF)
const askedForLead = (k: K) => k.all('[role="alertdialog"], [role="dialog"]').filter((d) => d.textContent?.includes('Turn this signal into a lead?')).length

/** Presses a button of a card. A missing button fails on the spot: clicking nothing inside act() would hang the test instead. */
async function pressIn(s: Screen, title: string, label: string) {
  const button = s.inCard(s.cardOf(title), label)
  assert.ok(button, `the "${title}" card has a "${label}" button`)
  await s.k.click(button)
  await s.k.tick(10)
}

/** Presses a button of the open dialog (or anywhere on the page), with the same guard. */
async function pressText(k: K, label: string) {
  const button = k.withText(label)
  assert.ok(button, `there is a "${label}" button`)
  await k.click(button)
  await k.tick(20)
}

/** Opens a card's "Evidence and details" the way a browser does: the open attribute changes and the details report a toggle. */
async function openCardDetails(k: K, card: HTMLElement) {
  const details = card.querySelector('details') as HTMLDetailsElement | null
  assert.ok(details, 'the card has details to open')
  await k.act(async () => { details.open = true; details.dispatchEvent(new k.w.Event('toggle')) })
  await k.tick(20)
}

/** "Turn into a lead" on a card, then "Create lead" in the question. */
async function turnIntoLead(s: Screen, title = 'District office') {
  await pressIn(s, title, 'Turn into a lead')
  await pressText(s.k, 'Create lead')
}

describe('Company Opportunities: turning a signal into a lead, in every way it can end', () => {
  afterEach(disposeAll)

  it('makes the lead once, puts it on the card as a status (not an alert), and does not decide on the signal', async () => {
    const s = await setup({ search: 'product=all' })
    await turnIntoLead(s)
    assert.deepEqual(s.promoteCalls, [1])
    assert.deepEqual(statusTexts(s.k).filter((text) => text.includes('Lead created in CRM')), ['Lead created in CRM. It is recorded in this signal’s history.'])
    assert.deepEqual(alertTexts(s.k), [], 'a lead that was made is not an alert')
    const card = s.cardOf('District office')
    assert.equal(leadLink(s.k)?.textContent, 'Open lead', 'the card links to the lead')
    assert.equal(s.inCard(card, 'Turn into a lead'), undefined, 'and the button that made it is gone')
    assert.ok(card.textContent!.includes('Needs decision'), 'turning a signal into a lead does not decide on it')
    assert.deepEqual(decisionButtons(card).map((b) => b.textContent), ['Contacted', 'Reviewed', 'Not relevant…'], 'every decision is still offered')
  })

  it('reads the history again, with the lead in it, only if the card\'s details were opened', async () => {
    let reads = 0
    const promoted = historyEntry({ id: 7, decision: 'promoted', via: 'promote', note: 'Lead #501 created', from_status: 'Follow-up', to_status: 'Follow-up' })
    const s = await setup({
      search: 'product=all',
      history: async () => { reads += 1; return { status: 1, data: reads === 1 ? [historyEntry({ id: 1, note: 'Called the office.' })] : [promoted, historyEntry({ id: 1, note: 'Called the office.' })] } },
    })
    await turnIntoLead(s, 'District office')
    assert.deepEqual(s.historyCalls, [], 'nobody opened this card\'s details, so making a lead reads no history')

    await openCardDetails(s.k, s.cardOf('Principal posts'))
    assert.deepEqual(s.historyCalls, [2], 'opening the details of another card reads its history once')
    await turnIntoLead(s, 'Principal posts')
    assert.deepEqual(s.historyCalls, [2, 2], 'the server wrote a history line for the lead, so the open history is read again')
    assert.ok(s.cardOf('Principal posts').textContent!.includes('Lead #501 created'), 'and it shows the line the lead wrote')
  })

  it('says it is working while the request runs: the button and the decisions wait, and a second press adds nothing', async () => {
    let finish!: (value: SignalPromoteResponse) => void
    const s = await setup({ search: 'product=all', promote: () => new Promise((resolve) => { finish = resolve }) })
    await turnIntoLead(s)
    const working = s.inCard(s.cardOf('District office'), 'Creating lead…') as HTMLButtonElement | undefined
    assert.ok(working, 'the button says it is working')
    assert.equal(working.disabled, true, 'and it is off')
    assert.ok(decisionButtons(s.cardOf('District office')).every((b) => b.disabled), 'the decisions wait too')

    await s.k.click(working)
    await s.k.tick(10)
    assert.equal(askedForLead(s.k), 0, 'a press on the working button asks no second question')
    assert.deepEqual(s.promoteCalls, [1], 'one request, however many presses')

    await s.k.act(async () => { finish(leadAnswer()) })
    await s.k.tick(20)
    assert.equal(s.inCard(s.cardOf('District office'), 'Turn into a lead'), undefined, 'the lead is made and the button is gone')
    assert.ok(decisionButtons(s.cardOf('District office')).every((b) => !b.disabled), 'the decisions are free again')
    assert.deepEqual(s.promoteCalls, [1], 'still one request')
  })

  it('treats a lead that was already there as the same lead: a status, no alert, no second history read', async () => {
    const s = await setup({ search: 'product=all', promote: async () => leadAnswer({ created: false }) })
    await openCardDetails(s.k, s.cardOf('District office'))
    assert.deepEqual(s.historyCalls, [1])
    await turnIntoLead(s)
    assert.deepEqual(statusTexts(s.k).filter((text) => text.includes('already has a lead')), ['This signal already has a lead, so no second one was made.'])
    assert.deepEqual(alertTexts(s.k), [], 'it is not an error')
    assert.equal(leadLink(s.k)?.textContent, 'Open lead', 'the card links to the lead it has')
    assert.deepEqual(s.historyCalls, [1], 'the server wrote nothing, so the history is not read again')
  })

  it('a 403 says leads (not decisions), stops offering the button and leaves the decisions alone', async () => {
    const { ApiError } = await import('../../services/core')
    const s = await setup({ search: 'product=all', promote: async () => { throw new ApiError('Forbidden', 403) } })
    await turnIntoLead(s)
    assert.deepEqual(alertTexts(s.k), [LEAD_FORBIDDEN_TEXT])
    assert.equal(LEAD_FORBIDDEN_TEXT, 'You are not allowed to create leads from signals.')
    assert.ok(!s.k.bodyText().includes(FORBIDDEN_TEXT), 'the words about decisions are not used for leads')
    const card = s.cardOf('District office')
    const button = s.inCard(card, 'Turn into a lead') as HTMLButtonElement | undefined
    assert.ok(button, 'the button is still drawn')
    assert.equal(button.disabled, true, 'but it is off')
    assert.ok(decisionButtons(card).every((b) => !b.disabled), 'the 403 was about leads, so the decisions are untouched')
    await s.k.click(button)
    await s.k.tick(10)
    assert.equal(askedForLead(s.k), 0, 'a press on it asks nothing')
    assert.deepEqual(s.promoteCalls, [1])
  })

  it('a network failure is said plainly, the button stays, and the same press can be tried again', async () => {
    let attempts = 0
    const s = await setup({ search: 'product=all', promote: async () => { attempts += 1; if (attempts === 1) throw new TypeError('Failed to fetch'); return leadAnswer() } })
    await turnIntoLead(s)
    assert.deepEqual(alertTexts(s.k), [NETWORK_TEXT])
    const again = s.inCard(s.cardOf('District office'), 'Turn into a lead') as HTMLButtonElement | undefined
    assert.ok(again, 'the button stays')
    assert.equal(again.disabled, false, 'so a retry is possible')
    assert.equal(leadLink(s.k), undefined, 'no lead was made')

    await turnIntoLead(s)
    assert.deepEqual(s.promoteCalls, [1, 1])
    assert.deepEqual(alertTexts(s.k), [], 'the old message goes when the retry starts')
    assert.equal(leadLink(s.k)?.textContent, 'Open lead', 'and the retry made the lead')
  })

  it('a 404 says the signal can no longer be found, and makes nothing', async () => {
    const { ApiError } = await import('../../services/core')
    const s = await setup({ search: 'product=all', promote: async () => { throw new ApiError('Opportunity not found', 404) } })
    await turnIntoLead(s)
    assert.deepEqual(alertTexts(s.k), [NOT_FOUND_TEXT])
    assert.equal(leadLink(s.k), undefined, 'no lead')
    assert.ok(s.inCard(s.cardOf('District office'), 'Turn into a lead'), 'the button is still there')
  })

  it('an answer that names no lead does not pretend one was made', async () => {
    const s = await setup({ search: 'product=all', promote: async () => ({ status: 1, data: {} } as unknown as SignalPromoteResponse) })
    await openCardDetails(s.k, s.cardOf('District office'))
    await turnIntoLead(s)
    assert.deepEqual(alertTexts(s.k), [NO_LEAD_ID_TEXT])
    assert.equal(leadLink(s.k), undefined, 'no link to a lead that may not exist')
    assert.ok(s.inCard(s.cardOf('District office'), 'Turn into a lead'), 'the button is still there')
    assert.deepEqual(s.historyCalls, [1], 'and the history was not read again')
  })

  it('links to the lead with its number and status when the server gave them, and with just "Open lead" when it gave none', async () => {
    const s = await setup({
      search: 'product=all',
      list: async () => opportunityList([
        opportunity({ id: 1, promoted_lead_id: '501', promoted_lead_no: 'LD-00012', promoted_lead_status: 'New' }),
        opportunity({ id: 2, title: 'Principal posts for a data-entry coordinator', promoted_lead_id: '502' }),
      ]),
    })
    const [first, second] = [s.cardOf('District office'), s.cardOf('Principal posts')]
    const linkIn = (card: HTMLElement) => Array.from(card.querySelectorAll('a')).find((a) => (a.getAttribute('href') ?? '').startsWith('/module/crm/marketing/leads/'))
    assert.equal(linkIn(first)?.textContent, 'Open lead LD-00012')
    assert.equal(linkIn(first)?.getAttribute('href'), '/module/crm/marketing/leads/501')
    assert.ok(first.textContent!.includes('status: New'), 'the lead\'s status is shown when the server named it')
    assert.equal(linkIn(second)?.textContent, 'Open lead', 'no number from the server: no number invented')
    assert.equal(linkIn(second)?.getAttribute('href'), '/module/crm/marketing/leads/502')
    assert.ok(!second.textContent!.includes('status:'), 'and no status')
    assert.equal(s.inCard(first, 'Turn into a lead'), undefined)
    assert.equal(s.inCard(second, 'Turn into a lead'), undefined)
  })
})

describe('Company Opportunities: deciding on a signal, in every way it can end', () => {
  afterEach(disposeAll)

  it('a 422 puts each server message under its field and keeps the dialog open', async () => {
    const error = Object.assign(new Error('Validation failed'), { status: 422, errors: { reason_code: ['That reason is not on the list.'], note: ['The note is too long.'] } })
    const s = await setup({ search: 'product=all', decide: async () => { throw error } })
    await pressIn(s, 'District office', 'Not relevant…')
    await s.setSelect(s.k.one('[role="dialog"] select') as HTMLSelectElement, 'wrong_product')
    await pressText(s.k, 'Mark not relevant')
    assert.equal(s.decideCalls.length, 1)
    const dialog = s.k.all('[role="dialog"]').find((d) => d.textContent?.includes('Now: Needs decision'))
    assert.ok(dialog, 'the dialog is still open')
    assert.ok(dialog.textContent!.includes('That reason is not on the list.'), 'the reason\'s message is shown')
    assert.ok(dialog.textContent!.includes('The note is too long.'), 'the note\'s message is shown')
    assert.ok(s.cardOf('District office').textContent!.includes('Needs decision'), 'the card did not change')
  })

  it('while saving, the dialog says Saving…, the card\'s buttons wait, and a second submit in the same instant sends nothing', async () => {
    let finish!: (value: SignalDecisionResponse) => void
    const s = await setup({ search: 'product=all', decide: () => new Promise((resolve) => { finish = resolve }) })
    await pressIn(s, 'District office', 'Contacted')
    const submit = s.k.withText('Mark contacted') as HTMLButtonElement | null
    assert.ok(submit, 'the dialog has its Mark contacted button')
    await s.k.act(async () => {
      submit.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
      submit.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await s.k.tick(10)
    assert.equal(s.decideCalls.length, 1, 'the second submit, before the screen caught up, was ignored')
    const saving = s.k.withText('Saving…') as HTMLButtonElement | null
    assert.ok(saving, 'the dialog says it is saving')
    assert.equal(saving.disabled, true, 'and cannot be pressed again')
    assert.ok(decisionButtons(s.cardOf('District office')).every((b) => b.disabled), 'the card\'s buttons wait')

    await s.k.act(async () => { finish({ status: 1, data: { ...opportunity({ id: 1 }), review_status: 'Follow-up' } as never, review: historyEntry({ id: 99 }) }) })
    await s.k.tick(20)
    assert.ok(s.cardOf('District office').textContent!.includes('Contacted'), 'the card shows the new status')
    assert.equal(s.k.all('[role="dialog"]').some((d) => d.textContent?.includes('Now: Needs decision')), false, 'the dialog closed')
    assert.ok(decisionButtons(s.cardOf('District office')).every((b) => !b.disabled), 'and the buttons are free again')
    assert.equal(s.decideCalls.length, 1, 'still one request')
  })

  it('Cancel on "someone decided first" closes the dialog, sends nothing more and keeps the status that got there first', async () => {
    const s = await setup({
      search: 'product=all',
      decide: async () => { throw new DecisionConflictError({ status: 0, code: 'conflict', message: 'Someone decided first.', current: CONFLICT }) },
    })
    await pressIn(s, 'District office', 'Contacted')
    await pressText(s.k, 'Mark contacted')
    assert.ok(s.k.all('[role="dialog"]').some((d) => d.textContent?.includes('Someone decided first')), 'the question is shown')
    await pressText(s.k, 'Cancel')
    assert.equal(s.decideCalls.length, 1, 'nothing more was sent')
    assert.equal(s.k.all('[role="dialog"]').some((d) => d.textContent?.includes('Someone decided first')), false, 'the dialog is gone')
    assert.ok(s.cardOf('District office').textContent!.includes('Reviewed'), 'the card keeps the status that got there first')
  })

  it('a 409 "unchanged" says the server\'s sentence on the form and reads the signal again', async () => {
    const s = await setup({
      search: 'product=all',
      decide: async () => { throw new DecisionConflictError({ status: 0, code: 'unchanged', message: 'It is already contacted.', current: historyEntry() }) },
    })
    await pressIn(s, 'District office', 'Contacted')
    await pressText(s.k, 'Mark contacted')
    const dialog = s.k.all('[role="dialog"]').find((d) => d.textContent?.includes('Now: Needs decision') || d.textContent?.includes('It is already contacted.'))
    assert.ok(dialog, 'the dialog is open')
    assert.ok(dialog.textContent!.includes('It is already contacted.'), 'with the server\'s own sentence on the form')
    assert.equal(s.decideCalls.length, 1)
    assert.deepEqual(s.getCalls, [1], 'the signal was read again, because what the person saw was out of date')
    assert.ok(s.cardOf('District office').textContent!.includes('Reviewed'), 'and the card shows what the server says now')
  })

  it('a network failure is said on the form, and the same answer can be sent again', async () => {
    let attempts = 0
    const s = await setup({
      search: 'product=all',
      decide: async (id) => {
        attempts += 1
        if (attempts === 1) throw new TypeError('Failed to fetch')
        return { status: 1, data: { ...opportunity({ id }), review_status: 'Follow-up' } as never, review: historyEntry({ id: 99 }) }
      },
    })
    await pressIn(s, 'District office', 'Contacted')
    await pressText(s.k, 'Mark contacted')
    const open = () => s.k.all('[role="dialog"]').find((d) => d.textContent?.includes('Now: Needs decision'))
    assert.ok(open(), 'the dialog is still open')
    assert.ok(open()!.textContent!.includes(NETWORK_TEXT), 'and says the request did not reach the server')

    await pressText(s.k, 'Mark contacted')
    assert.equal(s.decideCalls.length, 2, 'the same answer was sent again')
    assert.equal(open(), undefined, 'and this time the dialog closed')
    assert.ok(s.cardOf('District office').textContent!.includes('Contacted'), 'the card shows the new status')
    assert.ok(s.cardOf('District office').textContent!.includes('Marked as contacted.'), 'and says so')
  })

  it('a history that could not be read says so, and Retry reads it again', async () => {
    let attempts = 0
    const s = await setup({
      search: 'product=all',
      history: async () => { attempts += 1; if (attempts === 1) throw new Error('History is down'); return { status: 1, data: [historyEntry({ id: 5, note: 'Called the office.' })] } },
    })
    await openCardDetails(s.k, s.cardOf('District office'))
    const card = () => s.cardOf('District office')
    assert.ok(card().textContent!.includes('The history could not be loaded.'), 'the card says the history failed')
    assert.ok(card().textContent!.includes('History is down'), 'with the reason')
    await pressIn(s, 'District office', 'Retry')
    assert.deepEqual(s.historyCalls, [1, 1], 'Retry read it again')
    assert.ok(card().textContent!.includes('Called the office.'), 'and the entries are shown')
    assert.ok(!card().textContent!.includes('could not be loaded'), 'the message is gone')
  })
})

describe('Company Opportunities: the list, as the Signal Review\'s list tests proved it', () => {
  afterEach(disposeAll)

  it('never shows the stored word Follow-up: the cards and the Status box say Contacted', async () => {
    const s = await setup({ search: 'product=all' })
    assert.ok(s.cardOf('Principal posts').textContent!.includes('Contacted'), 'the card whose stored status is Follow-up says Contacted')
    assert.ok(!s.k.bodyText().includes('Follow-up'), 'the stored word is nowhere on the screen')
    const options = Array.from(s.facet('Status').options).map((o) => o.textContent ?? '')
    assert.ok(options.includes('Contacted'), `the Status box offers Contacted: ${options.join(', ')}`)
    assert.ok(!options.some((text) => /Follow-up/.test(text)), 'and never Follow-up')
  })

  it('keeps the search and every filter on screen when nothing matches', async () => {
    const s = await setup({ search: 'product=all&freshness=older', list: async () => opportunityList([], { summary: { total: 73, new: 68, high_priority: 12, follow_up: 5 } }) })
    assert.ok(s.k.bodyText().includes('No signals match these filters'), 'the empty answer is said')
    for (const label of ['Status', 'Freshness', 'Fit', 'Sort', 'Page size']) assert.ok(s.facet(label), `the ${label} box is still on screen`)
    assert.ok(s.k.one('input[aria-label="Search signals"]'), 'and so is the search box')
    assert.equal(s.facet('Freshness').value, 'older', 'with the choice that found nothing, so it can be changed')
  })

  it('Previous is off on the first page and Next on the last', async () => {
    const pages = (q: { page?: number }) => opportunityList(opportunities(), { meta: { page: q.page ?? 1, per_page: 5, total: 12, last_page: 3 } })
    const first = await setup({ search: 'product=all', list: async (q) => pages(q) })
    assert.equal((first.k.withText('Previous') as HTMLButtonElement | null)?.disabled, true, 'no page before the first')
    assert.equal((first.k.withText('Next') as HTMLButtonElement | null)?.disabled, false, 'but there is a next one')
    await disposeAll()

    const last = await setup({ search: 'product=all&page=3', list: async (q) => pages(q) })
    assert.equal((last.k.withText('Next') as HTMLButtonElement | null)?.disabled, true, 'no page after the last')
    assert.equal((last.k.withText('Previous') as HTMLButtonElement | null)?.disabled, false, 'but there is a previous one')
  })
})

describe('Company Opportunities: accessibility (axe on the fake page: names, roles, labels, ids; colour contrast is checked in contrast.test.ts)', () => {
  afterEach(disposeAll)

  it('the list, its filters, its counts and its cards have no axe violation, with a card\'s details open', async () => {
    const { k, cardOf } = await setup({ search: 'product=all' })
    const details = cardOf('District office').querySelector('details') as HTMLDetailsElement
    await k.act(async () => { details.open = true; details.dispatchEvent(new k.w.Event('toggle')) })
    await k.tick(20)
    assert.deepEqual(await axeViolations(k.one('section[aria-label="All products signals"]')!), [])
  })

  it('the decision dialog and the lead question have no axe violation', async () => {
    const { k, cardOf, inCard } = await setup({ search: 'product=all' })
    await k.click(inCard(cardOf('District office'), 'Not relevant…'))
    await k.tick(10)
    const dialog = k.all('[role="dialog"]').find((d) => d.textContent?.includes('Now: Needs decision'))!
    assert.deepEqual(await axeViolations(dialog), [])
    await k.click(k.withText('Cancel')!)
    await k.tick(20)
    await k.click(inCard(cardOf('District office'), 'Turn into a lead'))
    await k.tick(10)
    const question = k.all('[role="alertdialog"], [role="dialog"]').find((d) => d.textContent?.includes('Turn this signal into a lead?'))!
    assert.deepEqual(await axeViolations(question), [])
  })
})

describe('Company Opportunities: states', () => {
  afterEach(disposeAll)

  it('says "No saved signals yet" for an organisation with none, and offers no Clear filters', async () => {
    const { k } = await setup({ search: 'product=all', list: async () => opportunityList([], { summary: { total: 0, new: 0, high_priority: 0, follow_up: 0 } }) })
    assert.ok(k.bodyText().includes('No saved signals yet'))
    assert.ok(!k.bodyText().includes('Clear filters'))
  })

  it('says "No signals match these filters" for a search that matched nothing, and Clear filters brings the list back', async () => {
    const { k, router, listCalls } = await setup({ search: 'q=zzz', list: async (q) => (q.search ? opportunityList([], { summary: { total: 0, new: 0, high_priority: 0, follow_up: 0 } }) : opportunityList()) })
    assert.ok(k.bodyText().includes('No signals match these filters'))
    await k.click(k.withText('Clear filters')!)
    await k.tick(20)
    assert.equal(router.lastSearch(), 'product=all', 'the search is gone and the product stays')
    assert.equal(listCalls.at(-1)?.search, undefined)
    assert.equal(k.all('article').length, 3)
  })

  it('shows a loading state, then an error with Try again that loads the list', async () => {
    let attempts = 0
    const { k, listCalls } = await setup({ search: 'product=all', list: async () => { attempts += 1; if (attempts === 1) throw new Error('The server is busy.'); return opportunityList() } })
    assert.ok(k.bodyText().includes('Could not load the signals'))
    assert.ok(k.bodyText().includes('The server is busy.'))
    assert.equal(k.all('article').length, 0)
    await k.click(k.withText('Retry')!)
    await k.tick(20)
    assert.equal(listCalls.length, 2)
    assert.equal(k.all('article').length, 3)
  })

  it('shows skeleton rows before the first answer', async () => {
    const { k } = await setup({ search: 'product=all', list: () => new Promise(() => undefined) })
    assert.ok(k.one('[aria-busy="true"]'))
    assert.equal(k.all('article').length, 0)
  })

  it('wraps its filters: nothing has a fixed width wider than a phone, and the controls can wrap', async () => {
    const { k } = await setup({ search: 'product=all' })
    const bar = k.one('input[aria-label="Search signals"]')!.closest('.flex-wrap') as HTMLElement
    assert.ok(bar, 'the search and the facets are in a wrapping row')
    assert.ok(bar.className.includes('flex-wrap'))
    for (const select of k.all('select').filter((s) => s.id.startsWith(':'))) {
      const facetBox = select.parentElement as HTMLElement
      assert.ok(/min-w-\[9rem\]/.test(facetBox.className), 'a facet asks for 9rem at most, so two fit side by side at 390px')
    }
  })
})
