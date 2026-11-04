import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signal-review/router-harness'
import type { PmEnvelope, PmListData, PmListData as ListData, PmMeta, PmOption, PmRecord } from '../../services/product-master/types'
import { line, lineRecord, list, meta, options, sub, subProductRecord } from './lines-fixtures'

/** The product lines of the Products screen in a fake browser: the address kept by a stand-in router, the server replaced by a fake. */
interface Setup {
  search?: string
  data?: () => Promise<PmEnvelope<ListData>>
  can?: Parameters<typeof meta>[1]
  session?: boolean
  scopeSwitch?: unknown
  holdChoicesAfterCreate?: boolean
}

async function setup(opts: Setup = {}) {
  const k = await kit()
  const router = await routerHarness(opts.search ?? 'scope=lines', '/module/crm/sales/products')
  const { ProductLinesView } = await import('../../components/domain/crm/product-lines-view')

  // The fake browser's storage outlives a test, so a test that wants no session must remove the one an earlier test left.
  if (opts.session !== false) k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  else k.w.localStorage.removeItem('userData')
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const listCalls: Array<{ status?: string; q?: string }> = []
  const created: Array<Record<string, unknown>> = []
  const service = {
    list: async (params: { status?: string; q?: string } = {}) => { listCalls.push(params); return opts.data ? opts.data() : { status: 1, data: list() } },
    meta: async (): Promise<PmEnvelope<PmMeta>> => ({ status: 1, data: meta({}, opts.can ?? {}) }),
    // `holdChoicesAfterCreate`: the refreshed list of choices is slow to arrive after something was created, so only what the screen added at once is there.
    options: (): Promise<PmEnvelope<PmOption[]>> => (opts.holdChoicesAfterCreate && created.length > 0 ? new Promise(() => undefined) : Promise.resolve({ status: 1, data: options() })),
    create: async (body: Record<string, unknown>): Promise<PmEnvelope<PmRecord>> => {
      created.push(body)
      return { status: 1, data: body.kind === 'product' ? lineRecord({ id: 99, key: String(body.key), name: String(body.name) }) : subProductRecord({ id: 99, name: String(body.name ?? 'New') }) }
    },
    update: async (): Promise<PmEnvelope<PmRecord>> => ({ status: 1, data: subProductRecord() }),
  }

  const recordHref = (id: number) => `/module/crm/sales/products/lines/${id}`
  const catalogueHref = (id: number, type: string | null) => `/module/crm/sales/${type === 'service' ? 'services' : 'products'}/${id}`
  const scopeSwitch = opts.scopeSwitch === undefined ? k.h('div', { 'data-testid': 'switch' }, 'SWITCH') : opts.scopeSwitch

  await k.render(router.wrap(k.h(ProductLinesView, { scopeSwitch, recordHref, catalogueHref, service })))
  await k.tick(10)

  const rowOf = (name: string) => k.all('tbody tr').find((tr) => tr.querySelector('a, td')?.textContent?.includes(name)) ?? null
  const hrefOf = (name: string) => k.all('a').find((a) => a.textContent === name)?.getAttribute('href') ?? null
  return { k, router, service, listCalls, created, rowOf, hrefOf }
}

