import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { getRedirectStatusCodeFromError, getRedirectTypeFromError, getURLFromRedirectError } from 'next/dist/client/components/redirect'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import CrmSignalReviewRedirect from '../app/module/crm/signal-review/page'
import SignalReviewRedirect from '../app/signal-review/page'
import { CRM_CONTENT } from '../hooks/content-map-crm'
import { safeInternalPath } from './agent/model'
import { safeLink } from './ask/model'
import { DEFAULT_LINKS, signalHref } from './org-accounts/links'
import { signalsRedirectTarget, SIGNALS_ADDRESS, type RawSearchParams } from './signal-review-redirect'

/**
 * The two addresses of the retired Signal Review screen (hp_erp docs/agentic-crm/slices/S15-product-portfolio-merge.md, track P1-B) are redirect pages that send a visitor
 * to /signals with the SAME query string. They name the old address on purpose, because they are the reason it still works: an Ask answer or an agent run saved before the
 * merge carries it inside its stored text, and so does any bookmark. The pages are called as functions, the way Next calls them (searchParams is a promise); a page that
 * redirects throws Next's redirect error, which carries the address and the status.
 */

type Page = (props: { searchParams: Promise<RawSearchParams> }) => Promise<void>

const PAGES: Array<[string, Page]> = [
  ['/signal-review', SignalReviewRedirect as Page],
  ['/module/crm/signal-review', CrmSignalReviewRedirect as Page],
]

/** What a page does for a visit: where it sends the person, with which status and kind of redirect. */
async function visit(page: Page, params: RawSearchParams) {
  try {
    await page({ searchParams: Promise.resolve(params) })
  } catch (error) {
    if (isRedirectError(error)) return { url: getURLFromRedirectError(error)!, status: getRedirectStatusCodeFromError(error), type: getRedirectTypeFromError(error) }
    throw error
  }
  return assert.fail('the page did not redirect')
}

/** The way Next hands a query string to a page: a key seen once is a string, a key repeated is a list, in the order they arrived. */
function asNext(search: string): RawSearchParams {
  const out: Record<string, string | string[]> = {}
  for (const [key, value] of new URLSearchParams(search)) out[key] = key in out ? ([] as string[]).concat(out[key], value) : value
  return out
}

const entries = (url: string) => [...new URL(url, 'http://app.test').searchParams.entries()]

