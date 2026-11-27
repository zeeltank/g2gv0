import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fetchSharedItem, fileWord, hostOf, parseSharedItem, sharedFileUrl, sizeWords, TOKEN_PATTERN, viewOf, type SharedKitItem } from './shared-item'
import { API, fakeFetch, json, payload, TOKEN } from './shared-kit-fixtures'

/**
 * What the public page asks of the server and how it checks the answer. The one rule: an item comes back only for a 200 with exactly the right shape, and EVERY other outcome is `null`, the same
 * `null`, so the page can only ever answer the same plain 404.
 */

describe('the token', () => {
  it('is 48 letters and digits, and nothing else is one', () => {
    assert.equal(TOKEN.length, 48)
    assert.equal(TOKEN_PATTERN.test(TOKEN), true)
    for (const bad of ['', TOKEN.slice(1), `${TOKEN}a`, `${TOKEN.slice(1)}-`, `${TOKEN.slice(1)}/`, `${TOKEN.slice(1)}.`, `${TOKEN.slice(1)} `, `${TOKEN.slice(1)}é`, `../${TOKEN.slice(3)}`, 'x'.repeat(500)]) {
      assert.equal(TOKEN_PATTERN.test(bad), false, JSON.stringify(bad))
    }
  })
})

describe('fetchSharedItem', () => {
  it('returns the item for a 200 with the right shape, and only the fields it knows', async () => {
    const { impl } = fakeFetch(() => json(payload({ documentId: 501, subInstituteId: 6, createdBy: 7, createdByName: 'Asha Rao', share_token: TOKEN })))
    const item = await fetchSharedItem(TOKEN, { fetchImpl: impl, apiBase: API })
    assert.deepEqual(item, {
      title: 'ScholarClone client presentation',
      description: 'The same story as a PowerPoint.',
      kind: 'presentation',
      source: 'file',
      productName: 'ScholarClone',
      fileName: 'ScholarClone-Client-Presentation.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      size: 57_400_000,
      url: null,
      deck: null,
      expiresAt: '2026-12-27 12:00:00',
    })
    assert.deepEqual(Object.keys(item as object).sort(), ['deck', 'description', 'expiresAt', 'fileName', 'kind', 'mimeType', 'productName', 'size', 'source', 'title', 'url'], 'no private field is carried through, even when one is sent')
  })

  it('asks the public route for exactly this token, with no credentials, no cookie, no Authorization, no cache and no redirect', async () => {
    const { impl, seen } = fakeFetch(() => json(payload()))
    await fetchSharedItem(TOKEN, { fetchImpl: impl, apiBase: API })
    assert.equal(seen.length, 1)
    assert.equal(seen[0].url, `${API}/public/sales-kit/${TOKEN}`)
    const init = seen[0].init
    assert.equal(init.method, 'GET')
    assert.deepEqual(init.headers, { Accept: 'application/json' }, 'the one header is Accept')
    assert.equal(init.credentials, 'omit')
    assert.equal(init.cache, 'no-store')
    assert.equal(init.redirect, 'error')
    assert.equal(init.body, undefined)
    assert.ok(init.signal, 'it does not wait for ever')
  })

  it('returns null for every status that is not 200, even when the body looks like a real item', async () => {
    for (const status of [301, 302, 400, 401, 403, 404, 410, 422, 429, 500, 502, 503]) {
      const { impl } = fakeFetch(() => json(payload(), status))
      assert.equal(await fetchSharedItem(TOKEN, { fetchImpl: impl, apiBase: API }), null, String(status))
    }
  })

  it('returns the same null for the server\'s own plain 404', async () => {
    const { impl } = fakeFetch(() => json({ status: 0, message: 'This link is not available.' }, 404))
    assert.equal(await fetchSharedItem(TOKEN, { fetchImpl: impl, apiBase: API }), null)
  })

  it('asks nothing at all for a token of the wrong shape', async () => {
    const { impl, seen } = fakeFetch(() => json(payload()))
    for (const bad of ['', 'short', `${TOKEN}x`, `${TOKEN.slice(1)}!`, '../../etc/passwd', `${TOKEN.slice(0, 47)}/`]) assert.equal(await fetchSharedItem(bad, { fetchImpl: impl, apiBase: API }), null, bad)
    assert.equal(seen.length, 0, 'not one request')
  })

  it('returns null when the request fails, runs out of time, or the body is not JSON', async () => {
    for (const impl of [
      (async () => { throw new TypeError('fetch failed') }) as typeof fetch,
      (async () => { throw new DOMException('timed out', 'TimeoutError') }) as typeof fetch,
      (async () => new Response('<html>Bad gateway</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })) as typeof fetch,
      (async () => new Response('', { status: 200 })) as typeof fetch,
    ]) assert.equal(await fetchSharedItem(TOKEN, { fetchImpl: impl, apiBase: API }), null)
  })

  it('returns null for a 200 whose body is not exactly an item', async () => {
    const wrong: Array<[string, unknown]> = [
      ['status 0', { ...payload(), status: 0 }],
      ['no status', { data: payload().data }],
      ['no data', { status: 1 }],
      ['data is a list', { status: 1, data: [] }],
      ['an array', []],
      ['null', null],
      ['a string', 'ok'],
      ['no title', payload({ title: undefined })],
      ['a blank title', payload({ title: '   ' })],
      ['a title that is a number', payload({ title: 7 })],
      ['no product name', payload({ productName: undefined })],
      ['a kind of our own invention', payload({ kind: 'link' })],
      ['no kind', payload({ kind: undefined })],
      ['a source of our own invention', payload({ source: 'folder' })],
      ['a file that carries an address', payload({ url: 'https://example.com/x' })],
      ['a file that carries a deck', payload({ deck: 'scholarclone' })],
      ['a link with neither address nor deck', payload({ source: 'link' })],
      ['a link with both', payload({ source: 'link', url: 'https://example.com/x', deck: 'scholarclone' })],
      ['an address that is http', payload({ source: 'link', url: 'http://example.com/x' })],
      ['an address that is javascript', payload({ source: 'link', url: 'javascript:alert(1)' })],
      ['an address that is a path', payload({ source: 'link', url: '/module/crm/leads' })],
      ['a protocol-relative address', payload({ source: 'link', url: '//evil.test/x' })],
      ['an address with a space', payload({ source: 'link', url: 'https://exa mple.com' })],
      ['a deck key that is not a plain key', payload({ source: 'link', deck: '../../x' })],
      ['a deck key in capitals', payload({ source: 'link', deck: 'ScholarClone' })],
      ['a negative size', payload({ size: -1 })],
      ['a size that is text', payload({ size: '57' })],
      ['a description that is a number', payload({ description: 5 })],
      ['a file name that is an object', payload({ fileName: {} })],
    ]
    for (const [name, body] of wrong) {
      const { impl } = fakeFetch(() => json(body))
      assert.equal(await fetchSharedItem(TOKEN, { fetchImpl: impl, apiBase: API }), null, name)
    }
  })

  it('accepts an external link, and the deck, with nothing else filled in', async () => {
    const link = parseSharedItem(payload({ source: 'link', kind: 'video', url: 'https://example.com/watch?v=1', fileName: null, mimeType: null, size: null }))
    assert.equal(link?.url, 'https://example.com/watch?v=1')
    const deck = parseSharedItem(payload({ source: 'link', kind: 'presentation', deck: 'scholarclone', fileName: null, mimeType: null, size: null, expiresAt: null }))
    assert.equal(deck?.deck, 'scholarclone')
    assert.equal(deck?.expiresAt, null)
    assert.equal(parseSharedItem(payload({ description: null }))?.description, null)
    assert.equal(parseSharedItem(payload({ description: '   ' }))?.description, null, 'a blank line is no line')
  })
})

describe('how each entry is shown', () => {
  const file = (over: Partial<SharedKitItem>): SharedKitItem => ({ ...(parseSharedItem(payload()) as SharedKitItem), ...over })

  it('shows a PDF, a picture and a video in the page, by their type', () => {
    assert.deepEqual(viewOf(file({ mimeType: 'application/pdf', fileName: 'a.pdf' })), { mode: 'pdf' })
    for (const mimeType of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) assert.deepEqual(viewOf(file({ mimeType, fileName: 'a.img' })), { mode: 'image' }, mimeType)
    for (const mimeType of ['video/mp4', 'video/webm', 'video/quicktime']) assert.deepEqual(viewOf(file({ mimeType, fileName: 'a.vid' })), { mode: 'video' }, mimeType)
  })

  it('makes every other file a download, however it is named', () => {
    for (const [mimeType, fileName] of [
      ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'deck.pptx'],
      ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx'],
      ['application/vnd.ms-excel', 'a.xls'],
      ['text/plain', 'a.txt'],
      ['image/svg+xml', 'a.svg'],
      ['text/html', 'a.html'],
      ['application/pdf', 'a.pptx'],
    ] as const) {
      const expected = mimeType === 'application/pdf' ? 'pdf' : 'download'
      assert.deepEqual(viewOf(file({ mimeType, fileName })), { mode: expected }, `${mimeType} ${fileName}`)
    }
  })

  it('goes by the file name only when the server sent no type', () => {
    assert.deepEqual(viewOf(file({ mimeType: null, fileName: 'a.PDF' })), { mode: 'pdf' })
    assert.deepEqual(viewOf(file({ mimeType: 'application/octet-stream', fileName: 'a.mp4' })), { mode: 'video' })
    assert.deepEqual(viewOf(file({ mimeType: null, fileName: 'a.pptx' })), { mode: 'download' })
    assert.deepEqual(viewOf(file({ mimeType: null, fileName: null })), { mode: 'download' })
    assert.deepEqual(viewOf(file({ mimeType: 'application/vnd.ms-powerpoint', fileName: 'a.pdf' })), { mode: 'download' }, 'the server\'s type wins over a name')
  })

  it('opens an address as a link, and the deck as the player only for a deck this site has', () => {
    assert.deepEqual(viewOf(file({ source: 'link', url: 'https://example.com/x', fileName: null, mimeType: null })), { mode: 'link', url: 'https://example.com/x' })
    assert.deepEqual(viewOf(file({ source: 'link', deck: 'scholarclone', fileName: null, mimeType: null })), { mode: 'deck', deck: 'scholarclone' })
    assert.equal(viewOf(file({ source: 'link', deck: 'some-other-deck', fileName: null, mimeType: null })), null, 'a deck we do not have is a 404, not a page that tries')
    assert.equal(viewOf(file({ source: 'link', url: null, deck: null })), null)
  })

  it('writes the address of the file on the API, inline or to save', () => {
    assert.equal(sharedFileUrl(API, TOKEN, true), `${API}/public/sales-kit/${TOKEN}/file?inline=1`)
    assert.equal(sharedFileUrl(API, TOKEN, false), `${API}/public/sales-kit/${TOKEN}/file`)
  })

  it('writes sizes as the rest of the app does, and names a file for a visitor', () => {
    assert.equal(sizeWords(57_400_000), '54.7 MB')
    assert.equal(sizeWords(480_000), '469 KB')
    assert.equal(sizeWords(12), '12 B')
    assert.equal(sizeWords(null), null)
    assert.equal(sizeWords(0), null)
    assert.equal(fileWord('a.pptx', null), 'PowerPoint')
    assert.equal(fileWord('a.docx', null), 'Word document')
    assert.equal(fileWord('a.xlsx', null), 'Spreadsheet')
    assert.equal(fileWord('a.bin', null), 'File')
    assert.equal(hostOf('https://www.example.com/a?b=1'), 'www.example.com')
    assert.equal(hostOf('not a url'), '')
  })
})
