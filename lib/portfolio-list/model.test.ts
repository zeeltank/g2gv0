import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  confirmSameText, decidedSummary, displayItems, formatMoney, icpTone, listScreenState, matchesBanner, matchesToReview, mayTick, mergeBulkAnswers, planBulk, readinessTone, STATE_WORD,
  typeWord, whyNoTick,
} from './model'
import { ADMIN_CAN, aboutOnly, decision, entry, HR_CAN, hrRows, match, matchesData, noMatch, product, sold, SALES_CAN, service, shared, stray } from './fixtures'

describe('the groups of a page', () => {
  it('puts a header for each Product, then its Sub-products, then "No product yet"', () => {
    const items = displayItems([product(), aboutOnly(), sold(), shared(), stray()], 1)
    assert.deepEqual(items.map((i) => (i.kind === 'group' ? `G:${i.label}` : `R:${i.row.name}`)), ['G:ScholarClone', 'R:Scholar School ERP', 'R:Fees Intelligence', 'G:Enterprise Brain', 'G:No product yet', 'R:Imported widget'])
  })

  it('draws a header from the Product name when a filter left the Product row out, and never a Sub-product without its Product', () => {
    const items = displayItems([sold(), service()], 1)
    assert.deepEqual(items.map((i) => i.kind), ['group', 'row', 'row'])
    assert.equal(items[0].kind === 'group' && items[0].label, 'ScholarClone')
    assert.equal(items[0].kind === 'group' && items[0].row, null, 'a header made from a Sub-product has no Product row to open')
  })

  it('says a group continues when the page begins inside it (page 2 and later, not page 1)', () => {
    const later = displayItems([aboutOnly(), sold()], 2)
    assert.equal(later[0].kind === 'group' && later[0].continued, true)
    const first = displayItems([aboutOnly(), sold()], 1)
    assert.equal(first[0].kind === 'group' && first[0].continued, false)
    const withProduct = displayItems([product(), aboutOnly()], 2)
    assert.equal(withProduct[0].kind === 'group' && withProduct[0].continued, false, 'a page that begins with the Product row does not continue anything')
  })

  it('opens a new group only when the Product changes, not for every row', () => {
    const items = displayItems([aboutOnly({ id: 1 }), aboutOnly({ id: 2 }), aboutOnly({ id: 3, productId: 9, productName: 'G2G' })], 1)
    assert.deepEqual(items.map((i) => i.kind), ['group', 'row', 'row', 'group', 'row'])
  })

  it('returns nothing for no rows', () => {
    assert.deepEqual(displayItems([], 1), [])
  })
})

describe('the words of the list', () => {
  it('says what a Sub-product sold in CRM is: Sold, Paused, Not sold, or In the Recycle Bin', () => {
    assert.deepEqual(STATE_WORD, { sold: 'Sold', paused: 'Paused', not_sold: 'Not sold', binned: 'In the Recycle Bin' })
  })

  it('calls a type Product, Sub-product or Service, never Catalogue, Offer, Item or Product line', () => {
    assert.equal(typeWord(product()), 'Product')
    assert.equal(typeWord(aboutOnly()), 'Sub-product')
    assert.equal(typeWord(sold()), 'Sub-product')
    assert.equal(typeWord(service()), 'Service')
    assert.equal(typeWord(entry()), 'Sub-product')
  })

  it('draws readiness by its words: live and proven are good, in progress is pending, concept and deferred are quiet', () => {
    assert.equal(readinessTone('Live – with client'), 'success')
    assert.equal(readinessTone('Prototype'), 'pending')
    assert.equal(readinessTone('Deferred'), 'inactive')
    assert.equal(readinessTone('Built – no production client'), 'primary')
    assert.equal(readinessTone('something new'), 'default')
    assert.equal(readinessTone(null), 'default')
    assert.equal(icpTone('active'), 'success')
    assert.equal(icpTone('none'), 'default')
  })

  it('writes money with its currency and an Indian grouping, and nothing for a missing amount', () => {
    assert.equal(formatMoney(120000, 'INR'), 'INR 1,20,000.00')
    assert.equal(formatMoney(null, 'INR'), null)
    assert.equal(formatMoney(5, null), '5.00')
  })
})

