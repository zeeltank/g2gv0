'use client'

import { StatusBadge } from '@/components/ui/status-badge'
import { readinessTone } from './product-master-model'

/** A readiness state drawn in its colour, or a dash when there is none. */
export function ReadinessBadge({ readiness }: { readiness: string | null | undefined }) {
  if (!readiness) return <span className="text-muted-foreground">—</span>
  return <StatusBadge variant={readinessTone(readiness)} size="sm">{readiness}</StatusBadge>
}

/** Whether a sub-product also has an item in the CRM catalogue, so a quote can include it. */
export function SoldBadge({ sold }: { sold: boolean }) {
  return sold
    ? <StatusBadge variant="success" size="sm">Sold</StatusBadge>
    : <span className="text-muted-foreground">Not set up</span>
}

/** Shown beside a record that is no longer in use. */
export function ArchivedBadge() {
  return <StatusBadge variant="inactive" size="sm">Archived</StatusBadge>
}

/** Shown beside a built-in product that every organisation shares and nobody edits here. */
export function SharedBadge() {
  return <StatusBadge variant="default" size="sm" title="A built-in product shared by every organisation. It cannot be changed here.">Shared</StatusBadge>
}
