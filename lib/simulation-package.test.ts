/**
 * Simulation Learning, the package reader: a zip is hostile input, so each way it can be hostile has a test. Run without a browser.
 *
 *  - the happy path (manifest, simulation, a model and an image) and the hidden files Mac and Windows add;
 *  - refused before anything is unpacked: not a zip, 61 and 200 entries, "../" and absolute and backslash paths, hidden or direction-changing
 *    characters, an archive by name, a duplicate, a password, an unknown packing method, ZIP64, more than 100 MB declared, a model over 25 MB;
 *  - refused while unpacking: an entry that expands past the size the zip declares for it (a lying contents table), a nested zip by its bytes;
 *  - refused by the manifest rules: no manifest, files inside a folder, a file the manifest does not name, a named file that is not there,
 *    a bad schema/id/kind, a model that is really an image, a cut-short model;
 *  - the sentences a customer reads.
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { strToU8, zipSync, type Zippable } from 'fflate'

import {
  PACKAGE_LIMITS,
  extensionOf,
  formatBytes,
  jsonDepth,
  pathProblem,
  readManifest,
  readPackage,
  sniffAsset,
  type PackageProblem,
  type ReadResult,
} from './simulation-package'

/* ------------------------------------------------------------------------------------------------------------------------ fixtures */

const MB = 1024 * 1024

/** A binary glTF 2 file of the given length, as far as the reader looks: header, version 2, the file's own length. */
function glb(length = 64): Uint8Array {
  const bytes = new Uint8Array(length)
  bytes.set([0x67, 0x6c, 0x54, 0x46])
  new DataView(bytes.buffer).setUint32(4, 2, true)
  new DataView(bytes.buffer).setUint32(8, length, true)
  return bytes
}

const png = (length = 40): Uint8Array => {
  const bytes = new Uint8Array(length)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return bytes
}

const asset = (over: Record<string, unknown> = {}) => ({ id: 'eye', file: 'assets/eye.glb', kind: 'model', name: 'Eye', licence: 'CC0', credit: 'A. Maker', source: 'https://example.org/eye', ...over })
const manifestText = (assets: unknown[] = [asset()], over: Record<string, unknown> = {}) => JSON.stringify({ schema: 'g2g.sim.package/2', spec: 'simulation.json', assets, ...over })
const specText = (over: Record<string, unknown> = {}) => JSON.stringify({ schema: 'g2g.sim/1', id: 'pendulum-lab', title: 'Pendulum', assets: { models: [{ id: 'eye' }] }, ...over })

type Files = Record<string, Uint8Array | string>
const zip = (files: Files): Uint8Array => zipSync(Object.fromEntries(Object.entries(files).map(([name, data]) => [name, typeof data === 'string' ? strToU8(data) : data])) as Zippable)
const stored = (files: Files): Uint8Array =>
  zipSync(Object.fromEntries(Object.entries(files).map(([name, data]) => [name, [typeof data === 'string' ? strToU8(data) : data, { level: 0 }]])) as Zippable)

/** A normal, valid package. */
const goodFiles = (): Files => ({ 'manifest.json': manifestText(), 'simulation.json': specText(), 'assets/eye.glb': glb() })

/** The offset of the central directory record for `name`, so a test can tell the truth about it in a lie. */
function recordOf(bytes: Uint8Array, name: string): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const wanted = strToU8(name)
  for (let at = 0; at + 46 <= bytes.length; at++) {
    if (view.getUint32(at, true) !== 0x02014b50) continue
    const length = view.getUint16(at + 28, true)
    if (length === wanted.length && wanted.every((byte, index) => bytes[at + 46 + index] === byte)) return at
  }
  throw new Error(`no central directory record for ${name}`)
}

function patch(bytes: Uint8Array, name: string, change: { size?: number; flags?: number; method?: number }): Uint8Array {
  const copy = bytes.slice()
  const view = new DataView(copy.buffer)
  const at = recordOf(copy, name)
  if (change.size !== undefined) view.setUint32(at + 24, change.size, true)
  if (change.flags !== undefined) view.setUint16(at + 8, change.flags, true)
  if (change.method !== undefined) view.setUint16(at + 10, change.method, true)
  return copy
}

