import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { axeViolations } from '../agent/a11y'
import { ApiError } from '../../services/core'
import type { ProductsResponse } from '../../services/portfolio/types'
import { refusalFrom } from '../../services/signals/run-refusal'
import { portfolioProducts } from './opportunity-fixtures'
import { disposeAll, openScreen, pressLabel, readyStatus, researchRun, type Kit, type ScreenOptions } from './screen-harness'

/**
 * The checks the Signal Review's Generate dialog made, on the Generate Signals button of Company Opportunities (which keeps its own look and steps): what a
 * run costs, why Generate is off, the products that would not load, and every way the server can refuse to start a run, said in plain words. The whole screen
 * in a fake browser. The last group puts the REAL "start a run" service back and fakes `fetch`, because a screen test that fakes a service cannot see the
 * refusal that service builds.
 */

const COST = 'A run uses search and AI quota, so start one only when you need new signals.'

const generate = (k: Kit) => k.withText('Generate Signals') as HTMLButtonElement | null
/** The same button while a run is going: it says so and is off. */
const generating = (k: Kit) => k.withText('Finding Signals…') as HTMLButtonElement | null
/** The box the screen says a start (or a refusal) in: the run notice under the Generate button. */
const noticeBox = (k: Kit) => k.one('button[aria-label="Expand source exploration"]')?.closest('[role]') as HTMLElement | null
const hint = (k: Kit) => k.one('section[aria-label="Product and actions"] p[aria-live="polite"]')

async function press(k: Kit) {
  assert.ok(generate(k), 'there is a Generate Signals button')
  await k.click(generate(k)!)
  await k.tick(40)
}

/** The products with G2G's B2B ICP not set up: the first thing it lacks is named. */
const withG2gNotReady = async (): Promise<ProductsResponse> => {
  const all = portfolioProducts()
  const g2g = all.data.products[1]
  all.data.products[1] = {
    ...g2g, ready: false, missing: ['Add the ideal customer profile'],
    icp_models: { ...g2g.icp_models!, b2b: { ready: false, missing: ['Add the ideal customer profile'], configured: false } },
  }
  return all
}

describe('Generate: the line beside the button says what a run costs, or why it is off', () => {
  afterEach(disposeAll)

  it('says what a run costs, once, beside Generate, when a run can start', async () => {
    const { k } = await openScreen({ search: 'product=g2g' })
    assert.equal(generate(k)!.disabled, false)
    assert.equal(hint(k)!.textContent, COST)
    assert.equal((k.bodyText().split(COST).length - 1), 1, 'said once')
  })

  it('says why Generate is off in words when the product\'s ICP is not set up (it was a tooltip and a screen-reader line only), and the cost line is gone', async () => {
    const { k, setSelect } = await openScreen({ search: 'product=g2g', products: withG2gNotReady })
    assert.equal(generate(k)!.disabled, true)
    assert.equal(hint(k)!.textContent, 'This profile is not ready for discovery. Add the ideal customer profile')
    assert.equal(generate(k)!.title, 'Add the ideal customer profile', 'the tooltip is still there')
    assert.ok(!k.bodyText().includes(COST), '!k.bodyText().includes(COST)')

    // Another ICP type the product HAS set up: a run can start, and the line goes back to the cost.
    await setSelect(k.one('#icp-type-select') as HTMLSelectElement, 'b2g')
    assert.equal(generate(k)!.disabled, false)
    assert.equal(hint(k)!.textContent, COST)
  })

  it('says to choose one product in All products, and for a Product Master record', async () => {
    for (const search of ['product=all', 'product=4', 'status=all&q=Hillcrest']) {
      const { k } = await openScreen({ search })
      assert.equal(generate(k)!.disabled, true, search)
      assert.equal(hint(k)!.textContent, 'Choose one product to generate signals for it.', search)
      await disposeAll()
    }
  })

  it('is a polite live region, so a screen reader hears it change', async () => {
    const { k } = await openScreen({ search: 'product=g2g' })
    assert.equal(hint(k)!.getAttribute('aria-live'), 'polite')
  })
})

