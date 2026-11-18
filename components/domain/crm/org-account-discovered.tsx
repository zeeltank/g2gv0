'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListSearch } from '@/components/shared/scaffolds/list-search'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { useListQuery } from '@/components/shared/scaffolds/use-list-query'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { classifyCreateFailure, classifyLoadFailure, DELETED_NAME_QUESTION, FORBIDDEN_PAGE_TEXT } from '@/lib/org-accounts/failure'
import { recordHref, type OrgLinks } from '@/lib/org-accounts/links'
import {
  clearFiltersPatch, DISCOVERED_QUERY, discoveredParams, discoveredState, LIFECYCLE_CHOICES, rangeText,
} from '@/lib/org-accounts/scope-model'
import { formatDay } from '@/lib/signal-review/signal-display'
import { cn } from '@/lib/utils'
import type { OrgAccountsApi } from '@/services/org-accounts/api-types'
import { orgAccountsService } from '@/services/org-accounts/org-accounts-service'
import type { OrgAccountItem, OrgCreateCrmResult, OrgListResponse } from '@/services/org-accounts/types'
import { returnFocusTo } from './org-account-focus'
import { Facet, LifecycleChip, NoticeBar, SourceChips, type ScreenNotice } from './org-account-parts'

const NOT_SET_UP_TITLE = 'Discovered organisations are not set up yet'

/** What the page says after the CRM organisation was created, or restored. */
function createdText(name: string, result: OrgCreateCrmResult['data']): string {
  if (result.restored) return `The deleted CRM organisation ${name} was restored and linked.`
  return result.created ? `The CRM organisation ${name} was created and linked.` : `${name} already has a CRM organisation, so nothing new was created.`
}

/**
 * The Discovered scope of the Organizations list: organisations found in Signals or GTM that are not in the CRM yet, with a search and a Lifecycle choice
 * (both kept in the address). Each row offers "Create CRM organisation" to a person who may add organizations: it asks first, and when a deleted CRM
 * organisation already has the name it asks whether to restore that one instead. `service`, `links` and `can` are for tests; the screen passes its own.
 */
