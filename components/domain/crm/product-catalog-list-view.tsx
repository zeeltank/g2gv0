'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Copy, FileUp, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmItemType, CrmPicklistValue, CrmProduct, CrmTaxRate } from '@/types/crm'
import { CreateProductModal } from './create-product-modal'
import { CrmBulkActionBar } from './crm-bulk-action-bar'
import { crmBulkResultMessage } from './crm-bulk-result-message'
import { CrmDuplicatesDialog } from './crm-duplicates-dialog'
import { CrmExportButton } from './crm-export-button'
import { CrmImportDialog } from './crm-import-dialog'
import { CrmRecycleBinLink } from './crm-recycle-bin-link'
import { CrmSavedViews } from './crm-saved-views'
import { useAssignableEmployees } from './lead-employees'

type SortKey = 'name' | 'category' | 'unit_price' | 'qty_in_stock' | 'created_at'

const IMPORT_HEADER_MAP: Record<string, string> = {
  name: 'name', sku: 'sku', category: 'category', 'unit price': 'unitPrice', 'cost price': 'costPrice',
  currency: 'currency', vendor: 'vendor', 'qty in stock': 'qtyInStock', 'reorder level': 'reorderLevel',
  description: 'description', 'assigned to (user id)': 'assignedTo', 'assigned to': 'assignedTo',
}

const TEMPLATE_HEADERS = [
  'Name', 'SKU', 'Category', 'Unit Price', 'Cost Price', 'Currency', 'Vendor',
  'Qty In Stock', 'Reorder Level', 'Description', 'Assigned To (user id)',
] as const

const PAGE_SIZE = 20

function SortHead({ label, sortKey, activeKey, asc, onSort, className }: {
  label: string; sortKey: SortKey; activeKey: SortKey; asc: boolean
  onSort: (key: SortKey) => void; className?: string
}) {
  return (
    <TableHead className={className}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 normal-case text-foreground">
        {label}
        {activeKey === sortKey && <ChevronDown className={cn('size-3.5 transition-transform', asc && 'rotate-180')} />}
      </button>
    </TableHead>
  )
}

/**
 * Shared by both menu entries (Products, Services) - one unified
 * crm_products table. Each thin wrapper (product-list-view.tsx,
 * service-list-view.tsx) just supplies `itemType` + its own route segment.
 */
