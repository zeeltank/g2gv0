import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signal-review/router-harness'
import { ApiError } from '../../services/core'
import type { PmEnvelope, PmMeta, PmOption, PmRecord, PmUsage } from '../../services/product-master/types'
import { lineRecord, meta, options, priceBook, soldSubProductRecord, subProductRecord, usage } from './lines-fixtures'

/** One product line, or one sub-product that is not in the catalogue, in a fake browser: the tab kept in the address, the server replaced by a fake. */
interface Setup {
  record?: PmRecord
  usage?: PmUsage
  can?: Parameters<typeof meta>[1]
  search?: string
  get?: () => Promise<PmEnvelope<PmRecord>>
  archive?: () => Promise<PmEnvelope<PmRecord>>
  /** What the server answers to a save (the record as it is afterwards). */
  afterUpdate?: PmRecord
  session?: boolean
}

async function setup(opts: Setup = {}) {
  const k = await kit()
  const router = await routerHarness(opts.search ?? '', '/module/crm/sales/products/lines/11')
  const { ProductLineRecordPage } = await import('../../components/domain/crm/product-line-record-page')
  // The fake browser's storage outlives a test, so a test that wants no session must remove the one an earlier test left.
  if (opts.session === false) k.w.localStorage.removeItem('userData')
  else k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const calls: string[] = []
  const updates: Array<Record<string, unknown>> = []
  let current = opts.record ?? subProductRecord()
  const service = {
    get: async (id: string | number): Promise<PmEnvelope<PmRecord>> => { calls.push(`get ${id}`); return opts.get ? opts.get() : { status: 1, data: current } },
    usage: async (id: string | number): Promise<PmEnvelope<PmUsage>> => { calls.push(`usage ${id}`); return { status: 1, data: opts.usage ?? usage() } },
    meta: async (): Promise<PmEnvelope<PmMeta>> => ({ status: 1, data: meta({}, opts.can ?? {}) }),
    options: async (): Promise<PmEnvelope<PmOption[]>> => ({ status: 1, data: options() }),
    archive: async (id: string | number): Promise<PmEnvelope<PmRecord>> => {
      calls.push(`archive ${id}`)
      if (opts.archive) return opts.archive()
      current = { ...current, status: 'archived' }
      return { status: 1, data: current }
    },
    restore: async (id: string | number): Promise<PmEnvelope<PmRecord>> => { calls.push(`restore ${id}`); current = { ...current, status: 'active' }; return { status: 1, data: current } },
    create: async (): Promise<PmEnvelope<PmRecord>> => ({ status: 1, data: current }),
    update: async (_id: string | number, body: Record<string, unknown>): Promise<PmEnvelope<PmRecord>> => {
      updates.push(body)
      current = opts.afterUpdate ?? current
      return { status: 1, data: current }
    },
  }
  const hrefs = { products: '/module/crm/sales/products', services: '/module/crm/sales/services', priceBooks: '/module/crm/sales/price-books' }
  const backs = { count: 0 }
  const names: string[] = []

  await k.render(router.wrap(k.h(ProductLineRecordPage, { id: '11', hrefs, service, onBack: () => { backs.count += 1 }, onNameKnown: (name: string) => names.push(name) })))
  await k.tick(20)

  const tabLabels = () => k.all('[role="tab"]').map((t) => t.textContent)
  const openTab = async (label: string) => { await k.click(k.all('[role="tab"]').find((t) => t.textContent?.startsWith(label))!); await k.tick(10) }
  const hrefOf = (text: string) => k.all('a').find((a) => a.textContent === text)?.getAttribute('href') ?? null
  const archiveButtons = () => k.all('button').filter((b) => b.textContent === 'Archive')
  return { k, router, calls, updates, backs, names, tabLabels, openTab, hrefOf, archiveButtons }
}

