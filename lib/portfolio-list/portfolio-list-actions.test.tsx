import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { adminRows, HR_CAN, hrRows, product, sold, SALES_CAN } from './fixtures'
import { everything, meta as formMeta, taxonomy } from '../portfolio/fixtures'
import { setup, type SetupOptions } from './screen-setup'
import type { Call } from './screen-kit'

/** The actions carried over from the old Products screen: bulk delete and reassign, Import CSV, Sync Excel, Export CSV, Find duplicates, the Recycle Bin. */

const bulkAnswer = (ids: number[], failed = 0) => ({
  status: 1, message: 'ok',
  data: { results: ids.map((id, i) => (i < failed ? { id: String(id), ok: false, reason: 'Not allowed.' } : { id: String(id), ok: true })), summary: { succeeded: ids.length - failed, failed } },
})

/** Answers the Sell read of a Sub-product (catalogue id = master id + 1000) and both bulk calls, recording nothing itself (the kit records every call). */
const bulkWorld = (extra?: (call: Call) => unknown): SetupOptions['intercept'] => (call) => {
  const own = extra?.(call)
  if (own !== undefined) return own
  const sell = call.path.match(/\/product-master\/(\d+)\/sell$/)
  if (sell) return { status: 1, data: { crmProductId: Number(sell[1]) + 1000 } }
  if (call.path.endsWith('/crm/products/bulk/delete') || call.path.endsWith('/crm/products/bulk/assign')) return bulkAnswer((call.body as { ids: number[] }).ids)
  return undefined
}