describe('the product lines of the Products screen: the list', () => {
  afterEach(disposeAll)

  it('shows the Products title, the switch it was given, and each product line with the sub-products inside it', async () => {
    const { k, rowOf } = await setup()
    assert.equal(k.one('h1')!.textContent, 'Products')
    assert.ok(k.one('[data-testid="switch"]'), 'the screen\'s own switch is drawn under the title')
    assert.ok(k.bodyText().includes('4 sub-products in 3 product lines.'))

    const heads = k.all('thead th').map((th) => th.textContent)
    assert.deepEqual(heads, ['Name', 'ID', 'Readiness', 'Sold in CRM', 'Signals', 'ICP'])

    const scholar = rowOf('ScholarClone')!.textContent!
    for (const part of ['product line · 3 sub-products', 'Shared', 'scholarclone', '2 of 3', '31', '1 of 3']) assert.ok(scholar.includes(part), part)   // 2 of 3 sold, 1 of 3 with an active ICP
    const fee = rowOf('Fee Collection')!.textContent!
    for (const part of ['SCH-11', 'Live – with client', 'Not set up', '4', 'Active']) assert.ok(fee.includes(part), part)
    assert.ok(rowOf('Admissions')!.textContent!.includes('Sold'))
    assert.ok(rowOf('Admissions')!.textContent!.includes('Draft'))
    assert.ok(rowOf('Payroll Cloud')!.textContent!.includes('0 of 1'), 'a line says how many of its sub-products have an active ICP: its one sub-product has none')
    assert.ok(!rowOf('Payroll Cloud')!.textContent!.includes('Shared'), 'a line of the organisation\'s own is not marked shared')
  })

  it('draws a real zero as 0 and no signals as a dash', async () => {
    const { rowOf } = await setup({ data: async () => ({ status: 1, data: list({ products: [line({ signalsFound: null, icp: null, subProducts: [sub({ signalsFound: 0, icp: 'none' })] })] }) }) })
    const cells = (name: string) => Array.from(rowOf(name)!.querySelectorAll('td')).map((td) => td.textContent)
    assert.equal(cells('Fee Collection')[4], '0')
    assert.equal(cells('ScholarClone')[4], '—')
    assert.equal(cells('ScholarClone')[5], '0 of 1', 'an ICP belongs to a sub-product: the line counts the sub-products that have an active one')
  })

  it('says in the ICP column how many of a line\x27s sub-products have an active profile, with the sentence in its tooltip, and a dash for a line with none', async () => {
    const { rowOf } = await setup()
    const cell = (name: string) => rowOf(name)!.querySelectorAll('td')[5]
    assert.equal(cell('ScholarClone').textContent, '1 of 3')
    assert.equal(cell('ScholarClone').querySelector('[data-line-icp]')!.getAttribute('title'), '1 of 3 sub-products have an active ideal-customer profile. Each sub-product has its own profile, set up in the Portfolio.')
    assert.equal(cell('Enterprise Brain').textContent, '—', 'no sub-products: nothing to set up')
    assert.ok(cell('Enterprise Brain').querySelector('[data-line-icp]')!.getAttribute('title')!.includes('no sub-products yet'))
  })

  it('opens a line, and a sub-product that is not sold, on its own page; a sold one opens in its own catalogue, by type', async () => {
    const { hrefOf } = await setup()
    assert.equal(hrefOf('ScholarClone'), '/module/crm/sales/products/lines/1')
    assert.equal(hrefOf('Fee Collection'), '/module/crm/sales/products/lines/11', 'not sold: its own page')
    assert.equal(hrefOf('Admissions'), '/module/crm/sales/products/301', 'sold as a product: the Products page')
    assert.equal(hrefOf('Timetable'), '/module/crm/sales/services/302', 'sold as a service: the Services page')
  })

  it('hides a line\'s sub-products when it is collapsed and shows them again when it is expanded', async () => {
    const { k, rowOf } = await setup()
    assert.ok(rowOf('Fee Collection'))
    await k.click(k.one('button[aria-label="Collapse ScholarClone"]')!)
    assert.equal(rowOf('Fee Collection'), null)
    assert.equal(k.one('button[aria-label="Expand ScholarClone"]')!.getAttribute('aria-expanded'), 'false')
    assert.ok(rowOf('Payslips'), 'another line stays open')
    await k.click(k.one('button[aria-label="Expand ScholarClone"]')!)
    assert.ok(rowOf('Fee Collection'))
  })

  it('says a line has no sub-products and offers to add one only where that is allowed', async () => {
    const own = line({ id: 9, key: 'payroll_cloud', name: 'Payroll Cloud', shared: false, subProducts: [] })
    const shared = line({ id: 2, key: 'enterprise_brain', name: 'Enterprise Brain', shared: true, subProducts: [] })
    const archived = line({ id: 3, key: 'old', name: 'Old Line', shared: false, status: 'archived', subProducts: [] })

    const allowed = await setup({ data: async () => ({ status: 1, data: list({ products: [own, shared, archived] }) }) })
    const empties = allowed.k.all('tbody tr').filter((tr) => tr.textContent!.includes('No sub-products yet.'))
    assert.equal(empties.length, 3)
    assert.deepEqual(empties.map((tr) => Boolean(tr.querySelector('button'))), [true, false, false], 'only the organisation\'s own, active line')
  })

  it('hides the "no sub-products" row of a line while that line is collapsed, and shows it again when it is expanded', async () => {
    const own = line({ id: 9, key: 'payroll_cloud', name: 'Payroll Cloud', shared: false, subProducts: [] })
    const { k } = await setup({ data: async () => ({ status: 1, data: list({ products: [own] }) }) })
    assert.ok(k.bodyText().includes('No sub-products yet.'))
    await k.click(k.one('button[aria-label="Collapse Payroll Cloud"]')!)
    assert.ok(!k.bodyText().includes('No sub-products yet.'))
    await k.click(k.one('button[aria-label="Expand Payroll Cloud"]')!)
    assert.ok(k.bodyText().includes('No sub-products yet.'))
  })

  it('does not offer to add a sub-product to someone who may not', async () => {
    const own = line({ id: 9, name: 'Payroll Cloud', shared: false, subProducts: [] })
    const { k } = await setup({ can: { createSubProduct: false }, data: async () => ({ status: 1, data: list({ products: [own] }) }) })
    assert.ok(k.bodyText().includes('No sub-products yet.'))
    assert.ok(!k.withText('Add one'))
  })

  it('marks an archived sub-product, and an archived line', async () => {
    const { rowOf } = await setup({ data: async () => ({ status: 1, data: list({ products: [line({ status: 'archived', subProducts: [sub({ status: 'archived' })] })] }) }) })
    assert.ok(rowOf('ScholarClone')!.textContent!.includes('Archived'))
    assert.ok(rowOf('Fee Collection')!.textContent!.includes('Archived'))
  })

  it('explains what the columns mean', async () => {
    const { k } = await setup()
    const note = k.bodyText()
    for (const part of ['Sub-product IDs come from the Portfolio', '“Sold in CRM” means', 'best-matching offer', 'Built-in']) assert.ok(note.includes(part), part)
  })
})

