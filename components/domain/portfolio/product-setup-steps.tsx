import Link from 'next/link'
import { ArrowRight, CheckCircle2, Circle, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProductInfo } from '@/services/portfolio/types'

type StepState = 'done' | 'todo' | 'problem'

/** The path from a product's configuration to its signals, with each step's real state read from what is stored for the product. */
export function setupSteps(product: ProductInfo): { key: string; title: string; detail: string; state: StepState; optional?: boolean }[] {
  const icpState: StepState = product.state === 'ready' ? 'done' : product.state === 'invalid' ? 'problem' : 'todo'

  return [
    {
      key: 'offers', title: 'Offers', state: product.offers.length > 0 ? 'done' : 'todo',
      detail: product.offers.length > 0 ? `${product.offers.length} offer${product.offers.length === 1 ? '' : 's'} in the portfolio` : 'No offers stored for this product yet',
    },
    {
      key: 'icp', title: 'Ideal customer profile', state: icpState,
      detail: icpState === 'done' ? 'Active and valid' : icpState === 'problem' ? 'A saved ICP fails validation: fix it below' : product.draft_icp ? 'Saved but not active: activate it below' : 'Not configured: fill it in below, then activate',
    },
    {
      key: 'accounts', title: 'Target accounts', state: product.target_accounts > 0 ? 'done' : 'todo', optional: true,
      detail: product.target_accounts > 0 ? `${product.target_accounts} loaded (${product.contacts} with a contact name)` : 'None loaded: research then uses general web searches only',
    },
    {
      key: 'generate', title: 'Generate signals', state: product.ready ? 'done' : 'todo',
      detail: product.ready ? 'Ready. Start research from Company Opportunities' : 'Available once the ICP is active',
    },
  ]
}

export function ProductSetupSteps({ product }: { product: ProductInfo }) {
  const steps = setupSteps(product)

  return (
    <section aria-label={`${product.label} setup`} className="premium-card rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Setup for {product.label}</h2>
          <p className="text-xs text-muted-foreground">Each product is set up on its own. Nothing is copied from another product.</p>
        </div>
        <Button asChild size="sm" variant={product.ready ? 'default' : 'outline'} disabled={!product.ready}>
          <Link href={`/signals?product=${encodeURIComponent(product.key)}`} aria-disabled={!product.ready} tabIndex={product.ready ? undefined : -1}>
            Go to Company Opportunities <ArrowRight className="ml-1.5 size-4" />
          </Link>
        </Button>
      </div>
      <ol className="mt-4 grid gap-3 @xl:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.key} className="flex gap-2.5 rounded-lg bg-muted/40 p-3">
            <span className="mt-0.5 shrink-0" aria-hidden="true">
              {s.state === 'done' ? <CheckCircle2 className="size-4 text-emerald-600" /> : s.state === 'problem' ? <TriangleAlert className="size-4 text-destructive" /> : <Circle className="size-4 text-muted-foreground" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{i + 1}. {s.title}{s.optional && <span className="ml-1 text-xs font-normal text-muted-foreground">(recommended)</span>}</p>
              <p className="text-xs text-muted-foreground">{s.detail}</p>
              <span className="sr-only">{s.state === 'done' ? 'Complete' : s.state === 'problem' ? 'Needs attention' : 'Not done yet'}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
