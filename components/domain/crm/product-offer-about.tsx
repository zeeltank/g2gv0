'use client'

import Link from 'next/link'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { configureHref } from '@/lib/product-selection'
import type { PmOffer } from '@/services/product-master/types'

function Chips({ items, empty = '—' }: { items: readonly string[]; empty?: string }) {
  if (items.length === 0) return <span className="text-muted-foreground">{empty}</span>
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => <li key={item} className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground">{item}</li>)}
    </ul>
  )
}

/**
 * What the Portfolio says about a sub-product: what it does, the customer problems it solves, who it is for and the buying events that point to it.
 * Read-only: the text is kept in the Portfolio, and Signals reads it to match companies to the sub-product. `lineKey` is the product line's key, for the link to the
 * Portfolio's own page of that line, where who it is for and the buying events are edited.
 */
export function ProductOfferAbout({ offer, lineKey }: { offer: PmOffer | null | undefined; lineKey?: string | null }) {
  const about = offer?.about
  return (
    <SectionCard title="About" description="Kept in the Portfolio. Signals reads it to match companies to this sub-product.">
      {about ? (
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><ReadField label="What it does" value={about.whatItDoes && <span className="whitespace-pre-line font-normal">{about.whatItDoes}</span>} /></div>
          <div className="sm:col-span-2">
            <ReadField
              label="Customer problems it solves"
              value={about.needsSolved.length > 0
                ? <ul className="list-disc space-y-0.5 pl-5 font-normal">{about.needsSolved.map((problem) => <li key={problem}>{problem}</li>)}</ul>
                : null}
            />
          </div>
          <ReadField label="Who it is for" value={<Chips items={about.primarySegments} />} />
          <ReadField label="Buying events that point to it" value={<Chips items={about.triggerSignals} />} />
          <ReadField label="Features and capabilities" value={about.modulesComponents && <span className="whitespace-pre-line font-normal">{about.modulesComponents}</span>} />
          <ReadField label="Deployment" value={about.deploymentModel} />
          <ReadField label="Benefits and proof" value={about.proofPoints && <span className="whitespace-pre-line font-normal">{about.proofPoints}</span>} />
          <ReadField label="Notes" value={about.notes && <span className="whitespace-pre-line font-normal">{about.notes}</span>} />
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">There is no Portfolio offer of your own behind this record to show.</p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        The ideal-customer profile is kept where it is today:{' '}
        <Link href={lineKey ? `${configureHref(lineKey)}?tab=offers` : '/portfolio'} className="text-primary underline underline-offset-2">open the Portfolio</Link>.
      </p>
    </SectionCard>
  )
}
