import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { salesKitService } from '../../services/product-master/kit-service'

/**
 * The REAL requests the Sales Kit tab sends. The screen tests replace this service with an in-memory fake, which cannot see an address, a method, a body or a header: a misspelt route or a
 * dropped bearer header would leave every screen test green while the server answered 404. No request leaves the process: `fetch` is replaced for each test, and a signed-in person is faked
 * in `window` so the shared client can read a token.
 */
interface Call { url: URL; init?: RequestInit }

const restore: Array<() => void> = []
let calls: Call[] = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

function signedIn(token: string | null) {
  const g = globalThis as { window?: unknown }
  const original = g.window
  g.window = { localStorage: { getItem: () => (token === null ? null : JSON.stringify({ token })) }, sessionStorage: { getItem: () => null } }
  restore.push(() => { if (original === undefined) delete g.window; else g.window = original })
}

function fakeFetch(answer: () => Response = () => new Response(JSON.stringify({ status: 1, data: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } })) {
  calls = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: new URL(String(input), 'http://localhost'), init })
    return answer()
  }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
}

const header = (call: Call, name: string): string | undefined => (call.init?.headers as Record<string, string> | undefined)?.[name]
const path = (call: Call) => call.url.pathname.replace(/^.*\/api/, '')
const method = (call: Call) => call.init?.method ?? 'GET'

describe('the Sales Kit service sends the real requests', () => {
  beforeEach(() => { signedIn('tok-9'); fakeFetch() })

  it('reads the kit of one Product, and searches the library for it, with the bearer token and no token in the address', async () => {
    await salesKitService.get(1)
    await salesKitService.searchLibrary(1, 'board')
    assert.deepEqual(calls.map((c) => [method(c), path(c)]), [['GET', '/product-master/1/kit'], ['GET', '/product-master/1/kit/library-search']])
    assert.equal(calls[1].url.searchParams.get('q'), 'board')
    for (const c of calls) {
      assert.equal(header(c, 'Authorization'), 'Bearer tok-9')
      assert.equal(c.url.searchParams.has('token'), false, 'the credential is not in the address')
    }
  })

  it('adds a link and a library document as JSON, to their own routes', async () => {
    await salesKitService.addLink(1, { title: 'Deck', url: '/signals/portfolio/deck/scholarclone', kind: 'presentation', description: 'Present this' })
    await salesKitService.fromLibrary(1, { documentId: 71, title: 'Board pack', makeShared: true })
    assert.deepEqual(calls.map((c) => [method(c), path(c)]), [['POST', '/product-master/1/kit/links'], ['POST', '/product-master/1/kit/from-library']])
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { title: 'Deck', url: '/signals/portfolio/deck/scholarclone', kind: 'presentation', description: 'Present this' })
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { documentId: 71, title: 'Board pack', makeShared: true })
    assert.equal(header(calls[0], 'Content-Type'), 'application/json')
  })

  it('uploads a file as multipart under the name "file", with the title, line and kind only when given, and no JSON content type', async () => {
    await salesKitService.uploadFile(1, new File(['pptx'], 'deck.pptx'), { title: 'Spring deck', description: 'For schools', kind: 'presentation' })
    await salesKitService.uploadFile(1, new File(['pdf'], 'a.pdf'))
    assert.deepEqual(calls.map((c) => [method(c), path(c)]), [['POST', '/product-master/1/kit/files'], ['POST', '/product-master/1/kit/files']])
    const full = calls[0].init?.body as FormData
    assert.ok(full instanceof FormData, 'the body is a form')
    assert.equal((full.get('file') as File).name, 'deck.pptx')
    assert.deepEqual([full.get('title'), full.get('description'), full.get('kind')], ['Spring deck', 'For schools', 'presentation'])
    assert.equal(header(calls[0], 'Content-Type'), undefined, 'the browser sets the boundary')
    const bare = calls[1].init?.body as FormData
    for (const name of ['title', 'description', 'kind']) assert.equal(bare.has(name), false, `${name} is not sent when nobody gave it`)
  })

  it('edits with PATCH and removes with DELETE, by the entry\'s id', async () => {
    await salesKitService.update(1, 7, { title: 'New', sortOrder: 2 })
    await salesKitService.remove(1, 7)
    assert.deepEqual(calls.map((c) => [method(c), path(c)]), [['PATCH', '/product-master/1/kit/7'], ['DELETE', '/product-master/1/kit/7']])
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { title: 'New', sortOrder: 2 })
  })

  it('reads a file as a blob from the download route, with ?inline=1 only when it is to be shown', async () => {
    fakeFetch(() => new Response('bytes', { status: 200, headers: { 'Content-Type': 'application/pdf' } }))
    const saved = await salesKitService.fetchFile(1, 7)
    const shown = await salesKitService.fetchFile(1, 7, { inline: true })
    assert.deepEqual(calls.map((c) => [method(c), path(c), c.url.searchParams.get('inline')]), [['GET', '/product-master/1/kit/7/download', null], ['GET', '/product-master/1/kit/7/download', '1']])
    assert.equal(header(calls[0], 'Authorization'), 'Bearer tok-9')
    assert.equal(await saved.text(), 'bytes')
    assert.ok(shown instanceof Blob)
  })

  it('turns a refusal into an error that carries the server\'s own sentence and status', async () => {
    fakeFetch(() => new Response(JSON.stringify({ status: 0, message: 'The Sales Kit is not set up on this server yet.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    await assert.rejects(() => salesKitService.get(1), (error: Error & { status?: number }) => error.message === 'The Sales Kit is not set up on this server yet.' && error.status === 503)
  })

  it('makes or renews a public link with POST .../share and the number of days, and sends no days when none were chosen', async () => {
    await salesKitService.share(1, 7, { days: 90 })
    await salesKitService.share(1, 7, { days: 0 })
    await salesKitService.share(1, 7)
    assert.deepEqual(calls.map((c) => [method(c), path(c)]), [['POST', '/product-master/1/kit/7/share'], ['POST', '/product-master/1/kit/7/share'], ['POST', '/product-master/1/kit/7/share']])
    assert.deepEqual(calls.map((c) => JSON.parse(String(c.init?.body))), [{ days: 90 }, { days: 0 }, {}], 'no expiry is sent as 0, and an absent choice is left to the server\'s default')
    for (const c of calls) assert.equal(header(c, 'Authorization'), 'Bearer tok-9')
  })

  it('stops sharing with DELETE .../share, by the entry\'s id and nothing else', async () => {
    await salesKitService.stopSharing(1, 7)
    assert.deepEqual(calls.map((c) => [method(c), path(c)]), [['DELETE', '/product-master/1/kit/7/share']])
    assert.equal(calls[0].init?.body, undefined)
    assert.equal(header(calls[0], 'Authorization'), 'Bearer tok-9')
  })
})