describe('which rows can be ticked for a bulk action', () => {
  it('ticks a Sub-product that is sold or paused, is the organisation\'s own, shows its Sell keys, for a caller who may change Sub-products', () => {
    assert.equal(mayTick(sold(), ADMIN_CAN), true)
    assert.equal(mayTick(service(), ADMIN_CAN), true, 'a paused service')
    assert.equal(mayTick(entry(), SALES_CAN), true)
  })

  it('does not tick a Product, a record that is not sold, one in the Recycle Bin, a shared one, or one whose Sell keys the caller cannot see', () => {
    assert.equal(mayTick(product(), ADMIN_CAN), false)
    assert.equal(mayTick(aboutOnly(), ADMIN_CAN), false)
    assert.equal(mayTick(sold({ state: 'binned' }), ADMIN_CAN), false)
    assert.equal(mayTick(sold({ shared: true }), ADMIN_CAN), false)
    assert.equal(mayTick(hrRows().find((r) => r.name === 'Fees Intelligence')!, HR_CAN), false, 'an HR caller has no Sell keys on the row')
    assert.equal(mayTick(sold(), { editSubProduct: false }), false)
  })

  it('never ticks a Product, even one that somehow carries the Sell keys and a sold state (the rule does not lean on what the API happens to send)', () => {
    assert.equal(mayTick(product({ hasSell: true, state: 'sold', unitPrice: 1, currency: 'INR' }), ADMIN_CAN), false)
    assert.match(whyNoTick(product({ hasSell: true, state: 'sold', unitPrice: 1, currency: 'INR' }), ADMIN_CAN) ?? '', /Product has no entry/)
  })

  it('gives a reason for every row that cannot be ticked, and none for one that can', () => {
    assert.equal(whyNoTick(sold(), ADMIN_CAN), null)
    assert.match(whyNoTick(product(), ADMIN_CAN) ?? '', /Product has no entry/)
    assert.match(whyNoTick(aboutOnly(), ADMIN_CAN) ?? '', /not sold in CRM/)
    assert.match(whyNoTick(sold({ state: 'binned' }), ADMIN_CAN) ?? '', /Recycle Bin/)
    assert.match(whyNoTick(sold({ shared: true }), ADMIN_CAN) ?? '', /shared/)
  })
})

