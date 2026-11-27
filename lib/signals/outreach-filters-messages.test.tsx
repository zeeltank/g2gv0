import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { absent, says } from '../agent/assertions'
import { axeViolations } from '../agent/a11y'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit, server, type Call } from '../outreach/screen-kit'
import { FACET_CATALOG, MESSAGE_ROWS, MESSAGE_SETS, PRODUCT_CORE, PRODUCT_ERP, queueAnswer } from './outreach-facet-fixtures'

/**
 * The four filters (Product, Sub-product, ICP, Region) on the Messages view: the real queue (components/domain/signals/outreach/messages-panel.tsx), the real GTM service client, a router
 * that keeps the address, and only the network replaced by a stand-in server that FILTERS the five fixture messages for real and counts both the status tabs and the options of
 * each filter with the other filters applied (lib/signals/outreach-facet-fixtures.ts, `queueAnswer`).
 *
 *   Asha Menon (11, approved)    School ERP, Fees and accounts, B2B, Gujarat and Ahmedabad
 *   Ravi Shah (12, draft)        Scholar Core, no sub-product, no ICP, Gujarat and Surat
 *   Meera Patel (13, sent)       School ERP, Timetable, B2B, Gujarat and Ahmedabad
 *   Walk-in lead (14, draft)     a contact that is not a signal contact: nothing recorded for any of the four
 *   Anita Rao (15, approved)     Scholar Core, Exam portal, B2C, Maharashtra and Nagpur
 */

type Responder = (call: Call) => unknown

/** The queue's own read answers from the stand-in; every other call (readiness, the lists of other sections) is the Messages kit's own. */
const queue = (answer: (call: Call) => unknown = (call) => queueAnswer(call.query)): Responder => {
  const base = server()

  return (call) => (call.method === 'GET' && call.path.endsWith('/gtm/outreach') ? answer(call) : base(call))
}

async function open(search = '', respond: Responder = queue()) {
  const screen = await screenKit({ respond, search })
  const { MessagesPanel } = await import('../../components/domain/signals/outreach/messages-panel')
  const { k } = screen
  await screen.mount(k.h(MessagesPanel, {}), 80)
  const queueCalls = () => screen.calls.filter((c) => c.method === 'GET' && c.path.endsWith('/gtm/outreach'))
  const last = () => queueCalls()[queueCalls().length - 1]
  const people = () => k.all('tbody tr').map((row) => row.querySelector('td .font-medium')?.textContent ?? '')
  const filterParams = (call: Call) => Object.fromEntries(['product', 'sub_product', 'icp', 'region'].filter((key) => call.query.has(key)).map((key) => [key, call.query.get(key)]))
  const press = async (el: Element | null | undefined, wait = 60) => { assert.ok(el, 'the control exists'); await k.click(el); await k.tick(wait) }
  const shown = (name: string) => k.one(`[role="combobox"][aria-label="${name}"]`)?.textContent?.trim() ?? null
  /** The shared Select commits an option on pointer down. */
  const pick = async (name: string, optionText: string) => {
    await press(k.one(`[role="combobox"][aria-label="${name}"]`), 10)
    const list = k.all('[role="listbox"]').filter((el) => el.getAttribute('aria-label') === name).pop()
    assert.ok(list, `the list of ${name} is open`)
    const words = Array.from(list.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim())
    const option = Array.from(list.querySelectorAll('[role="option"]')).find((o) => o.textContent?.trim() === optionText) as HTMLElement | undefined
    assert.ok(option, `${optionText} is among the choices of ${name}: ${words.join(' | ')}`)
    await k.act(async () => { option.dispatchEvent(new k.w.Event('pointerdown', { bubbles: true, cancelable: true })) })
    await k.tick(200)
  }
  const optionsOf = async (name: string) => {
    await press(k.one(`[role="combobox"][aria-label="${name}"]`), 10)
    const list = k.all('[role="listbox"]').filter((el) => el.getAttribute('aria-label') === name).pop()
    assert.ok(list, `the list of ${name} is open`)
    const words = Array.from(list.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim() ?? '')
    await k.press('Escape', k.one(`[role="combobox"][aria-label="${name}"]`)!)
    await k.tick(200)
    return words
  }
  const statusChips = () => Array.from(k.one('[role="group"][aria-label="Show messages that are"]')?.querySelectorAll('button') ?? []).map((b) => b.textContent?.trim() ?? '')
  const tabs = () => k.all('[role="tablist"][aria-label="Message sections"] [role="tab"]')

  return { ...screen, queueCalls, last, people, filterParams, press, shown, pick, optionsOf, statusChips, tabs }
}

