import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import type { SignalReviewApi } from '../../services/signal-review/signal-review-service'
import type { SignalListParams, SignalListResponse, SignalRow } from '../../services/signal-review/signal-types'
import { csvFileName } from './export-csv'
import { pressButton } from './generate-fixtures'
import { historyEntry, listResponse, mockupRows, signalRow } from './signal-fixtures'
import { routerHarness } from './router-harness'

type Kit = Awaited<ReturnType<typeof kit>>

/** A server with `total` signals that answers by page. `hold` can keep one page back until the test lets it go. */
function pagedList(total: number, hold?: (page: number) => Promise<void> | undefined) {
  const asked: SignalListParams[] = []
  const all: SignalRow[] = Array.from({ length: total }, (_, i) => signalRow({ id: total - i, title: `Signal ${total - i}` }))
  const list = async (params: SignalListParams): Promise<SignalListResponse> => {
    asked.push(params)
    const perPage = params.per_page ?? 20
    const page = params.page ?? 1
    await hold?.(page)
    return listResponse(all.slice((page - 1) * perPage, page * perPage), { meta: { page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) } })
  }
  return { asked, list }
}

function gate() {
  let open!: () => void
  const closed = new Promise<void>((resolve) => { open = resolve })
  return { closed, open }
}

const NOW = new Date(2026, 10, 3, 9, 30)

async function setup(list: (params: SignalListParams) => Promise<SignalListResponse>, params: SignalListParams = { review_status: 'New', sort: 'recent', page: 2, per_page: 20 }) {
  const k = await kit()
  const { SignalExportButton } = await import('../../components/domain/crm/signal-export-button')
  const notices: Array<{ tone: string; text: string }> = []
  const saved: Array<{ name: string; text: string }> = []
  const props = { params, service: { list }, onNotice: (n: { tone: string; text: string }) => { notices.push(n) }, save: (name: string, text: string) => { saved.push({ name, text }) }, now: () => NOW }
  await k.render(k.h(SignalExportButton, props))
  await k.tick(5)

  const button = () => k.all('button').find((b) => /^Export/.test(b.textContent?.trim() ?? '')) as HTMLButtonElement
  const press = async () => { await k.click(button()); await k.tick(10) }
  return { k, notices, saved, button, press }
}

