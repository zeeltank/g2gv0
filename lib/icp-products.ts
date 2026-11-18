import type { IcpComparisonResult } from '@/services/signals/product-icp'

/*
 * The ICP's list of portfolio products and how the comparison is worded. Pure functions (no React) so they can be tested.
 * The list is the person's own: nothing is added for them, and "none chosen" is a choice that is kept.
 */

/** Adds one Offer ID (once). Never reorders what the person already chose. */
export const addProduct = (list: string[], id: string): string[] => (list.includes(id) || id.trim() === '' ? list : [...list, id])

export const removeProduct = (list: string[], id: string): string[] => list.filter((x) => x !== id)

/** The portfolio products still available to pick: those not already chosen. */
export const notChosen = <T extends { offer_id: string }>(offers: T[], chosen: string[]): T[] => offers.filter((o) => !chosen.includes(o.offer_id))

/** What a result's score reads as. A missing score is "Insufficient data", never a number. */
export function scoreLabel(r: Pick<IcpComparisonResult, 'status' | 'score'>): string {
  return r.status === 'scored' && r.score !== null ? `${r.score}% match` : 'Insufficient data'
}

export type ScoreTone = 'strong' | 'partial' | 'weak' | 'unknown'

/** Strong from 70, partial from 40, otherwise weak. Unknown when there is no score. */
export function scoreTone(score: number | null): ScoreTone {
  if (score === null) return 'unknown'
  if (score >= 70) return 'strong'
  if (score >= 40) return 'partial'

  return 'weak'
}

/** One line saying what the comparison is of, and what it is not. */
export function comparisonScope(args: { saved: boolean; dirty: boolean; count: number }): string {
  if (!args.saved) return 'No ICP is saved for this product yet, so the comparison uses its built-in definition. Save your ICP to compare against it.'
  if (args.dirty) return 'You have unsaved ICP changes. The comparison uses the saved ICP, not these edits.'
  if (args.count === 0) return 'Choose one or more products above to compare them with this ICP.'

  return 'Compared with the saved ICP. No AI is used: every number comes from words in the ICP and the product record.'
}
