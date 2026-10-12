'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileUpload } from '@/components/ui/file-upload'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { CrmPicklistValue, CrmProduct, CrmProductBundleItem, CrmTaxRate } from '@/types/crm'
import { CreateProductModal } from './create-product-modal'

interface Props {
  product: CrmProduct
  onSaved: () => void
  onBack: () => void
  categories: CrmPicklistValue[]
  taxRates: CrmTaxRate[]
}

type Tab = 'details' | 'bundle' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [{ id: 'details', label: 'Details' }]

/** Products only (vtiger's SubProducts has no Service equivalent), one level deep - matches backend's own non-recursive rule. */
function AddBundleComponentDialog({ isOpen, onClose, onAdded, productId }: {
  isOpen: boolean; onClose: () => void; onAdded: () => void; productId: string
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([])
  const [componentId, setComponentId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !isLaravelContextReady(context)) return
    crmService.getProducts(context, 'product', { perPage: 100, sortBy: 'name', sortDir: 'asc' })
      .then((response) => setOptions(response.data.items.filter((p) => p.id !== productId).map((p) => ({ id: p.id, label: p.name }))))
      .catch(() => { /* the form still works with an empty picker */ })
  }, [isOpen, context, productId])

  const submit = async () => {
    if (!componentId) return
    setSubmitting(true)
    setError('')
    try {
      await crmService.addBundleItem(context, productId, componentId, Number(quantity) || 1)
      setComponentId('')
      setQuantity('1')
      onAdded()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add this component.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Component</DialogTitle>
          <DialogDescription>Build this product as a kit of other products - the bundle keeps its own price, set separately.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Component Product</Label>
            <SearchableSelect value={componentId} onChange={setComponentId} options={options.map((o) => ({ value: o.id, label: o.label }))} placeholder="Choose a product…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bundle-qty">Quantity</Label>
            <Input id="bundle-qty" type="number" min={0.01} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        </div>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !componentId}>{submitting ? 'Adding…' : 'Add'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value ?? '—'}</p>
    </div>
  )
}

