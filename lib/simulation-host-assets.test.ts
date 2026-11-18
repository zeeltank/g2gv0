/**
 * Simulation Learning, 3D models and images: how the page answers a sandboxed runtime that asks for files, checked without a browser.
 *
 *  - the request check (a hash is fetched only when the specification this page holds names it; a malformed or oversized request is ignored);
 *  - the two answers the runtime gets (`asset` with the bytes, a credit, a kind and a type; `asset-missing` with a short reason);
 *  - the whole answer to one request, including a second request that arrives while the first is still downloading;
 *  - the credit lines shown under the player (a source is a link only when it is https; "3D model" or "Image");
 *  - the downloader (once per hash, three at a time across requests, a private copy per caller) and the download itself (25 MB for a model,
 *    3 MB for an image, plain 200 only).
 */
import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'

import {
  ASSET_NOT_IN_SPEC_REASON,
  MAX_ASSET_BYTES,
  MAX_HDR_BYTES,
  MAX_IMAGE_BYTES,
  MAX_MODELS_PER_REQUEST,
  answerAssetRequest,
  assetByteLimit,
  assetCreditLines,
  assetFailureReason,
  buildAssetMessage,
  buildAssetMissingMessage,
  createAssetLoader,
  creditKindFor,
  creditsOpenByDefault,
  creditsSummary,
  formatAssetCredit,
  httpsUrl,
  knownAssetMime,
  parseRuntimeMessage,
  partitionAssetRequest,
  postToRuntime,
  readAssetCredits,
  readAssetRequest,
  resolveAssetKind,
  runtimeCredit,
  specAssetModels,
  type AssetCredit,
  type AssetFile,
  type AssetKind,
  type HostMessage,
} from './simulation-host'
import { ApiError } from '../services/core'
import { fetchSimulationAsset, fetchSimulationAssetFile } from '../services/lms/simulations'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)
const C = 'c'.repeat(64)
const fromRuntime = { src: 'g2g-course', lesson: '7' }
const spec = { id: 'how-the-eye-sees', assets: { models: [{ id: 'eye', sha256: A, name: 'Eye' }, { id: 'lens', sha256: B }] }, view3d: { asset: 'eye' } }

/** A credit as the page holds it after reading the API's: `kind` is a model unless it says otherwise. */
const credit = (over: Partial<AssetCredit> = {}): AssetCredit => ({ sha256: A, kind: 'model', name: null, credit: null, licence: null, source: null, ...over })

describe('the request for 3D models', () => {
  it('accepts a well-formed request from the runtime for this lesson', () => {
    assert.deepEqual(parseRuntimeMessage({ ...fromRuntime, type: 'assets-needed', models: [{ id: 'eye', sha256: A }, { id: 'lens', sha256: B }] }, '7'), {
      type: 'assets-needed',
      models: [{ id: 'eye', sha256: A }, { id: 'lens', sha256: B }],
    })
  })

  it('is subject to the same source and lesson checks as every other message', () => {
    const models = [{ id: 'eye', sha256: A }]
    assert.equal(parseRuntimeMessage({ src: 'g2g-course', type: 'assets-needed', models }, '7'), null)
    assert.equal(parseRuntimeMessage({ src: 'g2g-course', lesson: '8', type: 'assets-needed', models }, '7'), null)
    assert.equal(parseRuntimeMessage({ src: 'someone-else', lesson: '7', type: 'assets-needed', models }, '7'), null)
    assert.equal(parseRuntimeMessage({ src: 'g2g-host', lesson: '7', type: 'assets-needed', models }, '7'), null)
  })

  it('asks for a hash once however many times it is named', () => {
    assert.deepEqual(readAssetRequest([{ id: 'eye', sha256: A }, { id: 'eye-again', sha256: A }, { id: 'lens', sha256: B }]), [
      { id: 'eye', sha256: A },
      { id: 'lens', sha256: B },
    ])
  })

  it('ignores a request that is not a list, is empty, or has more than 8 models', () => {
    for (const models of [undefined, null, 'models', 7, {}, { 0: { id: 'a', sha256: A } }, []]) {
      assert.equal(parseRuntimeMessage({ ...fromRuntime, type: 'assets-needed', models }, '7'), null, JSON.stringify(models))
    }
    const hash = (n: number) => n.toString(16).padStart(64, '0')
    const eight = Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, sha256: hash(i) }))
    assert.equal(readAssetRequest(eight)?.length, 8)
    assert.equal(readAssetRequest([...eight, { id: 'm8', sha256: hash(8) }]), null)
    // the limit is on what was asked, not on what is left after repeats are dropped
    assert.equal(readAssetRequest(Array.from({ length: 9 }, () => ({ id: 'same', sha256: A }))), null)
  })

  it('ignores a request in which any entry is malformed', () => {
    const good = { id: 'eye', sha256: A }
    for (const bad of [
      null,
      'text',
      7,
      [],
      [good],
      {},
      { id: 'eye' },
      { sha256: A },
      { id: 7, sha256: A },
      { id: 'eye', sha256: 7 },
      { id: 'eye', sha256: A.toUpperCase() },
      { id: 'eye', sha256: 'a'.repeat(63) },
      { id: 'eye', sha256: 'a'.repeat(65) },
      { id: 'eye', sha256: `${'a'.repeat(63)}g` },
      { id: 'eye', sha256: `${A}\n` },
      { id: 'x'.repeat(201), sha256: A },
    ]) {
      assert.equal(readAssetRequest([good, bad]), null, JSON.stringify(bad))
    }
  })

  it('does not trust inherited or extra fields', () => {
    const models = readAssetRequest([{ id: 'eye', sha256: A, url: 'https://evil.example/x.glb', path: '../../etc/passwd' }])
    assert.deepEqual(models, [{ id: 'eye', sha256: A }])
  })
})

