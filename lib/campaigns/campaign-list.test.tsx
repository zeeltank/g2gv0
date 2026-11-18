import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, says } from '../agent/assertions'
import { campaign, listAnswer, PRODUCT } from './fixtures'
import { screenKit, type Call } from './screen-kit'

/** The CRM campaign list as a person meets it: the real list, the real sidebar hook and service client, only the network replaced. */

const HEADS_AS_ALWAYS = ['Name', 'Type', 'Status', 'Expected Revenue', 'Closing Date']

interface Setup {
  pages?: Record<number, { items: unknown[]; total: number }>
  onList?: (call: Call) => void
  /** Holds a page's answer back until the promise it returns settles, so a test can look at the screen while it is loading. */
  gate?: (page: number) => Promise<void> | undefined
}

async function open(opts: Setup = {}) {
  const pages = opts.pages ?? { 1: { items: [campaign(), campaign({ id: '8', name: 'Pongal drive', campaignStatus: 'Planning' })], total: 2 } }
  const screen = await screenKit({
    respond: (call) => {
      if (call.path.endsWith('/crm/campaigns')) {
        opts.onList?.(call)
        const pageNumber = Number(call.query.get('page') ?? 1)
        const page = pages[pageNumber] ?? { items: [], total: 0 }
        const answer = listAnswer(page.items, page.total)
        const held = opts.gate?.(pageNumber)
        return held ? held.then(() => answer) : answer
      }
      if (call.path.endsWith('/crm/picklist-values')) return { status: 1, message: 'ok', data: { campaigns: {} } }
      return undefined
    },
  })
  const { CampaignListView } = await import('../../components/domain/crm/campaign-list-view')
  await screen.mount(screen.k.h(CampaignListView), 40)
  const { k } = screen
  const heads = () => k.all('thead th').slice(1).map((th) => th.textContent)
  const rowOf = (name: string) => k.all('tbody tr').find((tr) => tr.textContent?.includes(name)) ?? null
  const cells = (name: string) => Array.from(rowOf(name)!.querySelectorAll('td')).map((td) => td.textContent)
  const next = async () => { await k.click(k.withText('Next')!); await k.tick(30); await k.tick(30) }
  return { ...screen, heads, rowOf, cells, next }
}

describe('the CRM campaign list against an older server (none of slice 9\'s fields)', () => {
  afterEach(async () => { await disposeAll() })

  it('looks exactly as it always did: the same columns, no Product, and a row that opens its page', async () => {
    const s = await open()
    assert.deepEqual(s.heads(), HEADS_AS_ALWAYS)
    assert.equal(s.k.all('[data-campaign-product]').length, 0)
    assert.equal(s.k.all('[data-campaign-product-narrow]').length, 0)
    says(s.k.bodyText(), '2 campaigns')
    await s.k.click(s.rowOf('Diwali')!)
    assert.equal(s.router.written.at(-1), '/module/crm/marketing/campaigns/7')
    s.restore()
  })

  it('keeps the header buttons, the search and the empty text', async () => {
    const s = await open({ pages: { 1: { items: [], total: 0 } } })
    for (const label of ['Import', 'Add Campaign']) assert.ok(s.k.all('button').some((b) => b.textContent?.includes(label)), label)
    says(s.k.bodyText(), 'No campaigns yet. Click “Add Campaign” to create one.')
    const empty = s.k.one('tbody td[colspan]') as HTMLTableCellElement
    assert.equal(empty.colSpan, 6, 'the empty row spans the six columns it always had')
    s.restore()
  })
})

