import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { refusalFrom, type RunSnapshot, type SignalRunApi, type StartRunRequest, type StartedRun } from '../../services/signal-review/signal-run-service'
import type { SignalReviewApi } from '../../services/signal-review/signal-review-service'
import { POLL_FAILURES_MAX, POLL_MS, type Timers } from './generate-model'
import { pressButton, product, products, run } from './generate-fixtures'
import { historyEntry, listResponse, mockupRows, signalRow } from './signal-fixtures'
import { routerHarness } from './router-harness'

type Kit = Awaited<ReturnType<typeof kit>>

/** A clock the test drives: nothing runs until `fire`, and what was asked for and cleared is on record. */
function fakeClock(k: Kit) {
  let next = 1
  const pending = new Map<number, { callback: () => void; ms: number }>()
  const cleared: number[] = []
  const timers: Timers = {
    set: (callback, ms) => { const id = next++; pending.set(id, { callback, ms }); return id },
    clear: (handle) => { cleared.push(handle as number); pending.delete(handle as number) },
  }
  return {
    timers,
    cleared,
    pending: () => pending.size,
    delays: () => Array.from(pending.values()).map((entry) => entry.ms),
    /** Runs everything that is waiting, then lets the answers it asked for arrive. */
    fire: async () => {
      const due = Array.from(pending.values())
      pending.clear()
      await k.act(async () => { for (const entry of due) entry.callback() })
      await k.tick(10)
    },
  }
}

function fakeService(over: Partial<SignalRunApi> = {}) {
  const calls = { products: 0, start: [] as StartRunRequest[], get: [] as number[], findRunning: 0 }
  const service: SignalRunApi = {
    products: async () => { calls.products += 1; return products() },
    start: async (request) => { calls.start.push(request); return { runId: 90, run: run({ stage_message: 'Queued. Waiting for a worker to start the run…' }) } },
    get: async (id) => { calls.get.push(id); return run({ id }) },
    findRunning: async () => { calls.findRunning += 1; return run({ id: 77 }) },
    ...over,
  }
  return { service, calls }
}

/** The real dialog (Radix Dialog) in a fake browser, with a fake server and a clock the test drives. */
async function setup(over: Partial<SignalRunApi> = {}) {
  const k = await kit()
  const { SignalGenerateDialog } = await import('../../components/domain/crm/signal-generate-dialog')
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const clock = fakeClock(k)
  const { service, calls } = fakeService(over)
  const seen = { closed: 0, finished: [] as Array<RunSnapshot | null> }
  const props = { open: true, service, timers: clock.timers, onClose: () => { seen.closed += 1 }, onFinished: (finished: RunSnapshot | null) => { seen.finished.push(finished) } }
  const show = (patch: Record<string, unknown> = {}) => k.render(k.h(SignalGenerateDialog, { ...props, ...patch }))
  await show()
  await k.tick(10)

  const field = (label: string) => {
    const wanted = k.all('label').find((l) => (l.textContent ?? '').startsWith(label))
    return (wanted ? k.w.document.getElementById(wanted.getAttribute('for') ?? '') : null) as HTMLSelectElement | null
  }
  const choose = async (label: string, value: string) => {
    const select = field(label)!
    await k.act(async () => {
      Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!.call(select, value)
      select.dispatchEvent(new k.w.Event('change', { bubbles: true }))
    })
    await k.tick(10)
  }
  const start = async () => { await pressButton(k, k.withText('Start') ? 'Start' : 'Try again'); await k.tick(10) }
  const described = (el: HTMLElement | null) => (el?.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).map((id) => k.w.document.getElementById(id)?.textContent ?? '').join(' | ')
  const dialogText = () => k.one('[role="dialog"]')?.textContent ?? ''

  return { k, clock, service, calls, seen, show, field, choose, start, described, dialogText }
}

/** Chooses Scholar and starts: the run is then going, with its first answer pending. */
async function startRun(s: Awaited<ReturnType<typeof setup>>) {
  await s.choose('Product', 'scholar')
  await s.start()
}

