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
const products = [{
  key: 'p', label: 'P', ready: true, missing: [], next_step: null, offers: [],
  icp_models: { b2b: { ready: true, missing: [], configured: true }, b2c: { ready: false, missing: [], configured: false }, b2g: { ready: false, missing: [], configured: false } },
}] as never

const statusBody = (over: Record<string, unknown> = {}) => ({
  data: {
    running: false, busy_elsewhere: false, latest_run: null,
    product: { key: 'p', label: 'P', ready: true, missing: [], icp_models: {} },
    requirements: { search_configured: true, ai_configured: true },
    ...over,
  },
})

const run = (status: string, over: Record<string, unknown> = {}) => ({ id: 7, status, stage: 'searching', stage_message: 'x', ...over })

async function setup(script: { polls: Array<Record<string, unknown>> }) {
  const { opportunitiesService } = await import('@/services/signals/opportunities')
  const { useGenerateSignals } = await import('@/components/domain/signals/use-generate-signals')
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')

  let polls = 0
  const calls = { runResearch: 0, getRun: 0 }
  const svc = opportunitiesService as unknown as Record<string, unknown>
  svc.getStatus = async () => statusBody()
  svc.runResearch = async () => { calls.runResearch += 1; return { status: 1, message: 'Research started.', data: { run_id: 7, run: run('running') } } }
  svc.getRun = async () => { calls.getRun += 1; const r = script.polls[Math.min(polls, script.polls.length - 1)]; polls += 1; return { status: 1, data: r } }

  const latest: { hook: Hook | null } = { hook: null }
  function Harness({ regions }: { regions: { country: string; state?: string }[] }) {
    latest.hook = useGenerateSignals(ctx, 'p', products, null, regions as never)
    return null
  }
  const host = document.createElement('div')   // a fresh container per test
  document.body.appendChild(host)
  const root = createRoot(host)
  const render = (regions: { country: string; state?: string }[]) => React.act(async () => { root.render(React.createElement(Harness, { regions })) })
  const flush = () => React.act(async () => { await Promise.resolve(); await Promise.resolve() })
  const tick = (ms: number) => React.act(async () => { mock.timers.tick(ms); await Promise.resolve(); await Promise.resolve() })

  return { latest, render, flush, tick, calls, unmount: () => React.act(async () => root.unmount()), act: React.act }
}

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
})
