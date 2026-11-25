'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MoreHorizontal, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { getLaravelContext } from '@/lib/laravel-context'
import { CRM_RECYCLE_BIN_PATH } from '@/lib/gtg-navigation'
import { cn } from '@/lib/utils'
import { crmService } from '@/services/crm'
import { contactsService } from '@/services/crm/contacts'
import type { FactsApi } from '@/services/facts/api-types'
import type { OrgAccountsApi } from '@/services/org-accounts/api-types'
import type { Contact, Organization } from '@/types/crm'
import { CreateContactModal } from '../create-contact-modal'
import { CrmDuplicatesDialog } from '../crm-duplicates-dialog'
import { CrmImportDialog } from '../crm-import-dialog'
import { GtmPeopleStrip } from './gtm-people-strip'
import { usePeopleRights } from './people-rights'
import { PEOPLE_IMPORT_HEADER_MAP, PEOPLE_IMPORT_TEMPLATE_HEADERS } from './people-import'
import { personName } from './person-model'
import { PersonPanel } from './person-panel'
import { PersonRail } from './person-rail'

type Filter = 'all' | 'primary' | 'mine' | 'dnc'

const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'primary', label: 'Primary' },
  { id: 'mine', label: 'Mine' },
  { id: 'dnc', label: 'Do not call' },
]

const PAGE = 100
const SEARCH_DELAY_MS = 250

/** Primary first, then by name: the order of the rail whatever order the server answered in. */
export function railOrder(people: readonly Contact[]): Contact[] {
  return [...people].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))
    || (a.lastName ?? '').localeCompare(b.lastName ?? '') || (a.firstName ?? '').localeCompare(b.firstName ?? ''))
}

/**
 * The People tab of a company (S18): the company's people in a rail on the left and the chosen person's panel on the right (phone: the list, then the person
 * with a Back button). Search finds a person by name, email, phone or title; the chips narrow to the primary person, the people assigned to me and the people
 * who asked not to be called. "..." holds Import, Export, Find duplicates and the Recycle Bin, the first three limited to this company. Add, Edit and Delete follow the
 * person's rights on the Contacts menu rows.
 */
