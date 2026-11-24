import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { getRedirectStatusCodeFromError, getRedirectTypeFromError, getURLFromRedirectError } from 'next/dist/client/components/redirect'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import ServicesRedirect from '../app/module/crm/sales/services/page'
import ProductsRedirect from '../app/module/crm/sales/products/page'
import ProductPortfolioListRedirect from '../app/portfolio/page'
import CatalogueProductRedirect from '../app/module/crm/sales/products/[id]/page'
import CatalogueServiceRedirect from '../app/module/crm/sales/services/[id]/page'
import ProductLineRedirect from '../app/module/crm/sales/products/lines/[id]/page'
import { CRM_CONTENT } from '../hooks/content-map-crm'
import { parseOldId, portfolioRedirectTarget, productTarget, recordTarget, servicesRedirectTarget, subProductTarget, type RawSearchParams } from './portfolio-redirect'

/**
 * The old Products and Services addresses (hp_erp docs/agentic-crm/slices/S15-product-portfolio-merge.md, track P3-A) are redirect pages that send a visitor to the Product
 * Portfolio with the SAME query string. They name the old address on purpose, because they are the reason it still works: an Ask answer, a saved link or a bookmark carries it.
 * The list pages are called as functions, the way Next calls them (searchParams is a promise); a page that redirects throws Next's redirect error, which carries the address and
 * the status. The three record pages render the client redirect with what they were given; their lookups are proved in portfolio-redirect-screen.test.tsx.
 */

type ListPage = (props: { searchParams: Promise<RawSearchParams> }) => Promise<void>

