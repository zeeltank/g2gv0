'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Columns3, Copy, FileUp, List, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmOpportunity, CrmPicklistValue } from '@/types/crm'
import { CreateOpportunityModal } from './create-opportunity-modal'
import { CrmBulkActionBar } from './crm-bulk-action-bar'
import { crmBulkResultMessage } from './crm-bulk-result-message'
import { CrmExportButton } from './crm-export-button'
import { CrmImportDialog } from './crm-import-dialog'
import { CrmRecycleBinLink } from './crm-recycle-bin-link'
import { CrmSavedViews } from './crm-saved-views'
import { OpportunityKanbanView } from './opportunity-kanban-view'
import { useAssignableEmployees } from './lead-employees'

type SortKey = 'name' | 'amount' | 'sales_stage' | 'closing_date' | 'created_at'
type ViewMode = 'kanban' | 'table'

const IMPORT_HEADER_MAP: Record<string, string> = {
  name: 'name', amount: 'amount', currency: 'currency', 'sales stage': 'salesStage',
  probability: 'probability', 'closing date': 'closingDate', 'lead source': 'leadSource',
  type: 'potentialType', 'next step': 'nextStep', 'forecast category': 'forecastCategory',
  description: 'description', 'assigned to (user id)': 'assignedTo', 'assigned to': 'assignedTo',
}

const TEMPLATE_HEADERS = [
  'Name', 'Amount', 'Currency', 'Sales Stage', 'Probability', 'Closing Date',
  'Lead Source', 'Type', 'Next Step', 'Forecast Category', 'Description', 'Assigned To (user id)',
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

export function OpportunityListView() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [view, setView] = useState<ViewMode>('kanban')
  /**
   * OpportunityKanbanView owns its own fetch/state (it's also reachable on
   * its own merits, not just through this list view) - `load()` below is
   * the table view's own fetch and silently no-ops while the board is
   * showing (`if (view !== 'table') return`), so it can never refresh the
   * board after a create/import. Bumping this and keying the board
   * component on it forces a full remount - the simplest correct way to
   * tell an isolated child "your data is stale, fetch again" without
   * threading a reload callback through it.
   */
  const [kanbanReloadToken, setKanbanReloadToken] = useState(0)
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([])
  const { selectedIds, toggle, toggleAll, clear: clearSelection, allSelected } = useBulkSelection(opportunities)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingOpportunity, setEditingOpportunity] = useState<CrmOpportunity | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [picklists, setPicklists] = useState<{ salesStage: CrmPicklistValue[]; leadSource: CrmPicklistValue[]; potentialType: CrmPicklistValue[]; forecastCategory: CrmPicklistValue[] }>({ salesStage: [], leadSource: [], potentialType: [], forecastCategory: [] })

  const load = useCallback(async () => {
    if (view !== 'table') return
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    clearSelection()
    try {
      const response = await crmService.getOpportunities(context, {
        page, perPage: PAGE_SIZE, search: search || undefined,
        sortBy: sortKey, sortDir: sortAsc ? 'asc' : 'desc',
      })
      setOpportunities(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load opportunities.')
    } finally {
      setIsLoading(false)
    }
  }, [context, view, page, search, sortKey, sortAsc, clearSelection])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'opportunities')
      .then((response) => {
        const opp = response.data.opportunities ?? {}
        setPicklists({
          salesStage: opp.sales_stage ?? [], leadSource: opp.lead_source ?? [],
          potentialType: opp.potential_type ?? [], forecastCategory: opp.forecast_category ?? [],
        })
      })
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
    if (!window.confirm(`Delete ${selectedIds.size} opportunit${selectedIds.size === 1 ? 'y' : 'ies'}? This moves them to the Recycle Bin.`)) return
    setBulkBusy(true)
    try {
      const response = await crmService.bulkDeleteOpportunities(context, Array.from(selectedIds))
      setNotice(crmBulkResultMessage('Deleted', 'opportunity', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the selected opportunities.')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReassign = async (assigneeId: string) => {
    setBulkBusy(true)
    try {
      const response = await crmService.bulkAssignOpportunities(context, Array.from(selectedIds), assigneeId)
      setNotice(crmBulkResultMessage('Reassigned', 'opportunity', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reassign the selected opportunities.')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Opportunities</h1>
          <p className="text-sm text-muted-foreground">Deals you are tracking through your sales pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <Button variant={view === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setView('kanban')}>
              <Columns3 className="mr-1.5 size-4" aria-hidden="true" />
              Board
            </Button>
            <Button variant={view === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setView('table')}>
              <List className="mr-1.5 size-4" aria-hidden="true" />
              Table
            </Button>
          </div>
          <CrmRecycleBinLink />
          <CrmExportButton href={crmService.opportunitiesExportUrl(context, search || undefined)} />
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileUp className="mr-1.5 size-4" aria-hidden="true" />
            Import
          </Button>
          <Button onClick={() => { setEditingOpportunity(null); setModalOpen(true) }}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Add Opportunity
          </Button>
        </div>
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      {view === 'kanban' && <OpportunityKanbanView key={kanbanReloadToken} />}

      {view === 'table' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} placeholder="Search name…" className="pl-9" />
            </div>
            <CrmSavedViews module="opportunities" currentConditions={{ search, sortKey, sortAsc }} onApply={handleApplyView} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input type="checkbox" aria-label="Select all opportunities on this page" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
                  </TableHead>
                  <SortHead label="Name" sortKey="name" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
                  <TableHead>Organization</TableHead>
                  <SortHead label="Stage" sortKey="sales_stage" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
                  <SortHead label="Amount" sortKey="amount" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
                  <SortHead label="Closing Date" sortKey="closing_date" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading opportunities…
                  </TableCell></TableRow>
                )}
                {!isLoading && opportunities.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No opportunities yet. Click “Add Opportunity” to create one.
                  </TableCell></TableRow>
                )}
                {!isLoading && opportunities.map((opportunity) => (
                  <TableRow key={opportunity.id} className="cursor-pointer" onClick={() => router.push(resolveAccessLink('/module/crm/sales/opportunities') + `/${opportunity.id}`)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${opportunity.name}`} checked={selectedIds.has(opportunity.id)} onChange={() => toggle(opportunity.id)} />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{opportunity.name}</TableCell>
                    <TableCell>{opportunity.organizationName || '—'}</TableCell>
                    <TableCell>{opportunity.salesStage || '—'}</TableCell>
                    <TableCell>{opportunity.amount !== null ? `${opportunity.currency ?? ''} ${opportunity.amount.toLocaleString()}`.trim() : '—'}</TableCell>
                    <TableCell>{opportunity.closingDate || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} opportunit{total === 1 ? 'y' : 'ies'}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span>Page {page} of {lastPage}</span>
              <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <CreateOpportunityModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load(); setKanbanReloadToken((n) => n + 1) }}
        opportunity={editingOpportunity}
        picklists={picklists}
      />

      <CrmImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        noun="opportunity"
        headerMap={IMPORT_HEADER_MAP}
        templateHeaders={TEMPLATE_HEADERS}
        templateFilename="opportunities-template.csv"
        submitImport={crmService.importOpportunities}
        onImported={() => { void load(); setKanbanReloadToken((n) => n + 1) }}
      />

      {view === 'table' && (
        <CrmBulkActionBar
          count={selectedIds.size}
          busy={bulkBusy}
          people={employees.map((e) => ({ value: e.id, label: e.name }))}
          onReassign={(assigneeId) => void handleBulkReassign(assigneeId)}
          onDelete={() => void handleBulkDelete()}
          onClear={clearSelection}
        />
      )}
    </div>
  )
}
