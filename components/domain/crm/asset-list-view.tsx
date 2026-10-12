'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Copy, FileUp, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmAsset } from '@/types/crm'
import { CreateAssetModal } from './create-asset-modal'
import { CrmBulkActionBar } from './crm-bulk-action-bar'
import { crmBulkResultMessage } from './crm-bulk-result-message'
import { CrmDuplicatesDialog } from './crm-duplicates-dialog'
import { CrmExportButton } from './crm-export-button'
import { CrmImportDialog } from './crm-import-dialog'
import { CrmRecycleBinLink } from './crm-recycle-bin-link'
import { CrmSavedViews } from './crm-saved-views'
import { useAssignableEmployees } from './lead-employees'

type SortKey = 'asset_name' | 'status' | 'date_sold' | 'date_in_service' | 'created_at'

const ASSET_IMPORT_HEADER_MAP: Record<string, string> = {
  'asset name': 'assetName', 'product id': 'productId', 'organization id': 'organizationId',
  'serial number': 'serialNumber', 'tag number': 'tagNumber', status: 'status',
  'date sold': 'dateSold', 'date in service': 'dateInService', 'shipping method': 'shippingMethod',
  'shipping tracking number': 'shippingTrackingNumber', 'invoice id': 'invoiceId',
  description: 'description', 'assigned to (user id)': 'assignedTo', 'assigned to': 'assignedTo',
}

const ASSET_TEMPLATE_HEADERS = [
  'Asset Name', 'Product Id', 'Organization Id', 'Serial Number', 'Tag Number', 'Status',
  'Date Sold', 'Date In Service', 'Shipping Method', 'Shipping Tracking Number', 'Invoice Id',
  'Description', 'Assigned To (user id)',
] as const

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'processing' | 'inactive'> = {
  'In Service': 'success', 'In Stock': 'default', 'Under Repair': 'warning', Retired: 'inactive', Lost: 'error',
}

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

export function AssetListView() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [assets, setAssets] = useState<CrmAsset[]>([])
  const { selectedIds, toggle, toggleAll, clear: clearSelection, allSelected } = useBulkSelection(assets)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
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
      const response = await crmService.getAssets(context, {
        page, perPage: PAGE_SIZE, search: search || undefined,
        sortBy: sortKey, sortDir: sortAsc ? 'asc' : 'desc',
      })
      setAssets(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load assets.')
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
    if (!window.confirm(`Delete ${selectedIds.size} asset${selectedIds.size === 1 ? '' : 's'}? This moves them to the Recycle Bin.`)) return
    setBulkBusy(true)
    try {
      const response = await crmService.bulkDeleteAssets(context, Array.from(selectedIds))
      setNotice(crmBulkResultMessage('Deleted', 'asset', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the selected assets.')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReassign = async (assigneeId: string) => {
    setBulkBusy(true)
    try {
      const response = await crmService.bulkAssignAssets(context, Array.from(selectedIds), assigneeId)
      setNotice(crmBulkResultMessage('Reassigned', 'asset', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reassign the selected assets.')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Assets</h1>
          <p className="text-sm text-muted-foreground">Serialized units of a Product, owned by an Organization.</p>
        </div>
        <div className="flex items-center gap-2">
          <CrmRecycleBinLink />
          <CrmExportButton href={crmService.assetsExportUrl(context, search || undefined)} />
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
            Add Asset
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} placeholder="Search name, asset #, serial, or tag…" className="pl-9" />
        </div>
        <CrmSavedViews module="assets" currentConditions={{ search, sortKey, sortAsc }} onApply={handleApplyView} />
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="@container/assets overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all assets on this page"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </TableHead>
              <SortHead label="Asset Name" sortKey="asset_name" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <TableHead className="hidden @md/assets:table-cell">Product</TableHead>
              <TableHead className="hidden @md/assets:table-cell">Organization</TableHead>
              <TableHead>Serial Number</TableHead>
              <SortHead label="Status" sortKey="status" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading assets…
              </TableCell></TableRow>
            )}
            {!isLoading && assets.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                No assets yet. Click “Add Asset” to create one.
              </TableCell></TableRow>
            )}
            {!isLoading && assets.map((asset) => (
              <TableRow key={asset.id} className="cursor-pointer" onClick={() => router.push(resolveAccessLink('/module/crm/support/assets') + `/${asset.id}`)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${asset.assetName}`}
                    checked={selectedIds.has(asset.id)}
                    onChange={() => toggle(asset.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-foreground">{asset.assetName}</TableCell>
                <TableCell className="hidden @md/assets:table-cell">{asset.productName || '—'}</TableCell>
                <TableCell className="hidden @md/assets:table-cell">{asset.organizationName || '—'}</TableCell>
                <TableCell>{asset.serialNumber || '—'}</TableCell>
                <TableCell>
                  {asset.status
                    ? <StatusBadge variant={STATUS_VARIANT[asset.status] ?? 'default'}>{asset.status}</StatusBadge>
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} asset{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <CreateAssetModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load() }}
        asset={null}
      />

      <CrmDuplicatesDialog
        isOpen={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        noun="asset"
        getDuplicates={crmService.getAssetDuplicates}
        merge={crmService.mergeAssets}
        getLabel={(row) => (row.assetName as string) ?? 'Unnamed'}
        getSubLabel={(row) => (row.serialNumber as string | null) ?? (row.tagNumber as string | null)}
        onMerged={() => void load()}
      />

      <CrmImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        noun="asset"
        headerMap={ASSET_IMPORT_HEADER_MAP}
        templateHeaders={ASSET_TEMPLATE_HEADERS}
        templateFilename="assets-template.csv"
        submitImport={crmService.importAssets}
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
