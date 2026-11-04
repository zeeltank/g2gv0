import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PmOption } from '../../services/product-master/types'
import type { CrmOpportunity } from '../../types/crm'
import {
  chosenProduct, entersClosedLost, isClosedLost, isNoAccess, lossReasonPayload, lossReasonProblem, lossReasonView, noteProductSeen, NO_PRODUCT_CHOICE, NO_PRODUCT_TEXT, NO_REASON_CHOICE,
  opportunityColumnCount, productChoices, productPayload, productText, reasonChoices, readLossReasons, readOpportunityExtras, readRefusal, REASON_NEEDED_WITHOUT_LIST,
  REASON_NEEDED_WITH_LIST, showProductChoice, stageChangePayload, withOpportunityExtras, withPipelineReasons,
} from './model'

const PRODUCT = { id: 9, key: 'scholarclone-erp', name: 'School ERP' }
const REASONS = [{ code: 'price', label: 'Price too high' }, { code: 'no_budget', label: 'No budget' }, { code: 'other', label: 'Other' }]
const options: PmOption[] = [
  { id: 4, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentId: null, label: 'ScholarClone' },
  { id: 9, key: 'scholarclone-erp', name: 'School ERP', kind: 'sub_product', parentId: 4, label: 'ScholarClone › School ERP' },
]

describe('reading the fields slice 11 added', () => {
  it('reads the contract\'s snake_case loss_reason and a camelCase lossReason, and the product', () => {
    assert.deepEqual(readOpportunityExtras({ product: PRODUCT, loss_reason: { code: 'price', label: 'Price too high' } }), { product: PRODUCT, lossReason: { code: 'price', label: 'Price too high' } })
    assert.deepEqual(readOpportunityExtras({ lossReason: { code: 'timing', label: 'Timing was wrong' } }), { lossReason: { code: 'timing', label: 'Timing was wrong' } })
  })

  it('a key the server left out stays out (an older server), and a key sent as null is null (none)', () => {
    assert.deepEqual(readOpportunityExtras({}), {})
    assert.deepEqual(readOpportunityExtras(null), {})
    assert.deepEqual(readOpportunityExtras('nonsense'), {})
    const none = readOpportunityExtras({ product: null, loss_reason: null })
    assert.ok('product' in none && none.product === null)
    assert.ok('lossReason' in none && none.lossReason === null)
  })

  it('reads a product id sent as a string, gives a product with no name a name, and reads an unreadable product as none', () => {
    assert.deepEqual(readOpportunityExtras({ product: { id: '12', key: ' ', name: '' } }).product, { id: 12, key: null, name: 'Product #12' })
    for (const bad of [{ id: 0, name: 'x' }, { id: 'abc' }, { name: 'no id' }, 'text', 7, []]) assert.equal(readOpportunityExtras({ product: bad }).product, null, JSON.stringify(bad))
  })

  it('reads a reason with no label as its code, and a reason with no code as none', () => {
    assert.deepEqual(readOpportunityExtras({ loss_reason: { code: 'price' } }).lossReason, { code: 'price', label: 'price' })
    for (const bad of [{ label: 'No code' }, { code: '  ' }, 'price', 3, []]) assert.equal(readOpportunityExtras({ loss_reason: bad }).lossReason, null, JSON.stringify(bad))
  })

  it('withOpportunityExtras keeps every other field of the opportunity exactly', () => {
    const raw = { id: '7', name: 'Deal', amount: 5, product: PRODUCT, loss_reason: { code: 'price', label: 'Price too high' } } as unknown as CrmOpportunity
    const read = withOpportunityExtras(raw)
    assert.equal(read.id, '7')
    assert.equal(read.name, 'Deal')
    assert.equal(read.amount, 5)
    assert.deepEqual(read.lossReason, { code: 'price', label: 'Price too high' })
    assert.equal('lossReason' in withOpportunityExtras({ id: '7' } as CrmOpportunity), false, 'nothing invented')
  })
})