export function ProductCatalogListView({ itemType, routeSegment }: { itemType: CrmItemType; routeSegment: string }) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const noun = itemType === 'service' ? 'Service' : 'Product'
  const nounPlural = itemType === 'service' ? 'Services' : 'Products'

  const [products, setProducts] = useState<CrmProduct[]>([])
  const { selectedIds, toggle, toggleAll, clear: clearSelection, allSelected } = useBulkSelection(products)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<CrmProduct | null>(null)
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [categories, setCategories] = useState<CrmPicklistValue[]>([])
  const [taxRates, setTaxRates] = useState<CrmTaxRate[]>([])

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    clearSelection()
    try {
      const response = await crmService.getProducts(context, itemType, {
        page, perPage: PAGE_SIZE, search: search || undefined,
        sortBy: sortKey, sortDir: sortAsc ? 'asc' : 'desc',
      })
      setProducts(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to load ${nounPlural.toLowerCase()}.`)
    } finally {
      setIsLoading(false)
    }
  }, [context, itemType, nounPlural, page, search, sortKey, sortAsc, clearSelection])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'products')
      .then((response) => setCategories(response.data.products?.category ?? []))
      .catch(() => { /* the form still works with an empty dropdown */ })
    crmService.getTaxRates(context)
      .then((response) => setTaxRates(response.data))
      .catch(() => { /* the form still works with no tax-rate options */ })
  }, [context])

  const onSort = (key: SortKey) => {
    if (key === sortKey) { setSortAsc((a) => !a) } else { setSortKey(key); setSortAsc(true) }
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleApplyView = (conditions: Record<string, unknown>) => {
    if (typeof conditions.search === 'string') setSearch(conditions.search)
    if (typeof conditions.sortKey === 'string') setSortKey(conditions.sortKey as SortKey)
    if (typeof conditions.sortAsc === 'boolean') setSortAsc(conditions.sortAsc)
    setPage(1)
  }

  const [bulkBusy, setBulkBusy] = useState(false)
  const employees = useAssignableEmployees(context, selectedIds.size > 0)

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} ${selectedIds.size === 1 ? noun.toLowerCase() : nounPlural.toLowerCase()}? This moves them to the Recycle Bin.`)) return
    setBulkBusy(true)
    try {
      const response = await crmService.bulkDeleteProducts(context, Array.from(selectedIds))
      setNotice(crmBulkResultMessage('Deleted', noun.toLowerCase(), response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to delete the selected ${nounPlural.toLowerCase()}.`)
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReassign = async (assigneeId: string) => {
    setBulkBusy(true)
    try {
      const response = await crmService.bulkAssignProducts(context, Array.from(selectedIds), assigneeId)
      setNotice(crmBulkResultMessage('Reassigned', noun.toLowerCase(), response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to reassign the selected ${nounPlural.toLowerCase()}.`)
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{nounPlural}</h1>
          <p className="text-sm text-muted-foreground">
            {itemType === 'service' ? 'Your sellable service catalog.' : 'Your sellable product catalog.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CrmRecycleBinLink />
          <CrmExportButton href={crmService.productsExportUrl(context, itemType, search || undefined)} />
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileUp className="mr-1.5 size-4" aria-hidden="true" />
            Import
          </Button>
          <Button variant="outline" onClick={() => setDuplicatesOpen(true)}>
            <Copy className="mr-1.5 size-4" aria-hidden="true" />
            Find Duplicates
          </Button>
          <Button onClick={() => { setEditingProduct(null); setModalOpen(true) }}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Add {noun}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} placeholder="Search name, SKU, or number…" className="pl-9" />
        </div>
        <CrmSavedViews module={itemType === 'service' ? 'services' : 'products'} currentConditions={{ search, sortKey, sortAsc }} onApply={handleApplyView} />
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label={`Select all ${nounPlural.toLowerCase()} on this page`}
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </TableHead>
              <SortHead label="Name" sortKey="name" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Category" sortKey="category" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Unit Price" sortKey="unit_price" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              {itemType === 'product' && <SortHead label="Qty In Stock" sortKey="qty_in_stock" activeKey={sortKey} asc={sortAsc} onSort={onSort} />}
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading {nounPlural.toLowerCase()}…
              </TableCell></TableRow>
            )}
            {!isLoading && products.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                No {nounPlural.toLowerCase()} yet. Click “Add {noun}” to create one.
              </TableCell></TableRow>
            )}
            {!isLoading && products.map((product) => (
              <TableRow key={product.id} className="cursor-pointer" onClick={() => router.push(resolveAccessLink(`/module/crm/sales/${routeSegment}`) + `/${product.id}`)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${product.name}`}
                    checked={selectedIds.has(product.id)}
                    onChange={() => toggle(product.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                <TableCell>{product.category || '—'}</TableCell>
                <TableCell>{product.unitPrice !== null ? `${product.currency ?? ''} ${product.unitPrice.toFixed(2)}`.trim() : '—'}</TableCell>
                {itemType === 'product' && <TableCell>{product.qtyInStock ?? '—'}</TableCell>}
                <TableCell>{product.isActive ? 'Yes' : 'No'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} {total === 1 ? noun.toLowerCase() : nounPlural.toLowerCase()}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <CreateProductModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load() }}
        itemType={itemType}
        product={editingProduct}
        categories={categories}
        taxRates={taxRates}
      />

      <CrmDuplicatesDialog
        isOpen={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        noun={noun.toLowerCase()}
        getDuplicates={(ctx) => crmService.getProductDuplicates(ctx, itemType)}
        merge={crmService.mergeProducts}
        getLabel={(row) => (row.name as string) ?? 'Unnamed'}
        getSubLabel={(row) => (row.sku as string | null) ?? (row.productNo as string | null)}
        onMerged={() => void load()}
      />

      <CrmImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        noun={noun.toLowerCase()}
        headerMap={IMPORT_HEADER_MAP}
        templateHeaders={TEMPLATE_HEADERS}
        templateFilename={`${routeSegment}-template.csv`}
        submitImport={(ctx, rows) => crmService.importProducts(ctx, itemType, rows)}
        onImported={() => void load()}
      />

      <CrmBulkActionBar
        count={selectedIds.size}
        busy={bulkBusy}
        people={employees.map((e) => ({ value: e.id, label: e.name }))}
        onReassign={(assigneeId) => void handleBulkReassign(assigneeId)}
        onDelete={() => void handleBulkDelete()}
        onClear={clearSelection}
      />
    </div>
  )
}