async function visit(page: ListPage, params: RawSearchParams) {
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

describe('the Product Portfolio list address (/portfolio)', () => {
  // Owner, 24 Nov 2026: "we already have the Product Portfolio in the Market Signals tab, remove it from the side bar". The list lives in Market Signals; the old list address
  // (every earlier link and bookmark, and the Back links of the Product and Sub-product pages) sends a visitor there, keeping the query.
  it('sends a visit to the Product Portfolio tab of Market Signals as a temporary (307) redirect, keeping the query exactly', async () => {
    assert.deepEqual(await visit(ProductPortfolioListRedirect as ListPage, {}), { url: '/signals/portfolio', status: 307, type: 'replace' })
    assert.equal((await visit(ProductPortfolioListRedirect as ListPage, asNext('type=service&q=Fee%20ERP&per=50'))).url, '/signals/portfolio?type=service&q=Fee%20ERP&per=50')
    assert.equal((await visit(ProductPortfolioListRedirect as ListPage, asNext('view=matches'))).url, '/signals/portfolio?view=matches', 'the pair review address too')
  })

  it('cannot be used to send a person anywhere but the tab', async () => {
    for (const hostile of ['//evil.example', 'https://evil.example', '/\\evil', '..%2f..%2fadmin']) {
      const { url } = await visit(ProductPortfolioListRedirect as ListPage, { next: hostile, url: hostile })
      assert.ok(url.startsWith('/signals/portfolio?'), url)
    }
  })
})

describe('the Products address', () => {
  it('sends a visit with no query to /signals/portfolio (the list, a tab of Market Signals) as a temporary (307) redirect that replaces the history entry', async () => {
    assert.deepEqual(await visit(ProductsRedirect as ListPage, {}), { url: '/signals/portfolio', status: 307, type: 'replace' })
  })

  it('keeps the query exactly, in its order, with a repeated key repeated and a space as %20', async () => {
    assert.equal((await visit(ProductsRedirect as ListPage, asNext('q=Scholar%20ERP&scope=lines&status=archived'))).url, '/signals/portfolio?q=Scholar%20ERP&scope=lines&status=archived')
    assert.equal((await visit(ProductsRedirect as ListPage, asNext('product=1&product=2'))).url, '/signals/portfolio?product=1&product=2')
    assert.equal((await visit(ProductsRedirect as ListPage, asNext('q=a%26b%3Dc%23d'))).url, '/signals/portfolio?q=a%26b%3Dc%23d', 'characters that could cut an address short stay encoded')
  })

  it('cannot be used to send a person anywhere but /signals/portfolio', async () => {
    for (const evil of ['//evil.test', 'https://evil.test', '/\\evil.test', '@evil.test']) {
      const { url } = await visit(ProductsRedirect as ListPage, { next: evil, redirect: evil })
      assert.ok(url.startsWith('/signals/portfolio?'), url)
      assert.equal(new URL(url, 'http://app.test').host, 'app.test', url)
    }
  })

  it('leaves out a key that has no value at all and keeps one sent empty', async () => {
    assert.equal((await visit(ProductsRedirect as ListPage, { gone: undefined })).url, '/signals/portfolio')
    assert.equal((await visit(ProductsRedirect as ListPage, { q: '' })).url, '/signals/portfolio?q=')
  })
})

describe('the Services address', () => {
  it('opens the list on Services (type=service) as a temporary redirect, and keeps the rest of the query after it', async () => {
    assert.deepEqual(await visit(ServicesRedirect as ListPage, {}), { url: '/signals/portfolio?type=service', status: 307, type: 'replace' })
    assert.equal((await visit(ServicesRedirect as ListPage, asNext('q=support&status=all'))).url, '/signals/portfolio?q=support&status=all&type=service')
  })

  it('has the Services address say the type, whatever the old link said (a services link is the Service view)', async () => {
    assert.equal((await visit(ServicesRedirect as ListPage, asNext('type=subproduct&q=x'))).url, '/signals/portfolio?q=x&type=service')
    assert.equal(servicesRedirectTarget({ type: ['a', 'b'], q: 'x' }), '/signals/portfolio?q=x&type=service')
  })
})

describe('the helpers write one fixed path and read an id only as a number', () => {
  it('writes the four targets', () => {
    assert.equal(portfolioRedirectTarget({}), '/signals/portfolio')
    assert.equal(subProductTarget(77, { tab: 'history' }), '/portfolio/products/77?tab=history')
    assert.equal(productTarget('scholar clone', { tab: 'signals' }), '/portfolio/scholar%20clone?tab=signals', 'a key is encoded as one path segment')
    assert.equal(productTarget('a/b', {}), '/portfolio/a%2Fb')
    assert.equal(recordTarget({ id: 5, kind: 'product', key: 'scholarclone' }, { q: 'x' }), '/portfolio/scholarclone?q=x')
    assert.equal(recordTarget({ id: 6, kind: 'sub_product', key: 'scholarclone/sch-01' }, {}), '/portfolio/products/6')
    assert.equal(recordTarget({ id: 7, kind: 'item', key: 'crm/prd-1' }, {}), '/portfolio/products/7')
  })

  it('reads an id only when it is a whole number from 1 up and short enough to be exact', () => {
    assert.equal(parseOldId('63'), 63)
    for (const bad of [undefined, '', '0', '-1', '1.5', 'abc', '12abc', '007', ' 5', '5 ', '1e3', '99999999999999999999', '../etc/passwd', '5/../../x']) assert.equal(parseOldId(bad), null, String(bad))
  })
})

describe('the record pages hand the redirect what they were given', () => {
  const lookupOf = async (page: unknown, id: string, search: string) => {
    const element = await (page as (p: { params: Promise<{ id: string }>; searchParams: Promise<RawSearchParams> }) => Promise<{ props: { lookup: unknown; params: unknown } }>)({ params: Promise.resolve({ id }), searchParams: Promise.resolve(asNext(search)) })
    return element.props
  }

  it('a Product page with a catalogue id looks it up as a catalogue id, in both addresses', async () => {
    for (const page of [CatalogueProductRedirect, CatalogueServiceRedirect]) {
      const props = await lookupOf(page, '63', 'tab=history')
      assert.deepEqual(props.lookup, { kind: 'catalogue', id: '63' })
      assert.deepEqual(props.params, { tab: 'history' }, 'the query is handed on')
    }
  })

  it('a Product line page looks the id up as a master record', async () => {
    const props = await lookupOf(ProductLineRedirect, '9', 'tab=signals')
    assert.deepEqual(props.lookup, { kind: 'line', id: '9' })
    assert.deepEqual(props.params, { tab: 'signals' })
  })
})

describe('the content map no longer routes Products or Services', () => {
  it('has no entry for either address, and still routes the neighbours', () => {
    const links = CRM_CONTENT.map((route) => route.accessLink ?? '')
    assert.deepEqual(links.filter((link) => /\/sales\/(products|services)/.test(link)), [], 'neither address is in the content map: both are redirect pages')
    assert.ok(links.includes('/module/crm/sales/quotes'))
    assert.ok(links.includes('/module/crm/sales/price-books'))
  })
})
