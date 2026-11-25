import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { axeViolations } from '../agent/a11y'
import type { OpportunityListResponse, OpportunityQuery } from '../../services/signals/opportunities'
import { csvFileName, CSV_HEADERS, EXPORT_CAP } from './export-csv'
import { opportunity, opportunityList } from './opportunity-fixtures'
import { captureDownloads, disposeAll, openScreen, pressLabel, type Kit } from './screen-harness'

/**
 * "Export CSV" on Company Opportunities: the Signal Review's export, beside the page size, in every scope. The whole screen in a fake browser with a list
 * service that answers by page and remembers what it was asked. The last group puts the REAL list service back and fakes `fetch`, because a screen test
 * that fakes the service cannot see the address the service builds.
 */

const BOM = '﻿'

/** The file read back the way a spreadsheet would: records on CRLF outside quotes, fields on commas outside quotes. */
function parseCsv(text: string): string[][] {
  const body = text.startsWith(BOM) ? text.slice(1) : text
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') { field += '"'; i += 1 } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { record.push(field); field = '' } else if (ch === '\r' && body[i + 1] === '\n') { record.push(field); records.push(record); record = []; field = ''; i += 1 }
    else field += ch
  }
  assert.equal(field, '', 'the file ends with a line end')
  return records
}

/** A server with `total` signals that answers by page (`page`, `perPage` of the request), like the real list. `hold` keeps one page back until the test lets it go. */
function pagedServer(total: number, options: { hold?: (page: number) => Promise<void> | undefined; fail?: (page: number) => boolean; make?: (id: number) => ReturnType<typeof opportunity> } = {}) {
  const all = Array.from({ length: total }, (_, i) => (options.make ?? ((id) => opportunity({ id, title: `Signal ${id}`, company_name: `School ${id}` })))(total - i))
  const list = async (q: OpportunityQuery): Promise<OpportunityListResponse> => {
    const perPage = q.perPage ?? 5
    const page = q.page ?? 1
    await options.hold?.(page)
    if (options.fail?.(page) && perPage === 50) throw new Error('The server is busy.')
    return opportunityList(all.slice((page - 1) * perPage, page * perPage), {
      meta: { page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) },
      summary: { total, new: total, high_priority: 0, follow_up: 0 },
    })
  }
  return list
}

function gate() {
  let open!: () => void
  const closed = new Promise<void>((resolve) => { open = resolve })
  return { closed, open }
}

const exportButton = (k: Kit) => k.all('button').find((b) => /^Export/.test(b.textContent?.trim() ?? '')) as HTMLButtonElement
const notice = (k: Kit) => k.all('[role="status"], [role="alert"]').map((el) => el.textContent ?? '').join(' | ')
/** The requests the export made: the ones that ask for 50 to a page (these tests leave the list itself on five). */
const exportRequests = (calls: OpportunityQuery[]) => calls.filter((q) => q.perPage === 50)

async function press(k: Kit) {
  assert.ok(exportButton(k), 'there is an Export button')
  await k.click(exportButton(k))
  await k.tick(30)
}

describe('Export CSV: where it is', () => {
  afterEach(disposeAll)

  const SCOPES: Array<[string, string]> = [
    ['All products', 'product=all'],
    ['one product', 'product=g2g'],
    ['a sub-product of a product', 'product=scholarclone%3A%3ASCH-11'],
    ['a Product Master record (a number)', 'product=4'],
    ['a link that only searches', 'status=all&q=Hillcrest'],
  ]
  for (const [name, search] of SCOPES) {
    // CHANGED ON PURPOSE (S17, 25 Nov 2026): the page size (and the other list boxes) are gone; the button is in the row of the search box.
    it(`${name}: "Export CSV" is in the row of the search box`, async () => {
      const { k } = await openScreen({ search })
      const button = exportButton(k)
      assert.ok(button, 'the button is there')
      assert.equal(button.textContent?.trim(), 'Export CSV')
      assert.equal(button.disabled, false)
      const searchBox = k.one('input[aria-label="Search signals"]') as HTMLInputElement
      const row = searchBox.closest('.flex-wrap') as HTMLElement
      assert.ok(row.contains(button), 'the button is in the same wrapping row as the search box')
      assert.equal(row.querySelectorAll('select').length, 0, 'and that row holds no list box of its own')
    })
  }
})

