'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, MoreHorizontal, Plus, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { PageTabs, TabPanel, useConfirm, type PageTab } from '@/components/shared/scaffolds'
import type { LaravelContext } from '@/lib/laravel-context'
import { NOTICE_TONE } from '@/lib/org-accounts/tones'
import { PRODUCT_TAB_LABELS, resolveProductTab, type ProductTabId } from '@/lib/portfolio/page-model'
import { normalizeProductKey, configureHref } from '@/lib/product-selection'
import { productRecordService } from '@/services/product-master/record-service'
import type { PmMeta } from '@/services/product-master/types'
import { PremiumHeader } from '@/components/domain/signals/premium-page'
import { useProducts } from '@/components/domain/signals/product-selector'
import { SubProductIcpBadge } from './icp-status-badge'
import { ProductEditDialog } from './product-edit-dialog'
import { ArchivedChip, SharedChip } from './portfolio-chips'
import { ProductFormDrawer } from './product-form-drawer'
import { ProductProfilePanel } from './product-profile-panel'
import { ProductSetupSteps } from './product-setup-steps'
import { ProductSignalsTab, SubProductsTab, type SubProductsData } from './product-sub-products'

const TAB_IDS: readonly ProductTabId[] = ['overview', 'sub-products', 'signals']
const PER_PAGE = 20

interface MasterFacts { id: number; key: string; name: string; shared: boolean; status: 'active' | 'archived' }

/**
 * One Product on its own page: Overview (the four setup steps and the customer and buyer summary), Sub-products (a paged list, each linking to its own
 * page, with Add sub-product) and Signals & ICP. The Product is named by the address, so what is shown is that Product's stored data only. A Product
 * has no ideal customer of its own: each Sub-product has its own. A built-in Product shared by every organisation is read only.
 */