const read = (bytes: Uint8Array): Promise<ReadResult> => readPackage(bytes)

async function refused(bytes: Uint8Array): Promise<PackageProblem[]> {
  const result = await read(bytes)
  assert.equal(result.ok, false, 'expected the package to be refused')
  return result.ok ? [] : result.problems
}

const codes = (problems: PackageProblem[]) => problems.map((problem) => problem.code)
const says = (problems: PackageProblem[], pattern: RegExp) => problems.some((problem) => pattern.test(problem.message))

/* ---------------------------------------------------------------------------------------------------------------------- happy path */

describe('reading a good package', () => {
  it('returns the specification, the files with their bytes, and the facts about the zip', async () => {
    const result = await read(zip({ ...goodFiles(), 'README.md': '# Pendulum\nChange the id first.' }))
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.package.spec.id, 'pendulum-lab')
    assert.equal(result.package.hasReadme, true)
    assert.equal(result.package.assets.length, 1)
    const [eye] = result.package.assets
    assert.deepEqual(
      { id: eye.id, file: eye.file, kind: eye.kind, name: eye.name, licence: eye.licence, credit: eye.credit, source: eye.source, size: eye.size },
      { id: 'eye', file: 'assets/eye.glb', kind: 'model', name: 'Eye', licence: 'CC0', credit: 'A. Maker', source: 'https://example.org/eye', size: 64 },
    )
    assert.deepEqual([...eye.bytes], [...glb()])
    assert.equal(result.package.entryCount, 4)
  })

  it('reads a package with no models or images, and one packed without compression', async () => {
    const none = await read(zip({ 'manifest.json': manifestText([]), 'simulation.json': specText({ assets: undefined }) }))
    assert.equal(none.ok && none.package.assets.length, 0)
    const plain = await read(stored(goodFiles()))
    assert.equal(plain.ok, true)
  })

  it('reads a model and an image together, and a manifest saved with a byte-order mark', async () => {
    const files: Files = {
      'manifest.json': '\ufeff' + manifestText([asset(), asset({ id: 'retina', file: 'assets/retina.png', kind: 'image', name: 'Retina' })]),
      'simulation.json': specText(),
      'assets/eye.glb': glb(),
      'assets/retina.png': png(),
    }
    const result = await read(zip(files))
    assert.equal(result.ok, true)
    if (result.ok) assert.deepEqual(result.package.assets.map((a) => [a.id, a.kind]), [['eye', 'model'], ['retina', 'image']])
  })

  it('skips, reports and never reads the hidden files Mac and Windows add', async () => {
    const result = await read(
      zip({ ...goodFiles(), '__MACOSX/._manifest.json': 'x', 'assets/.DS_Store': 'x', 'Thumbs.db': 'x', 'assets/._eye.glb': 'not a model' }),
    )
    assert.equal(result.ok, true)
    if (result.ok) assert.deepEqual([...result.package.ignored].sort(), ['Thumbs.db', '__MACOSX/._manifest.json', 'assets/.DS_Store', 'assets/._eye.glb'].sort())
  })

  it('allows folder entries, which count towards the 60', async () => {
    const result = await read(zip({ ...goodFiles(), 'assets/': new Uint8Array(0) }))
    assert.equal(result.ok, true)
  })
})

/* -------------------------------------------------------------------------------------------------- refused before anything is unpacked */

