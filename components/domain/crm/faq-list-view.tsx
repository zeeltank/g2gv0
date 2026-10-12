'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, FileUp, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmFaq, CrmPicklistValue } from '@/types/crm'
import { CreateFaqModal } from './create-faq-modal'
import { CrmBulkActionBar } from './crm-bulk-action-bar'
import { crmBulkResultMessage } from './crm-bulk-result-message'
import { CrmExportButton } from './crm-export-button'
import { CrmImportDialog } from './crm-import-dialog'
import { CrmRecycleBinLink } from './crm-recycle-bin-link'
import { useAssignableEmployees } from './lead-employees'

type SortKey = 'question' | 'category' | 'status' | 'created_at'

/** Draft = muted/secondary, Published = success, Obsolete = destructive - same StatusBadge variant set every other CRM status column uses. */
const STATUS_VARIANT: Record<string, 'inactive' | 'active' | 'error'> = {
  Draft: 'inactive', Published: 'active', Obsolete: 'error',
}

const IMPORT_HEADER_MAP: Record<string, string> = {
  question: 'question', answer: 'answer', category: 'category', status: 'status',
  'assigned to (user id)': 'assignedTo', 'assigned to': 'assignedTo',
}

const TEMPLATE_HEADERS = ['Question', 'Answer', 'Category', 'Status', 'Assigned To (user id)'] as const

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

export function FaqListView() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [faqs, setFaqs] = useState<CrmFaq[]>([])
  const { selectedIds, toggle, toggleAll, clear: clearSelection, allSelected } = useBulkSelection(faqs)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFaq, setEditingFaq] = useState<CrmFaq | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [categories, setCategories] = useState<CrmPicklistValue[]>([])
  const [statuses, setStatuses] = useState<CrmPicklistValue[]>([])

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    clearSelection()
    try {
      const response = await crmService.getFaqs(context, {
        page, perPage: PAGE_SIZE, search: search || undefined,
        sortBy: sortKey, sortDir: sortAsc ? 'asc' : 'desc',
      })
      setFaqs(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load FAQs.')
    } finally {
      setIsLoading(false)
    }
  }, [context, page, search, sortKey, sortAsc, clearSelection])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'faqs')
      .then((response) => {
        setCategories(response.data.faqs?.category ?? [])
        setStatuses(response.data.faqs?.status ?? [])
      })
      .catch(() => { /* the form still works with empty dropdowns */ })
  }, [context])

  const onSort = (key: SortKey) => {
    if (key === sortKey) { setSortAsc((a) => !a) } else { setSortKey(key); setSortAsc(true) }
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const [bulkBusy, setBulkBusy] = useState(false)
  const employees = useAssignableEmployees(context, selectedIds.size > 0)

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} FAQ${selectedIds.size === 1 ? '' : 's'}? This moves them to the Recycle Bin.`)) return
    setBulkBusy(true)
    try {
      const response = await crmService.bulkDeleteFaqs(context, Array.from(selectedIds))
      setNotice(crmBulkResultMessage('Deleted', 'FAQ', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the selected FAQs.')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReassign = async (assigneeId: string) => {
    setBulkBusy(true)
    try {
      const response = await crmService.bulkAssignFaqs(context, Array.from(selectedIds), assigneeId)
      setNotice(crmBulkResultMessage('Reassigned', 'FAQ', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reassign the selected FAQs.')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">FAQ</h1>
          <p className="text-sm text-muted-foreground">Frequently asked questions, optionally scoped to a product or service.</p>
        </div>
        <div className="flex items-center gap-2">
          <CrmRecycleBinLink />
          <CrmExportButton href={crmService.faqsExportUrl(context, search || undefined)} />
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileUp className="mr-1.5 size-4" aria-hidden="true" />
            Import
          </Button>
          <Button onClick={() => { setEditingFaq(null); setModalOpen(true) }}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Add FAQ
          </Button>
        </div>
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} placeholder="Search question or answer…" className="pl-9" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" aria-label="Select all FAQs on this page" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
              </TableHead>
              <SortHead label="Question" sortKey="question" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Category" sortKey="category" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Status" sortKey="status" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <TableHead>Product</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading FAQs…
              </TableCell></TableRow>
            )}
            {!isLoading && faqs.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                No FAQs yet. Click “Add FAQ” to create one.
              </TableCell></TableRow>
            )}
            {!isLoading && faqs.map((faq) => (
              <TableRow key={faq.id} className="cursor-pointer" onClick={() => router.push(resolveAccessLink('/module/crm/support/faq') + `/${faq.id}`)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${faq.question}`} checked={selectedIds.has(faq.id)} onChange={() => toggle(faq.id)} />
                </TableCell>
                <TableCell className="max-w-sm truncate font-medium text-foreground">{faq.question}</TableCell>
                <TableCell>{faq.category || '—'}</TableCell>
                <TableCell>
                  {faq.status
                    ? <StatusBadge variant={STATUS_VARIANT[faq.status] ?? 'default'}>{faq.status}</StatusBadge>
                    : '—'}
                </TableCell>
                <TableCell>{faq.productName || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} FAQ{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <CreateFaqModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load() }}
        faq={editingFaq}
        categories={categories}
        statuses={statuses}
      />

      <CrmImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        noun="FAQ"
        headerMap={IMPORT_HEADER_MAP}
        templateHeaders={TEMPLATE_HEADERS}
        templateFilename="faqs-template.csv"
        submitImport={crmService.importFaqs}
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