describe('which hashes are fetched', () => {
  it('names the models of a specification, skipping anything malformed', () => {
    assert.deepEqual(specAssetModels(spec), [{ id: 'eye', sha256: A }, { id: 'lens', sha256: B }])
    assert.deepEqual(specAssetModels({ assets: { models: [null, 3, 'x', { id: 'a' }, { sha256: 'short' }, { id: 'ok', sha256: C }] } }), [{ id: 'ok', sha256: C }])
    for (const junk of [undefined, null, 5, 'spec', [], {}, { assets: null }, { assets: 'x' }, { assets: {} }, { assets: { models: 'x' } }, { assets: { models: {} } }]) {
      assert.deepEqual(specAssetModels(junk), [], JSON.stringify(junk))
    }
  })

  it('counts the files of `assets.images` too, where a specification keeps its pictures apart from its models', () => {
    assert.deepEqual(specAssetModels({ assets: { models: [{ id: 'eye', sha256: A }], images: [{ id: 'retina', sha256: C }, { id: 'bad', sha256: 'x' }, null] } }), [
      { id: 'eye', sha256: A },
      { id: 'retina', sha256: C },
    ])
    assert.deepEqual(specAssetModels({ assets: { images: 'x', models: [{ id: 'eye', sha256: A }] } }), [{ id: 'eye', sha256: A }])
    assert.deepEqual(partitionAssetRequest({ assets: { images: [{ id: 'retina', sha256: C }] } }, [{ id: 'retina', sha256: C }, { id: 'x', sha256: A }]), { allowed: [C], refused: [A] })
  })

  it('allows a hash the specification names and refuses every other', () => {
    assert.deepEqual(
      partitionAssetRequest(spec, [{ id: 'eye', sha256: A }, { id: 'sneaky', sha256: C }, { id: 'lens', sha256: B }]),
      { allowed: [A, B], refused: [C] },
    )
  })

  it('goes by the hash, not by the id the runtime gives it', () => {
    // asking for the specification's own id with another file's hash does not get that file, and the other way round does
    assert.deepEqual(partitionAssetRequest(spec, [{ id: 'eye', sha256: C }]), { allowed: [], refused: [C] })
    assert.deepEqual(partitionAssetRequest(spec, [{ id: 'anything', sha256: A }]), { allowed: [A], refused: [] })
  })

  it('refuses everything when the page holds no specification, or one that names no models', () => {
    const asked = [{ id: 'eye', sha256: A }]
    for (const none of [undefined, null, {}, { assets: { models: [] } }, 'spec']) {
      assert.deepEqual(partitionAssetRequest(none, asked), { allowed: [], refused: [A] }, JSON.stringify(none))
    }
  })

  it('lists each hash once, in the order asked', () => {
    assert.deepEqual(partitionAssetRequest(spec, [{ id: 'a', sha256: B }, { id: 'b', sha256: C }, { id: 'c', sha256: B }, { id: 'd', sha256: A }, { id: 'e', sha256: C }]), {
      allowed: [B, A],
      refused: [C],
    })
  })
})