describe('Generate: the products would not load', () => {
  afterEach(disposeAll)

  it('says so with the server\'s reason and a Retry, instead of a screen where nothing works; Retry loads them again', async () => {
    let attempts = 0
    const { k, runCalls, mainProduct } = await openScreen({ products: async () => { attempts += 1; if (attempts === 1) throw new ApiError('The portfolio is unavailable.', 503); return portfolioProducts() } })
    const alert = k.one('section[aria-label="Product and actions"] [role="alert"]')!
    assert.ok(alert.textContent!.includes('The products could not be loaded.'), 'alert.textContent!.includes(\'The products could not be loaded.\')')
    assert.ok(alert.textContent!.includes('The portfolio is unavailable.'), 'alert.textContent!.includes(\'The portfolio is unavailable.\')')
    assert.equal(mainProduct().disabled, true, 'the box stays off until there are products')

    await pressLabel(k, 'Retry')
    await k.tick(30)
    assert.equal(runCalls.products, 2)
    assert.equal(k.one('section[aria-label="Product and actions"] [role="alert"]'), null, 'the message goes away')
    assert.equal(mainProduct().disabled, false)
    assert.equal(mainProduct().value, 'scholarclone', 'and the screen starts on its first ready product')
  })

  it('still lets a link that names All products read the signals, and says the products are missing', async () => {
    const { k } = await openScreen({ search: 'product=all', products: async () => { throw new Error('The portfolio is unavailable.') } })
    assert.ok(k.bodyText().includes('The products could not be loaded.'), 'k.bodyText().includes(\'The products could not be loaded.\')')
    assert.equal(k.all('article').length, 3, 'the signals are listed')
    assert.equal(generate(k)!.disabled, true)
  })
})

