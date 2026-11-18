import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SignalListParams, SignalListResponse, SignalRow } from '../../services/signal-review/signal-types'
import {
  buildCsv, collectSignals, csvField, csvFileName, CSV_HEADERS, EXPORT_CAP, EXPORT_PAGE_SIZE, ExportCancelled, neutraliseFormula, reasonLabel, signalCsvCells,
} from './export-csv'
import { listResponse, mockupRows, signalRow } from './signal-fixtures'

const BOM = '\uFEFF'

/** The file read back the way a spreadsheet would: records split on CRLF outside quotes, fields on commas outside quotes. */
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
  assert.deepEqual(record, [])
  return records
}

describe('formula injection', () => {
  it('puts an apostrophe in front of each character a spreadsheet treats as the start of a formula', () => {
    for (const start of ['=', '+', '-', '@', '\t', '\r']) {
      const text = `${start}HYPERLINK("http://evil.example","click")`
      assert.equal(neutraliseFormula(text), `'${text}`, JSON.stringify(start))
      assert.ok(csvField(text).startsWith(`"'${start}`), `${JSON.stringify(start)} is neutralised inside the quotes`)
    }
  })

  it('leaves everything else alone', () => {
    for (const text of ['Scholar', '12 Oct 2026', '2026-10-12', ' =spaced', 'a=b', 'पाठशाला', "'already", '', '#hash', '"quoted"']) {
      assert.equal(neutraliseFormula(text), text, text)
    }
  })

  it('neutralises a title, an organisation and a link that come from a source page, in the finished file', () => {
    const csv = buildCsv([signalRow({ title: '=1+1', company_name: '+SUM(A1)', product_master_name: '@cmd', source_url: '-2+3', primary_source: null, assessment: null })])
    const [, row] = parseCsv(csv)
    assert.equal(row[0], "'=1+1")
    assert.equal(row[1], "'+SUM(A1)")
    assert.equal(row[2], "'@cmd")
    for (const cell of row) assert.ok(!/^[=+\-@\t\r]/.test(cell), `no cell starts with a formula character: ${JSON.stringify(cell)}`)
  })

  it('exports a link only when it is a web address, so a script address never reaches the file', () => {
    const [, row] = parseCsv(buildCsv([signalRow({ source_url: 'javascript:alert(1)', primary_source: null, assessment: null })]))
    assert.equal(row[8], '')
  })
})

describe('quoting', () => {
  it('quotes every field and doubles a quote inside it', () => {
    assert.equal(csvField('plain'), '"plain"')
    assert.equal(csvField('He said "hello"'), '"He said ""hello"""')
    assert.equal(csvField(null), '""')
    assert.equal(csvField(undefined), '""')
  })

  it('keeps commas, quotes and line breaks inside a field as text, so one signal stays one record with nine fields', () => {
    const title = 'Bids, "sealed",\r\nclose on 12 Oct,\nand then some'
    const records = parseCsv(buildCsv([signalRow({ title, company_name: 'A, B & "C"' })]))
    assert.equal(records.length, 2)
    assert.equal(records[1].length, CSV_HEADERS.length)
    assert.equal(records[1][0], title)
    assert.equal(records[1][1], 'A, B & "C"')
  })

  it('writes Hindi, Gujarati and other non-Latin text unchanged', () => {
    const title = 'शाला प्रबंधन प्रणाली के लिए निविदा · ગુજરાતી શાળા'
    const [, row] = parseCsv(buildCsv([signalRow({ title, company_name: 'પ્રાથમિક શાળા' })]))
    assert.equal(row[0], title)
    assert.equal(row[1], 'પ્રાથમિક શાળા')
  })
})