describe('the form', () => {
  afterEach(disposeAll)

  it('asks for a product, a customer model (B2B first) and says once what a run costs', async () => {
    const { k, field, calls, dialogText } = await setup()
    assert.equal(k.one('[role="dialog"] h2')?.textContent, 'Generate signals')
    assert.equal(calls.products, 1, 'the products are read when the dialog opens')

    assert.deepEqual(Array.from(field('Product')!.options).map((o) => o.textContent), ['Choose a product…', 'Scholar', 'G2G — B2B ICP not set up'])
    assert.equal(field('Product')!.value, '', 'a product is never chosen for the person')
    assert.deepEqual(Array.from(field('Customer model')!.options).map((o) => o.textContent), ['B2B — Business', 'B2C — Consumer', 'B2G — Government'])
    assert.equal(field('Customer model')!.value, 'b2b')

    const sentence = 'A run uses search and AI quota, so start one only when you need new signals.'
    assert.equal(dialogText().split(sentence).length - 1, 1, 'the cost is stated once')
    assert.ok(k.withText('Start'))
  })

  it('offers a sub-product only for a product that has some, and starts over when the product changes', async () => {
    const { field, choose } = await setup()
    assert.ok(field('Sub-product') === null)
    await choose('Product', 'scholar')
    assert.deepEqual(Array.from(field('Sub-product')!.options).map((o) => o.textContent), ['The whole product', 'Fees module', 'Attendance — B2B ICP not set up'])
    await choose('Sub-product', 'SCH-11')
    await choose('Product', 'g2g')
    assert.ok(field('Sub-product') === null, 'G2G has none')
    await choose('Product', 'scholar')
    assert.equal(field('Sub-product')!.value, '', 'the earlier sub-product was not kept')
  })

  it('chooses the product for a person who has only one', async () => {
    const { field } = await setup({ products: async () => [product()] })
    assert.equal(field('Product')!.value, 'scholar')
  })

  it('refuses to start without a product, says why under the field and moves focus to it', async () => {
    const { k, calls, field, start, described } = await setup()
    await start()
    assert.deepEqual(calls.start, [], 'nothing was sent')
    assert.equal(field('Product')!.getAttribute('aria-invalid'), 'true')
    assert.ok(described(field('Product')).includes('Choose a product to continue.'))
    assert.ok(k.w.document.activeElement === field('Product'), 'focus is on the product box')
  })

  it('clears that message once a product is chosen', async () => {
    const { field, start, choose, described } = await setup()
    await start()
    await choose('Product', 'scholar')
    assert.ok(!described(field('Product')).includes('Choose a product'))
  })

  it('sends the product, the customer model and the sub-product that were chosen', async () => {
    const { calls, choose, start } = await setup()
    await choose('Product', 'scholar')
    await choose('Sub-product', 'SCH-11')
    await choose('Customer model', 'b2g')
    await start()
    assert.deepEqual(calls.start, [{ product: 'scholar', customer_model: 'b2g', offer_id: 'SCH-11' }])
  })

  it('sends no sub-product when the whole product is meant, and B2B by default', async () => {
    const { calls, choose, start } = await setup()
    await choose('Product', 'scholar')
    await start()
    assert.deepEqual(calls.start, [{ product: 'scholar', customer_model: 'b2b' }])
  })

  it('closes from Cancel without starting anything', async () => {
    const { k, seen, calls } = await setup()
    await pressButton(k, 'Cancel')
    assert.equal(seen.closed, 1)
    assert.deepEqual(calls.start, [])
  })

  it('shows the products failing to load, with Retry that loads them', async () => {
    let attempts = 0
    const { k, field, calls, dialogText } = await setup({ products: async () => { attempts += 1; if (attempts === 1) throw new Error('The portfolio is unavailable.'); return products() } })
    assert.ok(dialogText().includes('The products could not be loaded'))
    assert.ok(dialogText().includes('The portfolio is unavailable.'))
    assert.ok(k.withText('Start') === null)
    await pressButton(k, 'Retry')
    await k.tick(10)
    assert.equal(attempts, 2)
    assert.ok(field('Product'))
    assert.equal(calls.start.length, 0)
  })

  it('shows a loading state before the products arrive', async () => {
    const { k } = await setup({ products: () => new Promise(() => undefined) })
    assert.ok(k.one('[role="dialog"] [role="status"]')!.textContent!.includes('Loading products'))
  })

  it('opens on a fresh form each time, even after a refusal', async () => {
    const { show, field, choose, k } = await setup()
    await choose('Product', 'scholar')
    await choose('Customer model', 'b2c')
    await show({ open: false })
    await k.tick(10)
    await show({ open: true })
    await k.tick(10)
    assert.equal(field('Product')!.value, '')
    assert.equal(field('Customer model')!.value, 'b2b')
  })
})

