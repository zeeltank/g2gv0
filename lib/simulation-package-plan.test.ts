/**
 * Simulation Learning, from a read package to a saved draft: the upload plan, the one-by-one uploader against a MOCK service, the limits
 * reader, where a save goes, and the two service calls themselves (against a stubbed fetch). Run without a browser.
 */
import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'

import type { PackageAsset } from './simulation-package'
import {
  DEFAULT_LIMITS,
  describeUploadError,
  describeUse,
  editProblem,
  planUploads,
  readLimits,
  runUploads,
  saveTarget,
  type StepStatus,
  type UploadStep,
  type UploadedFile,
} from './simulation-package-plan'
import { fetchSimulationLimits, uploadSimulationAsset } from '../services/lms/simulations'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)
const C = 'c'.repeat(64)
const MB = 1024 * 1024

const asset = (over: Partial<PackageAsset> = {}): PackageAsset => ({
  id: 'eye',
  file: 'assets/eye.glb',
  kind: 'model',
  name: 'Eye',
  licence: 'CC0',
  credit: 'A. Maker',
  source: '',
  size: 1000,
  bytes: new Uint8Array(4),
  ...over,
})
const retina = () => asset({ id: 'retina', file: 'assets/retina.png', kind: 'image', name: 'Retina', size: 500 })
const hashes = { eye: A, retina: B, lens: C }
const ready = { attested: true, edits: {} as Record<string, never> }

/* ------------------------------------------------------------------------------------------------------------------------ the plan */

