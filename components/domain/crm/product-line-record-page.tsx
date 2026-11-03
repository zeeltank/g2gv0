'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DetailPage, PageTabs, TabPanel, useConfirm, useUrlTab, type DetailStatus, type PageTab } from '@/components/shared/scaffolds'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { productMasterService } from '@/services/product-master/product-master-service'
import type { PmKind, PmMeta, PmOption, PmRecord, PmUsage } from '@/services/product-master/types'
import { catalogueItemHref, EXTRA_TAB_LABELS, lineRecordHref } from './product-lines-model'
import { ProductMasterForm, type FormTarget, type ProductMasterWriter } from './product-master-form'
import { formatPrice, kindLabel, productChoices } from './product-master-model'
import { ArchivedBadge, ReadinessBadge, SharedBadge, SoldBadge } from './product-master-parts'
import { ProductOfferAbout } from './product-offer-about'
import { ProductSignalsIcpTab } from './product-signals-icp-tab'
import { ProductUsageTab } from './product-usage-tab'

// One list of tab ids per kind, defined once: useUrlTab depends on it, and the first one is the tab a plain link opens. A product line has no catalogue item,
// so no quotes or price books: what Signals found and its ICP are all its Usage would hold.
const TABS_BY_KIND: Record<PmKind, readonly string[]> = {
  product: ['overview', 'signals'],
  sub_product: ['overview', 'signals', 'sell', 'usage'],
  item: ['sell', 'usage'],
}
const TAB_LABELS: Record<string, string> = { overview: 'Overview', sell: 'Sell in CRM', ...EXTRA_TAB_LABELS }
const ID_PREFIX = 'pl-record'

/** The part of the Product Master API this page reads and writes through; the real one by default, a stand-in in a test. */
export type ProductRecordApi = Pick<typeof productMasterService, 'get' | 'usage' | 'meta' | 'options' | 'archive' | 'restore'> & ProductMasterWriter

/** Where the page links to; the route that renders it works these out from the menu. */
export interface ProductRecordHrefs {
  products: string
  services: string
  priceBooks: string
}

interface Notice {
  tone: 'success' | 'error'
  text: string
}

/**
 * One product line, or one sub-product that is not in the CRM catalogue (a sub-product that is sold opens its catalogue page instead, which carries the
 * same Signals & ICP and Usage tabs): Overview, Signals & ICP, Sell in CRM and Usage tabs, with Edit, Archive and Restore. Archiving asks first and says what
 * stays. The route around it adds the app shell and the breadcrumb.
 */
