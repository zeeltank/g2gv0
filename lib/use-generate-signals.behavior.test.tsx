import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { JSDOM } from 'jsdom'

// A real render of the real hook, in jsdom, with the network service replaced by a script. No provider and no backend is involved.
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>')
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })

type Hook = ReturnType<typeof import('@/components/domain/signals/use-generate-signals').useGenerateSignals>

const place = { country: 'India', state: 'Gujarat' }
const ctx = { organizationId: 1, subInstituteId: 1, userId: 1 } as never
const ready = { ready: true, missing: [] as string[], configured: true }
const notReady = { ready: false, missing: [] as string[], configured: false }
const productOf = (key: string) => ({
  key, label: key.toUpperCase(), ready: true, missing: [], next_step: null, offers: [],
  icp_models: { b2b: ready, b2c: notReady, b2g: notReady },
})
// Two products, so a test can move the screen from one to the other while a run is being followed.
const products = [productOf('p'), productOf('q')] as never

const statusBody = (over: Record<string, unknown> = {}) => ({
  data: {
    running: false, busy_elsewhere: false, latest_run: null,
    product: { key: 'p', label: 'P', ready: true, missing: [], icp_models: {} },
    requirements: { search_configured: true, ai_configured: true },
    ...over,
  },
})

const run = (status: string, over: Record<string, unknown> = {}) => ({ id: 7, status, stage: 'searching', stage_message: 'x', ...over })

/** What one question about the run answers: a run row, an error (the question failed), or a promise the test settles itself. The last entry is repeated. */
type Poll = Record<string, unknown> | Error | Promise<Record<string, unknown>>

async function setup(script: { polls: Poll[]; start?: () => Promise<unknown>; icpSync?: Record<string, unknown> | null }, onIcpSynced?: () => void) {
  const { opportunitiesService } = await import('@/services/signals/opportunities')
  const { useGenerateSignals } = await import('@/components/domain/signals/use-generate-signals')
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')

  let polls = 0
  const calls = { runResearch: 0, getRun: 0 }
  const svc = opportunitiesService as unknown as Record<string, unknown>
  svc.getStatus = async () => statusBody()
  svc.runResearch = async () => { calls.runResearch += 1; return script.start ? script.start() : { status: 1, message: 'Research started.', data: { run_id: 7, run: run('running'), ...(script.icpSync === undefined ? {} : { icp_sync: script.icpSync }) } } }
  svc.getRun = async () => {
    calls.getRun += 1
    const r = script.polls[Math.min(polls, script.polls.length - 1)]
    polls += 1
    if (r instanceof Error) throw r
    return { status: 1, data: await r }
  }

  const latest: { hook: Hook | null } = { hook: null }
  function Harness({ regions, productKey }: { regions: { country: string; state?: string }[]; productKey: string }) {
    latest.hook = useGenerateSignals(ctx, productKey, products, null, regions as never, onIcpSynced)
    return null
  }
  const host = document.createElement('div')   // a fresh container per test
  document.body.appendChild(host)
  const root = createRoot(host)
  const render = (regions: { country: string; state?: string }[], productKey = 'p') => React.act(async () => { root.render(React.createElement(Harness, { regions, productKey })) })
  const flush = () => React.act(async () => { await Promise.resolve(); await Promise.resolve() })
  const tick = (ms: number) => React.act(async () => { mock.timers.tick(ms); await Promise.resolve(); await Promise.resolve() })

  return { latest, render, flush, tick, calls, unmount: () => React.act(async () => root.unmount()), act: React.act }
}

type Setup = Awaited<ReturnType<typeof setup>>

/** The screen opens on product p and the person presses Generate: the run (id 7) is started and its first question is on the clock. */
async function startRun(t: Setup) {
  await t.render([])
  await t.flush()
  await t.act(async () => { await t.latest.hook!.generate([] as never, 'b2b') })
}

/** `n` questions in a row that do not get an answer. */
const lost = (n: number): Poll[] => Array.from({ length: n }, () => new Error('timeout'))