describe('the Export button', () => {
  afterEach(disposeAll)

  it('reads every page of the current filters and saves one file named for the day', async () => {
    const server = pagedList(120)
    const { saved, notices, press } = await setup(server.list)
    await press()

    assert.deepEqual(server.asked.map((p) => p.page), [1, 2, 3])
    for (const asked of server.asked) {
      assert.equal(asked.per_page, 50, 'pages of the server\'s largest size')
      assert.equal(asked.review_status, 'New', 'the filters on screen are the ones asked for')
      assert.equal(asked.sort, 'recent')
    }
    assert.equal(saved.length, 1)
    assert.equal(saved[0].name, 'signals-2026-11-03.csv')
    assert.ok(saved[0].text.startsWith('\uFEFF"Title","Organisation"'))
    assert.equal(saved[0].text.trimEnd().split('\r\n').length, 121, 'a header and 120 signals')
    assert.deepEqual(notices, [{ tone: 'success', text: 'Saved signals-2026-11-03.csv with 120 signals.' }])
  })

  it('says "1 signal" for one', async () => {
    const { notices, press } = await setup(pagedList(1).list)
    await press()
    assert.equal(notices[0].text, 'Saved signals-2026-11-03.csv with 1 signal.')
  })

  it('is off while it works, says how far it has got, and comes back when done', async () => {
    const second = gate()
    const { k, button, press, saved } = await setup(pagedList(120, (page) => (page === 2 ? second.closed : undefined)).list)
    assert.equal(button().disabled, false)
    await press()

    assert.equal(button().disabled, true)
    assert.equal(button().textContent!.trim(), 'Exporting 50 of 120…')
    assert.ok(k.all('[role="status"]').some((el) => el.textContent === 'Exporting 50 of 120…'), 'announced to a screen reader')
    assert.deepEqual(saved, [])

    second.open()
    await k.tick(10)
    assert.equal(button().textContent!.trim(), 'Export')
    assert.equal(button().disabled, false)
    assert.equal(saved.length, 1)
  })

  it('does not ask twice when pressed again while it works', async () => {
    const second = gate()
    const server = pagedList(120, (page) => (page === 2 ? second.closed : undefined))
    const { k, button, press } = await setup(server.list)
    await press()
    await k.click(button())
    second.open()
    await k.tick(10)
    assert.deepEqual(server.asked.map((p) => p.page), [1, 2, 3])
  })

  it('can be cancelled: no file is made, and the notice says so', async () => {
    const second = gate()
    const { k, press, saved, notices, button } = await setup(pagedList(120, (page) => (page === 2 ? second.closed : undefined)).list)
    await press()
    await pressButton(k, 'Cancel export')
    second.open()
    await k.tick(10)

    assert.deepEqual(saved, [])
    assert.deepEqual(notices, [{ tone: 'info', text: 'Export cancelled. No file was saved.' }])
    assert.equal(button().disabled, false)
    assert.ok(k.withText('Cancel export') === null, 'Cancel goes away with the export')
  })

  it('stops at 2000 signals, saves those and says plainly that the file is the first 2000', async () => {
    const server = pagedList(2300)
    const { saved, notices, press } = await setup(server.list)
    await press()

    assert.equal(saved[0].text.trimEnd().split('\r\n').length, 2001, 'a header and 2000 signals')
    assert.equal(server.asked.length, 40, 'no page past the 2000th signal is read')
    assert.equal(notices[0].tone, 'warning')
    assert.ok(notices[0].text.includes('first 2000 of 2300 signals'))
    assert.ok(notices[0].text.includes('signals-2026-11-03.csv'))
  })

  it('reports a failure plainly, saves nothing and can be tried again', async () => {
    let fail = true
    const server = pagedList(120)
    const { k, saved, notices, button, press } = await setup(async (params) => {
      if (fail && params.page === 2) throw new Error('The server is busy.')
      return server.list(params)
    })
    await press()
    assert.deepEqual(saved, [])
    assert.deepEqual(notices, [{ tone: 'error', text: 'The export failed: The server is busy. No file was saved.' }])
    assert.equal(button().disabled, false)

    fail = false
    await press()
    assert.equal(saved.length, 1, 'the second try works')
    assert.ok(k.withText('Cancel export') === null)
  })

  it('says so, and makes no file, when no signals match', async () => {
    const { saved, notices, press } = await setup(pagedList(0).list)
    await press()
    assert.deepEqual(saved, [])
    assert.deepEqual(notices, [{ tone: 'info', text: 'No signals match these filters, so there was nothing to export.' }])
  })

  it('stops quietly when the screen goes away: no file, no notice', async () => {
    const second = gate()
    const { k, saved, notices, press } = await setup(pagedList(120, (page) => (page === 2 ? second.closed : undefined)).list)
    await press()
    await k.unmount()
    second.open()
    await k.tick(10)
    assert.deepEqual(saved, [])
    assert.deepEqual(notices, [])
  })
})

