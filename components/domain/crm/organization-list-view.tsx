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
import type { CrmPicklistValue, Organization } from '@/types/crm'
import { CreateOrganizationModal } from './create-organization-modal'
import { CrmBulkActionBar } from './crm-bulk-action-bar'
import { crmBulkResultMessage } from './crm-bulk-result-message'
import { CrmDuplicatesDialog } from './crm-duplicates-dialog'
import { CrmExportButton } from './crm-export-button'
import { CrmImportDialog } from './crm-import-dialog'
import { CrmRecycleBinLink } from './crm-recycle-bin-link'
import { CrmSavedViews } from './crm-saved-views'
import { useAssignableEmployees } from './lead-employees'

type SortKey = 'name' | 'account_type' | 'industry' | 'rating' | 'billing_city' | 'created_at'

const ORGANIZATION_IMPORT_HEADER_MAP: Record<string, string> = {
  name: 'name', type: 'accountType', 'account type': 'accountType', industry: 'industry',
  rating: 'rating', ownership: 'ownership', 'annual revenue': 'annualRevenue',
  employees: 'employees', phone: 'phone', email: 'email', website: 'website',
  'billing street': 'billingStreet', 'billing city': 'billingCity',
  'billing state': 'billingState', 'billing postal code': 'billingCode',
  'billing country': 'billingCountry', description: 'description',
  'assigned to (user id)': 'assignedTo', 'assigned to': 'assignedTo',
}

const ORGANIZATION_TEMPLATE_HEADERS = [
  'Name', 'Type', 'Industry', 'Rating', 'Ownership', 'Annual Revenue', 'Employees',
  'Phone', 'Email', 'Website', 'Billing Street', 'Billing City', 'Billing State',
  'Billing Postal Code', 'Billing Country', 'Description', 'Assigned To (user id)',
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

export function OrganizationListView() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const { selectedIds, toggle, toggleAll, clear: clearSelection, allSelected } = useBulkSelection(organizations)
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
  const [picklists, setPicklists] = useState<{ accountType: CrmPicklistValue[]; industry: CrmPicklistValue[]; rating: CrmPicklistValue[] }>({ accountType: [], industry: [], rating: [] })

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    clearSelection()
    try {
      const response = await crmService.getOrganizations(context, {
        page, perPage: PAGE_SIZE, search: search || undefined,
        sortBy: sortKey, sortDir: sortAsc ? 'asc' : 'desc',
      })
      setOrganizations(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load organizations.')
    } finally {
      setIsLoading(false)
    }
  }, [context, page, search, sortKey, sortAsc, clearSelection])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'organizations')
      .then((response) => {
        const org = response.data.organizations ?? {}
        setPicklists({ accountType: org.account_type ?? [], industry: org.industry ?? [], rating: org.rating ?? [] })
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
    if (!window.confirm(`Delete ${selectedIds.size} organization${selectedIds.size === 1 ? '' : 's'}? This moves them to the Recycle Bin.`)) return
    setBulkBusy(true)
    try {
      const response = await crmService.bulkDeleteOrganizations(context, Array.from(selectedIds))
      setNotice(crmBulkResultMessage('Deleted', 'organization', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the selected organizations.')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReassign = async (assigneeId: string, cascadeToContacts: boolean) => {
    setBulkBusy(true)
    try {
      const response = await crmService.bulkAssignOrganizations(context, Array.from(selectedIds), assigneeId, cascadeToContacts)
      setNotice(crmBulkResultMessage('Reassigned', 'organization', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reassign the selected organizations.')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Organizations</h1>
          <p className="text-sm text-muted-foreground">Companies your leads and contacts belong to.</p>
        </div>
        <div className="flex items-center gap-2">
          <CrmRecycleBinLink />
          <CrmExportButton href={crmService.organizationsExportUrl(context, search || undefined)} />
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
            Add Organization
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} placeholder="Search name, email, or phone…" className="pl-9" />
        </div>
        <CrmSavedViews module="organizations" currentConditions={{ search, sortKey, sortAsc }} onApply={handleApplyView} />
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="@container/orgs overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all organizations on this page"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </TableHead>
              <SortHead label="Name" sortKey="name" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Type" sortKey="account_type" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Industry" sortKey="industry" activeKey={sortKey} asc={sortAsc} onSort={onSort} className="hidden @md/orgs:table-cell" />
              <SortHead label="City" sortKey="billing_city" activeKey={sortKey} asc={sortAsc} onSort={onSort} className="hidden @md/orgs:table-cell" />
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading organizations…
              </TableCell></TableRow>
            )}
            {!isLoading && organizations.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                No organizations yet. Click “Add Organization” to create one.
              </TableCell></TableRow>
            )}
            {!isLoading && organizations.map((org) => (
              <TableRow key={org.id} className="cursor-pointer" onClick={() => router.push(resolveAccessLink('/module/crm/marketing/organizations') + `/${org.id}`)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${org.name}`}
                    checked={selectedIds.has(org.id)}
                    onChange={() => toggle(org.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-foreground">{org.name}</TableCell>
                <TableCell>{org.accountType || '—'}</TableCell>
                <TableCell className="hidden @md/orgs:table-cell">{org.industry || '—'}</TableCell>
                <TableCell className="hidden @md/orgs:table-cell">{org.billingCity || '—'}</TableCell>
                <TableCell>{org.phone || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} organization{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <CreateOrganizationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load() }}
        organization={null}
        picklists={picklists}
      />

      <CrmDuplicatesDialog
        isOpen={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        noun="organization"
        getDuplicates={crmService.getOrganizationDuplicates}
        merge={crmService.mergeOrganizations}
        getLabel={(row) => (row.name as string) ?? 'Unnamed'}
        getSubLabel={(row) => (row.website as string | null) ?? (row.phone as string | null)}
        onMerged={() => void load()}
      />

      <CrmImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        noun="organization"
        headerMap={ORGANIZATION_IMPORT_HEADER_MAP}
        templateHeaders={ORGANIZATION_TEMPLATE_HEADERS}
        templateFilename="organizations-template.csv"
        submitImport={crmService.importOrganizations}
        onImported={() => void load()}
      />

      <CrmBulkActionBar
        count={selectedIds.size}
        busy={bulkBusy}
        people={employees.map((e) => ({ value: e.id, label: e.name }))}
        onReassign={(assigneeId, cascade) => void handleBulkReassign(assigneeId, cascade)}
        onDelete={() => void handleBulkDelete()}
        onClear={clearSelection}
        cascadeLabel="Also transfer contacts"
      />
    </div>
  )
}