describe('Export CSV: what it asks for and what it saves', () => {
  afterEach(disposeAll)

  it('reads every page of what the list shows, 50 to a page, with the filters of the address, and saves one file named for the day', async () => {
    const search = 'product=all&status=contacted&freshness=last_30_days&fit=g2g&q=school&sort=priority'
    const { k, listCalls, router } = await openScreen({ search, list: pagedServer(120) })
    const files = captureDownloads(k)
    try {
      const before = listCalls.length
      await press(k)
      await k.tick(20)

      const asked = listCalls.slice(before)
      assert.deepEqual(asked.map((q) => q.page), [1, 2, 3], 'pages one to three of 120 at 50 to a page')
      for (const q of asked) {
        assert.equal(q.perPage, 50, 'the server\'s largest page')
        assert.equal(q.search, 'school')
        assert.equal(q.reviewStatus, 'Follow-up', 'the address word "contacted" as the server stores it')
        assert.equal(q.freshness, 'last_30_days')
        assert.equal(q.businessFit, 'g2g')
        assert.equal(q.sort, 'priority')
        assert.equal(q.product, 'all')
        assert.equal(q.expired, 'include')
        assert.equal(q.scopeFilter, true, 'the selectors filter the file as they filter the list')
        assert.equal(q.customerModel, 'b2b')
        assert.equal(q.allSignals, undefined)
        assert.equal(q.source, 'all')
      }
      assert.equal(router.written.length, 0, 'exporting does not touch the address or the page the list is on')

      assert.equal(files.downloads.length, 1)
      assert.equal(files.downloads[0].name, csvFileName(new Date()))
      const text = await files.lastText()
      assert.deepEqual(Array.from((await files.lastBytes()).slice(0, 3)), [0xEF, 0xBB, 0xBF], 'a byte-order mark first, so Excel reads Hindi and Gujarati as UTF-8')
      assert.ok(text.startsWith(BOM + '"Title","Organisation"'), 'text.startsWith(BOM + \'"Title","Organisation"\')')
      const records = parseCsv(text)
      assert.deepEqual(records[0], [...CSV_HEADERS])
      assert.equal(records.length, 121, 'a header and 120 signals')
      assert.deepEqual(records.slice(1).map((r) => r[0]), Array.from({ length: 120 }, (_, i) => `Signal ${120 - i}`), 'every signal once, in the list\'s order: none lost or repeated between the pages')
      for (const record of records) assert.equal(record.length, 9)
      assert.ok(notice(k).includes(`Saved ${csvFileName(new Date())} with 120 signals.`), 'notice(k).includes(`Saved ${csvFileName(new Date())} with 120 signals.`)')
    } finally { files.restore() }
  })

  it('is the list\'s own request without the paging: in one product with a sub-product, every other field of the request is the same', async () => {
    const { k, listCalls } = await openScreen({ search: 'product=scholarclone%3A%3ASCH-11&status=reviewed&q=fee', list: pagedServer(60) })
    const files = captureDownloads(k)
    try {
      const own = listCalls.at(-1)!
      assert.equal(own.offerId, 'SCH-11', 'the list is about the sub-product')
      const before = listCalls.length
      await press(k)
      const asked = listCalls.slice(before)
      assert.deepEqual(asked.map((q) => q.page), [1, 2])
      for (const q of asked) assert.deepEqual({ ...q, page: 0, perPage: 0 }, { ...own, page: 0, perPage: 0 }, 'the same scope, filters and order as the list')
    } finally { files.restore() }
  })

  it('exports the filters as they are NOW: after the person changes one, the next export carries the new one', async () => {
    const { k, listCalls, choose } = await openScreen({ search: 'product=all', list: pagedServer(30) })
    const files = captureDownloads(k)
    try {
      await press(k)
      assert.equal(exportRequests(listCalls).length, 1, 'one request: 30 signals fit in one page of fifty')
      assert.equal(exportRequests(listCalls)[0].customerModel, 'b2b', 'the ICP type the selector holds')
      await choose('ICP Type', 'b2g')
      await press(k)
      assert.equal(exportRequests(listCalls).length, 2, 'and one more for the second export')
      assert.equal(exportRequests(listCalls)[1].customerModel, 'b2g', 'with the ICP type that is chosen now')
      assert.equal(exportRequests(listCalls)[1].scopeFilter, true)
      assert.equal(files.downloads.length, 2)
    } finally { files.restore() }
  })

  it('puts the Fit column in the product\'s own name and the date kind and status in the screen\'s words', async () => {
    const { k } = await openScreen({ search: 'product=all', list: pagedServer(2, { make: (id) => opportunity({ id, title: `Signal ${id}`, review_status: id === 2 ? 'Follow-up' : 'Dismissed' }) }) })
    const files = captureDownloads(k)
    try {
      await press(k)
      const records = parseCsv(await files.lastText())
      assert.deepEqual(records[1], ['Signal 2', 'Example School District', 'Scholar', 'Event', '2026-10-12', 'ScholarClone · Score 24', 'Contacted', '', 'https://district-notices.example/tenders/42'])
      assert.equal(records[2][6], 'Not relevant', 'the stored word "Follow-up" never reaches the file')
    } finally { files.restore() }
  })
})