describe('what has to be uploaded', () => {
  it('plans the files the specification uses, in the order it lists them, with the licence and credit', () => {
    const plan = planUploads({ assets: [asset(), retina()], usedIds: ['retina', 'eye'], hashes, ...ready })
    assert.deepEqual(plan.blockers, [])
    assert.deepEqual(plan.steps.map((step) => [step.id, step.filename, step.kind, step.sha256, step.size]), [
      ['retina', 'retina.png', 'image', B, 500],
      ['eye', 'eye.glb', 'model', A, 1000],
    ])
    assert.deepEqual(plan.steps[1].meta, { licence: 'CC0', credit: 'A. Maker', name: 'Eye', attested: true })
    assert.equal(plan.bytes, 1500)
  })

  it('uses what the customer typed instead of the manifest, trims it, and sends a source only when there is one', () => {
    const plan = planUploads({
      assets: [asset({ licence: '' })],
      usedIds: ['eye'],
      hashes,
      attested: true,
      edits: { eye: { licence: '  CC BY 4.0 ', credit: ' Jo ', source: ' https://example.org/eye ' } },
    })
    assert.deepEqual(plan.blockers, [])
    assert.deepEqual(plan.steps[0].meta, { licence: 'CC BY 4.0', credit: 'Jo', name: 'Eye', source: 'https://example.org/eye', attested: true })
  })

  it('does not upload a file the specification never names, and says so', () => {
    const plan = planUploads({ assets: [asset(), retina()], usedIds: ['eye'], hashes, ...ready })
    assert.deepEqual(plan.steps.map((step) => step.id), ['eye'])
    assert.match(plan.notes[0], /"assets\/retina\.png" is in the package but not used by the simulation, so it will not be uploaded/)
    const many = planUploads({ assets: [asset(), retina(), asset({ id: 'lens', file: 'assets/lens.glb' })], usedIds: [], hashes, ...ready })
    assert.match(many.notes[0], /3 files are in the package but not used/)
  })

  it('uploads one file once even when two ids are the same file', () => {
    const plan = planUploads({ assets: [asset(), asset({ id: 'eye2' })], usedIds: ['eye', 'eye2'], hashes: { eye: A, eye2: A }, ...ready })
    assert.deepEqual(plan.steps.map((step) => step.id), ['eye'])
  })

  it('blocks until the licence and credit are given, the source is a safe web address, and the box is ticked', () => {
    const none = planUploads({ assets: [asset({ licence: '', credit: '' })], usedIds: ['eye'], hashes, attested: false, edits: {} })
    assert.equal(none.blockers.length, 3)
    assert.match(none.blockers[0], /assets\/eye\.glb: say which licence it is used under/)
    assert.match(none.blockers[1], /say who made it/)
    assert.match(none.blockers[2], /Tick the box/)
    const badSource = planUploads({ assets: [asset()], usedIds: ['eye'], hashes, attested: true, edits: { eye: { licence: 'CC0', credit: 'x', source: 'javascript:alert(1)' } } })
    assert.match(badSource.blockers[0], /source must be a web address that starts with https:\/\//)
    for (const source of ['http://example.org/x', 'https://user:pass@example.org/x', 'ftp://example.org', 'example.org']) {
      assert.match(editProblem({ licence: 'CC0', credit: 'x', source }, 'f') ?? '', /https/, source)
    }
    assert.equal(editProblem({ licence: 'CC0', credit: 'x', source: '' }, 'f'), null)
  })

  it('holds the texts to the length the server holds them to', () => {
    assert.match(editProblem({ licence: 'x'.repeat(81), credit: 'c', source: '' }, 'f') ?? '', /licence is longer than 80/)
    assert.match(editProblem({ licence: 'l', credit: 'c'.repeat(301), source: '' }, 'f') ?? '', /credit is longer than 300/)
    assert.match(editProblem({ licence: 'l', credit: 'c', source: `https://example.org/${'x'.repeat(500)}` }, 'f') ?? '', /https/)
  })

  it('blocks a file the server would never receive, naming both sizes, and lets the others through', () => {
    const big = asset({ id: 'big', file: 'assets/big.glb', size: 3 * MB })
    const plan = planUploads({ assets: [asset(), big], usedIds: ['eye', 'big'], hashes: { eye: A, big: B }, ...ready, serverUploadBytes: 2 * MB })
    assert.equal(plan.blockers.length, 1)
    assert.match(plan.blockers[0], /assets\/big\.glb is 3\.0 MB, but this server accepts uploads of at most 2\.0 MB/)
    assert.match(plan.blockers[0], /ask your administrator to raise the server's upload limit/)
    assert.deepEqual(planUploads({ assets: [big], usedIds: ['big'], hashes: { big: B }, ...ready, serverUploadBytes: null }).blockers, [])
    assert.deepEqual(planUploads({ assets: [big], usedIds: ['big'], hashes: { big: B }, ...ready, serverUploadBytes: 3 * MB }).blockers, [])
  })

  it('needs no ticked box when nothing is uploaded', () => {
    const plan = planUploads({ assets: [], usedIds: [], hashes: {}, attested: false, edits: {} })
    assert.deepEqual(plan, { steps: [], blockers: [], notes: [], bytes: 0 })
  })
})

/* ---------------------------------------------------------------------------------------------------------------------- the uploader */

/** A mock of the upload route: records the order, and fails or throttles on request. */
function mockService(behave: (step: UploadStep, call: number) => UploadedFile | Error | Promise<UploadedFile | Error> = (step) => ({ sha256: step.sha256, created: true })) {
  const calls: string[] = []
  let running = 0
  let mostAtOnce = 0
  const counts = new Map<string, number>()
  return {
    calls,
    get mostAtOnce() {
      return mostAtOnce
    },
    upload: async (step: UploadStep): Promise<UploadedFile> => {
      running += 1
      mostAtOnce = Math.max(mostAtOnce, running)
      calls.push(step.id)
      const call = (counts.get(step.id) ?? 0) + 1
      counts.set(step.id, call)
      await new Promise((resolve) => setImmediate(resolve))
      running -= 1
      const outcome = await behave(step, call)
      if (outcome instanceof Error) throw outcome
      return outcome
    },
  }
}

const httpError = (status: number, message = 'The server said no.', errors?: Record<string, string[]>) => Object.assign(new Error(message), { status, errors })

function plan3(): UploadStep[] {
  return planUploads({ assets: [asset(), retina(), asset({ id: 'lens', file: 'assets/lens.glb' })], usedIds: ['eye', 'retina', 'lens'], hashes, ...ready }).steps
}

function recorder() {
  const log: [string, StepStatus][] = []
  const last: Record<string, StepStatus> = {}
  return {
    log,
    last,
    onStatus: (id: string, status: StepStatus) => {
      log.push([id, status])
      last[id] = status
    },
  }
}

describe('uploading the files one by one', () => {
  it('sends them in order, one at a time, with progress for each', async () => {
    const service = mockService()
    const seen = recorder()
    const outcome = await runUploads({ steps: plan3(), upload: service.upload, onStatus: seen.onStatus })
    assert.deepEqual(outcome, { ok: true, failed: 0, finished: true })
    assert.deepEqual(service.calls, ['eye', 'retina', 'lens'])
    assert.equal(service.mostAtOnce, 1, 'never two at once')
    assert.deepEqual(seen.last, { eye: { state: 'done', created: true }, retina: { state: 'done', created: true }, lens: { state: 'done', created: true } })
    // every file is "waiting" before the first upload starts, then goes uploading -> done
    assert.deepEqual(seen.log.slice(0, 3).map(([, status]) => status.state), ['waiting', 'waiting', 'waiting'])
    assert.deepEqual(seen.log.filter(([id]) => id === 'retina').map(([, status]) => status.state), ['waiting', 'uploading', 'done'])
  })

  it('says "already stored" for a file the server already held', async () => {
    const service = mockService((step) => ({ sha256: step.sha256, created: false }))
    const seen = recorder()
    await runUploads({ steps: plan3().slice(0, 1), upload: service.upload, onStatus: seen.onStatus })
    assert.deepEqual(seen.last.eye, { state: 'done', created: false })
  })

  it('a file that fails is reported with the server\'s words and does not stop the others', async () => {
    const service = mockService((step) =>
      step.id === 'retina' ? httpError(422, 'The file is not valid.', { file: ['The image is 5000 x 4000; the most is 4096 x 4096.'] }) : { sha256: step.sha256, created: true },
    )
    const seen = recorder()
    const outcome = await runUploads({ steps: plan3(), upload: service.upload, onStatus: seen.onStatus })
    assert.deepEqual(outcome, { ok: false, failed: 1, finished: true })
    assert.deepEqual(service.calls, ['eye', 'retina', 'lens'])
    assert.deepEqual(seen.last.retina, { state: 'failed', message: 'The file is not valid. The image is 5000 x 4000; the most is 4096 x 4096.' })
    assert.equal(seen.last.lens.state, 'done')
  })

  it('trying again sends only the files that did not go through', async () => {
    const steps = plan3()
    let fail = true
    const service = mockService((step) => (step.id === 'lens' && fail ? httpError(500) : { sha256: step.sha256, created: true }))
    const seen = recorder()
    const first = await runUploads({ steps, upload: service.upload, onStatus: seen.onStatus })
    assert.equal(first.ok, false)
    fail = false
    const again = await runUploads({ steps, upload: service.upload, onStatus: seen.onStatus, previous: { ...seen.last } })
    assert.equal(again.ok, true)
    assert.deepEqual(service.calls, ['eye', 'retina', 'lens', 'lens'])
    assert.equal(seen.last.lens.state, 'done')
  })

  it('waits out "slow down" (429) and then goes on, without calling it a failure', async () => {
    const slept: number[] = []
    const service = mockService((step, call) => (step.id === 'eye' && call < 3 ? httpError(429, 'Too many uploads.') : { sha256: step.sha256, created: true }))
    const seen = recorder()
    const outcome = await runUploads({ steps: plan3().slice(0, 1), upload: service.upload, onStatus: seen.onStatus, sleep: async (ms) => void slept.push(ms), throttleMs: 15_000 })
    assert.equal(outcome.ok, true)
    assert.deepEqual(slept, [15_000, 15_000])
    assert.deepEqual(service.calls, ['eye', 'eye', 'eye'])
    assert.ok(seen.log.some(([, status]) => status.state === 'slow' && status.seconds === 15))
  })

  it('gives up on a server that keeps saying "slow down" after the retries, and reports it', async () => {
    const service = mockService(() => httpError(429, 'Too many uploads.'))
    const seen = recorder()
    const outcome = await runUploads({ steps: plan3().slice(0, 1), upload: service.upload, onStatus: seen.onStatus, sleep: async () => undefined, retries: 2 })
    assert.equal(outcome.ok, false)
    assert.equal(service.calls.length, 3)
    assert.deepEqual(seen.last.eye, { state: 'failed', message: 'Too many uploads.' })
  })

  it('refuses an answer about a different file than the one sent', async () => {
    const service = mockService(() => ({ sha256: C, created: true }))
    const seen = recorder()
    const outcome = await runUploads({ steps: plan3().slice(0, 1), upload: service.upload, onStatus: seen.onStatus })
    assert.equal(outcome.ok, false)
    assert.match((seen.last.eye as { message: string }).message, /different fingerprint than "assets\/eye\.glb"/)
  })

  it('stops after the file in flight when it is cancelled', async () => {
    const service = mockService()
    let cancelled = false
    const outcome = await runUploads({
      steps: plan3(),
      upload: async (step) => {
        const answer = await service.upload(step)
        cancelled = true
        return answer
      },
      onStatus: () => undefined,
      isCancelled: () => cancelled,
    })
    assert.deepEqual(outcome, { ok: false, failed: 0, finished: false })
    assert.deepEqual(service.calls, ['eye'])
  })

  it('has nothing to do for an empty plan', async () => {
    assert.deepEqual(await runUploads({ steps: [], upload: async () => ({ sha256: A, created: true }), onStatus: () => undefined }), { ok: true, failed: 0, finished: true })
  })
})

describe('what a failure is called', () => {
  it('uses the server\'s message and the first reasons it gave, once each', () => {
    assert.equal(describeUploadError(httpError(422, 'Invalid.', { file: ['Too big.', 'Too big.'], licence: ['Required.'] }), 'f'), 'Invalid. Too big. Required.')
    assert.equal(describeUploadError(httpError(422, 'Invalid: Too big.', { file: ['Too big.'] }), 'f'), 'Invalid: Too big.')
    assert.equal(describeUploadError(httpError(500, ''), 'f'), 'The upload did not go through.')
    assert.equal(describeUploadError('boom', 'f'), 'The upload did not go through.')
  })

  it('has its own words for too large, signed out and not allowed', () => {
    assert.match(describeUploadError(httpError(413), 'assets/eye.glb'), /assets\/eye\.glb is larger than the server accepts/)
    assert.match(describeUploadError(httpError(401), 'f'), /session has expired/)
    assert.match(describeUploadError(httpError(403), 'f'), /do not have the right to upload/)
  })
})

/* ------------------------------------------------------------------------------------------------------------------------- limits */

describe('the limits', () => {
  it('reads the figures wherever the server most likely keeps them, with or without the envelope', () => {
    const data = {
      spec: { max_bytes: 900_000 },
      asset: { model_max_bytes: 20 * MB, image_max_bytes: MB, max_per_simulation: 30 },
      quota: { files: 100, bytes: 300 * MB },
      use: { files: 12, bytes: 41 * MB },
      throttle: { per_minute: 20 },
    }
    const expected = { specBytes: 900_000, modelBytes: 20 * MB, imageBytes: MB, assetsPerSimulation: 30, quotaFiles: 100, quotaBytes: 300 * MB, usedFiles: 12, usedBytes: 41 * MB, uploadsPerMinute: 20, serverUploadBytes: null, fromServer: true }
    assert.deepEqual(readLimits({ status: true, data }), expected)
    assert.deepEqual(readLimits(data), expected)
  })

  it('reads the shape the backend actually sends (LmsSimulationController::limits), including what the server can take in one upload', () => {
    const limits = readLimits({
      status: true,
      data: {
        schemas: ['g2g.sim/1', 'g2g.sim/2'],
        engines: ['formula', 'rigid', 'des'],
        spec: { bytes: 1_000_000, jsonDepth: 64, assets: 40, steps: 24 },
        asset: { kinds: ['model', 'image'], modelBytes: 25 * MB, imageBytes: 2 * MB, triangles: 300_000 },
        quota: { files: 200, bytes: 500 * MB, uploadsPerMinute: 30 },
        use: { files: 7, bytes: 3 * MB },
        server: { uploadMaxBytes: 8 * MB },
      },
    })
    assert.deepEqual(limits, {
      specBytes: 1_000_000,
      modelBytes: 25 * MB,
      imageBytes: 2 * MB,
      assetsPerSimulation: 40,
      quotaFiles: 200,
      quotaBytes: 500 * MB,
      usedFiles: 7,
      usedBytes: 3 * MB,
      uploadsPerMinute: 30,
      serverUploadBytes: 8 * MB,
      fromServer: true,
    })
    // a server with no upload ceiling says null
    assert.equal(readLimits({ data: { quota: { files: 5 }, server: { uploadMaxBytes: null } } }).serverUploadBytes, null)
  })

  it('reads numbers sent as text, and other spellings', () => {
    const limits = readLimits({ data: { quota: { max_files: '150', max_bytes: String(400 * MB) }, usage: { files: '9', bytes: '1000' } } })
    assert.equal(limits.quotaFiles, 150)
    assert.equal(limits.quotaBytes, 400 * MB)
    assert.equal(limits.usedFiles, 9)
    assert.equal(limits.usedBytes, 1000)
    assert.equal(limits.fromServer, true)
  })

  it('falls back to the contract\'s own figures for anything missing or nonsense, and says it did', () => {
    for (const payload of [null, undefined, 'x', 7, [], {}, { data: {} }, { data: { quota: { files: -1, bytes: 'many' } } }]) {
      assert.deepEqual(readLimits(payload), DEFAULT_LIMITS, JSON.stringify(payload))
    }
    assert.equal(DEFAULT_LIMITS.fromServer, false)
    assert.equal(DEFAULT_LIMITS.quotaFiles, 200)
    assert.equal(DEFAULT_LIMITS.quotaBytes, 500 * MB)
  })

  it('says how much is used, and warns (never blocks) when a package could go past a limit', () => {
    const limits = { ...DEFAULT_LIMITS, usedFiles: 195, usedBytes: 100 * MB, fromServer: true }
    assert.equal(describeUse(limits, null).use, 'Your organisation has used 195 of 200 files and 100 MB of 500 MB.')
    assert.equal(describeUse(limits, null).warning, null)
    const plan = { steps: new Array(10).fill(null) as unknown as UploadStep[], bytes: 3 * MB }
    assert.match(describeUse(limits, plan).warning ?? '', /Uploading all 10 files \(3\.0 MB\) could take you past your organisation's limit/)
    assert.equal(describeUse({ ...limits, usedFiles: 10 }, plan).warning, null)
    assert.match(describeUse({ ...limits, usedFiles: null, usedBytes: null }, null).use ?? '', /may keep up to 200 files and 500 MB/)
  })
})

/* ------------------------------------------------------------------------------------------------------------------------ saving */

describe('where a save goes', () => {
  const existing = [
    { id: 1, slug: 'pendulum-lab', title: 'Pendulum', status: 'draft', scope: 'tenant' },
    { id: 2, slug: 'eye', title: 'Eye', status: 'published', scope: 'tenant' },
    { id: 3, slug: 'gas', title: 'Gas', status: 'archived', scope: 'tenant' },
    { id: 4, slug: 'platform-one', title: 'Platform one', status: 'published', scope: 'platform' },
  ]

  it('a new id is a new draft', () => {
    assert.deepEqual(saveTarget('brand-new', existing), { kind: 'new' })
    assert.deepEqual(saveTarget(undefined, existing), { kind: 'new' })
    assert.deepEqual(saveTarget(42, existing), { kind: 'new' })
  })

  it('the id of a draft the organisation already has is a new version of that draft', () => {
    assert.deepEqual(saveTarget('pendulum-lab', existing), { kind: 'new-version', id: 1, title: 'Pendulum' })
  })

  it('the id of a published or archived one is refused, with what to do', () => {
    for (const slug of ['eye', 'gas']) {
      const target = saveTarget(slug, existing)
      assert.equal(target.kind, 'refused')
      assert.match(target.kind === 'refused' ? target.message : '', new RegExp(`Change the "id" in simulation\\.json`))
    }
    assert.match(saveTarget('eye', existing).kind === 'refused' ? (saveTarget('eye', existing) as { message: string }).message : '', /published simulation called "Eye"/)
  })

  it('a platform simulation with the same id is no clash', () => {
    assert.deepEqual(saveTarget('platform-one', existing), { kind: 'new' })
  })
})

/* ---------------------------------------------------------------------------------------------------------------- the service calls */

describe('the two service calls', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  type Call = { url: URL; init: RequestInit; headers: Headers }
  const stub = (respond: () => Response): Call[] => {
    const calls: Call[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost'), init: init ?? {}, headers: new Headers(init?.headers) })
      return respond()
    }) as typeof fetch
    return calls
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('uploads one file as multipart to /lms/simulations/assets with its licence, credit, source, name and the ticked box', async () => {
    const calls = stub(() => json({ status: true, data: { sha256: A, kind: 'image', mime: 'image/png', bytes: 4, created: true } }, 201))
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'retina.png', { type: 'image/png' })
    const stored = await uploadSimulationAsset(file, { licence: 'CC BY 4.0', credit: 'Jo', name: 'Retina', source: 'https://example.org/r', attested: true })
    assert.deepEqual(stored, { sha256: A, kind: 'image', mime: 'image/png', bytes: 4, created: true })
    assert.equal(calls.length, 1)
    assert.ok(calls[0].url.pathname.endsWith('/lms/simulations/assets'), calls[0].url.pathname)
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].headers.get('accept'), 'application/json')
    assert.equal(calls[0].headers.get('content-type'), null, 'the browser sets the multipart boundary itself')
    const form = calls[0].init.body as FormData
    assert.ok(form instanceof FormData)
    assert.equal(form.get('licence'), 'CC BY 4.0')
    assert.equal(form.get('credit'), 'Jo')
    assert.equal(form.get('name'), 'Retina')
    assert.equal(form.get('source'), 'https://example.org/r')
    assert.equal(form.get('attested'), '1')
    const sent = form.get('file') as File
    assert.equal(sent.name, 'retina.png')
    assert.equal(sent.size, 4)
  })

  it('leaves out the fields it was not given, and reads an answer without the envelope', async () => {
    const calls = stub(() => json({ sha256: B, kind: 'model', mime: 'model/gltf-binary', bytes: 9, created: false }))
    const stored = await uploadSimulationAsset(new File([new Uint8Array(9)], 'eye.glb'), { licence: 'CC0', credit: 'x', name: '' })
    assert.deepEqual(stored, { sha256: B, kind: 'model', mime: 'model/gltf-binary', bytes: 9, created: false })
    const form = calls[0].init.body as FormData
    assert.equal(form.has('source'), false)
    assert.equal(form.has('name'), false)
    assert.equal(form.has('attested'), false)
  })

  it('fails with the server\'s message and reasons, and refuses an answer that names no file', async () => {
    stub(() => json({ message: 'The file is not valid.', errors: { file: ['It is not a glTF model.'] } }, 422))
    await assert.rejects(uploadSimulationAsset(new File([new Uint8Array(1)], 'x.glb'), { licence: 'CC0', credit: 'x', name: 'x' }), (error: unknown) => {
      const failure = error as { status: number; message: string; errors: Record<string, string[]> }
      return failure.status === 422 && failure.message === 'The file is not valid.' && failure.errors.file[0] === 'It is not a glTF model.'
    })
    stub(() => json({ status: true, data: { kind: 'model' } }))
    await assert.rejects(uploadSimulationAsset(new File([new Uint8Array(1)], 'x.glb'), { licence: 'CC0', credit: 'x', name: 'x' }), /did not say which file it stored/)
  })

  it('reads the limits from /lms/simulations/limits', async () => {
    const calls = stub(() => json({ status: true, data: { quota: { files: 50, bytes: 100 * MB }, use: { files: 4, bytes: MB } } }))
    const limits = await fetchSimulationLimits()
    assert.ok(calls[0].url.pathname.endsWith('/lms/simulations/limits'), calls[0].url.pathname)
    assert.equal(limits.quotaFiles, 50)
    assert.equal(limits.usedFiles, 4)
    assert.equal(limits.fromServer, true)
  })
})