describe('a sub-product that is not in the catalogue', () => {
  afterEach(disposeAll)

  it('shows its name, where it sits, and the four tabs, opening on the Overview', async () => {
    const { k, tabLabels, names } = await setup()
    assert.equal(k.one('h1')!.textContent, 'Fee Collection')
    assert.ok(k.bodyText().includes('Sub-product · ScholarClone · SCH-11'))
    assert.deepEqual(tabLabels(), ['Overview', 'Signals & ICP', 'Sell in CRM', 'Usage'])
    assert.equal(k.one('[role="tab"][aria-selected="true"]')!.textContent, 'Overview')
    assert.deepEqual(names, ['Fee Collection'], 'the breadcrumb is told the name')
  })

  it('shows its identity and what the Portfolio says about it on the Overview', async () => {
    const { k, hrefOf } = await setup()
    const text = k.bodyText()
    for (const part of ['Fee Collection', 'ScholarClone', 'SCH-11', 'Live – with client', 'Confirmed by a person', 'Collects school fees online.', 'Late fee collection', 'K-12 schools', 'New academic year']) {
      assert.ok(text.includes(part), part)
    }
    assert.equal(hrefOf('ScholarClone'), '/module/crm/sales/products/lines/1', 'the product line opens its own page')
    assert.equal(hrefOf('open the Portfolio'), '/portfolio/scholarclone?tab=offers')
  })

  it('goes back to the Products screen when the back button is pressed', async () => {
    const { k, backs } = await setup()
    await k.click(k.one('button[aria-label="Back to Products"]')!)
    assert.equal(backs.count, 1)
  })

  it('says what Signals found and how its ideal-customer profile stands, with a way to each, on the Signals & ICP tab', async () => {
    const { k, openTab, hrefOf } = await setup()
    await openTab('Signals & ICP')
    const text = k.bodyText()
    assert.ok(text.includes('Signals found'))
    assert.ok(text.includes('4'))
    assert.equal(hrefOf('See these signals'), '/signals?product=scholarclone%3A%3ASCH-11')
    assert.ok(text.includes('Active'))
    assert.ok(text.includes('An ideal-customer profile is saved and in use.'))
    assert.equal(hrefOf('open it there'), '/portfolio/scholarclone?tab=offers')
    assert.ok(text.includes('counts the signals whose best-matching offer it is'))
  })

  it('says no ICP applies, and links nowhere, when the server says so, and "Not counted" when Signals has no value', async () => {
    const { k, openTab, hrefOf } = await setup({ usage: usage({ signals: null, icp: null }) })
    await openTab('Signals & ICP')
    assert.ok(k.bodyText().includes('Not counted: Signals has no value for this.'))
    assert.ok(k.bodyText().includes('No ideal-customer profile applies to this.'))
    assert.equal(hrefOf('See these signals'), null)
    assert.equal(hrefOf('open it there'), null)
  })

  it('shows a real zero as 0', async () => {
    const { k, openTab } = await setup({ usage: usage({ signals: 0 }) })
    await openTab('Signals & ICP')
    const field = k.all('dt').find((dt) => dt.textContent === 'Signals found')!.parentElement!
    assert.ok(field.textContent!.includes('0'), field.textContent!)
    assert.ok(!field.textContent!.includes('Not counted'))
  })

  it('offers Sell in CRM on the Sell tab to someone who may add to the catalogue, and not to someone who may not', async () => {
    // The tab is a button with the same words, so only the buttons that are not tabs count.
    const sellButtons = (k: Awaited<ReturnType<typeof setup>>['k']) => k.all('button:not([role="tab"])').filter((b) => b.textContent === 'Sell in CRM')
    const allowed = await setup()
    await allowed.openTab('Sell in CRM')
    assert.ok(allowed.k.bodyText().includes('Not sold in the CRM yet'))
    assert.equal(sellButtons(allowed.k).length, 1)
    await disposeAll()

    const denied = await setup({ can: { editSubProduct: false } })
    await denied.openTab('Sell in CRM')
    assert.ok(denied.k.bodyText().includes('Not sold in the CRM yet'))
    assert.equal(sellButtons(denied.k).length, 0)
  })

  it('sells it in the CRM from the Sell tab: the form opens with Sell switched on, saves it as a sale, and the page then shows the catalogue item', async () => {
    const { k, openTab, updates } = await setup({ afterUpdate: soldSubProductRecord() })
    await openTab('Sell in CRM')
    await k.click(k.all('button:not([role="tab"])').find((b) => b.textContent === 'Sell in CRM')!)
    await k.tick(40)
    assert.ok(k.bodyText().includes('Edit Fee Collection'))
    assert.ok(k.bodyText().includes('Sell this in the CRM'))
    assert.ok(k.all('input').some((el) => k.w.document.querySelector(`label[for="${el.id}"]`)?.textContent?.startsWith('SKU')), 'the sale\'s fields are open')

    await k.click(k.withText('Save changes')!)
    await k.tick(40)

    assert.equal(updates.length, 1)
    assert.deepEqual(Object.keys(updates[0]), ['sell'], 'only the sale is sent: nothing else changed')
    assert.equal((updates[0].sell as Record<string, unknown>).enabled, true)
    assert.equal((updates[0].sell as Record<string, unknown>).type, 'product')
    assert.ok(k.bodyText().includes('Saved.'))
    assert.ok(k.bodyText().includes('CRM catalogue item'), 'the tab now shows the item it created')
    assert.ok(k.all('a').some((a) => a.textContent === 'Open catalogue page'))
  })

  it('says on the Usage tab that it is not in the catalogue, so it has no quotes or price books', async () => {
    const { k, openTab } = await setup()
    await openTab('Usage')
    const text = k.bodyText()
    assert.ok(text.includes('Not in the CRM catalogue'))
    assert.ok(text.includes('Sell it in the CRM first.'))
    assert.ok(!text.includes('Open Price Books'))
    const field = (label: string) => k.all('dt').find((dt) => dt.textContent === label)!.parentElement!.textContent!.replace(label, '')
    assert.equal(field('Quotes that include it'), 'Not in the CRM catalogue', 'not a count of 0')
    assert.equal(field('Price books'), 'Not in the CRM catalogue')
  })

  it('shows a real zero of signals on the Usage tab as 0, not as a dash', async () => {
    const { k, openTab } = await setup({ usage: usage({ signals: 0 }) })
    await openTab('Usage')
    const field = k.all('dt').find((dt) => dt.textContent === 'Signals found')!.parentElement!.textContent!.replace('Signals found', '')
    assert.equal(field, '0')
  })

  it('opens on the tab the address names', async () => {
    const { k } = await setup({ search: 'tab=signals' })
    assert.equal(k.one('[role="tab"][aria-selected="true"]')!.textContent, 'Signals & ICP')
  })

  it('writes the tab to the address when it is changed', async () => {
    const { router, openTab } = await setup()
    await openTab('Usage')
    assert.equal(router.lastSearch(), 'tab=usage')
  })
})

