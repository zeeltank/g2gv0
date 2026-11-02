'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListPage, ListSearch, useListQuery, type ListQueryConfig, type ListStatus } from '@/components/shared/scaffolds'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { CRM_PRODUCT_MASTER_ACCESS_LINK } from '@/lib/gtg-navigation'
import { cn } from '@/lib/utils'
import { productMasterService } from '@/services/product-master/product-master-service'
import type { PmKind, PmListData, PmMeta, PmOption, PmProductRow, PmRecord, PmStatusFilter } from '@/services/product-master/types'
import { ProductMasterForm, type FormTarget } from './product-master-form'
import { listSummary, newChoices, productChoices } from './product-master-model'
import { ArchivedBadge, ReadinessBadge, SharedBadge, SoldBadge } from './product-master-parts'

// Defined once, outside the component: useListQuery depends on it.
const LIST_QUERY: ListQueryConfig = { filters: { status: { default: 'active', allowed: ['active', 'archived', 'all'] } } }
const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
  { label: 'All', value: 'all' },
]

interface Notice {
  text: string
  action?: { label: string; run: () => void }
}

/**
 * The Product Master list (Sales & Marketing › Product Master): every product with its sub-products, and the items that exist only in the CRM
 * catalogue. Search and the status filter live in the URL. Opening a name goes to its page; "New…" opens the form, and offers only what the server says
 * this person may create.
 */