describe('turning ticked rows into catalogue ids', () => {
  it('groups the ids by item type (a batch holds one type) and reads a missing id from the row\'s Sell section', async () => {
    const asked: number[] = []
    const plan = await planBulk([sold({ id: 11 }), service({ id: 15 }), entry({ id: 14 })], async (id) => { asked.push(id); return id + 1000 })
    assert.deepEqual(plan.byType, { product: [1011, 1014], service: [1015] })
    assert.deepEqual(plan.unresolved, [])
    assert.deepEqual(asked.sort(), [11, 14, 15])
  })

  it('uses the catalogue id a row carries without asking, and names a row whose id could not be read', async () => {
    const asked: number[] = []
    const plan = await planBulk([sold({ id: 11, crmProductId: 63 }), service({ id: 15 }), entry({ id: 14, name: 'Broken one' })], async (id) => {
      asked.push(id)
      if (id === 14) throw new Error('refused')
      return null
    })
    assert.deepEqual(plan.byType, { product: [63], service: [] })
    assert.deepEqual(plan.unresolved, ['ScholarClone Implementation', 'Broken one'])
    assert.deepEqual(asked.sort(), [14, 15], 'the row that carries its id is not read again')
  })

  it('reads no Sell section at all when every ticked row carries its catalogue id (the list API\'s `crmProductId`, Sell viewers only), and keeps the type of each id', async () => {
    const asked: number[] = []
    const plan = await planBulk([sold({ id: 11, crmProductId: 63 }), service({ id: 15, crmProductId: 71 }), entry({ id: 14, crmProductId: 64 })], async (id) => { asked.push(id); return null })
    assert.deepEqual(asked, [], 'no read per ticked row: the contract with the list API')
    assert.deepEqual(plan.byType, { product: [63, 64], service: [71] })
    assert.deepEqual(plan.unresolved, [])
  })

  it('does not trust a key that is not a whole positive number (null for a record with no Sell side, 0, text, negative) and reads that row\'s Sell section instead', async () => {
    const asked: number[] = []
    const odd = [
      sold({ id: 11, crmProductId: null }), sold({ id: 12, name: 'Zero', crmProductId: 0 }), sold({ id: 13, name: 'Text', crmProductId: '63' as unknown as number }),
      sold({ id: 14, name: 'Negative', crmProductId: -5 }), sold({ id: 16, name: 'Missing' }),
    ]
    const plan = await planBulk(odd, async (id) => { asked.push(id); return id + 1000 })
    assert.deepEqual(asked.sort(), [11, 12, 13, 14, 16], 'every one of them is read, because none carries a usable key')
    assert.deepEqual(plan.byType.product, [1011, 1012, 1013, 1014, 1016])
  })

  it('adds the answers of the two batches into one', () => {
    const merged = mergeBulkAnswers([
      { results: [{ id: '1', ok: true }], summary: { succeeded: 1, failed: 0 } },
      { results: [{ id: '2', ok: false, reason: 'No.' }], summary: { succeeded: 0, failed: 1 } },
    ] as never)
    assert.deepEqual(merged.summary, { succeeded: 1, failed: 1 })
    assert.equal(merged.results.length, 2)
  })
})

describe('the pair review', () => {
  it('counts only the entries that come with a Sub-product to decide about', () => {
    const data = matchesData([match(), match({ itemMasterId: 32, verdict: 'EDITION' }), noMatch(), noMatch({ itemMasterId: 34, verdict: 'SERVICE' })])
    assert.equal(matchesToReview(data).length, 2)
    assert.deepEqual(matchesToReview(null), [])
  })

  it('writes the banner without the word Catalogue', () => {
    assert.equal(matchesBanner(0), null)
    assert.equal(matchesBanner(1), '1 product may be the same as a sub-product')
    assert.equal(matchesBanner(9), '9 products may be the same as sub-products')
  })

  it('asks "same product" in words that name both records and say what is kept', () => {
    const text = confirmSameText(match(), 'Scholar School ERP')
    assert.ok(text.includes('Scholar One ERP - Gujarat Edition') && text.includes('Scholar School ERP'), 'both names are in the question')
    assert.match(text, /ONE record named “Scholar School ERP”/)
    assert.match(text, /keeps working/)
  })

  it('says each decision already made in a sentence', () => {
    assert.equal(decidedSummary(decision()), 'Old CCB Fees is a different product from Fees Intelligence')
    assert.equal(decidedSummary(decision({ decision: 'same' })), 'Old CCB Fees and Fees Intelligence are the same product')
  })
})

describe('the state of the screen', () => {
  const base = { loaded: true, error: '', available: true, rows: 3, narrowed: false }
  it('is loading until the first answer, an error when there is one, and unavailable on a server with no Product database', () => {
    assert.equal(listScreenState({ ...base, loaded: false }), 'loading')
    assert.equal(listScreenState({ ...base, error: 'x' }), 'error')
    assert.equal(listScreenState({ ...base, available: false }), 'unavailable')
  })

  it('is ready with rows, empty when nothing narrows an empty list, filtered-empty when something does', () => {
    assert.equal(listScreenState(base), 'ready')
    assert.equal(listScreenState({ ...base, rows: 0 }), 'empty')
    assert.equal(listScreenState({ ...base, rows: 0, narrowed: true }), 'filtered-empty')
  })
})
