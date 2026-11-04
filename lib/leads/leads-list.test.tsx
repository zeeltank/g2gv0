import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent } from '../agent/assertions'
import type { Lead } from '../../types/crm'
import { contractLead, lead, options } from './fixtures'
import { screenKit, type Call } from './screen-kit'

/** The Leads screen as a person meets it: the real list, the real sidebar hook and service client, only the network replaced. */

const HEADS_AS_ALWAYS = ['First Name', 'Last Name', 'Company', 'Email', 'Status', 'Source', 'Rating', 'Score']

interface Setup {
  search?: string
  leads?: unknown[]
  total?: number
  options?: unknown
  optionsStatus?: number
  onList?: (call: Call) => void
}

function listAnswer(items: unknown[], total?: number) {
  return { status: 1, message: 'Leads.', data: { items, pagination: { current_page: 1, last_page: Math.max(1, Math.ceil((total ?? items.length) / 20)), per_page: 20, total: total ?? items.length } } }
}

async function open(opts: Setup = {}) {
  const screen = await screenKit({
    search: opts.search ?? '',
    respond: (call) => {
      if (call.path.endsWith('/crm/leads')) { opts.onList?.(call); return listAnswer(opts.leads ?? [lead(), lead({ id: '42', firstName: 'Ravi', lastName: 'Iyer', email: null })], opts.total) }
      if (call.path.endsWith('/product-master/options')) return opts.optionsStatus ? { status: 0, message: 'No.', __status: opts.optionsStatus } : { status: 1, data: opts.options ?? [] }
      if (call.path.endsWith('/crm/picklist-values')) return { status: 1, message: 'ok', data: { leads: {} } }
      return undefined
    },
  })
  const { LeadListView } = await import('../../components/domain/crm/lead-list-view')
  await screen.mount(screen.k.h(LeadListView), 40)
  const { k } = screen
  const heads = () => k.all('thead th').slice(1).map((th) => th.textContent)
  const rowOf = (name: string) => k.all('tbody tr').find((tr) => tr.textContent?.includes(name)) ?? null
  const box = (label: string) => k.all('select').find((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent === label) as HTMLSelectElement | undefined
  const choose = async (label: string, value: string) => {
    const select = box(label)
    assert.ok(select, `the ${label} box is drawn`)
    await k.act(async () => {
      const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
      set.call(select, value)
      select.dispatchEvent(new k.w.Event('change', { bubbles: true }))
    })
    await k.tick(30)
    await k.tick(30)
  }
  const listCalls = () => screen.to('/crm/leads')
  const lastListQuery = () => listCalls().at(-1)!.query
  return { ...screen, heads, rowOf, box, choose, listCalls, lastListQuery }
}

const withProduct = (over: Record<string, unknown> = {}) => contractLead({ id: '51', firstName: 'Meera', lastName: 'Nair', email: 'meera@x.example', ...over })

describe('the Leads screen against an older server (none of slice 6\'s fields)', () => {
  afterEach(async () => { await disposeAll() })

  it('looks exactly as it always did: the same columns, no Product box, no chips, a clean address', async () => {
    const s = await open()
    assert.deepEqual(s.heads(), HEADS_AS_ALWAYS)
    absent(s.box('Product'), 'no product to choose, so no Product box')
    assert.equal(s.k.all('[data-consent]').length, 0, 'no consent chip')
    assert.equal(s.k.all('[data-from-signal]').length, 0, 'no signal marker')
    assert.deepEqual(s.router.written, [], 'the address was not touched')
    assert.ok(s.k.bodyText().includes('2 leads'))
    s.restore()
  })

  it('keeps the header buttons, the search and a lead row that opens its page', async () => {
    const s = await open()
    for (const label of ['Import', 'Find Duplicates', 'Add Lead']) assert.ok(s.k.all('button').some((b) => b.textContent?.includes(label)), label)
    assert.ok(s.k.one('input[placeholder="Search name, company, or email…"]'))
    await s.k.click(s.rowOf('Asha')!)
    assert.equal(s.router.written.at(-1), '/module/crm/marketing/leads/41')
    s.restore()
  })

  it('asks for the leads without any of the new filter parameters', async () => {
    const s = await open()
    const q = s.lastListQuery()
    for (const name of ['product_id', 'consent', 'has_signal']) assert.equal(q.has(name), false, name)
    assert.equal(q.get('page'), '1')
    s.restore()
  })

  it('says "No leads yet" for an empty list that nothing filtered', async () => {
    const s = await open({ leads: [] })
    assert.ok(s.k.bodyText().includes('No leads yet. Click “Add Lead” to create one.'))
    s.restore()
  })

  it('shows the Consent and Origin boxes even without a product, and a lead made from a signal by the older source column', async () => {
    const s = await open({ leads: [lead({ sourceCompanyOpportunityId: '40' }), lead({ id: '42', firstName: 'Ravi', lastName: 'Iyer' })] })
    assert.ok(s.box('Consent') && s.box('Origin'))
    assert.equal(s.rowOf('Asha')!.querySelectorAll('[data-from-signal]').length, 1, 'the older column is enough for the marker')
    assert.equal(s.rowOf('Ravi')!.querySelectorAll('[data-from-signal]').length, 0)
    s.restore()
  })
})

describe('the Leads screen: product, consent and signal', () => {
  afterEach(async () => { await disposeAll() })

  it('adds a Product column after Company when a lead has a product, and a dash for one that has none', async () => {
    const s = await open({ leads: [withProduct(), withProduct({ id: '52', firstName: 'Ravi', lastName: 'Iyer', product: null })], options })
    assert.deepEqual(s.heads(), ['First Name', 'Last Name', 'Company', 'Product', 'Email', 'Status', 'Source', 'Rating', 'Score'])
    const cells = (name: string) => Array.from(s.rowOf(name)!.querySelectorAll('td')).map((td) => td.textContent)
    assert.equal(cells('Meera')[4], 'School ERP')
    assert.equal(cells('Ravi')[4], '—')
    s.restore()
  })

  it('draws the Product box with every product the Product Master lists', async () => {
    const s = await open({ options })
    const box = s.box('Product')!
    assert.deepEqual(Array.from(box.options).map((o) => o.textContent), ['All products', 'ScholarClone', 'ScholarClone › School ERP', 'G2G'])
    s.restore()
  })

  it('when the products cannot be read (no right, a server without the Product Master) the Product box is simply not drawn and the list works as before', async () => {
    const s = await open({ optionsStatus: 403 })
    absent(s.box('Product'), 'no Product box')
    assert.deepEqual(s.heads(), HEADS_AS_ALWAYS)
    assert.ok(s.rowOf('Asha'), 'the leads are listed')
    assert.equal(s.k.bodyText().includes('Unable to'), false, 'a failed products read is not shown as an error on the list')
    s.restore()
  })

  it('choosing a product writes it to the address, asks the server for it, and the column stays even if nothing matches', async () => {
    const s = await open({ options, leads: [] })
    assert.equal(s.heads().includes('Product'), false)
    await s.choose('Product', '9')
    assert.equal(s.router.lastSearch(), 'product_id=9')
    assert.equal(s.lastListQuery().get('product_id'), '9')
    assert.ok(s.heads().includes('Product'), 'a filter on the product shows its column')
    assert.ok(s.k.bodyText().includes('No leads match these filters.'))
    assert.equal(s.k.bodyText().includes('No leads yet'), false)
    s.restore()
  })

  it('the empty and loading rows span exactly the columns that are drawn (the Product column included)', async () => {
    const s = await open({ options, leads: [] })
    await s.choose('Product', '9')
    const empty = s.k.one('tbody td[colspan]') as HTMLTableCellElement
    assert.equal(Number(empty.getAttribute('colspan')), s.k.all('thead th').length, 'the empty message spans the whole table')
    s.restore()
  })

  it('the Consent and Origin boxes write the contract\'s names to the address and the request', async () => {
    const s = await open()
    await s.choose('Consent', 'blocked')
    assert.equal(s.lastListQuery().get('consent'), 'blocked')
    assert.equal(s.router.lastSearch(), 'consent=blocked')
    await s.choose('Origin', '1')
    assert.equal(s.lastListQuery().get('has_signal'), '1')
    assert.equal(s.lastListQuery().get('consent'), 'blocked', 'the first filter is kept')
    assert.equal(s.router.lastSearch(), 'consent=blocked&has_signal=1')
    s.restore()
  })

  it('opens from an address that names the filters: the boxes show them and the first request already carries them', async () => {
    const s = await open({ search: 'product_id=9&consent=blocked&has_signal=1', options })
    const q = s.listCalls()[0].query
    assert.deepEqual([q.get('product_id'), q.get('consent'), q.get('has_signal')], ['9', 'blocked', '1'])
    assert.equal(s.box('Product')!.value, '9')
    assert.equal(s.box('Consent')!.value, 'blocked')
    assert.equal(s.box('Origin')!.value, '1')
    s.restore()
  })

  it('keeps a product the address names but the list does not hold, so the box never shows a wrong value', async () => {
    const s = await open({ search: 'product_id=99', options })
    assert.equal(s.box('Product')!.value, '99')
    assert.ok(Array.from(s.box('Product')!.options).some((o) => o.textContent === 'Product #99'))
    s.restore()
  })

  it('a mistyped address opens the plain list, with no filter asked for', async () => {
    const s = await open({ search: 'product_id=abc&consent=maybe&has_signal=2' })
    const q = s.listCalls()[0].query
    for (const name of ['product_id', 'consent', 'has_signal']) assert.equal(q.has(name), false, name)
    s.restore()
  })

  it('Clear filters shows only while a filter is on, and puts the address and the request back', async () => {
    const s = await open({ options })
    absent(s.k.withText('Clear filters'), 'no Clear filters button on the plain list')
    await s.choose('Consent', 'allowed')
    assert.ok(s.k.withText('Clear filters'))
    await s.k.click(s.k.withText('Clear filters')!)
    await s.k.tick(40)
    assert.equal(s.router.lastSearch(), '')
    assert.equal(s.lastListQuery().has('consent'), false)
    absent(s.k.withText('Clear filters'), 'the button goes once nothing is filtered')
    assert.equal(s.box('Consent')!.value, '')
    s.restore()
  })

  it('each box on its own turns Clear filters on, and the empty list then says nothing matched', async () => {
    for (const [label, value] of [['Consent', 'blocked'], ['Origin', '1']] as const) {
      const s = await open({ leads: [] })
      absent(s.k.withText('Clear filters'), `${label}: not before choosing`)
      await s.choose(label, value)
      assert.ok(s.k.withText('Clear filters'), `${label}: Clear filters is offered`)
      assert.ok(s.k.bodyText().includes('No leads match these filters.'), `${label}: the empty list says nothing matched`)
      s.restore()
      await disposeAll()
    }
  })

  it('changing a filter goes back to the first page', async () => {
    const s = await open({ total: 45, leads: [lead()] })
    await s.k.click(s.k.withText('Next')!)
    await s.k.tick(40)
    assert.equal(s.lastListQuery().get('page'), '2')
    await s.choose('Origin', '1')
    assert.equal(s.lastListQuery().get('page'), '1')
    assert.equal(s.lastListQuery().get('has_signal'), '1')
    s.restore()
  })

  it('says in words when a lead is blocked, and what it recorded: opted out, suppressed, opted in; and nothing for a lead nobody recorded anything for', async () => {
    const s = await open({
      leads: [
        lead({ id: '1', firstName: 'Out', lastName: 'Lead', consentStatus: 'opted_out' }),
        lead({ id: '2', firstName: 'Sup', lastName: 'Lead', consentStatus: 'suppressed' }),
        lead({ id: '3', firstName: 'Inn', lastName: 'Lead', consentStatus: 'opted_in' }),
        lead({ id: '4', firstName: 'Unk', lastName: 'Lead', consentStatus: 'unknown' }),
        lead({ id: '5', firstName: 'Flag', lastName: 'Lead', consentStatus: null, emailOptOut: true }),
      ],
    })
    const chip = (name: string) => s.rowOf(name)!.querySelector('[data-consent]') as HTMLElement | null
    assert.equal(chip('Out')!.textContent, 'Blocked: opted out')
    assert.equal(chip('Out')!.getAttribute('data-allowed'), 'false')
    assert.equal(chip('Sup')!.textContent, 'Blocked: suppressed')
    assert.equal(chip('Inn')!.textContent, 'Opted in')
    assert.equal(chip('Inn')!.getAttribute('data-allowed'), 'true')
    absent(chip('Unk'), 'an unknown consent draws no chip')
    assert.equal(chip('Flag')!.textContent, 'Blocked: opted out')
    assert.ok(chip('Out')!.getAttribute('title')!.includes('They opted out of email'), 'the reason is the tooltip')
    // the colour only helps: a blocked chip has the amber border, an opted-in one the green border, and both say so in words above
    assert.ok(chip('Out')!.className.includes('border-amber-500'), 'blocked: amber border')
    assert.ok(chip('Inn')!.className.includes('border-success'), 'opted in: green border')
    assert.deepEqual(s.heads(), HEADS_AS_ALWAYS, 'a chip adds no column')
    s.restore()
  })

  it('marks a lead made from a signal, in words, beside its company', async () => {
    const s = await open({ leads: [withProduct(), withProduct({ id: '52', firstName: 'Ravi', lastName: 'Iyer', source_signal_id: null })], options })
    const marker = s.rowOf('Meera')!.querySelector('[data-from-signal]') as HTMLElement
    assert.equal(marker.textContent, 'From a signal')
    assert.ok(s.rowOf('Meera')!.querySelectorAll('td')[3].contains(marker), 'it sits in the Company cell')
    absent(s.rowOf('Ravi')!.querySelector('[data-from-signal]'), 'a lead with no signal has no marker')
    s.restore()
  })

  it('has no accessibility violation a fake browser can find, with every new part on screen', async () => {
    const s = await open({
      options,
      leads: [withProduct({ consentStatus: 'opted_out' }), withProduct({ id: '52', firstName: 'Ravi', lastName: 'Iyer', consentStatus: 'opted_in', product: null })],
    })
    assert.deepEqual(await axeViolations(s.k.w.document.body), [])
    s.restore()
  })
})

describe('the Leads screen: saved views keep the filters', () => {
  afterEach(async () => { await disposeAll() })

  async function openWithViews(search: string, views: unknown[]) {
    const saved: unknown[] = []
    const screen = await screenKit({
      search,
      respond: (call) => {
        if (call.path.endsWith('/crm/leads')) return listAnswer([lead()])
        if (call.path.endsWith('/product-master/options')) return { status: 1, data: options }
        if (call.path.endsWith('/crm/picklist-values')) return { status: 1, message: 'ok', data: { leads: {} } }
        if (call.path.endsWith('/crm/saved-views') && call.method === 'GET') return { status: 1, message: 'ok', data: views }
        if (call.path.endsWith('/crm/saved-views') && call.method === 'POST') { saved.push(call.body); return { status: 1, message: 'Saved.', data: { id: '1', module: 'leads', name: 'x', conditions: {}, createdAt: null } } }
        return undefined
      },
    })
    const { LeadListView } = await import('../../components/domain/crm/lead-list-view')
    await screen.mount(screen.k.h(LeadListView), 40)
    await screen.k.click(screen.k.withText('Views')!)
    await screen.k.tick(40)
    await screen.k.tick(40)
    return { ...screen, saved }
  }

  it('applying a saved view that holds filters puts them in the address and the request', async () => {
    const s = await openWithViews('', [{ id: '7', module: 'leads', name: 'Blocked ERP leads', conditions: { search: '', productId: 9, consent: 'blocked', hasSignal: true }, createdAt: null }])
    const view = s.k.withText('Blocked ERP leads')
    assert.ok(view, 'the saved view is listed')
    await s.k.click(view)
    await s.k.tick(40)
    await s.k.tick(40)
    assert.equal(s.router.lastSearch(), 'product_id=9&consent=blocked&has_signal=1')
    const q = s.to('/crm/leads').at(-1)!.query
    assert.deepEqual([q.get('product_id'), q.get('consent'), q.get('has_signal')], ['9', 'blocked', '1'])
    s.restore()
  })

  it('applying a view saved before the filters existed leaves the person\'s filters alone', async () => {
    const s = await openWithViews('consent=blocked', [{ id: '8', module: 'leads', name: 'Old view', conditions: { search: 'asha', sortKey: 'lead_score', sortAsc: true }, createdAt: null }])
    await s.k.click(s.k.withText('Old view')!)
    await s.k.tick(40)
    await s.k.tick(40)
    assert.equal(s.to('/crm/leads').at(-1)!.query.get('consent'), 'blocked', 'the consent filter the person had is still on')
    assert.equal(s.to('/crm/leads').at(-1)!.query.get('search'), 'asha', 'and the old view still applies its search')
    s.restore()
  })

  it('saving a view keeps the filters that are on, beside the search and the sort', async () => {
    const s = await openWithViews('product_id=9&has_signal=1', [])
    await s.k.click(s.k.withText('Save current view')!)
    await s.k.tick(20)
    const input = s.k.one('input[placeholder="View name…"]') as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(s.k.w.HTMLInputElement.prototype, 'value')!.set!
    await s.k.act(async () => { set.call(input, 'Mine'); input.dispatchEvent(new s.k.w.Event('input', { bubbles: true })) })
    await s.k.click(s.k.withText('Save')!)
    await s.k.tick(40)
    assert.equal(s.saved.length, 1, 'the view was saved')
    const body = s.saved[0] as { conditions: Record<string, unknown> }
    assert.equal(body.conditions.productId, 9)
    assert.equal(body.conditions.hasSignal, true)
    assert.equal(body.conditions.consent, null)
    assert.equal(body.conditions.sortKey, 'created_at', 'what a view always kept is still kept')
    s.restore()
  })
})

describe('the Leads screen: rows keep working', () => {
  afterEach(async () => { await disposeAll() })

  it('a row with a product, a chip and a marker still opens its lead\'s page when clicked, and its tick box still selects it', async () => {
    const s = await open({ options, leads: [withProduct({ consentStatus: 'opted_out' })] })
    const tick = s.rowOf('Meera')!.querySelector('input[type="checkbox"]') as HTMLInputElement
    await s.k.click(tick)
    assert.equal(tick.checked, true)
    assert.equal(s.router.written.length, 0, 'the tick box does not open the lead')
    await s.k.click(s.rowOf('Meera')!.querySelectorAll('td')[1])
    assert.equal(s.router.written.at(-1), '/module/crm/marketing/leads/51')
    s.restore()
  })

  it('a lead with almost nothing filled in still gets one row, with its product and dashes for the rest', async () => {
    const sparse: Partial<Lead> = { id: '9', firstName: null, lastName: 'Sparse', company: null, email: null, leadStatus: null, product: { id: 3, key: null, name: 'Payroll Cloud' } }
    const s = await open({ options, leads: [lead(sparse)] })
    const rows = s.k.all('tbody tr')
    assert.equal(rows.length, 1)
    const cells = Array.from(rows[0].querySelectorAll('td')).map((td) => td.textContent)
    assert.deepEqual(cells.slice(1, 6), ['—', 'Sparse', '—', 'Payroll Cloud', '—'])
    s.restore()
  })
})
