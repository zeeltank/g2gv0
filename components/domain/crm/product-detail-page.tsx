'use client'

import { useState } from 'react'
import { ArrowLeft, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import type { CrmPicklistValue, CrmProduct, CrmTaxRate } from '@/types/crm'
import { CreateProductModal } from './create-product-modal'

interface Props {
  product: CrmProduct
  onSaved: () => void
  onBack: () => void
  categories: CrmPicklistValue[]
  taxRates: CrmTaxRate[]
}

type Tab = 'details' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [{ id: 'details', label: 'Details' }]

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
  const noun = product.itemType === 'service' ? 'Service' : 'Product'
  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const tabs = hasCustomFields ? [...BASE_TABS, { id: 'custom' as const, label: 'Custom Fields' }] : BASE_TABS

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
            <h2 className="text-sm font-semibold text-foreground">{noun} Details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {product.itemType === 'product' && <Field label="SKU" value={product.sku} />}
              <Field label="Category" value={product.category} />
              <Field label="Unit Price" value={product.unitPrice !== null ? `${product.currency ?? ''} ${product.unitPrice.toFixed(2)}`.trim() : null} />
              <Field label="Cost Price" value={product.costPrice !== null ? `${product.currency ?? ''} ${product.costPrice.toFixed(2)}`.trim() : null} />
              <Field label="Default Tax Rate" value={product.taxRateName} />
              <Field label="Active" value={product.isActive ? 'Yes' : 'No'} />
              {product.itemType === 'product' && (
                <>
                  <Field label="Vendor" value={product.vendor} />
                  <Field label="Qty In Stock" value={product.qtyInStock} />
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
    </div>
  )
}
