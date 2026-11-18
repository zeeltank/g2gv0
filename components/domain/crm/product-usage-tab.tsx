'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import type { PmKind, PmUsage } from '@/services/product-master/types'
import { formatPrice } from './product-master-model'

/**
 * "Usage": where a record is used. The signals recorded for it, the quotes that include it and the price books that list it (a quote is priced from a
 * price book, and the base price is only the fallback). Read-only: prices are edited in Price Books. A product line or a sub-product that is not in the CRM
 * catalogue has no quotes or price books, and says so.
 */
export function ProductUsageTab({ usage, error, inCatalogue, kind, priceBooksHref }: {
  usage: PmUsage | null
  error: string
  /** The record has an item in the CRM catalogue (a catalogue item's own page always does). */
  inCatalogue: boolean
  kind: PmKind
  priceBooksHref: string
}) {
  if (error) return <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>
  if (!usage) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  const notInCatalogue = <span className="font-normal text-muted-foreground">Not in the CRM catalogue</span>
  const signalsNote = kind === 'item' ? 'Not counted: a catalogue item is not looked for in signals.' : 'Not counted: Signals has no value for this.'

  return (
    <div className="space-y-4">
      <SectionCard title="Where it is used">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Counts go in as text: ReadField shows a dash for any falsy value, and a count of 0 is a real answer. */}
          <ReadField label="Signals found" value={usage.signals === null ? <span className="font-normal text-muted-foreground">{signalsNote}</span> : String(usage.signals)} />
          <ReadField label="Quotes that include it" value={inCatalogue ? String(usage.quotes) : notInCatalogue} />
          <ReadField label="Price books" value={inCatalogue ? String(usage.priceBooks.length) : notInCatalogue} />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          {kind === 'sub_product'
            ? 'Signals are counted where the best-matching offer is this sub-product. The product line counts every signal recorded under it.'
            : kind === 'product'
              ? 'Signals are recorded under a product line.'
              : 'A quote line is priced from a price book. The base price is used only when a price book has no price for the item.'}
        </p>
      </SectionCard>

      {!inCatalogue && (
        <EmptyState
          title="Not in the CRM catalogue"
          description="Only an item in the catalogue can be in a price book or on a quote. Sell it in the CRM first."
        />
      )}

      {inCatalogue && usage.priceBooks.length === 0 && (
        <EmptyState
          title="Not in any price book yet"
          description={`Add it to a price book to give it a quotable price. Until then a quote line uses the base price${usage.basePrice === null ? ', which is empty' : `, ${formatPrice(usage.basePrice, usage.currency)}`}.`}
          action={<Button variant="outline" asChild><Link href={priceBooksHref}>Open Price Books</Link></Button>}
        />
      )}

      {inCatalogue && usage.priceBooks.length > 0 && (
        <SectionCard
          title="Price books"
          description="A quote is priced from the price book it uses. Prices are edited in Price Books, not here."
          actions={<Button variant="outline" size="sm" asChild><Link href={priceBooksHref}>Open Price Books</Link></Button>}
        >
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Price book</TableHead><TableHead>Number</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {usage.priceBooks.map((book) => (
                  <TableRow key={book.priceBookId}>
                    <TableCell className="font-medium">{book.name}</TableCell>
                    <TableCell className="font-mono text-xs">{book.priceBookNo ?? '—'}</TableCell>
                    <TableCell>{book.active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell className="text-right">{formatPrice(book.listPrice, book.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
