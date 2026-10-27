'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { LaravelContext } from '@/lib/laravel-context'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type { ProductOffer } from '@/services/portfolio/types'
import { IcpStatusBadge } from './icp-status-badge'
import type { ProductInfo } from '@/services/portfolio/types'

const list = (v: string[] | null | undefined) => (v && v.length > 0 ? v.join(', ') : null)

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[10rem_1fr]">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  )
}

const NOT_SET = <span className="text-muted-foreground">Not configured</span>

/**
 * What is stored for one product, in brief: who buys it, the buyers, where and on which events. The rest (accounts, pricing, history) sits in a
 * collapsed section. Everything is read from the stored records; a missing value says so rather than being filled in.
 */
export function ProductProfilePanel({ product }: { product: ProductInfo }) {
  const priced = product.offers.filter((o) => o.pricing_model || o.typical_deal_band)

  return (
    <section aria-label={`${product.label} summary`} className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm @xl:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Customer and buyer summary</h2>
        <IcpStatusBadge product={product} />
      </div>

      <dl className="divide-y divide-border/60">
        <Row label="Ideal customer">{product.icp?.ideal_customer ?? NOT_SET}</Row>
        <Row label="Buyer types">{list(product.icp?.buyer_types) ?? NOT_SET}</Row>
        <Row label="Target geography">{list(product.icp?.regions) ?? NOT_SET}</Row>
        <Row label="Buying events">{list(product.icp?.triggers) ?? NOT_SET}</Row>
      </dl>

      <details className="group rounded-lg border border-border/60 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">More details</summary>
        <dl className="mt-2 divide-y divide-border/60">
          <Row label="Pitch">{product.icp?.pitch ?? NOT_SET}</Row>
          <Row label="ICP source">
            {product.icp
              ? product.icp.source === 'database' ? `Saved ICP${product.icp.profile_id ? ` #${product.icp.profile_id}` : ''} (${product.icp.name})` : 'Built-in definition (no saved ICP yet)'
              : NOT_SET}
          </Row>
          <Row label="Target accounts">{product.target_accounts > 0 ? product.target_accounts : NOT_SET}</Row>
          <Row label="Contacts on accounts">{product.contacts > 0 ? product.contacts : NOT_SET}</Row>
          <Row label="Found so far">{product.opportunities_count} opportunities · {product.research_runs_count} research runs</Row>
          <Row label="Pricing">
            {priced.length === 0 ? <span className="text-muted-foreground">No price stored</span> : (
              <ul className="space-y-0.5">{priced.map((o) => <li key={o.id}>{o.name}: {[o.pricing_model, o.typical_deal_band].filter(Boolean).join(' · ')}</li>)}</ul>
            )}
          </Row>
        </dl>
      </details>
    </section>
  )
}

/** One labelled value of an offer; a field with nothing stored says so instead of being left out. */
function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[11rem_1fr]">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 whitespace-pre-line break-words text-sm text-foreground">{value && value.trim() !== '' ? value : <span className="text-muted-foreground">Not recorded</span>}</dd>
    </div>
  )
}

/** Every stored detail of one offer, read from the Product Portfolio when the offer is opened (the product list only carries a summary). */
function OfferDetails({ context, offer }: { context: LaravelContext; offer: ProductInfo['offers'][number] }) {
  const [full, setFull] = useState<ProductOffer | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    portfolioService.getOffer(context, offer.id)
      .then((res) => { if (live) setFull(res.data) })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : 'Could not load this offer.') })
    return () => { live = false }
  }, [context, offer.id])

  if (error) return <p role="alert" className="px-4 py-3 text-sm text-destructive">{error}</p>
  if (!full) return <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>

  return (
    <dl className="space-y-2 border-t border-border/60 px-4 py-3">
      <Fact label="Description" value={full.what_it_does} />
      <Fact label="Category" value={full.parent_product} />
      <Fact label="Status" value={full.readiness_status} />
      <Fact label="Features and capabilities" value={full.modules_components} />
      <Fact label="Customer problems solved" value={list(full.needs_solved ?? null)} />
      <Fact label="Target customers" value={list(full.primary_segments ?? null)} />
      <Fact label="Buying events" value={list(full.trigger_signals ?? null)} />
      <Fact label="Benefits and proof" value={full.proof_points} />
      <Fact label="Pricing model" value={full.pricing_model} />
      <Fact label="Typical deal size" value={full.typical_deal_band} />
      <Fact label="Deployment" value={full.deployment_model} />
      <Fact label="Implementation effort" value={full.implementation_effort} />
      <Fact label="Delivery owner" value={full.delivery_owner} />
      <Fact label="Notes" value={full.notes} />
    </dl>
  )
}

/** The product's offers, one line each; every stored detail opens only when asked for. */
export function ProductOffersList({ context, product }: { context: LaravelContext; product: ProductInfo }) {
  if (product.offers.length === 0) {
    return <p className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">No offers are stored for this product in the Product Portfolio.</p>
  }

  return (
    <ul className="space-y-2" aria-label={`${product.label} offers`}>
      {product.offers.map((o) => (
        <li key={o.id} className="rounded-xl border border-border/60 bg-card shadow-sm">
          <OfferRow context={context} offer={o} />
        </li>
      ))}
    </ul>
  )
}

function OfferRow({ context, offer }: { context: LaravelContext; offer: ProductInfo['offers'][number] }) {
  const [open, setOpen] = useState(false)

  return (
    <details onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 text-sm font-medium text-foreground">{offer.name} <span className="font-normal text-muted-foreground">· {offer.offer_id}</span></span>
        {offer.readiness_status && <Badge variant="muted">{offer.readiness_status}</Badge>}
      </summary>
      {open && <OfferDetails context={context} offer={offer} />}
    </details>
  )
}