describe('Following a run: the real hook rendered', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }))
  afterEach(() => mock.timers.reset())

  it('changing the places while a run is going does not drop the run: it keeps polling to its end', async () => {
    const t = await setup({ polls: [run('running'), run('running'), run('success', { opportunities_qualified: 2, opportunities_new: 2 })] })
    await t.render([])
    await t.flush()

    await t.act(async () => { await t.latest.hook!.generate([place] as never, 'b2b') })
    await t.render([place])   // Generate commits the typed places: the places change right after the run starts
    await t.flush()
    assert.equal(t.latest.hook!.running, true, 'the run is still being followed after the places changed')
    assert.equal(t.calls.runResearch, 1)

    await t.tick(2500)
    assert.equal(t.latest.hook!.running, true)
    await t.tick(2500)
    await t.tick(2500)
    assert.equal(t.latest.hook!.running, false, 'the poll reached the end of the run')
    assert.equal(t.latest.hook!.activeRun?.status, 'success')
    assert.ok(t.calls.getRun >= 3, 'it kept polling through the change')
    await t.unmount()
  })

  it('a run that fails ends polling and leaves the failed run for the screen to show', async () => {
    const t = await setup({ polls: [run('running'), run('failed', { error_message: 'All search queries failed to reach provider.' })] })
    await t.render([])
    await t.flush()

    await t.act(async () => { await t.latest.hook!.generate([] as never, 'b2b') })
    await t.tick(2500)
    await t.tick(2500)

    const hook = t.latest.hook!
    assert.equal(hook.running, false)
    assert.equal(hook.activeRun?.status, 'failed')
    assert.equal(hook.activeRun?.error_message, 'All search queries failed to reach provider.', 'the reason is kept on the run the screen shows')
    const { showsRunProgress } = await import('@/lib/signal-run-view')
    assert.equal(showsRunProgress(hook.running, hook.activeRun), true, 'so the progress panel (with the reason and Retry) stays on screen')
    const callsAtEnd = t.calls.getRun
    await t.tick(10000)
    assert.equal(t.calls.getRun, callsAtEnd, 'polling stopped')
    await t.unmount()
  })

  it('reports the ICP the server created or updated, once, and reads the ICP data again', async () => {
    let reloads = 0
    const t = await setup({ polls: [run('running')], icpSync: { status: 'updated', message: 'Updated the Region of the B2B ICP for Fee Suite to USA.' } }, () => { reloads += 1 })
    await t.render([])
    await t.flush()

    await t.act(async () => { await t.latest.hook!.generate([place] as never, 'b2b') })
    await t.flush()

    assert.match(t.latest.hook!.notice?.text ?? '', /Research started\. Updated the Region of the B2B ICP for Fee Suite to USA\./)
    assert.equal(reloads, 1)
    await t.unmount()
  })

  it('says nothing about an ICP for Whole Product or an unchanged ICP, and does not reload', async () => {
    for (const icpSync of [{ status: 'skipped', reason: 'whole_product', message: null }, { status: 'unchanged', message: null }, undefined]) {
      let reloads = 0
      const t = await setup({ polls: [run('running')], icpSync }, () => { reloads += 1 })
      await t.render([])
      await t.flush()

      await t.act(async () => { await t.latest.hook!.generate([place] as never, 'b2b') })
      await t.flush()

      assert.equal(t.latest.hook!.notice?.text, 'Research started.')
      assert.equal(reloads, 0)
      await t.unmount()
    }
  })
})

