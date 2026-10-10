'use client'

/**
 * The line-item builder - the single biggest net-new UI component in the
 * Sales migration (no precedent anywhere else in this codebase). Owns only
 * the editing grid and a CLIENT-SIDE PREVIEW total; it never persists
 * anything itself. The parent (QuoteDetailPage) holds the row array as
 * plain state and calls crmService.saveQuoteLineItems() with the whole set
 * when the user clicks Save - matching the backend's own "replace wholesale
 * on save" design, not a per-row autosave.
 *
 * computeLineTotal/computeTotals mirror CrmQuoteController::saveLineItems()'s
 * arithmetic exactly (gross -> per-line discount -> tax on the discounted
 * amount -> line total; then subtotal/discountTotal/taxTotal are the sum of
 * every line's own figures) so what the user sees here matches what the
 * server will compute down to the cent - but the server recomputes
 * independently on save regardless, this is a preview, not the source of
 * truth.
 */

import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CrmProduct, CrmQuoteLineItemInput, CrmTaxRate } from '@/types/crm'

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function computeLineTotal(item: CrmQuoteLineItemInput, taxRates: CrmTaxRate[]): number {
  const gross = (item.quantity || 0) * (item.unitPrice || 0)
  const discountAmount = item.discountPercent != null ? (gross * item.discountPercent) / 100 : (item.discountAmount ?? 0)
  const afterDiscount = Math.max(0, gross - discountAmount)
  const taxPercent = taxRates.find((t) => t.id === item.taxRateId)?.percentage ?? 0
  return Math.round((afterDiscount + (afterDiscount * taxPercent) / 100) * 100) / 100
}

export function computeTotals(items: CrmQuoteLineItemInput[], taxRates: CrmTaxRate[]) {
  let subtotal = 0
  let discountTotal = 0
  let taxTotal = 0

  for (const item of items) {
    const gross = (item.quantity || 0) * (item.unitPrice || 0)
    const discountAmount = item.discountPercent != null ? (gross * item.discountPercent) / 100 : (item.discountAmount ?? 0)
    const afterDiscount = Math.max(0, gross - discountAmount)
    const taxPercent = taxRates.find((t) => t.id === item.taxRateId)?.percentage ?? 0
    subtotal += gross
    discountTotal += discountAmount
    taxTotal += (afterDiscount * taxPercent) / 100
  }

  return { subtotal, discountTotal, taxTotal }
}

interface Props {
  lineItems: CrmQuoteLineItemInput[]
  onChange: (lineItems: CrmQuoteLineItemInput[]) => void
  products: CrmProduct[]
  taxRates: CrmTaxRate[]
  currency: string | null
}

const emptyRow = (sequenceNo: number): CrmQuoteLineItemInput => ({
  productId: null, description: '', quantity: 1, unitPrice: 0,
  discountPercent: null, discountAmount: null, taxRateId: null, sequenceNo,
})

export function QuoteLineItemTable({ lineItems, onChange, products, taxRates, currency }: Props) {
  const totals = useMemo(() => computeTotals(lineItems, taxRates), [lineItems, taxRates])

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name, hint: p.itemType === 'service' ? 'Service' : 'Product' })),
    [products],
  )
  const taxOptions = [{ label: 'No tax', value: 'none' }, ...taxRates.map((t) => ({ label: `${t.name} (${t.percentage}%)`, value: t.id }))]

  const updateRow = (index: number, patch: Partial<CrmQuoteLineItemInput>) => {
    onChange(lineItems.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const onProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (!product) { updateRow(index, { productId: null }); return }
    updateRow(index, {
      productId: product.id,
      description: product.name,
      unitPrice: product.unitPrice ?? 0,
      taxRateId: product.taxRateId,
    })
  }

  const addRow = () => onChange([...lineItems, emptyRow(lineItems.length)])
  const removeRow = (index: number) => onChange(lineItems.filter((_, i) => i !== index).map((row, i) => ({ ...row, sequenceNo: i })))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead className="min-w-[180px]">Product / Service</TableHead>
              <TableHead className="min-w-[200px]">Description</TableHead>
              <TableHead className="w-24">Qty</TableHead>
              <TableHead className="w-28">Unit Price</TableHead>
              <TableHead className="w-24">Disc. %</TableHead>
              <TableHead className="w-40">Tax</TableHead>
              <TableHead className="w-28 text-right">Amount</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  No line items yet. Click “Add Line” to start building this quote.
                </TableCell>
              </TableRow>
            )}
            {lineItems.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="text-xs text-muted-foreground">{index + 1}</TableCell>
                <TableCell>
                  <SearchableSelect
                    value={row.productId ?? ''}
                    onChange={(v) => onProductChange(index, v)}
                    options={productOptions}
                    placeholder="Pick one…"
                    aria-label={`Product for line ${index + 1}`}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={row.description ?? ''}
                    onChange={(e) => updateRow(index, { description: e.target.value })}
                    placeholder="Line description"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number" min={0.01} step="0.01"
                    value={row.quantity}
                    onChange={(e) => updateRow(index, { quantity: Number(e.target.value) || 0 })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number" min={0} step="0.01"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(index, { unitPrice: Number(e.target.value) || 0 })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number" min={0} max={100} step="0.01"
                    value={row.discountPercent ?? ''}
                    onChange={(e) => updateRow(index, { discountPercent: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={row.taxRateId ?? 'none'}
                    onChange={(v) => updateRow(index, { taxRateId: v === 'none' ? null : v })}
                    options={taxOptions}
                    aria-label={`Tax rate for line ${index + 1}`}
                  />
                </TableCell>
                <TableCell className="text-right font-medium text-foreground">
                  {money(computeLineTotal(row, taxRates))}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" onClick={() => removeRow(index)} aria-label={`Remove line ${index + 1}`}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {lineItems.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7} className="text-right text-muted-foreground">Subtotal</TableCell>
                <TableCell colSpan={2} className="text-right font-medium text-foreground">{currency} {money(totals.subtotal)}</TableCell>
              </TableRow>
              {totals.discountTotal > 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-right text-muted-foreground">Discount</TableCell>
                  <TableCell colSpan={2} className="text-right text-foreground">-{currency} {money(totals.discountTotal)}</TableCell>
                </TableRow>
              )}
              {totals.taxTotal > 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-right text-muted-foreground">Tax</TableCell>
                  <TableCell colSpan={2} className="text-right text-foreground">{currency} {money(totals.taxTotal)}</TableCell>
                </TableRow>
              )}
            </TableFooter>
          )}
        </Table>
      </div>

      <Button variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1.5 size-4" aria-hidden="true" />
        Add Line
      </Button>
    </div>
  )
}
