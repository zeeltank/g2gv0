import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { axeViolations } from '../agent/a11y'
import { ApiError } from '../../services/core'
import type { SignalRun } from '../../services/signal-review/runs-service'
import { disposeAll, openScreen, pressLabel, type Kit } from './screen-harness'

/**
 * "Run health & cost" on Company Opportunities: the Signal Review's Runs tab, opened from a button that is there in EVERY scope (the runs are the
 * organisation's, not the product's). The whole screen in a fake browser, with the runs service faked (what the panel asks, what it shows) and, in the last
 * group, REAL with `fetch` faked, because a screen test that fakes a service cannot see the request that service builds.
 */

const NOW_RUN = (over: Partial<SignalRun> = {}): SignalRun => ({
  id: 81, trigger: 'manual', status: 'success', started_at: '2026-11-13T09:00:00Z', completed_at: '2026-11-13T09:03:05Z', duration_seconds: 185,
  product_key: 'scholarclone', product_master_id: 4, product_name: 'ScholarClone', signals_found: 7, signals_new: 5,
  ai_input_tokens: 90_000, ai_output_tokens: 6_214, ai_cost: 0.0412, ai_cost_currency: 'INR', search_requests: 38, search_credits: null,
  error_code: null, error_message: null, stage_message: null, ...over,
})

/** Two products' runs, one failed, so the tiles and the table have something to say. */
const RUNS = (): SignalRun[] => [
  NOW_RUN({ id: 83, status: 'failed', product_key: 'g2g', product_master_id: 9, product_name: 'G2G', signals_found: 0, signals_new: 0, ai_cost: null, ai_cost_currency: null, error_message: 'The search provider refused the key.' }),
  NOW_RUN({ id: 82, product_name: 'ScholarClone', ai_cost: 0.02 }),
  NOW_RUN({ id: 81 }),
]

const button = (k: Kit) => k.withText('Run health & cost')
const open = async (k: Kit) => {
  assert.ok(button(k), 'the Run health & cost button is on the screen')
  await k.click(button(k)!)
  await k.tick(20)
}
const dialogText = (k: Kit) => k.one('[role="dialog"]')?.textContent ?? ''

describe('Run health & cost: the button is there in every scope', () => {
  afterEach(disposeAll)

  const SCOPES: Array<[string, string]> = [
    ['no parameters (the first ready product)', ''],
    ['All products', 'product=all'],
    ['one product', 'product=g2g'],
    ['a sub-product of a product', 'product=scholarclone%3A%3ASCH-11'],
    ['a Product Master record (a number)', 'product=4'],
    ['a link that only searches', 'status=all&q=Hillcrest'],
  ]
  for (const [name, search] of SCOPES) {
    it(`${name}: the button is on the screen and works`, async () => {
      const { k, runCalls } = await openScreen({ search, runs: async () => RUNS() })
      assert.ok(button(k), 'the button is there')
      assert.equal((button(k) as HTMLButtonElement).disabled, false)
      assert.equal(runCalls.runs, 0, 'nothing is read until the window is opened')
      await open(k)
      assert.equal(runCalls.runs, 1, 'opening it asks the runs service')
      assert.ok(dialogText(k).includes('Run health & cost'), 'dialogText(k).includes(\'Run health & cost\')')
    })
  }

  it('is not the Advanced tools: All products has no Advanced tools and still has the button; one product has both', async () => {
    const every = await openScreen({ search: 'product=all' })
    assert.equal(every.k.bodyText().includes('Advanced tools'), false)
    assert.ok(button(every.k), 'button(every.k)')
    await disposeAll()

    const one = await openScreen({ search: 'product=g2g' })
    assert.ok(one.k.bodyText().includes('Advanced tools'), 'one.k.bodyText().includes(\'Advanced tools\')')
    assert.ok(button(one.k), 'button(one.k)')
  })
})