// The checks below replaced the ones the Signal Review's Generate dialog had (P1-C, 13 Nov 2026): how often a run is asked about, how many failed questions in a
// row are put up with, what ends the watch, and what stops the clock. The dialog's own versions were pinned only through the dialog, which was removed.
describe('Following a run: how often, how long and when it stops', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }))
  afterEach(() => mock.timers.reset())

  it('asks about a run for the first time after 2.5 seconds, and again 2.5 seconds after each answer', async () => {
    const t = await setup({ polls: [run('running'), run('running'), run('success', { opportunities_qualified: 1, opportunities_new: 1 })] })
    await startRun(t)
    assert.equal(t.calls.getRun, 0, 'nothing is asked at once')
    await t.tick(2499)
    assert.equal(t.calls.getRun, 0, 'not before 2.5 seconds')
    await t.tick(1)
    assert.equal(t.calls.getRun, 1, 'the first question, on the dot')
    await t.tick(2499)
    assert.equal(t.calls.getRun, 1, 'the next one waits a full interval from the answer')
    await t.tick(1)
    assert.equal(t.calls.getRun, 2)
    await t.unmount()
  })

  it('shows each answer as the run on screen and goes on asking until the run ends', async () => {
    const t = await setup({ polls: [run('running', { stage: 'searching', queries_run: 3 }), run('running', { stage: 'collecting', queries_run: 9 }), run('success', { stage: 'saving', opportunities_qualified: 1, opportunities_new: 1 })] })
    await startRun(t)
    await t.tick(2500)
    assert.equal(t.latest.hook!.activeRun?.stage, 'searching', 'the first answer is on screen')
    assert.equal(t.latest.hook!.activeRun?.queries_run, 3)
    assert.equal(t.latest.hook!.running, true)
    await t.tick(2500)
    assert.equal(t.latest.hook!.activeRun?.stage, 'collecting', 'and the second replaces it')
    assert.equal(t.latest.hook!.activeRun?.queries_run, 9)
    assert.equal(t.latest.hook!.running, true)
    await t.tick(2500)
    assert.equal(t.latest.hook!.running, false)
    assert.equal(t.latest.hook!.activeRun?.status, 'success')
    await t.unmount()
  })

  it('ends with a notice that says how the run went and asks the lists to read again, when the run succeeds', async () => {
    const t = await setup({ polls: [run('running'), run('success', { opportunities_qualified: 2, opportunities_new: 2, sources_found: 9 })] })
    await startRun(t)
    assert.equal(t.latest.hook!.refreshKey, 0)
    await t.tick(2500)
    await t.tick(2500)
    const hook = t.latest.hook!
    assert.equal(hook.running, false)
    assert.equal(hook.notice?.tone, 'success')
    assert.ok(hook.notice?.text.startsWith('Finished: 2 qualified (2 new)'), `the notice says what the run found: ${hook.notice?.text}`)
    assert.equal(hook.refreshKey, 1, 'the lists are asked to read again')
    assert.equal(hook.completedCount, 1, 'and the screen is told a run finished')
    await t.unmount()
  })

  it('keeps asking through eleven failed questions in a row, and still ends with the run when it finishes', async () => {
    const t = await setup({ polls: [...lost(11), run('success', { opportunities_qualified: 2, opportunities_new: 2, sources_found: 9 })] })
    await startRun(t)
    for (let i = 0; i < 11; i += 1) await t.tick(2500)
    assert.equal(t.calls.getRun, 11)
    assert.equal(t.latest.hook!.running, true, 'still following after eleven failed questions')
    assert.ok(!/Lost contact/.test(t.latest.hook!.notice?.text ?? ''), 'and it has not said contact was lost')

    await t.tick(2500)
    const hook = t.latest.hook!
    assert.equal(hook.running, false)
    assert.equal(hook.activeRun?.status, 'success')
    assert.equal(hook.notice?.tone, 'success')
    assert.ok(!/Lost contact/.test(hook.notice?.text ?? ''), 'the run ended as a run, not as a lost connection')
    await t.unmount()
  })

  it('says contact was lost after twelve failed questions in a row, stops asking and gives the screen back', async () => {
    const t = await setup({ polls: lost(12) })
    await startRun(t)
    for (let i = 0; i < 11; i += 1) await t.tick(2500)
    assert.equal(t.latest.hook!.running, true, 'eleven failures are not yet "lost"')

    await t.tick(2500)
    const hook = t.latest.hook!
    assert.equal(hook.running, false, 'the screen is given back')
    assert.deepEqual({ tone: hook.notice?.tone, text: hook.notice?.text }, { tone: 'warning', text: 'Lost contact with the server while following the run. Reload the page to see where it got to.' })
    assert.equal(hook.refreshKey, 1, 'the lists are asked to read again')
    assert.equal(t.calls.getRun, 12)
    await t.tick(60000)
    assert.equal(t.calls.getRun, 12, 'it stopped asking')
    await t.unmount()
  })

  it('counts failed questions in a row: a good answer in between starts the count again', async () => {
    const t = await setup({ polls: [...lost(11), run('running'), ...lost(11), run('success', { opportunities_qualified: 1, opportunities_new: 1, sources_found: 3 })] })
    await startRun(t)
    for (let i = 0; i < 24; i += 1) await t.tick(2500)
    const hook = t.latest.hook!
    assert.equal(t.calls.getRun, 24)
    assert.equal(hook.running, false)
    assert.equal(hook.activeRun?.status, 'success')
    assert.ok(!/Lost contact/.test(hook.notice?.text ?? ''), 'twenty-two failures in all, but never twelve in a row')
    await t.unmount()
  })

  it('ends the watch for a run that finished with limits, with a warning that still says what it found', async () => {
    const t = await setup({ polls: [run('running'), run('partial', { stage_message: 'Stopped early.', opportunities_qualified: 2, opportunities_new: 1, queries_run: 3, queries_failed: 1, sources_found: 4 })] })
    await startRun(t)
    await t.tick(2500)
    await t.tick(2500)
    const hook = t.latest.hook!
    assert.equal(hook.running, false)
    assert.equal(hook.activeRun?.status, 'partial')
    assert.equal(hook.notice?.tone, 'warning')
    assert.ok(hook.notice?.text.startsWith('Finished with limits: Stopped early. 2 qualified (1 new).'), `the notice names the limit and the numbers: ${hook.notice?.text}`)
    const asked = t.calls.getRun
    await t.tick(30000)
    assert.equal(t.calls.getRun, asked, 'polling stopped')
    await t.unmount()
  })

  for (const status of ['failed', 'skipped']) {
    it(`a ${status} run ends the watch and leaves the explaining to the progress panel: no second message`, async () => {
      const t = await setup({ polls: [run('running'), run(status, { error_message: 'The search provider refused the key.' })] })
      await startRun(t)
      await t.tick(2500)
      await t.tick(2500)
      const hook = t.latest.hook!
      assert.equal(hook.running, false)
      assert.equal(hook.activeRun?.status, status)
      assert.equal(hook.activeRun?.error_message, 'The search provider refused the key.')
      assert.equal(hook.notice, null, 'the progress panel says why, with Retry; a notice would say it twice')
      assert.equal(hook.refreshKey, 1, 'the lists are still asked to read again')
      const asked = t.calls.getRun
      await t.tick(30000)
      assert.equal(t.calls.getRun, asked, 'polling stopped')
      await t.unmount()
    })
  }

  it('stops watching a run that is still going after 40 minutes, and says the run goes on in the background', async () => {
    const t = await setup({ polls: [run('running')] })
    await startRun(t)
    for (let i = 0; i < 960; i += 1) await t.tick(2500)
    assert.equal(t.calls.getRun, 960)
    assert.equal(t.latest.hook!.running, true, '960 questions in about 40 minutes: still following')

    await t.tick(2500)
    const hook = t.latest.hook!
    assert.equal(t.calls.getRun, 961)
    assert.equal(hook.running, false)
    assert.deepEqual({ tone: hook.notice?.tone, text: hook.notice?.text }, { tone: 'warning', text: 'The run is still going in the background. Check back shortly.' })
    await t.tick(60000)
    assert.equal(t.calls.getRun, 961, 'it stopped asking')
    await t.unmount()
  })

  it('stops asking when the screen goes away', async () => {
    const t = await setup({ polls: [run('running')] })
    await startRun(t)
    await t.tick(2500)
    assert.equal(t.calls.getRun, 1)
    await t.unmount()
    await t.tick(60000)
    assert.equal(t.calls.getRun, 1, 'no question is asked after the screen is gone')
  })

  it('changing the product while a run is being followed stops asking about it, and a late answer for the old product changes nothing', async () => {
    let answer!: (row: Record<string, unknown>) => void
    const late = new Promise<Record<string, unknown>>((resolve) => { answer = resolve })
    const t = await setup({ polls: [late] })
    await startRun(t)
    await t.tick(2500)
    assert.equal(t.calls.getRun, 1, 'the question is on its way')

    await t.render([], 'q')
    await t.flush()
    assert.equal(t.latest.hook!.running, false, 'the other product starts from a clean state')
    assert.equal(t.latest.hook!.activeRun, null)
    assert.equal(t.latest.hook!.notice, null, 'and the old product\'s message (here "Research started.") is gone')

    await t.act(async () => { answer(run('running', { queries_run: 5 })) })
    await t.flush()
    assert.equal(t.latest.hook!.activeRun, null, 'the old product\'s answer was dropped')
    assert.equal(t.latest.hook!.running, false)
    await t.tick(60000)
    assert.equal(t.calls.getRun, 1, 'and nothing more is asked about the old run')
    await t.unmount()
  })
})
