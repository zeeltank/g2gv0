'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DetailPage, PageTabs, TabPanel, useConfirm, useUrlTab, type DetailStatus, type PageTab } from '@/components/shared/scaffolds'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { CRM_PRICE_BOOKS_ACCESS_LINK, CRM_PRODUCT_MASTER_ACCESS_LINK } from '@/lib/gtg-navigation'
import { ApiError } from '@/services/core'
import { productMasterService } from '@/services/product-master/product-master-service'
import type { PmKind, PmMeta, PmOption, PmRecord, PmUsage } from '@/services/product-master/types'
import { ProductMasterForm, type FormTarget } from './product-master-form'
import { formatPrice, kindLabel, productChoices } from './product-master-model'
import { ArchivedBadge, ReadinessBadge, SharedBadge, SoldBadge } from './product-master-parts'

// One list of tab ids per kind, defined once: useUrlTab depends on it, and the first one is the tab a plain link opens.
const TABS_BY_KIND: Record<PmKind, readonly string[]> = {
  product: ['overview', 'usage'],
  sub_product: ['overview', 'sell', 'prices', 'usage'],
  item: ['sell', 'prices', 'usage'],
}
const TAB_LABELS: Record<string, string> = { overview: 'Overview', sell: 'Sell in CRM', prices: 'Prices', usage: 'Usage' }
const ID_PREFIX = 'pm-detail'

interface Notice {
  tone: 'success' | 'error'
  text: string
}

function Chips({ items, empty = '—' }: { items: readonly string[]; empty?: string }) {
  if (items.length === 0) return <span className="text-muted-foreground">{empty}</span>
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => <li key={item} className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground">{item}</li>)}
    </ul>
  )
}

/**
 * One product, sub-product or catalogue item: Overview, Sell in CRM, Prices and Usage tabs (a catalogue item has no Overview), with Edit (the same drawer as
 * the list's "New…"), Archive and Restore. Archiving asks first and says what stays. The route around it adds the app shell and the breadcrumb.
 */
