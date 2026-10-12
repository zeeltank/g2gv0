'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Boxes, Camera, CheckCircle2, DollarSign, Loader2, Package,
  Pencil, Percent, Plus, Receipt, Ruler, Tag, Trash2, Warehouse, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { EmptyState } from '@/components/ui/empty-state'
import { KPICard } from '@/components/shared/business/kpi-card'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
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

/** A label paired with a small muted icon - the inline-icon convention organization-information.tsx uses for ReadField values. */
function IconValue({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      {children}
    </span>
  )
}

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

/** Shared by Products and Services - one unified crm_products table, one detail page, `product.itemType` branding labels/fields. */
export function ProductDetailPage({ product, onSaved, onBack, categories, taxRates }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const noun = product.itemType === 'service' ? 'Service' : 'Product'
  const isBundleable = product.itemType === 'product'
  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

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

  const handleImageSelect = async (file: File | undefined) => {
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
      if (imageInputRef.current) imageInputRef.current.value = ''
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

          {/* Preview-first image treatment (profile-photo-picker's own convention) - the upload control is a small overlay chip, never a standalone dashed box. */}
          <div className="relative shrink-0">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="size-14 rounded-xl border border-border object-cover" />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
                <Package className="size-6" aria-hidden="true" />
              </div>
            )}
            <button
              type="button"
              aria-label={product.imageUrl ? 'Change image' : 'Upload image'}
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImage}
              className="absolute -bottom-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-primary disabled:opacity-50"
            >
              {uploadingImage ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Camera className="size-3.5" aria-hidden="true" />}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void handleImageSelect(e.target.files?.[0])}
            />
          </div>

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
        <div className="space-y-4">
          <SectionCard title={`${noun} Details`}>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {product.itemType === 'product' && <ReadField label="SKU" value={product.sku} />}
              <ReadField label="Category" value={product.category && <IconValue icon={Tag}>{product.category}</IconValue>} />
              <ReadField label="GL Account" value={product.glAccount && <IconValue icon={Receipt}>{product.glAccount}</IconValue>} />
              <ReadField
                label="Unit Price"
                value={product.unitPrice !== null && (
                  <IconValue icon={DollarSign}>{`${product.currency ?? ''} ${product.unitPrice.toFixed(2)}`.trim()}</IconValue>
                )}
              />
              <ReadField
                label="Cost Price"
                value={product.costPrice !== null && (
                  <IconValue icon={DollarSign}>{`${product.currency ?? ''} ${product.costPrice.toFixed(2)}`.trim()}</IconValue>
                )}
              />
              <ReadField label="Commission Rate" value={product.commissionRate !== null && <IconValue icon={Percent}>{`${product.commissionRate}%`}</IconValue>} />
              <ReadField label="Default Tax Rate" value={product.taxRateName} />
              <ReadField
                label="Status"
                value={product.isActive
                  ? <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="size-3.5" aria-hidden="true" />Active</span>
                  : <span className="inline-flex items-center gap-1.5 text-muted-foreground"><XCircle className="size-3.5" aria-hidden="true" />Inactive</span>}
              />
              <ReadField label="Usage Unit" value={product.usageUnit && <IconValue icon={Ruler}>{product.usageUnit}</IconValue>} />
              {product.itemType === 'product' && (
                <>
                  <ReadField label="Vendor" value={product.vendor} />
                  <ReadField label="Qty In Stock" value={product.qtyInStock !== null && <IconValue icon={Warehouse}>{product.qtyInStock}</IconValue>} />
                  <ReadField label="Qty In Demand" value={product.qtyInDemand} />
                  <ReadField label="Reorder Level" value={product.reorderLevel} />
                  <ReadField label="Weight" value={product.weight} />
                </>
              )}
            </dl>
          </SectionCard>

          <SectionCard title="Description">
            <p className="text-sm text-foreground">{product.description || 'No description yet.'}</p>
          </SectionCard>
        </div>
      )}

      {tab === 'bundle' && isBundleable && (
        <SectionCard
          title="Bundle Components"
          description="Make this product a kit of others - its own price above is kept independently."
          actions={(
            <Button size="sm" variant="outline" onClick={() => setAddComponentOpen(true)}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Add Component
            </Button>
          )}
        >
          {bundleLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading components…
            </div>
          )}
          {!bundleLoading && bundleItems.length === 0 && (
            <EmptyState
              icon={<Boxes className="size-8" aria-hidden="true" />}
              title="Not a bundle yet"
              description="Add a component to turn this product into a kit of others."
              action={(
                <Button size="sm" onClick={() => setAddComponentOpen(true)}>
                  <Plus className="mr-1.5 size-4" aria-hidden="true" />
                  Add Component
                </Button>
              )}
            />
          )}
          {!bundleLoading && bundleItems.length > 0 && (
            <div className="space-y-4">
              <KPICard
                label="Components Total"
                value={bundleTotal.toFixed(2)}
                unit={product.currency ?? undefined}
                icon={<Package className="size-5" aria-hidden="true" />}
                variant="primary"
                size="sm"
                description={`${bundleItems.length} component${bundleItems.length === 1 ? '' : 's'}`}
              />
              <div className="divide-y divide-border rounded-lg border border-border">
                {bundleItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Package className="size-4" aria-hidden="true" />
                    </div>
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
            </div>
          )}
        </SectionCard>
      )}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <SectionCard title="Custom Fields">
          <CustomFieldsSection
            recordTable="crm_products"
            recordId={Number(product.id)}
            values={customValues}
            onChange={setCustomValues}
            onFieldsLoaded={(fields) => setHasCustomFields(fields.length > 0)}
          />
          {hasCustomFields && (
            <div className="flex items-center gap-3 pt-4">
              <Button size="sm" disabled={savingCustom} onClick={() => void saveCustomFields()}>
                {savingCustom && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
                Save
              </Button>
              {customNotice && <span className="text-xs text-muted-foreground">{customNotice}</span>}
            </div>
          )}
        </SectionCard>
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
