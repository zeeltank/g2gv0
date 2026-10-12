'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, FileUp, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmPicklistValue, CrmSalesOrder } from '@/types/crm'
import { CreateSalesOrderModal } from './create-sales-order-modal'
import { CrmBulkActionBar } from './crm-bulk-action-bar'
import { crmBulkResultMessage } from './crm-bulk-result-message'
import { CrmExportButton } from './crm-export-button'
import { CrmImportDialog } from './crm-import-dialog'
import { CrmRecycleBinLink } from './crm-recycle-bin-link'
import { CrmSavedViews } from './crm-saved-views'
import { useAssignableEmployees } from './lead-employees'
import { useQuoteOptions } from './quote-options'

type SortKey = 'subject' | 'total' | 'so_stage' | 'due_date' | 'created_at'

const IMPORT_HEADER_MAP: Record<string, string> = {
  subject: 'subject', 'so stage': 'soStage', 'due date': 'dueDate', carrier: 'carrier', currency: 'currency',
  'terms & conditions': 'termsConditions', 'terms and conditions': 'termsConditions',
  description: 'description', 'assigned to (user id)': 'assignedTo', 'assigned to': 'assignedTo',
}

const TEMPLATE_HEADERS = [
  'Subject', 'So Stage', 'Due Date', 'Carrier', 'Currency', 'Terms & Conditions', 'Description', 'Assigned To (user id)',
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

/** Quick "create a Sales Order from an existing Quote" picker - the list view's own entry point for the conversion flow (quote-detail-page.tsx is a sibling entity's file and is never edited here). */
function CreateFromQuoteDialog({ isOpen, onClose, onPicked }: { isOpen: boolean; onClose: () => void; onPicked: (quoteId: string) => void }) {
  const context = useMemo(() => getLaravelContext(), [])
  const quotes = useQuoteOptions(context, isOpen)
  const [quoteId, setQuoteId] = useState('')

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create from Quote</DialogTitle>
          <DialogDescription>Pick a quote to convert into a new Sales Order - its organization, addresses, terms and line items are copied over.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Quote</Label>
          <SearchableSelect value={quoteId} onChange={setQuoteId} options={quotes.map((q) => ({ value: q.id, label: `${q.subject} (${q.quoteNo ?? ''})` }))} placeholder="Choose a quote…" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!quoteId} onClick={() => { onPicked(quoteId); setQuoteId('') }}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SalesOrderListView() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [salesOrders, setSalesOrders] = useState<CrmSalesOrder[]>([])
  const { selectedIds, toggle, toggleAll, clear: clearSelection, allSelected } = useBulkSelection(salesOrders)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSalesOrder, setEditingSalesOrder] = useState<CrmSalesOrder | null>(null)
  const [fromQuoteId, setFromQuoteId] = useState<string | null>(null)
  const [pickQuoteOpen, setPickQuoteOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [soStages, setSoStages] = useState<CrmPicklistValue[]>([])

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    clearSelection()
    try {
      const response = await crmService.getSalesOrders(context, {
        page, perPage: PAGE_SIZE, search: search || undefined,
        sortBy: sortKey, sortDir: sortAsc ? 'asc' : 'desc',
      })
      setSalesOrders(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load sales orders.')
    } finally {
      setIsLoading(false)
    }
  }, [context, page, search, sortKey, sortAsc, clearSelection])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'sales_orders')
      .then((response) => setSoStages(response.data.sales_orders?.so_stage ?? []))
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
    if (!window.confirm(`Delete ${selectedIds.size} sales order${selectedIds.size === 1 ? '' : 's'}? This moves them to the Recycle Bin.`)) return
    setBulkBusy(true)
    try {
      const response = await crmService.bulkDeleteSalesOrders(context, Array.from(selectedIds))
      setNotice(crmBulkResultMessage('Deleted', 'sales order', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the selected sales orders.')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReassign = async (assigneeId: string) => {
    setBulkBusy(true)
    try {
      const response = await crmService.bulkAssignSalesOrders(context, Array.from(selectedIds), assigneeId)
      setNotice(crmBulkResultMessage('Reassigned', 'sales order', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reassign the selected sales orders.')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sales Orders</h1>
          <p className="text-sm text-muted-foreground">Confirmed orders ready for fulfillment, created standalone or converted from a Quote.</p>
        </div>
        <div className="flex items-center gap-2">
          <CrmRecycleBinLink />
          <CrmExportButton href={crmService.salesOrdersExportUrl(context, search || undefined)} />
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileUp className="mr-1.5 size-4" aria-hidden="true" />
            Import
          </Button>
          <Button variant="outline" onClick={() => setPickQuoteOpen(true)}>
            Create from Quote
          </Button>
          <Button onClick={() => { setEditingSalesOrder(null); setFromQuoteId(null); setModalOpen(true) }}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Add Sales Order
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
        <CrmSavedViews module="sales_orders" currentConditions={{ search, sortKey, sortAsc }} onApply={handleApplyView} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" aria-label="Select all sales orders on this page" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
              </TableHead>
              <SortHead label="Subject" sortKey="subject" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <TableHead>Organization</TableHead>
              <SortHead label="Stage" sortKey="so_stage" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Total" sortKey="total" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Due Date" sortKey="due_date" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading sales orders…
              </TableCell></TableRow>
            )}
            {!isLoading && salesOrders.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                No sales orders yet. Click “Add Sales Order” to create one.
              </TableCell></TableRow>
            )}
            {!isLoading && salesOrders.map((salesOrder) => (
              <TableRow key={salesOrder.id} className="cursor-pointer" onClick={() => router.push(resolveAccessLink('/module/crm/sales/sales-orders') + `/${salesOrder.id}`)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${salesOrder.subject}`} checked={selectedIds.has(salesOrder.id)} onChange={() => toggle(salesOrder.id)} />
                </TableCell>
                <TableCell className="font-medium text-foreground">{salesOrder.subject}</TableCell>
                <TableCell>{salesOrder.organizationName || '—'}</TableCell>
                <TableCell>{salesOrder.soStage || '—'}</TableCell>
                <TableCell>{money(salesOrder.currency, salesOrder.total)}</TableCell>
                <TableCell>{salesOrder.dueDate || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} sales order{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <CreateSalesOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load() }}
        salesOrder={editingSalesOrder}
        soStages={soStages}
        prefillFromQuoteId={fromQuoteId}
      />

      <CreateFromQuoteDialog
        isOpen={pickQuoteOpen}
        onClose={() => setPickQuoteOpen(false)}
        onPicked={(quoteId) => { setFromQuoteId(quoteId); setEditingSalesOrder(null); setPickQuoteOpen(false); setModalOpen(true) }}
      />

      <CrmImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        noun="sales order"
        headerMap={IMPORT_HEADER_MAP}
        templateHeaders={TEMPLATE_HEADERS}
        templateFilename="sales-orders-template.csv"
        submitImport={crmService.importSalesOrders}
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