describe('Export on the Signal Review screen', () => {
  afterEach(disposeAll)

  /** The screen with a fake server, and a browser that records the download instead of starting it. */
  async function screen(search = '', list?: SignalReviewApi['list']) {
    const k = await kit()
    const router = await routerHarness(search)
    const { SignalReviewView } = await import('../../components/domain/crm/signal-review-view')
    k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
    Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

    const asked: SignalListParams[] = []
    const service = {
      list: list ?? (async (params: SignalListParams) => { asked.push(params); return listResponse(mockupRows(), { meta: { page: params.page ?? 1, per_page: params.per_page ?? 20, total: 5, last_page: 1 } }) }),
      get: async (id: number) => ({ status: 1, data: signalRow({ id }) }),
      history: async () => ({ status: 1, data: [historyEntry()] }),
      decide: async () => { throw new Error('not used') },
      promote: async () => { throw new Error('not used') },
      productOptions: async () => ({ status: 1, data: [] }),
    } as unknown as SignalReviewApi

    const downloads: Array<{ name: string; blob: Blob }> = []
    const realCreate = URL.createObjectURL
    const realRevoke = URL.revokeObjectURL
    const realClick = k.w.HTMLAnchorElement.prototype.click
    let lastBlob: Blob | null = null
    URL.createObjectURL = ((blob: Blob) => { lastBlob = blob; return 'blob:test' }) as typeof URL.createObjectURL
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL
    k.w.HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) { downloads.push({ name: this.download, blob: lastBlob! }) }
    const restore = () => { URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; k.w.HTMLAnchorElement.prototype.click = realClick }

    await k.render(router.wrap(k.h(SignalReviewView, { service })))
    await k.tick(10)
    return { k, asked, downloads, restore }
  }

  it('has Export in the page header, beside Generate signals, on the Signals tab only', async () => {
    const s = await screen()
    try {
      const header = s.k.one('header')!
      assert.ok(Array.from(header.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Export'))
      assert.ok(Array.from(header.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Generate signals'))
      await s.k.click(s.k.all('[role="tab"]')[1])
      await s.k.tick(10)
      assert.ok(s.k.withText('Export') === null, 'the Runs tab has no signals to export')
      assert.ok(s.k.withText('Generate signals'))
    } finally { s.restore() }
  })

  it('exports exactly what the filters in the address select, downloads it as a UTF-8 file and says what was saved', async () => {
    const s = await screen('status=contacted&product=4&freshness=last_30_days&fit=g2g&q=school&sort=priority')
    try {
      s.asked.length = 0
      await pressButton(s.k, 'Export')
      await s.k.tick(20)

      assert.deepEqual(s.asked, [{ page: 1, per_page: 50, sort: 'priority', search: 'school', product_master_id: 4, review_status: 'Follow-up', freshness: 'last_30_days', business_fit: 'g2g' }])
      assert.equal(s.downloads.length, 1)
      assert.equal(s.downloads[0].name, csvFileName(new Date()))

      const bytes = new Uint8Array(await s.downloads[0].blob.arrayBuffer())
      assert.deepEqual(Array.from(bytes.slice(0, 3)), [0xEF, 0xBB, 0xBF])
      const text = new TextDecoder().decode(bytes)
      assert.equal(text.trimEnd().split('\r\n').length, 6, 'a header and the five signals')
      assert.ok(text.includes('"District office invites bids for a school management system"'))
      assert.ok(s.k.all('[role="status"]').some((el) => el.textContent?.includes(`Saved ${csvFileName(new Date())} with 5 signals.`)))
    } finally { s.restore() }
  })

  it('shows a failed export as a notice above the list, and the list stays', async () => {
    let exporting = false
    const s = await screen('', async (params) => {
      if (exporting) throw new Error('The server is busy.')
      return listResponse(mockupRows(), { meta: { page: params.page ?? 1, per_page: params.per_page ?? 20, total: 5, last_page: 1 } })
    })
    try {
      exporting = true
      await pressButton(s.k, 'Export')
      await s.k.tick(20)
      assert.ok(s.k.bodyText().includes('The export failed: The server is busy. No file was saved.'))
      assert.equal(s.downloads.length, 0)
      assert.equal(s.k.all('tbody tr').length, 5)
      await pressButton(s.k, 'Dismiss')
      assert.ok(!s.k.bodyText().includes('The export failed'))
    } finally { s.restore() }
  })
})