describe('the product lines of the Products screen: asking and answering', () => {
  afterEach(disposeAll)

  it('asks for the active ones with no search to begin with', async () => {
    const { listCalls } = await setup()
    assert.deepEqual(listCalls[0], { status: 'active', q: undefined })
  })

  it('reads the search and the status from the address', async () => {
    const { k, listCalls } = await setup({ search: 'scope=lines&q=payroll&status=archived' })
    assert.deepEqual(listCalls[0], { status: 'archived', q: 'payroll' })
    assert.equal((k.one('input[type="search"], input') as HTMLInputElement).value, 'payroll')
  })

  it('shows the loading state until the answer arrives, then the list', async () => {
    let release: (value: PmEnvelope<PmListData>) => void = () => undefined
    const pending = new Promise<PmEnvelope<PmListData>>((resolve) => { release = resolve })
    const { k } = await setup({ data: () => pending })
    assert.ok(k.one('[role="status"]')!.textContent!.includes('Loading'))
    assert.equal(k.all('tbody tr').length, 0)

    release({ status: 1, data: list() })
    await k.tick(10)
    assert.ok(k.all('tbody tr').length > 0)
    assert.ok(!k.bodyText().includes('Loading…'))
  })

  it('shows the answer to the newest search, not a slower answer to an older one', async () => {
    const pending: Array<(value: PmEnvelope<PmListData>) => void> = []
    const { k } = await setup({ data: () => new Promise<PmEnvelope<PmListData>>((resolve) => { pending.push(resolve) }) })
    assert.equal(pending.length, 1, 'the first list is asked for')

    const search = k.one('input') as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLInputElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(search, 'payroll'); search.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
    await k.tick(450)
    assert.equal(pending.length, 2, 'typing asks again, once typing has paused')

    // The newer answer arrives first, then the older one, late.
    pending[1]({ status: 1, data: list({ products: [line({ id: 9, key: 'payroll_cloud', name: 'Payroll Cloud', shared: false, subProducts: [] })] }) })
    await k.tick(20)
    pending[0]({ status: 1, data: list() })
    await k.tick(20)

    assert.ok(k.bodyText().includes('Payroll Cloud'))
    assert.ok(!k.bodyText().includes('Enterprise Brain'), 'the late answer to the old search did not replace the newer one')
  })

  it('shows the error with a Retry that asks again', async () => {
    let calls = 0
    const { k, listCalls } = await setup({ data: async () => { calls += 1; if (calls === 1) throw new Error('The server did not answer.'); return { status: 1, data: list() } } })
    assert.ok(k.bodyText().includes('The server did not answer.'))
    assert.equal(k.all('tbody tr').length, 0)

    await k.click(k.withText('Retry')!)
    await k.tick(10)
    assert.equal(listCalls.length, 2)
    assert.ok(k.all('tbody tr').length > 0)
    assert.ok(!k.bodyText().includes('The server did not answer.'))
  })

  it('says so, and asks nothing, when there is no session', async () => {
    const { k, listCalls } = await setup({ session: false })
    assert.equal(listCalls.length, 0)
    assert.ok(k.bodyText().includes('Your ERP session is unavailable.'))
  })

  it('says the product lines are not set up here when the server has no Product Master', async () => {
    const { k } = await setup({ data: async () => ({ status: 1, data: list({ available: false, products: [], totals: { products: 0, subProducts: 0, items: 0 } }) }) })
    assert.ok(k.bodyText().includes('Product lines are not set up here yet'))
    assert.equal(k.all('tbody tr').length, 0)
    assert.ok(!k.bodyText().includes('No product lines yet'), 'that is a different state')
  })

  it('says there are no product lines yet, and offers to make one, when there are none', async () => {
    const { k } = await setup({ data: async () => ({ status: 1, data: list({ products: [], totals: { products: 0, subProducts: 0, items: 0 } }) }) })
    assert.ok(k.bodyText().includes('No product lines yet'))
    assert.ok(k.bodyText().includes('Create your first product line to start.'))
    assert.ok(k.withText('New…'), 'the empty state offers New… too')
  })

  it('does not invite someone who may create nothing to create the first product line', async () => {
    const { k } = await setup({ can: { createProduct: false, createSubProduct: false }, data: async () => ({ status: 1, data: list({ products: [], totals: { products: 0, subProducts: 0, items: 0 } }) }) })
    assert.ok(k.bodyText().includes('No product lines yet'))
    assert.ok(k.bodyText().includes('Nothing has been added yet.'))
    assert.ok(!k.bodyText().includes('Create your first product line'))
  })

  it('says nothing matches, and offers to clear it, when a search finds nothing', async () => {
    const { k, router } = await setup({ search: 'scope=lines&q=zzz', data: async () => ({ status: 1, data: list({ products: [], totals: { products: 0, subProducts: 0, items: 0 } }) }) })
    assert.ok(k.bodyText().includes('Nothing matches'))
    await k.click(k.withText('Clear search and filter')!)
    await k.tick(10)
    assert.ok(!router.lastSearch().includes('q='), `the search is cleared from the address: ${router.lastSearch()}`)
    assert.ok(router.lastSearch().includes('scope=lines'), 'and the scope is kept')
  })

  it('offers New… only when the server says this person may create something', async () => {
    const some = await setup()
    assert.ok(some.k.withText('New…'))
    await disposeAll()

    const none = await setup({ can: { createProduct: false, createSubProduct: false } })
    assert.equal(none.k.withText('New…'), null)
  })
})