describe('Run health & cost: what the window shows', () => {
  afterEach(disposeAll)

  it('opens the Runs panel in All products: the health tiles, the cost in the server\'s currency, tokens, searches and the latest runs with their product names', async () => {
    const { k } = await openScreen({ search: 'product=all', runs: async () => RUNS() })
    await open(k)
    const text = dialogText(k)

    for (const part of ['Run health', 'Last run', 'Outcomes of 3 runs', 'AI cost', 'AI tokens', 'Search requests']) assert.ok(text.includes(part), part)
    const outcomes = k.one('[role="dialog"] [data-count="failed"] b')!.textContent
    assert.equal(outcomes, '1', 'one of the three runs failed')
    assert.ok(text.includes('₹0.0612'), 'the cost is the sum of the two runs that have one, in the currency the server named')
    assert.ok(text.includes('1 of 3 runs has no cost recorded'), 'and says how many runs it leaves out')

    const rows = k.all('[role="dialog"] tbody tr').map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent ?? ''))
    assert.equal(rows.length, 3)
    assert.deepEqual(rows.map((r) => r[0]), ['#83', '#82', '#81'], 'newest first')
    assert.deepEqual(rows.map((r) => r[5]), ['G2G', 'ScholarClone', 'ScholarClone'], 'each run names its product')
    assert.ok(rows[0][3].includes('The search provider refused the key.'), 'a failed run says why')
  })

  it('opens the same panel in one product, and the runs are still the organisation\'s (another product\'s run is listed)', async () => {
    const { k, runCalls } = await openScreen({ search: 'product=scholarclone', runs: async () => RUNS() })
    await open(k)
    assert.equal(runCalls.runs, 1)
    const products = k.all('[role="dialog"] tbody tr').map((tr) => tr.querySelectorAll('td')[5].textContent)
    assert.ok(products.includes('G2G'), 'a run of G2G is listed while ScholarClone is on screen')
  })

  it('reads the runs again each time it is opened, so the figures are as new as the click', async () => {
    const { k, runCalls } = await openScreen({ search: 'product=all', runs: async () => RUNS() })
    await open(k)
    await k.press('Escape')
    await k.tick(30)
    assert.equal(k.all('[role="dialog"]').length, 0, 'it closes')
    await open(k)
    assert.equal(runCalls.runs, 2)
  })

  it('says plainly that no run has happened yet', async () => {
    const { k } = await openScreen({ search: 'product=all', runs: async () => [] })
    await open(k)
    assert.ok(dialogText(k).includes('No research runs yet'), 'dialogText(k).includes(\'No research runs yet\')')
  })

  it('explains a refusal in plain words and reads again on Retry', async () => {
    let allow = false
    const { k, runCalls } = await openScreen({ search: 'product=all', runs: async () => { if (!allow) throw new ApiError('Forbidden', 403); return RUNS() } })
    await open(k)
    assert.ok(dialogText(k).includes('You do not have access to the run history.'), 'dialogText(k).includes(\'You do not have access to the run history.\')')
    assert.equal(k.one('[role="dialog"] table'), null)

    allow = true
    await pressLabel(k, 'Retry')
    await k.tick(20)
    assert.equal(runCalls.runs, 2)
    assert.ok(k.one('[role="dialog"] table'), 'k.one(\'[role="dialog"] table\')')
  })

  it('is told apart from Report history: each says what the other is for', async () => {
    const { k } = await openScreen({ search: 'product=g2g', runs: async () => RUNS() })
    const history = k.withText('Report history')!
    assert.ok(history, 'Report history is still under Advanced tools')
    assert.ok(history.title.includes('Run health & cost'), 'its hint points at the cost window')
    await open(k)
    assert.ok(dialogText(k).includes('Report history'), 'and the cost window points at it')
  })

  it('returns focus to the button when the window closes', async () => {
    const { k } = await openScreen({ search: 'product=all', runs: async () => RUNS() })
    button(k)!.focus()
    await open(k)
    await k.press('Escape')
    await k.tick(30)
    assert.equal(k.all('[role="dialog"]').length, 0)
    assert.ok(k.w.document.activeElement === button(k), 'focus is back on Run health & cost')
  })

  it('returns focus to the button even when the click never gave it focus (Safari does not focus a button on click)', async () => {
    const { k } = await openScreen({ search: 'product=all', runs: async () => RUNS() })
    assert.ok(k.w.document.activeElement !== button(k), 'the button has no focus before the click')
    await open(k)
    await k.press('Escape')
    await k.tick(30)
    assert.ok(k.w.document.activeElement === button(k), 'focus went to the button, not to the page')
  })

  it('opens on arrival for an old link to the Signal Review\'s Runs tab (?tab=runs), and closing it takes only `tab` out of the address', async () => {
    const { k, router, runCalls } = await openScreen({ search: 'product=all&tab=runs&status=reviewed', runs: async () => RUNS() })
    assert.equal(k.all('[role="dialog"]').length, 1, 'the window is open without a click')
    assert.equal(runCalls.runs, 1)
    assert.equal(router.written.length, 0, 'opening it writes nothing to the address')
    await k.press('Escape')
    await k.tick(30)
    assert.equal(k.all('[role="dialog"]').length, 0)
    assert.equal(router.lastSearch(), 'product=all&status=reviewed', 'tab is gone, the product and the filter stay')
  })

  it('stays closed without it, and a window opened by a click does not touch the address', async () => {
    const { k, router } = await openScreen({ search: 'product=all&status=reviewed', runs: async () => RUNS() })
    assert.equal(k.all('[role="dialog"]').length, 0)
    await open(k)
    await k.press('Escape')
    await k.tick(30)
    assert.equal(router.written.length, 0)
  })

  it('has no axe violation, open with runs and open with a refusal', async () => {
    const shown = await openScreen({ search: 'product=all', runs: async () => RUNS() })
    await open(shown.k)
    assert.deepEqual(await axeViolations(shown.k.one('[role="dialog"]')!), [])
    await disposeAll()

    const refused = await openScreen({ search: 'product=all', runs: async () => { throw new ApiError('Forbidden', 403) } })
    await open(refused.k)
    assert.deepEqual(await axeViolations(refused.k.one('[role="dialog"]')!), [])
  })
})

