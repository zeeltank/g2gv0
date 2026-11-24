import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  blockedSubProducts, blockerSentences, canConfirmMove, canConfirmRemoval, choiceState, mayMoveRow, movedSentence, moveActionShown, ownBlockers, removalMode, removeBodyFor, removedSentence,
} from './removal-model'
import { POINTER_BLOCK, productRemovalPreview, removalPreview, SOLD_BLOCK, SUBS_BLOCK } from './fixtures'

/** The rules of deleting and moving, with no browser and no network: each assertion is one rule, and removal-model.ts is mutated against them. */

describe('what blocks a delete, in the server\'s sentences', () => {
  it('says each blocker as the server wrote it, and counts the others when it wrote nothing', () => {
    assert.deepEqual(blockerSentences([SOLD_BLOCK, POINTER_BLOCK]), ['3 quotes or orders hold it.', '12 leads and 2 tickets point at it.'])
    assert.deepEqual(blockerSentences([{ code: 'offer_in_use', count: 1, message: '' }]), ['1 other record holds it.'])
    assert.deepEqual(blockerSentences([{ code: 'offer_in_use', count: 4, message: '   ' }]), ['4 other records hold it.'])
    assert.deepEqual(blockerSentences([]), [])
  })

  it('keeps "a sub-product under it is held" out of the Product\'s own blockers: the Sub-product rows say which', () => {
    assert.deepEqual(ownBlockers({ blockedBy: [SOLD_BLOCK, SUBS_BLOCK] }), [SOLD_BLOCK])
    assert.deepEqual(ownBlockers(productRemovalPreview(true)), [], 'only the Sub-products are held')
    assert.deepEqual(blockedSubProducts(productRemovalPreview(true)).map((s) => s.id), [12])
    assert.deepEqual(blockedSubProducts(productRemovalPreview(false)), [])
  })
})

describe('which dialog a delete needs', () => {
  it('is a plain confirmation for a Sub-product that nothing holds, and a blocked one when something does', () => {
    assert.equal(removalMode(removalPreview()), 'confirm')
    assert.equal(removalMode(removalPreview({ canDelete: false, blockedBy: [SOLD_BLOCK] })), 'blocked')
  })

  it('asks each time for a Product that has Sub-products and is not held itself, even when a Sub-product is held', () => {
    assert.equal(removalMode(productRemovalPreview(false)), 'ask')
    assert.equal(removalMode(productRemovalPreview(true)), 'ask', 'a held Sub-product rules out one answer, not the question')
  })

  it('is blocked for a Product that is held itself, and plain for a Product with no Sub-products', () => {
    assert.equal(removalMode(productRemovalPreview(false, { canDelete: false, blockedBy: [SOLD_BLOCK] })), 'blocked')
    assert.equal(removalMode(productRemovalPreview(false, { subProducts: [] })), 'confirm')
    assert.equal(removalMode(productRemovalPreview(false, { subProducts: [], canDelete: false, blockedBy: [SOLD_BLOCK] })), 'blocked')
  })
})

describe('the two answers a Product with Sub-products may be given', () => {
  it('allows both when nothing is held and there is another Product to move them to', () => {
    assert.deepEqual(choiceState(productRemovalPreview(false)), { moveAllowed: true, deleteAllowed: true })
  })

  it('rules out "delete them together" when a Sub-product is held, and keeps "move them"', () => {
    assert.deepEqual(choiceState(productRemovalPreview(true)), { moveAllowed: true, deleteAllowed: false })
  })

  it('weighs each half of "delete them together" on its own: the server\'s word for the whole group, and a held Sub-product', () => {
    assert.equal(choiceState(productRemovalPreview(true, { canDelete: true })).deleteAllowed, false, 'a held Sub-product rules it out even if the group says it can go')
    assert.equal(choiceState(productRemovalPreview(false, { canDelete: false })).deleteAllowed, false, 'the group says it cannot go, though no Sub-product is marked')
  })

  it('rules out "move them" when there is no other Product, and when the Product itself is held', () => {
    assert.equal(choiceState(productRemovalPreview(false, { targets: [] })).moveAllowed, false)
    assert.equal(choiceState(productRemovalPreview(false, { canDelete: false, blockedBy: [SOLD_BLOCK] })).moveAllowed, false)
  })
})

describe('when the confirm button may be pressed', () => {
  it('always for a plain confirmation, never for a blocked one', () => {
    assert.equal(canConfirmRemoval(removalPreview(), null, null), true)
    assert.equal(canConfirmRemoval(removalPreview({ canDelete: false, blockedBy: [SOLD_BLOCK] }), null, null), false)
    assert.equal(canConfirmRemoval(productRemovalPreview(false, { canDelete: false, blockedBy: [SOLD_BLOCK] }), 'delete', null), false, 'a held Product cannot be forced')
  })

  it('never lets a blocked record through, whatever answer is held (even one the server blocked without saying why)', () => {
    const blockedWithoutWhy = removalPreview({ canDelete: false, blockedBy: [] })
    assert.equal(removalMode(blockedWithoutWhy), 'blocked')
    assert.equal(canConfirmRemoval(blockedWithoutWhy, 'move', 1), false, 'a stale answer cannot unblock it')
    assert.equal(canConfirmRemoval(blockedWithoutWhy, 'delete', null), false)
  })

  it('needs an answer for a Product with Sub-products, and a Product to move to when the answer is "move"', () => {
    const asking = productRemovalPreview(false)
    assert.equal(canConfirmRemoval(asking, null, null), false, 'no answer')
    assert.equal(canConfirmRemoval(asking, 'move', null), false, 'move, but to nothing')
    assert.equal(canConfirmRemoval(asking, 'move', 9), true)
    assert.equal(canConfirmRemoval(asking, 'delete', null), true)
  })

  it('refuses a Product to move to that is not among the targets, and "delete them together" while a Sub-product is held', () => {
    assert.equal(canConfirmRemoval(productRemovalPreview(false), 'move', 1), false, 'the Product itself is not a target')
    assert.equal(canConfirmRemoval(productRemovalPreview(true), 'delete', null), false)
    assert.equal(canConfirmRemoval(productRemovalPreview(true), 'move', 9), true)
  })
})

