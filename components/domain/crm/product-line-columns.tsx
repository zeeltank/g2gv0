'use client'

import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import { TableCell, TableHead } from '@/components/ui/table'
import type { CrmIcpState, CrmProduct } from '@/types/crm'
import { icpLabel, icpTitle, icpTone } from './product-lines-model'

/** The state of an ideal-customer profile as a badge, or a dash when none applies to this record. */
export function IcpBadge({ state }: { state: CrmIcpState | null | undefined }) {
  const label = icpLabel(state)
  if (!label) return <span className="text-muted-foreground">—</span>
  return <StatusBadge variant={icpTone(state)} size="sm" title={icpTitle(state)}>{label}</StatusBadge>
}

/** The Signals found for a sub-product. A count of 0 is a real answer and is drawn as "0"; a dash means Signals does not look for this record. */
export function SignalsCount({ count }: { count: number | null | undefined }) {
  if (count === null || count === undefined) return <span className="text-muted-foreground" title="Signals does not look for this record.">—</span>
  return <span>{String(count)}</span>
}

/**
 * The three extra columns of the catalogue list: the product line an item belongs to, the Signals found for it and the state of its ICP. The list draws
 * them only when at least one item is tied to a sub-product (see showLineColumns), so a list with nothing to show has no empty columns.
 */
export function LineColumnHeads() {
  return (
    <>
      <TableHead>Product line</TableHead>
      <TableHead className="text-right">Signals</TableHead>
      <TableHead>ICP</TableHead>
    </>
  )
}

export function LineColumnCells({ product, lineHref }: { product: Pick<CrmProduct, 'productLine' | 'signalsFound' | 'icp'>; lineHref: (lineId: number) => string }) {
  const line = product.productLine
  return (
    <>
      <TableCell>
        {line
          // The row opens the item's page when clicked; the line's own link must not also trigger that.
          ? <Link href={lineHref(line.id)} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{line.name}</Link>
          : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right"><SignalsCount count={product.signalsFound} /></TableCell>
      <TableCell><IcpBadge state={product.icp} /></TableCell>
    </>
  )
}
