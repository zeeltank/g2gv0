import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signals/router-harness'
import { ApiError } from '../../services/core'
import { can, fullRecord, listRow, meta, usageFull } from './fixtures'
import { fill, installWorld, openTab, press, type World } from './screen-kit'

/**
 * What the old Product line page, the old catalogue item page and its Signals & ICP and Usage panels pinned, and the new Sub-product page carries but no other
 * test names (slice 15, track WPD; every row is in `Docs/agentic-crm/_evidence/s15/wpd-test-map-2026-11-23.md`). The old components are gone; the page that
 * replaced them has to keep these promises: it says when there is no session, shows a failed read with a way to retry, keeps the page when only the usage
 * fails, tells the truth about price books and counts, ignores a late answer, and offers Archive and Restore only to a caller who may.
 */

const ok = <T,>(data: T) => ({ status: 1, data })

/** One Sub-product page in a fake browser; `after` may replace a service call once the world is installed (a failing read, a slow one). */
async function openPage(world: World = {}, after?: (services: { record: typeof import('../../services/product-master/record-service')['productRecordService'] }) => void) {
  const k = await kit()
  const router = await routerHarness('', '/portfolio/products/11')
  const calls = await installWorld(k, { record: fullRecord(), ...world })
  const { productRecordService } = await import('../../services/product-master/record-service')
  after?.({ record: productRecordService })
  const { SubProductPage } = await import('../../components/domain/portfolio/sub-product-page')
  const names: string[] = []
  const onNameKnown = (n: string) => { names.push(n) }
  const element = (id: string) => router.wrap(k.h(SubProductPage, { id, onBack: () => {}, onNameKnown }))
  await k.render(element('11'))
  await k.tick(80)
  return { k, router, calls, names, element, productRecordService }
}

