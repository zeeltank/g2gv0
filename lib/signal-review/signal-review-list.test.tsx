import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import type { SignalReviewApi } from '../../services/signal-review/signal-review-service'
import type { SignalDecisionResponse, SignalListParams, SignalListResponse, SignalRow } from '../../services/signal-review/signal-types'
import type { DecisionRequest } from '../../services/signal-review/types'
import { historyEntry, listResponse, mockupRows, signalRow } from './signal-fixtures'
import { routerHarness } from './router-harness'

/** The Signal Review list and its drawer in a fake browser, with the address kept by a stand-in router and the server replaced by a fake. */
interface Setup {
  search?: string
  list?: (params: SignalListParams) => Promise<SignalListResponse>
  decide?: (id: number, body: DecisionRequest) => Promise<SignalDecisionResponse>
}

async function setup(options: Setup = {}) {
  const k = await kit()
  const router = await routerHarness(options.search ?? '')
  const { SignalReviewList } = await import('../../components/domain/crm/signal-review-list')

  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const listCalls: SignalListParams[] = []
  const decideCalls: Array<{ id: number; body: DecisionRequest }> = []
  const service: SignalReviewApi = {
    list: async (params) => { listCalls.push(params); return options.list ? options.list(params) : listResponse() },
    get: async (id) => ({ status: 1, data: mockupRows().find((r) => r.id === id) ?? signalRow({ id }) }),
    history: async () => ({ status: 1, data: [historyEntry()] }),
    decide: async (id, body) => {
      decideCalls.push({ id, body })
      if (options.decide) return options.decide(id, body)
      return { status: 1, data: { ...signalRow({ id }), review_status: 'Follow-up' }, review: historyEntry({ id: 99 }) }
    },
    productOptions: async () => ({ status: 1, data: [{ id: 4, key: 'scholar', name: 'Scholar', kind: 'product', parentId: null, label: 'Scholar' }, { id: 5, key: 'g2g', name: 'G2G', kind: 'product', parentId: null, label: 'G2G' }] }),
  }

  await k.render(router.wrap(k.h(SignalReviewList, { service, signalsHref: '/signals' })))
  await k.tick(10)

  const rowOf = (title: string) => k.all('tbody tr').find((tr) => tr.textContent?.includes(title)) ?? null
  const facet = (label: string) => k.all('select').find((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent === label) as HTMLSelectElement
  const choose = async (label: string, value: string) => {
    const select = facet(label)
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(select, value); select.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.tick(10)
  }

  return { k, router, service, listCalls, decideCalls, rowOf, facet, choose }
}

describe('SignalReviewList', () => {
  afterEach(disposeAll)

  it('shows each signal with its organisation, product, the KIND of date, fit and status', async () => {
    const { k, rowOf } = await setup()
    assert.equal(k.all('tbody tr').length, 5)

    const first = rowOf('District office invites bids')!.textContent!
    for (const part of ['Example School District', 'Scholar', 'Event 12 Oct 2026', 'Scholar · Score 24', 'Needs decision']) assert.ok(first.includes(part), part)

    assert.ok(rowOf('Principal posts')!.textContent!.includes('Published 3 Oct 2026'))
    assert.ok(rowOf('Board announces')!.textContent!.includes('Date unknown'))
    assert.ok(rowOf('Academy lists')!.textContent!.includes('No product'), 'a signal with no product says so')
    assert.ok(rowOf('Academy lists')!.textContent!.includes('Not relevant'))
  })

  it('shows the stored "Follow-up" as "Contacted" everywhere on the screen', async () => {
    const { k, rowOf } = await setup()
    assert.ok(rowOf('Rival vendor')!.textContent!.includes('Contacted'))
    assert.ok(!k.bodyText().includes('Follow-up'))
    const status = facet(k, 'Status')
    assert.ok(Array.from(status.options).some((o) => o.textContent === 'Contacted'))
    assert.ok(!Array.from(status.options).some((o) => /Follow-up/.test(o.textContent ?? '')))
  })

  it('shows the counts the server returned', async () => {
    const { k } = await setup()
    const tiles = k.one('[aria-label="Summary"]')!.textContent!
    for (const part of ['73', 'signals in total', '68', 'need a decision', 'decided so far', '12', 'high priority']) assert.ok(tiles.includes(part), part)
  })

  it('keeps signals with no date by default: nothing about freshness is sent, and the undated row is on screen', async () => {
    const { listCalls, rowOf } = await setup()
    assert.deepEqual(listCalls[0], { page: 1, per_page: 20, sort: 'recent', review_status: 'New' })
    assert.ok(!('freshness' in listCalls[0]))
    assert.ok(rowOf('Board announces')!.textContent!.includes('Date unknown'))
  })

  it('writes a chosen filter to the address and asks the server for it', async () => {
    const { router, listCalls, choose, facet } = await setup()
    await choose('Product', '4')
    assert.equal(router.lastSearch(), 'product=4')
    assert.equal(listCalls.at(-1)?.product_master_id, 4)
    assert.equal(facet('Product').value, '4', 'the box shows the choice that is now in the address')

    await choose('Freshness', 'last_30_days')
    assert.equal(router.lastSearch(), 'product=4&freshness=last_30_days')
    assert.equal(listCalls.at(-1)?.freshness, 'last_30_days')

    await choose('Status', 'contacted')
    assert.equal(listCalls.at(-1)?.review_status, 'Follow-up')

    await choose('Fit', 'g2g')
    assert.equal(listCalls.at(-1)?.business_fit, 'g2g')
    assert.equal(router.lastSearch(), 'product=4&status=contacted&freshness=last_30_days&fit=g2g')

    await choose('Sort', 'priority')
    assert.equal(listCalls.at(-1)?.sort, 'priority')
  })

  it('opens a pasted link on the same view: the boxes and the request come from the address', async () => {
    const { listCalls, facet } = await setup({ search: 'product=5&status=all&freshness=undated&fit=eb&sort=priority&q=fee' })
    assert.deepEqual(listCalls[0], { page: 1, per_page: 20, sort: 'priority', freshness: 'undated', business_fit: 'eb', search: 'fee', product_master_id: 5 })
    assert.equal(facet('Status').value, 'all')
    assert.equal(facet('Freshness').value, 'undated')
    assert.equal(facet('Fit').value, 'eb')
    assert.equal(facet('Sort').value, 'priority')
  })

  it('offers the fits the server accepts, named after the product when the server said which', async () => {
    const { facet } = await setup()
    assert.deepEqual(Array.from(facet('Fit').options).map((o) => o.textContent), ['Any fit', 'EB', 'Scholar', 'G2G', 'Several products'])
  })

  it('shows a loading state before the first answer', async () => {
    const { k } = await setup({ list: () => new Promise(() => undefined) })
    assert.ok(k.one('[role="status"]')!.textContent!.includes('Loading signals'))
    assert.equal(k.all('tbody tr').length, 0)
  })

  it('shows an error with Retry, and Retry loads the list', async () => {
    let attempts = 0
    const { k, listCalls } = await setup({ list: async () => { attempts += 1; if (attempts === 1) throw new Error('The server is busy.'); return listResponse() } })
    assert.ok(k.bodyText().includes('Signals could not be loaded'))
    assert.ok(k.bodyText().includes('The server is busy.'))
    assert.equal(k.all('tbody tr').length, 0)
    await k.click(k.withText('Retry')!)
    await k.tick(10)
    assert.equal(listCalls.length, 2)
    assert.equal(k.all('tbody tr').length, 5)
    assert.ok(!k.bodyText().includes('The server is busy.'))
  })

  it('says "No signals yet" for an organisation with none, and points to where runs are started', async () => {
    const { k } = await setup({ list: async () => listResponse([], { summary: { total: 0, new: 0, high_priority: 0, follow_up: 0 } }) })
    assert.ok(k.bodyText().includes('No signals yet'))
    assert.ok(!k.bodyText().includes('Clear filters'))
    const link = k.all('a').find((a) => a.textContent === 'Open Signals to start a run')!
    assert.equal(link.getAttribute('href'), '/signals')
  })

  it('says "No signals match these filters" when signals exist, and Clear filters shows everything', async () => {
    const { k, router, listCalls } = await setup({ search: 'q=zzz', list: async (p) => (p.search ? listResponse([]) : listResponse()) })
    assert.ok(k.bodyText().includes('No signals match these filters'))
    assert.ok(!k.bodyText().includes('No signals yet'))
    await k.click(k.withText('Clear filters')!)
    await k.tick(10)
    assert.equal(router.lastSearch(), 'status=all')
    assert.deepEqual(listCalls.at(-1), { page: 1, per_page: 20, sort: 'recent' })
    assert.equal(k.all('tbody tr').length, 5)
  })

  it('keeps the search and the filters on screen when nothing matches', async () => {
    const { k } = await setup({ search: 'freshness=older', list: async () => listResponse([]) })
    assert.ok(k.bodyText().includes('No signals match these filters'))
    assert.equal(k.all('select').length, 5)
    assert.ok(k.one('input'))
  })

  it('offers paging when there is more than a page, and asks for the next page', async () => {
    const { k, router, listCalls } = await setup({ list: async () => listResponse(mockupRows(), { meta: { page: 1, per_page: 20, total: 45, last_page: 3 } }) })
    assert.ok(k.bodyText().includes('Showing 1–5 of 45'))
    assert.ok(k.bodyText().includes('Page 1 of 3'))
    assert.equal((k.withText('Previous') as HTMLButtonElement).disabled, true)
    await k.click(k.withText('Next')!)
    await k.tick(10)
    assert.equal(router.lastSearch(), 'page=2')
    assert.equal(listCalls.at(-1)?.page, 2)
  })

  it('opens a signal from its title, a real button, and fetches its history', async () => {
    const { k, rowOf } = await setup()
    const button = rowOf('Rival vendor')!.querySelector('button')!
    assert.equal(button.tagName, 'BUTTON')
    assert.equal(button.getAttribute('type'), 'button')
    await k.click(button)
    await k.tick(10)
    assert.ok(k.all('[role="dialog"]').some((d) => d.textContent?.includes('Rival vendor wins a district contract')))
    assert.ok(k.bodyText().includes('Why it matters'))
    assert.ok(k.bodyText().includes('Called the office.'), 'the history was fetched and shown')
  })

  it('updates the row and the counts in place after a decision, without loading the list again', async () => {
    const { k, rowOf, listCalls, decideCalls } = await setup()
    await k.click(rowOf('District office')!.querySelector('button')!)
    await k.tick(10)
    await k.click(k.withText('Contacted')!)
    await k.tick(10)
    await k.click(k.withText('Mark contacted')!)
    await k.tick(10)

    assert.deepEqual(decideCalls, [{ id: 1, body: { decision: 'follow_up', expected_status: 'New' } }])
    assert.ok(rowOf('District office')!.textContent!.includes('Contacted'), 'the row changed')
    assert.ok(!rowOf('District office')!.textContent!.includes('Needs decision'))
    const tiles = k.one('[aria-label="Summary"]')!.textContent!
    assert.ok(tiles.includes('67'), 'need a decision went from 68 to 67')
    assert.equal(listCalls.length, 1, 'the list was not loaded again')
  })
})

function facet(k: Awaited<ReturnType<typeof kit>>, label: string) {
  return k.all('select').find((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent === label) as HTMLSelectElement
}

describe('SignalReviewView', () => {
  afterEach(disposeAll)

  it('has two tabs and opens on Signals; the Runs tab is kept in the address', async () => {
    const k = await kit()
    const router = await routerHarness('')
    const { SignalReviewView } = await import('../../components/domain/crm/signal-review-view')
    k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
    // The real service would call the network; the view has no seam for a fake, so only the frame is checked here (the lists are loading).
    const original = globalThis.fetch
    globalThis.fetch = (() => new Promise(() => undefined)) as typeof fetch
    try {
      await k.render(router.wrap(k.h(SignalReviewView)))
      await k.tick(5)
      assert.equal(k.one('h1')!.textContent, 'Signal Review')
      const tabs = k.all('[role="tab"]')
      assert.deepEqual(tabs.map((t) => t.textContent), ['Signals', 'Runs'])
      assert.equal(tabs[0].getAttribute('aria-selected'), 'true')
      assert.ok(k.one('[role="tabpanel"]#signal-review-panel-signals'))

      await k.click(tabs[1])
      assert.equal(router.lastSearch(), 'tab=runs')
      assert.equal(k.all('[role="tab"]')[1].getAttribute('aria-selected'), 'true')
      assert.ok(k.one('#signal-review-panel-runs'))
    } finally {
      globalThis.fetch = original
    }
  })
})