describe('a sub-product that is sold in the catalogue, opened on its own page', () => {
  afterEach(disposeAll)

  it('links to its catalogue page, by type, from the header and the Sell tab', async () => {
    const { k, openTab } = await setup({ record: soldSubProductRecord() })
    const headerLinks = k.all('a').filter((a) => a.textContent === 'Open catalogue page')
    assert.equal(headerLinks.length, 1)
    assert.equal(headerLinks[0].getAttribute('href'), '/module/crm/sales/products/301')

    await openTab('Sell in CRM')
    const links = k.all('a').filter((a) => a.textContent === 'Open catalogue page')
    assert.equal(links.length, 2)
    assert.ok(links.every((a) => a.getAttribute('href') === '/module/crm/sales/products/301'))
    for (const part of ['PRD-AAAA1111', 'SKU-1', 'INR 1500.00', 'GST (18%)']) assert.ok(k.bodyText().includes(part), part)
  })

  it('links a sold service to the Services page', async () => {
    const record = soldSubProductRecord()
    record.crmProduct = { ...record.crmProduct!, type: 'service' }
    const { k } = await setup({ record })
    assert.equal(k.all('a').find((a) => a.textContent === 'Open catalogue page')!.getAttribute('href'), '/module/crm/sales/services/301')
  })

  it('shows its price books, and how many there are, on the Usage tab', async () => {
    const { k, tabLabels, openTab } = await setup({ record: soldSubProductRecord(), usage: usage({ quotes: 3, priceBooks: [priceBook(), priceBook({ priceBookId: 8, name: 'Schools 2026', listPrice: 999 })] }) })
    assert.deepEqual(tabLabels(), ['Overview', 'Signals & ICP', 'Sell in CRM', 'Usage2'])
    await openTab('Usage')
    const text = k.bodyText()
    for (const part of ['Standard 2026', 'PB-0007', 'INR 1200.00', 'Schools 2026', 'INR 999.00', 'Open Price Books']) assert.ok(text.includes(part), part)
    assert.equal(k.all('a').find((a) => a.textContent === 'Open Price Books')!.getAttribute('href'), '/module/crm/sales/price-books')
  })

  it('says it is in no price book yet, and what a quote uses instead', async () => {
    const { k, openTab } = await setup({ record: soldSubProductRecord(), usage: usage({ basePrice: 1500, currency: 'INR' }) })
    await openTab('Usage')
    assert.ok(k.bodyText().includes('Not in any price book yet'))
    assert.ok(k.bodyText().includes('a quote line uses the base price, INR 1500.00'))
  })
})