describe('starting and watching a run', () => {
  afterEach(disposeAll)

  it('shows "Starting…" with the form off while the request is on its way, and cannot be closed then', async () => {
    let release!: (started: StartedRun) => void
    const s = await setup({ start: () => new Promise<StartedRun>((resolve) => { release = resolve }) })
    const { k, field, seen } = s

    await s.choose('Product', 'scholar')
    await s.start()
    assert.ok(k.withText('Starting…'))
    assert.equal((k.withText('Starting…') as HTMLButtonElement).disabled, true)
    assert.equal(field('Product')!.disabled, true)
    assert.equal((k.withText('Cancel') as HTMLButtonElement).disabled, true)
    await k.press('Escape')
    assert.equal(seen.closed, 0, 'Escape does not close the window while the request is out')

    await k.act(async () => release({ runId: 90, run: run() }))
    await k.tick(10)
    assert.ok(k.bodyText().includes('Research is running'))
  })

  it('can be closed with Escape when nothing is going on (so the test above proves something)', async () => {
    const { k, seen } = await setup()
    await k.press('Escape')
    assert.equal(seen.closed, 1)
  })

  it('sends one request when the form is submitted twice before the screen has caught up', async () => {
    const s = await setup()
    await s.choose('Product', 'scholar')
    const form = s.k.one('[role="dialog"] form')!
    await s.k.act(async () => {
      for (let i = 0; i < 2; i += 1) form.dispatchEvent(new s.k.w.Event('submit', { bubbles: true, cancelable: true }))
    })
    await s.k.tick(10)
    assert.equal(s.calls.start.length, 1)
  })

  it('shows the run going, with the server\'s message, and asks about it no faster than every three seconds', async () => {
    const s = await setup()
    await startRun(s)
    assert.equal(s.k.one('[role="dialog"] h2')?.textContent, 'Research is running')
    const status = s.k.one('[role="dialog"] [role="status"]')!
    assert.ok(status.textContent!.includes('Queued. Waiting for a worker to start the run…'))
    assert.equal(s.clock.pending(), 1)
    assert.ok(s.clock.delays().every((ms) => ms >= 3000))
    assert.equal(s.clock.delays()[0], POLL_MS)
    assert.deepEqual(s.calls.get, [], 'the first question waits for the first interval')
  })

  it('updates the progress at each answer and goes on asking', async () => {
    const answers = [run({ queries_run: 3, sources_found: 0, stage_message: 'Searching…' }), run({ queries_run: 9, sources_found: 4, stage_message: 'Reading sources…' })]
    const s = await setup({ get: async (id) => answers.shift() ?? run({ id }) })
    await startRun(s)

    await s.clock.fire()
    assert.ok(s.dialogText().includes('Searching…'))
    assert.ok(s.dialogText().includes('3 searches run, 0 sources found so far.'))
    assert.equal(s.clock.pending(), 1)

    await s.clock.fire()
    assert.ok(s.dialogText().includes('Reading sources…'))
    assert.ok(s.dialogText().includes('9 searches run, 4 sources found so far.'))
    assert.equal(s.clock.pending(), 1)
    assert.equal(s.seen.closed, 0)
  })

  it('closes and tells the screen how many new signals when the run finishes', async () => {
    const s = await setup({ get: async (id) => run({ id, status: 'success', opportunities_new: 4, opportunities_qualified: 6 }) })
    await startRun(s)
    await s.clock.fire()
    assert.equal(s.seen.finished.length, 1)
    assert.equal(s.seen.finished[0]?.id, 90)
    assert.equal(s.seen.finished[0]?.opportunities_new, 4)
    assert.equal(s.seen.closed, 1)
    assert.equal(s.clock.pending(), 0, 'nothing is left to ask')
  })

  it('treats a run that finished with limits as finished', async () => {
    const s = await setup({ get: async (id) => run({ id, status: 'partial', opportunities_new: 1 }) })
    await startRun(s)
    await s.clock.fire()
    assert.deepEqual([s.seen.finished[0]?.status, s.seen.closed], ['partial', 1])
  })

  it('stays open and says why when the run did not finish, and still lets the screen refresh', async () => {
    const s = await setup({ get: async (id) => run({ id, status: 'failed', error_message: 'The search provider refused the key.' }) })
    await startRun(s)
    await s.clock.fire()

    assert.equal(s.seen.closed, 0, 'the window stays so the reason can be read')
    assert.equal(s.seen.finished.length, 1, 'the Runs tab can still show the run')
    assert.ok(s.dialogText().includes('The run did not finish'))
    assert.ok(s.dialogText().includes('The search provider refused the key.'))
    assert.equal(s.clock.pending(), 0)
  })

  it('goes back to the form with the choices kept after a run that did not finish', async () => {
    const s = await setup({ get: async (id) => run({ id, status: 'timed_out', error_message: 'The run stopped answering.' }) })
    await s.choose('Product', 'scholar')
    await s.choose('Customer model', 'b2g')
    await s.start()
    await s.clock.fire()
    await pressButton(s.k, 'Back to the form')
    assert.equal(s.field('Product')!.value, 'scholar')
    assert.equal(s.field('Customer model')!.value, 'b2g')
  })

  it('keeps asking through a few failed polls', async () => {
    let failures = POLL_FAILURES_MAX - 2
    const s = await setup({ get: async (id) => { if (failures > 0) { failures -= 1; throw new Error('timeout') } return run({ id, status: 'success', opportunities_new: 2 }) } })
    await startRun(s)
    for (let i = 0; i < POLL_FAILURES_MAX - 2; i += 1) await s.clock.fire()
    assert.equal(s.seen.finished.length, 0)
    assert.ok(s.dialogText().includes('Research is running'))
    await s.clock.fire()
    assert.equal(s.seen.finished[0]?.opportunities_new, 2)
  })

  it('says contact was lost after too many failed polls, and Keep watching follows the run again', async () => {
    let down = true
    const s = await setup({ get: async (id) => { if (down) throw new Error('offline'); return run({ id, status: 'success', opportunities_new: 1 }) } })
    await startRun(s)
    for (let i = 0; i < POLL_FAILURES_MAX; i += 1) await s.clock.fire()

    assert.ok(s.dialogText().includes('Lost contact with the server'))
    assert.ok(s.dialogText().includes('Runs tab'))
    assert.equal(s.clock.pending(), 0, 'it stopped asking')

    down = false
    await pressButton(s.k, 'Keep watching')
    await s.clock.fire()
    assert.equal(s.seen.finished[0]?.id, 90)
    assert.equal(s.seen.closed, 1)
  })

  it('can be closed while the run goes: the run is not stopped, and the dialog says so', async () => {
    const s = await setup()
    await startRun(s)
    assert.ok(s.dialogText().includes('You can close this window. The run keeps going on the server'))
    await pressButton(s.k, 'Close')
    assert.equal(s.seen.closed, 1)
  })
})

