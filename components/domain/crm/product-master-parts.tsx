'use client'

import { chipClass } from '@/lib/product-master/tones'
import { readinessTone } from './product-master-model'

/** A readiness state drawn in its colour, or a dash when there is none. */
export function ReadinessBadge({ readiness }: { readiness: string | null | undefined }) {
  if (!readiness) return <span className="text-muted-foreground">—</span>
  return <span className={chipClass(readinessTone(readiness))}>{readiness}</span>
}

/** Whether a sub-product also has an item in the CRM catalogue, so a quote can include it. */
export function SoldBadge({ sold }: { sold: boolean }) {
  return sold
    ? <span className={chipClass('success')}>Sold</span>
    : <span className="text-muted-foreground">Not set up</span>
}

/** Shown beside a record that is no longer in use. */
export function ArchivedBadge() {
  return <span className={chipClass('inactive')}>Archived</span>
}

/** Shown beside a built-in product that every organisation shares and nobody edits here. */
export function SharedBadge() {
  return <span className={chipClass('default')} title="A built-in product shared by every organisation. It cannot be changed here.">Shared</span>
}
