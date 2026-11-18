'use client'

/**
 * Email Templates admin library - list view. Same shape as
 * PriceBookListView (search/sort/paginate/bulk-reassign/bulk-delete/export),
 * minus the Recycle Bin link: CrmRecycleBinController has no
 * 'email_templates' entry this round (a plain admin library, not one of the
 * 4 CRM modules that controller already enumerates) - destroy()/bulkDelete()
 * still soft-delete the row (crm_email_templates' own deleted_at/deleted_by
 * trailer), it just is not surfaced in the shared Recycle Bin UI yet.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Mail, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmEmailTemplate } from '@/types/crm'
import { CreateEmailTemplateModal } from './create-email-template-modal'
import { CrmBulkActionBar } from './crm-bulk-action-bar'
import { crmBulkResultMessage } from './crm-bulk-result-message'
import { CrmExportButton } from './crm-export-button'
import { useAssignableEmployees } from './lead-employees'

type SortKey = 'name' | 'folder' | 'created_at'
const PAGE_SIZE = 20
/** This screen's own route - a fresh menu insert local to these new files, not imported from lib/gtg-navigation.ts (same precedent app/module/crm/support/faq/[id]/page.tsx already set for its own CRM_FAQ_ACCESS_LINK constant). */
const EMAIL_TEMPLATES_ACCESS_LINK = '/module/crm/support/email-templates'

function SortHead({ label, sortKey, activeKey, asc, onSort }: {
  label: string; sortKey: SortKey; activeKey: SortKey; asc: boolean; onSort: (key: SortKey) => void
}) {
  return (
    <TableHead>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 normal-case text-foreground">
        {label}
        {activeKey === sortKey && <ChevronDown className={cn('size-3.5 transition-transform', asc && 'rotate-180')} />}
      </button>
    </TableHead>
  )
}

export function EmailTemplateListView() {
  const router = useRouter()
  const context = useMemo(() => getLaravelContext(), [])

  const [templates, setTemplates] = useState<CrmEmailTemplate[]>([])
  const { selectedIds, toggle, toggleAll, clear: clearSelection, allSelected } = useBulkSelection(templates)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CrmEmailTemplate | null>(null)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    clearSelection()
    try {
      const response = await crmService.getEmailTemplates(context, {
        page, perPage: PAGE_SIZE, search: search || undefined,
        sortBy: sortKey, sortDir: sortAsc ? 'asc' : 'desc',
      })
      setTemplates(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load email templates.')
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

  const [bulkBusy, setBulkBusy] = useState(false)
  const employees = useAssignableEmployees(context, selectedIds.size > 0)

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} email template${selectedIds.size === 1 ? '' : 's'}?`)) return
    setBulkBusy(true)
    try {
      const response = await crmService.bulkDeleteEmailTemplates(context, Array.from(selectedIds))
      setNotice(crmBulkResultMessage('Deleted', 'email template', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the selected email templates.')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReassign = async (assigneeId: string) => {
    setBulkBusy(true)
    try {
      const response = await crmService.bulkAssignEmailTemplates(context, Array.from(selectedIds), assigneeId)
      setNotice(crmBulkResultMessage('Reassigned', 'email template', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reassign the selected email templates.')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Email Templates</h1>
          <p className="text-sm text-muted-foreground">A reusable subject + body library, selectable when composing a CRM email.</p>
        </div>
        <div className="flex items-center gap-2">
          <CrmExportButton href={crmService.emailTemplatesExportUrl(context, search || undefined)} />
          <Button onClick={() => { setEditingTemplate(null); setModalOpen(true) }}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Add Template
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} placeholder="Search name…" className="pl-9" />
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" aria-label="Select all templates on this page" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
              </TableHead>
              <SortHead label="Name" sortKey="name" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Folder" sortKey="folder" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <TableHead>Subject</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Loading email templates…</TableCell></TableRow>
            )}
            {!isLoading && templates.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-14 text-center">
                <Mail className="mx-auto mb-2 size-8 text-muted-foreground/50" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">No email templates yet. Click &ldquo;Add Template&rdquo; to create one.</p>
              </TableCell></TableRow>
            )}
            {!isLoading && templates.map((template) => (
              <TableRow key={template.id} className="cursor-pointer" onClick={() => router.push(`${EMAIL_TEMPLATES_ACCESS_LINK}/${template.id}`)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${template.name}`} checked={selectedIds.has(template.id)} onChange={() => toggle(template.id)} />
                </TableCell>
                <TableCell className="font-medium text-foreground">{template.name}</TableCell>
                <TableCell>{template.folder || '—'}</TableCell>
                <TableCell className="max-w-xs truncate">{template.subject}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} email template{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <CreateEmailTemplateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load() }}
        template={editingTemplate}
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