export function ProductMasterDetailPage({ id, onBack, onNameKnown }: {
  id: string
  onBack: () => void
  /** Reports the record's name once it is known, for the breadcrumb. */
  onNameKnown?: (name: string) => void
}) {
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const { confirm, confirmDialog } = useConfirm()

  const [record, setRecord] = useState<PmRecord | null>(null)
  const [status, setStatus] = useState<DetailStatus>('loading')
  const [error, setError] = useState('')
  const [usage, setUsage] = useState<PmUsage | null>(null)
  const [usageError, setUsageError] = useState('')
  const [meta, setMeta] = useState<PmMeta | null>(null)
  const [options, setOptions] = useState<PmOption[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [drawer, setDrawer] = useState<{ open: boolean; target: FormTarget | null }>({ open: false, target: null })

  const tabIds = TABS_BY_KIND[record?.kind ?? 'sub_product']
  const [tab, setTab] = useUrlTab(tabIds)

  // Only the newest request for the record, and the newest for its usage, may change what is shown: opening another record while the first is still
  // loading must not let the first one's answer replace it.
  const latestRecord = useRef(0)
  const latestUsage = useRef(0)

  /** `quiet` re-reads the record behind the page without replacing it with the "Opening…" state. */
  const load = useCallback(async (quiet = false) => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setStatus('error')
      return
    }
    const mine = ++latestRecord.current
    if (!quiet) setStatus('loading')
    try {
      const response = await productMasterService.get(id)
      if (mine !== latestRecord.current) return
      setRecord(response.data)
      setStatus('ready')
    } catch (cause) {
      if (mine !== latestRecord.current) return
      if (cause instanceof ApiError && cause.status === 404) {
        setStatus('notFound')
      } else {
        setError(cause instanceof Error ? cause.message : 'Unable to open this record.')
        setStatus('error')
      }
    }
  }, [context, id])

  const loadUsage = useCallback(async () => {
    const mine = ++latestUsage.current
    setUsageError('')
    try {
      const response = await productMasterService.usage(id)
      if (mine !== latestUsage.current) return
      setUsage(response.data)
    } catch (cause) {
      if (mine !== latestUsage.current) return
      setUsageError(cause instanceof Error ? cause.message : 'Unable to load how this is used.')
    }
  }, [id])

  useEffect(() => {
    queueMicrotask(() => { void load(); void loadUsage() })
  }, [load, loadUsage])

  const knownName = record?.name
  useEffect(() => {
    if (knownName) onNameKnown?.(knownName)
  }, [knownName, onNameKnown])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    queueMicrotask(() => {
      void Promise.allSettled([productMasterService.meta(), productMasterService.options()]).then(([m, o]) => {
        if (m.status === 'fulfilled') setMeta(m.value.data)
        if (o.status === 'fulfilled') setOptions(o.value.data)
      })
    })
  }, [context])

  const listHref = resolveAccessLink(CRM_PRODUCT_MASTER_ACCESS_LINK)
  const detailHref = (otherId: number) => `${listHref}/${otherId}`
  const can = meta?.can

  const canEdit = Boolean(record && can && !record.shared && (
    record.kind === 'sub_product' ? can.editSubProduct : record.kind === 'item' ? can.editItem[record.crmProduct?.type ?? 'product'] : false
  ))
  const canArchive = Boolean(record && can && !record.shared && (record.kind === 'product' ? can.archiveProduct : can.archive))
  const canRestore = Boolean(record && can && !record.shared && (record.kind === 'product' ? can.restoreProduct : can.restore))
  const canSell = Boolean(record && can && record.kind === 'sub_product' && !record.crmProduct && can.editSubProduct && (can.sellInCrm.product || can.sellInCrm.service))

  const openEdit = () => { if (record) setDrawer({ open: true, target: { mode: 'edit', record } }) }
  const openSell = () => { if (record) setDrawer({ open: true, target: { mode: 'edit', record, enableSell: true } }) }
  const openAddSubProduct = () => { if (record) setDrawer({ open: true, target: { mode: 'create', kind: 'sub_product', productId: record.id } }) }
  const closeDrawer = () => setDrawer((d) => ({ ...d, open: false }))

  const onSaved = (saved: PmRecord, message: string) => {
    closeDrawer()
    setRecord(saved)
    setNotice({ tone: 'success', text: message })
    void loadUsage()
  }

  /** Archive and restore: the server answers with the changed record, or says why it cannot be done (for example, a product with active sub-products). */
  const changeStatus = async (archive: boolean) => {
    if (!record || busy) return
    if (archive) {
      const agreed = await confirm({
        title: `Archive ${record.name}?`,
        description: record.kind === 'product'
          ? 'It leaves the pickers and the default list. Its sub-products must be archived first. Nothing is deleted, and you can restore it later.'
          : 'It leaves the pickers and the default list. The Portfolio offer and the CRM catalogue item are not deleted, and you can restore it later.',
        confirmLabel: 'Archive',
      })
      if (!agreed) return
    }
    setBusy(true)
    try {
      const response = archive ? await productMasterService.archive(record.id) : await productMasterService.restore(record.id)
      setRecord(response.data)
      setNotice({ tone: 'success', text: archive ? 'Archived.' : 'Restored.' })
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'This could not be done.' })
    } finally {
      setBusy(false)
    }
  }

  const tabs: PageTab[] = tabIds.map((tabId) => ({
    id: tabId,
    label: TAB_LABELS[tabId],
    count: tabId === 'prices' && usage ? usage.priceBooks.length : undefined,
  }))

  const subtitle = record
    ? [kindLabel(record.kind), record.parent?.name, record.offer?.offerId ?? (record.kind === 'product' ? record.key : record.crmProduct?.productNo)].filter(Boolean).join(' · ')
    : undefined

  return (
    <>
      <DetailPage
        title={record?.name ?? ''}
        subtitle={subtitle}
        badge={record && (<>{record.shared && <SharedBadge />}{record.status === 'archived' && <ArchivedBadge />}</>)}
        backLabel="Back to Product Master"
        onBack={onBack}
        status={status}
        error={error}
        onRetry={() => void load()}
        notFoundText="This product could not be found, or you do not have access to it."
        actions={record && (
          <>
            {canEdit && <Button onClick={openEdit} disabled={busy}><Pencil className="mr-1.5 size-4" aria-hidden="true" />Edit</Button>}
            {canArchive && record.status === 'active' && <Button variant="outline" onClick={() => void changeStatus(true)} disabled={busy}>Archive</Button>}
            {canRestore && record.status === 'archived' && <Button variant="outline" onClick={() => void changeStatus(false)} disabled={busy}>Restore</Button>}
          </>
        )}
        notice={notice && (
          <div
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={notice.tone === 'error'
              ? 'rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive'
              : 'rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success'}
          >
            {notice.text}
          </div>
        )}
        tabs={record && <PageTabs tabs={tabs} active={tab} onChange={setTab} label="Sections of this record" idPrefix={ID_PREFIX} />}
      >
        {record && (
          <>
            <TabPanel id="overview" active={tab} idPrefix={ID_PREFIX}>
              {record.kind === 'product'
                ? <ProductOverview record={record} href={detailHref} canAdd={Boolean(can?.createSubProduct) && !record.shared && record.status === 'active'} onAdd={openAddSubProduct} />
                : <SubProductOverview record={record} href={detailHref} />}
            </TabPanel>
            <TabPanel id="sell" active={tab} idPrefix={ID_PREFIX}>
              <SellTab record={record} meta={meta} canSell={canSell} onSell={openSell} />
            </TabPanel>
            <TabPanel id="prices" active={tab} idPrefix={ID_PREFIX}>
              <PricesTab record={record} usage={usage} error={usageError} priceBooksHref={resolveAccessLink(CRM_PRICE_BOOKS_ACCESS_LINK)} />
            </TabPanel>
            <TabPanel id="usage" active={tab} idPrefix={ID_PREFIX}>
              <UsageTab record={record} usage={usage} error={usageError} />
            </TabPanel>
          </>
        )}
      </DetailPage>

      <ProductMasterForm
        open={drawer.open}
        target={drawer.target}
        meta={meta}
        products={productChoices(options)}
        onClose={closeDrawer}
        onSaved={(saved, message) => {
          // Adding a sub-product from a product's page: the page stays on the product, which now lists it.
          if (saved.kind === 'sub_product' && record?.kind === 'product') {
            closeDrawer()
            setNotice({ tone: 'success', text: message })
            void load(true)
            return
          }
          onSaved(saved, message)
        }}
      />
      {confirmDialog}
    </>
  )
}