describe('a product line', () => {
  afterEach(disposeAll)

  it('has an Overview and a Signals & ICP tab, and no Sell or Usage tab', async () => {
    const { k, tabLabels } = await setup({ record: lineRecord() })
    assert.deepEqual(tabLabels(), ['Overview', 'Signals & ICP'])
    assert.ok(k.bodyText().includes('Product line · payroll_cloud'))
  })

  it('lists its sub-products on the Overview, each opening its own page, and offers to add one', async () => {
    const { k, hrefOf } = await setup({ record: lineRecord() })
    assert.equal(hrefOf('Payslips'), '/module/crm/sales/products/lines/21')
    assert.ok(k.all('button').some((b) => b.textContent === 'Add sub-product'))
  })

  it('offers no Add sub-product on a shared line or to someone who may not add', async () => {
    const shared = await setup({ record: lineRecord({ shared: true, origin: 'builtin' }) })
    assert.ok(!shared.k.all('button').some((b) => b.textContent === 'Add sub-product'))
    assert.ok(shared.k.bodyText().includes('Shared'))
    await disposeAll()

    const denied = await setup({ record: lineRecord(), can: { createSubProduct: false } })
    assert.ok(!denied.k.all('button').some((b) => b.textContent === 'Add sub-product'))
  })

  it('opens Company Opportunities and the Portfolio\'s ICP tab for the line, not for a sub-product', async () => {
    const { openTab, hrefOf } = await setup({ record: lineRecord() })
    await openTab('Signals & ICP')
    assert.equal(hrefOf('See these signals'), '/signals?product=payroll_cloud')
    assert.equal(hrefOf('open it there'), '/portfolio/payroll_cloud?tab=icp')
  })
})