describe('hostile archives: refused from the table of contents alone', () => {
  it('is not a zip: random bytes, nothing, a few bytes, a zip cut short', async () => {
    for (const bytes of [new Uint8Array(2000).fill(7), new Uint8Array(0), new Uint8Array([80, 75, 3, 4]), zip(goodFiles()).slice(0, -10)]) {
      const problems = await refused(bytes)
      assert.deepEqual(codes(problems), ['not-a-zip'])
      assert.match(problems[0].message, /not a zip/i)
    }
  })

  it('zip-slip: "../" in a path is named and refused, however it is dressed', async () => {
    for (const name of ['../evil.txt', 'assets/../../evil.txt', 'assets/../manifest.json', '..']) {
      const problems = await refused(zip({ ...goodFiles(), [name]: 'x' }))
      assert.ok(codes(problems).includes('unsafe-path'), name)
      assert.ok(says(problems, /"\.\."|\.\./), name)
    }
  })

  it('refuses absolute paths, drive letters, backslashes, "//", "." folders and forbidden characters', async () => {
    for (const name of ['/etc/passwd', 'C:/Windows/x.txt', 'assets\\eye2.glb', 'assets//eye2.glb', './eye2.glb', 'assets/./eye2.glb', 'assets/a:b.glb', 'assets/what?.glb']) {
      const problems = await refused(zip({ ...goodFiles(), [name]: 'x' }))
      assert.ok(codes(problems).includes('unsafe-path'), name)
    }
  })

  it('refuses a name with a control or direction-changing character and never prints it raw', async () => {
    for (const name of ['assets/eye\u0007.glb', 'assets/eye\u202egnp.glb', 'assets/\u200beye.glb']) {
      const problems = await refused(zip({ ...goodFiles(), [name]: 'x' }))
      assert.ok(codes(problems).includes('unsafe-path'), name)
      assert.ok(!problems.some((problem) => /[\u0007\u202e\u200b]/.test(problem.message)), 'the message must not contain the hidden character')
    }
  })

  it('refuses more than 60 entries without looking at one of them: 61, and 200', async () => {
    const many = (count: number): Files => Object.fromEntries(Array.from({ length: count }, (_, i) => [`assets/f${i}.glb`, 'x']))
    for (const count of [PACKAGE_LIMITS.entries + 1, 200]) {
      const problems = await refused(zip(many(count)))
      assert.deepEqual(codes(problems), ['too-many-files'])
      assert.match(problems[0].message, new RegExp(`${count} files`))
      assert.match(problems[0].message, /at most 60/)
    }
  })

  it('counts exactly 60 as allowed by the entry cap (it fails later, for the files the manifest does not name)', async () => {
    const files: Files = { 'manifest.json': manifestText([]), 'simulation.json': specText() }
    for (let i = 0; i < 58; i++) files[`extra${i}.txt`] = 'x'
    const problems = await refused(zip(files))
    assert.ok(!codes(problems).includes('too-many-files'))
    assert.equal(codes(problems).filter((code) => code === 'unlisted').length, 58)
  })

  it('refuses an archive inside the archive by its name', async () => {
    for (const name of ['assets/inner.zip', 'inner.7z', 'x/y.tar', 'assets/old.RAR', 'assets/data.gz']) {
      const problems = await refused(zip({ ...goodFiles(), [name]: 'x' }))
      assert.ok(codes(problems).includes('nested-archive'), name)
      assert.ok(says(problems, /nested|archive inside/i), name)
    }
  })

  it('refuses two files whose names differ only by capital letters', async () => {
    const problems = await refused(zip({ ...goodFiles(), 'Assets/Eye.glb': glb(), 'assets/eye.GLB': glb() }))
    assert.ok(codes(problems).includes('duplicate'))
  })

  it('refuses a password-protected entry, an unknown packing method and the ZIP64 format', async () => {
    const base = zip(goodFiles())
    assert.ok(says(await refused(patch(base, 'assets/eye.glb', { flags: 1 })), /password/i))
    assert.ok(says(await refused(patch(base, 'assets/eye.glb', { method: 12 })), /cannot read|method/i))
    const sixtyFour = base.slice()
    const eocd = sixtyFour.length - 22
    new DataView(sixtyFour.buffer).setUint16(eocd + 10, 0xffff, true)
    assert.ok(says(await refused(sixtyFour), /ZIP64/))
  })

  it('refuses a link entry (a Unix symbolic link)', async () => {
    const base = zip(goodFiles())
    const copy = base.slice()
    const view = new DataView(copy.buffer)
    const at = recordOf(copy, 'assets/eye.glb')
    view.setUint16(at + 4, (3 << 8) | 20, true)
    view.setUint32(at + 38, (0o120777 << 16) >>> 0, true)
    assert.ok(says(await refused(copy), /is a link/))
  })

  it('refuses a model declared over 25 MB, an image over 2 MB, a specification over 1 MB and a README over 256 KB - before unpacking them', async () => {
    const manifest = manifestText([asset(), asset({ id: 'pic', file: 'assets/pic.png', kind: 'image' })])
    const files = zip({ 'manifest.json': manifest, 'simulation.json': specText(), 'assets/eye.glb': glb(), 'assets/pic.png': png(), 'README.md': 'r' })
    for (const [name, size, pattern] of [
      ['assets/eye.glb', 25 * MB + 1, /may be at most 25\.0 MB|at most 25 MB/],
      ['assets/pic.png', 2 * MB + 1, /at most 2\.0 MB/],
      ['simulation.json', 1_000_001, /specification may be at most/],
      ['README.md', 256 * 1024 + 1, /README\.md is/],
    ] as const) {
      const problems = await refused(patch(files, name, { size }))
      assert.ok(codes(problems).includes('oversize'), name)
      assert.ok(says(problems, pattern), `${name}: ${problems.map((p) => p.message).join(' | ')}`)
    }
  })

  it('refuses a package whose declared contents add up to more than 100 MB although no single file passes its own cap, and a zip file over 100 MB', async () => {
    const ids = ['eye', 'b', 'c', 'd', 'e']
    const manifest = manifestText(ids.map((id) => asset({ id, file: `assets/${id}.glb` })))
    let five = zip({ 'manifest.json': manifest, 'simulation.json': specText(), ...Object.fromEntries(ids.map((id) => [`assets/${id}.glb`, glb()])) })
    for (const id of ids) five = patch(five, `assets/${id}.glb`, { size: 24 * MB })
    const problems = await refused(five)
    assert.deepEqual(codes(problems), ['too-big'])
    assert.match(problems[0].message, /add up to 120 MB once unpacked; a package may hold at most 100 MB/)

    const huge = await refused(new Uint8Array(PACKAGE_LIMITS.packageBytes + 1))
    assert.deepEqual(codes(huge), ['too-big'])
  })
})

