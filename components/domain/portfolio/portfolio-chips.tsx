'use client'

import { chipClass, readinessTone } from '@/lib/product-master/tones'
import { icpStateLabel, SELL_STATE_LABEL, type SellStateWord } from '@/lib/portfolio/page-model'
import type { PmIcpState } from '@/services/product-master/types'

/**
 * The state chips of the Portfolio pages. The WORD carries the meaning and the look is the product lines' own (`chipClass`: foreground text on a solid
 * surface, only the border takes the colour), so contrast holds in the light and the dark theme. A chip is never colour alone.
 */
export function SellChip({ word }: { word: SellStateWord }) {
  const tone = word === 'sold' ? 'success' : word === 'paused' ? 'pending' : 'inactive'
  return <span className={chipClass(tone)}>{SELL_STATE_LABEL[word]}</span>
}

export function ReadinessChip({ readiness }: { readiness: string | null | undefined }) {
  if (!readiness) return null
  return <span className={chipClass(readinessTone(readiness))}>{readiness}</span>
}

export function SignalsChip({ count }: { count: number | null | undefined }) {
  if (count === null || count === undefined) return null
  return <span className={chipClass('default')}>{count} {count === 1 ? 'signal' : 'signals'}</span>
}

export function IcpChip({ state }: { state: PmIcpState | null | undefined }) {
  if (!state) return <span className="text-muted-foreground">Not applicable</span>
  const tone = state === 'active' ? 'success' : state === 'draft' ? 'pending' : state === 'template' ? 'primary' : state === 'archived' ? 'inactive' : 'default'
  return <span className={chipClass(tone)}>{icpStateLabel(state)}</span>
}

export function ArchivedChip() {
  return <span className={chipClass('inactive')}>Archived</span>
}

export function SharedChip() {
  return <span className={chipClass('default')} title="A built-in product shared by every organisation. It cannot be changed here.">Shared, read only</span>
}
