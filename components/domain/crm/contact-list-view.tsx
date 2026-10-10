'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { Contact, CrmPicklistValue } from '@/types/crm'
import { CreateContactModal } from './create-contact-modal'

type SortKey = 'first_name' | 'last_name' | 'email' | 'title' | 'created_at'

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

export function ContactListView() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('last_name')
  const [sortAsc, setSortAsc] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [picklists, setPicklists] = useState<{ salutation: CrmPicklistValue[]; leadSource: CrmPicklistValue[] }>({ salutation: [], leadSource: [] })

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getContacts(context, {
        page, perPage: PAGE_SIZE, search: search || undefined,
        sortBy: sortKey, sortDir: sortAsc ? 'asc' : 'desc',
      })
      setContacts(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load contacts.')
    } finally {
      setIsLoading(false)
    }
  }, [context, page, search, sortKey, sortAsc])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'contacts')
      .then((response) => {
        const c = response.data.contacts ?? {}
        setPicklists({ salutation: c.salutation ?? [], leadSource: c.lead_source ?? [] })
      })
      .catch(() => { /* the form still works with empty dropdowns */ })
  }, [context])

  const onSort = (key: SortKey) => {
    if (key === sortKey) { setSortAsc((a) => !a) } else { setSortKey(key); setSortAsc(true) }
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground">People at the organizations you work with.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-1.5 size-4" aria-hidden="true" />
          Add Contact
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} placeholder="Search name, email, or organization…" className="pl-9" />
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="@container/contacts overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="First Name" sortKey="first_name" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Last Name" sortKey="last_name" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Title" sortKey="title" activeKey={sortKey} asc={sortAsc} onSort={onSort} className="hidden @md/contacts:table-cell" />
              <TableHead>Organization</TableHead>
              <SortHead label="Email" sortKey="email" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <TableHead className="hidden @md/contacts:table-cell">Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading contacts…
              </TableCell></TableRow>
            )}
            {!isLoading && contacts.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                No contacts yet. Click “Add Contact” to create one.
              </TableCell></TableRow>
            )}
            {!isLoading && contacts.map((contact) => (
              <TableRow key={contact.id} className="cursor-pointer" onClick={() => router.push(resolveAccessLink('/module/crm/marketing/contacts') + `/${contact.id}`)}>
                <TableCell>{contact.firstName || '—'}</TableCell>
                <TableCell className="font-medium text-foreground">{contact.lastName}</TableCell>
                <TableCell className="hidden @md/contacts:table-cell">{contact.title || '—'}</TableCell>
                <TableCell>{contact.organizationName || '—'}</TableCell>
                <TableCell className="truncate">{contact.email || '—'}</TableCell>
                <TableCell className="hidden @md/contacts:table-cell">{contact.phone || contact.mobile || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} contact{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <CreateContactModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load() }}
        contact={null}
        picklists={picklists}
      />
    </div>
  )
}