describe('the answers sent to the runtime', () => {
  const eye = credit({ name: 'Eye', credit: 'Jane Doe', licence: 'CC BY 4.0', source: 'https://example.com/eye' })

  it('sends a model as { type: "asset", sha256, bytes, credit, kind } and nothing else', () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer
    const message = buildAssetMessage(A, bytes, { credit: eye })
    assert.deepEqual(Object.keys(message).sort(), ['bytes', 'credit', 'kind', 'sha256', 'type'])
    assert.equal(message.type, 'asset')
    assert.equal(message.sha256, A)
    assert.equal(message.bytes, bytes)
    assert.equal(message.kind, 'model')
    assert.deepEqual(message.credit, { title: 'Eye', author: 'Jane Doe', licence: 'CC BY 4.0', source: 'https://example.com/eye' })
  })

  it('sends the kind and the known type of an image', () => {
    const bytes = new ArrayBuffer(3)
    const message = buildAssetMessage(B, bytes, { credit: credit({ sha256: B, kind: 'image', name: 'Retina' }), kind: 'image', contentType: 'image/png' })
    assert.deepEqual(Object.keys(message).sort(), ['bytes', 'credit', 'kind', 'mime', 'sha256', 'type'])
    assert.equal(message.kind, 'image')
    assert.equal(message.mime, 'image/png')
    assert.deepEqual(message.credit, { title: 'Retina' })
    assert.equal(buildAssetMessage(A, bytes, { contentType: 'model/gltf-binary' }).mime, 'model/gltf-binary')
  })

  it('leaves out a credit it has nothing for, rather than sending an empty one, but always says what the file is', () => {
    const bytes = new ArrayBuffer(1)
    assert.deepEqual(Object.keys(buildAssetMessage(A, bytes)).sort(), ['bytes', 'kind', 'sha256', 'type'])
    assert.equal(buildAssetMessage(A, bytes).kind, 'model')
    assert.deepEqual(Object.keys(buildAssetMessage(A, bytes, { credit: credit() })).sort(), ['bytes', 'kind', 'sha256', 'type'])
    assert.deepEqual(runtimeCredit(credit({ name: 'Eye' })), { title: 'Eye' })
  })

  it('takes mime only from a known image or model type, in lower case and without parameters', () => {
    assert.equal(knownAssetMime('image/png'), 'image/png')
    assert.equal(knownAssetMime('Image/JPEG; charset=binary'), 'image/jpeg')
    assert.equal(knownAssetMime(' model/gltf-binary '), 'model/gltf-binary')
    for (const mime of ['image/webp', 'image/gif', 'image/avif', 'image/svg+xml']) assert.equal(knownAssetMime(mime), mime)
    for (const no of ['application/octet-stream', 'application/json', 'text/html', 'image/tiff', 'image/', 'model/obj', 'png', '', ';', null, undefined]) {
      assert.equal(knownAssetMime(no), null, String(no))
      assert.equal(Object.hasOwn(buildAssetMessage(A, new ArrayBuffer(1), { contentType: no }), 'mime'), false, String(no))
    }
  })

  it('says an image is an image if the credit, the explicit kind or the type of the response says so', () => {
    assert.equal(resolveAssetKind('image', null), 'image')
    assert.equal(resolveAssetKind(undefined, 'image/png'), 'image')
    assert.equal(resolveAssetKind('model', 'image/tiff'), 'image')
    assert.equal(resolveAssetKind('model', 'model/gltf-binary'), 'model')
    assert.equal(resolveAssetKind(undefined, undefined), 'model')
    assert.equal(resolveAssetKind(undefined, 'application/octet-stream'), 'model')
    assert.equal(buildAssetMessage(A, new ArrayBuffer(1), { contentType: 'image/tiff' }).kind, 'image')
    assert.equal(buildAssetMessage(A, new ArrayBuffer(1), { credit: credit({ kind: 'image' }) }).kind, 'image')
  })

  it('passes a source on to the runtime only when it is an https link', () => {
    const withSource = (source: string | null) => runtimeCredit(credit({ name: 'Eye', source }))
    assert.equal(withSource('https://example.com/eye')?.source, 'https://example.com/eye')
    for (const source of ['http://example.com/eye', 'javascript:alert(1)', 'data:text/html,hi', 'Sketchfab', '//example.com/x', null]) {
      assert.equal(withSource(source)?.source, undefined, String(source))
    }
  })

  it('sends no part of a credit that is longer than the runtime accepts (it would refuse the whole file)', () => {
    const long = `https://example.com/${'a'.repeat(200)}`
    assert.deepEqual(runtimeCredit(credit({ name: 'Eye', licence: 'CC0', source: long })), { title: 'Eye', licence: 'CC0' })
    const exact = `https://example.com/${'a'.repeat(200 - 'https://example.com/'.length)}`
    assert.equal(exact.length, 200)
    assert.equal(runtimeCredit(credit({ source: exact }))?.source, exact)
    for (const part of Object.values(runtimeCredit(credit({ name: 'n'.repeat(300), credit: 'c'.repeat(300), licence: 'l'.repeat(300) })) ?? {})) {
      assert.ok(part.length <= 200)
    }
  })

  it('sends a file that cannot be provided as { type: "asset-missing", sha256, reason }', () => {
    assert.deepEqual(buildAssetMissingMessage(A, 'This model is not available.'), { type: 'asset-missing', sha256: A, reason: 'This model is not available.' })
    assert.deepEqual(buildAssetMissingMessage(A), { type: 'asset-missing', sha256: A })
  })

  it('gives a short sentence for a person, not an error, saying model or image', () => {
    assert.equal(assetFailureReason({ code: 'too_large' }), 'This model is too large to load.')
    assert.equal(assetFailureReason({ status: 404 }), 'This model is not available.')
    assert.equal(assetFailureReason({ status: 403 }), 'You do not have access to this model.')
    assert.equal(assetFailureReason({ code: 'too_large' }, 'image'), 'This image is too large to load.')
    assert.equal(assetFailureReason({ status: 404 }, 'image'), 'This image is not available.')
    assert.equal(assetFailureReason({ status: 401 }, 'image'), 'You do not have access to this image.')
    for (const other of [new Error('TypeError: Failed to fetch at https://api.example/x'), { status: 500 }, null, undefined, 'boom']) {
      assert.equal(assetFailureReason(other), 'The model could not be loaded.')
      assert.equal(assetFailureReason(other, 'image'), 'The image could not be loaded.')
    }
  })

  it('posts to the frame with src "g2g-host" and the buffer transferred', () => {
    const sent: { data: unknown; origin: unknown; transfer: unknown }[] = []
    const frame = { contentWindow: { postMessage: (data: unknown, origin: unknown, transfer: unknown) => sent.push({ data, origin, transfer }) } } as unknown as HTMLIFrameElement
    const bytes = new ArrayBuffer(4)
    assert.equal(postToRuntime(frame, buildAssetMessage(A, bytes, { contentType: 'model/gltf-binary' }), [bytes]), true)
    assert.equal(postToRuntime(frame, buildAssetMissingMessage(B, 'No.')), true)
    assert.deepEqual(sent[0].data, { src: 'g2g-host', type: 'asset', sha256: A, bytes, kind: 'model', mime: 'model/gltf-binary' })
    assert.deepEqual(sent[0].transfer, [bytes])
    assert.deepEqual(sent[1].data, { src: 'g2g-host', type: 'asset-missing', sha256: B, reason: 'No.' })
    // an opaque-origin frame cannot be named, so the window object is the address; the other messages already go this way
    assert.equal(sent[0].origin, '*')
  })

  it('says so, and does not throw, when the frame has gone or the buffer cannot be sent', () => {
    assert.equal(postToRuntime(null, { type: 'pause' }), false)
    assert.equal(postToRuntime({ contentWindow: null } as unknown as HTMLIFrameElement, { type: 'pause' }), false)
    const throwing = { contentWindow: { postMessage: () => { throw new Error('DataCloneError') } } } as unknown as HTMLIFrameElement
    assert.equal(postToRuntime(throwing, buildAssetMessage(A, new ArrayBuffer(1))), false)
  })

  it('really does hand the buffer over, which is why the downloader keeps its own', () => {
    const bytes = new Uint8Array([9, 9, 9]).buffer
    structuredClone({ bytes }, { transfer: [bytes] })
    assert.equal(bytes.byteLength, 0)
  })
})