describe('whatever the bytes, the reader answers and never throws', () => {
  // A deterministic stream of "random" numbers, so a failure here can be replayed.
  const sequence = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000

  it('survives a byte changed anywhere in a valid package (300 mutations)', async () => {
    const valid = zip({ ...goodFiles(), 'assets/pic.png': png(), 'manifest.json': manifestText([asset(), asset({ id: 'pic', file: 'assets/pic.png', kind: 'image' })]) })
    const next = sequence(20261028)
    for (let round = 0; round < 300; round++) {
      const mutated = valid.slice()
      const flips = 1 + Math.floor(next() * 3)
      for (let i = 0; i < flips; i++) mutated[Math.floor(next() * mutated.length)] = Math.floor(next() * 256)
      const result = await read(mutated)
      if (result.ok) assert.equal(typeof result.package.spec, 'object')
      else assert.ok(result.problems.length > 0 && result.problems.every((problem) => typeof problem.message === 'string' && problem.message.length > 0))
    }
  })

  it('answers for a zip cut at any length (only the whole one is accepted)', async () => {
    const valid = zip(goodFiles())
    for (let length = 0; length < valid.length; length += 7) assert.equal((await read(valid.slice(0, length))).ok, false, `cut at ${length}`)
    assert.equal((await read(valid)).ok, true)
  })
})

/* ---------------------------------------------------------------------------------------------------------- refused while unpacking */

