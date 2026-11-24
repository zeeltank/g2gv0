import type { PmRemovalBlock, PmRemovalPreview, PmRemovalSub, PmRemovalTarget, PmRemoveBody, PmRemoveResult, PmMoveResult } from '../../services/product-master/record-types'

/*
 * The rules of deleting and moving a Product or a Sub-product (S15 follow-up, contract D-4 to D-6), as plain functions: what blocks a delete, which of the two
 * answers a Product with Sub-products may be given, when the confirm button is allowed, what is sent, and the sentence that says what happened. No React and no
 * network, so each rule is pinned by lib/portfolio/removal-model.test.ts and a mutation of it fails a named test.
 */

/** The block that says "a Sub-product under this Product is held": it belongs to the Sub-product rows, not to the Product itself. */
export const SUB_PRODUCTS_BLOCK = 'has_sub_products_blocked'

/** What the Product dialog asks of a Product that has Sub-products. */
export type SubProductsChoice = 'move' | 'delete'

/** What the record's own blockers are, leaving out "a Sub-product under it is held" (the Sub-product rows say which). */
export function ownBlockers(preview: Pick<PmRemovalPreview, 'blockedBy'>): PmRemovalBlock[] {
  return preview.blockedBy.filter((block) => block.code !== SUB_PRODUCTS_BLOCK)
}

/** The Sub-products that cannot be deleted, by the server's own word. */
export function blockedSubProducts(preview: Pick<PmRemovalPreview, 'subProducts'>): PmRemovalSub[] {
  return preview.subProducts.filter((sub) => !sub.canDelete)
}

/** One plain sentence per blocker, as the server wrote them; a blocker with no sentence still says how many things hold the record. */
export function blockerSentences(blocks: readonly PmRemovalBlock[]): string[] {
  return blocks.map((block) => {
    const message = (block.message ?? '').trim()
    if (message !== '') return message
    return block.count === 1 ? '1 other record holds it.' : `${block.count} other records hold it.`
  })
}

/**
 * Which dialog a delete needs:
 *  - `confirm`: nothing blocks it and there is no choice to make (a Sub-product, or a Product with none);
 *  - `ask`: a Product with Sub-products that is not itself held: the person chooses what happens to them, each time;
 *  - `blocked`: something holds the record, so it cannot be deleted; the dialog says what and offers Archive instead.
 */
export type RemovalMode = 'confirm' | 'ask' | 'blocked'

export function removalMode(preview: Pick<PmRemovalPreview, 'kind' | 'canDelete' | 'blockedBy' | 'subProducts'>): RemovalMode {
  if (preview.kind !== 'product' || preview.subProducts.length === 0) return preview.canDelete ? 'confirm' : 'blocked'
  return ownBlockers(preview).length > 0 ? 'blocked' : 'ask'
}

export interface ChoiceState {
  /** The Sub-products can be moved to another Product first: the Product itself is not held and there is a Product to move them to. */
  moveAllowed: boolean
  /** The Sub-products can be deleted together with the Product: the server says the whole group can go. */
  deleteAllowed: boolean
}

/** Which of the two answers a Product with Sub-products may be given. A blocked Sub-product rules out "delete them together" and not "move them". */
export function choiceState(preview: Pick<PmRemovalPreview, 'canDelete' | 'blockedBy' | 'subProducts' | 'targets'>): ChoiceState {
  return {
    moveAllowed: ownBlockers(preview).length === 0 && preview.targets.length > 0,
    deleteAllowed: preview.canDelete && blockedSubProducts(preview).length === 0,
  }
}

/** Whether the confirm button may be pressed: never while the question is `blocked`, always for a plain `confirm`, and for `ask` only on a valid answer. */
export function canConfirmRemoval(preview: PmRemovalPreview, choice: SubProductsChoice | null, targetId: number | null): boolean {
  const mode = removalMode(preview)
  if (mode === 'blocked') return false
  if (mode === 'confirm') return true
  const state = choiceState(preview)
  if (choice === 'delete') return state.deleteAllowed
  if (choice === 'move') return state.moveAllowed && targetId !== null && preview.targets.some((target) => target.id === targetId)
  return false
}

/** The body of the delete: empty unless a Product with Sub-products is asked, in which case it carries the answer. */
export function removeBodyFor(preview: Pick<PmRemovalPreview, 'kind' | 'subProducts'>, choice: SubProductsChoice | null, targetId: number | null): PmRemoveBody {
  if (preview.kind !== 'product' || preview.subProducts.length === 0) return {}
  if (choice === 'move' && targetId !== null) return { subProducts: 'move', toProductId: targetId }
  if (choice === 'delete') return { subProducts: 'delete' }
  return {}
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** What the screen says after a delete. */
export function removedSentence(name: string, result: PmRemoveResult, targets: readonly PmRemovalTarget[]): string {
  const moved = result.moved?.length ?? 0
  const gone = Math.max(0, result.removed.length - 1)
  if (moved > 0) {
    const where = targets.find((target) => target.id === result.toProductId)?.name
    return `Deleted ${name}. ${plural(moved, 'sub-product now sits', 'sub-products now sit')} ${where ? `under ${where}` : 'under the other Product'}.`
  }
  return gone > 0 ? `Deleted ${name} and ${plural(gone, 'sub-product', 'sub-products')}.` : `Deleted ${name}.`
}

/** What the screen says after a move. */
export function movedSentence(result: PmMoveResult, targetName: string): string {
  const moved = result.moved.length
  const unchanged = result.unchanged.length
  if (moved === 0 && unchanged > 0) return unchanged === 1 ? `It was already under ${targetName}.` : `They were already under ${targetName}.`
  const head = `Moved ${plural(moved, 'sub-product', 'sub-products')} to ${targetName}.`
  return unchanged > 0 ? `${head} ${plural(unchanged, 'was', 'were')} already there.` : head
}

/** Whether the Move dialog may be confirmed: something to move and a Product, from the list, to move it to. */
export function canConfirmMove(ids: readonly number[], targetId: number | null, targets: readonly PmRemovalTarget[]): boolean {
  return ids.length > 0 && targetId !== null && targets.some((target) => target.id === targetId)
}

/** The row of the list a bulk move may touch: a Sub-product or an item, the organisation's own, and only for a person who may change Sub-products. */
export interface MoveCandidate {
  kind: 'product' | 'sub_product' | 'item'
  shared: boolean
}

export function mayMoveRow(row: MoveCandidate, can: { editSubProduct: boolean }): boolean {
  return row.kind !== 'product' && !row.shared && can.editSubProduct
}

/** The bulk "Move to another Product": there is something ticked, and every ticked row may be moved. A Product among them hides the action. */
export function moveActionShown(rows: readonly MoveCandidate[], can: { editSubProduct: boolean }): boolean {
  return rows.length > 0 && rows.every((row) => mayMoveRow(row, can))
}