describe('Generate: every way the server can refuse to start a run, in plain words', () => {
  afterEach(disposeAll)

  /** Starts a run on G2G whose request is refused with `error`, and returns the screen. */
  async function refused(error: () => unknown, options: ScreenOptions = {}) {
    const screen = await openScreen({ search: 'product=g2g', runResearch: async () => { throw error() }, ...options })
    await press(screen.k)
    return screen
  }

  // Each case: what the server (or the connection) did, what role the notice has (an error is an alert, a wait or a set-up matter is a status), what it says.
  const CASES: Array<{ name: string; error: () => unknown; role: 'alert' | 'status'; says: string[]; neverSays?: string[] }> = [
    {
      name: 'a cool-down (429) says how long to wait',
      error: () => refusalFrom(429, { code: 'cooldown', message: 'Research ran a moment ago. Please wait before running it again.', retry_after_seconds: 540 }),
      role: 'status', says: ['Research ran a moment ago. Please wait about 9 minutes before running it again.'], neverSays: ['Please wait before running it again.'],
    },
    { name: 'a plain throttle (429 without a code) says to wait a moment', error: () => refusalFrom(429, { message: 'Too Many Attempts.' }), role: 'status', says: ['Too many tries in a short time. Wait a moment and try again.'] },
    { name: 'not allowed (403)', error: () => refusalFrom(403, { message: 'This action is unauthorized.' }), role: 'alert', says: ['You are not allowed to start research.'], neverSays: ['unauthorized'] },
    { name: 'a session that ended (401)', error: () => refusalFrom(401, { message: 'Unauthenticated.' }), role: 'alert', says: ['Your session has ended. Please sign in again.'] },
    { name: 'no connection', error: () => new TypeError('Failed to fetch'), role: 'alert', says: ['The server could not be reached. Check your connection and try again.'], neverSays: ['Failed to fetch'] },
    { name: 'a broken server (500) hides its technical text', error: () => refusalFrom(500, { message: 'SQLSTATE[HY000]: General error: 1364' }), role: 'alert', says: ['The server had a problem starting the run. Try again in a moment.'], neverSays: ['SQLSTATE'] },
    {
      name: 'no web search provider (422) says to ask an administrator, without the names of settings',
      error: () => refusalFrom(422, { code: 'research_not_configured', message: 'No web search provider is configured. An administrator must set SIGNALS_SEARCH_DRIVER and its API key in the backend environment.' }),
      role: 'status', says: ['No web search provider is configured, so research cannot run. Ask an administrator to set one up.'], neverSays: ['SIGNALS_SEARCH_DRIVER'],
    },
    {
      name: 'no AI provider (422)',
      error: () => refusalFrom(422, { code: 'ai_not_configured', message: 'No AI provider is configured for this organisation.' }),
      role: 'status', says: ['No AI provider is configured for your organisation, so research cannot run. Ask an administrator to set one up.'],
    },
    { name: 'any other refused request (422) passes the server\'s own sentence on', error: () => refusalFrom(422, { code: 'invalid_region', message: 'Choose a state inside India.' }), role: 'alert', says: ['Choose a state inside India.'] },
    { name: 'a refusal that came through the shared client (a status and a message, no code)', error: () => new ApiError('Forbidden', 403), role: 'alert', says: ['You are not allowed to start research.'] },
  ]

  for (const c of CASES) {
    it(`${c.name}, and Generate is usable again`, async () => {
      const { k } = await refused(c.error)
      const box = noticeBox(k)
      assert.ok(box, 'a notice is shown')
      assert.equal(box.getAttribute('role'), c.role)
      for (const part of c.says) assert.ok(box.textContent!.includes(part), `says: ${part}\n   shown: ${box.textContent}`)
      for (const part of c.neverSays ?? []) assert.ok(!box.textContent!.includes(part), `never says: ${part}`)
      assert.equal(generate(k)!.disabled, false, 'the button is not left stuck')
      assert.equal(generate(k)!.textContent!.trim(), 'Generate Signals')
    })
  }

  it('a product that is not ready (422) lists what it still lacks, as the server sent it, and says where to complete it', async () => {
    const { k } = await refused(() => refusalFrom(422, { code: 'product_not_configured', message: 'G2G (B2B ICP) is not ready for discovery.', missing: ['Ideal customer', 'At least one search'] }))
    const box = noticeBox(k)!
    assert.equal(box.getAttribute('role'), 'status')
    assert.ok(box.textContent!.includes('G2G (B2B ICP) is not ready for discovery.'), 'box.textContent!.includes(\'G2G (B2B ICP) is not ready for discovery.\')')
    assert.deepEqual(Array.from(box.querySelectorAll('li')).map((li) => li.textContent), ['Ideal customer', 'At least one search'])
    assert.ok(box.textContent!.includes('Complete it in Product Portfolio, then press Generate Signals again.'), 'box.textContent!.includes(\'Complete it in Product Portfolio, then press Generate Signals again.\')')
  })

  it('a sub-product that is not ready (422) is named, with what it lacks', async () => {
    const { k } = await openScreen({
      search: 'product=scholarclone%3A%3ASCH-11',
      runResearch: async () => { throw refusalFrom(422, { code: 'sub_product_not_ready', message: 'long server text with the list inside', missing: ['Buyer types'] }) },
    })
    await press(k)
    const box = noticeBox(k)!
    assert.ok(box.textContent!.includes('Scholar Learn (B2B ICP) is not ready for discovery.'), 'box.textContent!.includes(\'Scholar Learn (B2B ICP) is not ready for discovery.\')')
    assert.ok(!box.textContent!.includes('long server text'), '!box.textContent!.includes(\'long server text\')')
    assert.deepEqual(Array.from(box.querySelectorAll('li')).map((li) => li.textContent), ['Buyer types'])
  })

  it('says the same words when it is the status check before the start that is refused', async () => {
    let refuseStatus = false   // switched on when Generate is pressed: the reads of the status that the screen makes when it opens are answered
    const { k, runCalls } = await openScreen({
      search: 'product=g2g',
      status: async (product) => { if (refuseStatus) throw new ApiError('Forbidden', 403); return readyStatus(product) },
    })
    refuseStatus = true
    await press(k)
    assert.ok(noticeBox(k)!.textContent!.includes('You are not allowed to start research.'), 'noticeBox(k)!.textContent!.includes(\'You are not allowed to start research.\')')
    assert.equal(runCalls.runResearch.length, 0, 'nothing was started')
  })

  it('keeps the checks that were already there: nothing is sent for a product that is not ready', async () => {
    const { k, runCalls } = await openScreen({ search: 'product=g2g', products: withG2gNotReady })
    assert.ok(generate(k), 'the button is there, and off')
    await k.click(generate(k)!)
    await k.tick(30)
    assert.equal(runCalls.runResearch.length, 0)
  })
})

