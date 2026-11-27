'use client'

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Plus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { getLaravelContext } from '@/lib/laravel-context'
import { CHIP_BASE, CHIP_TONE } from '@/lib/org-accounts/tones'
import { INITIAL_OUTREACH_STATE, NO_VALUE, outreachCompanyHref, outreachQuery, personLabel, SOURCE_LABEL, titleLine, withChange, type OutreachListState, type OutreachSortKey } from '@/lib/signals/outreach-model'
import { cn } from '@/lib/utils'
import { outreachService, type OutreachApi } from '@/services/signals/outreach'
import type { OutreachPerson } from '@/services/signals/outreach-types'
import { useAssignableEmployees } from '@/components/domain/crm/lead-employees'
import { AddPersonDialog } from './add-person-dialog'
import { OutreachBulkBar } from './outreach-bulk-bar'
import { errorText, lastContactedText, NoticeBar, OutreachChips, Pager, SearchBox, SortHead, type OutreachNotice } from './outreach-parts'
import { OutreachPersonPanel } from './outreach-person-panel'
import { ConsentChip, ReachChip } from './reach-chip'
import { useOutreachList } from './use-outreach-list'
import { WriteMessageDialog, type MessageDeps } from './write-message-dialog'

/** The person in the address (`?person=`), as an id: a whole number from 1 up, anything else is no person. */
const personFromAddress = (value: string | null): number | null => (value !== null && /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null)

const FOUND_NOTE = 'Found on a public page, not verified'

/** "Principal · Management · Decision maker": the title and department, then the role in the company when it says something more. */
function titleAndRole(person: OutreachPerson): string {
  const title = titleLine(person)
  const role = (person.contact_role ?? '').trim()
  const parts = [title, role && role !== title ? role : null].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : NO_VALUE
}

/**
 * The All people view of the Outreach tab: every person found at a company, or added by hand, across all companies. It is the Organizations All people table drawn for this data: the
 * same chips and search as Companies, columns for the contact details, the reach and what they agreed to, and a row that opens the person in a drawer on the right (`?person=` in
 * the address, so a link to a person works for the page the list is on). Write message and Assign owner work on the ticked people.
 *
 * `actionsHost` is the page header's button area: Add person is drawn there when the page gives one, else above the table.
 */
