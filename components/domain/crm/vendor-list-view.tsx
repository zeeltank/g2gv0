'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ChevronDown, Copy, FileUp, Loader2, Plus, Search, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmVendor } from '@/types/crm'
import { CreateVendorModal } from './create-vendor-modal'
import { CrmBulkActionBar } from './crm-bulk-action-bar'
import { crmBulkResultMessage } from './crm-bulk-result-message'
import { CrmDuplicatesDialog } from './crm-duplicates-dialog'
import { CrmExportButton } from './crm-export-button'
import { CrmImportDialog } from './crm-import-dialog'
import { CrmRecycleBinLink } from './crm-recycle-bin-link'
import { CrmSavedViews } from './crm-saved-views'
import { useAssignableEmployees } from './lead-employees'

type SortKey = 'name' | 'category' | 'phone' | 'email' | 'created_at'

const VENDOR_IMPORT_HEADER_MAP: Record<string, string> = {
  name: 'name', category: 'category', phone: 'phone', email: 'email', website: 'website',
  'gl account': 'glAccount', street: 'street', city: 'city', state: 'state', country: 'country',
  'postal code': 'postalCode', 'po box': 'poBox', description: 'description',
  'assigned to (user id)': 'assignedTo', 'assigned to': 'assignedTo',
}

const VENDOR_TEMPLATE_HEADERS = [
  'Name', 'Category', 'Phone', 'Email', 'Website', 'GL Account', 'Street', 'City', 'State',
  'Country', 'Postal Code', 'PO Box', 'Description', 'Assigned To (user id)',
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

export function VendorListView() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [vendors, setVendors] = useState<CrmVendor[]>([])
  const { selectedIds, toggle, toggleAll, clear: clearSelection, allSelected } = useBulkSelection(vendors)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    clearSelection()
    try {
      const response = await crmService.getVendors(context, {
        page, perPage: PAGE_SIZE, search: search || undefined,
        sortBy: sortKey, sortDir: sortAsc ? 'asc' : 'desc',
      })
      setVendors(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load vendors.')
    } finally {
      setIsLoading(false)
    }
  }, [context, page, search, sortKey, sortAsc, clearSelection])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

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
    if (!window.confirm(`Delete ${selectedIds.size} vendor${selectedIds.size === 1 ? '' : 's'}? This moves them to the Recycle Bin.`)) return
    setBulkBusy(true)
    try {
      const response = await crmService.bulkDeleteVendors(context, Array.from(selectedIds))
      setNotice(crmBulkResultMessage('Deleted', 'vendor', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the selected vendors.')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReassign = async (assigneeId: string) => {
    setBulkBusy(true)
    try {
      const response = await crmService.bulkAssignVendors(context, Array.from(selectedIds), assigneeId)
      setNotice(crmBulkResultMessage('Reassigned', 'vendor', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reassign the selected vendors.')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Vendors</h1>
          <p className="text-sm text-muted-foreground">Suppliers you buy products and services from.</p>
        </div>
        <div className="flex items-center gap-2">
          <CrmRecycleBinLink />
          <CrmExportButton href={crmService.vendorsExportUrl(context, search || undefined)} />
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileUp className="mr-1.5 size-4" aria-hidden="true" />
            Import
          </Button>
          <Button variant="outline" onClick={() => setDuplicatesOpen(true)}>
            <Copy className="mr-1.5 size-4" aria-hidden="true" />
            Find Duplicates
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Add Vendor
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} placeholder="Search name, email, or phone…" className="pl-9" />
        </div>
        <CrmSavedViews module="vendors" currentConditions={{ search, sortKey, sortAsc }} onApply={handleApplyView} />
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="@container/vendors overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all vendors on this page"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </TableHead>
              <SortHead label="Name" sortKey="name" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Category" sortKey="category" activeKey={sortKey} asc={sortAsc} onSort={onSort} className="hidden @md/vendors:table-cell" />
              <SortHead label="Phone" sortKey="phone" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Email" sortKey="email" activeKey={sortKey} asc={sortAsc} onSort={onSort} className="hidden @md/vendors:table-cell" />
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading vendors…
              </TableCell></TableRow>
            )}
            {!isLoading && vendors.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                No vendors yet. Click “Add Vendor” to create one.
              </TableCell></TableRow>
            )}
            {!isLoading && vendors.map((vendor) => (
              <TableRow key={vendor.id} className="cursor-pointer" onClick={() => router.push(resolveAccessLink('/module/crm/sales/vendors') + `/${vendor.id}`)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${vendor.name}`}
                    checked={selectedIds.has(vendor.id)}
                    onChange={() => toggle(vendor.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-foreground">{vendor.name}</TableCell>
                <TableCell className="hidden @md/vendors:table-cell">{vendor.category || '—'}</TableCell>
                <TableCell>{vendor.phone || '—'}</TableCell>
                <TableCell className="hidden @md/vendors:table-cell">{vendor.email || '—'}</TableCell>
                <TableCell>
                  {vendor.isActive
                    ? <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="size-3.5" aria-hidden="true" />Active</span>
                    : <span className="inline-flex items-center gap-1.5 text-muted-foreground"><XCircle className="size-3.5" aria-hidden="true" />Inactive</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} vendor{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <CreateVendorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load() }}
        vendor={null}
      />

      <CrmDuplicatesDialog
        isOpen={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        noun="vendor"
        getDuplicates={crmService.getVendorDuplicates}
        merge={crmService.mergeVendors}
        getLabel={(row) => (row.name as string) ?? 'Unnamed'}
        getSubLabel={(row) => (row.website as string | null) ?? (row.phone as string | null)}
        onMerged={() => void load()}
      />

      <CrmImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        noun="vendor"
        headerMap={VENDOR_IMPORT_HEADER_MAP}
        templateHeaders={VENDOR_TEMPLATE_HEADERS}
        templateFilename="vendors-template.csv"
        submitImport={crmService.importVendors}
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