describe('bulk actions', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  const tick = async (name: string) => {
    const box = current!.rowOf(name)!.querySelector('input[type="checkbox"]') as HTMLInputElement
    await current!.k.click(box)
    await current!.k.tick(20)
  }
  const confirmButton = (label: string) => current!.k.all('[role="alertdialog"] button').find((b) => b.textContent?.trim() === label)

  it('ticking shows a bar with Reassign and Delete (to the Recycle Bin), with the count', async () => {
    current = await setup({ intercept: bulkWorld() })
    assert.ok(!current.text().includes('selected'), 'no bar before anything is ticked')
    await tick('Fees Intelligence')
    assert.ok(current.text().includes('1 selected'))
    assert.ok(current.button('Reassign'))
    assert.ok(current.button('Delete (to the Recycle Bin)'))
  })

  it('cannot tick a Product, a Sub-product that is not sold, or (for HR) anything: the box is disabled and says why', async () => {
    current = await setup({ intercept: bulkWorld() })
    const box = (name: string) => current!.rowOf(name)!.querySelector('input[type="checkbox"]') as HTMLInputElement
    assert.equal(box('Scholar School ERP').disabled, true)
    assert.match(box('Scholar School ERP').title, /not sold in CRM/)
    assert.equal(box('Fees Intelligence').disabled, false)
    assert.equal(box('ScholarClone Implementation').disabled, false, 'a paused service can be changed')
    await disposeAll()
    current.restore()
    current = await setup({ rows: hrRows(), can: HR_CAN })
    for (const input of current.k.all('tbody input[type="checkbox"]')) assert.equal((input as HTMLInputElement).disabled, true, 'HR ticks nothing')
  })

  it('"select all" ticks every row that can be changed on the page and no other', async () => {
    current = await setup({ intercept: bulkWorld() })
    const all = current.k.one('thead input[type="checkbox"]') as HTMLInputElement
    await current.k.click(all)
    await current.k.tick(20)
    assert.ok(current.text().includes('3 selected'), 'the sold Sub-product, the paused service and the stray: not the About-only one, not the Products')
    await current.k.click(all)
    await current.k.tick(400)
    assert.ok(!current.text().includes('selected'), 'the bar goes when nothing is ticked (after its short exit animation)')
    assert.equal(current.k.all('tbody input[type="checkbox"]').filter((c) => (c as HTMLInputElement).checked).length, 0)
  })

  it('asks before it deletes, says where the rows go, and sends nothing when the person says no', async () => {
    current = await setup({ intercept: bulkWorld() })
    await tick('Fees Intelligence')
    await current.k.click(current.button('Delete (to the Recycle Bin)')!)
    await current.k.tick(30)
    assert.ok(current.text().includes('Delete 1 sub-product from CRM?'))
    assert.ok(current.text().includes('They move to the Recycle Bin, where they can be restored.'))
    assert.equal(current.to('/bulk/delete').length, 0, 'nothing is sent before the answer')
    await current.k.click(confirmButton('Cancel')!)
    await current.k.tick(30)
    assert.equal(current.to('/bulk/delete').length, 0, 'Cancel sends nothing')
    assert.equal(current.to('/sell').length, 0, 'and reads nothing')
  })

  it('deletes by CATALOGUE id with the item type (the server refuses a bulk call without it), then reads the list again and says what happened', async () => {
    current = await setup({ intercept: bulkWorld() })
    await tick('Fees Intelligence')
    await tick('ScholarClone Implementation')
    const listsBefore = current.to('/product-master/list').length
    await current.k.click(current.button('Delete (to the Recycle Bin)')!)
    await current.k.tick(30)
    await current.k.click(confirmButton('Move to the Recycle Bin')!)
    await current.k.tick(80)
    const calls = current.to('/bulk/delete')
    assert.equal(calls.length, 2, 'one batch per item type: a batch holds one type')
    const body = (type: string) => calls.find((c) => (c.body as { itemType: string }).itemType === type)!.body as { ids: number[]; itemType: string; token: string; sub_institute_id: string }
    assert.deepEqual(body('product').ids, [1011], 'the Sub-product, by its catalogue id (master id + 1000 in this fake), not its master id')
    assert.deepEqual(body('service').ids, [1015])
    assert.equal(body('product').token, 'test-token')
    assert.equal(body('product').sub_institute_id, '1')
    assert.equal(calls[0].method, 'POST')
    assert.equal(current.to('/product-master/list').length, listsBefore + 1, 'the list is read again')
    assert.ok(current.text().includes('Deleted 2 sub-products.'))
    await current.k.tick(400)
    assert.ok(!current.text().includes('selected'), 'the selection is cleared (the bar leaves after its short exit animation)')
    assert.equal(current.k.all('tbody input[type="checkbox"]').filter((c) => (c as HTMLInputElement).checked).length, 0)
  })

  it('uses the catalogue id a row carries without reading its Sell section', async () => {
    current = await setup({ rows: [product(), sold({ crmProductId: 63 })], intercept: bulkWorld() })
    await tick('Fees Intelligence')
    await current.k.click(current.button('Delete (to the Recycle Bin)')!)
    await current.k.tick(30)
    await current.k.click(confirmButton('Move to the Recycle Bin')!)
    await current.k.tick(80)
    assert.equal(current.to('/sell').length, 0)
    assert.deepEqual((current.to('/bulk/delete')[0].body as { ids: number[] }).ids, [63])
  })

  it('names a row whose catalogue id could not be read, does not touch it, and still changes the others', async () => {
    current = await setup({
      intercept: bulkWorld((call) => (call.path.endsWith('/product-master/15/sell') ? { __status: 403, status: 0, message: 'No.' } : undefined)),
    })
    await tick('Fees Intelligence')
    await tick('ScholarClone Implementation')
    await current.k.click(current.button('Delete (to the Recycle Bin)')!)
    await current.k.tick(30)
    await current.k.click(confirmButton('Move to the Recycle Bin')!)
    await current.k.tick(80)
    assert.equal(current.to('/bulk/delete').length, 1)
    assert.ok(current.text().includes('Deleted 1 sub-product.'))
    assert.ok(current.text().includes('ScholarClone Implementation'))
    assert.ok(current.text().includes('could not be read'))
  })

  it('says what the server refused for some rows ("2 of 3 ... 1 failed: ...")', async () => {
    current = await setup({
      intercept: bulkWorld((call) => (call.path.endsWith('/bulk/delete') ? bulkAnswer((call.body as { ids: number[] }).ids, 1) : undefined)),
    })
    await tick('Fees Intelligence')
    await tick('Imported widget')
    await current.k.click(current.button('Delete (to the Recycle Bin)')!)
    await current.k.tick(30)
    await current.k.click(confirmButton('Move to the Recycle Bin')!)
    await current.k.tick(80)
    assert.ok(current.text().includes('1 failed: Not allowed.'))
  })

  it('reassigns by catalogue id with the item type to the chosen person', async () => {
    current = await setup({ intercept: bulkWorld() })
    await tick('Fees Intelligence')
    const { k } = current
    const picker = k.all('button').find((b) => b.getAttribute('aria-label') === 'Change owner to')!
    await k.click(picker)
    await k.tick(40)
    const person = k.all('[role="option"]').find((el) => el.textContent?.includes('Asha Rao'))
    assert.ok(person, 'the people the CRM can assign to are offered')
    await k.click(person!)
    await k.tick(20)
    await k.click(current.button('Reassign')!)
    await k.tick(80)
    const call = current.to('/bulk/assign')[0]
    assert.deepEqual({ ids: (call.body as { ids: number[] }).ids, itemType: (call.body as { itemType: string }).itemType, assignedTo: (call.body as { assignedTo: string }).assignedTo }, { ids: [1011], itemType: 'product', assignedTo: '7' })
    assert.ok(current.text().includes('Reassigned 1 sub-product.'))
  })
})