describe('the loss reasons the pipeline answer lists', () => {
  it('reads a list in the server\'s order', () => {
    assert.deepEqual(readLossReasons(REASONS), REASONS)
  })

  it('is undefined when the server did not say (not a list), and an empty list when it said there are none', () => {
    for (const notAList of [undefined, null, 'price', 3, { price: 'Price' }]) assert.equal(readLossReasons(notAList), undefined, JSON.stringify(notAList))
    assert.deepEqual(readLossReasons([]), [])
  })

  it('drops an entry with no readable code, keeps a repeated code once, and labels a missing label with the code', () => {
    assert.deepEqual(readLossReasons([{ code: 'price', label: 'Price' }, { label: 'x' }, null, 'y', { code: 'price', label: 'Again' }, { code: 'timing' }]), [{ code: 'price', label: 'Price' }, { code: 'timing', label: 'timing' }])
  })

  it('withPipelineReasons reads the key when it is there and leaves an older answer as it was', () => {
    const stages = [{ stage: 'Prospecting', label: 'Prospecting', color: null, count: 1, totalAmount: 0 }]
    assert.deepEqual(withPipelineReasons({ stages, lossReasons: REASONS }), { stages, lossReasons: REASONS })
    const older = withPipelineReasons({ stages })
    assert.deepEqual(older, { stages })
    assert.equal('lossReasons' in older, false)
    const junk = withPipelineReasons({ stages, lossReasons: 'oops' } as never)
    assert.equal('lossReasons' in junk, false, 'something that is not a list is not passed on')
    assert.deepEqual(withPipelineReasons({ stages, lossReasons: [] }).lossReasons, [])
  })
})

describe('Closed Lost', () => {
  it('is recognised without regard to case or surrounding spaces, like the server does, and nothing else is', () => {
    for (const stage of ['Closed Lost', 'closed lost', ' CLOSED LOST ']) assert.equal(isClosedLost(stage), true, stage)
    for (const stage of ['Closed Won', 'Closed', 'Lost', '', null, undefined]) assert.equal(isClosedLost(stage), false, String(stage))
  })

  it('a reason is asked for on a move INTO it, not when it is already there', () => {
    assert.equal(entersClosedLost('Negotiation/Review', 'Closed Lost'), true)
    assert.equal(entersClosedLost(null, 'Closed Lost'), true)
    assert.equal(entersClosedLost('Closed Lost', 'Closed Lost'), false)
    assert.equal(entersClosedLost('Closed Lost', 'Qualification'), false)
    assert.equal(entersClosedLost('Qualification', 'Closed Won'), false)
  })
})

describe('the words', () => {
  it('the product line: nothing when the server did not say, a name, or "No product chosen"', () => {
    assert.equal(productText(undefined), null)
    assert.equal(productText(PRODUCT), 'School ERP')
    assert.equal(productText(null), NO_PRODUCT_TEXT)
    assert.equal(NO_PRODUCT_TEXT, 'No product chosen')
  })

  it('the reason: the label, plus the person\'s words when they say more', () => {
    assert.deepEqual(lossReasonView({ code: 'price', label: 'Price too high' }, 'They found it 20% cheaper'), { label: 'Price too high', note: 'They found it 20% cheaper' })
    assert.deepEqual(lossReasonView({ code: 'price', label: 'Price too high' }, null), { label: 'Price too high', note: null })
    assert.deepEqual(lossReasonView(null, 'No money this year'), { label: null, note: 'No money this year' })
    assert.deepEqual(lossReasonView(undefined, '  Gone quiet  '), { label: null, note: 'Gone quiet' })
  })

  it('the free text is not shown twice when it is only the label (the server fills an empty free text with the code\'s label)', () => {
    assert.deepEqual(lossReasonView({ code: 'price', label: 'Price too high' }, 'Price too high'), { label: 'Price too high', note: null })
    assert.deepEqual(lossReasonView({ code: 'price', label: 'Price too high' }, ' price TOO high '), { label: 'Price too high', note: null })
  })

  it('says nothing when there is nothing to say', () => {
    assert.equal(lossReasonView(null, null), null)
    assert.equal(lossReasonView(undefined, '   '), null)
    assert.equal(lossReasonView(undefined, undefined), null)
  })
})