describe('hostile archives: caught while unpacking', () => {
  it('an entry that really holds more than the zip declares is stopped and refused (a lying contents table)', async () => {
    // 4 MB of zeros packs to a few KB; the table is made to say "100 bytes" so it passes the size check
    const files: Files = { 'manifest.json': manifestText([asset({ id: 'pic', file: 'assets/pic.png', kind: 'image' })]), 'simulation.json': specText(), 'assets/pic.png': png(4 * MB) }
    const honest = zip(files)
    assert.ok(honest.length < 100_000, 'the bomb is small on disk')
    const honestProblems = await refused(honest)
    assert.ok(codes(honestProblems).includes('oversize'), 'declared honestly it is over the 2 MB image cap')

    const lying = patch(honest, 'assets/pic.png', { size: 100 })
    const problems = await refused(lying)
    assert.ok(codes(problems).includes('oversize'))
    assert.ok(says(problems, /unpacks to more than the 100 B/), problems.map((p) => p.message).join(' | '))
  })

  it('an entry that holds less than the zip declares is refused as damaged', async () => {
    const lying = patch(zip(goodFiles()), 'assets/eye.glb', { size: 70 })
    const problems = await refused(lying)
    assert.ok(codes(problems).includes('damaged'))
  })

  it('a nested zip hidden behind a model name is found by its bytes', async () => {
    const inner = zip({ 'a.txt': 'hello' })
    const problems = await refused(zip({ ...goodFiles(), 'assets/eye.glb': inner }))
    assert.ok(codes(problems).includes('nested-archive'))
    assert.ok(says(problems, /itself an archive/))
  })

  it('refuses a model that is really an image, an image that is really a model, a cut-short model and an unknown file', async () => {
    assert.ok(says(await refused(zip({ ...goodFiles(), 'assets/eye.glb': png() })), /PNG image, but manifest\.json lists it as a model/))
    const asImage = { 'manifest.json': manifestText([asset({ id: 'pic', file: 'assets/pic.png', kind: 'image' })]), 'simulation.json': specText(), 'assets/pic.png': glb() }
    assert.ok(says(await refused(zip(asImage)), /3D model, but manifest\.json lists it as an image|glTF.*lists it as an image/))
    const short = glb(64)
    new DataView(short.buffer).setUint32(8, 9999, true)
    assert.ok(says(await refused(zip({ ...goodFiles(), 'assets/eye.glb': short })), /cut short, or has something added/))
    const v1 = glb(64)
    new DataView(v1.buffer).setUint32(4, 1, true)
    assert.ok(says(await refused(zip({ ...goodFiles(), 'assets/eye.glb': v1 })), /glTF version 1/))
    assert.ok(says(await refused(zip({ ...goodFiles(), 'assets/eye.glb': strToU8('just text') })), /not a model, image or HDR sky this system takes/))
  })
})

/* ----------------------------------------------------------------------------------------------------------------- the manifest rules */