describe('closing stops the polling', () => {
  afterEach(disposeAll)

  it('clears the timer when the window is closed while a run goes', async () => {
    const s = await setup()
    await startRun(s)
    assert.equal(s.clock.pending(), 1)
    await s.show({ open: false })
    await s.k.tick(10)
    assert.equal(s.clock.pending(), 0)
    assert.ok(s.clock.cleared.length >= 1)
  })

  it('clears the timer when the screen goes away', async () => {
    const s = await setup()
    await startRun(s)
    await s.k.unmount()
    assert.equal(s.clock.pending(), 0)
  })

  it('ignores an answer that arrives after the window was closed', async () => {
    let answer!: (value: RunSnapshot) => void
    const s = await setup({ get: () => new Promise<RunSnapshot>((resolve) => { answer = resolve }) })
    await startRun(s)
    await s.clock.fire()
    await s.show({ open: false })
    await s.k.tick(10)
    await s.k.act(async () => answer(run({ status: 'success', opportunities_new: 5 })))
    await s.k.tick(10)
    assert.deepEqual(s.seen.finished, [], 'the late answer changed nothing')
    assert.equal(s.clock.pending(), 0, 'and started no new timer')
  })

  it('ignores a start that was answered after the screen went away', async () => {
    let release!: (started: StartedRun) => void
    const s = await setup({ start: () => new Promise<StartedRun>((resolve) => { release = resolve }) })
    await s.choose('Product', 'scholar')
    await s.start()
    await s.k.unmount()
    await s.k.act(async () => release({ runId: 90, run: run() }))
    await s.k.tick(10)
    assert.equal(s.clock.pending(), 0, 'no one is watching, so nothing polls')
  })
})

