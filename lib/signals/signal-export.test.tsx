import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import type { SignalListParams, SignalListResponse, SignalRow } from '../../services/signal-review/signal-types'
import { listResponse, signalRow } from './signal-fixtures'

/**
 * The Export button (the generic one that Company Opportunities uses, `ExportCsvButton`): what it reads, what it saves and says, and how it ends. The same rules
 * are proved a second time at the screen, with the real list request, in export-screen.test.tsx.
 */

type Kit = Awaited<ReturnType<typeof kit>>

/** Presses the button with this label. A missing button fails on the spot: clicking nothing inside act() would leave the test hanging instead. */
async function pressButton(k: Kit, label: string): Promise<void> {
  const button = k.withText(label)
  assert.ok(button, `there is a "${label}" button`)
  await k.click(button)
}

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
  // The generic button that Company Opportunities uses. (The Signal Review's adapter around it, `SignalExportButton`, went with that screen: its only job was
  // to build this `read` from a service and the screen's filters, and the screen-level proof of that is export-screen.test.tsx.)
  const { ExportCsvButton } = await import('../../components/domain/signals/signal-export-button')
  const notices: Array<{ tone: string; text: string }> = []
  const saved: Array<{ name: string; text: string }> = []
  const props = {
    read: (page: number, size: number) => list({ ...params, page, per_page: size }),
    onNotice: (n: { tone: string; text: string }) => { notices.push(n) },
    save: (name: string, text: string) => { saved.push({ name, text }) },
    now: () => NOW,
  }
  await k.render(k.h(ExportCsvButton, props))
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
    }
    assert.equal(saved.length, 1)
    assert.equal(saved[0].name, 'signals-2026-11-03.csv')
    assert.ok(saved[0].text.startsWith('\uFEFF"Title","Organisation"'), 'a byte-order mark, then the header')
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
    assert.ok(notices[0].text.includes('first 2000 of 2300 signals'), 'the notice says the file holds the first 2000 of 2300')
    assert.ok(notices[0].text.includes('signals-2026-11-03.csv'), 'and names the file')
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
    assert.ok(k.withText('Cancel export') === null, 'Cancel goes away when the export is over')
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
