import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, says } from '../agent/assertions'
import { listAnswer, opportunity, pipelineAnswer, PRODUCT } from './fixtures'
import { screenKit, type Call } from './screen-kit'

/** The opportunity table as a person meets it: the real list, the real sidebar hook and service client, only the network replaced. */

const HEADS_AS_ALWAYS = ['Name', 'Organization', 'Stage', 'Amount', 'Closing Date']

interface Setup {
  pages?: Record<number, { items: unknown[]; total: number }>
  /** Holds a page's answer back until the promise it returns settles, so a test can look at the screen while it is loading. */
  gate?: (page: number) => Promise<void> | undefined
}

async function open(opts: Setup = {}) {
  const pages = opts.pages ?? { 1: { items: [opportunity(), opportunity({ id: '32', name: 'Pongal supplies', organizationName: 'Pongal Traders', salesStage: 'Qualification' })], total: 2 } }
  const screen = await screenKit({
    respond: (call: Call) => {
      if (call.path.endsWith('/crm/opportunities/pipeline')) return pipelineAnswer()
      if (call.path.endsWith('/crm/opportunities')) {
        const pageNumber = Number(call.query.get('page') ?? 1)
        const page = pages[pageNumber] ?? { items: [], total: 0 }
        const answer = listAnswer(page.items, page.total)
        const held = opts.gate?.(pageNumber)
        return held ? held.then(() => answer) : answer
      }
      if (call.path.endsWith('/crm/picklist-values')) return { status: 1, message: 'ok', data: { opportunities: {} } }
      return undefined
    },
  })
  const { OpportunityListView } = await import('../../components/domain/crm/opportunity-list-view')
  await screen.mount(screen.k.h(OpportunityListView), 40)
  const { k } = screen
  await k.click(k.withText('Table')!)
  await k.tick(40)
  await k.tick(40)
  const heads = () => k.all('thead th').slice(1).map((th) => th.textContent)
  const rowOf = (name: string) => k.all('tbody tr').find((tr) => tr.textContent?.includes(name)) ?? null
  const cells = (name: string) => Array.from(rowOf(name)!.querySelectorAll('td')).map((td) => td.textContent)
  const next = async () => { await k.click(k.withText('Next')!); await k.tick(30); await k.tick(30) }
  return { ...screen, heads, rowOf, cells, next }
}

describe('the opportunity table against an older server (none of slice 11\'s fields)', () => {
  afterEach(async () => { await disposeAll() })

  it('looks exactly as it always did: the same columns, no Product, and a row that opens its page', async () => {
    const s = await open()
    assert.deepEqual(s.heads(), HEADS_AS_ALWAYS)
    assert.equal(s.k.all('[data-opportunity-product]').length, 0)
    assert.equal(s.k.all('[data-opportunity-product-narrow]').length, 0)
    says(s.k.bodyText(), '2 opportunities')
    await s.k.click(s.rowOf('Hillcrest')!)
    assert.equal(s.router.written.at(-1), '/module/crm/sales/opportunities/31')
    s.restore()
  })

  it('keeps the header buttons, the search and the empty text, and the empty row spans the six columns it always had', async () => {
    const s = await open({ pages: { 1: { items: [], total: 0 } } })
    for (const label of ['Import', 'Add Opportunity']) assert.ok(s.k.all('button').some((b) => b.textContent?.includes(label)), label)
    says(s.k.bodyText(), 'No opportunities yet. Click “Add Opportunity” to create one.')
    const empty = s.k.one('tbody td[colspan]') as HTMLTableCellElement
    assert.equal(empty.colSpan, 6)
    s.restore()
  })
})

