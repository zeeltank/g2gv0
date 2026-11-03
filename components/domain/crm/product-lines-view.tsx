'use client'

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListSearch, useListQuery } from '@/components/shared/scaffolds'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { productMasterService } from '@/services/product-master/product-master-service'
import type { PmItemType, PmKind, PmListData, PmMeta, PmOption, PmProductRow, PmRecord, PmStatusFilter, PmSubProductRow } from '@/services/product-master/types'
import { IcpBadge, SignalsCount } from './product-line-columns'
import { linesSummary, lineIcpSummary, PRODUCT_LIST_QUERY } from './product-lines-model'
import { ProductMasterForm, type FormTarget, type ProductMasterWriter } from './product-master-form'
import { newChoices, productChoices } from './product-master-model'
import { ArchivedBadge, ReadinessBadge, SharedBadge, SoldBadge } from './product-master-parts'

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
  { label: 'All', value: 'all' },
]

/** The part of the Product Master API this view reads and writes through; the real one by default, a stand-in in a test. */
export type ProductLinesApi = Pick<typeof productMasterService, 'list' | 'meta' | 'options'> & ProductMasterWriter

interface Notice {
  text: string
  action?: { label: string; run: () => void }
}

/**
 * The product lines of the Products screen (the "Product lines" scope): every product line with the sub-products inside it, including the ones that are
 * only in the Signals Portfolio and not sold from the CRM catalogue. The scope switch is drawn by the screen and handed in as `scopeSwitch`, so it
 * sits where it sits in the Catalogue view. Search and the status filter live in the address.
 *
 * A sub-product that is also in the CRM catalogue opens its catalogue page (`catalogueHref`); a product line, or a sub-product that is not in the catalogue,
 * opens its own page (`recordHref`). "New…" offers only what the server says this person may create.
 */