export function ProductDetailView({ context, productKey }: { context: LaravelContext; productKey: string }) {
  const router = useRouter()
  const { products, loading, error, reload } = useProducts(context)
  const { confirm, confirmDialog } = useConfirm()
  const [tab, setTab] = useState<ProductTabId>('overview')
  const [meta, setMeta] = useState<PmMeta | null>(null)
  const [master, setMaster] = useState<MasterFacts | null>(null)
  const [masterChecked, setMasterChecked] = useState(false)
  const [archivedCount, setArchivedCount] = useState(0)
  const [subs, setSubs] = useState<SubProductsData | null>(null)
  const [subsError, setSubsError] = useState('')
  const [subsBusy, setSubsBusy] = useState(false)
  const [drawer, setDrawer] = useState<'create-sub-product' | 'create-product' | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const show = useCallback((next: ProductTabId) => {
    setTab(next)
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', next)
      window.history.replaceState(null, '', url.toString())
    } catch { /* the address just is not updated */ }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(resolveProductTab(new URLSearchParams(window.location.search).get('tab')))
  }, [productKey])

  useEffect(() => {
    let live = true
    productRecordService.meta().then((res) => { if (live) setMeta(res.data) }).catch(() => { /* the buttons stay hidden */ })
    return () => { live = false }
  }, [context])

  const canonicalKey = normalizeProductKey(productKey, products ?? undefined)
  const product = products?.find((p) => p.key === canonicalKey) ?? null

  useEffect(() => {
    if (product && canonicalKey && canonicalKey !== productKey && typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href)
        url.pathname = configureHref(canonicalKey)
        window.history.replaceState(null, '', url.toString())
      } catch {}
    }
  }, [product, canonicalKey, productKey])

  // The Product's own record (its id, whether it is shared or archived): found among the Products by the key Signals knows it by, or by the address's own key for a
  // Product that Signals does not define (the built-in Commercial Bundle and Higher Education are Products of the Portfolio only: they open a page of their own,
  // with their Sub-products, instead of "Product not found").
  const wantedKey = product?.key ?? (canonicalKey || productKey)
  const wantedName = product?.label
  const productsLoaded = products !== null
  useEffect(() => {
    if (!wantedKey || !productsLoaded) return
    let live = true
    productRecordService.everything()
      .then((res) => {
        if (!live) return
        const found = res.data.products.find((p) => p.key === wantedKey || p.signalKey === wantedKey || (wantedName !== undefined && p.name === wantedName))
        setMaster(found ? { id: found.id, key: found.key, name: found.name, shared: found.shared, status: found.status } : null)
        setMasterChecked(true)
      })
      .catch(() => { if (live) { setMaster(null); setMasterChecked(true) } })
    return () => { live = false }
  }, [wantedKey, wantedName, productsLoaded])

  const masterId = master?.id
  const loadSubs = useCallback(async (page: number) => {
    if (masterId === undefined) return
    setSubsBusy(true)
    setSubsError('')
    try {
      const [res, archived] = await Promise.all([
        productRecordService.list({ productId: masterId, page, per: PER_PAGE, status: 'all' }),
        // The list shows archived Sub-products too (so one can be restored from here), but the count in the header and on the tab is the ACTIVE ones, like the Portfolio list's.
        productRecordService.list({ productId: masterId, page: 1, per: 1, status: 'archived' }).catch(() => null),
      ])
      setSubs({ rows: res.data, paging: res.meta, can: res.meta.can })
      setArchivedCount(archived ? archived.meta.total : 0)
    } catch (cause) {
      setSubsError(cause instanceof Error ? cause.message : 'The sub-products could not be loaded.')
    } finally {
      setSubsBusy(false)
    }
  }, [masterId])
  useEffect(() => { queueMicrotask(() => { void loadSubs(1) }) }, [loadSubs])

  const can = meta?.can
  const isAdmin = Boolean(can?.createProduct)

  const changeStatus = async (archive: boolean) => {
    if (!master || busy) return
    if (archive && !(await confirm({
      title: `Archive ${master.name}?`,
      description: 'It leaves the pickers and the default list. Its sub-products must be archived first. Nothing is deleted, and you can restore it later.',
      confirmLabel: 'Archive',
    }))) return
    setBusy(true)
    try {
      const res = archive ? await productRecordService.archive(master.id) : await productRecordService.restore(master.id)
      setMaster({ ...master, status: res.data.status })
      setNotice({ tone: 'success', text: archive ? 'Archived.' : 'Restored.' })
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'This could not be done.' })
    } finally { setBusy(false) }
  }

  const back = (
    <Link href="/signals/portfolio" className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" /> All products
    </Link>
  )

  if (loading || !products) {
    return <div className="w-full space-y-4 p-4 @xl:p-6"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }
  if (error) {
    return <div className="w-full space-y-3 p-4 @xl:p-6">{back}<p role="alert" className="text-sm text-foreground">{error ?? 'Products unavailable.'}</p></div>
  }
  // Still looking for the Product's own record of the Portfolio: a Product that Signals does not define has only that.
  if (!product && !masterChecked) {
    return <div className="w-full space-y-4 p-4 @xl:p-6"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }
  if (!product && !master) {
    return (
      <div className="w-full space-y-3 p-4 @xl:p-6">
        {back}
        <EmptyState title="Product not found" description={`There is no product "${productKey || 'specified'}" in this organisation.`} action={<Button asChild size="sm"><Link href="/signals/portfolio">Go to Product Portfolio</Link></Button>} />
      </div>
    )
  }

  const title = product?.label ?? master?.name ?? productKey
  const forProduct = encodeURIComponent(product?.key ?? master?.key ?? productKey)
  const canAdd = Boolean(can?.createSubProduct) && master?.status !== 'archived'
  // Only an administrator edits a Product's own details, and only one this organisation created (a built-in Product is shared and read only).
  const canEditProduct = product !== null && isAdmin && Boolean(product.custom) && !master?.shared && master?.status !== 'archived'
  // One number for the header and the tab: the ACTIVE Sub-products, like the Portfolio list's (the Sub-products tab also lists the archived ones, so they can be restored).
  const activeCount = subs ? Math.max(0, subs.paging.total - archivedCount) : (product?.offers.length ?? 0)
  // A Product that exists only in the Portfolio has no setup steps, no customer summary and no signals of its own: its page is its Sub-products.
  const tabIds: readonly ProductTabId[] = product ? TAB_IDS : ['sub-products']
  const activeTab: ProductTabId = product ? tab : 'sub-products'
  const tabs: PageTab[] = tabIds.map((id) => ({ id, label: PRODUCT_TAB_LABELS[id], count: id === 'sub-products' ? activeCount : undefined }))
  const description = [
    `${activeCount} sub-product${activeCount === 1 ? '' : 's'}`,
    archivedCount > 0 ? `${archivedCount} archived` : null,
    product ? `${product.opportunities_count} opportunit${product.opportunities_count === 1 ? 'y' : 'ies'}` : null,
    product?.portfolio_name ? `Portfolio group: ${product.portfolio_name}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="@container w-full space-y-5 p-4 @xl:p-6">
      {back}
      <PremiumHeader
        title={title}
        badge={<span className="flex flex-wrap items-center gap-2">{product && <SubProductIcpBadge product={product} />}{master?.shared && <SharedChip />}{master?.status === 'archived' && <ArchivedChip />}</span>}
        description={description}
        actions={
          <>
            {canAdd && <Button size="sm" onClick={() => setDrawer('create-sub-product')}><Plus className="mr-1.5 size-4" aria-hidden="true" />Add sub-product</Button>}
            {product && (
              <Button asChild size="sm" variant={product.ready ? 'default' : 'outline'}>
                <Link href={`/signals?product=${forProduct}`}><Sparkles className="mr-1.5 size-4" aria-hidden="true" /> {product.ready ? 'Review opportunities' : 'Go to Company Opportunities'}</Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" aria-label="More actions"><MoreHorizontal className="size-4" aria-hidden="true" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => { reload(); void loadSubs(1) }}><RefreshCw className="mr-2 size-4" aria-hidden="true" /> Refresh</DropdownMenuItem>
                {isAdmin && <DropdownMenuItem onSelect={() => setDrawer('create-product')}>Add product</DropdownMenuItem>}
                {canEditProduct && <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit this product</DropdownMenuItem>}
                {isAdmin && master && !master.shared && master.status === 'active' && <DropdownMenuItem onSelect={() => void changeStatus(true)}>Archive this product</DropdownMenuItem>}
                {isAdmin && master && !master.shared && master.status === 'archived' && <DropdownMenuItem onSelect={() => void changeStatus(false)}>Restore this product</DropdownMenuItem>}
                <DropdownMenuItem asChild><Link href="/signals/portfolio">Browse the full portfolio</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {notice && <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${NOTICE_TONE[notice.tone]}`}>{notice.text}</div>}

      <PageTabs tabs={tabs} active={activeTab} onChange={(id) => show(id as ProductTabId)} label="Product sections" idPrefix="product-page" />

      {product && (
        <TabPanel id="overview" active={activeTab} idPrefix="product-page">
          <div className="space-y-4">
            {product.generation_note && <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">{product.generation_note}</p>}
            <ProductSetupSteps product={product} />
            <ProductProfilePanel product={product} />
            <p className="text-xs text-muted-foreground">
              Each sub-product has its own ICP. <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => show('sub-products')}>Open the sub-products</Button> to see which have one and to set the others up.
            </p>
          </div>
        </TabPanel>
      )}
      <TabPanel id="sub-products" active={activeTab} idPrefix="product-page">
        <SubProductsTab data={subs} error={subsError} loading={subsBusy} canAdd={canAdd} onAdd={() => setDrawer('create-sub-product')} onPage={(p) => void loadSubs(p)} />
      </TabPanel>
      {product && (
        <TabPanel id="signals" active={activeTab} idPrefix="product-page">
          <ProductSignalsTab data={subs} productKey={product.key} error={subsError} />
        </TabPanel>
      )}

      <ProductFormDrawer
        open={drawer !== null}
        onOpenChange={(open) => { if (!open) setDrawer(null) }}
        mode={drawer ?? 'create-sub-product'}
        defaultProductId={master?.id}
        onSaved={async (saved) => {
          if (drawer === 'create-product') {
            // The new Product's own page: its key is read back from the record the save made.
            try {
              const created = await productRecordService.get(saved.id)
              router.push(configureHref(created.data.key))
            } catch { reload() }
            return
          }
          setNotice({ tone: 'success', text: 'Sub-product saved.' })
          reload()
          void loadSubs(1)
        }}
      />
      {product && (
        <ProductEditDialog
          context={context}
          open={editOpen}
          product={product}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setNotice({ tone: 'success', text: 'Product saved.' }); reload() }}
        />
      )}
      {confirmDialog}
    </div>
  )
}