export function OrgDiscoveredPanel({ context, service = orgAccountsService, links, canCreate, onChanged }: {
  context: LaravelContext
  service?: OrgAccountsApi
  links: OrgLinks
  canCreate: boolean
  /** Called after a CRM organisation was made (the counts on the switch have changed). */
  onChanged: () => void
}) {
  const { query, setSearch, setFilter, setQuery, setPage } = useListQuery(DISCOVERED_QUERY)
  const params = useMemo(() => discoveredParams(query), [query])
  const { confirm, confirmDialog } = useConfirm()

  const [data, setData] = useState<OrgListResponse | null>(null)
  const [refreshing, setRefreshing] = useState(true)
  const [error, setError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [notice, setNotice] = useState<ScreenNotice | null>(null)
  const [noticeTarget, setNoticeTarget] = useState<{ crmId: number } | null>(null)
  const [working, setWorking] = useState<number | null>(null)

  const noticeBar = useRef<HTMLDivElement>(null)
  const focusNotice = useRef(false)
  // Only the newest request may change what is shown: a slow answer to an earlier search must not overwrite the answer to a later one.
  const latest = useRef(0)

  /** `quiet` reads the list again behind the page: a failure then leaves what is on screen alone. */
  const load = useCallback(async (quiet = false) => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setRefreshing(false)
      return
    }
    const mine = ++latest.current
    setRefreshing(true)
    try {
      const response = await service.list(params)
      if (mine !== latest.current) return
      setData(response)
      setError('')
      setForbidden(false)
      setUnavailable(false)
    } catch (cause) {
      if (mine !== latest.current || quiet) return
      const problem = classifyLoadFailure(cause, 'The discovered organisations could not be loaded.')
      setForbidden(problem.kind === 'forbidden')
      setUnavailable(problem.kind === 'unavailable')
      setError(problem.kind === 'error' || problem.kind === 'notFound' ? problem.message : '')
    } finally {
      if (mine === latest.current) setRefreshing(false)
    }
  }, [context, service, params])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  // After the button that was pressed has left the page (the organisation is in the CRM now), the focus goes to the notice instead of to nowhere.
  useEffect(() => {
    if (notice && focusNotice.current) {
      focusNotice.current = false
      noticeBar.current?.focus()
    }
  }, [notice])

  /** One try at creating (or, with `restore`, restoring) the CRM organisation. */
  const attempt = async (row: OrgAccountItem, restore: boolean): Promise<'done' | 'deleted' | 'failed'> => {
    try {
      const response = await service.createCrmOrganisation(row.id, restore ? { restore_deleted: true } : {})
      await load(true)
      onChanged()
      focusNotice.current = true
      setNoticeTarget({ crmId: response.data.crm_organization_id })
      setNotice({ tone: 'success', text: createdText(row.name, response.data) })
      return 'done'
    } catch (cause) {
      const problem = classifyCreateFailure(cause)
      if (problem.kind === 'deleted_name_exists') return 'deleted'
      setNoticeTarget(null)
      setNotice({ tone: 'error', text: problem.message })
      return 'failed'
    }
  }

  const createCrm = async (row: OrgAccountItem, trigger: HTMLElement) => {
    if (working !== null) return
    const agreed = await confirm({
      title: `Create a CRM organisation for ${row.name}?`,
      description: 'A CRM organisation is created from this name and website and linked to this record. Nothing is sent to anyone.',
      confirmLabel: 'Create CRM organisation',
      tone: 'default',
    })
    if (!agreed) {
      returnFocusTo(trigger)
      return
    }
    setNotice(null)
    setWorking(row.id)
    try {
      const first = await attempt(row, false)
      if (first === 'failed') returnFocusTo(trigger)
      if (first !== 'deleted') return
      // A deleted CRM organisation holds the name. Restoring brings its history back; the person decides.
      setWorking(null)
      const restore = await confirm({ title: 'Restore the deleted organisation?', description: DELETED_NAME_QUESTION, confirmLabel: 'Restore', tone: 'default' })
      if (!restore) {
        setNoticeTarget(null)
        setNotice({ tone: 'success', text: 'Nothing was created. The deleted organisation was left as it is.' })
        returnFocusTo(trigger)
        return
      }
      setWorking(row.id)
      if (await attempt(row, true) === 'failed') returnFocusTo(trigger)
    } finally {
      setWorking(null)
    }
  }

  const rows = data?.data ?? []
  const state = discoveredState({ loaded: data !== null, forbidden, unavailable, error, rows: rows.length, query })
  const openHref = noticeTarget ? recordHref(links.crmOrganisations, noticeTarget.crmId) : null

  return (
    <section aria-labelledby="org-discovered-heading" className="space-y-3">
      <div>
        <h2 id="org-discovered-heading" className="text-base font-semibold text-foreground">Discovered organisations</h2>
        <p className="text-sm text-muted-foreground">Organisations found in Signals or GTM that are not in the CRM yet.</p>
      </div>

      <div className="flex w-full flex-wrap items-end gap-3">
        <div className="w-full max-w-sm sm:flex-1">
          <ListSearch value={query.q} onSearch={setSearch} placeholder="Search name or website" label="Search discovered organisations" />
        </div>
        <Facet label="Lifecycle" value={query.filters.lifecycle} choices={LIFECYCLE_CHOICES} onChange={(v) => setFilter('lifecycle', v)} />
      </div>

      {notice && (
        <NoticeBar ref={noticeBar} notice={notice} onDismiss={() => { setNotice(null); setNoticeTarget(null) }}>
          {openHref && <Button size="sm" variant="outline" asChild><Link href={openHref}>Open the CRM organisation</Link></Button>}
        </NoticeBar>
      )}

      {state === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading discovered organisations…
        </div>
      )}
      {state === 'forbidden' && <EmptyState title={FORBIDDEN_PAGE_TEXT} description="Ask an administrator to give you access." />}
      {state === 'unavailable' && <EmptyState title={NOT_SET_UP_TITLE} description="This server has not been set up for linked records yet. The CRM list is not affected." />}
      {state === 'error' && <ErrorState title="Discovered organisations could not be loaded" description={error} retry={() => void load()} />}
      {state === 'empty' && <EmptyState title="Nothing left to discover" description="Every organisation found in Signals or GTM is in the CRM." />}
      {state === 'filtered-empty' && (
        <EmptyState
          title="No organisations match these filters"
          description="Try a different search, or widen the filters."
          action={<Button variant="outline" onClick={() => setQuery(clearFiltersPatch())}>Clear filters</Button>}
        />
      )}

      {state === 'ready' && data && (
        <div className={cn('space-y-3 transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing}>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <caption className="sr-only">Discovered organisations</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Lifecycle</TableHead>
                  <TableHead>Known in</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Updated</TableHead>
                  {canCreate && <TableHead><span className="sr-only">Action</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-org={row.id}>
                    <TableCell className="max-w-xs">
                      <span className="block font-semibold text-foreground">{row.name}</span>
                      <span className="block break-all text-xs text-muted-foreground">{row.domain ?? 'No website'}</span>
                    </TableCell>
                    <TableCell><LifecycleChip lifecycle={row.lifecycle} /></TableCell>
                    <TableCell><SourceChips item={row} /></TableCell>
                    <TableCell className="text-sm">{row.owner_name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDay(row.updated_at) ?? '—'}</TableCell>
                    {canCreate && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={working !== null}
                          aria-label={`Create CRM organisation for ${row.name}`}
                          onClick={(event) => void createCrm(row, event.currentTarget)}
                        >
                          {working === row.id ? 'Working…' : 'Create CRM organisation'}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager meta={data.meta} rows={rows.length} onPage={setPage} />
        </div>
      )}

      {confirmDialog}
    </section>
  )
}

function Pager({ meta, rows, onPage }: { meta: OrgListResponse['meta']; rows: number; onPage: (page: number) => void }) {
  const range = rangeText(meta, rows)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>{range}</span>
      {meta.last_page > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
          <span>Page {meta.page} of {meta.last_page}</span>
          <Button size="sm" variant="outline" disabled={meta.page >= meta.last_page} onClick={() => onPage(meta.page + 1)}>Next</Button>
        </nav>
      )}
    </div>
  )
}