export function PeopleTab({ organization, initialPersonId = null, onChanged, factsService, gtmService }: {
  organization: Organization
  /** The person a link asked for (`?tab=people&person=31`), opened as soon as the tab shows. */
  initialPersonId?: string | null
  /** The list of people changed (added, edited, deleted, primary changed): the company page reads its count and primary person again. */
  onChanged?: () => void
  /** For tests. */
  factsService?: FactsApi
  gtmService?: OrgAccountsApi
}) {
  const router = useRouter()
  const context = useMemo(() => getLaravelContext(), [])
  const rights = usePeopleRights()

  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [people, setPeople] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(initialPersonId)
  // On a phone the list and the person take turns: the person shows only after one was chosen.
  const [showPerson, setShowPerson] = useState(initialPersonId !== null)
  const [notice, setNotice] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)

  useEffect(() => {
    const handle = setTimeout(() => setSearch(typed.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(handle)
  }, [typed])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await contactsService.list(context, {
        organizationId: organization.id,
        perPage: PAGE,
        ...(search ? { search } : {}),
        ...(filter === 'primary' ? { primary: true } : {}),
        ...(filter === 'mine' ? { owner: context.userId } : {}),
        ...(filter === 'dnc' ? { doNotCall: true } : {}),
      })
      setPeople(railOrder(response.data.items))
      setTotal(response.data.pagination?.total ?? response.data.items.length)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The people could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [context, organization.id, search, filter])

  // `version` is read so a change made here (a person added, deleted or made primary) reads the list again.
  useEffect(() => { void version; queueMicrotask(() => { void load() }) }, [load, version])

  const refresh = () => { setVersion((v) => v + 1); onChanged?.() }

  const activeId = selectedId && (people.some((p) => p.id === selectedId) || loading) ? selectedId : (people[0]?.id ?? null)
  const narrowed = Boolean(search) || filter !== 'all'
  const canAdd = rights.add

  const choose = (id: string) => { setSelectedId(id); setShowPerson(true) }
  const backToList = () => { setShowPerson(false); setSelectedId(null) }

  const addPerson = (
    <Button size="sm" disabled={!canAdd} title={canAdd ? undefined : 'You do not have the add right on people.'} onClick={() => setAddOpen(true)}>
      <Plus className="mr-1.5 size-4" aria-hidden="true" />Add person
    </Button>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 max-w-sm flex-1 basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Search people" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search name, email, phone, title" className="pl-9" />
        </div>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === option.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="grow" />
        {addPerson}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" aria-label="More"><MoreHorizontal className="size-4" aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!canAdd} onSelect={() => setImportOpen(true)}>Import CSV</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a data-export href={contactsService.exportUrl(context, { search: search || undefined, organizationId: organization.id })}>Export</a>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!rights.edit} onSelect={() => setDuplicatesOpen(true)}>Find duplicates</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push(CRM_RECYCLE_BIN_PATH)}>Recycle bin</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {notice && <div role="status" className="rounded-lg border border-success bg-card p-3 text-sm text-foreground">{notice}</div>}
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(260px,330px)_1fr]">
        <div className={cn('overflow-hidden rounded-xl border border-border bg-card', showPerson && 'max-lg:hidden')}>
          {loading && people.length === 0 && (
            <div role="status" className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading people…
            </div>
          )}
          {!loading && !error && people.length === 0 && (
            narrowed
              ? <p className="p-4 text-sm text-muted-foreground">No person matches.</p>
              : <p className="p-4 text-sm text-muted-foreground lg:hidden">No people yet. Add the first person or import a CSV.</p>
          )}
          {people.length > 0 && <PersonRail people={people} selectedId={activeId} onSelect={choose} />}
          {total > people.length && <p className="border-t border-border p-3 text-xs text-muted-foreground">Showing {people.length} of {total} people. Search to find the others.</p>}
          <GtmPeopleStrip organizationId={organization.id} service={gtmService} />
        </div>

        <div className={cn('min-w-0 lg:[&_[data-person-back]]:hidden', !showPerson && 'max-lg:hidden')}>
          {activeId ? (
            <PersonPanel
              context={context}
              personId={Number(activeId)}
              factsService={factsService}
              onChanged={refresh}
              onClose={backToList}
            />
          ) : (
            !loading && people.length === 0 && !error && !narrowed && (
              <EmptyState title="No people yet" description="Add the first person or import a CSV." action={canAdd ? addPerson : undefined} />
            )
          )}
        </div>
      </div>

      <CreateContactModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(message, saved) => {
          setNotice(message)
          if (saved?.id) choose(saved.id)
          refresh()
        }}
        contact={null}
        lockedOrganization={{ id: organization.id, name: organization.name }}
      />

      <CrmImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        noun="person"
        nounPlural="people"
        headerMap={PEOPLE_IMPORT_HEADER_MAP}
        templateHeaders={PEOPLE_IMPORT_TEMPLATE_HEADERS}
        templateFilename="people-template.csv"
        submitImport={(ctx, rows) => contactsService.importRows(ctx, rows, organization.id)}
        onImported={refresh}
      />

      <CrmDuplicatesDialog
        isOpen={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        noun="person"
        getDuplicates={(ctx) => contactsService.duplicates(ctx, organization.id)}
        merge={crmService.mergeContacts}
        getLabel={(row) => personName({ firstName: (row.firstName as string | null) ?? null, lastName: String(row.lastName ?? '') }) || 'Unnamed'}
        getSubLabel={(row) => (row.email as string | null) ?? (row.title as string | null)}
        onMerged={refresh}
      />
    </div>
  )
}
