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

  // The Product's own record (its id, whether it is shared or archived): found among the Products by the key Signals knows it by.
  const wantedKey = product?.key
  const wantedName = product?.label
  useEffect(() => {
    if (!wantedKey) return
    let live = true
    productRecordService.everything()
      .then((res) => {
        if (!live) return
        const found = res.data.products.find((p) => p.key === wantedKey || p.signalKey === wantedKey || p.name === wantedName)
        setMaster(found ? { id: found.id, key: found.key, name: found.name, shared: found.shared, status: found.status } : null)
      })
      .catch(() => { if (live) setMaster(null) })
    return () => { live = false }
  }, [wantedKey, wantedName])

  const masterId = master?.id
  const loadSubs = useCallback(async (page: number) => {
    if (masterId === undefined) return
    setSubsBusy(true)
    setSubsError('')
    try {
      const res = await productRecordService.list({ productId: masterId, page, per: PER_PAGE, status: 'all' })
      setSubs({ rows: res.data, paging: res.meta, can: res.meta.can })
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
    <Link href="/portfolio" className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" /> All products
    </Link>
  )

  if (loading || !products) {
    return <div className="mx-auto max-w-6xl space-y-4 p-4 @xl:p-6"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }
  if (error) {
    return <div className="mx-auto max-w-6xl space-y-3 p-4 @xl:p-6">{back}<p role="alert" className="text-sm text-foreground">{error ?? 'Products unavailable.'}</p></div>
  }
  if (!product) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-4 @xl:p-6">
        {back}
        <EmptyState title="Product not found" description={`There is no product "${productKey || 'specified'}" in this organisation.`} action={<Button asChild size="sm"><Link href="/portfolio">Go to Product Portfolio</Link></Button>} />
      </div>
    )
  }

  const forProduct = encodeURIComponent(product.key)
  const canAdd = Boolean(can?.createSubProduct) && master?.status !== 'archived'
  // Only an administrator edits a Product's own details, and only one this organisation created (a built-in Product is shared and read only).
  const canEditProduct = isAdmin && Boolean(product.custom) && !master?.shared && master?.status !== 'archived'
  const tabs: PageTab[] = TAB_IDS.map((id) => ({ id, label: PRODUCT_TAB_LABELS[id], count: id === 'sub-products' ? (subs?.paging.total ?? product.offers.length) : undefined }))

  return (
    <div className="@container mx-auto max-w-6xl space-y-5 p-4 @xl:p-6">
      {back}
      <PremiumHeader
        title={product.label}
        badge={<span className="flex flex-wrap items-center gap-2"><SubProductIcpBadge product={product} />{master?.shared && <SharedChip />}{master?.status === 'archived' && <ArchivedChip />}</span>}
        description={`${product.offers.length} sub-product${product.offers.length === 1 ? '' : 's'} · ${product.opportunities_count} opportunit${product.opportunities_count === 1 ? 'y' : 'ies'}${product.portfolio_name ? ` · Portfolio group: ${product.portfolio_name}` : ''}`}
        actions={
          <>
            {canAdd && <Button size="sm" onClick={() => setDrawer('create-sub-product')}><Plus className="mr-1.5 size-4" aria-hidden="true" />Add sub-product</Button>}
            <Button asChild size="sm" variant={product.ready ? 'default' : 'outline'}>
              <Link href={`/signals?product=${forProduct}`}><Sparkles className="mr-1.5 size-4" aria-hidden="true" /> {product.ready ? 'Review opportunities' : 'Go to Company Opportunities'}</Link>
            </Button>
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
                <DropdownMenuItem asChild><Link href="/portfolio">Browse the full portfolio</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {notice && <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${NOTICE_TONE[notice.tone]}`}>{notice.text}</div>}

      <PageTabs tabs={tabs} active={tab} onChange={(id) => show(id as ProductTabId)} label="Product sections" idPrefix="product-page" />

      <TabPanel id="overview" active={tab} idPrefix="product-page">
        <div className="space-y-4">
          {product.generation_note && <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">{product.generation_note}</p>}
          <ProductSetupSteps product={product} />
          <ProductProfilePanel product={product} />
          <p className="text-xs text-muted-foreground">
            Each sub-product has its own ICP. <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => show('sub-products')}>Open the sub-products</Button> to see which have one and to set the others up.
          </p>
        </div>
      </TabPanel>
      <TabPanel id="sub-products" active={tab} idPrefix="product-page">
        <SubProductsTab data={subs} error={subsError} loading={subsBusy} canAdd={canAdd} onAdd={() => setDrawer('create-sub-product')} onPage={(p) => void loadSubs(p)} />
      </TabPanel>
      <TabPanel id="signals" active={tab} idPrefix="product-page">
        <ProductSignalsTab data={subs} productKey={product.key} error={subsError} />
      </TabPanel>

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
      <ProductEditDialog
        context={context}
        open={editOpen}
        product={product}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setNotice({ tone: 'success', text: 'Product saved.' }); reload() }}
      />
      {confirmDialog}
    </div>
  )
}