describe('the opportunity table: the Product column', () => {
  afterEach(async () => { await disposeAll() })

  it('is not drawn when the server says no opportunity has a product (null on every row)', async () => {
    const s = await open({ pages: { 1: { items: [opportunity({ product: null }), opportunity({ id: '32', name: 'Pongal supplies', product: null })], total: 2 } } })
    assert.deepEqual(s.heads(), HEADS_AS_ALWAYS)
    assert.equal(s.k.all('[data-opportunity-product]').length, 0)
    s.restore()
  })

  it('appears after Name as soon as one opportunity has a product, with the name where there is one and a dash where there is not', async () => {
    const s = await open({ pages: { 1: { items: [opportunity({ product: PRODUCT }), opportunity({ id: '32', name: 'Pongal supplies', product: null })], total: 2 } } })
    assert.deepEqual(s.heads(), ['Name', 'Product', 'Organization', 'Stage', 'Amount', 'Closing Date'])
    assert.equal((s.rowOf('Hillcrest')!.querySelector('[data-opportunity-product]') as HTMLElement).textContent, 'School ERP')
    assert.equal((s.rowOf('Pongal')!.querySelector('[data-opportunity-product]') as HTMLElement).textContent, '—')
    s.restore()
  })

  it('reads the product from the contract\'s own key, whatever else is on the row', async () => {
    const s = await open({ pages: { 1: { items: [opportunity({ product: { id: '9', key: 'x', name: 'School ERP' }, loss_reason: null })], total: 1 } } })
    assert.equal((s.rowOf('Hillcrest')!.querySelector('[data-opportunity-product]') as HTMLElement).textContent, 'School ERP')
    s.restore()
  })

  it('is not sortable (the server cannot sort by product), unlike the heads beside it', async () => {
    const s = await open({ pages: { 1: { items: [opportunity({ product: PRODUCT })], total: 1 } } })
    const head = s.k.all('thead th').find((th) => th.textContent === 'Product')!
    absent(head.querySelector('button'), 'the Product head holds no sort button')
    assert.ok(s.k.all('thead th').find((th) => th.textContent === 'Name')!.querySelector('button') !== null, 'the Name head does hold one, so the check above is not vacuous')
    s.restore()
  })

  it('also names the product under the name for a narrow screen, where the column is hidden', async () => {
    const s = await open({ pages: { 1: { items: [opportunity({ product: PRODUCT }), opportunity({ id: '32', name: 'Pongal supplies', product: null })], total: 2 } } })
    const narrow = s.rowOf('Hillcrest')!.querySelector('[data-opportunity-product-narrow]') as HTMLElement
    assert.equal(narrow.textContent, 'School ERP')
    assert.match(narrow.className, /@md\/opportunities:hidden/, 'hidden once the table is wide enough to show the column')
    absent(s.rowOf('Pongal')!.querySelector('[data-opportunity-product-narrow]'), 'no product, no line')
    const head = s.k.all('thead th').find((th) => th.textContent === 'Product')!
    assert.match(head.className, /hidden @md\/opportunities:table-cell/, 'the column itself is hidden on a narrow table')
    assert.ok(s.k.one('[class*="@container/opportunities"]'), 'the table box is the container the width is measured against')
    s.restore()
  })

  it('keeps its place on a page where no opportunity has a product, and the loading and empty rows span it', async () => {
    const s = await open({ pages: { 1: { items: [opportunity({ product: PRODUCT })], total: 25 }, 2: { items: [], total: 25 } } })
    assert.ok(s.heads().includes('Product'))
    await s.next()
    assert.ok(s.heads().includes('Product'), 'the column did not vanish on the next page')
    const empty = s.k.one('tbody td[colspan]') as HTMLTableCellElement
    assert.equal(empty.colSpan, 7, 'the empty row spans the six columns and Product')
    s.restore()
  })

  it('the row that says "loading" spans six columns before any product is known and seven once the Product column shows', async () => {
    const holds: Record<number, Promise<void>> = {}
    const release: Record<number, () => void> = {}
    for (const page of [1, 2]) holds[page] = new Promise<void>((resolve) => { release[page] = resolve })
    const screen = await screenKit({
      respond: (call: Call) => {
        if (call.path.endsWith('/crm/opportunities/pipeline')) return pipelineAnswer()
        if (call.path.endsWith('/crm/opportunities')) {
          const page = Number(call.query.get('page') ?? 1)
          if (page === 0) return listAnswer([])
          const items = page === 1 ? [opportunity({ product: PRODUCT })] : [opportunity({ id: '33', name: 'Pongal supplies', product: null })]
          return holds[page].then(() => listAnswer(items, 25))
        }
        return undefined
      },
    })
    const { OpportunityListView } = await import('../../components/domain/crm/opportunity-list-view')
    release[1]()
    await screen.mount(screen.k.h(OpportunityListView), 40)
    const { k } = screen
    await k.click(k.withText('Table')!)
    await k.tick(40)
    await k.tick(40)
    const loadingCell = () => k.one('tbody td[colspan]') as HTMLTableCellElement | null
    assert.ok(k.all('thead th').some((th) => th.textContent === 'Product'), 'the first page arrived with a product')
    await k.click(k.withText('Next')!)
    await k.tick(30)
    assert.ok(loadingCell() !== null, 'the second page is held back, so the loading row is there')
    assert.equal(loadingCell()!.colSpan, 7, 'the Product column shows, and the loading row spans it')
    release[2]()
    await k.tick(40)
    screen.restore()
  })

  it('the rows keep their meaning with the new column: the stage, the amount, the date and the click still work', async () => {
    const s = await open({ pages: { 1: { items: [opportunity({ product: PRODUCT })], total: 1 } } })
    const cells = s.cells('Hillcrest')
    assert.equal(cells[2], 'School ERP', 'Product after Name')
    assert.equal(cells[3], 'Hillcrest Academy')
    assert.equal(cells[4], 'Negotiation/Review')
    assert.equal(cells.at(-1), '2026-12-15')
    await s.k.click(s.rowOf('Hillcrest')!)
    assert.equal(s.router.written.at(-1), '/module/crm/sales/opportunities/31')
    s.restore()
  })

  it('adds no send, schedule or run control', async () => {
    const s = await open({ pages: { 1: { items: [opportunity({ product: PRODUCT })], total: 1 } } })
    const labels = s.k.all('button').map((b) => (b.textContent ?? '').toLowerCase())
    assert.ok(labels.length >= 5 && labels.some((label) => label.includes('add opportunity')), 'the screen is really there, so the check below is not vacuous')
    assert.equal(labels.some((label) => /send|schedule|launch|start|run/.test(label)), false, `buttons: ${labels.join(' | ')}`)
    s.restore()
  })

  it('has nothing for the accessibility rules to find', async () => {
    const s = await open({ pages: { 1: { items: [opportunity({ product: PRODUCT }), opportunity({ id: '32', name: 'Pongal supplies', product: null })], total: 2 } } })
    assert.deepEqual(await axeViolations(s.k.w.document.body), [])
    s.restore()
  })
})