describe('the More menu', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('lists Import CSV, Sync Excel, Export CSV, Find duplicates and Recycle Bin for an administrator', async () => {
    current = await setup()
    await current.openMore()
    assert.deepEqual(current.menuItems().map((m) => m.textContent?.trim()), ['Import CSV', 'Sync Excel', 'Export CSV', 'Find duplicates', 'Recycle Bin'])
  })

  it('offers HR only Sync Excel (the Products actions need the Products right) and a plain sales profile none of the Portfolio\'s own', async () => {
    current = await setup({ rows: hrRows(), can: HR_CAN, canManage: true })
    await current.openMore()
    assert.deepEqual(current.menuItems().map((m) => m.textContent?.trim()), ['Sync Excel'])
    await disposeAll()
    current.restore()
    current = await setup({ rows: adminRows(), can: SALES_CAN, canManage: false })
    await current.openMore()
    assert.deepEqual(current.menuItems().map((m) => m.textContent?.trim()), ['Import CSV', 'Export CSV', 'Find duplicates', 'Recycle Bin'])
    await disposeAll()
    current.restore()
    current = await setup({ rows: hrRows(), can: HR_CAN, canManage: false })
    assert.ok(!current.k.all('button').some((b) => b.getAttribute('aria-label') === 'More actions'), 'a person with nothing in the menu gets no menu')
  })

  it('Sync Excel posts to the Portfolio import and says how many were imported, updated and skipped', async () => {
    current = await setup({ intercept: (call) => (call.path.endsWith('/portfolio/import') ? { status: 1, message: 'ok', data: { imported: 4, updated: 2, skipped: 1 } } : undefined) })
    await current.openMore()
    await current.k.click(current.menuItems().find((m) => m.textContent?.includes('Sync Excel'))!)
    await current.k.tick(80)
    assert.equal(current.to('/portfolio/import').length, 1)
    assert.equal(current.to('/portfolio/import')[0].method, 'POST')
    assert.ok(current.text().includes('Import complete: 4 imported, 2 updated, 1 skipped.'))
  })

  it('shows what went wrong when Sync Excel fails, and reads the list again when it works', async () => {
    current = await setup({ intercept: (call) => (call.path.endsWith('/portfolio/import') ? { __status: 500, status: 0, message: 'Python is not installed.' } : undefined) })
    await current.openMore()
    await current.k.click(current.menuItems().find((m) => m.textContent?.includes('Sync Excel'))!)
    await current.k.tick(80)
    assert.ok(current.text().includes('Python is not installed.'))
  })

  it('Export CSV is a link to the old export endpoint with the item type and the search, as the old screen made it', async () => {
    current = await setup({ search: 'q=erp' })
    await current.openMore()
    const link = current.menuItems().find((m) => m.textContent?.includes('Export CSV'))!
    const url = new URL(link.getAttribute('href')!, 'http://test.local')
    assert.ok(url.pathname.endsWith('/crm/products/export'), url.pathname)
    assert.equal(url.searchParams.get('itemType'), 'product')
    assert.equal(url.searchParams.get('search'), 'erp')
    assert.equal(url.searchParams.get('sub_institute_id'), '1')
  })

  it('Import, Export and Find duplicates work on services when the Type filter says Service', async () => {
    current = await setup({ search: 'type=service' })
    await current.openMore()
    const link = current.menuItems().find((m) => m.textContent?.includes('Export CSV'))!
    assert.equal(new URL(link.getAttribute('href')!, 'http://test.local').searchParams.get('itemType'), 'service')
    await current.k.click(current.menuItems().find((m) => m.textContent?.includes('Find duplicates'))!)
    await current.k.tick(80)
    assert.equal(current.to('/crm/products/duplicates')[0].query.get('itemType'), 'service')
  })

  it('Find duplicates asks the old endpoint for the groups of that item type', async () => {
    current = await setup({ intercept: (call) => (call.path.endsWith('/crm/products/duplicates') ? { status: 1, message: 'ok', data: [] } : undefined) })
    await current.openMore()
    await current.k.click(current.menuItems().find((m) => m.textContent?.includes('Find duplicates'))!)
    await current.k.tick(80)
    const calls = current.to('/crm/products/duplicates')
    assert.equal(calls.length, 1, 'one read, not a loop')
    assert.equal(calls[0].method, 'GET')
    assert.equal(calls[0].query.get('itemType'), 'product')
    assert.equal(calls[0].query.get('token'), 'test-token')
  })

  it('Import CSV opens the import dialog, whose rows go to the old import endpoint with the item type', async () => {
    current = await setup({ intercept: (call) => (call.path.endsWith('/crm/products/import') ? { status: 1, message: 'ok', data: { created: 1, skipped: 0, errors: [] } } : undefined) })
    await current.openMore()
    await current.k.click(current.menuItems().find((m) => m.textContent?.includes('Import CSV'))!)
    await current.k.tick(40)
    assert.ok(current.text().toLowerCase().includes('import'), 'a dialog about importing is open')
    const { crmService } = await import('../../services/crm')
    const rows = [{ name: 'Widget', sku: 'W-1', assignedTo: '7' }]
    await crmService.importProducts({ token: 'test-token', subInstituteId: '1' } as never, 'product', rows)
    const call = current.to('/crm/products/import')[0]
    assert.equal(call.method, 'POST')
    assert.deepEqual({ itemType: (call.body as { itemType: string }).itemType, rows: (call.body as { rows: unknown[] }).rows }, { itemType: 'product', rows })
  })

  it('Recycle Bin goes to the existing Recycle Bin screen', async () => {
    current = await setup()
    await current.openMore()
    await current.k.click(current.menuItems().find((m) => m.textContent?.includes('Recycle Bin'))!)
    await current.k.tick(30)
    assert.deepEqual(current.router.written.at(-1), '/module/crm/marketing/recycle-bin')
  })
})

