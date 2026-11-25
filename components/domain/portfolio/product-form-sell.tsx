'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Field, NativeSelect } from '@/components/shared/scaffolds'
import { changeCurrency, ratesForCurrency, type SellForm, type SellStanding } from '@/lib/portfolio/form-model'
import type { CrmPicklistValue } from '@/types/crm'
import type { PmItemType, PmTaxRate } from '@/services/product-master/types'
import { CurrencySelect } from './currency-select'
import { PriceCard } from './price-card'

type Errors = Record<string, string[]>

const TYPE_LABELS: Record<PmItemType, string> = { product: 'Sub-product', service: 'Service' }
export const sellTypeLabel = (type: PmItemType | null): string => (type === 'service' ? 'Service' : 'Sub-product')

/**
 * The Sell in CRM section: every field of the old Products form. Before the first save a switch makes the entry ("Sell in CRM"); after it there is ONE switch,
 * "Offered on new documents": off pauses the Sub-product (it leaves the pickers, old documents still show it, nothing is deleted). A Service has no vendor,
 * stock, demand, reorder level or weight. The picture is picked here and uploaded right after the save, through its own call.
 */
export function SellSection({ sell, onSell, standing, types, taxRates, currencyFallback, categories, employees, errors, busy, name, imageUrl }: {
  sell: SellForm
  onSell: (patch: Partial<SellForm>) => void
  standing: SellStanding
  /** The types the person may add (their Products and Services rights); an existing row keeps its own type. */
  types: readonly PmItemType[]
  taxRates: readonly PmTaxRate[]
  /** The organisation's default currency: what a new Sub-product starts with and what an empty stored currency stands for. */
  currencyFallback: string
  /** The `products.category` picklist. */
  categories: readonly CrmPicklistValue[]
  employees: ReadonlyArray<{ id: string; name: string }>
  errors: Errors
  busy: boolean
  name: string
  /** The picture the row already has. */
  imageUrl: string | null
}) {
  const err = (key: string) => errors[`sell.${key}`]
  const live = standing === 'live'
  const isService = sell.type === 'service'
  const show = sell.on || live
  const typeChoices: PmItemType[] = live ? [sell.type] : types.length > 0 ? [...types] : [sell.type]
  const categoryKnown = categories.some((c) => c.value === sell.category)
  const assignedKnown = employees.some((e) => e.id === sell.assignedTo)
  // The currency decides which tax rates are offered. Changing it lets go of a rate tied to the other currency, and says so until the person chooses again.
  const [droppedRate, setDroppedRate] = useState<PmTaxRate | null>(null)
  const code = sell.currency.trim() === '' ? currencyFallback : sell.currency.trim()
  const rates = ratesForCurrency(taxRates, code)
  const chosenRate = taxRates.find((t) => String(t.id) === sell.taxRateId) ?? null
  const strayRate = chosenRate !== null && !rates.includes(chosenRate) ? chosenRate : null
  const onCurrency = (next: string) => {
    const change = changeCurrency(sell, next, taxRates, currencyFallback)
    setDroppedRate(change.dropped)
    onSell(change.patch)
  }
  const onRate = (id: string) => {
    setDroppedRate(null)
    onSell({ taxRateId: id })
  }
  const rateWord = (t: PmTaxRate) => `${t.name} (${t.percentage}%)`

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex items-start justify-between gap-4 sm:col-span-2">
        {live ? (
          <>
            <div className="min-w-0">
              <label htmlFor="sell-offered" className="text-sm font-medium text-foreground">Offered on new documents</label>
              <p id="sell-offered-hint" className="text-xs text-muted-foreground">
                Off pauses it: it leaves the pickers for new quotes, orders and invoices, and the old documents still show it. Nothing is deleted.
              </p>
              {err('isActive') && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{err('isActive')!.join(' ')}</p>}
            </div>
            <Switch id="sell-offered" aria-describedby="sell-offered-hint" checked={sell.offered} disabled={busy} onChange={(e) => onSell({ offered: e.target.checked })} />
          </>
        ) : (
          <>
            <div className="min-w-0">
              <label htmlFor="sell-on" className="text-sm font-medium text-foreground">Sell in CRM</label>
              <p id="sell-on-hint" className="text-xs text-muted-foreground">
                {standing === 'binned'
                  ? 'It is in the Recycle Bin. Switching this on brings it back, with the details below.'
                  : 'Switching this on makes the entry that quotes, orders and invoices can use. Their price, currency and tax come from the fields below.'}
              </p>
              {err('enabled') && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{err('enabled')!.join(' ')}</p>}
            </div>
            <Switch id="sell-on" aria-describedby="sell-on-hint" checked={sell.on} disabled={busy} onChange={(e) => onSell({ on: e.target.checked })} />
          </>
        )}
      </div>

      {show && (
        <>
          <Field label="Type" error={err('type')} hint={live ? 'The type of a saved entry does not change.' : undefined}>
            {(c) => (
              <NativeSelect {...c} value={sell.type} onChange={(e) => onSell({ type: e.target.value as PmItemType })} disabled={busy || live}>
                {typeChoices.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </NativeSelect>
            )}
          </Field>
          <Field label="SKU" error={err('sku')}>
            {(c) => <Input {...c} value={sell.sku} onChange={(e) => onSell({ sku: e.target.value })} disabled={busy} maxLength={100} autoComplete="off" />}
          </Field>
          <Field label="Category" error={err('category')}>
            {(c) => (
              <NativeSelect {...c} value={sell.category} onChange={(e) => onSell({ category: e.target.value })} disabled={busy}>
                <option value="">None</option>
                {sell.category !== '' && !categoryKnown && <option value={sell.category}>{sell.category}</option>}
                {categories.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
              </NativeSelect>
            )}
          </Field>
          <Field label="GL account" error={err('glAccount')}>
            {(c) => <Input {...c} value={sell.glAccount} onChange={(e) => onSell({ glAccount: e.target.value })} disabled={busy} maxLength={191} autoComplete="off" />}
          </Field>
          <Field label="Unit price" error={err('unitPrice') ?? err('basePrice')} hint="The price before tax. Quotes, orders and invoices take it from here.">
            {(c) => <Input {...c} type="text" inputMode="decimal" value={sell.unitPrice} onChange={(e) => onSell({ unitPrice: e.target.value })} disabled={busy} autoComplete="off" />}
          </Field>
          <Field label="Currency" error={err('currency')}>
            {(c) => <CurrencySelect {...c} value={sell.currency} onChange={onCurrency} disabled={busy} fallbackCode={currencyFallback} />}
          </Field>
          <Field label="Tax rate" error={err('taxRateId')} hint={`Added on top of the price. Rates for ${code} and rates for any currency are listed.`}>
            {(c) => (
              <NativeSelect {...c} value={sell.taxRateId} onChange={(e) => onRate(e.target.value)} disabled={busy}>
                <option value="">Default</option>
                {strayRate && <option value={String(strayRate.id)}>{`${rateWord(strayRate)} - for ${strayRate.currency}, not ${code}`}</option>}
                {rates.map((t) => <option key={t.id} value={t.id}>{rateWord(t)}</option>)}
              </NativeSelect>
            )}
          </Field>
          <PriceCard className="sm:col-span-2" price={sell.unitPrice} currency={code} taxPercent={chosenRate?.percentage ?? null} taxName={chosenRate?.name ?? null}>
            {droppedRate && (
              <p role="status" className="text-xs text-foreground">
                The tax rate {rateWord(droppedRate)} is for {droppedRate.currency}, so it was taken off. Choose a rate for {code}, or leave it on Default.
              </p>
            )}
          </PriceCard>
          <Field label="Cost price" error={err('costPrice')}>
            {(c) => <Input {...c} type="text" inputMode="decimal" value={sell.costPrice} onChange={(e) => onSell({ costPrice: e.target.value })} disabled={busy} autoComplete="off" />}
          </Field>
          <Field label="Commission %" error={err('commissionRate')}>
            {(c) => <Input {...c} type="text" inputMode="decimal" value={sell.commissionRate} onChange={(e) => onSell({ commissionRate: e.target.value })} disabled={busy} autoComplete="off" />}
          </Field>
          <Field label="Usage unit" error={err('usageUnit')}>
            {(c) => <Input {...c} value={sell.usageUnit} onChange={(e) => onSell({ usageUnit: e.target.value })} disabled={busy} maxLength={191} autoComplete="off" />}
          </Field>
          {!isService && (
            <>
              <Field label="Vendor" error={err('vendor')}>
                {(c) => <Input {...c} value={sell.vendor} onChange={(e) => onSell({ vendor: e.target.value })} disabled={busy} maxLength={191} autoComplete="off" />}
              </Field>
              <Field label="Stock" error={err('qtyInStock')}>
                {(c) => <Input {...c} type="text" inputMode="decimal" value={sell.qtyInStock} onChange={(e) => onSell({ qtyInStock: e.target.value })} disabled={busy} autoComplete="off" />}
              </Field>
              <Field label="Stock in demand" error={err('qtyInDemand')}>
                {(c) => <Input {...c} type="text" inputMode="decimal" value={sell.qtyInDemand} onChange={(e) => onSell({ qtyInDemand: e.target.value })} disabled={busy} autoComplete="off" />}
              </Field>
              <Field label="Reorder level" error={err('reorderLevel')}>
                {(c) => <Input {...c} type="text" inputMode="numeric" value={sell.reorderLevel} onChange={(e) => onSell({ reorderLevel: e.target.value })} disabled={busy} autoComplete="off" />}
              </Field>
              <Field label="Weight (kg)" error={err('weight')}>
                {(c) => <Input {...c} type="text" inputMode="decimal" value={sell.weight} onChange={(e) => onSell({ weight: e.target.value })} disabled={busy} autoComplete="off" />}
              </Field>
            </>
          )}
          <Field label="Assigned to" error={err('assignedTo')} hint="Defaults to you.">
            {(c) => (
              <NativeSelect {...c} value={sell.assignedTo} onChange={(e) => onSell({ assignedTo: e.target.value })} disabled={busy}>
                {sell.assignedTo !== '' && !assignedKnown && <option value={sell.assignedTo}>{`Person ${sell.assignedTo}`}</option>}
                {sell.assignedTo === '' && <option value="">Choose a person…</option>}
                {employees.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
            )}
          </Field>
          <Field label="Image" hint="Uploads right after you save." wide>
            {(c) => (
              <div className="flex flex-wrap items-center gap-3">
                {imageUrl && !sell.image && <img src={imageUrl} alt={`${name || 'Sub-product'} picture`} className="size-14 rounded-lg border border-border object-cover" />}
                <input
                  {...c}
                  type="file"
                  accept="image/*"
                  disabled={busy}
                  className="min-w-0 max-w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground"
                  onChange={(e) => onSell({ image: e.target.files?.[0] ?? null })}
                />
              </div>
            )}
          </Field>
          <Field label="Description on quotes" error={err('descriptionOnQuotes') ?? err('description')} hint="The text printed on a quote line." wide>
            {(c) => <Textarea {...c} rows={3} value={sell.descriptionOnQuotes} onChange={(e) => onSell({ descriptionOnQuotes: e.target.value })} disabled={busy} />}
          </Field>
        </>
      )}
    </div>
  )
}
