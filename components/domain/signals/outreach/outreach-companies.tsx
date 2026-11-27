'use client'

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { useBulkSelection } from '@/hooks/use-bulk-selection'
import { getLaravelContext } from '@/lib/laravel-context'
import { CHIP_BASE, CHIP_TONE } from '@/lib/org-accounts/tones'
import { leadHref } from '@/lib/signals/lead-action'
import { INITIAL_OUTREACH_STATE, NO_VALUE, outreachCompanyHref, outreachQuery, withChange, type OutreachListState, type OutreachSortKey } from '@/lib/signals/outreach-model'
import { cn } from '@/lib/utils'
import { outreachService, type OutreachApi } from '@/services/signals/outreach'
import type { OutreachCompany, OutreachPerson } from '@/services/signals/outreach-types'
import { useAssignableEmployees } from '@/components/domain/crm/lead-employees'
import { AddCompanyDialog } from './add-company-dialog'
import { OutreachBulkBar } from './outreach-bulk-bar'
import { errorText, lastContactedText, NoticeBar, OutreachChips, Pager, SearchBox, SortHead, type OutreachNotice } from './outreach-parts'
import { ReachChip } from './reach-chip'
import { useOutreachList } from './use-outreach-list'
import { WriteMessageDialog, type MessageDeps } from './write-message-dialog'

/** How many people of one company the Write message button reads (the server's page limit is higher; a company with more is a company this list is not the place to write to in bulk). */
const PEOPLE_PER_COMPANY = 100

/**
 * The Companies view of the Outreach tab: the companies signals found, and the ones added by hand, with who can be reached at each. It is the Organizations Companies list drawn for this
 * data: search, chips with the server's own counts, sortable columns, a page of 20, and a bar for the ticked rows. A row opens the company's page. The columns that matter least on
 * a narrow screen (industry, location, owner) step aside as the list gets narrower, the way the Organizations list does, and the company's best contact moves under its name.
 *
 * Nothing here sends anything. "Write message" opens the dialog that SAVES DRAFTS; "Convert to lead" makes a CRM lead from one company after asking.
 * `actionsHost` is the page header's button area: the Add company button is drawn there when the page gives one, else above the table.
 */