function ProductOverview({ record, href, canAdd, onAdd }: { record: PmRecord; href: (id: number) => string; canAdd: boolean; onAdd: () => void }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Product">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ReadField label="Name" value={record.name} />
          <ReadField label="Key" value={<span className="font-mono text-xs">{record.key}</span>} />
          <ReadField label="Signal key" value={record.signalKey && <span className="font-mono text-xs">{record.signalKey}</span>} />
          <ReadField label="Portfolio group" value={record.portfolioName} />
          <ReadField label="Origin" value={record.shared ? 'Built in, shared by every organisation' : 'Created by you'} />
          <ReadField label="Status" value={record.status === 'active' ? 'Active' : 'Archived'} />
        </dl>
      </SectionCard>

      <SectionCard
        title="Sub-products"
        actions={canAdd ? <Button size="sm" onClick={onAdd}><Plus className="mr-1.5 size-4" aria-hidden="true" />Add sub-product</Button> : undefined}
      >
        {record.subProducts.length === 0
          ? <p className="text-sm text-muted-foreground">No sub-products yet.</p>
          : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Key</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {record.subProducts.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium"><Link href={href(sub.id)} className="hover:underline">{sub.name}</Link></TableCell>
                      <TableCell className="font-mono text-xs">{sub.key}</TableCell>
                      <TableCell>{sub.status === 'archived' ? <ArchivedBadge /> : 'Active'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
      </SectionCard>
    </div>
  )
}

function SubProductOverview({ record, href }: { record: PmRecord; href: (id: number) => string }) {
  const offer = record.offer
  const about = offer?.about
  return (
    <div className="space-y-4">
      <SectionCard title="Identity" description="Saved in the Product Master and the Portfolio.">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ReadField label="Name" value={record.name} />
          <ReadField label="Product" value={record.parent && <Link href={href(record.parent.id)} className="text-primary hover:underline">{record.parent.name}</Link>} />
          <ReadField label="Sub-product ID" value={offer && <span className="font-mono text-xs">{offer.offerId}</span>} />
          <ReadField
            label="Readiness"
            value={offer && (
              <span className="flex flex-wrap items-center gap-2">
                <ReadinessBadge readiness={offer.readiness} />
                <span className="text-xs font-normal text-muted-foreground">{offer.readinessConfirmed ? 'Confirmed by a person' : 'Not confirmed yet'}</span>
              </span>
            )}
          />
          <ReadField label="Status" value={record.status === 'active' ? 'Active' : 'Archived'} />
          <ReadField label="In the CRM catalogue" value={<SoldBadge sold={record.crmProduct !== null} />} />
        </dl>
      </SectionCard>

      <SectionCard title="About" description="Kept in the Portfolio. Who it is for and its buying events are edited there.">
        {about ? (
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><ReadField label="What it does" value={about.whatItDoes && <span className="whitespace-pre-line font-normal">{about.whatItDoes}</span>} /></div>
            <div className="sm:col-span-2">
              <ReadField label="Customer problems it solves" value={about.needsSolved.length > 0
                ? <ul className="list-disc space-y-0.5 pl-5 font-normal">{about.needsSolved.map((problem) => <li key={problem}>{problem}</li>)}</ul>
                : null}
              />
            </div>
            <ReadField label="Who it is for" value={<Chips items={about.primarySegments} />} />
            <ReadField label="Buying events that point to it" value={<Chips items={about.triggerSignals} />} />
            <ReadField label="Features and capabilities" value={about.modulesComponents && <span className="whitespace-pre-line font-normal">{about.modulesComponents}</span>} />
            <ReadField label="Deployment" value={about.deploymentModel} />
            <ReadField label="Benefits and proof" value={about.proofPoints && <span className="whitespace-pre-line font-normal">{about.proofPoints}</span>} />
            <ReadField label="Notes" value={about.notes && <span className="whitespace-pre-line font-normal">{about.notes}</span>} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">There is no Portfolio offer of your own behind this record to show.</p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          The ideal-customer profile is kept where it is today: <Link href="/portfolio" className="text-primary underline underline-offset-2">open the Portfolio</Link>.
        </p>
      </SectionCard>
    </div>
  )
}

function SellTab({ record, meta, canSell, onSell }: { record: PmRecord; meta: PmMeta | null; canSell: boolean; onSell: () => void }) {
  const crm = record.crmProduct
  if (!crm) {
    return (
      <EmptyState
        title="Not sold in the CRM yet"
        description="Switching it on creates a catalogue item and links it, so a quote can include it. Prices are set in price books."
        action={canSell ? <Button onClick={onSell}>Sell in CRM</Button> : undefined}
      />
    )
  }
  const taxRate = crm.taxRateId !== null ? meta?.taxRates.find((t) => t.id === crm.taxRateId) : undefined
  return (
    <SectionCard title="CRM catalogue item" description="Saved in the CRM catalogue.">
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <ReadField label="Item number" value={crm.productNo && <span className="font-mono text-xs">{crm.productNo}</span>} />
        <ReadField label="Type" value={crm.type === 'service' ? 'Service' : 'Product'} />
        <ReadField label="SKU" value={crm.sku} />
        <ReadField label="GL account" value={crm.glAccount} />
        <ReadField label="Base price" value={crm.unitPrice !== null ? formatPrice(crm.unitPrice, crm.currency) : null} />
        <ReadField label="Tax rate" value={crm.taxRateId === null ? 'Default' : (taxRate ? `${taxRate.name} (${taxRate.percentage}%)` : `Rate ${crm.taxRateId}`)} />
        <ReadField label="Active in the catalogue" value={crm.active ? 'Yes' : 'No'} />
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">The base price is used only when a price book has no price for this item.</p>
    </SectionCard>
  )
}

function PricesTab({ record, usage, error, priceBooksHref }: { record: PmRecord; usage: PmUsage | null; error: string; priceBooksHref: string }) {
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!usage) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  if (!record.crmProduct) {
    return (
      <EmptyState
        title="Not in the CRM catalogue"
        description="Only an item in the catalogue can be in a price book. Sell it in the CRM first."
      />
    )
  }
  if (usage.priceBooks.length === 0) {
    return (
      <EmptyState
        title="Not in any price book yet"
        description={`Add it to a price book to give it a quotable price. Until then a quote line uses the base price${usage.basePrice === null ? ', which is empty' : `, ${formatPrice(usage.basePrice, usage.currency)}`}.`}
        action={<Button variant="outline" asChild><Link href={priceBooksHref}>Open Price Books</Link></Button>}
      />
    )
  }
  return (
    <SectionCard
      title="Price books"
      description="A quote is priced from the price book it uses. Prices are edited in Price Books, not here."
      actions={<Button variant="outline" size="sm" asChild><Link href={priceBooksHref}>Open Price Books</Link></Button>}
    >
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Price book</TableHead><TableHead>Number</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {usage.priceBooks.map((book) => (
              <TableRow key={book.priceBookId}>
                <TableCell className="font-medium">{book.name}</TableCell>
                <TableCell className="font-mono text-xs">{book.priceBookNo ?? '—'}</TableCell>
                <TableCell>{book.active ? 'Active' : 'Inactive'}</TableCell>
                <TableCell className="text-right">{formatPrice(book.listPrice, book.currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  )
}

function UsageTab({ record, usage, error }: { record: PmRecord; usage: PmUsage | null; error: string }) {
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!usage) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  return (
    <SectionCard title="Where it is used">
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Counts go in as text: ReadField shows a dash for any falsy value, and a count of 0 is a real answer. */}
        <ReadField
          label="Signals found"
          value={usage.signals === null
            ? <span className="font-normal text-muted-foreground">{record.kind === 'item' ? 'Not counted: a catalogue item is not looked for in signals.' : 'Not counted: Signals has no value for this.'}</span>
            : String(usage.signals)}
        />
        <ReadField label="Quotes that include it" value={record.crmProduct ? String(usage.quotes) : <span className="font-normal text-muted-foreground">Not in the CRM catalogue</span>} />
        <ReadField label="Price books" value={record.crmProduct ? String(usage.priceBooks.length) : <span className="font-normal text-muted-foreground">Not in the CRM catalogue</span>} />
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        {record.kind === 'sub_product'
          ? 'Signals are counted where the best-matching offer is this sub-product. They are recorded under a product, so the full count is on the product.'
          : 'Signals are recorded under a product.'}
      </p>
    </SectionCard>
  )
}