describe('the list\'s Product column', () => {
  it('shows once any row loaded has a product and keeps its place', () => {
    assert.equal(noteProductSeen(false, [{ product: null }, {}]), false)
    assert.equal(noteProductSeen(false, [{ product: null }, { product: PRODUCT }]), true)
    assert.equal(noteProductSeen(true, [{ product: null }]), true, 'a page with none does not take it away')
    assert.equal(noteProductSeen(false, []), false)
  })

  it('the rows that span the table count the columns', () => {
    assert.equal(opportunityColumnCount(false), 6)
    assert.equal(opportunityColumnCount(true), 7)
  })
})

describe('the Product choice', () => {
  it('lists "No product" first, then every product by its label', () => {
    assert.deepEqual(productChoices(options, null), [{ value: '', label: NO_PRODUCT_CHOICE }, { value: '4', label: 'ScholarClone' }, { value: '9', label: 'ScholarClone › School ERP' }])
  })

  it('keeps a product the list no longer holds, once, under its own name', () => {
    const choices = productChoices(options, { id: 77, key: 'old', name: 'Old Product' })
    assert.deepEqual(choices.at(-1), { value: '77', label: 'Old Product' })
    assert.equal(productChoices(options, PRODUCT).length, 3, 'a product the list holds is not added again')
  })

  it('is drawn when there is something to choose or something to clear', () => {
    assert.equal(showProductChoice(options, null), true)
    assert.equal(showProductChoice([], null), false)
    assert.equal(showProductChoice([], PRODUCT), true)
  })

  it('reads a box value as an id, and "No product" or rubbish as none', () => {
    assert.equal(chosenProduct('9'), 9)
    for (const value of ['', '0', 'abc', '-3', '1.5']) assert.equal(chosenProduct(value), null, value)
  })

  it('is sent only when chosen or changed', () => {
    assert.deepEqual(productPayload(null, null, false), {}, 'a new opportunity with no product sends nothing')
    assert.deepEqual(productPayload(null, 9, false), { productMasterId: 9 })
    assert.deepEqual(productPayload(9, 9, true), {}, 'an edit that left it alone sends nothing')
    assert.deepEqual(productPayload(null, null, true), {})
    assert.deepEqual(productPayload(9, 4, true), { productMasterId: 4 })
    assert.deepEqual(productPayload(9, null, true), { productMasterId: null }, 'a cleared product is sent as null')
    assert.deepEqual(productPayload(null, 9, true), { productMasterId: 9 })
  })
})