describe('Generate: a refusal because a run is going', () => {
  afterEach(disposeAll)

  /** A start the server refuses with 409; the next time the status is asked it says `after`. */
  async function conflict(after: (product: string | undefined) => ReturnType<typeof readyStatus>) {
    let refusedOnce = false
    return openScreen({
      search: 'product=g2g',
      runResearch: async () => { refusedOnce = true; throw refusalFrom(409, { code: 'already_running', message: 'Research is already running.' }) },
      status: async (product) => (refusedOnce ? after(product) : readyStatus(product)),
    })
  }

  it('looks, and follows the run when it is this product\'s: the progress is on screen and Generate is off', async () => {
    const { k, runCalls } = await conflict((product) => readyStatus(product, { running: true, latest_run: researchRun({ id: 11, product_key: 'g2g' }) }))
    await press(k)
    assert.ok(noticeBox(k)!.textContent!.includes('Research is already running for your organisation.'), 'noticeBox(k)!.textContent!.includes(\'Research is already running for your organisation.\')')
    assert.equal(noticeBox(k)!.getAttribute('role'), 'status', 'information, not an error')
    const progress = k.one('[data-testid="research-progress"]')
    assert.ok(progress, 'the run that is going is followed here')
    assert.equal(progress.getAttribute('data-state'), 'running')
    assert.equal(generate(k), null, 'no Generate Signals button: it says Finding Signals…')
    assert.equal(generating(k)!.disabled, true, 'and is off')
    assert.ok(runCalls.status.length >= 3, 'the status was asked again after the refusal')
  })

  it('says another product\'s run holds the slot, and does not show it as this product\'s progress', async () => {
    const { k } = await conflict((product) => readyStatus(product, { running: false, busy_elsewhere: true }))
    await press(k)
    assert.ok(noticeBox(k)!.textContent!.includes('A run for another product is in progress. Wait for it to finish before generating.'), 'noticeBox(k)!.textContent!.includes(\'A run for another product is in progress. Wait for it to fi...')
    assert.equal(k.one('[data-testid="research-progress"]'), null)
    assert.equal(generate(k)!.disabled, false)
  })

  it('leaves the plain sentence when the run has ended in between, and Generate usable', async () => {
    const { k } = await conflict((product) => readyStatus(product))
    await press(k)
    assert.ok(noticeBox(k)!.textContent!.includes('Wait for it to finish, then press Generate Signals again.'), 'noticeBox(k)!.textContent!.includes(\'Wait for it to finish, then press Generate Signals again.\')')
    assert.equal(k.one('[data-testid="research-progress"]'), null)
    assert.equal(generate(k)!.disabled, false)
  })
})

describe('Generate: the REAL start, with fetch faked', () => {
  afterEach(disposeAll)

  /** Replaces fetch: the run endpoint answers with `reply`, anything else is a failure the test would see. */
  function fakeServer(reply: () => Response) {
    const original = globalThis.fetch
    const asked: Array<{ url: URL; method: string; body: unknown; headers: Record<string, string> }> = []
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost')
      asked.push({ url, method: (init?.method ?? 'GET').toUpperCase(), body: init?.body ? JSON.parse(String(init.body)) : null, headers: (init?.headers ?? {}) as Record<string, string> })
      if (url.pathname.endsWith('/signals/research/run')) return reply()
      throw new Error(`unexpected request to ${url.pathname}`)
    }) as typeof fetch
    return { asked, restore: () => { globalThis.fetch = original } }
  }
  const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

  it('says how long to wait after a cool-down, from the real answer of the server (the shared client would have thrown that away)', async () => {
    const server = fakeServer(() => json(429, { status: 0, code: 'cooldown', message: 'Research ran a moment ago. Please wait before running it again.', retry_after_seconds: 540 }, { 'Retry-After': '540' }))
    try {
      const { k } = await openScreen({ search: 'product=g2g', realRun: true })
      await press(k)
      assert.ok(noticeBox(k)!.textContent!.includes('Please wait about 9 minutes before running it again.'), 'noticeBox(k)!.textContent!.includes(\'Please wait about 9 minutes before running it again.\')')
      const starts = server.asked.filter((c) => c.url.pathname.endsWith('/signals/research/run'))
      assert.equal(starts.length, 1)
      assert.equal(starts[0].method, 'POST')
      assert.equal(starts[0].headers.Authorization, 'Bearer test-token')
      assert.equal(starts[0].headers['Content-Type'], 'application/json')
      assert.equal(starts[0].url.searchParams.get('sub_institute_id'), '1', 'the same address as before: the organisation in the query')
      const body = starts[0].body as Record<string, unknown>
      assert.equal(body.product, 'g2g')
      assert.equal(body.customer_model, 'b2b')
      assert.equal(body.icp_type, 'b2b')
    } finally { server.restore() }
  })

  it('lists what a product still lacks, from the real 422 body', async () => {
    const server = fakeServer(() => json(422, { status: 0, code: 'product_not_configured', product: 'g2g', message: 'G2G (B2B ICP) is not ready for discovery.', missing: ['Ideal customer'] }))
    try {
      const { k } = await openScreen({ search: 'product=g2g', realRun: true })
      await press(k)
      assert.deepEqual(Array.from(noticeBox(k)!.querySelectorAll('li')).map((li) => li.textContent), ['Ideal customer'])
    } finally { server.restore() }
  })

  it('starts the run when the server accepts it, and follows it', async () => {
    const server = fakeServer(() => json(202, { status: 1, message: 'Research started.', data: { run_id: 7, run: researchRun() } }))
    try {
      const { k } = await openScreen({ search: 'product=g2g', realRun: true })
      await press(k)
      assert.ok(k.one('[data-testid="research-progress"]'), 'the run is followed')
      assert.equal(generating(k)!.disabled, true, 'and the button says Finding Signals…')
    } finally { server.restore() }
  })

  it('says it cannot read an "ok" answer that is not JSON, instead of a lost connection', async () => {
    const server = fakeServer(() => new Response('<html>ok</html>', { status: 200 }))
    try {
      const { k } = await openScreen({ search: 'product=g2g', realRun: true })
      await press(k)
      assert.ok(noticeBox(k)!.textContent!.includes('cannot read'), 'noticeBox(k)!.textContent!.includes(\'cannot read\')')
      assert.ok(!noticeBox(k)!.textContent!.includes('could not be reached'), '!noticeBox(k)!.textContent!.includes(\'could not be reached\')')
    } finally { server.restore() }
  })
})

