import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { JSDOM } from 'jsdom'

// The real SignalList rendered in jsdom, with the list request replaced by a script (no backend, no provider).
const dom = new JSDOM('<!doctype html><html><body></body></html>')
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })

const ctx = { organizationId: 1, subInstituteId: 1, userId: 1 } as never
const NO_REGIONS: never[] = []   // one array, as the screen's state is: a new array every render would reload every render
const page = (total: number) => ({ status: 1, data: [], summary: { immediate: 0, watchlist: 0 }, meta: { total, page: 1, per_page: 5, last_page: 1 } })

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })

  return { promise, resolve, reject }
}

async function setup() {
  const { opportunitiesService } = await import('@/services/signals/opportunities')
  const { SignalList } = await import('@/components/domain/signals/signal-list')
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')

  const requests: Array<{ q: Record<string, unknown>; d: ReturnType<typeof deferred<unknown>> }> = []
  ;(opportunitiesService as unknown as Record<string, unknown>).list = (_c: unknown, q: Record<string, unknown>) => {
    const d = deferred<unknown>()
    requests.push({ q, d })

    return d.promise
  }
  const totals: Array<number | null> = []
  const onTotal = (t: number | null) => { totals.push(t) }
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const render = (refreshKey: number, runId: number | null = null) => React.act(async () => {
    root.render(React.createElement(SignalList, { context: ctx, productKey: 'p', productLabel: 'P', runDate: null, allDates: true, refreshKey, onTotal, runId, regions: NO_REGIONS }))
  })
  const settle = (fn: () => void) => React.act(async () => { fn(); await Promise.resolve(); await Promise.resolve() })

  return { requests, totals, render, settle, text: () => host.textContent ?? '', unmount: () => React.act(async () => root.unmount()) }
}

describe('The signal list, rendered', () => {
  it('an answer that arrives after a newer request was made is dropped', async () => {
    const t = await setup()
    await t.render(0)
    await t.render(1)   // a second load starts before the first has answered
    assert.equal(t.requests.length, 2)

    await t.settle(() => t.requests[1].d.resolve(page(2)))   // the newer one answers first
    await t.settle(() => t.requests[0].d.resolve(page(9)))   // the older one answers late

    assert.deepEqual(t.totals, [2], 'only the newest answer was applied')
    await t.unmount()
  })

  it('a refresh that fails keeps the list that was loaded and says so beside it', async () => {
    const t = await setup()
    await t.render(0)
    await t.settle(() => t.requests[0].d.resolve(page(0)))
    assert.match(t.text(), /No saved P signals yet/)

    await t.render(1)
    await t.settle(() => t.requests[1].d.reject(new Error('Network down')))

    assert.match(t.text(), /No saved P signals yet/, 'the loaded list is still there')
    assert.match(t.text(), /Could not refresh the signals: Network down/, 'the failure is shown beside it')
    assert.doesNotMatch(t.text(), /Could not load the signals/, 'the list was not replaced by the full-page error')
    await t.unmount()
  })

  it('with nothing loaded yet a failure is the full error, as before', async () => {
    const t = await setup()
    await t.render(0)
    await t.settle(() => t.requests[0].d.reject(new Error('Network down')))

    assert.match(t.text(), /Could not load the signals/)
    await t.unmount()
  })

  it('asks for the finished run by its id', async () => {
    const t = await setup()
    await t.render(0, 41)

    assert.equal(t.requests[0].q.runId, 41)
    await t.unmount()
  })
})