for (const [address, page] of PAGES) {
  describe(`the redirect page for ${address}`, () => {
    it('sends a visit with no query to /signals as a temporary (307) redirect that replaces the history entry', async () => {
      assert.deepEqual(await visit(page, {}), { url: '/signals', status: 307, type: 'replace' })
    })

    it('keeps the query of an old link exactly, including an encoded title: it is the address the link makers write today', async () => {
      const made = signalHref(DEFAULT_LINKS, 'A & B plan')!
      assert.equal(made, '/signals?status=all&q=A%20%26%20B%20plan')
      const old = '/signal-review?status=all&q=A%20%26%20B%20plan'
      assert.equal((await visit(page, asNext(old.split('?')[1]))).url, made, 'the old link lands on the very address a new link would have')
    })

    it('keeps every name the old screen read, with its value and in its order', async () => {
      const query = 'q=school%20software&status=dismissed&product=12&freshness=recent&fit=high&sort=newest&page=3'
      const { url } = await visit(page, asNext(query))
      assert.equal(url, `/signals?${query}`)
      assert.deepEqual(entries(url), [['q', 'school software'], ['status', 'dismissed'], ['product', '12'], ['freshness', 'recent'], ['fit', 'high'], ['sort', 'newest'], ['page', '3']])
    })

    it('keeps a repeated key as a repeated key', async () => {
      const { url } = await visit(page, asNext('product=1&product=2&status=new&product=3'))
      assert.equal(url, '/signals?product=1&product=2&product=3&status=new')
      assert.deepEqual(new URL(url, 'http://app.test').searchParams.getAll('product'), ['1', '2', '3'])
    })

    it('keeps a value with characters that could cut an address short, and an empty value', async () => {
      for (const title of ['100% sure + more #1 ? yes', 'विद्यालय का नया परिसर', "O'Neil (Pvt) Ltd*", 'a/b\\c', '   ', 'line\nbreak']) {
        const { url } = await visit(page, { status: 'all', q: title })
        assert.equal(new URL(url, 'http://app.test').searchParams.get('q'), title, title)
        assert.equal(new URL(url, 'http://app.test').hash, '', 'no fragment was made from the title')
      }
      assert.equal((await visit(page, { q: '' })).url, '/signals?q=')
    })

    it('cannot be used to send a person anywhere but /signals', async () => {
      const hostile: RawSearchParams = { q: 'https://evil.example/x', next: '//evil.example', redirect: '/login', 'a=b&c': 'd#e', '/': '\\evil.example' }
      const { url } = await visit(page, hostile)
      const parsed = new URL(url, 'http://app.test')
      assert.equal(parsed.origin, 'http://app.test')
      assert.equal(parsed.pathname, '/signals')
      assert.equal(url.startsWith('/signals?'), true)
      assert.equal(parsed.searchParams.get('q'), 'https://evil.example/x')
      assert.equal(parsed.searchParams.get('a=b&c'), 'd#e', 'a key is encoded too, so it cannot add a parameter of its own')
    })

    it('leaves out a key that has no value at all', async () => {
      assert.equal((await visit(page, { a: undefined, b: '1' })).url, '/signals?b=1')
      assert.equal((await visit(page, { a: undefined })).url, '/signals')
    })
  })
}

describe('the two pages are one redirect', () => {
  it('answer the same for the same query', async () => {
    for (const search of ['', 'status=all&q=Tapovan%20School', 'product=1&product=2', 'q=']) {
      assert.deepEqual(await visit(PAGES[0][1], asNext(search)), await visit(PAGES[1][1], asNext(search)), search)
    }
  })

  it('both go through the helper, which has the one fixed path', () => {
    assert.equal(SIGNALS_ADDRESS, '/signals')
    assert.equal(signalsRedirectTarget({}), '/signals')
    assert.equal(signalsRedirectTarget({ q: 'x' }), '/signals?q=x')
  })
})

describe('a link stored before the merge still lands on the same signal search', () => {
  it('an Ask answer written before 13 Nov 2026 carries the old address, which the chat still draws as a link, and the page redirects it', async () => {
    const stored = '/module/crm/signal-review?status=all&q=Tapovan%20School'
    assert.deepEqual(safeLink(stored), { href: stored, external: false }, 'the chat does not refuse the old address')
    const { url } = await visit(CrmSignalReviewRedirect as Page, asNext(stored.split('?')[1]))
    assert.equal(url, '/signals?status=all&q=Tapovan%20School')
  })

  it('an agent run saved before the merge carries the old address, which the evidence list still draws as a link, and the page redirects it', async () => {
    const stored = '/module/crm/signal-review?status=all&q=Hillcrest'
    assert.equal(safeInternalPath(stored), stored)
    assert.equal((await visit(CrmSignalReviewRedirect as Page, asNext(stored.split('?')[1]))).url, '/signals?status=all&q=Hillcrest')
  })
})

describe('the content map no longer routes the retired screen', () => {
  it('has no entry for either address, and still routes /signals', () => {
    const links = CRM_CONTENT.map((route) => route.accessLink ?? '')
    assert.deepEqual(links.filter((link) => link.includes('signal-review')), [], 'neither address is in the content map')
    assert.ok(links.includes('/signals'), 'Company Opportunities is still routed')
    assert.ok(links.includes('/module/crm/signals'))
    assert.ok(links.includes('/module/crm/marketing/signal-inbox'), 'Signal Inbox is untouched')
  })
})
