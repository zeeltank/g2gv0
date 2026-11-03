'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListPage } from '@/components/shared/scaffolds/list-page'
import { ListSearch } from '@/components/shared/scaffolds/list-search'
import { PageTabs, TabPanel, type PageTab } from '@/components/shared/scaffolds/page-tabs'
import { useListQuery } from '@/components/shared/scaffolds/use-list-query'
import { useUrlTab } from '@/components/shared/scaffolds/use-url-tab'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { availableActions } from '@/lib/org-accounts/display'
import { classifyLoadFailure, FORBIDDEN_PAGE_TEXT, linkFailureText } from '@/lib/org-accounts/failure'
import {
  clearFiltersPatch, LIFECYCLE_CHOICES, LIST_TAB_IDS, listScreenState, ORG_LIST_QUERY, PRESENCE_CHOICES, queryToParams, rangeText, summaryTiles,
} from '@/lib/org-accounts/list-model'
import { detailHref, type OrgLinks } from '@/lib/org-accounts/links'
import { decidedNotice, linkRequest, removeSuggestion, type LinkAction } from '@/lib/org-accounts/suggestions'
import { formatDay } from '@/lib/signal-review/signal-display'
import { cn } from '@/lib/utils'
import type { OrgAccountsApi } from '@/services/org-accounts/api-types'
import { orgAccountsService } from '@/services/org-accounts/org-accounts-service'
import type { OrgAccountItem, OrgListResponse, OrgMeta, OrgSuggestion } from '@/services/org-accounts/types'
import { OrgDuplicatesPanel, type DecisionInProgress } from './org-account-duplicates'
import { Facet, LifecycleChip, NoticeBar, SourceChips, SummaryTiles, type ScreenNotice } from './org-account-parts'

const ID_PREFIX = 'org-360'
const EMPTY_TEXT = 'Organisation 360 is filled by a one-time backfill, and it has not run for this organisation yet. Ask an administrator to run it.'

/**
 * Organisation 360 (Sales & Marketing › Organisation 360): every organisation once, with the sources that know it. Two tabs: Organisations (a search,
 * a Lifecycle choice and Has CRM / GTM / Signals choices, all kept in the address) and Possible duplicates (pairs of alike names a person confirms or
 * rejects). `service` and `links` are for tests; the screen uses the real ones.
 */