// What the Signal Review's Generate dialog test "runs, finishes, closes, says how many new signals, and reads the list again" pinned (P1-C, 13 Nov 2026): when a run
// ends the list is read again. After a run that finished its work the screen also switches to that run's own results (a different request); after one that failed
// the request is the same, so only the screen's `refreshKey` makes the list read again (what a failed run saved before it stopped).
describe('Generate: when the run ends, the list is read again', () => {
  afterEach(disposeAll)

  for (const status of ['success', 'failed'] as const) {
    it(`a run that ends as ${status} makes the list read again`, async () => {
      const { k, listCalls } = await openScreen({
        search: 'product=g2g',
        getRun: async (id) => ({ status: 1, data: researchRun({ id, status, error_message: status === 'failed' ? 'The search provider refused the key.' : null, opportunities_qualified: 2, opportunities_new: 2, sources_found: 9 }) }),
      })
      await press(k)
      assert.ok(k.one('[data-testid="research-progress"]'), 'the run was started and is followed')
      const whileRunning = listCalls.length
      await k.tick(4000)   // the first question is asked 2.5 s after the start; the rest of the time is only a margin for a slow machine
      assert.ok(listCalls.length > whileRunning, `the list was read again when the run ended (${whileRunning} reads before, ${listCalls.length} after)`)
    })
  }
})

describe('Generate: accessibility', () => {
  afterEach(disposeAll)

  it('the card with the line beside Generate, and with a refusal that lists what is missing, has no axe violation', async () => {
    const { k } = await openScreen({
      search: 'product=g2g',
      runResearch: async () => { throw refusalFrom(422, { code: 'product_not_configured', message: 'G2G (B2B ICP) is not ready for discovery.', missing: ['Ideal customer', 'At least one search'] }) },
    })
    const card = () => k.one('section[aria-label="Product and actions"]')!
    assert.deepEqual(await axeViolations(card()), [])
    await press(k)
    assert.ok(noticeBox(k), 'noticeBox(k)')
    assert.deepEqual(await axeViolations(card()), [])
  })

  it('the card with the products error and its Retry has no axe violation', async () => {
    const { k } = await openScreen({ products: async () => { throw new Error('The portfolio is unavailable.') } })
    assert.ok(k.bodyText().includes('The products could not be loaded.'), 'k.bodyText().includes(\'The products could not be loaded.\')')
    assert.deepEqual(await axeViolations(k.one('section[aria-label="Product and actions"]')!), [])
  })
})