export function OutreachPeople({ service = outreachService, listState, actionsHost, messageDeps }: {
  service?: OutreachApi
  listState?: readonly [OutreachListState, Dispatch<SetStateAction<OutreachListState>>]
  actionsHost?: HTMLElement | null
  messageDeps?: MessageDeps
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const context = useMemo(() => getLaravelContext(), [])
  const ownState = useState<OutreachListState>(INITIAL_OUTREACH_STATE)
  const [state, setState] = listState ?? ownState
  const query = useMemo(() => outreachQuery(state), [state])
  const list = useOutreachList<OutreachPerson>((asked) => service.people(asked), query, 'The people could not be loaded.')
  const selectable = useMemo(() => list.rows.map((row) => ({ id: String(row.id) })), [list.rows])
  const { selectedIds, toggle, toggleAll, clear, allSelected } = useBulkSelection(selectable)
  const selected = list.rows.filter((row) => selectedIds.has(String(row.id)))
  const employees = useAssignableEmployees(context, selected.length > 0)

  const [notice, setNotice] = useState<OutreachNotice | null>(null)
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [writing, setWriting] = useState<OutreachPerson[] | null>(null)
  // The person last clicked, kept so the drawer still has them if the list is read again and they are not on the new page.
  const [clicked, setClicked] = useState<OutreachPerson | null>(null)
  // A person named in the address who is on no page we have read (a shared link): asked for by id.
  const [fetched, setFetched] = useState<OutreachPerson | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)

  const openId = personFromAddress(searchParams.get('person'))
  const openPerson = useCallback((person: OutreachPerson | null) => {
    setClicked(person)
    const next = new URLSearchParams(searchParams.toString())
    if (person === null) next.delete('person')
    else next.set('person', String(person.id))
    const text = next.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  const change = (patch: Partial<OutreachListState>) => { setState((current) => withChange(current, patch)); clear() }
  const onSort = (key: OutreachSortKey) => change(key === state.sortKey ? { sortAsc: !state.sortAsc } : { sortKey: key, sortAsc: true })

  const assign = async (userId: number) => {
    setBusy(true)
    setNotice(null)
    try {
      await service.assign({ person_ids: selected.map((person) => person.id), assigned_to: userId })
      setNotice({ tone: 'success', text: `The owner was changed for ${selected.length} ${selected.length === 1 ? 'person' : 'people'}.` })
      clear()
      list.reload()
    } catch (cause) {
      setNotice({ tone: 'error', text: errorText(cause, 'The owner could not be changed.') })
    } finally {
      setBusy(false)
    }
  }

  const actions = (
    <Button onClick={() => setAddOpen(true)}>
      <Plus className="mr-1.5 size-4" aria-hidden="true" />
      Add person
    </Button>
  )
  const narrowed = state.search.trim() !== '' || state.chip !== 'all'
  // A fresh row from the list wins over the one that was clicked, so a change made in the drawer shows in it as soon as the list has been read again.
  const shownPerson = openId === null ? null : (list.rows.find((row) => row.id === openId) ?? (clicked?.id === openId ? clicked : null) ?? (fetched?.id === openId ? fetched : null))
  const needsFetch = openId !== null && !list.loading && shownPerson === null && !fetchFailed
  useEffect(() => {
    if (!needsFetch || openId === null) return
    let live = true
    service.person(openId).then((response) => { if (live) setFetched(response.data) }).catch(() => { if (live) setFetchFailed(true) })
    return () => { live = false }
  }, [needsFetch, openId, service])

  return (
    <div className={cn('space-y-4', selected.length > 0 && 'pb-28')}>
      {actionsHost === undefined && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      {actionsHost ? createPortal(actions, actionsHost) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={state.search} onCommit={(search) => change({ search })} label="Search all people" placeholder="Search name, email, phone, job title or company" />
        <OutreachChips active={state.chip} summary={list.summary} onPick={(chip) => change({ chip })} />
      </div>

      {notice && <NoticeBar notice={notice} onDismiss={() => setNotice(null)} />}
      {list.error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive bg-card p-3 text-sm text-foreground">
          <span>{list.error}</span>
          <Button size="sm" variant="outline" onClick={list.reload}>Try again</Button>
        </div>
      )}

      <div className="@container/outreach overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" aria-label="Select all people on this page" checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
              </TableHead>
              <SortHead label="Name" sortKey="name" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} />
              <SortHead label="Company" sortKey="company" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} className="hidden @sm/outreach:table-cell" />
              <TableHead className="hidden @lg/outreach:table-cell">Job title · role</TableHead>
              <TableHead className="hidden @md/outreach:table-cell">Email</TableHead>
              <TableHead className="hidden @lg/outreach:table-cell">Phone</TableHead>
              <TableHead>Reach</TableHead>
              <TableHead className="hidden @xl/outreach:table-cell">Agreed to</TableHead>
              <TableHead className="hidden @2xl/outreach:table-cell">Source</TableHead>
              <TableHead className="hidden @2xl/outreach:table-cell">Owner</TableHead>
              <SortHead label="Last contacted" sortKey="last_contacted" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} className="hidden @2xl/outreach:table-cell" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.loading && (
              <TableRow><TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                <span role="status"><Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading people…</span>
              </TableCell></TableRow>
            )}
            {!list.loading && !list.error && list.rows.length === 0 && (
              <TableRow><TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                {narrowed ? 'No person matches. Clear the search, or pick All.' : 'No people yet. Open a company and use Find contacts, or add a person by hand.'}
              </TableCell></TableRow>
            )}
            {!list.loading && list.rows.map((person) => (
              <TableRow key={person.id} data-person={person.id} className="cursor-pointer" onClick={() => openPerson(person)}>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${personLabel(person)}`} checked={selectedIds.has(String(person.id))} onChange={() => toggle(String(person.id))} />
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  <button type="button" onClick={(event) => { event.stopPropagation(); openPerson(person) }} className="inline-flex items-center gap-1.5 text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                    {person.is_primary && <Star className="size-3.5 fill-current text-amber-500" aria-hidden="true" />}
                    {person.full_name ? person.full_name : <span className="italic text-muted-foreground">Company line</span>}
                    {person.is_primary && <span className="sr-only"> (Main contact)</span>}
                  </button>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground @sm/outreach:hidden">{person.company_name}</span>
                </TableCell>
                <TableCell className="hidden @sm/outreach:table-cell" onClick={(event) => event.stopPropagation()}>
                  <button type="button" data-company-link onClick={() => router.push(outreachCompanyHref(person.company_id))} className="text-left underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{person.company_name}</button>
                </TableCell>
                <TableCell className="hidden @lg/outreach:table-cell">{titleAndRole(person)}</TableCell>
                <TableCell className="hidden break-all @md/outreach:table-cell">{person.email || NO_VALUE}</TableCell>
                <TableCell className="hidden @lg/outreach:table-cell">{person.mobile || person.phone || NO_VALUE}</TableCell>
                <TableCell><ReachChip reach={person.reach} /></TableCell>
                <TableCell className="hidden @xl/outreach:table-cell"><ConsentChip status={person.consent_status} /></TableCell>
                <TableCell className="hidden @2xl/outreach:table-cell">
                  <span data-source={person.source} title={person.source === 'found' ? FOUND_NOTE : undefined} className={cn(CHIP_BASE, person.source === 'found' ? CHIP_TONE.neutral : CHIP_TONE.muted)}>{SOURCE_LABEL[person.source]}</span>
                </TableCell>
                <TableCell className="hidden @2xl/outreach:table-cell">{person.assigned_to_name || 'Not assigned'}</TableCell>
                <TableCell className="hidden @2xl/outreach:table-cell">{lastContactedText(person.last_contacted_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pager total={list.total} noun="person" nounPlural="people" page={state.page} lastPage={list.lastPage} onPage={(page) => change({ page })} />

      <AddPersonDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        service={service}
        onSaved={(person) => {
          setNotice({ tone: 'success', text: `${personLabel(person)} was added.`, href: outreachCompanyHref(person.company_id, 'people'), linkText: 'Open the company' })
          list.reload()
        }}
      />

      <WriteMessageDialog people={writing ?? []} open={writing !== null} onOpenChange={(next) => { if (!next) setWriting(null) }} service={service} {...messageDeps} />

      <OutreachBulkBar
        count={selected.length}
        noun="person"
        nounPlural="people"
        busy={busy}
        onWrite={() => setWriting(selected)}
        employees={employees}
        onAssign={(userId) => void assign(userId)}
        onClear={clear}
      />

      <Sheet open={openId !== null} onOpenChange={(next) => { if (!next) openPerson(null) }}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-3xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Person</SheetTitle>
            <SheetDescription>The person’s details and the messages written to them.</SheetDescription>
          </SheetHeader>
          {shownPerson ? (
            <div className="p-4">
              <OutreachPersonPanel person={shownPerson} service={service} onChanged={list.reload} onClose={() => openPerson(null)} showCompany messageDeps={messageDeps} />
            </div>
          ) : openId !== null && (
            <div role={list.loading || needsFetch ? 'status' : 'alert'} className="space-y-3 p-6 text-sm text-foreground">
              <p>{list.loading || needsFetch ? 'Loading person…' : 'This person could not be found. They may have been removed. Search for them by name, or open their company.'}</p>
              {!list.loading && !needsFetch && <Button size="sm" variant="outline" onClick={() => openPerson(null)}>Close</Button>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
