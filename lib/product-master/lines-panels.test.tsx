import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import type { PmEnvelope, PmKind, PmMeta, PmOption, PmRecord, PmUsage } from '../../services/product-master/types'
import { meta, options, priceBook, soldSubProductRecord, usage } from './lines-fixtures'

/** The two extra tabs of a catalogue item's page (Signals & ICP, Usage) in a fake browser, with the server replaced by a fake. */
interface Setup {
  tab?: string
  masterId?: number | null
  masterKind?: PmKind | null
  record?: PmRecord
  usage?: PmUsage
  can?: Parameters<typeof meta>[1]
  getFails?: boolean
  usageFails?: boolean
  session?: boolean
}

async function setup(opts: Setup = {}) {
  const k = await kit()
  const { ProductExtraPanel } = await import('../../components/domain/crm/product-links-panels')
  // The fake browser's storage outlives a test, so a test that wants no session must remove the one an earlier test left.
  if (opts.session === false) k.w.localStorage.removeItem('userData')
  else k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const calls: string[] = []
  const updates: Array<Record<string, unknown>> = []
  const renamed: string[] = []
  let current = opts.record ?? soldSubProductRecord()
  const service = {
    get: async (id: string | number): Promise<PmEnvelope<PmRecord>> => {
      calls.push(`get ${id}`)
      if (opts.getFails) throw new Error('The sub-product could not be read.')
      return { status: 1, data: current }
    },
    usage: async (id: string | number): Promise<PmEnvelope<PmUsage>> => {
      calls.push(`usage ${id}`)
      if (opts.usageFails) throw new Error('The usage could not be read.')
      return { status: 1, data: opts.usage ?? usage() }
    },
    meta: async (): Promise<PmEnvelope<PmMeta>> => ({ status: 1, data: meta({}, opts.can ?? {}) }),
    options: async (): Promise<PmEnvelope<PmOption[]>> => ({ status: 1, data: options() }),
    create: async (): Promise<PmEnvelope<PmRecord>> => ({ status: 1, data: current }),
    update: async (_id: string | number, body: Record<string, unknown>): Promise<PmEnvelope<PmRecord>> => {
      updates.push(body)
      current = { ...current, name: String(body.name ?? current.name) }
      return { status: 1, data: current }
    },
  }
  const hrefs = { products: '/module/crm/sales/products', priceBooks: '/module/crm/sales/price-books' }
  const props = {
    tab: opts.tab ?? 'signals', masterId: opts.masterId === undefined ? 11 : opts.masterId, masterKind: opts.masterKind === undefined ? 'sub_product' : opts.masterKind,
    hrefs, service, onRenamed: (name: string) => renamed.push(name),
  }
  await k.render(k.h(ProductExtraPanel, props))
  await k.tick(30)

  const hrefOf = (text: string) => k.all('a').find((a) => a.textContent === text)?.getAttribute('href') ?? null
  const labelled = (text: string) => k.all('input, textarea, select').find((el) => k.w.document.querySelector(`label[for="${el.id}"]`)?.textContent?.startsWith(text)) as HTMLInputElement | undefined
  const type = async (el: HTMLInputElement, value: string) => {
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLInputElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(el, value); el.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
  }
  const editButton = () => k.all('button').find((b) => b.textContent?.includes('Edit sub-product details')) ?? null
  return { k, calls, updates, renamed, hrefOf, labelled, type, editButton, rerender: (patch: Record<string, unknown>) => k.render(k.h(ProductExtraPanel, { ...props, ...patch })) }
}