describe('the file', () => {
  it('starts with a byte-order mark, so Excel reads it as UTF-8', async () => {
    const csv = buildCsv(mockupRows())
    assert.ok(csv.startsWith(BOM))
    const bytes = new Uint8Array(await new Blob([csv]).arrayBuffer())
    assert.deepEqual(Array.from(bytes.slice(0, 3)), [0xEF, 0xBB, 0xBF])
    assert.equal(csv.indexOf(BOM, 1), -1, 'only one')
  })

  it('ends every line with CRLF and never a bare line feed outside a quoted field', () => {
    const csv = buildCsv(mockupRows())
    assert.ok(csv.endsWith('\r\n'))
    const outsideQuotes = csv.replace(/"(?:[^"]|"")*"/g, '""')
    assert.ok(!/\n/.test(outsideQuotes.replace(/\r\n/g, '')), 'no bare LF')
    assert.equal(outsideQuotes.split('\r\n').length, mockupRows().length + 2, 'header + rows + the empty piece after the last CRLF')
  })

  it('has the nine columns in the order the owner asked for', () => {
    assert.deepEqual([...CSV_HEADERS], ['Title', 'Organisation', 'Product', 'Date kind', 'Date', 'Fit', 'Status', 'Reason', 'Source link'])
    const records = parseCsv(buildCsv(mockupRows()))
    assert.deepEqual(records[0], [...CSV_HEADERS])
    for (const record of records) assert.equal(record.length, 9)
  })

  it('writes the screen\'s own words for the kind of date, the status and the fit', () => {
    const products = listResponse().filters.products
    const cells = (over: Partial<SignalRow>) => signalCsvCells(signalRow(over), products)

    assert.deepEqual(cells({}), [
      'District office invites bids for a school management system', 'Example School District', 'Scholar', 'Event', '2026-10-12', 'Scholar · Score 24',
      'Needs decision', '', 'https://district-notices.example/tenders/42',
    ])
    assert.deepEqual(cells({ date_info: { status: 'source_date_only', date: '2026-10-03' } }).slice(3, 5), ['Published', '2026-10-03'])
    assert.deepEqual(cells({ date_info: { status: 'undated', date: null } }).slice(3, 5), ['Unknown', ''])
    assert.deepEqual(cells({ date_info: { status: 'event_date_stated', date: 'not a day' } }).slice(3, 5), ['Unknown', ''], 'a date the server sent badly is not exported')

    const statuses = (['New', 'Follow-up', 'Reviewed', 'Dismissed'] as const).map((review_status) => cells({ review_status })[6])
    assert.deepEqual(statuses, ['Needs decision', 'Contacted', 'Reviewed', 'Not relevant'])
    assert.ok(!statuses.includes('Follow-up'), 'the stored word never reaches the file')
  })

  it('leaves the product, fit and link empty when the signal has none', () => {
    const cells = signalCsvCells(signalRow({ product_master_id: null, product_master_name: null, business_fit: null, scores: null, source_url: null, primary_source: null, assessment: null }))
    assert.deepEqual([cells[2], cells[5], cells[8]], ['', '', ''])
  })

  it('names the file for the day on the person\'s clock', () => {
    assert.equal(csvFileName(new Date(2026, 10, 3, 23, 59)), 'signals-2026-11-03.csv')
    assert.equal(csvFileName(new Date(2026, 0, 9)), 'signals-2026-01-09.csv')
  })
})

describe('the dismissal reason', () => {
  it('is the label of the latest decision when the row carries one and the signal is still dismissed', () => {
    assert.equal(reasonLabel(signalRow({ review_status: 'Dismissed', last_decision: { reason_label: 'Too old to act on' } })), 'Too old to act on')
  })

  it('is empty when the row carries none, or the signal is no longer dismissed', () => {
    assert.equal(reasonLabel(signalRow({ review_status: 'Dismissed' })), '')
    assert.equal(reasonLabel(signalRow({ review_status: 'Dismissed', last_decision: null })), '')
    assert.equal(reasonLabel(signalRow({ review_status: 'Dismissed', last_decision: { reason_label: 7 } })), '')
    assert.equal(reasonLabel(signalRow({ review_status: 'New', last_decision: { reason_label: 'Too old to act on' } })), '')
  })
})

// ── Reading the pages ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A server with `total` signals that answers by page, and remembers what it was asked. */
function pagedServer(total: number) {
  const asked: SignalListParams[] = []
  const all = Array.from({ length: total }, (_, i) => signalRow({ id: total - i, title: `Signal ${total - i}` }))
  const fetchPage = async (params: SignalListParams): Promise<SignalListResponse> => {
    asked.push(params)
    const perPage = params.per_page ?? 10
    const page = params.page ?? 1
    return listResponse(all.slice((page - 1) * perPage, page * perPage), {
      meta: { page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) },
    })
  }
  return { asked, fetchPage }
}