const FILTERS = ['Product', 'Sub-product', 'ICP', 'Region']
const GROUP = '[role="group"][aria-label="Filter by product, sub-product, ICP and region"]'

describe('Messages: the filter bar', () => {
  afterEach(async () => { await disposeAll() })

  it('sits inside the queue, above the status chips, with the four selects at their "All" words', async () => {
    const s = await open()
    assert.deepEqual(FILTERS.map((name) => s.shown(name)), ['All products', 'All sub-products', 'All ICPs', 'All regions'])
    const group = s.k.one(GROUP)!
    const chips = s.k.one('[role="group"][aria-label="Show messages that are"]')!
    assert.ok(group && chips)
    assert.ok((group.compareDocumentPosition(chips) & s.k.w.Node.DOCUMENT_POSITION_FOLLOWING) !== 0, 'the status chips follow the filters')
    assert.ok(s.k.one('[role="tabpanel"]:not([hidden])')!.contains(group), 'it is in the open section\'s panel')
    says(s.k.bodyText(), 'they appear under Not recorded.')
    assert.equal(s.k.withText('Clear filters'), null, 'no Clear filters until one is used')
    assert.deepEqual(s.people(), ['Asha Menon', 'Ravi Shah', 'Meera Patel', 'Walk-in lead', 'Anita Rao'], 'nothing is narrowed')
    assert.deepEqual(s.filterParams(s.last()), {})
    s.restore()
  })

  it('lists each option as "Name (count)" with the messages it picks, and Not recorded last', async () => {
    const s = await open()
    assert.deepEqual(await s.optionsOf('Product'), ['All products', 'Scholar Core (2)', 'School ERP (2)', 'Not recorded (1)'])
    assert.deepEqual(await s.optionsOf('Sub-product'), ['All sub-products', 'Exam portal (1)', 'Fees and accounts (1)', 'Timetable (1)', 'Not recorded (2)'])
    assert.deepEqual(await s.optionsOf('ICP'), ['All ICPs', 'B2B: Private organisations (2)', 'B2C: Consumers (1)', 'Not recorded (2)'])
    assert.deepEqual(await s.optionsOf('Region'), ['All regions', 'Gujarat (3)', 'Ahmedabad (2)', 'Maharashtra (1)', 'Nagpur (1)', 'Surat (1)', 'Not recorded (1)'])
    s.restore()
  })

  it('is not on the other two sections, and is back when the queue is opened again', async () => {
    const s = await open()
    await s.press(s.tabs().find((t) => t.textContent?.trim() === 'Do not contact list'))
    absent(s.k.one(GROUP), 'the do not contact list has no such filters')
    await s.press(s.tabs().find((t) => t.textContent?.trim() === 'SMS log'))
    absent(s.k.one(GROUP), 'the SMS log has none either')
    await s.press(s.tabs().find((t) => t.textContent?.trim() === 'Message queue'))
    assert.ok(s.k.one(GROUP))
    s.restore()
  })

  it('has nothing for the accessibility rules to find', async () => {
    const s = await open('product=11')
    assert.deepEqual(await axeViolations(s.k.one(GROUP)!.parentElement!), [])
    s.restore()
  })
})