describe('Run health & cost: the REAL request, with fetch faked', () => {
  afterEach(disposeAll)

  it('asks /signals/research/runs and the Product Master names, with the token as a header and not in the address', async () => {
    const original = globalThis.fetch
    const asked: Array<{ url: string; headers: Record<string, string> }> = []
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url = String(input)
      asked.push({ url, headers: (init?.headers ?? {}) as Record<string, string> })
      const body = url.includes('/signals/research/runs')
        ? { status: 1, data: [{ id: 81, trigger: 'manual', status: 'success', started_at: '2026-11-13T09:00:00Z', duration_ms: 185_000, product_key: 'scholarclone', product_master_id: 4, opportunities_qualified: 7, opportunities_new: 5, ai_input_tokens: 90000, ai_output_tokens: 6214, ai_cost: '0.041200', ai_cost_currency: 'INR', search_requests: 38 }] }
        : { status: 1, data: [{ id: 4, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentId: null, label: 'ScholarClone' }] }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    try {
      const { k } = await openScreen({ search: 'product=all', realRuns: true })
      assert.equal(asked.some((c) => c.url.includes('/signals/research/runs')), false, 'nothing is asked before the button is pressed')
      await open(k)
      await k.tick(20)

      const runs = asked.filter((c) => c.url.includes('/signals/research/runs'))
      assert.equal(runs.length, 1, 'one request for the runs')
      assert.match(runs[0].url, /\/signals\/research\/runs$/, 'the runs of the organisation: no product, no page, nothing in the address')
      assert.equal(runs[0].headers.Authorization, 'Bearer test-token')
      assert.ok(asked.some((c) => c.url.endsWith('/product-master/options')), 'and the names of the products')
      assert.equal(k.one('[role="dialog"] tbody tr')!.querySelectorAll('td')[5].textContent, 'ScholarClone')
      assert.ok(dialogText(k).includes('₹0.0412'), 'dialogText(k).includes(\'₹0.0412\')')
    } finally {
      globalThis.fetch = original
    }
  })
})