describe('Export CSV: a spreadsheet must not run text from a source page', () => {
  afterEach(disposeAll)

  it('puts an apostrophe in front of a cell that starts with =, +, - or @, in every column that holds text from outside', async () => {
    // Each of the four starting characters (= + - @) is in a different column in the two kinds of row.
    const hostile = (id: number) => (id % 2 === 1
      ? opportunity({ id, title: `=HYPERLINK("http://evil.example","click ${id}")`, company_name: '+SUM(A1:A9)', product_master_name: '@cmd', source_url: 'https://-2+3.example/x', primary_source: null, assessment: null })
      : opportunity({ id, title: '-2+3', company_name: '@evil', product_master_name: '+1', source_url: 'https://example.org/x', primary_source: null, assessment: null }))
    const { k } = await openScreen({ search: 'product=all', list: pagedServer(3, { make: hostile }) })
    const files = captureDownloads(k)
    try {
      await press(k)
      const text = await files.lastText()
      const records = parseCsv(text)
      assert.equal(records.length, 4)
      const [odd, even] = [records[1], records[2]]   // the list is newest first: ids 3, 2, 1
      assert.ok(odd[0].startsWith("'=HYPERLINK("), `title: ${odd[0]}`)
      assert.equal(odd[1], "'+SUM(A1:A9)")
      assert.equal(odd[2], "'@cmd")
      assert.deepEqual(even.slice(0, 3), ["'-2+3", "'@evil", "'+1"])
      for (const record of records.slice(1)) for (const cell of record) assert.ok(!/^[=+\-@\t\r]/.test(cell), `no cell starts with a formula character: ${JSON.stringify(cell)}`)
    } finally { files.restore() }
  })

  it('exports a source link only when it is a web address', async () => {
    const { k } = await openScreen({ search: 'product=all', list: pagedServer(1, { make: (id) => opportunity({ id, source_url: 'javascript:alert(1)', primary_source: null, assessment: null }) }) })
    const files = captureDownloads(k)
    try {
      await press(k)
      assert.equal(parseCsv(await files.lastText())[1][8], '')
    } finally { files.restore() }
  })
})