describe('a Sub-product page: what the old record pages pinned', () => {
  afterEach(disposeAll)

  it('says so and asks the server nothing when there is no session', async () => {
    const { k, calls } = await openPage({ session: false })
    assert.ok(k.bodyText().includes('Your ERP session is unavailable. Please sign in again.'))
    assert.deepEqual(calls.get, [], 'the record is not asked for')
    assert.deepEqual(calls.usage, [])
    assert.deepEqual(calls.history, [])
    assert.equal(k.one('h1')?.textContent ?? '', '', 'no record is drawn')
  })

  it('shows the server\'s error with a Retry that reads the record again', async () => {
    let attempts = 0
    const { k } = await openPage({}, ({ record }) => {
      record.get = async () => {
        attempts += 1
        if (attempts === 1) throw new ApiError('The server did not answer.', 500)
        return ok(fullRecord()) as never
      }
    })
    assert.ok(k.bodyText().includes('The server did not answer.'), 'the reason is shown')
    assert.equal(attempts, 1)
    await press(k, 'Retry')
    await k.tick(80)
    assert.equal(attempts, 2, 'Retry asks again')
    assert.equal(k.one('h1')!.textContent, 'Fee Collection', 'and the page opens')
    assert.ok(!k.bodyText().includes('The server did not answer.'))
  })

  it('keeps the page and says what failed when the usage cannot be read', async () => {
    const { k, calls } = await openPage({}, ({ record }) => {
      record.usage = async () => { throw new Error('The usage could not be counted.') }
    })
    await openTab(k, 'Usage')
    await k.tick(30)
    assert.ok(k.all('[role="alert"]').some((a) => (a.textContent ?? '').includes('The usage could not be counted.')), 'the failure is said where the usage would be')
    assert.equal(calls.get.length, 1, 'the record is not read again because of it')
    assert.equal(k.one('h1')!.textContent, 'Fee Collection', 'who it is stays on screen')
    await openTab(k, 'Overview')
    assert.ok(k.bodyText().includes('Collects school fees online.'), 'the other tabs still work')
  })

  it('says it is in no price book yet, and what a quote uses instead', async () => {
    const { k } = await openPage({ usage: usageFull({ priceBooks: [], basePrice: 1500, currency: 'INR' }) })
    await openTab(k, 'Usage')
    await k.tick(30)
    const text = k.bodyText()
    assert.ok(text.includes('Not in any price book yet'))
    assert.ok(text.includes('a quote line uses its base price, INR 1,500.00'), `the base price is named: ${text.slice(0, 300)}`)
    assert.ok(k.all('a').some((a) => a.getAttribute('href') === '/module/crm/sales/price-books'), 'with a way to the price books')
    await disposeAll()
    const bare = await openPage({ usage: usageFull({ priceBooks: [], basePrice: null }) })
    await openTab(bare.k, 'Usage')
    await bare.k.tick(30)
    assert.ok(bare.k.bodyText().includes('which is empty'), 'a base price that is not set is said to be empty')
  })

  it('draws a real zero in the usage counts as 0', async () => {
    const { k } = await openPage({ usage: usageFull({ counts: { quotes: 2, purchaseOrders: 0 } }) })
    await openTab(k, 'Usage')
    await k.tick(30)
    const term = (label: string) => k.all('dt').find((dt) => dt.textContent === label)
    assert.equal(term('Purchase orders')?.nextElementSibling?.textContent, '0', 'a count of zero is drawn as 0')
    assert.equal(term('Quotes')?.nextElementSibling?.textContent, '2')
    assert.ok(term('FAQs') === undefined, 'a count the server did not send is left out, not drawn as 0')
  })

  it('says Signals has no value for a record that was not counted, and draws a real zero as 0', async () => {
    const none = await openPage({ listRow: listRow({ signalsFound: null }) })
    await openTab(none.k, 'Signals & ICP')
    await none.k.tick(30)
    assert.ok(none.k.bodyText().includes('Not counted: Signals has no value for this.'))
    assert.ok(!none.k.bodyText().includes('0 signals'), 'no count is invented')
    await disposeAll()
    const zero = await openPage({ listRow: listRow({ signalsFound: 0 }) })
    assert.ok(zero.k.bodyText().includes('0 signals'), 'the chip says a real zero')
    await openTab(zero.k, 'Signals & ICP')
    await zero.k.tick(30)
    assert.ok(!zero.k.bodyText().includes('Not counted'), 'a zero is a count')
    const fact = zero.k.all('dt').find((dt) => dt.textContent === 'Signals found')
    assert.ok((fact?.nextElementSibling?.textContent ?? '').startsWith('0'), `the Signals found fact starts with 0: ${fact?.nextElementSibling?.textContent}`)
  })

  it('keeps the record that was asked for last when the answer for the one before comes late', async () => {
    let release: (value: unknown) => void = () => {}
    const slow = new Promise((resolve) => { release = resolve })
    const { k, element, names } = await openPage({}, ({ record }) => {
      record.get = (async (id: number | string) => {
        if (String(id) === '11') return slow
        return ok(fullRecord({ id: 12, key: 'scholarclone/sch-12', name: 'Admissions' }))
      }) as never
    })
    assert.equal(k.one('h1')?.textContent ?? '', '', 'the first record has not answered')
    await k.render(element('12'))
    await k.tick(80)
    assert.equal(k.one('h1')!.textContent, 'Admissions', 'the second record is open')
    await k.act(async () => { release(ok(fullRecord())) })
    await k.tick(40)
    assert.equal(k.one('h1')!.textContent, 'Admissions', 'the late answer for the first record did not replace it')
    assert.ok(!k.bodyText().includes('Fee Collection'))
    assert.ok(!names.includes('Fee Collection'), 'and the breadcrumb was never told the first name')
  })

  it('says what the server answered when archiving is refused, and the record stays as it was', async () => {
    const { k, calls } = await openPage({}, ({ record }) => {
      record.archive = async () => { throw new ApiError('This Sub-product is still on an open quote.', 409) }
    })
    await press(k, 'Archive')
    await k.tick(10)
    await k.click(k.all('[role="alertdialog"] button, [role="dialog"] button').find((b) => b.textContent?.trim() === 'Archive')!)
    await k.tick(30)
    assert.ok(k.all('[role="alert"]').some((a) => (a.textContent ?? '').includes('This Sub-product is still on an open quote.')), 'the server\'s words are shown')
    assert.ok(k.withText('Archive') !== null, 'the record is still active: Archive is still offered')
    assert.ok(k.withText('Restore') === null)
    assert.ok(!k.bodyText().includes('Archived.'), 'nothing says it was archived')
    assert.deepEqual(calls.archive, [], 'the refused call is not recorded as done')
  })

  it('restores an archived record without asking', async () => {
    const { k, calls } = await openPage({ record: fullRecord({ status: 'archived' }) })
    assert.ok(k.withText('Archive') === null, 'an archived record is not archived again')
    await press(k, 'Restore')
    await k.tick(30)
    assert.deepEqual(calls.restore, [11], 'restored straight away')
    assert.equal(k.all('[role="alertdialog"], [role="dialog"]').length, 0, 'no question was asked')
    assert.ok(k.bodyText().includes('Restored.'))
  })

  it('offers Archive and Restore only to a caller whose rights allow them', async () => {
    const may = await openPage({ meta: meta({}, { archive: true, restore: true }) })
    assert.ok(may.k.withText('Archive') !== null, 'archive is offered on an active record')
    await disposeAll()
    const noArchive = await openPage({ meta: meta({}, { archive: false, restore: true }) })
    assert.ok(noArchive.k.withText('Archive') === null, 'no archive without the right')
    await disposeAll()
    const archived = await openPage({ record: fullRecord({ status: 'archived' }), meta: meta({}, { archive: true, restore: true }) })
    assert.ok(archived.k.withText('Restore') !== null, 'restore is offered on an archived record')
    await disposeAll()
    const noRestore = await openPage({ record: fullRecord({ status: 'archived' }), meta: meta({}, { archive: true, restore: false }) })
    assert.ok(noRestore.k.withText('Restore') === null, 'no restore without the right')
    await disposeAll()
    const shared = await openPage({ record: fullRecord({ shared: true }), meta: meta({}, can({ archive: true, restore: true })) })
    assert.ok(shared.k.withText('Archive') === null && shared.k.withText('Restore') === null, 'a shared record is read only for everybody')
  })

  it('reads the record again after a save in the form, and the new name reaches the heading and the breadcrumb', async () => {
    let saved = false
    let reads = 0
    const { k, names } = await openPage({}, ({ record }) => {
      record.update = async () => { saved = true; return ok(fullRecord({ name: 'Fee Desk' })) as never }
      record.get = async () => { reads += 1; return ok(saved ? fullRecord({ name: 'Fee Desk' }) : fullRecord()) as never }
    })
    assert.equal(k.one('h1')!.textContent, 'Fee Collection')
    await press(k, 'Edit')
    await k.tick(60)
    await fill(k, 'Name', 'Fee Desk')
    const readsBeforeSave = reads
    await press(k, 'Save')
    await k.tick(80)
    assert.ok(reads > readsBeforeSave, 'the record was read again after the save')
    assert.equal(saved, true, 'the form saved')
    assert.equal(k.one('h1')!.textContent, 'Fee Desk', 'the heading follows the new name')
    assert.equal(names.at(-1), 'Fee Desk', 'and the breadcrumb is told')
    assert.ok(k.bodyText().includes('Saved.'), 'and the person is told it was saved')
  })

  it('writes the tab to the address when the person changes it, and leaves the plain address on the Overview', async () => {
    const { k, router } = await openPage()
    assert.equal(router.lastSearch(), '', 'the Overview is the plain address')
    await openTab(k, 'Usage')
    await k.tick(20)
    assert.equal(router.lastSearch(), 'tab=usage', 'the tab is in the address, so a link or a reload opens it')
    await openTab(k, 'History')
    await k.tick(20)
    assert.equal(router.lastSearch(), 'tab=history')
    await openTab(k, 'Overview')
    await k.tick(20)
    assert.equal(router.lastSearch(), '', 'back on the Overview the address is plain again')
  })

  it('opens the Usage of a catalogue-only record, and says on its Signals & ICP tab that it has no About yet, asking nothing', async () => {
    const { k, calls } = await openPage({ record: fullRecord({ kind: 'item', offer: null, about: null, icp: null, parent: null, signalKey: null }) })
    await openTab(k, 'Usage')
    await k.tick(30)
    assert.deepEqual(calls.usage, [11], 'its usage is read')
    assert.ok(k.bodyText().includes('Where it is used'), 'and shown')
    await openTab(k, 'Signals & ICP')
    await k.tick(30)
    assert.ok(k.bodyText().includes('this one has no About yet'), 'the ideal customer belongs to an About, and it has none')
    assert.deepEqual(calls.offers, [], 'the Portfolio is not asked for an ideal customer it cannot have')
  })
})
