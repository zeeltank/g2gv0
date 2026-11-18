'use client'

import { useEffect, useMemo, useState } from 'react'
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
  name: '', sku: '', category: '', glAccount: '', description: '', unitPrice: null, costPrice: null,
  commissionRate: null, currency: '', taxRateId: null, isActive: true, vendor: '', qtyInStock: null,
  qtyInDemand: null, reorderLevel: null, weight: null, usageUnit: '', assignedTo: '',
  productMasterId: null, productLineName: null,
}

/**
 * Composite CPQ Creation Modal:
 * Unifies Product Line hierarchy (g2g_product_master, kind='product') and Catalogue SKU (crm_products)
 * into a single clean 2-column form. The user can either select an existing Product Line or create a new
 * line inline in one atomic step.
 */
export function CreateProductModal({ isOpen, onClose, onSaved, itemType, product, categories, taxRates }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const noun = itemType === 'service' ? 'Service' : 'Product'

  const [seededFrom, setSeededFrom] = useState<CrmProduct | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmProductPayload>(EMPTY)
  const [productLines, setProductLines] = useState<{ id: number; key: string; name: string }[]>([])
  const [loadingLines, setLoadingLines] = useState(false)
  const [lineMode, setLineMode] = useState<'select' | 'create'>('select')
  const [newLineName, setNewLineName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoadingLines(true)
    crmService.getProductLines()
      .then((res) => {
        if (active && Array.isArray(res?.data)) {
          setProductLines(res.data)
        }
      })
      .catch(() => {
        // Product master lines unavailable
      })
      .finally(() => {
        if (active) setLoadingLines(false)
      })
    return () => {
      active = false
    }
  }, [isOpen])

  if (isOpen && seededFrom !== product) {
    setSeededFrom(product)
    setLineMode('select')
    setNewLineName('')
    setForm(product
      ? {
          name: product.name, sku: product.sku ?? '', category: product.category ?? '', glAccount: product.glAccount ?? '',
          description: product.description ?? '',
          unitPrice: product.unitPrice, costPrice: product.costPrice, commissionRate: product.commissionRate,
          currency: product.currency ?? '',
          taxRateId: product.taxRateId, isActive: product.isActive, vendor: product.vendor ?? '',
          qtyInStock: product.qtyInStock, qtyInDemand: product.qtyInDemand, reorderLevel: product.reorderLevel,
          weight: product.weight, usageUnit: product.usageUnit ?? '',
          assignedTo: product.assignedTo ?? '',
          productMasterId: product.productMasterId ?? product.productLine?.id ?? null,
        }
      : EMPTY)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmProductPayload>(key: K, value: CrmProductPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.name?.trim() || !form.assignedTo) {
      setError('Name and Assigned To are required.')
      return
    }
    if (itemType === 'product') {
      if (lineMode === 'create') {
        if (!newLineName.trim()) {
          setError('Please specify a name for the new Product Line.')
          return
        }
      } else {
        if (loadingLines) {
          setError('Please wait for product lines to finish loading.')
          return
        }
        if (productLines.length > 0 && (!form.productMasterId || Number(form.productMasterId) <= 0)) {
          setError('Product Line is required.')
          return
        }
      }
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload: CrmProductPayload = {
        ...form,
        ...(itemType === 'product' && lineMode === 'create'
          ? { productLineName: newLineName.trim(), productMasterId: null }
          : {}),
      }
      const response = product
        ? await crmService.updateProduct(context, product.id, payload)
        : await crmService.createProduct(context, { ...payload, itemType })
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
            {product ? `Update this ${noun.toLowerCase()}’s catalogue details.` : `Create a sellable catalogue SKU under your strategic product hierarchy.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 1. Name */}
            <div className="space-y-1.5">
              <Label htmlFor="prod-name">{noun} Name *</Label>
              <Input id="prod-name" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus />
            </div>

            {/* 2. Product Line (for Products) or Category (for Services) */}
            {itemType === 'product' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="prod-line">Product Line *</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setLineMode((m) => (m === 'select' ? 'create' : 'select'))}
                  >
                    {lineMode === 'select' ? '+ Create New Line' : '← Select Existing Line'}
                  </button>
                </div>
                {lineMode === 'select' ? (
                  <Select
                    id="prod-line"
                    disabled={loadingLines}
                    value={form.productMasterId ? String(form.productMasterId) : 'none'}
                    onChange={(v) => set('productMasterId', v === 'none' ? null : Number(v))}
                    options={[
                      { label: loadingLines ? 'Loading product lines…' : 'Select a Product Line…', value: 'none' },
                      ...productLines.map((l) => ({ label: l.name, value: String(l.id) })),
                    ]}
                  />
                ) : (
                  <Input
                    id="inline-prod-line"
                    placeholder="e.g. ScholarClone, Enterprise Brain..."
                    value={newLineName}
                    onChange={(e) => setNewLineName(e.target.value)}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category || 'none'}
                  onChange={(v) => set('category', v === 'none' ? '' : v)}
                  options={[{ label: '—', value: 'none' }, ...categories.map((c) => ({ label: c.label, value: c.value }))]}
                />
              </div>
            )}

            {/* 3. SKU (products) and Category (products) */}
            {itemType === 'product' && (
              <div className="space-y-1.5">
                <Label htmlFor="prod-sku">Catalogue SKU</Label>
                <Input id="prod-sku" value={form.sku ?? ''} onChange={(e) => set('sku', e.target.value)} placeholder="e.g. SCH-01-CORE" />
              </div>
            )}
            {itemType === 'product' && (
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category || 'none'}
                  onChange={(v) => set('category', v === 'none' ? '' : v)}
                  options={[{ label: '—', value: 'none' }, ...categories.map((c) => ({ label: c.label, value: c.value }))]}
                />
              </div>
            )}

            {/* 4. Pricing */}
            <div className="space-y-1.5">
              <Label htmlFor="prod-unit-price">Unit Price</Label>
              <Input id="prod-unit-price" type="number" value={form.unitPrice ?? ''} onChange={(e) => set('unitPrice', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-cost-price">Cost Price</Label>
              <Input id="prod-cost-price" type="number" value={form.costPrice ?? ''} onChange={(e) => set('costPrice', e.target.value === '' ? null : Number(e.target.value))} />
            </div>

            {/* 5. Currency & Commission Rate */}
            <div className="space-y-1.5">
              <Label htmlFor="prod-currency">Currency</Label>
              <Input id="prod-currency" value={form.currency ?? ''} onChange={(e) => set('currency', e.target.value)} placeholder="USD or INR" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-commission">Commission Rate %</Label>
              <Input id="prod-commission" type="number" min={0} max={100} value={form.commissionRate ?? ''} onChange={(e) => set('commissionRate', e.target.value === '' ? null : Number(e.target.value))} />
            </div>

            {/* 6. Tax Rate & GL Account */}
            <div className="space-y-1.5">
              <Label>Default Tax Rate</Label>
              <Select
                value={form.taxRateId || 'none'}
                onChange={(v) => set('taxRateId', v === 'none' ? null : v)}
                options={[{ label: 'No default tax', value: 'none' }, ...taxRates.map((t) => ({ label: `${t.name} (${t.percentage}%)`, value: t.id }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-gl-account">GL Account</Label>
              <Input id="prod-gl-account" value={form.glAccount ?? ''} onChange={(e) => set('glAccount', e.target.value)} placeholder="e.g. 4000-SALES" />
            </div>

            {/* 7. Usage Unit & Assigned To */}
            <div className="space-y-1.5">
              <Label htmlFor="prod-usage-unit">Usage Unit</Label>
              <Input id="prod-usage-unit" value={form.usageUnit ?? ''} onChange={(e) => set('usageUnit', e.target.value)} placeholder="e.g. licence, student/yr, hr" />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned To *</Label>
              <SearchableSelect
                value={form.assignedTo ?? ''}
                onChange={(v) => set('assignedTo', v)}
                options={employees.map((e) => ({ value: e.id, label: e.name }))}
                placeholder="Choose an employee…"
              />
            </div>

            {/* 8. Stock & Logistics (Product only) */}
            {itemType === 'product' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-vendor">Vendor</Label>
                  <Input id="prod-vendor" value={form.vendor ?? ''} onChange={(e) => set('vendor', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-qty">Qty In Stock</Label>
                  <Input id="prod-qty" type="number" value={form.qtyInStock ?? ''} onChange={(e) => set('qtyInStock', e.target.value === '' ? null : Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-qty-demand">Qty In Demand</Label>
                  <Input id="prod-qty-demand" type="number" value={form.qtyInDemand ?? ''} onChange={(e) => set('qtyInDemand', e.target.value === '' ? null : Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-reorder">Reorder Level</Label>
                  <Input id="prod-reorder" type="number" value={form.reorderLevel ?? ''} onChange={(e) => set('reorderLevel', e.target.value === '' ? null : Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-weight">Weight (kg)</Label>
                  <Input id="prod-weight" type="number" value={form.weight ?? ''} onChange={(e) => set('weight', e.target.value === '' ? null : Number(e.target.value))} />
                </div>
              </>
            )}

            {/* Active Switch */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="prod-active" className="cursor-pointer font-medium">Active</Label>
              <Switch id="prod-active" checked={form.isActive ?? true} onChange={(e) => set('isActive', e.target.checked)} />
            </div>
          </div>

          {/* Description */}
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