describe('reading every page', () => {
  it('asks for pages of the server\'s largest size, keeps the screen\'s filters, and reads until the last page', async () => {
    const server = pagedServer(120)
    const progress: Array<{ loaded: number; total: number }> = []
    const result = await collectSignals({ fetchPage: server.fetchPage, params: { review_status: 'Follow-up', product_master_id: 4, sort: 'priority', page: 3, per_page: 20 }, onProgress: (p) => progress.push(p) })

    assert.equal(result.rows.length, 120)
    assert.equal(result.total, 120)
    assert.equal(result.capped, false)
    assert.deepEqual(server.asked.map((p) => p.page), [1, 2, 3])
    for (const asked of server.asked) {
      assert.equal(asked.per_page, EXPORT_PAGE_SIZE)
      assert.deepEqual({ ...asked, page: 0, per_page: 0 }, { review_status: 'Follow-up', product_master_id: 4, sort: 'priority', page: 0, per_page: 0 })
    }
    assert.deepEqual(progress, [{ loaded: 50, total: 120 }, { loaded: 100, total: 120 }, { loaded: 120, total: 120 }])
  })

  it('stops at the cap, keeps exactly that many rows and says the list was cut short', async () => {
    const server = pagedServer(2300)
    const result = await collectSignals({ fetchPage: server.fetchPage, params: {} })
    assert.equal(EXPORT_CAP, 2000)
    assert.equal(result.rows.length, 2000)
    assert.equal(result.total, 2300)
    assert.equal(result.capped, true)
    assert.equal(server.asked.length, 40, 'no page is read past the cap')
  })

  it('does not call a list of exactly the cap "cut short"', async () => {
    const result = await collectSignals({ fetchPage: pagedServer(2000).fetchPage, params: {} })
    assert.equal(result.rows.length, 2000)
    assert.equal(result.capped, false)
  })

  it('keeps a signal once when it moves to another page while the pages are being read', async () => {
    const pages = [mockupRows().slice(0, 3), [mockupRows()[2], ...mockupRows().slice(3)]]
    const result = await collectSignals({
      fetchPage: async (params) => listResponse(pages[(params.page ?? 1) - 1], { meta: { page: params.page ?? 1, per_page: 50, total: 5, last_page: 2 } }),
      params: {},
    })
    assert.deepEqual(result.rows.map((r) => r.id), [1, 2, 3, 4, 5])
  })

  it('cannot be held in a loop by a server that ignores the page number', async () => {
    let calls = 0
    const result = await collectSignals({
      fetchPage: async () => { calls += 1; return listResponse(mockupRows(), { meta: { page: 1, per_page: 50, total: 900, last_page: 18 } }) },
      params: {},
    })
    assert.equal(calls, 2)
    assert.equal(result.rows.length, 5)
  })

  it('reads one empty page for no matches', async () => {
    const result = await collectSignals({ fetchPage: pagedServer(0).fetchPage, params: {} })
    assert.deepEqual([result.rows.length, result.total, result.capped], [0, 0, false])
  })

  it('takes the product names for the fit column from the first page', async () => {
    const result = await collectSignals({ fetchPage: pagedServer(3).fetchPage, params: {} })
    assert.deepEqual(result.products.map((p) => p.business_fit), ['scholar', 'g2g'])
  })

  it('stops with ExportCancelled when cancelled before a page and when cancelled while one is on its way', async () => {
    const before = new AbortController()
    before.abort()
    const server = pagedServer(120)
    await assert.rejects(collectSignals({ fetchPage: server.fetchPage, params: {}, signal: before.signal }), ExportCancelled)
    assert.equal(server.asked.length, 0)

    const during = new AbortController()
    const second = pagedServer(120)
    await assert.rejects(
      collectSignals({
        fetchPage: async (params) => { const answer = await second.fetchPage(params); if (params.page === 2) during.abort(); return answer },
        params: {},
        signal: during.signal,
      }),
      ExportCancelled,
    )
    assert.equal(second.asked.length, 2, 'the third page is never asked for')
  })

  it('passes a failure of the server on', async () => {
    await assert.rejects(collectSignals({ fetchPage: async () => { throw new Error('The server is busy.') }, params: {} }), /The server is busy\./)
  })
})
