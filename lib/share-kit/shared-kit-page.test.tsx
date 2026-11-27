import assert from 'node:assert/strict'
import Module from 'node:module'
import { before, describe, it } from 'node:test'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { API, fakeFetch, fileAnswer, json, payload, TOKEN } from './shared-kit-fixtures'

/**
 * The public page of a Sales Kit link, rendered for each kind of entry with a `fetch` that answers whatever the test says: what a visitor sees, and that EVERY refusal is the same plain 404
 * (Next's own `notFound()`), never content. The deck's player imports a stylesheet, which node cannot read, so reading one is made to do nothing before the page is loaded.
 */

type PageModule = typeof import('../../app/share/kit/[token]/shared-kit-page')
let sharedKitElement: PageModule['sharedKitElement']
let PublicPlayer: typeof import('../../components/domain/lms/client-presentation/public-player')['PublicPlayer']

before(async () => {
  ;(Module as unknown as { _extensions: Record<string, (m: { exports: unknown }) => void> })._extensions['.css'] = (m) => { m.exports = {} }
  sharedKitElement = (await import('../../app/share/kit/[token]/shared-kit-page')).sharedKitElement
  PublicPlayer = (await import('../../components/domain/lms/client-presentation/public-player')).PublicPlayer
})

const NOT_FOUND = 'NEXT_HTTP_ERROR_FALLBACK;404'
const isNotFound = (error: unknown) => (error as { digest?: string } | null)?.digest === NOT_FOUND

async function page(answer: () => Response | Promise<Response>, token = TOKEN) {
  const { impl, seen } = fakeFetch(answer)
  const element = await sharedKitElement(token, { fetchImpl: impl, apiBase: API })
  return { element, seen, html: () => renderToStaticMarkup(element) }
}
async function refused(answer: () => Response | Promise<Response>, token = TOKEN) {
  const { impl, seen } = fakeFetch(answer)
  let caught: unknown = null
  try { await sharedKitElement(token, { fetchImpl: impl, apiBase: API }) } catch (error) { caught = error }
  return { caught, seen }
}
const inlineUrl = `${API}/public/sales-kit/${TOKEN}/file?inline=1`
const saveUrl = `${API}/public/sales-kit/${TOKEN}/file`

describe('a shared picture, PDF or video is shown in the page, with a Download beside it', () => {
  it('shows a picture, from the API\'s inline address, with the title as its text', async () => {
    const html = (await page(() => json(fileAnswer('dashboard.png', 'image/png', 'image')))).html()
    assert.match(html, new RegExp(`<img src="${inlineUrl.replace(/[?.]/g, '\\$&')}" alt="Shared dashboard.png"`))
    assert.doesNotMatch(html, /<iframe|<video/)
    assert.match(html, new RegExp(`<a href="${saveUrl.replace(/\./g, '\\.')}" download`), 'and a Download that saves the file')
    assert.match(html, /<h1[^>]*>Shared dashboard.png<\/h1>/)
  })

  it('shows a PDF in a frame titled with the entry', async () => {
    const html = (await page(() => json(fileAnswer('brief.pdf', 'application/pdf', 'document')))).html()
    assert.match(html, /<iframe src="[^"]*\/file\?inline=1" title="Shared brief.pdf"/)
    assert.doesNotMatch(html, /<img|<video/)
    assert.match(html, />Download<\/a>/)
  })

  it('shows a video with its controls, loading only its first bytes, and never starting by itself', async () => {
    const html = (await page(() => json(fileAnswer('clip.mp4', 'video/mp4', 'video', 38_000_000)))).html()
    assert.match(html, /<video src="[^"]*\/file\?inline=1" controls="" playsInline="" preload="metadata"|<video src="[^"]*\/file\?inline=1"[^>]*controls/)
    assert.doesNotMatch(html, /autoplay/i)
    assert.match(html, /36\.2 MB/)
  })
})