describe('the credit lines under the player', () => {
  const eye = credit({ name: 'Eye', credit: 'Jane Doe', licence: 'CC BY 4.0', source: 'https://example.com/eye' })

  it('reads "3D model: <name> - <credit> (<licence>)" and links an https source', () => {
    assert.deepEqual(formatAssetCredit(eye), {
      key: A,
      kind: 'model',
      text: '3D model: Eye - Jane Doe (CC BY 4.0)',
      name: 'Eye',
      href: 'https://example.com/eye',
      sourceText: null,
    })
  })

  it('says "Image" for an image and "3D model" for everything else', () => {
    const retina = formatAssetCredit(credit({ sha256: B, kind: 'image', name: 'Retina diagram', credit: 'Jane Doe', licence: 'CC0' }))
    assert.equal(retina.text, 'Image: Retina diagram - Jane Doe (CC0)')
    assert.equal(retina.kind, 'image')
    assert.equal(formatAssetCredit(credit({ kind: 'image' })).text, 'Image')
    assert.equal(formatAssetCredit(credit()).text, '3D model')
    assert.equal(formatAssetCredit({ ...eye, kind: 'sculpture' as unknown as AssetKind }).text.startsWith('3D model: '), true)
  })

  it('shows a source that is not an https link as plain text, never as a link', () => {
    for (const kind of ['model', 'image'] as const) {
      for (const source of ['http://example.com/eye', 'javascript:alert(1)', 'data:text/html,<b>x</b>', 'Sketchfab, uploaded 2024', 'https://user:pass@example.com/eye', 'ftp://example.com/eye']) {
        const line = formatAssetCredit({ ...eye, kind, source })
        assert.equal(line.href, null, source)
        assert.equal(line.sourceText, source, source)
      }
    }
  })

  it('leaves out what is not known', () => {
    assert.equal(formatAssetCredit(credit({ name: 'Eye' })).text, '3D model: Eye')
    assert.equal(formatAssetCredit(credit({ name: 'Eye', licence: 'CC0' })).text, '3D model: Eye (CC0)')
    assert.equal(formatAssetCredit(credit({ name: 'Eye', credit: 'Jane Doe' })).text, '3D model: Eye - Jane Doe')
    assert.equal(formatAssetCredit(credit({ credit: 'Jane Doe', licence: 'CC0' })).text, '3D model: Jane Doe (CC0)')
    assert.equal(formatAssetCredit(credit()).text, '3D model')
    const none = formatAssetCredit(credit())
    assert.equal(none.href, null)
    assert.equal(none.sourceText, null)
  })

  it('reads the API shape (kind, name, credit, licence, source_url, ...) and tolerates anything else', () => {
    const lines = assetCreditLines([
      { sha256: A, name: ' Eye  model ', bytes: 1234, licence: 'CC BY 4.0', credit: 'Jane Doe', source_url: 'https://example.com/eye' },
      { sha256: B, kind: 'model', name: 'Lens', bytes: 10, licence: null, credit: null, source_url: null },
      { sha256: C, kind: 'image', name: 'Retina', bytes: 99, licence: 'CC0', credit: null, source_url: null },
      { sha256: 'not-a-hash', name: 'Bad' },
      null,
      'text',
      { name: 'No hash' },
    ])
    assert.deepEqual(lines.map((l) => l.text), ['3D model: Eye model - Jane Doe (CC BY 4.0)', '3D model: Lens', 'Image: Retina (CC0)'])
    for (const junk of [undefined, null, 'x', 5, {}, [[]]]) assert.deepEqual(assetCreditLines(junk), [], JSON.stringify(junk))
    assert.deepEqual(readAssetCredits([{ sha256: A, name: 7, credit: ['x'], licence: {}, source_url: 4 }]), [credit()])
  })

  it('treats a kind that is missing or not "image" as a model', () => {
    for (const kind of [undefined, null, 'model', 'IMAGE', 'picture', 7, {}, ['image']]) {
      assert.equal(readAssetCredits([{ sha256: A, kind }])[0].kind, 'model', String(kind))
    }
    assert.equal(readAssetCredits([{ sha256: A, kind: 'image' }])[0].kind, 'image')
    const assets = [{ sha256: A, kind: 'image' }, { sha256: B }]
    assert.equal(creditKindFor(assets, A), 'image')
    assert.equal(creditKindFor(assets, B), 'model')
    assert.equal(creditKindFor(assets, C), undefined)
    assert.equal(creditKindFor(undefined, A), undefined)
  })

  it('accepts a link only when it is https', () => {
    assert.equal(httpsUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1')
    assert.equal(httpsUrl('  https://example.com  '), 'https://example.com/')
    for (const no of ['http://example.com', 'HTTP://example.com', 'javascript:alert(1)', 'https:', 'https://', 'example.com', '', '   ', null, undefined, 5, {}, `https://example.com/${'a'.repeat(2100)}`]) {
      assert.equal(httpsUrl(no), null, String(no))
    }
  })

  it('keeps long text short', () => {
    const [line] = assetCreditLines([{ sha256: A, name: 'Eye', licence: 'CC0', credit: 'x'.repeat(5000), source_url: 'Sketchfab '.repeat(500) }])
    assert.ok(line.text.length < 300, String(line.text.length))
    assert.ok((line.sourceText ?? '').length <= 200)
  })

  it('titles the list "3D model and image credits (N)" and opens it by default only for 3 credits or fewer', () => {
    assert.equal(creditsSummary(1), '3D model and image credits (1)')
    assert.equal(creditsSummary(24), '3D model and image credits (24)')
    for (const count of [1, 2, 3]) assert.equal(creditsOpenByDefault(count), true, String(count))
    for (const count of [4, 5, 16, 24]) assert.equal(creditsOpenByDefault(count), false, String(count))
  })
})

describe('downloading the files', () => {
  const file = (n: number, kind: AssetKind = 'model', mime: string | null = null): AssetFile => ({ bytes: new Uint8Array([n, n, n]).buffer, kind, mime })
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
  const hash = (n: number) => n.toString(16).padStart(64, '0')

  it('fetches a hash once however often and however concurrently it is asked for', async () => {
    let calls = 0
    const loader = createAssetLoader(async () => {
      calls += 1
      await tick()
      return file(1)
    })
    const [one, two] = await Promise.all([loader.load(A), loader.load(A)])
    const three = await loader.load(A)
    assert.equal(calls, 1)
    for (const got of [one, two, three]) assert.deepEqual([...new Uint8Array(got.bytes)], [1, 1, 1])
  })

  it('hands each caller a buffer of its own, so transferring one leaves the kept file whole', async () => {
    const loader = createAssetLoader(async () => file(7, 'image', 'image/png'))
    const first = await loader.load(A)
    structuredClone({ bytes: first.bytes }, { transfer: [first.bytes] })
    assert.equal(first.bytes.byteLength, 0)
    const second = await loader.load(A)
    assert.deepEqual([...new Uint8Array(second.bytes)], [7, 7, 7])
    assert.notEqual(second.bytes, first.bytes)
    assert.equal(second.kind, 'image')
    assert.equal(second.mime, 'image/png')
  })

  it('runs at most three downloads at a time and finishes them all', async () => {
    let running = 0
    let peak = 0
    const finish: (() => void)[] = []
    const loader = createAssetLoader(
      () =>
        new Promise<AssetFile>((resolve) => {
          running += 1
          peak = Math.max(peak, running)
          finish.push(() => {
            running -= 1
            resolve(file(1))
          })
        }),
    )
    const all = Promise.all(Array.from({ length: 8 }, (_, i) => loader.load(hash(i))))
    await tick()
    assert.equal(running, 3)
    while (finish.length) {
      finish.shift()?.()
      await tick()
      assert.ok(running <= 3)
    }
    await all
    assert.equal(peak, 3)
  })

  it('does not remember a failure: the next request tries again', async () => {
    let calls = 0
    const loader = createAssetLoader(async () => {
      calls += 1
      if (calls === 1) throw new Error('network')
      return file(2)
    })
    await assert.rejects(loader.load(A), /network/)
    assert.deepEqual([...new Uint8Array((await loader.load(A)).bytes)], [2, 2, 2])
    assert.equal(calls, 2)
  })

  it('does not let one failure hold up the downloads behind it', async () => {
    const loader = createAssetLoader(async (sha) => {
      if (sha === A) throw new Error('boom')
      return file(3)
    }, 1)
    const results = await Promise.allSettled([loader.load(A), loader.load(B), loader.load(C)])
    assert.deepEqual(results.map((r) => r.status), ['rejected', 'fulfilled', 'fulfilled'])
  })
})

describe('answering a request for files', () => {
  const hash = (n: number) => n.toString(16).padStart(64, '0')
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
  const ref = (sha256: string) => ({ id: `id-${sha256.slice(-2)}`, sha256 })
  const specOf = (...hashes: string[]) => ({ assets: { models: hashes.map(ref) } })
  const shaOf = (message: HostMessage) => (message as { sha256: string }).sha256

  type Sent = { message: HostMessage; transfer?: Transferable[] }
  const recorder = (accept: (message: HostMessage) => boolean = () => true) => {
    const sent: Sent[] = []
    return {
      sent,
      reply: (message: HostMessage, transfer?: Transferable[]) => {
        if (!accept(message)) return false
        sent.push({ message, transfer })
        return true
      },
    }
  }
  const quick = (kind: AssetKind = 'model', mime: string | null = null) => async (): Promise<AssetFile> => ({ bytes: new Uint8Array([1, 2, 3, 4]).buffer, kind, mime })

  it('sends one answer per hash: the file for one the specification names, "missing" for any other, which is never fetched', async () => {
    const fetched: string[] = []
    const loader = createAssetLoader(async (sha) => {
      fetched.push(sha)
      return { bytes: new Uint8Array([5, 6]).buffer, kind: 'model', mime: 'model/gltf-binary' }
    })
    const { sent, reply } = recorder()
    await answerAssetRequest({ spec: specOf(A, B), assets: [{ sha256: A, name: 'Eye', licence: 'CC0' }], models: [ref(A), ref(C), ref(B)], loader, reply })
    assert.deepEqual([...fetched].sort(), [A, B])
    assert.equal(sent.length, 3)
    const byHash = new Map(sent.map((s) => [shaOf(s.message), s]))
    assert.deepEqual(byHash.get(C)?.message, { type: 'asset-missing', sha256: C, reason: ASSET_NOT_IN_SPEC_REASON })
    const eye = byHash.get(A)?.message
    assert.equal(eye?.type, 'asset')
    if (eye?.type === 'asset') {
      assert.deepEqual(eye.credit, { title: 'Eye', licence: 'CC0' })
      assert.equal(eye.kind, 'model')
      assert.equal(eye.mime, 'model/gltf-binary')
      assert.deepEqual([...new Uint8Array(eye.bytes)], [5, 6])
      // the buffer posted is the very one in the transfer list
      assert.equal(byHash.get(A)?.transfer?.length, 1)
      assert.equal(byHash.get(A)?.transfer?.[0], eye.bytes)
    }
  })

  it('names the kind of an image from the credits, and its words in a failure', async () => {
    const { sent, reply } = recorder()
    const loader = createAssetLoader(async (sha): Promise<AssetFile> => {
      if (sha === B) throw Object.assign(new Error('too big'), { code: 'too_large' })
      return { bytes: new Uint8Array([1]).buffer, kind: 'image', mime: 'image/jpeg' }
    })
    await answerAssetRequest({
      spec: specOf(A, B),
      assets: [{ sha256: A, kind: 'image', name: 'Retina' }, { sha256: B, kind: 'image', name: 'Huge' }],
      models: [ref(A), ref(B)],
      loader,
      reply,
    })
    const first = sent.find((s) => shaOf(s.message) === A)?.message
    assert.equal(first?.type, 'asset')
    if (first?.type === 'asset') {
      assert.equal(first.kind, 'image')
      assert.equal(first.mime, 'image/jpeg')
    }
    assert.deepEqual(sent.find((s) => shaOf(s.message) === B)?.message, { type: 'asset-missing', sha256: B, reason: 'This image is too large to load.' })
  })

  it('answers "missing" for a file that cannot be loaded, with a reason that is not an error dump, and keeps serving the others', async () => {
    const failures: unknown[] = []
    const { sent, reply } = recorder()
    const loader = createAssetLoader(async (sha): Promise<AssetFile> => {
      if (sha === A) throw Object.assign(new Error('GET https://api.internal/x failed with 500 at line 12'), { status: 500 })
      return { bytes: new ArrayBuffer(2), kind: 'model', mime: null }
    })
    await answerAssetRequest({ spec: specOf(A, B), assets: [], models: [ref(A), ref(B)], loader, reply, onFailure: (e) => failures.push(e) })
    assert.equal(failures.length, 1)
    const missing = sent.map((s) => s.message).find((m) => m.type === 'asset-missing')
    assert.deepEqual(missing, { type: 'asset-missing', sha256: A, reason: 'The model could not be loaded.' })
    assert.equal(sent.filter((s) => s.message.type === 'asset').length, 1)
  })

  it('answers "missing" when the answer could not be posted, and never rejects', async () => {
    // the first attempt (the file) is refused by the frame; the second (the apology) is allowed
    const { sent, reply } = recorder((message) => message.type !== 'asset')
    await answerAssetRequest({ spec: specOf(A), assets: [], models: [ref(A)], loader: createAssetLoader(quick()), reply })
    assert.deepEqual(sent.map((s) => s.message), [{ type: 'asset-missing', sha256: A, reason: 'The model could not be loaded.' }])

    await assert.doesNotReject(
      answerAssetRequest({
        spec: specOf(A, B),
        assets: [],
        models: [ref(A), ref(B)],
        loader: createAssetLoader(quick()),
        reply: () => {
          throw new Error('the frame blew up')
        },
        onFailure: () => {
          throw new Error('so did the logger')
        },
      }),
    )
  })

  it('answers only the refusals without a loader, and fetches nothing for a page that holds no specification', async () => {
    const { sent, reply } = recorder()
    await answerAssetRequest({ spec: specOf(A), assets: [], models: [ref(A), ref(B)], loader: null, reply })
    assert.deepEqual(sent.map((s) => s.message), [{ type: 'asset-missing', sha256: B, reason: ASSET_NOT_IN_SPEC_REASON }])
    let calls = 0
    const loader = createAssetLoader(async (): Promise<AssetFile> => {
      calls += 1
      return { bytes: new ArrayBuffer(1), kind: 'model', mime: null }
    })
    const none = recorder()
    await answerAssetRequest({ spec: undefined, assets: undefined, models: [ref(A), ref(B)], loader, reply: none.reply })
    assert.equal(calls, 0)
    assert.deepEqual(none.sent.map((s) => s.message.type), ['asset-missing', 'asset-missing'])
  })

  it('accepts a request of the largest size, 8 files', async () => {
    assert.equal(MAX_MODELS_PER_REQUEST, 8)
    const hashes = Array.from({ length: 8 }, (_, i) => hash(i + 1))
    const request = readAssetRequest(hashes.map(ref))
    assert.equal(request?.length, 8)
    const { sent, reply } = recorder()
    await answerAssetRequest({ spec: specOf(...hashes), assets: [], models: request ?? [], loader: createAssetLoader(quick()), reply })
    assert.equal(sent.filter((s) => s.message.type === 'asset').length, 8)
  })

  it('serves a second request for other hashes while the first is still downloading, 3 at a time in all', async () => {
    const all = Array.from({ length: 12 }, (_, i) => hash(i + 1))
    const full = specOf(...all)
    let running = 0
    let peak = 0
    const started: string[] = []
    const release = new Map<string, () => void>()
    const loader = createAssetLoader(
      (sha) =>
        new Promise<AssetFile>((resolve) => {
          running += 1
          peak = Math.max(peak, running)
          started.push(sha)
          release.set(sha, () => {
            running -= 1
            resolve({ bytes: new Uint8Array([9]).buffer, kind: 'model', mime: null })
          })
        }),
    )
    const { sent, reply } = recorder()

    const first = answerAssetRequest({ spec: full, assets: [], models: all.slice(0, 6).map(ref), loader, reply })
    await tick()
    assert.deepEqual(started, all.slice(0, 3), 'the first request fills the three slots')

    // the runtime asks for more while those are still downloading; one of them (all[5]) is already queued by the first request
    const second = answerAssetRequest({ spec: full, assets: [], models: [...all.slice(5, 9), hash(99)].map(ref), loader, reply })
    await tick()
    assert.equal(running, 3, 'no more than three, though two requests are open')
    assert.deepEqual(sent.map((s) => s.message), [{ type: 'asset-missing', sha256: hash(99), reason: ASSET_NOT_IN_SPEC_REASON }], 'a hash the specification does not name is answered at once')

    // let everything finish, one download at a time, as the slots free up
    while (sent.filter((s) => s.message.type === 'asset').length < 10) {
      const next = started.find((sha) => release.has(sha))
      assert.ok(next, 'a download is waiting to be finished')
      release.get(next)?.()
      release.delete(next)
      await tick()
      assert.ok(running <= 3)
    }
    await Promise.all([first, second])
    assert.equal(peak, 3)
    // 9 different files were fetched once each, in the order they were first asked for
    assert.deepEqual(started, all.slice(0, 9))
    const answered = sent.map((s) => s.message).filter((m) => m.type === 'asset').map(shaOf)
    assert.deepEqual([...new Set(answered)].sort(), [...all.slice(0, 9)].sort())
    // the file asked for by both requests is sent for both, as its own message each time, from a download made once
    assert.equal(answered.length, 10)
    assert.equal(answered.filter((sha) => sha === all[5]).length, 2)
  })

  it('serves a repeat request from memory', async () => {
    let calls = 0
    const loader = createAssetLoader(async (): Promise<AssetFile> => {
      calls += 1
      return { bytes: new Uint8Array([1, 2]).buffer, kind: 'image', mime: 'image/png' }
    })
    const { sent, reply } = recorder()
    await answerAssetRequest({ spec: specOf(A), assets: [], models: [ref(A)], loader, reply })
    await answerAssetRequest({ spec: specOf(A), assets: [], models: [ref(A)], loader, reply })
    assert.equal(calls, 1)
    assert.equal(sent.length, 2)
    const [one, two] = sent.map((s) => (s.message as { bytes: ArrayBuffer }).bytes)
    assert.notEqual(one, two)
    assert.deepEqual([...new Uint8Array(two)], [1, 2])
  })
})

describe('the download of one file', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  type Call = { url: URL; headers: Headers }
  const stub = (respond: () => Response): Call[] => {
    const calls: Call[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost'), headers: new Headers(init?.headers) })
      return respond()
    }) as typeof fetch
    return calls
  }
  const stream = (chunks: number, size: number, pulled: { count: number }) =>
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled.count >= chunks) return controller.close()
        pulled.count += 1
        controller.enqueue(new Uint8Array(size).fill(1))
      },
    })
  const tooLarge = (err: unknown) => (err as { code?: string }).code === 'too_large'
  const MB = 1024 * 1024
  const describeFile = (f: AssetFile) => ({ kind: f.kind, mime: f.mime })

  it('asks the simulation-scoped route for that hash, with model and image types accepted', async () => {
    const calls = stub(() => new Response(new Uint8Array([103, 108, 84, 70]), { status: 200, headers: { 'Content-Type': 'model/gltf-binary' } }))
    const got = await fetchSimulationAsset(7, A)
    assert.deepEqual([...new Uint8Array(got)], [103, 108, 84, 70])
    assert.equal(calls.length, 1)
    assert.ok(calls[0].url.pathname.endsWith(`/lms/simulations/7/assets/${A}`), calls[0].url.pathname)
    const accept = calls[0].headers.get('accept') ?? ''
    assert.match(accept, /model\/gltf-binary/)
    assert.match(accept, /image\/\*/)
  })

  it('returns what the file is and its known type', async () => {
    stub(() => new Response(new Uint8Array([1]), { status: 200, headers: { 'Content-Type': 'image/PNG; charset=binary' } }))
    assert.deepEqual(describeFile(await fetchSimulationAssetFile(7, A)), { kind: 'image', mime: 'image/png' })
    stub(() => new Response(new Uint8Array([1, 2]), { status: 200, headers: { 'Content-Type': 'model/gltf-binary' } }))
    assert.deepEqual(describeFile(await fetchSimulationAssetFile(7, A)), { kind: 'model', mime: 'model/gltf-binary' })
    // a type that is not a known one is not passed on, and decides nothing but "image/*" being an image
    stub(() => new Response(new Uint8Array([1]), { status: 200, headers: { 'Content-Type': 'application/octet-stream' } }))
    assert.deepEqual(describeFile(await fetchSimulationAssetFile(7, A)), { kind: 'model', mime: null })
    stub(() => new Response(new Uint8Array([1]), { status: 200, headers: { 'Content-Type': 'image/tiff' } }))
    assert.deepEqual(describeFile(await fetchSimulationAssetFile(7, A)), { kind: 'image', mime: null })
    stub(() => new Response(new Uint8Array([1]), { status: 200 }))
    assert.deepEqual(describeFile(await fetchSimulationAssetFile(7, A, { kind: 'image' })), { kind: 'image', mime: null })
  })

  it('does not call the server for something that is not a simulation or a hash', async () => {
    const calls = stub(() => new Response('x'))
    for (const [id, sha] of [[7, 'nope'], [7, A.toUpperCase()], [7, `${A}/../x`], [0, A], [-1, A], [1.5, A], [Number.NaN, A]] as const) {
      await assert.rejects(fetchSimulationAsset(id, sha))
      await assert.rejects(fetchSimulationAssetFile(id, sha))
    }
    assert.equal(calls.length, 0)
  })

  it('says an HDR sky is an HDR sky from the registered kind or from Radiance\'s own type (which is also an image/ type), before anything is called an image', () => {
    assert.equal(resolveAssetKind('hdr', null), 'hdr')
    assert.equal(resolveAssetKind(undefined, 'image/vnd.radiance'), 'hdr')
    assert.equal(resolveAssetKind('image', 'image/vnd.radiance'), 'image', 'a registered image is not turned into a sky by a response type')
    assert.equal(resolveAssetKind('hdr', 'image/png'), 'hdr')
    assert.equal(buildAssetMessage(A, new ArrayBuffer(1), { contentType: 'image/vnd.radiance' }).kind, 'hdr')
    assert.equal(buildAssetMessage(A, new ArrayBuffer(1), { credit: credit({ kind: 'hdr' }) }).kind, 'hdr')
    assert.equal(buildAssetMessage(A, new ArrayBuffer(1), { contentType: 'image/vnd.radiance' }).mime, 'image/vnd.radiance')
    assert.equal(readAssetCredits([{ sha256: A, kind: 'hdr', name: 'Sky' }])[0].kind, 'hdr')
  })
  it('holds an HDR sky to 8 MB, a model to 25 MB and an image to 3 MB', () => {
    assert.equal(MAX_HDR_BYTES, 8 * MB)
    assert.equal(assetByteLimit('hdr', null), 8 * MB)
    assert.equal(assetByteLimit(undefined, 'image/vnd.radiance'), 8 * MB)
    assert.equal(assetByteLimit('hdr', 'image/png'), 8 * MB)
  })
  it('holds a model to 25 MB and an image to 3 MB', () => {
    assert.equal(MAX_ASSET_BYTES, 25 * MB)
    assert.equal(MAX_IMAGE_BYTES, 3 * MB)
    assert.equal(assetByteLimit(undefined, null), 25 * MB)
    assert.equal(assetByteLimit('model', 'model/gltf-binary'), 25 * MB)
    assert.equal(assetByteLimit('image', null), 3 * MB)
    assert.equal(assetByteLimit(undefined, 'image/png'), 3 * MB)
    assert.equal(assetByteLimit('model', 'Image/JPEG; q=1'), 3 * MB, 'a model hint cannot lift the limit of a response that says it is an image')
    assert.equal(assetByteLimit('image', 'model/gltf-binary'), 3 * MB, 'nor can a response type lift the limit of a registered image')
  })

  it('refuses a model whose Content-Length is over 25 MB without reading it', async () => {
    const pulled = { count: 0 }
    stub(() => new Response(stream(2, 1024, pulled), { status: 200, headers: { 'Content-Length': String(MAX_ASSET_BYTES + 1) } }))
    await assert.rejects(fetchSimulationAsset(7, A), tooLarge)
    assert.ok(pulled.count <= 1, `read ${pulled.count} chunks`)
  })

  it('refuses a model that turns out bigger than 25 MB whatever it declared, and stops reading', async () => {
    const pulled = { count: 0 }
    stub(() => new Response(stream(40, MB, pulled), { status: 200 }))
    await assert.rejects(fetchSimulationAsset(7, A), tooLarge)
    assert.ok(pulled.count <= 27, `read ${pulled.count} chunks of 40`)
  })

  it('accepts a model of exactly 25 MB', async () => {
    const pulled = { count: 0 }
    stub(() => new Response(stream(25, MB, pulled), { status: 200 }))
    assert.equal((await fetchSimulationAsset(7, A)).byteLength, MAX_ASSET_BYTES)
  })

  it('refuses an image whose Content-Length is over 3 MB without reading it, however it is known to be an image', async () => {
    for (const [type, kind] of [['image/png', undefined], ['application/octet-stream', 'image'], ['image/jpeg', 'model']] as const) {
      const pulled = { count: 0 }
      stub(() => new Response(stream(4, MB, pulled), { status: 200, headers: { 'Content-Type': type, 'Content-Length': String(MAX_IMAGE_BYTES + 1) } }))
      await assert.rejects(fetchSimulationAssetFile(7, A, { kind }), tooLarge, `${type} ${kind}`)
      assert.ok(pulled.count <= 1, `${type}: read ${pulled.count} chunks`)
    }
  })

  it('refuses an image that turns out bigger than 3 MB whatever it declared, and stops reading', async () => {
    const pulled = { count: 0 }
    stub(() => new Response(stream(40, MB, pulled), { status: 200, headers: { 'Content-Type': 'image/png' } }))
    await assert.rejects(fetchSimulationAssetFile(7, A), tooLarge)
    assert.ok(pulled.count <= 5, `read ${pulled.count} chunks of 40`)
    // declaring less than it sends does not help either
    const lying = { count: 0 }
    stub(() => new Response(stream(10, MB, lying), { status: 200, headers: { 'Content-Type': 'image/webp', 'Content-Length': '1000' } }))
    await assert.rejects(fetchSimulationAssetFile(7, A, { kind: 'image' }), tooLarge)
    assert.ok(lying.count <= 5, `read ${lying.count} chunks of 10`)
  })

  it('accepts an image of exactly 3 MB, and a model of that size is of course fine', async () => {
    const pulled = { count: 0 }
    stub(() => new Response(stream(3, MB, pulled), { status: 200, headers: { 'Content-Type': 'image/png' } }))
    const image = await fetchSimulationAssetFile(7, A)
    assert.equal(image.bytes.byteLength, MAX_IMAGE_BYTES)
    assert.equal(image.kind, 'image')
    const again = { count: 0 }
    stub(() => new Response(stream(3, MB, again), { status: 200, headers: { 'Content-Type': 'model/gltf-binary' } }))
    assert.equal((await fetchSimulationAssetFile(7, A)).bytes.byteLength, MAX_IMAGE_BYTES)
  })

  it('turns a 404 into an error carrying the status and the server\'s own sentence', async () => {
    stub(() => new Response(JSON.stringify({ status: false, message: 'That model does not exist.' }), { status: 404, headers: { 'Content-Type': 'application/json' } }))
    await assert.rejects(fetchSimulationAsset(7, A), (err: unknown) => err instanceof ApiError && err.status === 404 && err.message === 'That model does not exist.')
  })

  it('turns any other failure into an error with the status, and a success that is not a 200 into one too', async () => {
    stub(() => new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }))
    await assert.rejects(fetchSimulationAsset(7, A), (err: unknown) => err instanceof ApiError && err.status === 502)
    stub(() => new Response(null, { status: 204 }))
    await assert.rejects(fetchSimulationAsset(7, A), (err: unknown) => err instanceof ApiError && err.status === 204)
  })
})