describe('Messages: each filter narrows the queue', () => {
  afterEach(async () => { await disposeAll() })

  const cases: Array<{ name: string; option: string; param: string; value: string; rows: string[]; address: string }> = [
    { name: 'Product', option: 'School ERP (2)', param: 'product', value: PRODUCT_ERP, rows: ['Asha Menon', 'Meera Patel'], address: 'product=11' },
    { name: 'Sub-product', option: 'Timetable (1)', param: 'sub_product', value: '22', rows: ['Meera Patel'], address: 'subProduct=22' },
    { name: 'ICP', option: 'B2C: Consumers (1)', param: 'icp', value: 'b2c', rows: ['Anita Rao'], address: 'icp=b2c' },
    { name: 'Region', option: 'Surat (1)', param: 'region', value: 'surat', rows: ['Ravi Shah'], address: 'region=surat' },
  ]

  for (const c of cases) {
    it(`${c.name}: keeps only the messages that match, asks the server for exactly that one filter, and writes it in the address`, async () => {
      const s = await open()
      await s.pick(c.name, c.option)
      assert.deepEqual(s.people(), c.rows)
      assert.deepEqual(s.filterParams(s.last()), { [c.param]: c.value })
      assert.equal(s.router.lastSearch(), c.address)
      assert.equal(s.shown(c.name), c.option)
      assert.ok(s.k.withText('Clear filters'), 'Clear filters appears')
      s.restore()
    })
  }

  it('ANDs two filters, and counts the second select with the first applied', async () => {
    const s = await open()
    await s.pick('Region', 'Gujarat (3)')
    assert.deepEqual(s.people(), ['Asha Menon', 'Ravi Shah', 'Meera Patel'])
    assert.deepEqual(await s.optionsOf('ICP'), ['All ICPs', 'B2B: Private organisations (2)', 'Not recorded (1)'], 'B2C has no message in Gujarat, so it is not offered')
    await s.pick('ICP', 'B2B: Private organisations (2)')
    assert.deepEqual(s.people(), ['Asha Menon', 'Meera Patel'])
    assert.deepEqual(s.filterParams(s.last()), { icp: 'b2b', region: 'gujarat' })
    s.restore()
  })

  it('picks the messages with nothing recorded under Not recorded, and sends `none`: the one to a contact that is not a signal contact', async () => {
    const s = await open()
    await s.pick('Product', 'Not recorded (1)')
    assert.deepEqual(s.people(), ['Walk-in lead'])
    assert.deepEqual(s.filterParams(s.last()), { product: 'none' })
    assert.equal(s.router.lastSearch(), 'product=none')
    s.restore()
  })

  it('offers only the chosen product\'s sub-products, and goes back to all of them with All products', async () => {
    const s = await open()
    await s.pick('Product', 'School ERP (2)')
    assert.deepEqual(await s.optionsOf('Sub-product'), ['All sub-products', 'Fees and accounts (1)', 'Timetable (1)'])
    await s.pick('Product', 'All products')
    assert.equal((await s.optionsOf('Sub-product')).length, 5)
    s.restore()
  })

  it('clears a sub-product that does not belong to the product just chosen (a message with two products makes the pair possible)', async () => {
    const twoProducts = (row: { id: unknown }) => (Number(row.id) === 11 ? { ...MESSAGE_SETS[11], products: [PRODUCT_ERP, PRODUCT_CORE] } : (MESSAGE_SETS[Number(row.id)] ?? MESSAGE_SETS[14]))
    const s = await open('', queue((call) => queueAnswer(call.query, twoProducts)))
    await s.pick('Sub-product', 'Fees and accounts (1)')
    assert.deepEqual(s.people(), ['Asha Menon'])
    await s.pick('Product', 'Scholar Core (1)')
    assert.equal(s.shown('Sub-product'), 'All sub-products', 'Fees belongs to School ERP, so it was cleared')
    assert.deepEqual(s.filterParams(s.last()), { product: PRODUCT_CORE })
    assert.deepEqual(s.people(), ['Asha Menon', 'Ravi Shah', 'Anita Rao'])
    s.restore()
  })
})

describe('Messages: the status tabs follow the filters', () => {
  afterEach(async () => { await disposeAll() })

  it('prints on each tab the number of messages the filters leave, which is the number the tab then shows', async () => {
    const s = await open()
    assert.ok(s.statusChips().includes('approved (2)') && s.statusChips().includes('draft (2)') && s.statusChips().includes('sent (1)'), s.statusChips().join(', '))
    await s.pick('Region', 'Gujarat (3)')
    const chips = s.statusChips()
    assert.ok(chips.includes('approved (1)') && chips.includes('draft (1)') && chips.includes('sent (1)'), chips.join(', '))
    await s.press(s.k.withText('draft (1)'))
    assert.deepEqual(s.people(), ['Ravi Shah'], 'the tab shows the one message its number promised')
    s.restore()
  })

  it('asks for the status and the filters together, and keeps the filters when the status changes', async () => {
    const s = await open('region=gujarat')
    await s.press(s.k.withText('approved (1)'))
    assert.equal(s.last().query.get('status'), 'approved')
    assert.equal(s.last().query.get('region'), 'gujarat')
    assert.deepEqual(s.people(), ['Asha Menon'])
    await s.press(s.k.withText('All'))
    assert.equal(s.last().query.get('status'), null)
    assert.equal(s.last().query.get('region'), 'gujarat')
    s.restore()
  })

  it('keeps the chosen status when a filter changes', async () => {
    const s = await open()
    await s.press(s.k.withText('approved (2)'))
    await s.pick('ICP', 'B2B: Private organisations (2)')
    assert.equal(s.last().query.get('status'), 'approved')
    assert.equal(s.last().query.get('icp'), 'b2b')
    assert.deepEqual(s.people(), ['Asha Menon'])
    s.restore()
  })
})

