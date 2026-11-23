'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { useListQuery } from '@/components/shared/scaffolds/use-list-query'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { PremiumHeader } from '@/components/domain/signals/premium-page'
import { SectionBar } from '@/components/domain/signals/signals-header'
import { CrmBulkActionBar } from '@/components/domain/crm/crm-bulk-action-bar'
import { crmBulkResultMessage } from '@/components/domain/crm/crm-bulk-result-message'
import { useAssignableEmployees } from '@/components/domain/crm/lead-employees'
import { getLaravelContext } from '@/lib/laravel-context'
import { configureHref, normalizeProductKey } from '@/lib/product-selection'
import { createLatestOnly } from '@/lib/signal-run-view'
import { displayItems, listScreenState, matchesToReview, mayTick, mergeBulkAnswers, planBulk, type ListScreenState } from '@/lib/portfolio-list/model'
import { clearFiltersPatch, effectiveSort, isNarrowed, listRequest, PORTFOLIO_QUERY, productIdOf, type SortKey } from '@/lib/portfolio-list/query'
import { BANNER_TONE } from '@/lib/portfolio-list/tones'
import { ApiError } from '@/services/core'
import type { CrmBulkActionResponse } from '@/types/crm'
import { portfolioListService } from '@/services/product-master/portfolio-list-service'
import type { MatchesData, PortfolioCan, PortfolioItemType, PortfolioListEnvelope } from '@/services/product-master/portfolio-list-types'
import { MatchesBanner, MatchesReview } from './portfolio-matches'
import { ProductFormDrawer, type ProductFormMode } from './product-form-drawer'
import { PortfolioListTable } from './portfolio-list-table'
import { PortfolioListToolbar } from './portfolio-list-toolbar'
import { PortfolioMoreMenu } from './portfolio-more-menu'

const NOTHING: PortfolioCan = { createProduct: false, createSubProduct: false, editSubProduct: false, viewSell: false, confirmMatches: false }

interface Notice {
  tone: 'success' | 'error'
  text: string
}

const errorText = (cause: unknown, fallback: string) => (cause instanceof ApiError || cause instanceof Error ? cause.message : fallback)

/**
 * The Product Portfolio: the ONE screen where a person finds, filters and opens any product (slice 15, track P3-A). Products with their Sub-products as group
 * headers, a "No product yet" group for strays, a paged list from `GET /api/product-master/list`, filters and the page in the address, bulk actions, the
 * More menu (import, export, duplicates, Recycle Bin, Sync Excel) and, for an administrator, the pair review. It shows NO Signals buttons: it is a product
 * page, not a Signals page.
 *
 * What a person sees follows what the API sent: the SKU, price, category, stock and Sold in CRM columns, the Sold in CRM filter and the bulk bar are drawn only
 * for a caller who may view Sell (`meta.can.viewSell`); the pair review only for an administrator (`meta.can.confirmMatches`).
 */