export function ProductLinesView({ scopeSwitch, recordHref, catalogueHref, service = productMasterService }: {
  scopeSwitch: ReactNode
  recordHref: (masterId: number) => string
  catalogueHref: (crmProductId: number, type: PmItemType | null) => string
  service?: ProductLinesApi
}) {
  const { query, setQuery, setSearch, setFilter } = useListQuery(PRODUCT_LIST_QUERY)
  const status = query.filters.status as PmStatusFilter

  const [data, setData] = useState<PmListData | null>(null)
  const [refreshing, setRefreshing] = useState(true)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState<PmMeta | null>(null)
  const [options, setOptions] = useState<PmOption[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set())
  const [drawer, setDrawer] = useState<{ open: boolean; target: FormTarget | null }>({ open: false, target: null })

  // Only the newest request may change what is shown: a slow answer to an earlier search must not overwrite the answer to a later one.
  const latest = useRef(0)
  const load = useCallback(async () => {
    if (!isLaravelContextReady(getLaravelContext())) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setRefreshing(false)
      return
    }
    const mine = ++latest.current
    setRefreshing(true)
    try {
      const response = await service.list({ status, q: query.q || undefined })
      if (mine !== latest.current) return
      setData(response.data)
      setError('')
    } catch (cause) {
      if (mine !== latest.current) return
      setError(cause instanceof Error ? cause.message : 'Unable to load the product lines.')
    } finally {
      if (mine === latest.current) setRefreshing(false)
    }
  }, [service, status, query.q])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const loadChoices = useCallback(async () => {
    if (!isLaravelContextReady(getLaravelContext())) return
    const [metaResponse, optionsResponse] = await Promise.allSettled([service.meta(), service.options()])
    if (metaResponse.status === 'fulfilled') setMeta(metaResponse.value.data)
    if (optionsResponse.status === 'fulfilled') setOptions(optionsResponse.value.data)
  }, [service])

  useEffect(() => {
    queueMicrotask(() => { void loadChoices() })
  }, [loadChoices])

  const openCreate = useCallback((kind: PmKind, extra: { productId?: number | null } = {}) => {
    setDrawer({ open: true, target: { mode: 'create', kind, ...extra } })
  }, [])
  const closeDrawer = useCallback(() => setDrawer((d) => ({ ...d, open: false })), [])

  const onSaved = useCallback((record: PmRecord, message: string) => {
    closeDrawer()
    if (record.kind === 'product') {
      // The new product line is in the picker at once, so "Add its first sub-product" opens with it chosen instead of waiting for the choices to be read again.
      setOptions((current) => (current.some((o) => o.id === record.id)
        ? current
        : [...current, { id: record.id, key: record.key, name: record.name, kind: 'product', parentId: null, label: record.name }]))
    }
    setNotice(record.kind === 'product' && meta?.can.createSubProduct
      ? { text: message, action: { label: 'Add its first sub-product', run: () => openCreate('sub_product', { productId: record.id }) } }
      : { text: message })
    void load()
    void loadChoices()
  }, [closeDrawer, meta, load, loadChoices, openCreate])

  const toggle = (id: number) => setCollapsed((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const choices = newChoices(meta?.can ?? null)
  const unavailable = data?.available === false
  const hasRows = (data?.products.length ?? 0) > 0
  const searching = query.q !== '' || status !== 'active'

  const newMenu = choices.length > 0 && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button><Plus className="mr-1.5 size-4" aria-hidden="true" />New…</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {choices.map((choice) => (
          <DropdownMenuItem key={choice.kind} onSelect={() => openCreate(choice.kind)} className="flex-col items-start gap-0.5">
            <span className="font-medium">{choice.label}</span>
            <span className="text-xs text-muted-foreground">{choice.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground">
            {data && hasRows ? `The groups Signals and the Portfolio know, with what is in them. ${linesSummary(data.totals)}` : 'The groups Signals and the Portfolio know, with what is in them.'}
          </p>
          {scopeSwitch && <div className="mt-3">{scopeSwitch}</div>}
        </div>
        {newMenu && <div className="flex flex-wrap items-center gap-2">{newMenu}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-sm sm:flex-1">
          <ListSearch value={query.q} onSearch={setSearch} placeholder="Search name, ID or key…" label="Search product lines" />
        </div>
        <div className="w-40">
          <Select value={status} onChange={(value) => setFilter('status', value)} options={STATUS_OPTIONS} aria-label="Show" />
        </div>
      </div>

      {notice && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success bg-card p-3 text-sm text-foreground">
          <span>{notice.text}</span>
          <span className="flex items-center gap-2">
            {notice.action && <Button size="sm" variant="outline" onClick={notice.action.run}>{notice.action.label}</Button>}
            <Button size="sm" variant="ghost" onClick={() => setNotice(null)} aria-label="Dismiss">Dismiss</Button>
          </span>
        </div>
      )}

      {error && <ErrorState title="This could not be loaded" description={error} retry={() => void load()} />}
      {!error && data === null && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">Loading…</div>
      )}
      {!error && unavailable && (
        <EmptyState title="Product lines are not set up here yet" description="The product lines have not been added to this server's database yet, so there is nothing to show." />
      )}
      {!error && data !== null && !unavailable && !hasRows && (
        searching
          ? (
            <EmptyState
              title="Nothing matches"
              description="Try a different search, or show archived and all product lines."
              // One change, not two: each of setSearch and setFilter builds its address from the state it was rendered with, so the second would undo the first.
              action={<Button variant="outline" onClick={() => setQuery({ q: '', filters: { status: 'active' } })}>Clear search and filter</Button>}
            />
          )
          : (
            <EmptyState
              title="No product lines yet"
              description={choices.length > 0 ? 'Create your first product line to start.' : 'Nothing has been added yet.'}
              action={newMenu || undefined}
            />
          )
      )}

      {!error && hasRows && data && (
        <div className={cn('space-y-3 transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing}>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <caption className="sr-only">Product lines and their sub-products</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Readiness</TableHead>
                  <TableHead>Sold in CRM</TableHead>
                  <TableHead className="text-right">Signals</TableHead>
                  <TableHead>ICP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.products.map((product) => (
                  <LineRows
                    key={product.id}
                    product={product}
                    expanded={!collapsed.has(product.id)}
                    onToggle={() => toggle(product.id)}
                    recordHref={recordHref}
                    catalogueHref={catalogueHref}
                    canAdd={Boolean(meta?.can.createSubProduct) && !product.shared && product.status === 'active'}
                    onAdd={() => openCreate('sub_product', { productId: product.id })}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Sub-product IDs come from the Portfolio and are shown as they are. “Sold in CRM” means the sub-product also has a catalogue item, so a quote can include it;
            it then opens in the catalogue. A sub-product’s Signals are the ones whose best-matching offer it is, and a product line’s are every signal recorded under it.
            “Built-in” means the product line runs on its built-in ideal-customer profile and none of your own is saved.
          </p>
        </div>
      )}

      <ProductMasterForm
        open={drawer.open}
        target={drawer.target}
        meta={meta}
        products={productChoices(options)}
        onClose={closeDrawer}
        onSaved={onSaved}
        service={service}
      />
    </div>
  )
}

function SubProductRow({ sub, recordHref, catalogueHref }: {
  sub: PmSubProductRow
  recordHref: (masterId: number) => string
  catalogueHref: (crmProductId: number, type: PmItemType | null) => string
}) {
  // A sold sub-product has its catalogue page (with Signals & ICP and Usage tabs); one that is not sold has only its own page.
  const href = sub.soldInCrm && sub.crmProductId !== null ? catalogueHref(sub.crmProductId, sub.crmItemType) : recordHref(sub.id)
  return (
    <TableRow className={cn(sub.status === 'archived' && 'opacity-60')}>
      <TableCell className="pl-10">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href} className="font-medium text-foreground hover:underline">{sub.name}</Link>
          {sub.status === 'archived' && <ArchivedBadge />}
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{sub.offerId ?? '—'}</TableCell>
      <TableCell><ReadinessBadge readiness={sub.readiness} /></TableCell>
      <TableCell><SoldBadge sold={sub.soldInCrm} /></TableCell>
      <TableCell className="text-right"><SignalsCount count={sub.signalsFound} /></TableCell>
      <TableCell><IcpBadge state={sub.icp} /></TableCell>
    </TableRow>
  )
}

function LineRows({ product, expanded, onToggle, recordHref, catalogueHref, canAdd, onAdd }: {
  product: PmProductRow
  expanded: boolean
  onToggle: () => void
  recordHref: (masterId: number) => string
  catalogueHref: (crmProductId: number, type: PmItemType | null) => string
  canAdd: boolean
  onAdd: () => void
}) {
  return (
    <Fragment>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${product.name}`}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {expanded ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
            </button>
            <Link href={recordHref(product.id)} className="font-semibold text-foreground hover:underline">{product.name}</Link>
            <span className="text-xs text-muted-foreground">product line · {product.subProductCount} {product.subProductCount === 1 ? 'sub-product' : 'sub-products'}</span>
            {product.shared && <SharedBadge />}
            {product.status === 'archived' && <ArchivedBadge />}
          </div>
        </TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">{product.key}</TableCell>
        <TableCell><span className="text-muted-foreground">—</span></TableCell>
        <TableCell>{product.soldInCrmCount} of {product.subProductCount}</TableCell>
        <TableCell className="text-right"><SignalsCount count={product.signalsFound} /></TableCell>
        <TableCell>
          {/* ICPs belong to sub-products now: the line says how many of its sub-products have an active one (a profile saved on the line itself is legacy). */}
          <span data-line-icp title={lineIcpSummary(product.subProducts).title}>{lineIcpSummary(product.subProducts).text}</span>
        </TableCell>
      </TableRow>

      {expanded && product.subProducts.map((sub) => (
        <SubProductRow key={sub.id} sub={sub} recordHref={recordHref} catalogueHref={catalogueHref} />
      ))}

      {expanded && product.subProducts.length === 0 && (
        <TableRow>
          <TableCell colSpan={6} className="pl-10 text-sm text-muted-foreground">
            No sub-products yet.
            {canAdd && <Button variant="link" size="sm" className="ml-1 h-auto p-0" onClick={onAdd}>Add one</Button>}
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}