describe('Messages: nothing matches, the address, and a late answer', () => {
  afterEach(async () => { await disposeAll() })

  it('says "No messages match these filters." with a Clear filters button, keeps the filters and the status chips on the page, and brings the queue back on Clear filters', async () => {
    const s = await open('view=messages&product=11&icp=b2c')
    assert.deepEqual(s.people(), [])
    says(s.k.bodyText(), 'No messages match these filters.')
    const empty = s.k.all('h3').find((el) => el.textContent === 'No messages match these filters.')!
    assert.ok(empty.parentElement!.querySelector('button')?.textContent === 'Clear filters', 'the button is in the empty state')
    assert.ok(s.k.one(GROUP), 'the filters stay so they can be changed')
    assert.ok(s.k.one('[role="group"][aria-label="Show messages that are"]'), 'and so do the status chips')
    await s.press(empty.parentElement!.querySelector('button'))
    assert.deepEqual(s.people(), ['Asha Menon', 'Ravi Shah', 'Meera Patel', 'Walk-in lead', 'Anita Rao'])
    assert.equal(s.router.lastSearch(), 'view=messages', 'only the four filters were taken out of the address')
    s.restore()
  })

  it('keeps the plain "No messages" words when nothing is filtered', async () => {
    const s = await open('', queue(() => ({ status: 1, data: { items: [], counts: {} } })))
    says(s.k.bodyText(), 'No messages')
    assert.ok(!s.k.bodyText().includes('match these filters'))
    s.restore()
  })

  it('opens already narrowed from a pasted address: the first read of the queue carries the filters', async () => {
    const s = await open('view=messages&product=11&region=gujarat')
    assert.equal(s.queueCalls().length, 1, 'one read, already narrowed')
    assert.deepEqual(s.filterParams(s.last()), { product: '11', region: 'gujarat' })
    assert.deepEqual(s.people(), ['Asha Menon', 'Meera Patel'])
    assert.equal(s.shown('Product'), 'School ERP (2)')
    assert.equal(s.shown('Region'), 'Gujarat (2)')
    s.restore()
  })

  it('keeps the filters in the address when another section is opened and the queue is opened again', async () => {
    const s = await open('view=messages&icp=b2b')
    await s.press(s.tabs().find((t) => t.textContent?.trim() === 'Do not contact list'))
    const there = new URLSearchParams(s.router.lastSearch())
    assert.equal(there.get('section'), 'suppressions')
    assert.equal(there.get('icp'), 'b2b')
    await s.press(s.tabs().find((t) => t.textContent?.trim() === 'Message queue'))
    assert.equal(new URLSearchParams(s.router.lastSearch()).get('icp'), 'b2b')
    assert.equal(s.last().query.get('icp'), 'b2b')
    assert.equal(s.shown('ICP'), 'B2B: Private organisations (2)')
    s.restore()
  })

  it('draws the queue with no options, and no error, when the server does not send the options yet', async () => {
    const s = await open('', queue((call) => { const answer = queueAnswer(call.query); return { ...answer, data: { items: answer.data.items, counts: answer.data.counts } } }))
    assert.deepEqual(s.people(), ['Asha Menon', 'Ravi Shah', 'Meera Patel', 'Walk-in lead', 'Anita Rao'])
    assert.deepEqual(await s.optionsOf('Product'), ['All products'])
    s.restore()
  })

  it('keeps the answer to the LATEST question when an older answer arrives late', async () => {
    let release: () => void = () => undefined
    const late = new Promise<void>((resolve) => { release = resolve })
    const s = await open('', queue((call) => (call.query.get('product') === PRODUCT_ERP ? late.then(() => queueAnswer(call.query)) : queueAnswer(call.query))))
    await s.pick('Product', 'School ERP (2)')
    await s.pick('Product', 'Scholar Core (2)')
    assert.deepEqual(s.people(), ['Ravi Shah', 'Anita Rao'])
    release()
    await s.k.tick(80)
    assert.deepEqual(s.people(), ['Ravi Shah', 'Anita Rao'], 'the late answer for School ERP did not replace it')
    assert.equal(s.shown('Product'), 'Scholar Core (2)')
    s.restore()
  })

  it('has no send, approve or schedule control in the filter bar', async () => {
    const s = await open()
    const names = Array.from(s.k.one(GROUP)!.parentElement!.querySelectorAll('button')).map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? '')
    assert.deepEqual(names.filter((name) => /send|approve|schedule/i.test(name)), [])
    assert.equal(names.length, 4, 'four selects, and no Clear filters while nothing is chosen')
    s.restore()
  })
})

describe('the catalog the stand-in uses', () => {
  it('names the products the messages are about', () => {
    assert.equal(FACET_CATALOG.products[PRODUCT_ERP], 'School ERP')
    assert.equal(MESSAGE_ROWS.length, 5)
  })
})