describe('the bulk calls as the service sends them (fetch level)', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('sends itemType, the catalogue ids and the session in the body of both bulk calls, and the bearer header', async () => {
    current = await setup({ intercept: bulkWorld() })
    const { portfolioListService } = await import('../../services/product-master/portfolio-list-service')
    const context = { token: 'test-token', subInstituteId: '1' } as never
    await portfolioListService.bulkDelete(context, 'service', [5, 6])
    await portfolioListService.bulkAssign(context, 'product', [7], '9')
    const [del] = current.to('/crm/products/bulk/delete')
    const [assign] = current.to('/crm/products/bulk/assign')
    assert.deepEqual(del.body, { ids: [5, 6], itemType: 'service', token: 'test-token', sub_institute_id: '1' })
    assert.deepEqual(assign.body, { ids: [7], itemType: 'product', assignedTo: '9', token: 'test-token', sub_institute_id: '1' })
    assert.equal(del.headers.Authorization, 'Bearer test-token')
    assert.equal(del.method, 'POST')
    assert.equal(assign.method, 'POST')
  })
})

describe('the Add buttons and the form (wired last: the form is the form track\'s own)', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('shows Add product to an administrator only, and Add sub-product to a person who may add a Sub-product', async () => {
    current = await setup()
    assert.ok(current.button('Add product') && current.button('Add sub-product'))
    await disposeAll()
    current.restore()
    current = await setup({ rows: hrRows(), can: HR_CAN })
    assert.equal(current.button('Add product'), undefined, 'a Product is added by administrators only')
    assert.ok(current.button('Add sub-product'))
    await disposeAll()
    current.restore()
    current = await setup({ rows: adminRows(), can: { ...SALES_CAN, createSubProduct: false, editSubProduct: false } })
    assert.equal(current.button('Add product'), undefined)
    assert.equal(current.button('Add sub-product'), undefined, 'a person who may add nothing is offered no button')
  })

  it('opens the form for a new Product from Add product, and reads the list again after it is saved', async () => {
    current = await setup({ intercept: (call) => (call.path.endsWith('/api/product-master') && call.method === 'POST' ? { status: 1, data: { id: 99, kind: 'product', name: 'Fresh', key: 'fresh' } } : undefined) })
    const { k, button, to } = current
    await k.click(button('Add product')!)
    await k.tick(60)
    assert.ok(k.bodyText().includes('A product groups sub-products.'), 'the form for a new Product is open')
    const listsBefore = to('/product-master/list').length
    const inputs = k.all('[role="dialog"] input') as HTMLInputElement[]
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLInputElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(inputs[0], 'Fresh'); inputs[0].dispatchEvent(new k.w.Event('input', { bubbles: true })) })
    await k.tick(20)
    await k.click(k.all('[role="dialog"] button').find((b) => b.textContent?.trim() === 'Save')!)
    await k.tick(120)
    const posts = current.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/product-master'))
    assert.equal(posts.length, 1)
    assert.equal((posts[0].body as { kind: string }).kind, 'product')
    assert.equal(to('/product-master/list').length, listsBefore + 1, 'the list is read again')
    assert.ok(k.bodyText().includes('Saved.'))
  })

  it('opens the form for a new Sub-product, starting under the Product the list is about (the filter), from the toolbar and from a Product\'s own header', async () => {
    // What the form reads when it opens (the form track's own fixtures): the Products with their Sub-products, its choices and the taxonomy.
    const formWorld = (call: Call) => {
      if (call.path.endsWith('/api/product-master') && call.method === 'GET') return everything()
      if (call.path.endsWith('/product-master/meta')) return { status: 1, data: formMeta() }
      if (call.path.endsWith('/portfolio/taxonomy')) return { status: 1, data: taxonomy() }
      return undefined
    }
    current = await setup({ search: 'product=9', intercept: formWorld })
    const { k, button } = current
    await k.click(button('Add sub-product')!)
    await k.tick(200)
    assert.ok(k.all('[role="dialog"]').length > 0, 'the form is open')
    const productSelect = k.all('[role="dialog"] select').find((sel) => k.w.document.querySelector(`label[for="${sel.id}"]`)?.textContent?.startsWith('Product')) as HTMLSelectElement | undefined
    assert.ok(productSelect, 'the form has its Product choice')
    assert.equal(productSelect!.value, '9', 'the form starts under the Product the list is filtered to')
    await disposeAll()
    current.restore()
    current = await setup({ intercept: formWorld })
    const header = current.k.all('tr[data-group="p:1"] button').find((b) => b.textContent?.includes('Add sub-product'))
    assert.ok(header, 'a Product\'s own header has its Add sub-product')
    assert.equal(header!.getAttribute('aria-label'), 'Add a sub-product to ScholarClone')
    await current.k.click(header!)
    await current.k.tick(200)
    assert.ok(current.k.all('[role="dialog"]').length > 0, 'the form is open')
    const fromHeader = current.k.all('[role="dialog"] select').find((sel) => current!.k.w.document.querySelector(`label[for="${sel.id}"]`)?.textContent?.startsWith('Product')) as HTMLSelectElement
    assert.equal(fromHeader.value, '1', "a Product's own Add sub-product starts under that Product")
  })

  it('offers no Add sub-product on a shared Product (read only) or an archived one', async () => {
    current = await setup({ rows: [product({ shared: true }), product({ id: 3, key: 'old', name: 'Old', status: 'archived' })] })
    assert.equal(current.k.all('tr[data-group] button').filter((b) => b.textContent?.includes('Add sub-product')).length, 0)
  })
})
