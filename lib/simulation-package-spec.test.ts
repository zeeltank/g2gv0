/**
 * Simulation Learning, the specification of a package completed from its files: the SHA-256 of each file, the filler that writes it into
 * `assets.models`, and the way the runtime's one-line problems are shown. Run without a browser.
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { strToU8 } from 'fflate'

import { combineIssues, fillAssetHashes, hashAssets, sha256Hex, splitIssue } from './simulation-package-spec'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)
const assets = [
  { id: 'eye', file: 'assets/eye.glb', kind: 'model' as const },
  { id: 'retina', file: 'assets/retina.png', kind: 'image' as const },
]
const hashes = { eye: A, retina: B }
const specWith = (models: unknown) => ({ schema: 'g2g.sim/1', id: 'x', title: 'X', assets: { models } })

describe('the SHA-256 of a file', () => {
  it('matches the published test vectors', async () => {
    assert.equal(await sha256Hex(strToU8('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    assert.equal(await sha256Hex(new Uint8Array(0)), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('is 64 lower-case hex digits and depends on every byte', async () => {
    const one = await sha256Hex(new Uint8Array([1, 2, 3]))
    const two = await sha256Hex(new Uint8Array([1, 2, 4]))
    assert.match(one, /^[a-f0-9]{64}$/)
    assert.notEqual(one, two)
  })

  it('hashes the assets one at a time by id and reports how far it has got', async () => {
    const seen: [number, number][] = []
    const order: string[] = []
    const result = await hashAssets(
      [
        { id: 'eye', bytes: new Uint8Array([1]) },
        { id: 'retina', bytes: new Uint8Array([2]) },
      ],
      (done, total) => seen.push([done, total]),
      async (bytes) => {
        order.push(String(bytes[0]))
        return `h${bytes[0]}`
      },
    )
    assert.deepEqual(result, { eye: 'h1', retina: 'h2' })
    assert.deepEqual(order, ['1', '2'])
    assert.deepEqual(seen, [[1, 2], [2, 2]])
  })
})

describe('writing the fingerprints into the specification', () => {
  it('fills a missing sha256 from the file of the same id, and a missing kind for an image only', () => {
    const original = specWith([{ id: 'eye', name: 'Eye' }, { id: 'retina' }])
    const { spec, problems, usedIds, unusedIds } = fillAssetHashes(original, assets, hashes)
    assert.deepEqual(problems, [])
    assert.deepEqual((spec.assets as { models: unknown[] }).models, [
      { id: 'eye', name: 'Eye', sha256: A },
      { id: 'retina', sha256: B, kind: 'image' },
    ])
    assert.deepEqual(usedIds, ['eye', 'retina'])
    assert.deepEqual(unusedIds, [])
  })

  it('leaves the original specification untouched', () => {
    const original = specWith([{ id: 'eye' }])
    fillAssetHashes(original, assets, hashes)
    assert.deepEqual(original.assets.models, [{ id: 'eye' }])
  })

  it('keeps a sha256 that is the file\'s, in any case, and writes it in lower case', () => {
    const { spec, problems } = fillAssetHashes(specWith([{ id: 'eye', sha256: A.toUpperCase() }]), assets, hashes)
    assert.deepEqual(problems, [])
    assert.equal((spec.assets as { models: { sha256: string }[] }).models[0].sha256, A)
  })

  it('a sha256 that is not the file\'s is a problem, said with both, and is left as written', () => {
    const wrong = 'c'.repeat(64)
    const { spec, problems } = fillAssetHashes(specWith([{ id: 'eye', sha256: wrong }]), assets, hashes)
    assert.equal(problems.length, 1)
    assert.equal(problems[0].path, 'assets.models.0.sha256')
    assert.match(problems[0].message, /does not match the file "assets\/eye\.glb"/)
    assert.match(problems[0].message, /says cccccccccc\.\.\. but the file is aaaaaaaaaa\.\.\./)
    assert.match(problems[0].message, /Delete the "sha256" line/)
    assert.equal((spec.assets as { models: { sha256: string }[] }).models[0].sha256, wrong)
  })

  it('a sha256 that is not even text is a mismatch too', () => {
    const { problems } = fillAssetHashes(specWith([{ id: 'eye', sha256: 12 }]), assets, hashes)
    assert.match(problems[0].message, /says 12 but the file is/)
  })

  it('a kind that disagrees with the manifest is a problem', () => {
    const { problems } = fillAssetHashes(specWith([{ id: 'eye', kind: 'image' }, { id: 'retina', kind: 'model' }]), assets, hashes)
    assert.deepEqual(problems.map((problem) => problem.path), ['assets.models.0.kind', 'assets.models.1.kind'])
    assert.match(problems[0].message, /is "image" but manifest\.json lists "assets\/eye\.glb" as a model/)
    assert.match(problems[1].message, /is "model" but manifest\.json lists "assets\/retina\.png" as an image/)
  })

  it('an entry with no package file and no sha256 is a problem; one with a sha256 is kept for the server to check', () => {
    const named = 'd'.repeat(64)
    const { spec, problems, usedIds } = fillAssetHashes(specWith([{ id: 'platform-eye', sha256: named }, { id: 'mystery' }]), assets, hashes)
    assert.equal(problems.length, 1)
    assert.equal(problems[0].path, 'assets.models.1.sha256')
    assert.match(problems[0].message, /"mystery" has no sha256 and is not in manifest\.json/)
    assert.equal((spec.assets as { models: { sha256?: string }[] }).models[0].sha256, named)
    assert.deepEqual(usedIds, [])
  })

  it('lists package files the specification never names, which are not used', () => {
    const { unusedIds, usedIds } = fillAssetHashes(specWith([{ id: 'eye' }]), assets, hashes)
    assert.deepEqual(unusedIds, ['retina'])
    assert.deepEqual(usedIds, ['eye'])
  })

  it('reports the order the specification lists the files in', () => {
    const { usedIds } = fillAssetHashes(specWith([{ id: 'retina' }, { id: 'eye' }]), assets, hashes)
    assert.deepEqual(usedIds, ['retina', 'eye'])
  })

  it('does not stumble on a specification with no assets, or assets of the wrong shape', () => {
    assert.deepEqual(fillAssetHashes({ schema: 'g2g.sim/1' }, assets, hashes).problems, [])
    assert.deepEqual(fillAssetHashes({ schema: 'g2g.sim/1' }, assets, hashes).unusedIds, ['eye', 'retina'])
    assert.equal(fillAssetHashes({ assets: 'many' }, assets, hashes).problems[0].path, 'assets')
    assert.equal(fillAssetHashes({ assets: { models: 'many' } }, assets, hashes).problems[0].path, 'assets.models')
    assert.equal(fillAssetHashes(specWith([7, null, 'eye']), assets, hashes).problems.length, 3)
  })
})

describe('the runtime\'s problems, as path and message', () => {
  it('splits "path: message" and leaves a line without a path whole', () => {
    assert.deepEqual(splitIssue('view3d.asset: "x" is not in assets.models'), { path: 'view3d.asset', message: '"x" is not in assets.models' })
    assert.deepEqual(splitIssue('assets.models.0.sha256: a sha256 is 64 lowercase hex characters'), { path: 'assets.models.0.sha256', message: 'a sha256 is 64 lowercase hex characters' })
    assert.deepEqual(splitIssue('schema: must be g2g.sim/1'), { path: 'schema', message: 'must be g2g.sim/1' })
    assert.deepEqual(splitIssue('flow.steps[2].goals: needs one'), { path: 'flow.steps[2].goals', message: 'needs one' })
    assert.deepEqual(splitIssue('Unexpected token in JSON: x'), { path: null, message: 'Unexpected token in JSON: x' })
    assert.deepEqual(splitIssue('  the model is too large  '), { path: null, message: 'the model is too large' })
  })

  it('puts ours first and drops a runtime line about a place we already reported', () => {
    const ours = [{ path: 'assets.models.0.sha256', message: 'does not match' }]
    const merged = combineIssues(ours, ['assets.models.0.sha256: Required', 'knobs.1.max: must be above min', 'a line with no path'])
    assert.deepEqual(merged, [
      { path: 'assets.models.0.sha256', message: 'does not match' },
      { path: 'knobs.1.max', message: 'must be above min' },
      { path: null, message: 'a line with no path' },
    ])
  })
})
