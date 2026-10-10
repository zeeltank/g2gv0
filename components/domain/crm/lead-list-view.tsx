'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmPicklistValue, Lead } from '@/types/crm'
import { CreateLeadModal } from './create-lead-modal'
import { CrmBulkActionBar } from './crm-bulk-action-bar'
import { crmBulkResultMessage } from './crm-bulk-result-message'
import { CrmRecycleBinLink } from './crm-recycle-bin-link'
import { CrmSavedViews } from './crm-saved-views'
import { useAssignableEmployees } from './lead-employees'

type SortKey = 'first_name' | 'last_name' | 'company' | 'email' | 'lead_status' | 'lead_source' | 'rating' | 'created_at'

const PAGE_SIZE = 20

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'default' | 'processing'> = {
  Qualified: 'success', 'Pre Qualified': 'success',
  Contacted: 'processing', 'Attempted to Contact': 'warning',
  'Not Contacted': 'default', 'Junk Lead': 'error', 'Lost Lead': 'error',
}

function SortHead({ label, sortKey, activeKey, asc, onSort, className }: {
  label: string; sortKey: SortKey; activeKey: SortKey; asc: boolean
  onSort: (key: SortKey) => void; className?: string
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 normal-case text-foreground"
      >
        {label}
        {activeKey === sortKey && <ChevronDown className={cn('size-3.5 transition-transform', asc && 'rotate-180')} />}
      </button>
    </TableHead>
  )
}

export function LeadListView() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [leads, setLeads] = useState<Lead[]>([])
  // Destructured (not kept as one `selection` object) so `load`'s deps array
  // below can name the stable `clear` function directly - a member access
  // like `selection.clear` reads as unstable to exhaustive-deps, which then
  // asks for the whole object, and that WOULD actually be unstable (a new
  // object every render), recreating `load` - and re-triggering its effect -
  // on every single checkbox click.
  const { selectedIds, toggle, toggleAll, clear: clearSelection, allSelected } = useBulkSelection(leads)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [picklists, setPicklists] = useState<{
    leadStatus: CrmPicklistValue[]; leadSource: CrmPicklistValue[]
    industry: CrmPicklistValue[]; rating: CrmPicklistValue[]
  }>({ leadStatus: [], leadSource: [], industry: [], rating: [] })

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    // A selection from a different page/filter refers to rows about to
    // disappear from `leads` - carrying it over would bulk-act on ids no
    // longer visible on screen.
    clearSelection()
    try {
      const response = await crmService.getLeads(context, {
        page, perPage: PAGE_SIZE, search: search || undefined,
        sortBy: sortKey, sortDir: sortAsc ? 'asc' : 'desc',
      })
      setLeads(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load leads.')
    } finally {
      setIsLoading(false)
    }
  }, [context, page, search, sortKey, sortAsc, clearSelection])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'leads')
      .then((response) => {
        const leads = response.data.leads ?? {}
        setPicklists({
          leadStatus: leads.lead_status ?? [], leadSource: leads.lead_source ?? [],
          industry: leads.industry ?? [], rating: leads.rating ?? [],
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
    if (!window.confirm(`Delete ${selectedIds.size} lead${selectedIds.size === 1 ? '' : 's'}? This moves them to the Recycle Bin.`)) return
    setBulkBusy(true)
    try {
      const response = await crmService.bulkDeleteLeads(context, Array.from(selectedIds))
      setNotice(crmBulkResultMessage('Deleted', 'lead', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the selected leads.')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReassign = async (assigneeId: string) => {
    setBulkBusy(true)
    try {
      const response = await crmService.bulkAssignLeads(context, Array.from(selectedIds), assigneeId)
      setNotice(crmBulkResultMessage('Reassigned', 'lead', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reassign the selected leads.')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">People and companies showing early interest, not yet customers.</p>
        </div>
        <div className="flex items-center gap-2">
          <CrmRecycleBinLink />
          <Button onClick={() => { setEditingLead(null); setModalOpen(true) }}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Add Lead
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value) }}
            placeholder="Search name, company, or email…"
            className="pl-9"
          />
        </div>
        <CrmSavedViews module="leads" currentConditions={{ search, sortKey, sortAsc }} onApply={handleApplyView} />
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="@container/leads overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all leads on this page"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </TableHead>
              <SortHead label="First Name" sortKey="first_name" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Last Name" sortKey="last_name" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Company" sortKey="company" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Email" sortKey="email" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Status" sortKey="lead_status" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Source" sortKey="lead_source" activeKey={sortKey} asc={sortAsc} onSort={onSort} className="hidden @md/leads:table-cell" />
              <SortHead label="Rating" sortKey="rating" activeKey={sortKey} asc={sortAsc} onSort={onSort} className="hidden @lg/leads:table-cell" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading leads…
              </TableCell></TableRow>
            )}
            {!isLoading && leads.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                No leads yet. Click “Add Lead” to create one.
              </TableCell></TableRow>
            )}
            {!isLoading && leads.map((lead) => (
              <TableRow
                key={lead.id}
                className="cursor-pointer"
                onClick={() => router.push(resolveAccessLink('/module/crm/marketing/leads') + `/${lead.id}`)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${lead.firstName ?? ''} ${lead.lastName}`.trim()}
                    checked={selectedIds.has(lead.id)}
                    onChange={() => toggle(lead.id)}
                  />
                </TableCell>
                <TableCell>{lead.firstName || '—'}</TableCell>
                <TableCell className="font-medium text-foreground">{lead.lastName}</TableCell>
                <TableCell>{lead.company || '—'}</TableCell>
                <TableCell className="truncate">{lead.email || '—'}</TableCell>
                <TableCell>
                  {lead.leadStatus
                    ? <StatusBadge variant={STATUS_VARIANT[lead.leadStatus] ?? 'default'}>{lead.leadStatus}</StatusBadge>
                    : '—'}
                </TableCell>
                <TableCell className="hidden @md/leads:table-cell">{lead.leadSource || '—'}</TableCell>
                <TableCell className="hidden @lg/leads:table-cell">{lead.rating || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} lead{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <CreateLeadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load() }}
        lead={editingLead}
        picklists={picklists}
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