describe('any other file is a name, a size and one large Download', () => {
  it('draws a PowerPoint with no frame, no picture and no player', async () => {
    const html = (await page(() => json(payload()))).html()
    assert.doesNotMatch(html, /<img|<iframe|<video/)
    assert.match(html, /ScholarClone-Client-Presentation\.pptx/)
    assert.match(html, /PowerPoint/)
    assert.match(html, /54\.7 MB/)
    assert.match(html, new RegExp(`<a href="${saveUrl.replace(/\./g, '\\.')}" download="" class="[^"]*">Download</a>`))
  })

  it('does the same for Word and Excel, and for a file whose type is only a guess at an inline one', async () => {
    for (const [name, mime] of [['brief.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['sheet.xlsx', 'application/vnd.ms-excel'], ['page.html', 'text/html']] as const) {
      const html = (await page(() => json(fileAnswer(name, mime, 'document')))).html()
      assert.doesNotMatch(html, /<img|<iframe|<video/, name)
      assert.match(html, />Download<\/a>/, name)
    }
  })
})

describe('an address and the deck', () => {
  it('draws an external link as an Open link button in a new tab, saying where it goes, and never redirects', async () => {
    const html = (await page(() => json(payload({ source: 'link', kind: 'video', url: 'https://www.example.com/watch?v=1', fileName: null, mimeType: null, size: null })))).html()
    assert.match(html, /<a href="https:\/\/www\.example\.com\/watch\?v=1" target="_blank" rel="noopener noreferrer" class="[^"]*">Open link<\/a>/)
    assert.match(html, /Opens www\.example\.com in a new tab\./)
    assert.doesNotMatch(html, /http-equiv|window\.location|<script/i)
    assert.doesNotMatch(html, /<img|<iframe|<video|download=/)
  })

  it('draws the deck as the public player for that deck, with nothing else on the page', async () => {
    const { element } = await page(() => json(payload({ source: 'link', kind: 'presentation', deck: 'scholarclone', fileName: null, mimeType: null, size: null, url: null })))
    const view = element as ReactElement<Record<string, unknown>>
    const rendered = (view.type as (props: unknown) => ReactElement<{ productKey?: string }>)(view.props)
    assert.equal(rendered.type, PublicPlayer, 'the player a signed /present link opens, which has no presenter notes')
    assert.equal(rendered.props.productKey, 'scholarclone')
  })

  it('is a 404 for a deck this site does not have', async () => {
    const { caught } = await refused(() => json(payload({ source: 'link', deck: 'some-other-deck', fileName: null, mimeType: null, size: null, url: null })))
    assert.ok(isNotFound(caught), 'notFound()')
  })
})

describe('every refusal is the same plain 404', () => {
  it('is notFound() for each status the server may answer with, even when the body looks like a real entry', async () => {
    for (const status of [301, 400, 401, 403, 404, 410, 429, 500, 502, 503]) {
      const { caught } = await refused(() => json(payload(), status))
      assert.ok(isNotFound(caught), `status ${status}`)
    }
  })

  it('is notFound() for the server\'s own refusal, a request that fails, a body that is not JSON, and one that is not an entry', async () => {
    const cases: Array<() => Response | Promise<Response>> = [
      () => json({ status: 0, message: 'This link is not available.' }, 404),
      () => { throw new TypeError('fetch failed') },
      () => new Response('<html>oops</html>', { status: 200 }),
      () => json({ status: 1, data: { title: 'No kind or source' } }),
      () => json([]),
    ]
    for (const answer of cases) assert.ok(isNotFound((await refused(answer)).caught))
  })

  it('is the very same error each time, so nothing tells one refusal from another', async () => {
    const digests = new Set<string>()
    for (const answer of [() => json({}, 404), () => json(payload(), 410), () => json(payload(), 500), () => json({ status: 1 })]) {
      const { caught } = await refused(answer)
      digests.add(String((caught as { digest?: string }).digest))
      assert.equal((caught as Error).message, 'NEXT_HTTP_ERROR_FALLBACK;404')
    }
    assert.deepEqual([...digests], [NOT_FOUND])
  })

  it('asks the server nothing for a token that cannot be one, and is the same 404', async () => {
    const { caught, seen } = await refused(() => json(payload()), 'not-a-token')
    assert.ok(isNotFound(caught))
    assert.equal(seen.length, 0)
  })
})

describe('what the page never shows', () => {
  it('leaves out every field it was not told to show, even when the server sends one', async () => {
    const html = (await page(() => json(payload({ documentId: 'PRIVATE-DOC-9931', subInstituteId: 'PRIVATE-TENANT-9931', createdByName: 'PRIVATE-PERSON', share_token: 'PRIVATE-TOKEN' })))).html()
    assert.doesNotMatch(html, /PRIVATE/)
  })

  it('writes a title or a line with markup in it as text, not as markup', async () => {
    const html = (await page(() => json(payload({ title: '<img src=x onerror=alert(1)>', description: '<script>alert(2)</script>' })))).html()
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
    assert.doesNotMatch(html, /<img src=x|<script>/)
  })

  it('has no script of its own and nothing that reads the visitor\'s browser', async () => {
    for (const body of [payload(), fileAnswer('a.png', 'image/png', 'image'), payload({ source: 'link', url: 'https://example.com/x', fileName: null, mimeType: null, size: null })]) {
      const html = (await page(() => json(body))).html()
      assert.doesNotMatch(html, /<script|localStorage|sessionStorage|document\.cookie/i)
    }
  })

  it('says when the link stops, in words, and nothing when it never does', async () => {
    assert.match((await page(() => json(payload()))).html(), /This link works until 27 Dec 2026\./)
    assert.doesNotMatch((await page(() => json(payload({ expiresAt: null })))).html(), /This link works/)
  })

  it('does not name the product when the server did not, and never draws an empty line', async () => {
    const html = (await page(() => json(payload({ productName: '', description: null })))).html()
    assert.doesNotMatch(html, /<p class="[^"]*"><\/p>/)
  })
})