describe('the Reason choice and what is sent', () => {
  it('lists the prompt first, then the server\'s reasons in its order', () => {
    assert.deepEqual(reasonChoices(REASONS, null), [{ value: '', label: NO_REASON_CHOICE }, ...REASONS.map((r) => ({ value: r.code, label: r.label }))])
  })

  it('keeps a code the opportunity carries that the list no longer holds, under its own label', () => {
    const choices = reasonChoices(REASONS, { code: 'old_code', label: 'An old reason' })
    assert.deepEqual(choices.at(-1), { value: 'old_code', label: 'An old reason' })
    assert.equal(reasonChoices(REASONS, { code: 'price', label: 'Price too high' }).length, 4)
  })

  it('a create or edit sends the code only when the deal ends up Closed Lost', () => {
    assert.deepEqual(lossReasonPayload('Closed Lost', 'price', null, false), { lossReasonCode: 'price' })
    for (const stage of ['Qualification', 'Closed Won', '', null, undefined]) assert.deepEqual(lossReasonPayload(stage, 'price', null, false), {}, String(stage))
    assert.deepEqual(lossReasonPayload('closed lost', 'price', null, true), { lossReasonCode: 'price' }, 'however the stage is spelled')
  })

  it('an edit leaves an unchanged code alone, sends a changed one, and clears a cleared one with null', () => {
    assert.deepEqual(lossReasonPayload('Closed Lost', 'price', 'price', true), {})
    assert.deepEqual(lossReasonPayload('Closed Lost', 'timing', 'price', true), { lossReasonCode: 'timing' })
    assert.deepEqual(lossReasonPayload('Closed Lost', '', 'price', true), { lossReasonCode: null })
    assert.deepEqual(lossReasonPayload('Closed Lost', '', null, true), {})
    assert.deepEqual(lossReasonPayload('Closed Lost', '', null, false), {}, 'no choice on a create sends nothing')
  })

  it('a move from the board carries the code and the words only into Closed Lost', () => {
    assert.deepEqual(stageChangePayload('Closed Lost', { code: 'price', note: '  cheaper elsewhere ' }), { salesStage: 'Closed Lost', lossReasonCode: 'price', closeReason: 'cheaper elsewhere' })
    assert.deepEqual(stageChangePayload('Closed Lost', { code: 'price', note: '   ' }), { salesStage: 'Closed Lost', lossReasonCode: 'price' }, 'no words, no closeReason key')
    assert.deepEqual(stageChangePayload('Closed Lost', { code: '', note: 'Gone quiet' }), { salesStage: 'Closed Lost', closeReason: 'Gone quiet' }, 'words alone are enough, and no code key')
    assert.deepEqual(stageChangePayload('Negotiation/Review', { code: 'price', note: 'x' }), { salesStage: 'Negotiation/Review' }, 'never with another stage')
    assert.deepEqual(stageChangePayload('Closed Won'), { salesStage: 'Closed Won' })
    assert.deepEqual(stageChangePayload('Closed Lost'), { salesStage: 'Closed Lost' })
  })

  it('a reason (a code or some words) is needed, and the sentence depends on whether the server listed any', () => {
    assert.equal(lossReasonProblem(REASONS, 'price', ''), null)
    assert.equal(lossReasonProblem(REASONS, '', 'Gone quiet'), null)
    assert.equal(lossReasonProblem(REASONS, '', '   '), REASON_NEEDED_WITH_LIST)
    assert.equal(lossReasonProblem([], '', ''), REASON_NEEDED_WITHOUT_LIST)
    assert.equal(lossReasonProblem([], '', 'Gone quiet'), null)
    assert.notEqual(REASON_NEEDED_WITH_LIST, REASON_NEEDED_WITHOUT_LIST)
  })
})

describe('a list the person may not read', () => {
  it('a 403 and a 404 are answers (no access, no such list); nothing else is', () => {
    for (const status of [403, 404]) assert.equal(isNoAccess(Object.assign(new Error('x'), { status })), true, String(status))
    for (const status of [400, 401, 422, 500, 502, 0]) assert.equal(isNoAccess(Object.assign(new Error('x'), { status })), false, String(status))
  })

  it('never fails on a strange value, and an error without a status is not an answer', () => {
    for (const strange of [null, undefined, 'text', 403, new Error('dropped connection'), { status: '403' }, { status: null }, []]) assert.equal(isNoAccess(strange), false, JSON.stringify(strange))
  })
})

describe('understanding a refusal', () => {
  const refusal = (message: string, errors?: Record<string, string[]>) => Object.assign(new Error(message), { status: 422, errors })

  it('a refusal filed under lossReasonCode belongs next to the Reason box (both spellings)', () => {
    assert.deepEqual(readRefusal(refusal('Choose why this opportunity was lost.', { lossReasonCode: ['Required for Closed Lost.'] }), 'x'), { message: 'Choose why this opportunity was lost.', onReason: true })
    assert.equal(readRefusal(refusal('Choose.', { loss_reason_code: ['Required.'] }), 'x').onReason, true)
  })

  it('any other refusal is a plain message', () => {
    assert.deepEqual(readRefusal(refusal('Product not found.', { productMasterId: ['Choose one of your own products.'] }), 'x'), { message: 'Product not found.', onReason: false })
    assert.deepEqual(readRefusal(refusal('Say why this opportunity was lost.'), 'x'), { message: 'Say why this opportunity was lost.', onReason: false })
  })

  it('uses the fallback when the error says nothing, and never fails on a strange value', () => {
    assert.deepEqual(readRefusal(new Error('  '), 'Unable to move that opportunity.'), { message: 'Unable to move that opportunity.', onReason: false })
    for (const strange of [null, undefined, 'text', 4, { errors: 'oops' }, { errors: null }]) assert.deepEqual(readRefusal(strange, 'fallback'), { message: 'fallback', onReason: false }, JSON.stringify(strange))
  })
})
