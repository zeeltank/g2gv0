/**
 * Generate Signals: no run without an explicit valid READY product, the exact canonical key is what is sent, and nothing starts twice.
 * The service is a stub: no network, no provider.
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { decideGenerate, generateSignals, runGuardedGenerate, type GenerateProduct, type GenerateService, type GenerateStatus } from './signals-generate'
import type { LaravelContext } from './laravel-context'

const ctx = { token: 't', subInstituteId: '6', syear: '', userId: '1', organizationId: '', orgType: '', profileId: '1' } as LaravelContext

const products: GenerateProduct[] = [
  { key: 'scholarclone', label: 'ScholarClone', ready: true, missing: [] },
  { key: 'enterprise_brain', label: 'Enterprise Brain', ready: false, missing: ['No active ICP for Enterprise Brain'], next_step: 'Open Product Portfolio and fill in its Ideal Customer Profile.' },
  { key: 'g2g', label: 'G2G', ready: false, missing: ['No active ICP for G2G'], next_step: null },
]

function stub(statusFor: (p?: string) => GenerateStatus) {
  const calls = { status: [] as (string | undefined)[], run: [] as (string | undefined)[] }
  const service: GenerateService = {
    getStatus: async (_c, p) => { calls.status.push(p); return { data: statusFor(p) } },
    runResearch: async (_c, _params, p) => { calls.run.push(p); return { message: 'Research started.', data: { run_id: 77, run: { id: 77 } } } },
  }
  return { service, calls }
}

const okStatus = (p?: string): GenerateStatus => ({
  product: { key: p ?? '', label: p ?? '', ready: p === 'scholarclone', missing: p === 'scholarclone' ? [] : ['No active ICP'] },
  requirements: { search_configured: true, ai_configured: true },
  running: false,
})

describe('decideGenerate', () => {
  it('refuses an empty, All, or unknown selection', () => {
    for (const [choice, reason] of [[null, 'no_product'], [undefined, 'no_product'], ['', 'no_product'], ['all', 'all_products'], ['nonsense', 'unknown_product']] as const) {
      const d = decideGenerate(choice, products, false)
      assert.equal(d.ok, false)
      assert.equal(!d.ok && d.outcome.started === false && d.outcome.reason, reason)
    }
  })

  it('refuses while the product list has not loaded', () => {
    const d = decideGenerate('scholarclone', null, false)
    assert.equal(!d.ok && d.outcome.started === false && d.outcome.reason, 'unknown_product')
  })

  it('refuses a product that is not ready and passes on what is missing and the next step', () => {
    const d = decideGenerate('enterprise_brain', products, false)
    assert.equal(d.ok, false)
    if (!d.ok && !d.outcome.started) {
      assert.equal(d.outcome.reason, 'not_ready')
      assert.deepEqual(d.outcome.missing, ['No active ICP for Enterprise Brain'])
      assert.match(d.outcome.nextStep ?? '', /Ideal Customer Profile/)
    }
  })

  it('refuses a second submission while a run is going', () => {
    const d = decideGenerate('scholarclone', products, true)
    assert.equal(!d.ok && d.outcome.started === false && d.outcome.reason, 'running')
  })

  it('accepts a ready product', () => {
    const d = decideGenerate('scholarclone', products, false)
    assert.equal(d.ok, true)
  })
})

describe('generateSignals', () => {
  it('sends exactly the selected canonical key, once, after asking the backend', async () => {
    const { service, calls } = stub(okStatus)
    const out = await generateSignals({ context: ctx, choice: 'scholarclone', products, running: false, service })
    assert.equal(out.started, true)
    assert.deepEqual(calls.status, ['scholarclone'])
    assert.deepEqual(calls.run, ['scholarclone'])
    assert.equal(out.started && out.runId, 77)
  })

  it('makes no request at all for Enterprise Brain or G2G without a ready ICP', async () => {
    for (const key of ['enterprise_brain', 'g2g']) {
      const { service, calls } = stub(okStatus)
      const out = await generateSignals({ context: ctx, choice: key, products, running: false, service })
      assert.equal(out.started, false)
      assert.deepEqual(calls.status, [])
      assert.deepEqual(calls.run, [])
    }
  })

  it('makes no request for an empty, invalid or All selection', async () => {
    for (const choice of [null, '', 'all', 'ALL', 'scholar-clone']) {
      const { service, calls } = stub(okStatus)
      const out = await generateSignals({ context: ctx, choice, products, running: false, service })
      assert.equal(out.started, false, String(choice))
      assert.deepEqual([calls.status, calls.run], [[], []])
    }
  })

  it('does not trust a stale "ready" in the list: the backend\'s fresh status wins', async () => {
    const stale: GenerateProduct[] = [{ ...products[0] }]
    const { service, calls } = stub((p) => ({ ...okStatus(p), product: { key: 'scholarclone', label: 'ScholarClone', ready: false, missing: ['The ScholarClone ICP is invalid (regions: a list)'] } }))
    const out = await generateSignals({ context: ctx, choice: 'scholarclone', products: stale, running: false, service })
    assert.equal(out.started, false)
    assert.deepEqual(calls.run, [])
    assert.equal(!out.started && out.missing[0], 'The ScholarClone ICP is invalid (regions: a list)')
  })

  it('does not start when the backend says a run is already going, or when providers are missing', async () => {
    let s = stub((p) => ({ ...okStatus(p), running: true }))
    let out = await generateSignals({ context: ctx, choice: 'scholarclone', products, running: false, service: s.service })
    assert.equal(!out.started && out.reason, 'running')
    assert.deepEqual(s.calls.run, [])

    s = stub((p) => ({ ...okStatus(p), requirements: { search_configured: false, ai_configured: true } }))
    out = await generateSignals({ context: ctx, choice: 'scholarclone', products, running: false, service: s.service })
    assert.equal(!out.started && out.reason, 'providers')
    assert.deepEqual(s.calls.run, [])
  })

  it('refuses a status that is about a different product than the one selected', async () => {
    const s = stub(() => ({ ...okStatus('scholarclone'), product: { key: 'g2g', label: 'G2G', ready: true, missing: [] } }))
    const out = await generateSignals({ context: ctx, choice: 'scholarclone', products, running: false, service: s.service })
    assert.equal(out.started, false)
    assert.deepEqual(s.calls.run, [])
  })

  it('lets a transport error reach the screen instead of pretending a run started', async () => {
    const service: GenerateService = { getStatus: async () => { throw new Error('network down') }, runResearch: async () => { throw new Error('unreachable') } }
    await assert.rejects(generateSignals({ context: ctx, choice: 'scholarclone', products, running: false, service }), /network down/)
  })
})

describe('runGuardedGenerate (one click)', () => {
  const handlers = () => {
    const log: string[] = []

    return {
      log,
      on: {
        busy: () => log.push('busy'), begin: () => log.push('begin'),
        refused: (o: { reason: string }) => log.push('refused:' + o.reason), started: (o: { runId: number | null }) => log.push('started:' + o.runId),
        failed: (e: unknown) => log.push('failed:' + (e instanceof Error ? e.message : '?')),
      },
    }
  }
  const args = (service: GenerateService, choice = 'scholarclone') => ({ context: ctx, choice, products, running: false, service })

  it('gives an immediate response, then starts exactly one run for the exact product', async () => {
    const { service, calls } = stub(okStatus)
    const guard = { current: false }
    const h = handlers()
    await runGuardedGenerate(guard, args(service), h.on)
    assert.deepEqual(h.log, ['begin', 'started:77'])
    assert.deepEqual(calls.run, ['scholarclone'])
    assert.equal(guard.current, true, 'held while the started run is followed')
  })

  it('rapid repeated clicks send one request and the rest are told it is already starting', async () => {
    const { service, calls } = stub(okStatus)
    const guard = { current: false }
    const h = handlers()
    await Promise.all([1, 2, 3, 4].map(() => runGuardedGenerate(guard, args(service), h.on)))
    assert.equal(calls.run.length, 1)
    assert.deepEqual(h.log.filter((l) => l === 'busy').length, 3)
  })

  it('an invalid product is explained, sends nothing, and leaves the button usable', async () => {
    const { service, calls } = stub(okStatus)
    const guard = { current: false }
    const h = handlers()
    await runGuardedGenerate(guard, args(service, 'enterprise_brain'), h.on)
    assert.deepEqual(h.log, ['begin', 'refused:not_ready'])
    assert.equal(calls.run.length, 0)
    assert.equal(guard.current, false)
  })

  it('a refusal because a run is going releases the lock, so the click is never silently ignored later', async () => {
    const { service } = stub((p) => ({ ...okStatus(p), running: true }))
    const guard = { current: false }
    const h = handlers()
    await runGuardedGenerate(guard, args(service), h.on)
    assert.deepEqual(h.log, ['begin', 'refused:running'])
    assert.equal(guard.current, false)
  })

  it('a failed request shows its error, releases the lock, and a retry then works', async () => {
    let fail = true
    const { service } = stub(okStatus)
    const flaky: GenerateService = { ...service, runResearch: async (c, p, k) => { if (fail) throw new Error('Server error 500'); return service.runResearch(c, p, k) } }
    const guard = { current: false }
    const h = handlers()
    await runGuardedGenerate(guard, args(flaky), h.on)
    assert.deepEqual(h.log, ['begin', 'failed:Server error 500'])
    assert.equal(guard.current, false)

    fail = false
    await runGuardedGenerate(guard, args(flaky), h.on)
    assert.deepEqual(h.log.slice(2), ['begin', 'started:77'])
  })

  it('a status check that fails also releases the lock', async () => {
    const service: GenerateService = { getStatus: async () => { throw new Error('Network error') }, runResearch: async () => ({ message: '' }) }
    const guard = { current: false }
    const h = handlers()
    await runGuardedGenerate(guard, args(service), h.on)
    assert.equal(guard.current, false)
    assert.deepEqual(h.log, ['begin', 'failed:Network error'])
  })
})
