'use client'

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ProductInfo } from '@/services/portfolio/types'

const list = (v: string[] | null | undefined) => (v && v.length > 0 ? v.join(', ') : null)

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[11rem_1fr]">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  )
}

const NOT_SET = <span className="text-muted-foreground">Not configured</span>

/**
 * What is stored for one product: its offers (capabilities and use cases), its ICP (who buys it, where, on which events), the accounts and
 * contacts loaded for it, and what is still missing. Everything shown is read from the stored records; a missing value says so rather
 * than being filled in. Pricing appears only where a price was actually saved.
 */
export function ProductProfilePanel({ product }: { product: ProductInfo }) {
  const priced = product.offers.filter((o) => o.pricing_model || o.typical_deal_band)

  return (
    <section aria-label={`${product.label} configuration`} className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{product.label}</h2>
          <p className="text-xs text-muted-foreground">Portfolio name: {product.portfolio_name ?? 'none'} · {product.offers.length} offer{product.offers.length === 1 ? '' : 's'}</p>
        </div>
        {product.state === 'ready' && <Badge variant="success" className="gap-1"><CheckCircle2 className="size-3" /> Ready for discovery</Badge>}
        {product.state === 'needs_setup' && <Badge variant="warning" className="gap-1"><AlertTriangle className="size-3" /> Needs setup</Badge>}
        {product.state === 'invalid' && <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" /> Invalid configuration</Badge>}
      </div>

      {!product.ready && (
        <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">Still to configure before discovery can run for {product.label}:</p>
          <ul className="mt-1 list-disc pl-5">{product.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          {product.next_step && <p className="mt-1 font-medium">Next: {product.next_step}</p>}
        </div>
      )}

      <dl className="divide-y divide-border/60">
        <Row label="Ideal customer">{product.icp?.ideal_customer ?? NOT_SET}</Row>
        <Row label="Pitch">{product.icp?.pitch ?? NOT_SET}</Row>
        <Row label="Buyer types">{list(product.icp?.buyer_types) ?? NOT_SET}</Row>
        <Row label="Target geography">{list(product.icp?.regions) ?? NOT_SET}</Row>
        <Row label="Buying events">{list(product.icp?.triggers) ?? NOT_SET}</Row>
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

      <div>
        <h3 className="text-sm font-semibold text-foreground">Capabilities and use cases</h3>
        {product.offers.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No offers are stored for this product in the Product Portfolio.</p>
        ) : (
          <ul className="mt-2 grid gap-2 @3xl:grid-cols-2">
            {product.offers.map((o) => (
              <li key={o.id} className="rounded-lg bg-muted/40 p-3">
                <p className="text-sm font-medium text-foreground">{o.name} <span className="font-normal text-muted-foreground">· {o.offer_id}</span></p>
                {o.what_it_does && <p className="mt-0.5 text-sm text-muted-foreground">{o.what_it_does}</p>}
                {list(o.needs_solved) && <p className="mt-1 text-xs text-muted-foreground">Solves: {list(o.needs_solved)}</p>}
                {list(o.primary_segments) && <p className="text-xs text-muted-foreground">For: {list(o.primary_segments)}</p>}
                {o.readiness_status && <Badge variant="muted" className="mt-1.5">{o.readiness_status}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