export function ProductMasterListView() {
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const { query, setSearch, setFilter } = useListQuery(LIST_QUERY)
  const status = query.filters.status as PmStatusFilter

  const [data, setData] = useState<PmListData | null>(null)
  const [refreshing, setRefreshing] = useState(true)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState<PmMeta | null>(null)
  const [options, setOptions] = useState<PmOption[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set())
  const [drawer, setDrawer] = useState<{ open: boolean; target: FormTarget | null }>({ open: false, target: null })

  const detailHref = useCallback((id: number) => `${resolveAccessLink(CRM_PRODUCT_MASTER_ACCESS_LINK)}/${id}`, [resolveAccessLink])

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setRefreshing(false)
      return
    }
    setRefreshing(true)
    try {
      const response = await productMasterService.list({ status, q: query.q || undefined })
      setData(response.data)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the Product Master.')
    } finally {
      setRefreshing(false)
    }
  }, [context, status, query.q])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const loadChoices = useCallback(async () => {
    if (!isLaravelContextReady(context)) return
    const [metaResponse, optionsResponse] = await Promise.allSettled([productMasterService.meta(), productMasterService.options()])
    if (metaResponse.status === 'fulfilled') setMeta(metaResponse.value.data)
    if (optionsResponse.status === 'fulfilled') setOptions(optionsResponse.value.data)
  }, [context])

  useEffect(() => {
    queueMicrotask(() => { void loadChoices() })
  }, [loadChoices])

  const openCreate = useCallback((kind: PmKind, extra: { productId?: number | null } = {}) => {
    setDrawer({ open: true, target: { mode: 'create', kind, ...extra } })
  }, [])
  const closeDrawer = useCallback(() => setDrawer((d) => ({ ...d, open: false })), [])

  const onSaved = useCallback((record: PmRecord, message: string) => {
    closeDrawer()
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
  const hasRows = (data?.products.length ?? 0) + (data?.items.length ?? 0) > 0
  const listStatus: ListStatus = error ? 'error' : data === null ? 'loading' : hasRows ? 'ready' : 'empty'

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

  const searching = query.q !== '' || status !== 'active'

  return (
    <>
      <ListPage
        title="Product Master"
        description={data ? `What you sell, in one place. ${listSummary(data.totals)}` : 'What you sell, in one place.'}
        actions={newMenu || undefined}
        toolbar={(
          <>
            <div className="w-full max-w-sm sm:flex-1">
              <ListSearch value={query.q} onSearch={setSearch} placeholder="Search name, ID or key…" label="Search products" />
            </div>
            <div className="w-40">
              <Select value={status} onChange={(value) => setFilter('status', value)} options={STATUS_OPTIONS} aria-label="Show" />
            </div>
          </>
        )}
        notice={notice && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
            <span>{notice.text}</span>
            <span className="flex items-center gap-2">
              {notice.action && <Button size="sm" variant="outline" onClick={notice.action.run}>{notice.action.label}</Button>}
              <Button size="sm" variant="ghost" onClick={() => setNotice(null)} aria-label="Dismiss">Dismiss</Button>
            </span>
          </div>
        )}
        status={listStatus}
        error={error}
        onRetry={() => void load()}
        empty={searching
          ? { title: 'Nothing matches', description: 'Try a different search, or show archived and all products.', action: <Button variant="outline" onClick={() => { setSearch(''); setFilter('status', 'active') }}>Clear search and filter</Button> }
          : { title: 'No products yet', description: choices.length > 0 ? 'Create your first product to start.' : 'Nothing has been added yet.', action: newMenu || undefined }}
      >
        <div className={cn('space-y-6 transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing}>
          {data && data.products.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <caption className="sr-only">Products and their sub-products</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Readiness</TableHead>
                    <TableHead>Sold in CRM</TableHead>
                    <TableHead className="text-right">Signals found</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.products.map((product) => (
                    <ProductRows
                      key={product.id}
                      product={product}
                      expanded={!collapsed.has(product.id)}
                      onToggle={() => toggle(product.id)}
                      href={detailHref}
                      canAdd={Boolean(meta?.can.createSubProduct) && !product.shared && product.status === 'active'}
                      onAdd={() => openCreate('sub_product', { productId: product.id })}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {data && data.items.length > 0 && (
            <section aria-labelledby="pm-items-heading" className="space-y-2">
              <h2 id="pm-items-heading" className="text-sm font-semibold text-foreground">Other catalogue items</h2>
              <p className="text-xs text-muted-foreground">Things you quote but never look for buyers of, such as a training day. They live in the CRM catalogue only.</p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium"><Link href={detailHref(item.id)} className="hover:underline">{item.name}</Link></TableCell>
                        <TableCell>{item.status === 'archived' ? <ArchivedBadge /> : 'Active'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          <p className="text-xs text-muted-foreground">
            Sub-product IDs come from the Portfolio and are shown as they are. “Sold in CRM” means the sub-product also has a catalogue item, so a quote can include it.
            Signals are recorded under a product, not a sub-product, so the count sits on the product.
          </p>
        </div>
      </ListPage>

      <ProductMasterForm
        open={drawer.open}
        target={drawer.target}
        meta={meta}
        products={productChoices(options)}
        onClose={closeDrawer}
        onSaved={onSaved}
      />
    </>
  )
}

function ProductRows({ product, expanded, onToggle, href, canAdd, onAdd }: {
  product: PmProductRow
  expanded: boolean
  onToggle: () => void
  href: (id: number) => string
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
            <Link href={href(product.id)} className="font-semibold text-foreground hover:underline">{product.name}</Link>
            <span className="text-xs text-muted-foreground">product · {product.subProductCount} {product.subProductCount === 1 ? 'sub-product' : 'sub-products'}</span>
            {product.shared && <SharedBadge />}
            {product.status === 'archived' && <ArchivedBadge />}
          </div>
        </TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">{product.key}</TableCell>
        <TableCell><span className="text-muted-foreground">—</span></TableCell>
        <TableCell>{product.soldInCrmCount} of {product.subProductCount}</TableCell>
        <TableCell className="text-right" title={product.signalsFound === null ? 'Signals has no value for this product.' : undefined}>
          {product.signalsFound ?? '—'}
        </TableCell>
      </TableRow>

      {expanded && product.subProducts.map((sub) => (
        <TableRow key={sub.id} className={cn(sub.status === 'archived' && 'opacity-60')}>
          <TableCell className="pl-10">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={href(sub.id)} className="font-medium text-foreground hover:underline">{sub.name}</Link>
              {sub.status === 'archived' && <ArchivedBadge />}
            </div>
          </TableCell>
          <TableCell className="font-mono text-xs">{sub.offerId ?? '—'}</TableCell>
          <TableCell><ReadinessBadge readiness={sub.readiness} /></TableCell>
          <TableCell><SoldBadge sold={sub.soldInCrm} /></TableCell>
          <TableCell className="text-right"><span className="text-muted-foreground">—</span></TableCell>
        </TableRow>
      ))}

      {expanded && product.subProducts.length === 0 && (
        <TableRow>
          <TableCell colSpan={5} className="pl-10 text-sm text-muted-foreground">
            No sub-products yet.
            {canAdd && <Button variant="link" size="sm" className="ml-1 h-auto p-0" onClick={onAdd}>Add one</Button>}
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}