describe('Export CSV: the cap, cancelling, failing and nothing to export', () => {
  afterEach(disposeAll)

  it('stops at 2000 signals, saves those, reads no page past them and says plainly that the file is the first 2000', async () => {
    const { k, listCalls } = await openScreen({ search: 'product=all', list: pagedServer(2300) })
    const files = captureDownloads(k)
    try {
      const before = listCalls.length
      await press(k)
      await k.tick(20)
      assert.equal(EXPORT_CAP, 2000)
      assert.equal(listCalls.length - before, 40, 'forty pages of fifty: no page past the 2000th signal is read')
      assert.equal(parseCsv(await files.lastText()).length, 2001, 'a header and 2000 signals')
      assert.ok(notice(k).includes('first 2000 of 2300 signals'), 'notice(k).includes(\'first 2000 of 2300 signals\')')
      assert.ok(notice(k).includes('narrow the filters'), 'notice(k).includes(\'narrow the filters\')')
    } finally { files.restore() }
  })

  it('can be cancelled: no file is made, the notice says so and the button comes back', async () => {
    const second = gate()
    const { k } = await openScreen({ search: 'product=all', list: pagedServer(120, { hold: (page) => (page === 2 ? second.closed : undefined) }) })
    const files = captureDownloads(k)
    try {
      await press(k)
      assert.equal(exportButton(k).disabled, true, 'off while it works')
      assert.ok(k.withText('Cancel export'), 'Cancel export is offered')
      await pressLabel(k, 'Cancel export')
      second.open()
      await k.tick(30)

      assert.deepEqual(files.downloads, [])
      assert.ok(notice(k).includes('Export cancelled. No file was saved.'), 'notice(k).includes(\'Export cancelled. No file was saved.\')')
      assert.equal(exportButton(k).disabled, false)
      assert.equal(k.withText('Cancel export'), null, 'Cancel goes away with the export')
    } finally { files.restore() }
  })

  it('says how far it has got while it works, and is pressed only once', async () => {
    const second = gate()
    const { k, listCalls } = await openScreen({ search: 'product=all', list: pagedServer(120, { hold: (page) => (page === 2 ? second.closed : undefined) }) })
    const files = captureDownloads(k)
    try {
      await press(k)
      assert.equal(exportButton(k).textContent!.trim(), 'Exporting 50 of 120…')
      assert.ok(k.all('[role="status"]').some((el) => el.textContent === 'Exporting 50 of 120…'), 'announced to a screen reader')
      const asked = listCalls.length
      await k.click(exportButton(k))
      assert.equal(listCalls.length, asked, 'a second press while it works asks for nothing')
      second.open()
      await k.tick(30)
      assert.equal(files.downloads.length, 1)
      assert.equal(exportButton(k).textContent!.trim(), 'Export CSV')
    } finally { files.restore() }
  })

  it('reports a failure plainly, saves nothing, leaves the list as it was and can be tried again', async () => {
    let failing = true
    const server = pagedServer(120, { fail: (page) => failing && page === 2 })
    const { k } = await openScreen({ search: 'product=all', list: server })
    const files = captureDownloads(k)
    try {
      await press(k)
      assert.deepEqual(files.downloads, [])
      assert.ok(k.one('[role="alert"]')?.textContent?.includes('The export failed: The server is busy. No file was saved.'), 'an alert, in plain words')
      assert.equal(k.all('article').length, 5, 'the list is still on screen')
      assert.equal(exportButton(k).disabled, false)

      failing = false
      await press(k)
      assert.equal(files.downloads.length, 1, 'the second try works')
    } finally { files.restore() }
  })

  it('says so, and makes no file, when no signals match', async () => {
    const { k } = await openScreen({ search: 'product=all&q=zzz', list: pagedServer(0) })
    const files = captureDownloads(k)
    try {
      await press(k)
      assert.deepEqual(files.downloads, [])
      assert.ok(notice(k).includes('No signals match these filters, so there was nothing to export.'), 'notice(k).includes(\'No signals match these filters, so there was nothing to export.\')')
    } finally { files.restore() }
  })

  it('stops when the screen goes away: the page that was on its way is not followed by another, and no file is made', async () => {
    const second = gate()
    const { k, listCalls } = await openScreen({ search: 'product=all', list: pagedServer(120, { hold: (page) => (page === 2 ? second.closed : undefined) }) })
    const files = captureDownloads(k)
    try {
      await press(k)
      const asked = listCalls.length
      await k.unmount()
      second.open()
      await k.tick(30)
      assert.equal(listCalls.length, asked, 'the third page is never asked for')
      assert.deepEqual(files.downloads, [])
    } finally { files.restore() }
  })

  it('two presses in the same instant read the pages once and make one file', async () => {
    const { k, listCalls } = await openScreen({ search: 'product=all', list: pagedServer(30) })
    const files = captureDownloads(k)
    try {
      const before = listCalls.length
      const button = exportButton(k)
      assert.ok(button, 'there is an Export button')
      await k.act(async () => {
        button.dispatchEvent(new k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
        button.dispatchEvent(new k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      await k.tick(30)
      assert.equal(exportRequests(listCalls.slice(before)).length, 1, 'one request for the thirty signals')
      assert.equal(files.downloads.length, 1, 'one file')
    } finally { files.restore() }
  })

  it('puts the notice away on Dismiss', async () => {
    const { k } = await openScreen({ search: 'product=all', list: pagedServer(3) })
    const files = captureDownloads(k)
    try {
      await press(k)
      assert.ok(notice(k).includes('Saved '), 'notice(k).includes(\'Saved \')')
      await pressLabel(k, 'Dismiss')
      assert.ok(!notice(k).includes('Saved '), '!notice(k).includes(\'Saved \')')
    } finally { files.restore() }
  })

  it('has no axe violation with the button, while it works, and with each kind of notice', async () => {
    const second = gate()
    const { k, listCalls } = await openScreen({ search: 'product=all', list: pagedServer(120, { hold: (page) => (page === 2 ? second.closed : undefined) }) })
    const files = captureDownloads(k)
    try {
      const section = () => k.one('section[aria-label="All products signals"]')!
      assert.deepEqual(await axeViolations(section()), [])
      await press(k)
      assert.deepEqual(await axeViolations(section()), [], 'while it works')
      second.open()
      await k.tick(30)
      assert.deepEqual(await axeViolations(section()), [], 'with the saved notice')
    } finally { files.restore() }
  })
})

describe('Export CSV: the REAL request, with fetch faked', () => {
  afterEach(disposeAll)

  it('asks /signals/opportunities for pages one to three at 50 a page, every filter under the name the server reads, with the token as the Authorization header', async () => {
    const original = globalThis.fetch
    const asked: Array<{ url: URL; auth: string | undefined }> = []
    const rows = Array.from({ length: 120 }, (_, i) => opportunity({ id: 120 - i, title: `Signal ${120 - i}` }))
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost')
      asked.push({ url, auth: (init?.headers as Record<string, string> | undefined)?.Authorization })
      const perPage = Number(url.searchParams.get('per_page') ?? 5)
      const page = Number(url.searchParams.get('page') ?? 1)
      const body = opportunityList(rows.slice((page - 1) * perPage, page * perPage), { meta: { page, per_page: perPage, total: 120, last_page: Math.ceil(120 / perPage) } })
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    try {
      const { k } = await openScreen({ search: 'product=all&status=contacted&freshness=last_30_days&fit=g2g&q=school&sort=priority', realList: true })
      const files = captureDownloads(k)
      try {
        const listRequests = () => asked.filter((c) => c.url.pathname.endsWith('/signals/opportunities'))
        const before = listRequests().length
        assert.ok(before >= 1, 'the screen\'s own list was read when it opened')
        assert.equal(listRequests()[0].url.searchParams.get('per_page'), '5')

        await press(k)
        await k.tick(30)
        const mine = listRequests().slice(before)
        assert.deepEqual(mine.map((c) => c.url.searchParams.get('page')), ['1', '2', '3'])
        for (const c of mine) {
          const p = c.url.searchParams
          assert.equal(p.get('per_page'), '50')
          assert.equal(p.get('search'), 'school')
          assert.equal(p.get('review_status'), 'Follow-up')
          assert.equal(p.get('freshness'), 'last_30_days')
          assert.equal(p.get('business_fit'), 'g2g')
          assert.equal(p.get('sort'), 'priority')
          assert.equal(p.get('expired'), 'include')
          assert.equal(p.get('scope_filter'), '1')
          assert.equal(p.get('customer_model'), 'b2b')
          assert.equal(p.has('all_signals'), false, 'no all_signals forcing')
          assert.equal(p.has('product'), false, 'All products sends no product')
          assert.equal(p.has('source'), false, 'the source tab "All" sends nothing')
          assert.equal(c.auth, 'Bearer test-token')
        }
        assert.equal(parseCsv(await files.lastText()).length, 121)
      } finally { files.restore() }
    } finally {
      globalThis.fetch = original
    }
  })
})