describe('what the server refuses', () => {
  afterEach(disposeAll)

  async function refused(status: number, body: Record<string, unknown>, choices?: (s: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
    const starts = { count: 0 }
    const s = await setup({ start: async () => { starts.count += 1; throw refusalFrom(status, body) } })
    await s.choose('Product', 'scholar')
    if (choices) await choices(s)
    await s.start()
    return { ...s, starts }
  }

  it('lists what is missing when the product is not ready, and keeps the form so it can be fixed', async () => {
    const s = await refused(422, { code: 'product_not_configured', message: 'Scholar (B2B ICP) is not ready for discovery.', missing: ['Ideal customer', 'At least one search'] })
    const text = s.dialogText()
    assert.ok(text.includes('Scholar (B2B ICP) is not ready for discovery.'))
    const items = s.k.all('[role="dialog"] [role="alert"] li').map((li) => li.textContent)
    assert.deepEqual(items, ['Ideal customer', 'At least one search'])
    assert.equal(s.k.one('[role="dialog"] a')!.getAttribute('href'), '/portfolio/scholar?tab=offers', 'an ICP belongs to a sub-product now, so the way to complete it is the Offers tab')
    assert.ok(s.dialogText().includes("Open the sub-products of this product to complete their ICPs"))
    assert.ok(s.field('Product'), 'the form is still there')
    assert.equal(s.field('Product')!.value, 'scholar')
  })

  it('names the sub-product and lists what it is missing', async () => {
    const s = await refused(422, { code: 'sub_product_not_ready', message: 'long server text', missing: ['Buyer types'] }, (x) => x.choose('Sub-product', 'SCH-11'))
    assert.ok(s.dialogText().includes('Fees module (B2B ICP) is not ready for discovery.'))
    assert.deepEqual(s.k.all('[role="dialog"] [role="alert"] li').map((li) => li.textContent), ['Buyer types'])
    assert.ok(!s.dialogText().includes('long server text'))
  })

  it('says research is already running on a 409 and offers to watch it; it is not treated as a failure', async () => {
    const s = await refused(409, { code: 'already_running', message: 'Research is already running.' })
    const alert = s.k.one('[role="dialog"] [role="alert"]')!
    assert.ok(alert.textContent!.includes('Research is already running'))
    assert.ok(s.k.withText('Watch it'))
    assert.ok(!/could not be started|failed/i.test(alert.textContent!), 'it is not worded as a failure')
    assert.equal(s.k.one('[role="dialog"] h2')!.textContent, 'Generate signals', 'the form stays')
  })

  it('follows the run that is going when the person presses Watch it', async () => {
    const s = await refused(409, { code: 'already_running', message: 'Research is already running.' })
    await pressButton(s.k, 'Watch it')
    await s.k.tick(10)
    assert.equal(s.calls.findRunning, 1)
    assert.equal(s.starts.count, 1, 'no second run was started')
    assert.equal(s.k.one('[role="dialog"] h2')!.textContent, 'Research is running')
    await s.clock.fire()
    assert.deepEqual(s.calls.get, [77], 'it asks about the run that was found')
  })

  it('says so when the run that was going has ended before Watch it found it, and refreshes the screen', async () => {
    const s = await setup({ start: async () => { throw refusalFrom(409, { code: 'already_running' }) }, findRunning: async () => null })
    await s.choose('Product', 'scholar')
    await s.start()
    await pressButton(s.k, 'Watch it')
    await s.k.tick(10)
    assert.ok(s.dialogText().includes('That run has just finished'))
    assert.deepEqual(s.seen.finished, [null])
  })

  it('says "You are not allowed to start research." on a 403', async () => {
    const s = await refused(403, { message: 'This action is unauthorized.' })
    assert.ok(s.dialogText().includes('You are not allowed to start research.'))
    assert.ok(s.k.withText('Watch it') === null)
  })

  it('says research is not set up, without technical words, when no provider is configured', async () => {
    const s = await refused(422, { code: 'research_not_configured', message: 'Set SIGNALS_SEARCH_DRIVER and its API key in the backend environment.' })
    assert.ok(s.dialogText().includes('Ask an administrator'))
    assert.ok(!s.dialogText().includes('SIGNALS_SEARCH_DRIVER'))
  })

  it('explains the cool-down with how long to wait', async () => {
    const s = await refused(429, { code: 'cooldown', message: 'Research ran a moment ago.', retry_after_seconds: 540 })
    assert.ok(s.dialogText().includes('Please wait about 9 minutes before running it again.'))
  })

  it('offers to try again after the connection fails, and a second press starts the run', async () => {
    let attempts = 0
    const s = await setup({
      start: async () => { attempts += 1; if (attempts === 1) throw new TypeError('fetch failed'); return { runId: 91, run: null } },
    })
    await s.choose('Product', 'scholar')
    await s.start()
    assert.ok(s.dialogText().includes('The server could not be reached. Check your connection and try again.'))
    assert.ok(s.k.withText('Try again'))
    await s.start()
    assert.equal(attempts, 2)
    assert.equal(s.k.one('[role="dialog"] h2')!.textContent, 'Research is running')
  })

  it('takes the message away once the person changes something', async () => {
    const s = await refused(422, { code: 'product_not_configured', message: 'Scholar (B2B ICP) is not ready for discovery.', missing: ['Ideal customer'] })
    await s.choose('Customer model', 'b2g')
    assert.equal(s.k.all('[role="dialog"] [role="alert"]').length, 0)
  })
})

// ── The screen around the dialog ────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Generate signals on the Signal Review screen', () => {
  afterEach(disposeAll)

  async function screen(over: Partial<SignalRunApi> = {}, search = '') {
    const k = await kit()
    const router = await routerHarness(search)
    const { SignalReviewView } = await import('../../components/domain/crm/signal-review-view')
    k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
    Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

    const clock = fakeClock(k)
    const { service: runService, calls } = fakeService(over)
    const listCalls: unknown[] = []
    const service = {
      list: async (params: unknown) => { listCalls.push(params); return listResponse(mockupRows()) },
      get: async (id: number) => ({ status: 1, data: signalRow({ id }) }),
      history: async () => ({ status: 1, data: [historyEntry()] }),
      decide: async () => { throw new Error('not used') },
      promote: async () => { throw new Error('not used') },
      productOptions: async () => ({ status: 1, data: [] }),
    } as unknown as SignalReviewApi

    // The Runs tab reads the run history itself; count what it asks the (fake) network.
    const originalFetch = globalThis.fetch
    const runsReads: string[] = []
    globalThis.fetch = (async (url: unknown) => {
      if (String(url).includes('/signals/research/runs')) runsReads.push(String(url))
      return new Response(JSON.stringify({ status: 1, data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    await k.render(router.wrap(k.h(SignalReviewView, { service, runService, timers: clock.timers })))
    await k.tick(10)
    return { k, router, clock, calls, listCalls, runsReads, restore: () => { globalThis.fetch = originalFetch } }
  }

  const noticeText = (k: Kit) => k.all('[role="status"]').map((el) => el.textContent).join(' | ')

  it('has Generate signals in the page header, and opens the dialog from it', async () => {
    const s = await screen()
    try {
      const button = s.k.withText('Generate signals')!
      assert.ok(button.closest('header'), 'it is in the header, beside the title')
      await s.k.click(button)
      await s.k.tick(10)
      assert.equal(s.k.one('[role="dialog"] h2')?.textContent, 'Generate signals')
    } finally { s.restore() }
  })

  it('returns focus to the Generate signals button when the dialog closes', async () => {
    const s = await screen()
    try {
      const button = s.k.withText('Generate signals')!
      button.focus()
      await s.k.click(button)
      await s.k.tick(10)
      await pressButton(s.k, 'Cancel')
      await s.k.tick(30)
      assert.equal(s.k.all('[role="dialog"]').length, 0)
      assert.ok(s.k.w.document.activeElement === s.k.withText('Generate signals'), 'focus is back on the Generate signals button')
    } finally { s.restore() }
  })

  it('runs, finishes, closes, says how many new signals, and reads the list again', async () => {
    const s = await screen({ get: async (id) => run({ id, status: 'success', opportunities_new: 3 }) })
    try {
      assert.equal(s.listCalls.length, 1)
      await pressButton(s.k, 'Generate signals')
      await s.k.tick(10)
      const select = s.k.all('select').find((el) => (el as HTMLSelectElement).options[0]?.textContent === 'Choose a product…') as HTMLSelectElement
      await s.k.act(async () => {
        Object.getOwnPropertyDescriptor(s.k.w.HTMLSelectElement.prototype, 'value')!.set!.call(select, 'scholar')
        select.dispatchEvent(new s.k.w.Event('change', { bubbles: true }))
      })
      await pressButton(s.k, 'Start')
      await s.k.tick(10)
      await s.clock.fire()

      assert.equal(s.k.all('[role="dialog"]').length, 0, 'the dialog closed')
      assert.ok(noticeText(s.k).includes('Run finished: 3 new signals.'))
      assert.equal(s.listCalls.length, 2, 'the list was read again')
    } finally { s.restore() }
  })

  it('shows the run on the Runs tab when it is started from there: the tab reads its history again', async () => {
    const s = await screen({ get: async (id) => run({ id, status: 'success', opportunities_new: 0 }) }, 'tab=runs')
    try {
      const before = s.runsReads.length
      assert.ok(before >= 1, 'the Runs tab read its history when it opened')
      await pressButton(s.k, 'Generate signals')
      await s.k.tick(10)
      const select = s.k.all('select').find((el) => (el as HTMLSelectElement).options[0]?.textContent === 'Choose a product…') as HTMLSelectElement
      await s.k.act(async () => {
        Object.getOwnPropertyDescriptor(s.k.w.HTMLSelectElement.prototype, 'value')!.set!.call(select, 'scholar')
        select.dispatchEvent(new s.k.w.Event('change', { bubbles: true }))
      })
      await pressButton(s.k, 'Start')
      await s.k.tick(10)
      await s.clock.fire()
      await s.k.tick(10)
      assert.ok(s.runsReads.length > before, 'the run history was read again after the run')
    } finally { s.restore() }
  })

  it('offers Generate signals in the "No signals yet" state', async () => {
    const k = await kit()
    const router = await routerHarness('')
    const { SignalReviewView } = await import('../../components/domain/crm/signal-review-view')
    k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
    Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })
    const { service: runService } = fakeService()
    const service = { list: async () => listResponse([], { summary: { total: 0, new: 0, high_priority: 0, follow_up: 0 } }), productOptions: async () => ({ status: 1, data: [] }) } as unknown as SignalReviewApi
    await k.render(router.wrap(k.h(SignalReviewView, { service, runService })))
    await k.tick(10)
    assert.ok(k.bodyText().includes('No signals yet'))
    const buttons = k.all('button').filter((b) => b.textContent?.trim() === 'Generate signals')
    assert.equal(buttons.length, 2, 'one in the header, one in the empty state')
    await k.click(buttons[1])
    await k.tick(10)
    assert.equal(k.one('[role="dialog"] h2')?.textContent, 'Generate signals')
  })
})