describe('changing a record from its page', () => {
  afterEach(disposeAll)

  it('asks before archiving, says what stays, and archives only when agreed', async () => {
    const { k, calls, archiveButtons } = await setup()
    await k.click(archiveButtons()[0])
    await k.tick(20)
    assert.ok(k.one('[role="alertdialog"]'), 'a question is asked first')
    assert.ok(k.bodyText().includes('Archive Fee Collection?'))
    assert.ok(k.bodyText().includes('The Portfolio offer and the CRM catalogue item are not deleted'))
    assert.ok(!calls.some((c) => c.startsWith('archive')), 'nothing is archived yet')

    await k.click(archiveButtons().pop()!)
    await k.tick(30)
    assert.ok(calls.includes('archive 11'))
    assert.ok(k.bodyText().includes('Archived.'))
    assert.ok(k.all('button').some((b) => b.textContent === 'Restore'), 'and it can be restored')
  })

  it('does not archive when the question is answered Cancel', async () => {
    const { k, calls, archiveButtons } = await setup()
    await k.click(archiveButtons()[0])
    await k.tick(20)
    await k.click(k.withText('Cancel')!)
    await k.tick(20)
    assert.ok(!calls.some((c) => c.startsWith('archive')))
  })

  it('restores an archived record without asking', async () => {
    const { k, calls } = await setup({ record: subProductRecord({ status: 'archived' }) })
    assert.ok(k.bodyText().includes('Archived'))
    await k.click(k.withText('Restore')!)
    await k.tick(30)
    assert.ok(calls.includes('restore 11'))
    assert.ok(k.bodyText().includes('Restored.'))
  })

  it('shows what the server says when it refuses to archive, and the record stays as it was', async () => {
    const { k, archiveButtons } = await setup({
      record: lineRecord(),
      archive: async () => { throw new ApiError('This product still has active sub-products. Archive them first.', 409) },
    })
    await k.click(archiveButtons()[0])
    await k.tick(20)
    await k.click(archiveButtons().pop()!)
    await k.tick(30)
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('still has active sub-products'))
    assert.ok(!k.bodyText().includes('Archived.'))
    assert.ok(archiveButtons().length >= 1, 'it is still active, so it can still be archived')
  })

  it('offers Edit, Archive and Restore only to someone whose rights allow them', async () => {
    const full = await setup()
    assert.ok(full.k.withText('Edit'))
    assert.ok(full.archiveButtons().length >= 1)
    await disposeAll()

    const none = await setup({ can: { editSubProduct: false, archive: false, restore: false } })
    assert.equal(none.k.withText('Edit'), null)
    assert.equal(none.archiveButtons().length, 0)
    await disposeAll()

    const notAdmin = await setup({ record: lineRecord(), can: { archiveProduct: false } })
    assert.equal(notAdmin.archiveButtons().length, 0, 'archiving a line needs an administrator')
  })

  it('restores an archived product line only for an administrator, and an archived sub-product for anyone with the edit right', async () => {
    const line = await setup({ record: lineRecord({ status: 'archived' }), can: { restoreProduct: false, restore: true } })
    assert.equal(line.k.withText('Restore'), null, 'a line needs an administrator, whatever the edit right says')
    await disposeAll()

    const admin = await setup({ record: lineRecord({ status: 'archived' }), can: { restoreProduct: true, restore: false } })
    assert.ok(admin.k.withText('Restore'), 'an administrator may restore a line')
    await disposeAll()

    const sub = await setup({ record: subProductRecord({ status: 'archived' }), can: { restoreProduct: false, restore: true } })
    assert.ok(sub.k.withText('Restore'), 'a sub-product follows the edit right alone')
  })

  it('offers no editing of a shared sub-product either', async () => {
    const { k } = await setup({ record: subProductRecord({ shared: true }) })
    assert.equal(k.withText('Edit'), null)
    assert.ok(k.bodyText().includes('Shared'))
  })

  it('offers no changes to a built-in, shared line', async () => {
    const { k, archiveButtons } = await setup({ record: lineRecord({ shared: true, origin: 'builtin' }) })
    assert.equal(k.withText('Edit'), null)
    assert.equal(archiveButtons().length, 0)
  })
})

describe('opening a record that cannot be shown', () => {
  afterEach(disposeAll)

  it('says it was not found, with a way back, when the server answers 404', async () => {
    const { k, backs } = await setup({ get: async () => { throw new ApiError('Product not found', 404) } })
    assert.ok(k.bodyText().includes('Not found'))
    assert.equal(k.all('[role="tab"]').length, 0)
    await k.click(k.withText('Back to Products')!)
    assert.equal(backs.count, 1)
  })

  it('shows the error, and Retry asks again, when the server fails', async () => {
    let calls = 0
    const { k } = await setup({ get: async () => { calls += 1; if (calls === 1) throw new Error('The server did not answer.'); return { status: 1, data: subProductRecord() } } })
    assert.ok(k.bodyText().includes('The server did not answer.'))
    await k.click(k.withText('Retry')!)
    await k.tick(20)
    assert.equal(k.one('h1')!.textContent, 'Fee Collection')
  })

  it('says so when there is no session', async () => {
    const { k, calls } = await setup({ session: false })
    assert.ok(k.bodyText().includes('Your ERP session is unavailable.'))
    assert.equal(calls.length, 0)
  })
})
