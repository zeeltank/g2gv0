import { Money } from '@/components/domain/portfolio/currency-badge'
import { notAddedSentence, suggestedValue } from '@/lib/crm/suggested-value'
import type { CrmOpportunityProduct } from '@/types/crm'

/**
 * The read-only SUGGESTED VALUE under an opportunity's Sub-products (S16, 25 Nov 2026): quantity x price of the rows priced in the opportunity's own currency, with the
 * rows that were not added listed under it (lib/crm/suggested-value.ts holds the rule and why). A suggestion only: it has no button, no field and no call, so it can never
 * change the opportunity's Amount; the person types that. Nothing is drawn for a viewer whose answer carries no prices.
 */
export function OpportunitySuggestedValue({ currency, rows }: { currency: string | null; rows: CrmOpportunityProduct[] }) {
  const value = suggestedValue(currency, rows)
  if (value.state === 'hidden') return null

  return (
    <section data-suggested-value className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3" aria-label="Suggested value">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Suggested value</h3>
        {value.state === 'ready' && (
          <span data-suggested-total className="text-base font-semibold text-foreground"><Money amount={value.total} code={value.currency} /></span>
        )}
      </div>

      {value.state === 'needs-currency' && (
        <p data-suggested-needs-currency className="text-xs text-muted-foreground">
          This opportunity has no currency, so no value can be suggested. Set its currency (Edit) and the Sub-products priced in it are added up here.
        </p>
      )}

      {value.state === 'ready' && (
        <>
          <p className="text-xs text-muted-foreground">
            Quantity times price of the Sub-products priced in {value.currency}. It is only a suggestion: it never changes the Amount of this opportunity.
          </p>
          {value.added.length === 0 && <p className="text-xs text-muted-foreground">No Sub-product is priced in {value.currency} yet.</p>}
          {value.notAdded.length > 0 && (
            <div data-suggested-not-added>
              <p className="text-xs font-medium text-foreground">Not added</p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                {value.notAdded.map((row) => <li key={row.id}>{notAddedSentence(row, value.currency!)}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