export function PortfolioList({ canManage, embedded = false }: { canManage: boolean; embedded?: boolean }) {
  const { query, setQuery, setSearch, setPage, setFilter, toggleSort } = useListQuery(PORTFOLIO_QUERY)
  const context = useMemo(() => getLaravelContext(), [])
  const { confirm, confirmDialog } = useConfirm()

  const [data, setData] = useState<PortfolioListEnvelope | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ text: string; status: number | null } | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [lines, setLines] = useState<Array<{ id: number; name: string }>>([])
  const [readinessWords, setReadinessWords] = useState<string[]>([])
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  // Which form is open: a new Product (administrators), or a new Sub-product, with the Product it starts under when the list is about one.
  const [drawer, setDrawer] = useState<{ mode: ProductFormMode; defaultProductId?: number } | null>(null)
  const latest = useRef(createLatestOnly())

  // An old address with a Product's KEY (`/portfolio?product=scholarclone`: saved links, old Ask answers) opens that Product's page; the list's own Product filter is a number.
  const router = useRouter()
  const productFilter = (query.filters.product ?? '').trim()
  const oldKey = productFilter !== '' && productIdOf(query) === undefined ? normalizeProductKey(productFilter) : ''
  useEffect(() => {
    if (oldKey !== '') router.replace(configureHref(oldKey))
  }, [oldKey, router])

  const request = useMemo(() => listRequest(query), [query])
  const can = data?.meta.can ?? NOTHING
  const showMatches = query.filters.view === 'matches'

  const load = useCallback(async () => {
    const ticket = latest.current.next()
    setLoading(true)
    try {
      const answer = await portfolioListService.list(request)
      if (!latest.current.isLatest(ticket)) return
      setData(answer)
      setError(null)
      setSelected(new Set())
    } catch (cause) {
      if (!latest.current.isLatest(ticket)) return
      setError({ text: errorText(cause, 'The portfolio could not be loaded.'), status: cause instanceof ApiError ? cause.status : null })
    } finally {
      if (latest.current.isLatest(ticket)) setLoading(false)
    }
  }, [request])

  useEffect(() => {
    let live = true
    Promise.resolve().then(() => { if (live) void load() })
    return () => { live = false }
  }, [load])

  // The choices of the Product and Readiness filters. Either may fail without stopping the list: the filter then offers fewer choices.
  useEffect(() => {
    let live = true
    portfolioListService.lines().then((r) => { if (live) setLines(r.data.map((l) => ({ id: l.id, name: l.name }))) }).catch(() => undefined)
    portfolioListService.meta().then((r) => { if (live) setReadinessWords(r.data.readinessStatuses ?? []) }).catch(() => undefined)
    return () => { live = false }
  }, [])

  // The pair review: read once the person is known to be an administrator, and again after each decision.
  const [matches, setMatches] = useState<MatchesData | null>(null)
  const [matchesError, setMatchesError] = useState<string | null>(null)
  const [matchesLoading, setMatchesLoading] = useState(false)
  const loadMatches = useCallback(async () => {
    setMatchesLoading(true)
    try {
      const answer = await portfolioListService.matches()
      setMatches(answer.data)
      setMatchesError(null)
    } catch (cause) {
      setMatchesError(errorText(cause, 'The matches could not be loaded.'))
    } finally {
      setMatchesLoading(false)
    }
  }, [])
  const mayConfirm = can.confirmMatches
  useEffect(() => {
    if (!mayConfirm) return
    let live = true
    Promise.resolve().then(() => { if (live) void loadMatches() })
    return () => { live = false }
  }, [mayConfirm, loadMatches])

  // A link or a refresh can hold a page past the end (records were archived since): go to the last page, not to an empty list with no pager.
  const rowCount = data?.data.length
  const total = data?.meta.total ?? 0
  const lastPage = data?.meta.lastPage ?? 1
  useEffect(() => {
    if (rowCount === 0 && total > 0 && query.page > lastPage) setPage(Math.max(1, lastPage))
  }, [rowCount, total, lastPage, query.page, setPage])

  // ---- the state of the screen
  const narrowed = isNarrowed(query)
  const screen: ListScreenState | 'denied' = error?.status === 403 && data === null
    ? 'denied'
    : listScreenState({ loaded: data !== null, error: data === null && error ? error.text : '', available: data?.meta.available ?? true, rows: data?.data.length ?? 0, narrowed })
  const rows = useMemo(() => data?.data ?? [], [data])
  const items = useMemo(() => displayItems(rows, query.page), [rows, query.page])
  const sort: SortKey = effectiveSort(query, can.viewSell)
  const itemType: PortfolioItemType = query.filters.type === 'service' ? 'service' : 'product'
  const pending = matchesToReview(matches).length

  // ---- selection and bulk actions
  const people = useAssignableEmployees(context, selected.size > 0)
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected])
  const toggle = useCallback((id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }), [])
  const toggleAll = useCallback((checked: boolean) => {
    setSelected(checked ? new Set(rows.filter((r) => mayTick(r, can)).map((r) => r.id)) : new Set())
  }, [rows, can])

  const runBulk = useCallback(async (verb: 'Deleted' | 'Reassigned', send: (type: PortfolioItemType, ids: number[]) => Promise<Awaited<ReturnType<typeof portfolioListService.bulkDelete>>>) => {
    setBulkBusy(true)
    setNotice(null)
    try {
      const plan = await planBulk(selectedRows, portfolioListService.crmIdOf)
      const answers: Array<CrmBulkActionResponse['data']> = []
      const failures: string[] = []
      for (const type of ['product', 'service'] as const) {
        const ids = plan.byType[type]
        if (ids.length === 0) continue
        try {
          answers.push((await send(type, ids)).data)
        } catch (cause) {
          failures.push(errorText(cause, 'The change was refused.'))
        }
      }
      const parts: string[] = []
      if (answers.length > 0) parts.push(crmBulkResultMessage(verb, 'sub-product', mergeBulkAnswers(answers)))
      if (failures.length > 0) parts.push(`Not changed: ${failures.join(' ')}`)
      if (plan.unresolved.length > 0) parts.push(`Not changed, because their entry in CRM could not be read: ${plan.unresolved.join(', ')}.`)
      setNotice({ tone: answers.length > 0 && failures.length === 0 && plan.unresolved.length === 0 ? 'success' : 'error', text: parts.join(' ') })
      setSelected(new Set())
      void load()
    } finally {
      setBulkBusy(false)
    }
  }, [selectedRows, load])

  const onDelete = useCallback(async () => {
    const n = selectedRows.length
    const ok = await confirm({
      title: `Delete ${n} ${n === 1 ? 'sub-product' : 'sub-products'} from CRM?`,
      description: 'They move to the Recycle Bin, where they can be restored. Quotes, orders and invoices that already use them keep working, and their description in the portfolio stays.',
      confirmLabel: 'Move to the Recycle Bin',
    })
    if (!ok) return
    await runBulk('Deleted', (type, ids) => portfolioListService.bulkDelete(context, type, ids))
  }, [selectedRows.length, confirm, runBulk, context])

  const onReassign = useCallback((assigneeId: string) => {
    void runBulk('Reassigned', (type, ids) => portfolioListService.bulkAssign(context, type, ids, assigneeId))
  }, [runBulk, context])

  const afterDecision = useCallback((text: string) => {
    setNotice({ tone: 'success', text })
    void load()
    void loadMatches()
  }, [load, loadMatches])

  const clear = () => setQuery(clearFiltersPatch())

  // ---- the page
  const addButtons = (
    <>
      {can.createProduct && <Button type="button" variant="outline" onClick={() => setDrawer({ mode: 'create-product' })}><Plus className="mr-1.5 size-4" aria-hidden="true" />Add product</Button>}
      {can.createSubProduct && <Button type="button" onClick={() => setDrawer({ mode: 'create-sub-product', defaultProductId: productIdOf(query) })}><Plus className="mr-1.5 size-4" aria-hidden="true" />Add sub-product</Button>}
    </>
  )

  const headerActions = (
    <>
      <PortfolioMoreMenu
        itemType={itemType}
        search={query.q}
        canViewSell={can.viewSell}
        canManage={canManage}
        onChanged={() => void load()}
        onNotice={(text) => { setNotice({ tone: 'success', text }) }}
        onError={(text) => { setNotice({ tone: 'error', text }) }}
      />
      {addButtons}
    </>
  )
  const description = 'Every product and the sub-products under it: what each one is, whether it is sold in CRM, and how ready it is.'

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-4 p-4 sm:p-6'}>
      {/* Inside Market Signals (the Product Portfolio tab) the Signals header already names the page, so only its description and actions are drawn, like every other Signals tab. */}
      {embedded
        ? <SectionBar description={description} actions={headerActions} />
        : <PremiumHeader title="Product Portfolio" description={description} actions={headerActions} />}

      {notice && (
        <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${BANNER_TONE[notice.tone]}`}>
          <span>{notice.text}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setNotice(null)} aria-label="Dismiss">Dismiss</Button>
        </div>
      )}

      {mayConfirm && !showMatches && <MatchesBanner count={pending} onReview={() => setFilter('view', 'matches')} />}

      {showMatches && data === null && !error && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">Loading…</div>
      )}
      {showMatches && data !== null && (
        mayConfirm
          ? (
            <MatchesReview
              data={matches}
              loading={matchesLoading}
              error={matchesError}
              onRetry={() => void loadMatches()}
              onBack={() => setFilter('view', 'list')}
              decide={portfolioListService.decide}
              onDecided={afterDecision}
            />
          )
          : (
            <EmptyState
              title="Only an administrator can review matches"
              description="Ask an administrator to decide which products are the same as which sub-products."
              action={<Button type="button" variant="outline" onClick={() => setFilter('view', 'list')}>Back to the list</Button>}
            />
          )
      )}

      {!showMatches && (
        <>
          <PortfolioListToolbar
            query={query}
            lines={lines}
            readinessWords={readinessWords}
            canViewSell={can.viewSell}
            narrowed={narrowed}
            onSearch={setSearch}
            onFilter={setFilter}
            onClear={clear}
          />

          {error && data !== null && <p role="alert" className={`rounded-lg border p-2.5 text-sm ${BANNER_TONE.error}`}>{error.text}</p>}

          {screen === 'loading' && (
            <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">Loading…</div>
          )}
          {screen === 'error' && <ErrorState title="The portfolio could not be loaded" description={error?.text} retry={() => void load()} />}
          {screen === 'denied' && <EmptyState title="You cannot open the Product Portfolio" description="Your role does not include it. Ask an administrator if you need it." />}
          {screen === 'unavailable' && (
            <EmptyState title="The Product Portfolio is not set up here yet" description="The product database has not been added to this server yet, so there is nothing to show." />
          )}
          {screen === 'empty' && (
            <EmptyState title="No products yet" description={can.createSubProduct || can.createProduct ? 'Add a product or a sub-product to start.' : 'Nothing has been added yet.'} action={addButtons} />
          )}
          {screen === 'filtered-empty' && (
            <EmptyState title="Nothing matches" description="Try a different search, or change the filters." action={<Button type="button" variant="outline" onClick={clear}>Clear filters</Button>} />
          )}

          {screen === 'ready' && data && (
            <div className="space-y-3">
              <PortfolioListTable
                items={items}
                can={can}
                sort={sort}
                dir={query.dir}
                onSort={toggleSort}
                selected={selected}
                onToggle={toggle}
                onToggleAll={toggleAll}
                canAddSubProduct={can.createSubProduct}
                onAddSubProduct={(productId) => setDrawer({ mode: 'create-sub-product', defaultProductId: productId })}
                busy={loading}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>{data.meta.total} {data.meta.total === 1 ? 'result' : 'results'}</span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={query.page <= 1} onClick={() => setPage(query.page - 1)}>Previous</Button>
                  <span>Page {query.page} of {data.meta.lastPage}</span>
                  <Button type="button" variant="outline" size="sm" disabled={query.page >= data.meta.lastPage} onClick={() => setPage(query.page + 1)}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <CrmBulkActionBar
        count={selected.size}
        busy={bulkBusy}
        people={people.map((p) => ({ value: p.id, label: p.name }))}
        onReassign={(assigneeId) => onReassign(assigneeId)}
        onDelete={() => void onDelete()}
        onClear={() => setSelected(new Set())}
        deleteLabel="Delete (to the Recycle Bin)"
      />
      {/* The one form that adds a Product or a Sub-product (it loads nothing until it is opened). Built by the form track; the list only opens it and reads again after a save. */}
      <ProductFormDrawer
        open={drawer !== null}
        onOpenChange={(open) => { if (!open) setDrawer(null) }}
        mode={drawer?.mode ?? 'create-sub-product'}
        defaultProductId={drawer?.defaultProductId}
        onSaved={() => { setDrawer(null); setNotice({ tone: 'success', text: 'Saved.' }); void load() }}
      />
      {confirmDialog}
    </div>
  )
}
