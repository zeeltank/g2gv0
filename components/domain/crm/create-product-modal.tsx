'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmItemType, CrmPicklistValue, CrmProduct, CrmProductPayload, CrmTaxRate } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  itemType: CrmItemType
  product: CrmProduct | null
  categories: CrmPicklistValue[]
  taxRates: CrmTaxRate[]
}

const EMPTY: CrmProductPayload = {
  name: '', sku: '', category: '', description: '', unitPrice: null, costPrice: null, currency: '',
  taxRateId: null, isActive: true, vendor: '', qtyInStock: null, reorderLevel: null, weight: null, assignedTo: '',
}

/**
 * Shared by both menu entries (Products, Services) - one unified
 * crm_products table (see that migration's own docblock for why), one form,
 * `itemType` conditionally hiding the stock/vendor fields a Service never
 * has rather than two near-identical modals.
 */
export function CreateProductModal({ isOpen, onClose, onSaved, itemType, product, categories, taxRates }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const noun = itemType === 'service' ? 'Service' : 'Product'

  const [seededFrom, setSeededFrom] = useState<CrmProduct | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmProductPayload>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== product) {
    setSeededFrom(product)
    setForm(product
      ? {
          name: product.name, sku: product.sku ?? '', category: product.category ?? '', description: product.description ?? '',
          unitPrice: product.unitPrice, costPrice: product.costPrice, currency: product.currency ?? '',
          taxRateId: product.taxRateId, isActive: product.isActive, vendor: product.vendor ?? '',
          qtyInStock: product.qtyInStock, reorderLevel: product.reorderLevel, weight: product.weight,
          assignedTo: product.assignedTo ?? '',
        }
      : EMPTY)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmProductPayload>(key: K, value: CrmProductPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.name?.trim() || !form.assignedTo) {
      setError(`Name and Assigned To are required.`)
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = product
        ? await crmService.updateProduct(context, product.id, form)
        : await crmService.createProduct(context, { ...form, itemType })
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to save that ${noun.toLowerCase()}.`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{product ? `Edit ${noun}` : `New ${noun}`}</DialogTitle>
          <DialogDescription>
            {product ? `Update this ${noun.toLowerCase()}’s details.` : `A ${noun.toLowerCase()} your organisation sells.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="prod-name">{noun} Name *</Label>
            <Input id="prod-name" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {itemType === 'product' && (
              <div className="space-y-1.5">
                <Label htmlFor="prod-sku">SKU</Label>
                <Input id="prod-sku" value={form.sku ?? ''} onChange={(e) => set('sku', e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category || 'none'}
                onChange={(v) => set('category', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...categories.map((c) => ({ label: c.label, value: c.value }))]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-unit-price">Unit Price</Label>
              <Input id="prod-unit-price" type="number" value={form.unitPrice ?? ''} onChange={(e) => set('unitPrice', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-cost-price">Cost Price</Label>
              <Input id="prod-cost-price" type="number" value={form.costPrice ?? ''} onChange={(e) => set('costPrice', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-currency">Currency</Label>
              <Input id="prod-currency" value={form.currency ?? ''} onChange={(e) => set('currency', e.target.value)} placeholder="USD" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Default Tax Rate</Label>
            <Select
              value={form.taxRateId || 'none'}
              onChange={(v) => set('taxRateId', v === 'none' ? null : v)}
              options={[{ label: 'No default tax', value: 'none' }, ...taxRates.map((t) => ({ label: `${t.name} (${t.percentage}%)`, value: t.id }))]}
            />
          </div>

          {itemType === 'product' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="prod-vendor">Vendor</Label>
                <Input id="prod-vendor" value={form.vendor ?? ''} onChange={(e) => set('vendor', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prod-qty">Qty In Stock</Label>
                <Input id="prod-qty" type="number" value={form.qtyInStock ?? ''} onChange={(e) => set('qtyInStock', e.target.value === '' ? null : Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prod-reorder">Reorder Level</Label>
                <Input id="prod-reorder" type="number" value={form.reorderLevel ?? ''} onChange={(e) => set('reorderLevel', e.target.value === '' ? null : Number(e.target.value))} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Assigned To *</Label>
            <SearchableSelect
              value={form.assignedTo ?? ''}
              onChange={(v) => set('assignedTo', v)}
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="Choose an employee…"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="prod-active" className="cursor-pointer">Active</Label>
            <Switch id="prod-active" checked={form.isActive ?? true} onChange={(e) => set('isActive', e.target.checked)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-description">Description</Label>
            <Textarea id="prod-description" rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.name?.trim()}>
            {submitting ? 'Saving…' : product ? 'Save Changes' : `Create ${noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