export function ProductLineRecordPage({ id, onBack, onNameKnown, hrefs, service = productMasterService }: {
  id: string
  onBack: () => void
  /** Reports the record's name once it is known, for the breadcrumb. */
  onNameKnown?: (name: string) => void
  hrefs: ProductRecordHrefs
  service?: ProductRecordApi
}) {
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
    if (!isLaravelContextReady(getLaravelContext())) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setStatus('error')
      return
    }
    const mine = ++latestRecord.current
    if (!quiet) setStatus('loading')
    try {
      const response = await service.get(id)
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
  }, [service, id])

  const loadUsage = useCallback(async () => {
    // Without a session nothing is asked (the page itself already says so).
    if (!isLaravelContextReady(getLaravelContext())) return
    const mine = ++latestUsage.current
    setUsageError('')
    try {
      const response = await service.usage(id)
      if (mine !== latestUsage.current) return
      setUsage(response.data)
    } catch (cause) {
      if (mine !== latestUsage.current) return
      setUsageError(cause instanceof Error ? cause.message : 'Unable to load how this is used.')
    }
  }, [service, id])

  useEffect(() => {
    queueMicrotask(() => { void load(); void loadUsage() })
  }, [load, loadUsage])

  const knownName = record?.name
  useEffect(() => {
    if (knownName) onNameKnown?.(knownName)
  }, [knownName, onNameKnown])

  useEffect(() => {
    if (!isLaravelContextReady(getLaravelContext())) return
    queueMicrotask(() => {
      void Promise.allSettled([service.meta(), service.options()]).then(([m, o]) => {
        if (m.status === 'fulfilled') setMeta(m.value.data)
        if (o.status === 'fulfilled') setOptions(o.value.data)
      })
    })
  }, [service])

  const lineHref = (masterId: number) => lineRecordHref(hrefs.products, masterId)
  const can = meta?.can

  const canEdit = Boolean(record && can && !record.shared && (
    record.kind === 'sub_product' ? can.editSubProduct : record.kind === 'item' ? can.editItem[record.crmProduct?.type ?? 'product'] : false
  ))
  const canArchive = Boolean(record && can && !record.shared && (record.kind === 'product' ? can.archiveProduct : can.archive))
  const canRestore = Boolean(record && can && !record.shared && (record.kind === 'product' ? can.restoreProduct : can.restore))
  // (Only the Sell tab of a sub-product that is not in the catalogue asks for this, so it does not need to check that again.)
  const canSell = Boolean(record && can && record.kind === 'sub_product' && can.editSubProduct && (can.sellInCrm.product || can.sellInCrm.service))

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

  /** Archive and restore: the server answers with the changed record, or says why it cannot be done (for example, a product line with active sub-products). */
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
      const response = archive ? await service.archive(record.id) : await service.restore(record.id)
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
    count: tabId === 'usage' && usage && record?.crmProduct ? usage.priceBooks.length : undefined,
  }))

  const subtitle = record
    ? [kindLabel(record.kind), record.parent?.name, record.offer?.offerId ?? (record.kind === 'product' ? record.key : record.crmProduct?.productNo)].filter(Boolean).join(' · ')
    : undefined
  const catalogueLink = record?.crmProduct ? catalogueItemHref(hrefs, record.crmProduct.id, record.crmProduct.type) : null

  return (
    <>
      <DetailPage
        title={record?.name ?? ''}
        subtitle={subtitle}
        badge={record && (<>{record.shared && <SharedBadge />}{record.status === 'archived' && <ArchivedBadge />}</>)}
        backLabel="Back to Products"
        onBack={onBack}
        status={status}
        error={error}
        onRetry={() => void load()}
        notFoundText="This could not be found, or you do not have access to it."
        actions={record && (
          <>
            {catalogueLink && <Button variant="outline" asChild><Link href={catalogueLink}>Open catalogue page</Link></Button>}
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
                ? <LineOverview record={record} href={lineHref} canAdd={Boolean(can?.createSubProduct) && !record.shared && record.status === 'active'} onAdd={openAddSubProduct} />
                : <SubProductOverview record={record} href={lineHref} />}
            </TabPanel>
            <TabPanel id="signals" active={tab} idPrefix={ID_PREFIX}>
              <ProductSignalsIcpTab record={record} usage={usage} usageError={usageError} lineHref={lineHref} />
            </TabPanel>
            <TabPanel id="sell" active={tab} idPrefix={ID_PREFIX}>
              <SellTab record={record} meta={meta} canSell={canSell} onSell={openSell} catalogueLink={catalogueLink} />
            </TabPanel>
            <TabPanel id="usage" active={tab} idPrefix={ID_PREFIX}>
              <ProductUsageTab usage={usage} error={usageError} inCatalogue={record.crmProduct !== null} kind={record.kind} priceBooksHref={hrefs.priceBooks} />
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
        service={service}
        onSaved={(saved, message) => {
          // Adding a sub-product from a product line's page: the page stays on the product line, which now lists it.
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

function LineOverview({ record, href, canAdd, onAdd }: { record: PmRecord; href: (id: number) => string; canAdd: boolean; onAdd: () => void }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Product line">
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
  return (
    <div className="space-y-4">
      <SectionCard title="Identity" description="Saved in the product lines and the Portfolio.">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ReadField label="Name" value={record.name} />
          <ReadField label="Product line" value={record.parent && <Link href={href(record.parent.id)} className="text-primary hover:underline">{record.parent.name}</Link>} />
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

      <ProductOfferAbout offer={offer} lineKey={record.parent?.key} />
    </div>
  )
}

function SellTab({ record, meta, canSell, onSell, catalogueLink }: { record: PmRecord; meta: PmMeta | null; canSell: boolean; onSell: () => void; catalogueLink: string | null }) {
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
    <SectionCard
      title="CRM catalogue item"
      description="Saved in the CRM catalogue."
      actions={catalogueLink ? <Button variant="outline" size="sm" asChild><Link href={catalogueLink}>Open catalogue page</Link></Button> : undefined}
    >
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