export function OutreachCompanies({ service = outreachService, listState, actionsHost, messageDeps }: {
  service?: OutreachApi
  /** The search, chip, sort and page, when the page above keeps them (so they survive a visit to another view). Without it the list keeps its own. */
  listState?: readonly [OutreachListState, Dispatch<SetStateAction<OutreachListState>>]
  actionsHost?: HTMLElement | null
  messageDeps?: MessageDeps
}) {
  const router = useRouter()
  const context = useMemo(() => getLaravelContext(), [])
  const ownState = useState<OutreachListState>(INITIAL_OUTREACH_STATE)
  const [state, setState] = listState ?? ownState
  const query = useMemo(() => outreachQuery(state), [state])
  const list = useOutreachList<OutreachCompany>((asked) => service.companies(asked), query, 'The companies could not be loaded.')
  const selectable = useMemo(() => list.rows.map((row) => ({ id: String(row.id) })), [list.rows])
  const { selectedIds, toggle, toggleAll, clear, allSelected } = useBulkSelection(selectable)
  const selected = list.rows.filter((row) => selectedIds.has(String(row.id)))
  const employees = useAssignableEmployees(context, selected.length > 0)
  const { confirm, confirmDialog } = useConfirm()

  const [notice, setNotice] = useState<OutreachNotice | null>(null)
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [writing, setWriting] = useState<OutreachPerson[] | null>(null)

  const change = (patch: Partial<OutreachListState>) => { setState((current) => withChange(current, patch)); clear() }
  const onSort = (key: OutreachSortKey) => change(key === state.sortKey ? { sortAsc: !state.sortAsc } : { sortKey: key, sortAsc: true })
  const open = (company: OutreachCompany) => router.push(outreachCompanyHref(company.id))

  /** Reads each ticked company's people, then opens the message dialog for all of them together; the dialog sorts out who can be written to. */
  const write = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const answers = await Promise.all(selected.map((company) => service.people({ company_id: company.id, per_page: PEOPLE_PER_COMPANY })))
      const seen = new Set<number>()
      const people: OutreachPerson[] = []
      for (const person of answers.flatMap((answer) => answer.data)) {
        if (seen.has(person.id)) continue
        seen.add(person.id)
        people.push(person)
      }
      if (people.length === 0) {
        setNotice({ tone: 'error', text: `${selected.length === 1 ? 'This company has' : 'These companies have'} no people yet. Open it and use Find contacts, or add a person by hand.` })
        return
      }
      setWriting(people)
    } catch (cause) {
      setNotice({ tone: 'error', text: errorText(cause, 'The people of the selected companies could not be loaded.') })
    } finally {
      setBusy(false)
    }
  }

  const convert = async () => {
    const company = selected[0]
    if (!company || selected.length !== 1) return
    const contact = company.best_contact
    const sure = await confirm({
      title: `Make a lead from ${company.name}?`,
      description: `A lead is created in CRM${contact?.name ? ` for ${contact.name}` : ''} at ${company.name}, so your team can follow up. If it already has a lead, no second one is made.`,
      confirmLabel: 'Convert to lead',
      tone: 'default',
    })
    if (!sure) return
    setBusy(true)
    setNotice(null)
    try {
      const response = await service.convertToLead(company.id, contact ? { person_id: contact.id } : undefined)
      setNotice({
        tone: 'success',
        text: response.data.created ? `A lead was created from ${company.name}.` : `${company.name} already has a lead, so no second one was made.`,
        href: leadHref(String(response.data.lead_id)),
        linkText: 'Open the lead',
      })
      clear()
      list.reload()
    } catch (cause) {
      setNotice({ tone: 'error', text: errorText(cause, 'The lead could not be created.') })
    } finally {
      setBusy(false)
    }
  }

  const assign = async (userId: number) => {
    setBusy(true)
    setNotice(null)
    try {
      await service.assign({ company_ids: selected.map((company) => company.id), assigned_to: userId })
      setNotice({ tone: 'success', text: `The owner was changed for ${selected.length} ${selected.length === 1 ? 'company' : 'companies'}.` })
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
      Add company
    </Button>
  )
  const narrowed = state.search.trim() !== '' || state.chip !== 'all'

  return (
    <div className={cn('space-y-4', selected.length > 0 && 'pb-28')}>
      {actionsHost === undefined && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      {actionsHost ? createPortal(actions, actionsHost) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={state.search} onCommit={(search) => change({ search })} label="Search companies" placeholder="Search company, industry, place or contact" />
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
                <input type="checkbox" aria-label="Select all companies on this page" checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
              </TableHead>
              <SortHead label="Company" sortKey="name" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} />
              <SortHead label="Industry" sortKey="industry" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} className="hidden @lg/outreach:table-cell" />
              <SortHead label="Location" sortKey="location" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} className="hidden @lg/outreach:table-cell" />
              <SortHead label="Signals" sortKey="signals" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} className="hidden @md/outreach:table-cell" />
              <SortHead label="People" sortKey="people" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} className="hidden @md/outreach:table-cell" />
              <TableHead className="hidden @xl/outreach:table-cell">Best contact</TableHead>
              <TableHead>Reach</TableHead>
              <TableHead className="hidden @2xl/outreach:table-cell">Owner</TableHead>
              <SortHead label="Last contacted" sortKey="last_contacted" activeKey={state.sortKey} asc={state.sortAsc} onSort={onSort} className="hidden @xl/outreach:table-cell" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.loading && (
              <TableRow><TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                <span role="status"><Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading companies…</span>
              </TableCell></TableRow>
            )}
            {!list.loading && !list.error && list.rows.length === 0 && (
              <TableRow><TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                {narrowed
                  ? 'No company matches. Clear the search, or pick All.'
                  : <>No companies yet. Generate signals in <Link href="/signals" className="font-medium text-foreground underline underline-offset-2 hover:no-underline">Market Signals</Link>, or add one by hand.</>}
              </TableCell></TableRow>
            )}
            {!list.loading && list.rows.map((company) => {
              const contact = company.best_contact
              return (
                <TableRow key={company.id} data-company={company.id} className="cursor-pointer" onClick={() => open(company)}>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${company.name}`} checked={selectedIds.has(String(company.id))} onChange={() => toggle(String(company.id))} />
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    <button type="button" onClick={(event) => { event.stopPropagation(); open(company) }} className="text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                      {company.name}
                    </button>
                    {company.source === 'manual' && <span data-source="manual" className={cn(CHIP_BASE, CHIP_TONE.muted, 'ml-2 align-middle')}>Added by hand</span>}
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground @xl/outreach:hidden">{contact ? (contact.name ?? 'Company line') : 'No contact yet'}</span>
                  </TableCell>
                  <TableCell className="hidden @lg/outreach:table-cell">{company.industry || NO_VALUE}</TableCell>
                  <TableCell className="hidden @lg/outreach:table-cell">{company.location || NO_VALUE}</TableCell>
                  <TableCell className="hidden @md/outreach:table-cell" onClick={(event) => event.stopPropagation()}>
                    {company.signals_count > 0
                      ? <Link href="/signals" aria-label={`${company.signals_count} ${company.signals_count === 1 ? 'signal' : 'signals'} for ${company.name}. Open Market Signals.`} className="font-medium text-foreground underline underline-offset-2 hover:no-underline">{company.signals_count}</Link>
                      : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="hidden @md/outreach:table-cell"><span data-people-count className={cn(CHIP_BASE, CHIP_TONE.neutral)}>{company.people_count}</span></TableCell>
                  <TableCell className="hidden @xl/outreach:table-cell">
                    {contact ? (
                      <>
                        <p className="font-medium text-foreground">{contact.name ?? 'Company line'}</p>
                        <p className="break-all text-xs text-muted-foreground">{contact.email || contact.phone || NO_VALUE}</p>
                      </>
                    ) : <span className="text-muted-foreground">No contact yet</span>}
                  </TableCell>
                  <TableCell><ReachChip reach={company.reach} /></TableCell>
                  <TableCell className="hidden @2xl/outreach:table-cell">{company.assigned_to_name || 'Not assigned'}</TableCell>
                  <TableCell className="hidden @xl/outreach:table-cell">{lastContactedText(company.last_contacted_at)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Pager total={list.total} noun="company" nounPlural="companies" page={state.page} lastPage={list.lastPage} onPage={(page) => change({ page })} />

      <AddCompanyDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        service={service}
        onSaved={(company) => {
          setNotice({ tone: 'success', text: `${company.name} was added.`, href: outreachCompanyHref(company.id, 'people'), linkText: 'Add people to it' })
          list.reload()
        }}
      />

      <WriteMessageDialog people={writing ?? []} open={writing !== null} onOpenChange={(next) => { if (!next) setWriting(null) }} service={service} {...messageDeps} />

      <OutreachBulkBar
        count={selected.length}
        noun="company"
        nounPlural="companies"
        busy={busy}
        onWrite={() => void write()}
        onConvert={() => void convert()}
        convertHint={selected.length > 1 ? 'Convert to lead works on one company at a time. Tick just one.' : null}
        employees={employees}
        onAssign={(userId) => void assign(userId)}
        onClear={clear}
      />

      {confirmDialog}
    </div>
  )
}
