'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Copy, FileUp, Loader2, Plus, Search, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  applyViewConditions, companyState, createdText, fullName, INITIAL_PEOPLE_STATE, NO_VALUE, PEOPLE_FILTERS, PEOPLE_PAGE_SIZE, peopleBulkMessage, peopleQuery, phoneOf, titleAndRole, viewConditions,
  type PeopleFilter, type PeopleListState, type PeopleSortKey, type PersonRow,
} from '@/lib/crm/people'
import { CHIP_BASE, CHIP_TONE } from '@/lib/org-accounts/tones'
import { crmService } from '@/services/crm'
import { contactsService } from '@/services/crm/contacts'
import type { CrmPicklistValue } from '@/types/crm'
import { BulkSendMessageDialog, type MessageChannel } from './bulk-send-message-dialog'
import { CreateContactModal } from './create-contact-modal'
import { CrmBulkActionBar } from './crm-bulk-action-bar'
import { CrmDuplicatesDialog } from './crm-duplicates-dialog'
import { CrmExportButton } from './crm-export-button'
import { CrmImportDialog } from './crm-import-dialog'
import { CrmRecycleBinLink } from './crm-recycle-bin-link'
import { CrmSavedViews } from './crm-saved-views'
import { employeeName, useAssignableEmployees } from './lead-employees'
import { usePeopleRights } from './people/people-rights'
import { PersonDrawer } from './person-drawer'

/** The CSV columns of an import: the old Contacts import, plus the Role of the person in the company. */
const PEOPLE_IMPORT_HEADER_MAP: Record<string, string> = {
  salutation: 'salutation', 'first name': 'firstName', 'last name': 'lastName',
  title: 'title', department: 'department', role: 'contactRole', email: 'email',
  'secondary email': 'secondaryEmail', phone: 'phone', mobile: 'mobile',
  'home phone': 'homePhone', birthday: 'birthday', 'lead source': 'leadSource',
  'mailing street': 'mailingStreet', 'mailing city': 'mailingCity',
  'mailing state': 'mailingState', 'mailing postal code': 'mailingCode',
  'mailing country': 'mailingCountry', description: 'description',
  'organization id': 'organizationId', 'assigned to (user id)': 'assignedTo', 'assigned to': 'assignedTo',
}

const PEOPLE_TEMPLATE_HEADERS = [
  'Salutation', 'First Name', 'Last Name', 'Title', 'Department', 'Role', 'Email', 'Secondary Email',
  'Phone', 'Mobile', 'Home Phone', 'Birthday', 'Lead Source', 'Mailing Street', 'Mailing City',
  'Mailing State', 'Mailing Postal Code', 'Mailing Country', 'Description', 'Organization ID',
  'Assigned To (user id)',
] as const

function SortHead({ label, sortKey, activeKey, asc, onSort, className }: {
  label: string; sortKey: PeopleSortKey; activeKey: PeopleSortKey; asc: boolean
  onSort: (key: PeopleSortKey) => void; className?: string
}) {
  return (
    <TableHead className={className} aria-sort={activeKey === sortKey ? (asc ? 'ascending' : 'descending') : undefined}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 normal-case text-foreground">
        {label}
        {activeKey === sortKey && <ChevronDown className={cn('size-3.5 transition-transform', asc && 'rotate-180')} aria-hidden="true" />}
      </button>
    </TableHead>
  )
}

/** The person in the address (`?person=`), as an id: a whole number from 1 up, anything else is no person. */
const personFromAddress = (value: string | null): number | null => (value !== null && /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null)

/**
 * Every person of the organisation, across companies: the table of the All people scope of the Organizations list (S18, 25 Nov 2026). It is the old Contacts list, reused
 * as it was (saved views, import, export, duplicates, recycle bin, bulk bar), with the company, the Primary star and the Role added; a row opens the person in a drawer
 * (`?person=` in the address, so a link to a person works). The header buttons are drawn into `actionsHost` (the page header) when the page gives one, else above the table.
 */
