'use client'

import { cn } from '@/lib/utils'
import type { CrmProductLines } from '@/types/crm'
import { SCOPE_LABELS, type ProductScope } from './product-lines-model'

const SCOPES: readonly ProductScope[] = ['catalogue', 'lines']

/**
 * "Catalogue | Product lines" on the Products screen: the catalogue is what the CRM sells (the list as it has always been), the product lines are the
 * groups Signals and the Portfolio know, with the sub-products inside them. Two buttons that act as a switch (`aria-pressed`), the same pattern the
 * agent library uses for its card and table views. The product lines button shows how many there are when that is known.
 */
export function ProductScopeSwitch({ scope, onChange, lines }: {
  scope: ProductScope
  onChange: (scope: ProductScope) => void
  lines?: Pick<CrmProductLines, 'productLines'> | null
}) {
  return (
    <div role="group" aria-label="What to list" className="inline-flex overflow-hidden rounded-lg border border-border">
      {SCOPES.map((value, index) => {
        const active = scope === value
        const count = value === 'lines' && lines && lines.productLines > 0 ? lines.productLines : null
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => { if (!active) onChange(value) }}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              index > 0 && 'border-l border-border',
              active ? 'bg-primary/10 text-primary' : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {SCOPE_LABELS[value]}
            {count !== null && <span className="rounded-full bg-muted px-1.5 text-xs font-normal text-muted-foreground">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
