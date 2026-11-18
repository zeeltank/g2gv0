'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, CheckCircle2, DollarSign, Loader2, Package, Pencil, Plus, Tag, Trash2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmPriceBook, CrmPriceBookItem } from '@/types/crm'
import { CreatePriceBookModal } from './create-price-book-modal'

interface Props {
  priceBook: CrmPriceBook
  onSaved: () => void
  onBack: () => void
}

function AddPriceBookItemDialog({ isOpen, onClose, onAdded, priceBookId, existingProductIds }: {
  isOpen: boolean; onClose: () => void; onAdded: () => void; priceBookId: string; existingProductIds: Set<string>
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const [options, setOptions] = useState<Array<{ id: string; label: string; unitPrice: number | null }>>([])
  const [productId, setProductId] = useState('')
  const [listPrice, setListPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !isLaravelContextReady(context)) return
    Promise.all([
      crmService.getProducts(context, 'product', { perPage: 100, sortBy: 'name', sortDir: 'asc' }),
      crmService.getProducts(context, 'service', { perPage: 100, sortBy: 'name', sortDir: 'asc' }),
    ])
      .then(([products, services]) => setOptions(
        [...products.data.items, ...services.data.items]
          .filter((p) => !existingProductIds.has(p.id))
          .map((p) => ({ id: p.id, label: p.name, unitPrice: p.unitPrice })),
      ))
      .catch(() => { /* the form still works with an empty picker */ })
  }, [isOpen, context, existingProductIds])

  const selected = options.find((o) => o.id === productId)

  const submit = async () => {
    if (!productId || !listPrice.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await crmService.addPriceBookItem(context, priceBookId, productId, Number(listPrice))
      setProductId('')
      setListPrice('')
      onAdded()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add this price.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Product Price</DialogTitle>
          <DialogDescription>Set this product or service&apos;s price in this book - overrides its base price only here.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product / Service</Label>
            <SearchableSelect
              value={productId}
              onChange={(v) => { setProductId(v); const opt = options.find((o) => o.id === v); setListPrice(opt?.unitPrice != null ? String(opt.unitPrice) : '') }}
              options={options.map((o) => ({ value: o.id, label: o.label }))}
              placeholder="Choose one…"
            />
            {selected?.unitPrice != null && <p className="text-xs text-muted-foreground">Base price: {selected.unitPrice.toFixed(2)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pb-item-price">List Price *</Label>
            <Input id="pb-item-price" type="number" min={0} step="0.01" value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
          </div>
        </div>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !productId || !listPrice.trim()}>{submitting ? 'Adding…' : 'Add'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PriceBookDetailPage({ priceBook, onSaved, onBack }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [items, setItems] = useState<CrmPriceBookItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [addItemOpen, setAddItemOpen] = useState(false)

  const loadItems = useCallback(async () => {
    setItemsLoading(true)
    try {
      const response = await crmService.getPriceBookItems(context, priceBook.id)
      setItems(response.data)
    } catch {
      /* the page still renders, just empty */
    } finally {
      setItemsLoading(false)
    }
  }, [context, priceBook.id])

  useEffect(() => {
    queueMicrotask(() => { void loadItems() })
  }, [loadItems])

  const removeItem = async (rowId: string) => {
    try {
      await crmService.removePriceBookItem(context, priceBook.id, rowId)
      void loadItems()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to remove that price.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Price Books" title="Back to Price Books">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <BookOpen className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{priceBook.name}</h1>
            <p className="text-sm text-muted-foreground">{priceBook.currency || 'No currency set'} · {priceBook.priceBookNo}</p>
          </div>
        </div>
        <Button onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 size-4" aria-hidden="true" />
          Edit
        </Button>
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}

      <SectionCard title="Price Book Details">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ReadField label="Currency" value={priceBook.currency && <span className="inline-flex items-center gap-1.5"><DollarSign className="size-3.5 text-muted-foreground" aria-hidden="true" />{priceBook.currency}</span>} />
          <ReadField
            label="Status"
            value={priceBook.isActive
              ? <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="size-3.5" aria-hidden="true" />Active</span>
              : <span className="inline-flex items-center gap-1.5 text-muted-foreground"><XCircle className="size-3.5" aria-hidden="true" />Inactive</span>}
          />
        </dl>
        {priceBook.description && (
          <p className="mt-4 border-t border-border pt-4 text-sm text-foreground">{priceBook.description}</p>
        )}
      </SectionCard>

      <SectionCard
        title="Product Prices"
        description="Per-product override price in this book - each product's base price (set on the product itself) is used instead for anything not listed here."
        actions={(
          <Button size="sm" variant="outline" onClick={() => setAddItemOpen(true)}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Add Product Price
          </Button>
        )}
      >
        {itemsLoading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading prices…
          </div>
        )}
        {!itemsLoading && items.length === 0 && (
          <EmptyState
            icon={<Tag className="size-8" aria-hidden="true" />}
            title="No product prices yet"
            description="Add a product or service to set what it costs in this price book."
            action={(
              <Button size="sm" onClick={() => setAddItemOpen(true)}>
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                Add Product Price
              </Button>
            )}
          />
        )}
        {!itemsLoading && items.length > 0 && (
          <div className="divide-y divide-border rounded-lg border border-border">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Package className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.itemType === 'service' ? 'Service' : 'Product'}
                    {item.basePrice !== null ? ` · Base ${item.basePrice.toFixed(2)}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-foreground">
                  {priceBook.currency ?? ''} {item.listPrice.toFixed(2)}
                </p>
                <Button variant="ghost" size="icon-sm" onClick={() => void removeItem(item.id)} aria-label={`Remove ${item.name}`}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <CreatePriceBookModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        priceBook={priceBook}
      />
      <AddPriceBookItemDialog
        isOpen={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        onAdded={loadItems}
        priceBookId={priceBook.id}
        existingProductIds={new Set(items.map((i) => i.productId))}
      />
    </div>
  )
}