export function PeopleTable({ actionsHost, onTotalChange, listState }: {
  actionsHost?: HTMLElement | null
  /** The search, chip, sort and page, when the page above keeps them (so they survive a visit to another scope). Without it the table keeps its own. */
  listState?: readonly [PeopleListState, Dispatch<SetStateAction<PeopleListState>>]
  /** The number of people with no search or chip on, for the count on the scope's tab. */
  onTotalChange?: (total: number) => void
} = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const context = useMemo(() => getLaravelContext(), [])
  const rights = usePeopleRights()
  const openPersonId = personFromAddress(searchParams.get('person'))

  const [people, setPeople] = useState<PersonRow[]>([])
  const { selectedIds, toggle, toggleAll, clear: clearSelection, allSelected } = useBulkSelection(people)
  const [total, setTotal] = useState(0)
  const ownState = useState<PeopleListState>(INITIAL_PEOPLE_STATE)
  const [state, setState] = listState ?? ownState
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [picklists, setPicklists] = useState<{ salutation: CrmPicklistValue[]; leadSource: CrmPicklistValue[]; contactRole: CrmPicklistValue[] }>({ salutation: [], leadSource: [], contactRole: [] })
  const latest = useRef(0)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    const mine = ++latest.current
    setIsLoading(true)
    setError('')
    clearSelection()
    try {
      const response = await contactsService.list(context, peopleQuery(state, context.userId))
      if (mine !== latest.current) return
      setPeople(response.data.items as PersonRow[])
      setTotal(response.data.pagination.total)
    } catch (reason) {
      if (mine === latest.current) setError(reason instanceof Error ? reason.message : 'Unable to load people.')
    } finally {
      if (mine === latest.current) setIsLoading(false)
    }
  }, [context, state, clearSelection])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const unfiltered = state.filter === 'all' && state.search.trim() === ''
  useEffect(() => {
    if (!isLoading && !error && unfiltered) onTotalChange?.(total)
  }, [isLoading, error, unfiltered, total, onTotalChange])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'contacts')
      .then((response) => {
        const c = response.data.contacts ?? {}
        setPicklists({ salutation: c.salutation ?? [], leadSource: c.lead_source ?? [], contactRole: c.contact_role ?? [] })
      })
      .catch(() => { /* the form still works with empty dropdowns */ })
  }, [context])

  const patch = (next: Partial<PeopleListState>) => setState((current) => ({ ...current, ...next }))
  const onSort = (key: PeopleSortKey) => setState((current) => (key === current.sortKey ? { ...current, sortAsc: !current.sortAsc } : { ...current, sortKey: key, sortAsc: true }))
  const lastPage = Math.max(1, Math.ceil(total / PEOPLE_PAGE_SIZE))

  const openPerson = useCallback((id: number | null) => {
    const next = new URLSearchParams(searchParams.toString())
    if (id === null) next.delete('person')
    else next.set('person', String(id))
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkSmsOpen, setBulkSmsOpen] = useState(false)
  const [bulkMessageChannel, setBulkMessageChannel] = useState<MessageChannel>('email')
  const employees = useAssignableEmployees(context, true)

  const handleBulkDelete = async () => {
    if (!rights.delete) { setError('You do not have the right to delete people.'); return }
    if (!window.confirm(`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'person' : 'people'}? This moves them to the Recycle Bin. Their company is not touched.`)) return
    setBulkBusy(true)
    try {
      const response = await crmService.bulkDeleteContacts(context, Array.from(selectedIds))
      setNotice(peopleBulkMessage('Deleted', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the selected people.')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReassign = async (assigneeId: string) => {
    if (!rights.edit) { setError('You do not have the right to change the owner of people.'); return }
    setBulkBusy(true)
    try {
      const response = await crmService.bulkAssignContacts(context, Array.from(selectedIds), assigneeId)
      setNotice(peopleBulkMessage('Reassigned', response.data))
      clearSelection()
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reassign the selected people.')
    } finally {
      setBulkBusy(false)
    }
  }

  const actions = (
    <>
      <CrmRecycleBinLink />
      <CrmExportButton href={contactsService.exportUrl(context, { search: state.search.trim() || undefined })} />
      <Button variant="outline" onClick={() => setImportOpen(true)}>
        <FileUp className="mr-1.5 size-4" aria-hidden="true" />
        Import
      </Button>
      <Button variant="outline" onClick={() => setDuplicatesOpen(true)}>
        <Copy className="mr-1.5 size-4" aria-hidden="true" />
        Find Duplicates
      </Button>
      <Button onClick={() => setModalOpen(true)} disabled={!rights.add} title={rights.add ? undefined : 'You do not have the right to add people.'}>
        <Plus className="mr-1.5 size-4" aria-hidden="true" />
        Add person
      </Button>
    </>
  )

  const noMatch = state.search.trim() !== '' || state.filter !== 'all'
  const hasMine = context.userId !== ''
  // The company's own page: this table lives on the Organizations list, so the list's own address is the base (it is the Support list under Support).
  const companyBase = pathname.replace(/\/+$/, '')

  return (
    <>
      {actionsHost === undefined && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      {actionsHost ? createPortal(actions, actionsHost) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={state.search}
            onChange={(e) => patch({ page: 1, search: e.target.value })}
            placeholder="Search name, email, phone, title, company"
            aria-label="Search all people"
            className="pl-9"
          />
        </div>
        <CrmSavedViews
          module="contacts"
          currentConditions={viewConditions(state)}
          onApply={(conditions) => setState((current) => applyViewConditions(conditions, current))}
        />
        <div role="group" aria-label="Show" className="flex flex-wrap items-center gap-1.5">
          {PEOPLE_FILTERS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={state.filter === chip.id}
              disabled={chip.id === 'mine' && !hasMine}
              onClick={() => patch({ page: 1, filter: chip.id as PeopleFilter })}
              className={cn(
                'rounded-full border px-3 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                state.filter === chip.id ? 'border-primary bg-muted font-semibold text-foreground' : 'border-border bg-card text-foreground',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {notice && <div role="status" className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="@container/people relative overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" aria-label="Select all people on this page" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
              </TableHead>
              <SortHead label="Name" sortKey="last_name" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} />
              <TableHead>Company</TableHead>
              <SortHead label="Title · role" sortKey="title" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} className="hidden @md/people:table-cell" />
              <SortHead label="Email" sortKey="email" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} className="hidden @sm/people:table-cell" />
              <TableHead className="hidden @md/people:table-cell">Phone</TableHead>
              <TableHead className="hidden @2xl/people:table-cell">Owner</TableHead>
              <SortHead label="Created" sortKey="created_at" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} className="hidden @2xl/people:table-cell" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading people…
              </TableCell></TableRow>
            )}
            {!isLoading && people.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                {noMatch ? 'No person matches.' : 'No people yet. Add the first person or import a CSV.'}
              </TableCell></TableRow>
            )}
            {!isLoading && people.map((person) => {
              const company = companyState(person)
              const name = fullName(person)
              return (
                <TableRow key={person.id} className="cursor-pointer" data-person={person.id} onClick={() => openPerson(Number(person.id))}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${name}`} checked={selectedIds.has(person.id)} onChange={() => toggle(person.id)} />
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    <button type="button" onClick={(e) => { e.stopPropagation(); openPerson(Number(person.id)) }} className="inline-flex items-center gap-1.5 text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                      {person.isPrimary && <Star className="size-3.5 fill-current text-amber-500" aria-hidden="true" />}
                      {name}
                      {person.isPrimary && <span className="sr-only"> (Primary)</span>}
                    </button>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {company === 'none' && <span data-company="none" className={cn(CHIP_BASE, CHIP_TONE.caution)}>No company</span>}
                    {company === 'live' && (person.organizationName
                      ? <Link href={`${companyBase}/${person.organizationId}`} className="underline-offset-2 hover:underline">{person.organizationName}</Link>
                      : NO_VALUE)}
                    {company === 'recycle-bin' && (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span>{person.organizationName || NO_VALUE}</span>
                        <span data-company="recycle-bin" className={cn(CHIP_BASE, CHIP_TONE.caution)}>Company in Recycle Bin</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden @md/people:table-cell">{titleAndRole(person)}</TableCell>
                  <TableCell className="hidden truncate @sm/people:table-cell">{person.email || NO_VALUE}</TableCell>
                  <TableCell className="hidden @md/people:table-cell">{phoneOf(person)}</TableCell>
                  <TableCell className="hidden @2xl/people:table-cell">{person.assignedTo ? employeeName(employees, person.assignedTo) : NO_VALUE}</TableCell>
                  <TableCell className="hidden @2xl/people:table-cell">{createdText(person.createdAt)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} {total === 1 ? 'person' : 'people'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={state.page <= 1} onClick={() => patch({ page: state.page - 1 })}>Previous</Button>
          <span>Page {state.page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={state.page >= lastPage} onClick={() => patch({ page: state.page + 1 })}>Next</Button>
        </div>
      </div>

      <CreateContactModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load() }}
        contact={null}
        picklists={picklists}
      />

      <CrmDuplicatesDialog
        isOpen={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        noun="person"
        getDuplicates={(ctx) => contactsService.duplicates(ctx)}
        merge={crmService.mergeContacts}
        getLabel={(row) => [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unnamed'}
        getSubLabel={(row) => (row.organizationName as string | null) ?? (row.email as string | null)}
        onMerged={() => void load()}
      />

      <CrmImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        noun="person"
        nounPlural="people"
        headerMap={PEOPLE_IMPORT_HEADER_MAP}
        templateHeaders={PEOPLE_TEMPLATE_HEADERS}
        templateFilename="people-template.csv"
        submitImport={(ctx, rows) => contactsService.importRows(ctx, rows)}
        onImported={() => void load()}
      />

      <CrmBulkActionBar
        count={selectedIds.size}
        busy={bulkBusy}
        people={employees.map((e) => ({ value: e.id, label: e.name }))}
        onReassign={(assigneeId) => void handleBulkReassign(assigneeId)}
        onDelete={() => void handleBulkDelete()}
        onClear={clearSelection}
        onSendMessage={(channel) => {
          setBulkMessageChannel(channel)
          setBulkSmsOpen(true)
        }}
        onSendSms={() => {
          setBulkMessageChannel('sms')
          setBulkSmsOpen(true)
        }}
      />

      <BulkSendMessageDialog
        isOpen={bulkSmsOpen}
        onClose={() => setBulkSmsOpen(false)}
        onSent={(message) => { setNotice(message); clearSelection(); void load() }}
        relatedType="contact"
        ids={Array.from(selectedIds)}
        recipients={people
          .filter((c) => selectedIds.has(c.id))
          .map((c) => ({
            id: c.id,
            name: fullName(c) === 'Unnamed' ? undefined : fullName(c),
            email: c.email || null,
            phone: c.mobile || c.phone || null,
          }))}
        initialChannel={bulkMessageChannel}
      />

      <PersonDrawer context={context} personId={openPersonId} onClose={() => openPerson(null)} onChanged={() => void load()} />
    </>
  )
}