describe('which extra tab opens a panel', () => {
  afterEach(disposeAll)

  it('shows nothing, and asks nothing, on a tab that is not one of the extra tabs', async () => {
    const { k, calls } = await setup({ tab: 'details' })
    assert.equal(k.bodyText(), '')
    assert.equal(calls.length, 0)
    const history = await setup({ tab: 'history' })
    assert.equal(history.calls.length, 0)
  })

  it('shows nothing, and asks nothing, for an item with no record behind it', async () => {
    const none = await setup({ masterId: null })
    assert.equal(none.k.bodyText(), '')
    assert.equal(none.calls.length, 0)
    await disposeAll()
    const missing = await setup({ masterId: undefined as unknown as null, masterKind: null })
    assert.equal(missing.calls.length, 0)
  })

  it('never opens Signals & ICP for a catalogue-only item, but does open its Usage', async () => {
    const signals = await setup({ tab: 'signals', masterKind: 'item' })
    assert.equal(signals.k.bodyText(), '')
    assert.equal(signals.calls.length, 0, 'a stale tab id cannot read a record that has no signals')
    await disposeAll()

    const usageTab = await setup({ tab: 'usage', masterKind: 'item' })
    assert.deepEqual(usageTab.calls, ['usage 11'])
    assert.ok(usageTab.k.bodyText().includes('Where it is used'))
  })

  it('opens neither extra tab for a product line, which has no catalogue item', async () => {
    const signals = await setup({ tab: 'signals', masterKind: 'product' })
    const usageTab = await setup({ tab: 'usage', masterKind: 'product' })
    assert.equal(signals.k.bodyText(), '')
    assert.equal(usageTab.k.bodyText(), '')
    assert.equal(signals.calls.length + usageTab.calls.length, 0)
  })

  it('opens Usage for an item tied to a sub-product, asking only for the usage', async () => {
    const { k, calls } = await setup({ tab: 'usage', usage: usage({ quotes: 3, priceBooks: [priceBook()] }) })
    assert.deepEqual(calls, ['usage 11'], 'no record, no rights, no choices: the tab only needs the usage')
    for (const part of ['Where it is used', 'Standard 2026', 'INR 1200.00']) assert.ok(k.bodyText().includes(part), part)
  })
})

describe('the Signals & ICP tab of a catalogue item', () => {
  afterEach(disposeAll)

  it('reads the sub-product, its usage, the rights and the choices, and shows who it is, what Signals found and the ICP', async () => {
    const { k, calls, hrefOf } = await setup()
    assert.deepEqual(calls.sort(), ['get 11', 'usage 11'])
    const text = k.bodyText()
    for (const part of ['Product line and sub-product', 'ScholarClone', 'SCH-11', 'Live – with client', 'Confirmed by a person', 'Signals found', 'Active', 'Collects school fees online.', 'Late fee collection']) {
      assert.ok(text.includes(part), part)
    }
    assert.equal(hrefOf('ScholarClone'), '/module/crm/sales/products/lines/1')
    assert.equal(hrefOf('See these signals'), '/signals?product=scholarclone%3A%3ASCH-11')
    assert.equal(hrefOf('open it there'), '/portfolio/scholarclone?tab=offers')
  })

  it('shows Loading… before the answer arrives', async () => {
    const k = await kit()
    const { ProductSignalsIcpPanel } = await import('../../components/domain/crm/product-links-panels')
    k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
    Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })
    const never = new Promise<never>(() => undefined)
    const service = { get: () => never, usage: () => never, meta: () => never, options: () => never, create: () => never, update: () => never }
    await k.render(k.h(ProductSignalsIcpPanel, { masterId: 11, hrefs: { products: '/p', priceBooks: '/pb' }, service }))
    await k.tick(10)
    assert.ok(k.one('[role="status"]')!.textContent!.includes('Loading'))
  })

  it('shows the error in place of the tab when the sub-product cannot be read', async () => {
    const { k } = await setup({ getFails: true })
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('The sub-product could not be read.'))
    assert.ok(!k.bodyText().includes('Signals found'))
  })

  it('keeps who the sub-product is on screen, and says what failed, when only the usage cannot be read', async () => {
    const { k } = await setup({ usageFails: true })
    assert.ok(k.bodyText().includes('SCH-11'))
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('The usage could not be read.'))
    assert.ok(!k.bodyText().includes('Signals found'))
  })

  it('says so, and asks nothing, when there is no session', async () => {
    const { k, calls } = await setup({ session: false })
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('Your ERP session is unavailable.'))
    assert.equal(calls.length, 0)
  })

  it('offers "Edit sub-product details" to someone who may edit a sub-product, and to no one else', async () => {
    const allowed = await setup()
    assert.ok(allowed.editButton())
    await disposeAll()

    const denied = await setup({ can: { editSubProduct: false } })
    assert.equal(denied.editButton(), null)
    await disposeAll()

    const shared = await setup({ record: soldSubProductRecord({ shared: true }) })
    assert.equal(shared.editButton(), null, 'a built-in, shared record is never edited here')
  })

  it('opens the sub-product\'s form WITHOUT its Sell in CRM section, because the catalogue item has its own Edit button', async () => {
    const { k, editButton } = await setup()
    await k.click(editButton()!)
    await k.tick(30)
    assert.ok(k.bodyText().includes('Edit Fee Collection'))
    assert.ok(k.bodyText().includes('About'), 'the sub-product\'s own details are there')
    assert.ok(!k.bodyText().includes('Sell this in the CRM'), 'the price, SKU and tax rate are not editable in two places')
    assert.ok(!k.bodyText().includes('Base price'))
  })

  it('saves only what changed, thanks the person, and tells the page the new name', async () => {
    const { k, updates, renamed, editButton, labelled, type } = await setup()
    await k.click(editButton()!)
    await k.tick(30)
    await type(labelled('Name')!, 'Fee Collection Plus')
    await k.click(k.withText('Save changes')!)
    await k.tick(40)

    assert.deepEqual(updates, [{ name: 'Fee Collection Plus' }], 'only the changed field is sent, and no Sell part')
    assert.deepEqual(renamed, ['Fee Collection Plus'])
    assert.ok(k.bodyText().includes('Saved.'))
  })

  it('does not save, and does not rename, when nothing was changed', async () => {
    const { k, updates, renamed, editButton } = await setup()
    await k.click(editButton()!)
    await k.tick(30)
    const save = k.withText('Save changes') as HTMLButtonElement
    assert.equal(save.disabled, true, 'nothing to save yet')
    assert.deepEqual(updates, [])
    assert.deepEqual(renamed, [])
  })
})

