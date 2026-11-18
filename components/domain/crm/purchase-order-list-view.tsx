'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, FileUp, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmPicklistValue, CrmPurchaseOrder } from '@/types/crm'
import { CreatePurchaseOrderModal } from './create-purchase-order-modal'
import { CrmBulkActionBar } from './crm-bulk-action-bar'
import { crmBulkResultMessage } from './crm-bulk-result-message'
import { CrmExportButton } from './crm-export-button'
import { CrmImportDialog } from './crm-import-dialog'
import { CrmRecycleBinLink } from './crm-recycle-bin-link'
import { CrmSavedViews } from './crm-saved-views'
import { useAssignableEmployees } from './lead-employees'

type SortKey = 'subject' | 'total' | 'po_stage' | 'due_date' | 'created_at'

const IMPORT_HEADER_MAP: Record<string, string> = {
  subject: 'subject', vendor: 'vendorId', vendorid: 'vendorId', 'po stage': 'poStage', 'due date': 'dueDate',
  currency: 'currency', 'requisition no': 'requisitionNo', 'tracking no': 'trackingNo',
  'terms & conditions': 'termsConditions', 'terms and conditions': 'termsConditions',
  description: 'description', 'assigned to (user id)': 'assignedTo', 'assigned to': 'assignedTo',
}

const TEMPLATE_HEADERS = [
  'Subject', 'VendorId', 'PO Stage', 'Due Date', 'Currency', 'Requisition No', 'Tracking No',
  'Terms & Conditions', 'Description', 'Assigned To (user id)',
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

function money(currency: string | null, n: number): string {
  return `${currency ?? ''} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()
}

export function PurchaseOrderListView() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [purchaseOrders, setPurchaseOrders] = useState<CrmPurchaseOrder[]>([])
  const { selectedIds, toggle, toggleAll, clear: clearSelection, allSelected } = useBulkSelection(purchaseOrders)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<CrmPurchaseOrder | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [poStages, setPoStages] = useState<CrmPicklistValue[]>([])

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    clearSelection()
    try {
      const response = await crmService.getPurchaseOrders(context, {
        page, perPage: PAGE_SIZE, search: search || undefined,
        sortBy: sortKey, sortDir: sortAsc ? 'asc' : 'desc',
      })
      setPurchaseOrders(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load purchase orders.')
    } finally {
      setIsLoading(false)
    }
  }, [context, page, search, sortKey, sortAsc, clearSelection])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'purchase_orders')
      .then((response) => setPoStages(response.data.purchase_orders?.po_stage ?? []))
      .catch(() => { /* the form still works with empty dropdowns */ })
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
    if (!window.confirm(`Delete ${selectedIds.size} purchase order${selectedIds.size === 1 ? '' : 's'}? This moves them to the Recycle Bin.`)) return
    setBulkBusy(true)
    try {
      const response = await crmService.bulkDeletePurchaseOrders(context, Array.from(selectedIds))
      setNotice(crmBulkResultMessage('Deleted', 'purchase order', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the selected purchase orders.')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReassign = async (assigneeId: string) => {
    setBulkBusy(true)
    try {
      const response = await crmService.bulkAssignPurchaseOrders(context, Array.from(selectedIds), assigneeId)
      setNotice(crmBulkResultMessage('Reassigned', 'purchase order', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reassign the selected purchase orders.')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">Itemized orders placed with vendors, with taxes, discounts and shipment tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          <CrmRecycleBinLink />
          <CrmExportButton href={crmService.purchaseOrdersExportUrl(context, search || undefined)} />
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileUp className="mr-1.5 size-4" aria-hidden="true" />
            Import
          </Button>
          <Button onClick={() => { setEditingPurchaseOrder(null); setModalOpen(true) }}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Add Purchase Order
          </Button>
        </div>
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} placeholder="Search subject…" className="pl-9" />
        </div>
        <CrmSavedViews module="purchase_orders" currentConditions={{ search, sortKey, sortAsc }} onApply={handleApplyView} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" aria-label="Select all purchase orders on this page" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
              </TableHead>
              <SortHead label="Subject" sortKey="subject" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <TableHead>Vendor</TableHead>
              <SortHead label="Stage" sortKey="po_stage" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Total" sortKey="total" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Due Date" sortKey="due_date" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading purchase orders…
              </TableCell></TableRow>
            )}
            {!isLoading && purchaseOrders.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                No purchase orders yet. Click “Add Purchase Order” to create one.
              </TableCell></TableRow>
            )}
            {!isLoading && purchaseOrders.map((po) => (
              <TableRow key={po.id} className="cursor-pointer" onClick={() => router.push(resolveAccessLink('/module/crm/sales/purchase-orders') + `/${po.id}`)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${po.subject}`} checked={selectedIds.has(po.id)} onChange={() => toggle(po.id)} />
                </TableCell>
                <TableCell className="font-medium text-foreground">{po.subject}</TableCell>
                <TableCell>{po.vendorName || '—'}</TableCell>
                <TableCell>{po.poStage || '—'}</TableCell>
                <TableCell>{money(po.currency, po.total)}</TableCell>
                <TableCell>{po.dueDate || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} purchase order{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <CreatePurchaseOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load() }}
        purchaseOrder={editingPurchaseOrder}
        poStages={poStages}
      />

      <CrmImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        noun="purchase order"
        headerMap={IMPORT_HEADER_MAP}
        templateHeaders={TEMPLATE_HEADERS}
        templateFilename="purchase-orders-template.csv"
        submitImport={crmService.importPurchaseOrders}
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