describe('what the manifest requires of the zip', () => {
  it('a missing manifest says what a package needs, and that start from the sample is the way', async () => {
    const problems = await refused(zip({ 'simulation.json': specText(), 'assets/eye.glb': glb() }))
    assert.deepEqual(codes(problems), ['missing'])
    assert.match(problems[0].message, /no manifest\.json/)
  })

  it('files zipped inside a folder get a hint about the folder', async () => {
    const inside: Files = Object.fromEntries(Object.entries(goodFiles()).map(([name, data]) => [`pendulum-lab/${name}`, data]))
    const problems = await refused(zip(inside))
    assert.match(problems[0].message, /inside a folder named "pendulum-lab"/)
  })

  it('a missing simulation.json is named', async () => {
    const problems = await refused(zip({ 'manifest.json': manifestText([]) }))
    assert.match(problems[0].message, /no simulation\.json/)
  })

  it('a file the manifest does not name is refused by name', async () => {
    for (const extra of ['assets/extra.glb', 'notes.txt', 'assets/sub/deep.png']) {
      const problems = await refused(zip({ ...goodFiles(), [extra]: 'x' }))
      assert.ok(codes(problems).includes('unlisted'), extra)
      assert.ok(says(problems, new RegExp(`"${extra.replace(/\./g, '\\.')}" is in the zip but manifest\\.json does not name it`)), extra)
    }
  })

  it('a file the manifest names that is not in the zip is named, with a hint when only the capital letters differ', async () => {
    const gone = await refused(zip({ 'manifest.json': manifestText(), 'simulation.json': specText() }))
    assert.ok(says(gone, /names "assets\/eye\.glb" \(eye\), but that file is not in the zip/))
    const cased = await refused(zip({ 'manifest.json': manifestText(), 'simulation.json': specText(), 'assets/Eye.glb': glb() }))
    assert.ok(says(cased, /Check the capital letters/))
  })

  it('refuses a manifest that is not JSON, not an object, too deep, or not text', async () => {
    assert.ok(says(await refused(zip({ ...goodFiles(), 'manifest.json': '{ nope' })), /manifest\.json is not valid JSON/))
    assert.ok(says(await refused(zip({ ...goodFiles(), 'manifest.json': '[1,2]' })), /must hold one JSON object/))
    assert.ok(says(await refused(zip({ ...goodFiles(), 'manifest.json': new Uint8Array([0xff, 0xfe, 0x41]) })), /not plain text/))
    const deep = '['.repeat(100) + ']'.repeat(100)
    assert.ok(says(await refused(zip({ ...goodFiles(), 'simulation.json': `{"a":${deep}}` })), /more than 64 levels/))
  })

  it('refuses a simulation.json that is not JSON', async () => {
    const problems = await refused(zip({ ...goodFiles(), 'simulation.json': 'title: nope' }))
    assert.deepEqual(codes(problems), ['spec'])
  })

  it('reports every manifest problem at once, each with its place', async () => {
    const bad = manifestText(
      [asset({ id: 'Bad Id' }), asset({ id: 'dup', file: 'assets/a.glb' }), asset({ id: 'dup', file: 'assets/b.glb' }), asset({ id: 'x', kind: 'sound' }), asset({ id: 'y', file: 'assets/y.png', kind: 'model' }), asset({ id: 'z', file: 'manifest.json' })],
      { schema: 'g2g.sim.package/1', spec: 'other.json' },
    )
    const problems = await refused(zip({ ...goodFiles(), 'manifest.json': bad }))
    const text = problems.map((problem) => problem.message).join('\n')
    assert.match(text, /"schema": this is "g2g\.sim\.package\/1", but this page reads "g2g\.sim\.package\/2"/)
    assert.match(text, /"spec": must be "simulation\.json"/)
    assert.match(text, /assets\[0\]\.id: must be lowercase letters/)
    assert.match(text, /assets\[2\]\.id: "dup" is used twice/)
    assert.match(text, /assets\[3\]\.kind: must be "model", "image" or "hdr"/)
    assert.match(text, /assets\[4\]\.kind: "assets\/y\.png" is listed as a model, but a model file ends in \.glb/)
    assert.match(text, /assets\[5\]\.file: "manifest\.json" is one of the package's own files/)
  })
})

/* -------------------------------------------------------------------------------------------------------------------------- pure parts */

describe('pathProblem', () => {
  it('accepts ordinary relative paths', () => {
    for (const path of ['manifest.json', 'assets/eye.glb', 'assets/My Model v2.glb', 'a/b/c/d.png', 'assets/eye-1_final.webp']) assert.equal(pathProblem(path), null, path)
  })

  it('refuses each unsafe shape with a reason', () => {
    const cases: [string, RegExp][] = [
      ['', /has no name/],
      ['../x', /climb out/],
      ['a/../b', /climb out/],
      ['/abs', /absolute path/],
      ['C:/x', /drive letter/],
      ['a\\b', /backslash/],
      ['a//b', /empty folder name/],
      ['a/./b', /"\." folder/],
      ['a\u0000b', /hidden or control/],
      ['a<b', /not allowed in a file name/],
      ['x'.repeat(201), /longer than 200/],
      [`${'x'.repeat(121)}/a`, /longer than 120/],
      ['a.zip', /archive inside the archive/],
    ]
    for (const [path, pattern] of cases) assert.match(pathProblem(path) ?? 'null', pattern, JSON.stringify(path))
  })
})

describe('sniffAsset', () => {
  it('knows a Radiance HDR from "#?RADIANCE" or "#?RGBE" and a newline, and nothing that only starts like one', () => {
    assert.deepEqual(sniffAsset(strToU8('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 512 +X 1024\n')), { kind: 'hdr', mime: 'image/vnd.radiance', label: 'a Radiance HDR image' })
    assert.deepEqual(sniffAsset(strToU8('#?RGBE\nFORMAT=32-bit_rle_rgbe\n\n-Y 512 +X 1024\n')), { kind: 'hdr', mime: 'image/vnd.radiance', label: 'a Radiance HDR image' })
    for (const text of ['#?RADIANCE', '#?RADIANCEX\n', '# RADIANCE\n', '#?RGBE', '#!/bin/sh\n']) assert.equal(sniffAsset(strToU8(text)), null, text)
  })

  it('knows a model and the three image types from their first bytes, and says what they are', () => {
    assert.deepEqual(sniffAsset(glb()), { kind: 'model', mime: 'model/gltf-binary', label: 'a binary glTF (.glb) 3D model' })
    assert.deepEqual(sniffAsset(png()), { kind: 'image', mime: 'image/png', label: 'a PNG image' })
    assert.deepEqual(sniffAsset(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), { kind: 'image', mime: 'image/jpeg', label: 'a JPEG image' })
    assert.deepEqual(sniffAsset(strToU8('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ')), { kind: 'image', mime: 'image/webp', label: 'a WebP image' })
  })

  it('knows archives, and refuses an SVG, a GIF, HTML and nothing', () => {
    assert.deepEqual(sniffAsset(zip({ a: 'b' })), { archive: true })
    assert.deepEqual(sniffAsset(new Uint8Array([0x1f, 0x8b, 8])), { archive: true })
    for (const text of ['<svg xmlns="http://www.w3.org/2000/svg"/>', 'GIF89a', '<html>', '']) assert.equal(sniffAsset(strToU8(text)), null, text)
  })
})

describe('the small helpers', () => {
  it('formats sizes in the words a customer reads', () => {
    assert.equal(formatBytes(92), '92 B')
    assert.equal(formatBytes(2048), '2.0 KB')
    assert.equal(formatBytes(340 * 1024), '340 KB')
    assert.equal(formatBytes(1.6 * MB), '1.6 MB')
    assert.equal(formatBytes(25 * MB), '25 MB')
    assert.equal(formatBytes(Number.NaN), '0 B')
  })

  it('finds an extension in lower case, and none where there is none', () => {
    assert.equal(extensionOf('assets/Eye.GLB'), 'glb')
    assert.equal(extensionOf('assets/.hidden'), '')
    assert.equal(extensionOf('assets/noext'), '')
  })

  it('measures JSON depth without recursion', () => {
    assert.equal(jsonDepth(1), 0)
    assert.equal(jsonDepth({ a: [1, { b: 2 }] }), 3)
    assert.ok(jsonDepth(JSON.parse('['.repeat(60) + ']'.repeat(60))) >= 60)
  })

  it('defaults a missing name from the file, trims texts and ignores extra keys', () => {
    const { assets, problems } = readManifest({ schema: 'g2g.sim.package/2', spec: 'simulation.json', extra: 1, assets: [{ id: 'eye', file: 'assets/the-eye.glb', kind: 'model', licence: '  CC0 ', unknown: true }] })
    assert.deepEqual(problems, [])
    assert.deepEqual(assets, [{ id: 'eye', file: 'assets/the-eye.glb', kind: 'model', name: 'the-eye', licence: 'CC0', credit: '', source: '' }])
  })

  it('refuses a manifest that lists more than 40 files, or a list that is not a list', () => {
    const many = Array.from({ length: 41 }, (_, i) => asset({ id: `a${i}`, file: `assets/a${i}.glb` }))
    assert.match(readManifest({ schema: 'g2g.sim.package/2', spec: 'simulation.json', assets: many }).problems[0].message, /lists 41 files; a simulation may use at most 40/)
    assert.match(readManifest({ schema: 'g2g.sim.package/2', spec: 'simulation.json', assets: 'no' }).problems[0].message, /must be a list/)
  })
})