describe('the Usage tab of a catalogue item', () => {
  afterEach(disposeAll)

  it('shows the signals, the quotes and the price books of an item that is in the catalogue', async () => {
    const { k } = await setup({ tab: 'usage', usage: usage({ signals: 4, quotes: 3, priceBooks: [priceBook(), priceBook({ priceBookId: 8, name: 'Schools 2026', listPrice: 999 })] }) })
    const fields = Object.fromEntries(k.all('dt').map((dt) => [dt.textContent, dt.parentElement!.textContent!.replace(dt.textContent!, '')]))
    assert.equal(fields['Signals found'], '4')
    assert.equal(fields['Quotes that include it'], '3')
    assert.equal(fields['Price books'], '2')
    assert.ok(k.bodyText().includes('Schools 2026'))
    assert.ok(!k.bodyText().includes('Not in the CRM catalogue'), 'a catalogue item is, by definition, in the catalogue')
  })

  it('says it is in no price book yet, and what a quote uses instead, when there is none', async () => {
    const { k } = await setup({ tab: 'usage', usage: usage({ basePrice: 1500, currency: 'INR' }) })
    assert.ok(k.bodyText().includes('Not in any price book yet'))
    assert.ok(k.bodyText().includes('INR 1500.00'))
  })

  it('shows the error when the usage cannot be read', async () => {
    const { k } = await setup({ tab: 'usage', usageFails: true })
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('The usage could not be read.'))
  })

  it('says so, and asks nothing, when there is no session', async () => {
    const { k, calls } = await setup({ tab: 'usage', session: false })
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('Your ERP session is unavailable.'))
    assert.equal(calls.length, 0)
  })

  it('reads again for another item, and shows the newer answer, not a late one for the first', async () => {
    const { k, rerender, calls } = await setup({ tab: 'usage' })
    await rerender({ masterId: 12 })
    await k.tick(30)
    assert.deepEqual(calls, ['usage 11', 'usage 12'])
  })
})