describe('the product lines of the Products screen: the New… menu', () => {
  afterEach(disposeAll)

  /** Radix opens a menu on the pointer going down, not on a click. */
  const openMenu = async (k: Awaited<ReturnType<typeof setup>>['k']) => {
    const trigger = k.withText('New…')!
    await k.act(async () => { trigger.dispatchEvent(new k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
    await k.tick(30)
  }
  const menuItems = (k: Awaited<ReturnType<typeof setup>>['k']) => k.all('[role="menuitem"]').map((el) => el.textContent)

  it('offers a product line and a sub-product, and never a catalogue item', async () => {
    const { k } = await setup()
    await openMenu(k)
    const items = menuItems(k)
    assert.equal(items.length, 2, items.join(' | '))
    assert.ok(items[0]!.startsWith('A product line'))
    assert.ok(items[1]!.startsWith('A sub-product'))
    assert.ok(!items.some((t) => /catalogue item|service/i.test(t ?? '')))
  })

  it('offers only a sub-product to someone who may not create a product line', async () => {
    const { k } = await setup({ can: { createProduct: false } })
    await openMenu(k)
    const items = menuItems(k)
    assert.equal(items.length, 1)
    assert.ok(items[0]!.startsWith('A sub-product'))
  })

  it('creates a product line, says so, and offers to add its first sub-product with that line already chosen', async () => {
    const { k, created } = await setup({ holdChoicesAfterCreate: true })
    await openMenu(k)
    await k.click(k.all('[role="menuitem"]')[0])
    await k.tick(40)
    assert.ok(k.bodyText().includes('New product line'))

    const labelled = (text: string) => k.all('input').find((el) => k.w.document.querySelector(`label[for="${el.id}"]`)?.textContent?.startsWith(text)) as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLInputElement.prototype, 'value')!.set!
    for (const [label, value] of [['Name', 'Payroll Cloud'], ['Key', 'payroll_cloud']] as const) {
      await k.act(async () => { const el = labelled(label); set.call(el, value); el.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
    }
    await k.click(k.withText('Create')!)
    await k.tick(40)

    assert.deepEqual(created[0], { kind: 'product', name: 'Payroll Cloud', key: 'payroll_cloud' })
    assert.ok(k.bodyText().includes('Product line created.'))
    assert.ok(k.withText('Add its first sub-product'), 'the next step is offered')

    // The new line is in the picker at once (the fake server\'s list of choices does not have it), so the form opens with it chosen.
    await k.click(k.withText('Add its first sub-product')!)
    await k.tick(40)
    assert.ok(k.bodyText().includes('New sub-product'))
    const lineSelect = k.all('select').find((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent?.startsWith('Product line')) as HTMLSelectElement
    assert.equal(lineSelect.value, '99')
    assert.ok(Array.from(lineSelect.options).some((o) => o.textContent === 'Payroll Cloud'))
  })
})

describe('the product lines of the Products screen: adding a sub-product', () => {
  afterEach(disposeAll)

  it('opens the form on that product line from "Add one" under an empty line, and saves what was typed', async () => {
    const own = line({ id: 9, key: 'payroll_cloud', name: 'Payroll Cloud', shared: false, subProducts: [] })
    const { k, created } = await setup({ data: async () => ({ status: 1, data: list({ products: [own] }) }) })

    await k.click(k.withText('Add one')!)
    await k.tick(20)
    assert.ok(k.bodyText().includes('New sub-product'))

    const fill = async (selector: string, value: string, proto: 'input' | 'select' | 'textarea' = 'input') => {
      const el = k.one(selector) as HTMLInputElement
      const ctor = proto === 'select' ? k.w.HTMLSelectElement : proto === 'textarea' ? k.w.HTMLTextAreaElement : k.w.HTMLInputElement
      const set = Object.getOwnPropertyDescriptor(ctor.prototype, 'value')!.set!
      await k.act(async () => { set.call(el, value); el.dispatchEvent(new k.w.Event(proto === 'select' ? 'change' : 'input', { bubbles: true })) })
    }
    const productSelect = k.all('select').find((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent?.startsWith('Product line'))
    assert.ok(productSelect, 'the sub-product form says "Product line"')
    assert.equal((productSelect as HTMLSelectElement).value, '9', 'the line the person asked from is already chosen')

    const labelled = (text: string) => k.all('input, textarea, select').find((el) => k.w.document.querySelector(`label[for="${el.id}"]`)?.textContent?.startsWith(text)) as HTMLElement
    await fill(`#${labelled('Name').id}`, 'Payslips')
    await fill(`#${labelled('Sub-product ID').id}`, 'PC-1')
    await fill(`#${labelled('Readiness').id}`, 'Prototype', 'select')
    await k.click(k.withText('Create')!)
    await k.tick(20)

    assert.equal(created.length, 1)
    assert.equal(created[0].kind, 'sub_product')
    assert.equal(created[0].name, 'Payslips')
    assert.equal(created[0].offerId, 'PC-1')
    assert.equal(created[0].productId, 9)
    assert.ok(k.bodyText().includes('Sub-product created.'))
  })
})