/** Shared by Products and Services - one unified crm_products table, one detail page, `product.itemType` branding labels/fields. */
export function ProductDetailPage({ product, onSaved, onBack, categories, taxRates }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const noun = product.itemType === 'service' ? 'Service' : 'Product'
  const isBundleable = product.itemType === 'product'
  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const [bundleItems, setBundleItems] = useState<CrmProductBundleItem[]>([])
  const [bundleLoading, setBundleLoading] = useState(true)
  const [addComponentOpen, setAddComponentOpen] = useState(false)

  const tabs = [
    ...BASE_TABS,
    ...(isBundleable ? [{ id: 'bundle' as const, label: 'Bundle' }] : []),
    ...(hasCustomFields ? [{ id: 'custom' as const, label: 'Custom Fields' }] : []),
  ]

  const loadBundleItems = useCallback(async () => {
    if (!isBundleable) return
    setBundleLoading(true)
    try {
      const response = await crmService.getBundleItems(context, product.id)
      setBundleItems(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setBundleLoading(false)
    }
  }, [context, product.id, isBundleable])

  useEffect(() => {
    queueMicrotask(() => { void loadBundleItems() })
  }, [loadBundleItems])

  const bundleTotal = bundleItems.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0)

  const removeComponent = async (rowId: string) => {
    try {
      await crmService.removeBundleItem(context, product.id, rowId)
      void loadBundleItems()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to remove that component.')
    }
  }

  const handleImageSelect = async (file: File | null) => {
    if (!file) return
    setUploadingImage(true)
    try {
      const response = await crmService.uploadProductImage(context, product.id, file)
      setNotice(response.message)
      onSaved()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to upload that image.')
    } finally {
      setUploadingImage(false)
    }
  }

  const saveCustomFields = async () => {
    setSavingCustom(true)
    setCustomNotice(null)
    try {
      await saveCustomFieldValues('crm_products', Number(product.id), customValues)
      setCustomNotice('Saved.')
    } catch (cause: unknown) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally {
      setSavingCustom(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
            Back to {noun === 'Service' ? 'Services' : 'Products'}
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{product.name}</h1>
            <p className="text-sm text-muted-foreground">{product.category || noun} · {product.productNo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 size-4" aria-hidden="true" />
            Edit
          </Button>
        </div>
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="space-y-6 rounded-lg border border-border p-4">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Image</h2>
            <div className="flex items-center gap-4">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="size-20 rounded-lg border border-border object-cover" />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                  <Package className="size-8" aria-hidden="true" />
                </div>
              )}
              <div className="w-64">
                <FileUpload accept="image/*" maxSizeMB={5} hint="PNG or JPG, up to 5MB" onFileSelect={(file) => void handleImageSelect(file)} disabled={uploadingImage} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{noun} Details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {product.itemType === 'product' && <Field label="SKU" value={product.sku} />}
              <Field label="Category" value={product.category} />
              <Field label="GL Account" value={product.glAccount} />
              <Field label="Unit Price" value={product.unitPrice !== null ? `${product.currency ?? ''} ${product.unitPrice.toFixed(2)}`.trim() : null} />
              <Field label="Cost Price" value={product.costPrice !== null ? `${product.currency ?? ''} ${product.costPrice.toFixed(2)}`.trim() : null} />
              <Field label="Commission Rate" value={product.commissionRate !== null ? `${product.commissionRate}%` : null} />
              <Field label="Default Tax Rate" value={product.taxRateName} />
              <Field label="Active" value={product.isActive ? 'Yes' : 'No'} />
              <Field label="Usage Unit" value={product.usageUnit} />
              {product.itemType === 'product' && (
                <>
                  <Field label="Vendor" value={product.vendor} />
                  <Field label="Qty In Stock" value={product.qtyInStock} />
                  <Field label="Qty In Demand" value={product.qtyInDemand} />
                  <Field label="Reorder Level" value={product.reorderLevel} />
                  <Field label="Weight" value={product.weight} />
                </>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Description</h2>
            <p className="text-sm text-foreground">{product.description || '—'}</p>
          </section>
        </div>
      )}

      {tab === 'bundle' && isBundleable && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Bundle Components</h2>
              <p className="text-xs text-muted-foreground">Make this product a kit of others - its own price above is kept independently.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAddComponentOpen(true)}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Add Component
            </Button>
          </div>
          {bundleLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading components…
            </div>
          )}
          {!bundleLoading && bundleItems.length === 0 && <p className="py-6 text-sm text-muted-foreground">Not a bundle yet - add a component to make it one.</p>}
          {!bundleLoading && bundleItems.length > 0 && (
            <>
              <div className="divide-y divide-border rounded-lg border border-border">
                {bundleItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Qty {item.quantity} {item.unitPrice !== null ? `· ${product.currency ?? ''} ${item.unitPrice.toFixed(2)}`.trim() + ' each' : ''}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => void removeComponent(item.id)} aria-label={`Remove ${item.name}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-right text-sm text-muted-foreground">
                Components total: {product.currency ?? ''} {bundleTotal.toFixed(2)}
              </p>
            </>
          )}
        </div>
      )}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? 'space-y-4 rounded-lg border border-border p-4' : 'hidden'}>
        <CustomFieldsSection
          recordTable="crm_products"
          recordId={Number(product.id)}
          values={customValues}
          onChange={setCustomValues}
          onFieldsLoaded={(fields) => setHasCustomFields(fields.length > 0)}
        />
        {hasCustomFields && (
          <div className="flex items-center gap-3 pt-2">
            <Button size="sm" disabled={savingCustom} onClick={() => void saveCustomFields()}>
              {savingCustom && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
              Save
            </Button>
            {customNotice && <span className="text-xs text-muted-foreground">{customNotice}</span>}
          </div>
        )}
      </div>

      <CreateProductModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        itemType={product.itemType}
        product={product}
        categories={categories}
        taxRates={taxRates}
      />
      {isBundleable && (
        <AddBundleComponentDialog
          isOpen={addComponentOpen}
          onClose={() => setAddComponentOpen(false)}
          onAdded={loadBundleItems}
          productId={product.id}
        />
      )}
    </div>
  )
}