export function OrgAccountList({ service = orgAccountsService, links }: { service?: OrgAccountsApi; links: OrgLinks }) {
  const context = useMemo(() => getLaravelContext(), [])
  const { query, setSearch, setFilter, setQuery, setPage } = useListQuery(ORG_LIST_QUERY)
  const [tab, setTab] = useUrlTab(LIST_TAB_IDS)
  const params = useMemo(() => queryToParams(query), [query])

  const [data, setData] = useState<OrgListResponse | null>(null)
  const [refreshing, setRefreshing] = useState(true)
  const [error, setError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [meta, setMeta] = useState<OrgMeta | null>(null)

  const [suggestions, setSuggestions] = useState<OrgSuggestion[] | null>(null)
  const [suggestionsError, setSuggestionsError] = useState('')
  // How many pairs the summary counted and how many the server sent, each noted once: the difference is what the server held back.
  const [countedAtFirst, setCountedAtFirst] = useState<number | null>(null)
  const [sentAtFirst, setSentAtFirst] = useState<number | null>(null)
  const [busy, setBusy] = useState<DecisionInProgress | null>(null)
  const [failure, setFailure] = useState('')
  const [notice, setNotice] = useState<ScreenNotice | null>(null)

  // Only the newest request may change what is shown: a slow answer to an earlier search must not overwrite the answer to a later one.
  const latest = useRef(0)
  const latestSuggestions = useRef(0)

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
      setCountedAtFirst((current) => current ?? response.summary.suggestions)
    } catch (cause) {
      if (mine !== latest.current || quiet) return
      const problem = classifyLoadFailure(cause, 'The organisations could not be loaded.')
      setForbidden(problem.kind === 'forbidden')
      setError(problem.kind === 'forbidden' ? '' : problem.message)
    } finally {
      if (mine === latest.current) setRefreshing(false)
    }
  }, [context, service, params])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const loadSuggestions = useCallback(async () => {
    if (!isLaravelContextReady(context)) return
    const mine = ++latestSuggestions.current
    setSuggestionsError('')
    try {
      const response = await service.suggestions()
      if (mine !== latestSuggestions.current) return
      setSuggestions(response.data)
      setSentAtFirst((current) => current ?? response.data.length)
    } catch (cause) {
      if (mine !== latestSuggestions.current) return
      setSuggestionsError(classifyLoadFailure(cause, 'The possible duplicates could not be loaded.').message)
    }
  }, [context, service])

  useEffect(() => {
    queueMicrotask(() => { void loadSuggestions() })
  }, [loadSuggestions])

  // What this person may do. If it cannot be read, nothing is offered.
  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    let cancelled = false
    service.meta().then((response) => { if (!cancelled) setMeta(response.data) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [context, service])

  const decide = useCallback(async (suggestion: OrgSuggestion, action: LinkAction): Promise<boolean> => {
    setBusy({ key: suggestion.key, action })
    setFailure('')
    try {
      await service.link(linkRequest(suggestion, action))
      setSuggestions((current) => (current === null ? current : removeSuggestion(current, suggestion.key)))
      setNotice({ tone: 'success', text: decidedNotice(suggestion, action) })
      // Two records now count as one organisation, so the list and its counts have changed.
      if (action === 'confirm') void load(true)
      return true
    } catch (cause) {
      setFailure(linkFailureText(cause))
      return false
    } finally {
      setBusy(null)
    }
  }, [service, load])

  const can = availableActions(meta)
  const rows = data?.data ?? []
  const state = listScreenState({ loaded: data !== null, forbidden, error, rows: rows.length, summaryTotal: data?.summary.total ?? 0, query })

  const hidden = countedAtFirst !== null && sentAtFirst !== null ? Math.max(0, countedAtFirst - sentAtFirst) : 0
  const pairCount = suggestions !== null ? suggestions.length + hidden : (data?.summary.suggestions ?? null)
  const tabs: PageTab[] = [
    { id: 'organisations', label: 'Organisations' },
    { id: 'duplicates', label: 'Possible duplicates', count: pairCount },
  ]

  if (state === 'forbidden') {
    return (
      <ListPage title="Organisation 360" status="empty" empty={{ title: FORBIDDEN_PAGE_TEXT, description: 'Ask an administrator to give you access.' }}>
        {null}
      </ListPage>
    )
  }

  return (
    <ListPage
      title="Organisation 360"
      description="Everything we know about an organisation from Signals, GTM and the CRM, in one place."
      toolbar={(
        <>
          <div className="w-full"><PageTabs tabs={tabs} active={tab} onChange={setTab} label="Organisation 360 sections" idPrefix={ID_PREFIX} /></div>
          {tab === 'organisations' && (
            <div className="flex w-full flex-wrap items-end gap-3">
              <div className="w-full max-w-sm sm:flex-1">
                <ListSearch value={query.q} onSearch={setSearch} placeholder="Search name or website" label="Search organisations" />
              </div>
              <Facet label="Lifecycle" value={query.filters.lifecycle} choices={LIFECYCLE_CHOICES} onChange={(v) => setFilter('lifecycle', v)} />
              <Facet label="Has CRM" value={query.filters.crm} choices={PRESENCE_CHOICES} onChange={(v) => setFilter('crm', v)} />
              <Facet label="Has GTM" value={query.filters.gtm} choices={PRESENCE_CHOICES} onChange={(v) => setFilter('gtm', v)} />
              <Facet label="Has Signals" value={query.filters.signals} choices={PRESENCE_CHOICES} onChange={(v) => setFilter('signals', v)} />
            </div>
          )}
        </>
      )}
      notice={notice && <NoticeBar notice={notice} onDismiss={() => setNotice(null)} />}
      status="ready"
    >
      {data && <SummaryTiles tiles={summaryTiles(data.summary, pairCount)} />}

      <TabPanel id="organisations" active={tab} idPrefix={ID_PREFIX}>
        {state === 'loading' && (
          <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading organisations…
          </div>
        )}

        {state === 'error' && <ErrorState title="Organisations could not be loaded" description={error} retry={() => void load()} />}

        {state === 'empty' && <EmptyState title="No organisations yet" description={EMPTY_TEXT} />}

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
                <caption className="sr-only">Organisations</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Lifecycle</TableHead>
                    <TableHead>Known in</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => <OrgRow key={row.id} row={row} href={detailHref(links, row.id)} />)}
                </TableBody>
              </Table>
            </div>
            <Pager meta={data.meta} rows={rows.length} onPage={setPage} />
          </div>
        )}
      </TabPanel>

      <TabPanel id="duplicates" active={tab} idPrefix={ID_PREFIX}>
        <OrgDuplicatesPanel
          suggestions={suggestions}
          error={suggestionsError}
          hidden={hidden}
          canConfirm={can.confirmLinks}
          busy={busy}
          failure={failure}
          onRetry={() => void loadSuggestions()}
          onDecide={decide}
        />
      </TabPanel>
    </ListPage>
  )
}

function OrgRow({ row, href }: { row: OrgAccountItem; href: string }) {
  return (
    <TableRow>
      <TableCell className="max-w-xs">
        <Link href={href} className="block font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{row.name}</Link>
        <span className="block break-all text-xs text-muted-foreground">{row.domain ?? 'No website'}</span>
      </TableCell>
      <TableCell><LifecycleChip lifecycle={row.lifecycle} /></TableCell>
      <TableCell><SourceChips item={row} /></TableCell>
      <TableCell className="text-sm">{row.owner_name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDay(row.updated_at) ?? '—'}</TableCell>
    </TableRow>
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
