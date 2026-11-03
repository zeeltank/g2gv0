'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { configureHref, icpHref } from '@/lib/product-selection'
import type { PmRecord, PmUsage } from '@/services/product-master/types'
import { IcpBadge } from './product-line-columns'
import { icpTitle, signalsHref } from './product-lines-model'
import { ProductOfferAbout } from './product-offer-about'
import { ReadinessBadge } from './product-master-parts'

/**
 * "Signals & ICP": what Signals found for a product line or a sub-product, and the state of its ideal-customer profile, with the way to each. On a
 * catalogue item's page (`withOffer`) it also gives the sub-product's identity and its About text, because that page has no Overview of its own.
 *
 * Read-only. The ICP's state is shown here and its content is edited in the Portfolio, behind the Portfolio's own rights, so this tab can never show
 * or change more than the person may already see there.
 */
export function ProductSignalsIcpTab({ record, usage, usageError, withOffer = false, onEdit, lineHref }: {
  record: PmRecord
  usage: PmUsage | null
  usageError: string
  withOffer?: boolean
  /** Opens the form for the sub-product's own details; left out when this person may not edit them. */
  onEdit?: () => void
  /** The page of a product line. */
  lineHref: (masterId: number) => string
}) {
  const isLine = record.kind === 'product'
  const lineKey = isLine ? record.key : record.parent?.key ?? null
  const offerId = record.offer?.offerId ?? null
  const signalsLink = signalsHref(lineKey, isLine ? null : offerId)
  const portfolioLink = lineKey ? (isLine ? icpHref(lineKey) : `${configureHref(lineKey)}?tab=offers`) : '/portfolio'

  return (
    <div className="space-y-4">
      {withOffer && (
        <SectionCard
          title={isLine ? 'Product line' : 'Product line and sub-product'}
          description="Saved in the Product Master and the Portfolio."
          actions={onEdit ? <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1.5 size-4" aria-hidden="true" />Edit sub-product details</Button> : undefined}
        >
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ReadField
              label="Product line"
              value={isLine ? record.name : record.parent && <Link href={lineHref(record.parent.id)} className="text-primary hover:underline">{record.parent.name}</Link>}
            />
            <ReadField label="Sub-product ID" value={record.offer && <span className="font-mono text-xs">{record.offer.offerId}</span>} />
            <ReadField
              label="Readiness"
              value={record.offer && (
                <span className="flex flex-wrap items-center gap-2">
                  <ReadinessBadge readiness={record.offer.readiness} />
                  <span className="text-xs font-normal text-muted-foreground">{record.offer.readinessConfirmed ? 'Confirmed by a person' : 'Not confirmed yet'}</span>
                </span>
              )}
            />
          </dl>
        </SectionCard>
      )}

      {usageError
        ? <p role="alert" className="text-sm text-destructive">{usageError}</p>
        : usage === null
          ? <p role="status" className="text-sm text-muted-foreground">Loading…</p>
          : (
            <>
              <SectionCard title="Signals" description={isLine ? 'Companies Signals found for this product line.' : 'Companies Signals found where this sub-product is the best match.'}>
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Counts go in as text: ReadField shows a dash for any falsy value, and a count of 0 is a real answer. */}
                  <ReadField
                    label="Signals found"
                    value={usage.signals === null
                      ? <span className="font-normal text-muted-foreground">Not counted: Signals has no value for this.</span>
                      : (
                        <span className="flex flex-wrap items-center gap-3">
                          <span>{String(usage.signals)}</span>
                          {signalsLink && <Link href={signalsLink} className="text-sm font-normal text-primary hover:underline">See these signals</Link>}
                        </span>
                      )}
                  />
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">
                  {isLine
                    ? 'A product line counts every signal recorded under it, so its count is not the sum of its sub-products.'
                    : 'A sub-product counts the signals whose best-matching offer it is. The product line counts every signal recorded under it.'}
                </p>
              </SectionCard>

              <SectionCard title="Ideal customer (ICP)" description="Who this is for, as Signals uses it to score companies.">
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadField
                    label="State"
                    value={usage.icp === null
                      ? <span className="font-normal text-muted-foreground">No ideal-customer profile applies to this.</span>
                      : (
                        <span className="flex flex-wrap items-center gap-2">
                          <IcpBadge state={usage.icp} />
                          <span className="text-xs font-normal text-muted-foreground">{icpTitle(usage.icp)}</span>
                        </span>
                      )}
                  />
                </dl>
                {usage.icp !== null && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    The profile itself is edited in the Portfolio:{' '}
                    <Link href={portfolioLink} className="text-primary underline underline-offset-2">open it there</Link>.
                  </p>
                )}
              </SectionCard>
            </>
          )}

      {withOffer && !isLine && <ProductOfferAbout offer={record.offer} lineKey={lineKey} />}
    </div>
  )
}
