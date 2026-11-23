'use client'

import { ICP_WORD, icpTone, readinessTone, STATE_WORD, stateTone } from '@/lib/portfolio-list/model'
import { chipClass } from '@/lib/portfolio-list/tones'
import type { PortfolioIcpState, PortfolioSellState } from '@/services/product-master/portfolio-list-types'

/**
 * The chips of the Product Portfolio list. The WORD carries the meaning and the look is the product lines' own (foreground text on a solid surface, only the
 * border takes the colour), so contrast holds in the light and the dark theme. A chip is never colour alone.
 */
export function StateChip({ state }: { state: PortfolioSellState }) {
  return <span className={chipClass(stateTone(state))}>{STATE_WORD[state]}</span>
}

export function ReadinessChip({ readiness }: { readiness: string | null | undefined }) {
  if (!readiness) return <span className="text-muted-foreground">Not described</span>
  return <span className={chipClass(readinessTone(readiness))}>{readiness}</span>
}

export function IcpChip({ state }: { state: PortfolioIcpState | null | undefined }) {
  if (!state) return <span className="text-muted-foreground">Not applicable</span>
  return <span className={chipClass(icpTone(state))}>{ICP_WORD[state]}</span>
}

export function ProductChip() {
  return <span className={chipClass('default')}>Product</span>
}

/** Drawn beside the name of a Service (a Sub-product of type Service): every other Sub-product needs no label, it sits under its Product. */
export function ServiceChip() {
  return <span className={chipClass('default')}>Service</span>
}

export function ArchivedChip() {
  return <span className={chipClass('inactive')}>Archived</span>
}

export function SharedChip() {
  return <span className={chipClass('default')} title="A built-in product shared by every organisation. It cannot be changed here.">Shared, read only</span>
}