describe('what is sent', () => {
  it('sends an empty body for a Sub-product and for a Product with no Sub-products', () => {
    assert.deepEqual(removeBodyFor(removalPreview(), null, null), {})
    assert.deepEqual(removeBodyFor(removalPreview(), 'delete', 9), {}, 'a Sub-product never carries an answer')
    assert.deepEqual(removeBodyFor(productRemovalPreview(false, { subProducts: [] }), 'delete', null), {})
  })

  it('sends the answer for a Product with Sub-products: move with the Product, or delete with nothing more', () => {
    const asking = productRemovalPreview(false)
    assert.deepEqual(removeBodyFor(asking, 'move', 9), { subProducts: 'move', toProductId: 9 })
    assert.deepEqual(removeBodyFor(asking, 'delete', 9), { subProducts: 'delete' }, 'a Product chosen earlier is not sent with "delete"')
    assert.deepEqual(removeBodyFor(asking, null, null), {})
  })
})

describe('what is said afterwards', () => {
  it('says a Sub-product was deleted, a Product and its Sub-products, and a Product whose Sub-products now sit elsewhere', () => {
    assert.equal(removedSentence('Fee module', { removed: [31] }, []), 'Deleted Fee module.')
    assert.equal(removedSentence('ScholarClone', { removed: [12, 31, 32] }, []), 'Deleted ScholarClone and 2 sub-products.')
    assert.equal(removedSentence('ScholarClone', { removed: [12, 31] }, []), 'Deleted ScholarClone and 1 sub-product.')
    assert.equal(removedSentence('ScholarClone', { removed: [12], moved: [31, 32], toProductId: 7 }, [{ id: 7, name: 'Enterprise Brain' }]), 'Deleted ScholarClone. 2 sub-products now sit under Enterprise Brain.')
    assert.equal(removedSentence('ScholarClone', { removed: [12], moved: [31], toProductId: 7 }, [{ id: 7, name: 'Enterprise Brain' }]), 'Deleted ScholarClone. 1 sub-product now sits under Enterprise Brain.')
  })

  it('says how many moved, and that the others were already there', () => {
    assert.equal(movedSentence({ moved: [31], unchanged: [], toProductId: 7 }, 'Enterprise Brain'), 'Moved 1 sub-product to Enterprise Brain.')
    assert.equal(movedSentence({ moved: [31, 32], unchanged: [], toProductId: 7 }, 'Enterprise Brain'), 'Moved 2 sub-products to Enterprise Brain.')
    assert.equal(movedSentence({ moved: [31], unchanged: [32], toProductId: 7 }, 'Enterprise Brain'), 'Moved 1 sub-product to Enterprise Brain. 1 was already there.')
    assert.equal(movedSentence({ moved: [], unchanged: [32], toProductId: 7 }, 'Enterprise Brain'), 'It was already under Enterprise Brain.')
    assert.equal(movedSentence({ moved: [], unchanged: [31, 32], toProductId: 7 }, 'Enterprise Brain'), 'They were already under Enterprise Brain.')
  })
})

describe('Move to another Product', () => {
  const targets = [{ id: 1, name: 'ScholarClone' }, { id: 7, name: 'Enterprise Brain' }]

  it('needs something to move and a Product from the list', () => {
    assert.equal(canConfirmMove([31], 7, targets), true)
    assert.equal(canConfirmMove([], 7, targets), false, 'nothing to move')
    assert.equal(canConfirmMove([31], null, targets), false, 'no Product chosen')
    assert.equal(canConfirmMove([31], 99, targets), false, 'a Product that is not in the list')
  })

  it('may be done on a Sub-product or an item of this organisation by a person who may change Sub-products, and never on a Product or a shared record', () => {
    const can = { editSubProduct: true }
    assert.equal(mayMoveRow({ kind: 'sub_product', shared: false }, can), true)
    assert.equal(mayMoveRow({ kind: 'item', shared: false }, can), true)
    assert.equal(mayMoveRow({ kind: 'product', shared: false }, can), false, 'a Product is not moved under another')
    assert.equal(mayMoveRow({ kind: 'sub_product', shared: true }, can), false)
    assert.equal(mayMoveRow({ kind: 'sub_product', shared: false }, { editSubProduct: false }), false)
  })

  it('is shown for ticked rows only when every one of them may be moved: a Product among them hides it, and so does nothing ticked', () => {
    const can = { editSubProduct: true }
    const sub = { kind: 'sub_product' as const, shared: false }
    const item = { kind: 'item' as const, shared: false }
    assert.equal(moveActionShown([sub, item], can), true)
    assert.equal(moveActionShown([sub, { kind: 'product', shared: false }], can), false, 'one Product ticked hides it')
    assert.equal(moveActionShown([], can), false)
    assert.equal(moveActionShown([sub], { editSubProduct: false }), false)
  })
})