describe('the CRM campaign list: the Product column', () => {
  afterEach(async () => { await disposeAll() })

  it('is not drawn when the server says no campaign has a product (null on every row)', async () => {
    const s = await open({ pages: { 1: { items: [campaign({ product: null }), campaign({ id: '8', name: 'Pongal drive', product: null })], total: 2 } } })
    assert.deepEqual(s.heads(), HEADS_AS_ALWAYS)
    assert.equal(s.k.all('[data-campaign-product]').length, 0)
    s.restore()
  })

  it('appears after Name as soon as one campaign has a product, with the name where there is one and a dash where there is not', async () => {
    const s = await open({ pages: { 1: { items: [campaign({ product: PRODUCT }), campaign({ id: '8', name: 'Pongal drive', product: null })], total: 2 } } })
    assert.deepEqual(s.heads(), ['Name', 'Product', 'Type', 'Status', 'Expected Revenue', 'Closing Date'])
    assert.equal((s.rowOf('Diwali')!.querySelector('[data-campaign-product]') as HTMLElement).textContent, 'School ERP')
    assert.equal((s.rowOf('Pongal')!.querySelector('[data-campaign-product]') as HTMLElement).textContent, '—')
    s.restore()
  })

  it('is not sortable (the server cannot sort by product), unlike the heads beside it', async () => {
    const s = await open({ pages: { 1: { items: [campaign({ product: PRODUCT })], total: 1 } } })
    const head = s.k.all('thead th').find((th) => th.textContent === 'Product')!
    absent(head.querySelector('button'), 'the Product head holds no sort button')
    assert.ok(s.k.all('thead th').find((th) => th.textContent === 'Name')!.querySelector('button') !== null, 'the Name head does hold one, so the check above is not vacuous')
    s.restore()
  })

  it('also names the product under the campaign name for a narrow screen, where the column is hidden', async () => {
    const s = await open({ pages: { 1: { items: [campaign({ product: PRODUCT }), campaign({ id: '8', name: 'Pongal drive', product: null })], total: 2 } } })
    const narrow = s.rowOf('Diwali')!.querySelector('[data-campaign-product-narrow]') as HTMLElement
    assert.equal(narrow.textContent, 'School ERP')
    assert.match(narrow.className, /@md\/campaigns:hidden/, 'hidden once the table is wide enough to show the column')
    absent(s.rowOf('Pongal')!.querySelector('[data-campaign-product-narrow]'), 'no product, no line')
    const head = s.k.all('thead th').find((th) => th.textContent === 'Product')!
    assert.match(head.className, /hidden @md\/campaigns:table-cell/, 'the column itself is hidden on a narrow table, like Type')
    s.restore()
  })

  it('keeps its place on a page where no campaign has a product, and the loading and empty rows span it', async () => {
    const s = await open({ pages: { 1: { items: [campaign({ product: PRODUCT })], total: 25 }, 2: { items: [], total: 25 } } })
    assert.ok(s.heads().includes('Product'))
    await s.next()
    assert.ok(s.heads().includes('Product'), 'the column did not vanish on the next page')
    const empty = s.k.one('tbody td[colspan]') as HTMLTableCellElement
    assert.equal(empty.colSpan, 7, 'the empty row spans the six columns and Product')
    s.restore()
  })

  it('the row that says "loading" spans the six columns before any product is known, and the seven once the Product column shows', async () => {
    const holds: Record<number, Promise<void>> = {}
    const release: Record<number, () => void> = {}
    for (const page of [1, 2]) holds[page] = new Promise<void>((resolve) => { release[page] = resolve })
    const s = await open({ pages: { 1: { items: [campaign({ product: PRODUCT })], total: 25 }, 2: { items: [campaign({ id: '9', name: 'Pongal drive', product: null })], total: 25 } }, gate: (page) => holds[page] })
    const loadingCell = () => s.k.one('tbody td[colspan]') as HTMLTableCellElement | null
    assert.ok(loadingCell() !== null, 'the first page is still loading, so the loading row is there')
    assert.equal(loadingCell()!.colSpan, 6, 'no product is known yet, so the six columns it always had')
    release[1]()
    await s.k.tick(40)
    assert.ok(s.heads().includes('Product'), 'the first page arrived with a product')
    await s.k.click(s.k.withText('Next')!)
    await s.k.tick(30)
    assert.ok(loadingCell() !== null, 'the second page is held back, so the loading row is there again')
    assert.equal(loadingCell()!.colSpan, 7, 'now the Product column shows, and the loading row spans it')
    release[2]()
    await s.k.tick(40)
    s.restore()
  })

  it('the rows keep their meaning with the new column: the status, the date and the click still work', async () => {
    const s = await open({ pages: { 1: { items: [campaign({ product: PRODUCT })], total: 1 } } })
    const cells = s.cells('Diwali')
    assert.equal(cells[3], 'Email', 'Type after Product')
    assert.equal(cells[4], 'Active')
    assert.equal(cells.at(-1), '2026-12-01')
    await s.k.click(s.rowOf('Diwali')!)
    assert.equal(s.router.written.at(-1), '/module/crm/marketing/campaigns/7')
    s.restore()
  })

  it('adds no send, schedule or run control', async () => {
    const s = await open({ pages: { 1: { items: [campaign({ product: PRODUCT })], total: 1 } } })
    const labels = s.k.all('button').map((b) => (b.textContent ?? '').toLowerCase())
    assert.ok(labels.length >= 5 && labels.some((label) => label.includes('add campaign')), 'the screen is really there, so the check below is not vacuous')
    assert.equal(labels.some((label) => /send|schedule|launch|start|run/.test(label)), false, `buttons: ${labels.join(' | ')}`)
    s.restore()
  })

  it('has nothing for the accessibility rules to find', async () => {
    const s = await open({ pages: { 1: { items: [campaign({ product: PRODUCT }), campaign({ id: '8', name: 'Pongal drive', product: null })], total: 2 } } })
    assert.deepEqual(await axeViolations(s.k.w.document.body), [])
    s.restore()
  })
})
