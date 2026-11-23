'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Package, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DetailPage, PageTabs, TabPanel, tabButtonId, tabPanelId, useConfirm, useUrlTab, type DetailStatus, type PageTab } from '@/components/shared/scaffolds'
import { SectionCard } from '@/components/shared/business/shared'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { useAssignableEmployees } from '@/components/domain/crm/lead-employees'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { NOTICE_TONE } from '@/lib/org-accounts/tones'
import { icpStatesFromOffer, type IcpStates } from '@/lib/portfolio/icp-state'
import { SUB_TAB_LABELS, sellWord, subProductTabs, type SubTabId } from '@/lib/portfolio/page-model'
import { ApiError } from '@/services/core'
import { crmService } from '@/services/crm'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type { TaxonomyData } from '@/services/portfolio/types'
import { productRecordService } from '@/services/product-master/record-service'
import type { PmFullRecord, PmHistoryRow, PmListCan, PmListRow, PmPaging, PmUsageFull } from '@/services/product-master/record-types'
import type { PmMeta } from '@/services/product-master/types'
import { ArchivedChip, ReadinessChip, SellChip, SharedChip, SignalsChip } from './portfolio-chips'
import { ProductFormDrawer } from './product-form-drawer'
import { BundleTab } from './sub-product-bundle'
import { OverviewTab } from './sub-product-overview'
import { DetailsTab, HistoryTab, SignalsIcpTab, UsageTab } from './sub-product-tabs'

const ID_PREFIX = 'sp-record'

/** Where the page links to; the route that renders it works these out from the menu. */
export interface SubProductHrefs {
  /** The Product Portfolio's own address. */
  portfolio: string
  quotes: string
  salesOrders: string
  invoices: string
  priceBooks: string
}

export const DEFAULT_HREFS: SubProductHrefs = {
  portfolio: '/portfolio', quotes: '/module/crm/sales/quotes', salesOrders: '/module/crm/sales/sales-orders', invoices: '/module/crm/sales/invoices', priceBooks: '/module/crm/sales/price-books',
}

interface Notice { tone: 'success' | 'error'; text: string }
interface Facts { row: PmListRow | null; can: PmListCan | null }

/**
 * ONE Sub-product, in one place: the Overview (the About and the readiness), Details (every Sell field), Bundle, Usage, History and Signals & ICP, plus
 * Custom Fields when the record has a catalogue row and the organisation has definitions. A tab the caller may not see is not drawn at all (HR sees the
 * Overview and Signals & ICP: no price, cost, commission, stock, bundle, usage or history). The record is read once; each tab reads its own data when it
 * is opened. A Product (level 1) opens its own page instead.
 */
export function SubProductPage({ id, onBack, onNameKnown, hrefs = DEFAULT_HREFS }: {
  id: string
  onBack: () => void
  /** Reports the record's name once it is known, for the breadcrumb. */
  onNameKnown?: (name: string) => void
  hrefs?: SubProductHrefs
}) {
  const router = useRouter()
  const context = useMemo(() => getLaravelContext(), [])
  const { confirm, confirmDialog } = useConfirm()

  const [record, setRecord] = useState<PmFullRecord | null>(null)
  const [status, setStatus] = useState<DetailStatus>('loading')
  const [error, setError] = useState('')
  const [meta, setMeta] = useState<PmMeta | null>(null)
  const [facts, setFacts] = useState<Facts>({ row: null, can: null })
  const [taxonomy, setTaxonomy] = useState<TaxonomyData | null>(null)
  const [soldTogether, setSoldTogether] = useState<Record<string, string>>({})
  const [usage, setUsage] = useState<PmUsageFull | null>(null)
  const [usageError, setUsageError] = useState('')
  const [history, setHistory] = useState<{ rows: PmHistoryRow[]; paging: PmPaging } | null>(null)
  const [historyError, setHistoryError] = useState('')
  const [historyBusy, setHistoryBusy] = useState(false)
  const [icp, setIcp] = useState<IcpStates | null>(null)
  const [icpError, setIcpError] = useState('')
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [customNotice, setCustomNotice] = useState('')
  const [savingCustom, setSavingCustom] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [drawer, setDrawer] = useState(false)

  const employees = useAssignableEmployees(context, record?.sell != null)

  const viewSell = record?.sell != null || facts.can?.viewSell === true
  const tabIds = useMemo<SubTabId[]>(() => subProductTabs({ sell: record?.sell ?? null, viewSell, hasCustomFields }), [record?.sell, viewSell, hasCustomFields])
  const [tab, setTab] = useUrlTab(tabIds)

  // Only the newest request for the record may change what is shown: opening another record while the first loads must not let the first one's answer replace it.
  const latest = useRef(0)
  const load = useCallback(async (quiet = false) => {
    if (!isLaravelContextReady(getLaravelContext())) { setError('Your ERP session is unavailable. Please sign in again.'); setStatus('error'); return }
    const mine = ++latest.current
    if (!quiet) setStatus('loading')
    try {
      const response = await productRecordService.get(id)
      if (mine !== latest.current) return
      setRecord(response.data)
      setStatus('ready')
    } catch (cause) {
      if (mine !== latest.current) return
      if (cause instanceof ApiError && cause.status === 404) setStatus('notFound')
      else { setError(cause instanceof Error ? cause.message : 'Unable to open this sub-product.'); setStatus('error') }
    }
  }, [id])

  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  // What the page needs beside the record: the caller's rights, the lists' words, and the header facts (state, signals) a caller without Sell rights can still read.
  const recordId = record?.id
  const lookup = record ? (record.offer?.offerId ?? record.name) : null
  useEffect(() => {
    if (!isLaravelContextReady(getLaravelContext())) return
    let live = true
    queueMicrotask(() => {
      productRecordService.meta().then((r) => { if (live) setMeta(r.data) }).catch(() => { /* the page still reads; its buttons stay hidden */ })
      portfolioService.getTaxonomy(context).then((r) => { if (live) setTaxonomy(r.data) }).catch(() => { /* names fall back to the stored codes */ })
    })
    return () => { live = false }
  }, [context])

  const loadFacts = useCallback(async () => {
    if (recordId === undefined || lookup === null) return
    try {
      const response = await productRecordService.list({ q: lookup, status: 'all', per: 20 })
      setFacts({ row: response.data.find((r) => r.id === recordId) ?? null, can: response.meta.can })
    } catch { /* the header then shows what the record itself says */ }
  }, [recordId, lookup])
  useEffect(() => { queueMicrotask(() => { void loadFacts() }) }, [loadFacts])

  const wanted = record?.offer?.about.oftenSoldTogether ?? []
  useEffect(() => {
    if (wanted.length === 0) return
    let live = true
    queueMicrotask(() => {
      productRecordService.everything().then((r) => {
        if (!live) return
        const names: Record<string, string> = {}
        for (const p of r.data.products) for (const s of p.subProducts) if (s.offerId) names[s.offerId] = s.name
        setSoldTogether(names)
      }).catch(() => { /* the IDs are shown as they are */ })
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted.join('|')])

  const knownName = record?.name
  useEffect(() => { if (knownName) onNameKnown?.(knownName) }, [knownName, onNameKnown])

  // A level-1 Product has its own page.
  useEffect(() => { if (record?.kind === 'product') router.replace(`${hrefs.portfolio}/${encodeURIComponent(record.key)}`) }, [record?.kind, record?.key, router, hrefs.portfolio])

  // Each tab reads its data when it is opened, and again after a save.
  const [stale, setStale] = useState(0)
  useEffect(() => {
    if (!record || tab !== 'usage' || record.sell === null) return
    let live = true
    queueMicrotask(() => {
      setUsageError('')
      productRecordService.usage(record.id).then((r) => { if (live) setUsage(r.data) }).catch((cause) => { if (live) setUsageError(cause instanceof Error ? cause.message : 'Unable to load how this is used.') })
    })
    return () => { live = false }
  }, [tab, record, stale])

  const loadHistory = useCallback(async (page: number) => {
    if (recordId === undefined) return
    setHistoryBusy(true)
    setHistoryError('')
    try {
      const r = await productRecordService.history(recordId, { page, per: 20 })
      setHistory({ rows: r.data, paging: r.meta })
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : 'Unable to load the history.')
    } finally {
      setHistoryBusy(false)
    }
  }, [recordId])
  useEffect(() => { if (tab === 'history') queueMicrotask(() => { void loadHistory(1) }) }, [tab, loadHistory, stale])

  const offerRowId = record?.offer?.id
  useEffect(() => {
    // An archived Sub-product has left the old Portfolio endpoint on purpose (it answers 404), so the ideal customer is not asked for: the tab says why instead.
    if (tab !== 'signals' || offerRowId === undefined || !record?.offer || record.status === 'archived') return
    let live = true
    const name = record.offer.name
    queueMicrotask(() => {
      setIcpError('')
      portfolioService.getOffer(context, offerRowId)
        .then((r) => { if (live) setIcp(icpStatesFromOffer(r.data as unknown as Record<string, unknown>, name)) })
        .catch((cause) => { if (live) setIcpError(cause instanceof Error ? cause.message : 'The ideal customer could not be read.') })
    })
    return () => { live = false }
  }, [tab, offerRowId, record?.offer, record?.status, context, stale])

  const can = meta?.can
  const isAdmin = Boolean(can?.createProduct)
  const writable = Boolean(record && !record.shared)
  const canEdit = writable && Boolean(can?.editSubProduct)
  const canArchive = writable && Boolean(can?.archive)
  const canRestore = writable && Boolean(can?.restore)
  const canEditParts = Boolean(can?.editItem.product)
  const sell = record?.sell ?? null
  const canDeleteSell = writable && isAdmin && sell !== null && sell.state !== 'binned'

  const refresh = () => { setStale((n) => n + 1); void load(true); void loadFacts() }
  const say = (tone: Notice['tone'], text: string) => setNotice({ tone, text })

  const changeStatus = async (archive: boolean) => {
    if (!record || busy) return
    if (archive && !(await confirm({
      title: `Archive ${record.name}?`,
      description: 'It leaves the pickers and the default list. Its About and its Sell in CRM entry are not deleted, and you can restore it later.',
      confirmLabel: 'Archive',
    }))) return
    setBusy(true)
    try {
      const response = archive ? await productRecordService.archive(record.id) : await productRecordService.restore(record.id)
      setRecord(response.data)
      say('success', archive ? 'Archived.' : 'Restored.')
    } catch (cause) {
      say('error', cause instanceof Error ? cause.message : 'This could not be done.')
    } finally { setBusy(false) }
  }

  const deleteFromSell = async () => {
    if (!record || !sell || busy) return
    if (!(await confirm({
      title: `Delete ${record.name} from Sell in CRM?`,
      description: 'Its entry moves to the Recycle Bin and leaves the pickers; old quotes, orders and invoices still show it. The sub-product stays in the Product Portfolio as Not sold, and the entry can be brought back.',
      confirmLabel: 'Delete from Sell in CRM',
    }))) return
    setBusy(true)
    try {
      await crmService.deleteProduct(context, String(sell.crmProductId))
      say('success', 'Moved to the Recycle Bin. The sub-product stays, as Not sold.')
      refresh()
    } catch (cause) {
      say('error', cause instanceof Error ? cause.message : 'This could not be done.')
    } finally { setBusy(false) }
  }

  const saveCustom = async () => {
    if (!sell) return
    setSavingCustom(true)
    setCustomNotice('')
    try {
      await saveCustomFieldValues('crm_products', sell.crmProductId, customValues)
      setCustomNotice('Saved.')
    } catch (cause) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally { setSavingCustom(false) }
  }

  const tabs: PageTab[] = tabIds.map((t) => ({ id: t, label: SUB_TAB_LABELS[t] }))
  const state = sell ? sellWord(sell.state) : sellWord(facts.row?.state ?? 'not_sold')
  // The signals found and the ideal customer state come from the list row and from the record (both open to every signed-in person), never from the usage call, which is a refusal for a person who may not view Sell.
  const signals = facts.row?.signalsFound ?? null
  const product = record?.parent ?? null
  const subtitle = record
    ? [sell?.type === 'service' ? 'Service' : 'Sub-product', product?.name, record.offer?.offerId ?? sell?.productNo].filter(Boolean).join(' · ')
    : undefined
  const assignee = sell?.assignedTo != null ? (employees.find((e) => e.id === String(sell.assignedTo))?.name ?? `Person ${sell.assignedTo}`) : null

  return (
    <>
      <DetailPage
        title={record?.name ?? ''}
        subtitle={subtitle}
        badge={record && (
          <span className="flex flex-wrap items-center gap-2">
            {sell?.imageUrl
              ? <img src={sell.imageUrl} alt={`${record.name} picture`} className="size-9 rounded-lg border border-border object-cover" />
              : sell !== null && <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"><Package className="size-4" /></span>}
            {viewSell && <SellChip word={state} />}
            <ReadinessChip readiness={record.offer?.readiness} />
            <SignalsChip count={signals} />
            {record.shared && <SharedChip />}
            {record.status === 'archived' && <ArchivedChip />}
          </span>
        )}
        backLabel="Back to Product Portfolio"
        onBack={onBack}
        status={record?.kind === 'product' ? 'loading' : status}
        error={error}
        onRetry={() => void load()}
        notFoundText="This sub-product could not be found, or you do not have access to it."
        actions={record && (
          <>
            {canEdit && <Button onClick={() => setDrawer(true)} disabled={busy}><Pencil className="mr-1.5 size-4" aria-hidden="true" />Edit</Button>}
            {canArchive && record.status === 'active' && <Button variant="outline" onClick={() => void changeStatus(true)} disabled={busy}>Archive</Button>}
            {canRestore && record.status === 'archived' && <Button variant="outline" onClick={() => void changeStatus(false)} disabled={busy}>Restore</Button>}
            {canDeleteSell && <Button variant="outline" onClick={() => void deleteFromSell()} disabled={busy}>Delete from Sell in CRM</Button>}
            {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Working" />}
          </>
        )}
        notice={(notice || record?.mergedInto) && (
          <div className="space-y-2">
            {record?.mergedInto && (
              <div role="status" className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
                This record was merged into <Link href={`/portfolio/products/${record.mergedInto.id}`} className="font-medium underline underline-offset-2 hover:no-underline">{record.mergedInto.name}</Link>. Open that one: it carries everything that was kept.
              </div>
            )}
            {notice && <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${NOTICE_TONE[notice.tone]}`}>{notice.text}</div>}
          </div>
        )}
        tabs={record && <PageTabs tabs={tabs} active={tab} onChange={setTab} label="Sections of this sub-product" idPrefix={ID_PREFIX} />}
      >
        {record && record.kind !== 'product' && (
          <>
            <TabPanel id="overview" active={tab} idPrefix={ID_PREFIX}>
              <OverviewTab
                record={record}
                taxonomy={taxonomy}
                soldTogether={soldTogether}
                productHref={product ? `${hrefs.portfolio}/${encodeURIComponent(product.key)}` : null}
                canEdit={canEdit}
                onEdit={() => setDrawer(true)}
                isAdmin={isAdmin}
                context={context}
                onChanged={refresh}
              />
            </TabPanel>
            {sell && (
              <TabPanel id="details" active={tab} idPrefix={ID_PREFIX}>
                <DetailsTab sell={sell} name={record.name} assignee={assignee} inBin={sell.state === 'binned'} />
              </TabPanel>
            )}
            {sell && sell.type === 'product' && (
              <TabPanel id="bundle" active={tab} idPrefix={ID_PREFIX}>
                <BundleTab sell={sell} context={context} canEdit={canEditParts} />
              </TabPanel>
            )}
            {sell && (
              <TabPanel id="usage" active={tab} idPrefix={ID_PREFIX}>
                <UsageTab usage={usage} error={usageError} hrefs={hrefs} />
              </TabPanel>
            )}
            {tabIds.includes('history') && (
              <TabPanel id="history" active={tab} idPrefix={ID_PREFIX}>
                <HistoryTab rows={history?.rows ?? null} paging={history?.paging ?? null} error={historyError} loading={historyBusy} onPage={(p) => void loadHistory(p)} />
              </TabPanel>
            )}
            <TabPanel id="signals" active={tab} idPrefix={ID_PREFIX}>
              <SignalsIcpTab record={record} signals={signals} icpStates={icp} icpError={icpError} canEdit={canEdit} onEdit={() => setDrawer(true)} />
            </TabPanel>
            {sell && (
              // Always mounted (hidden, not unmounted) so that it can say whether the organisation has any definitions, which decides whether the tab exists.
              <div role={tab === 'custom' ? 'tabpanel' : undefined} id={tabPanelId(ID_PREFIX, 'custom')} aria-labelledby={tabButtonId(ID_PREFIX, 'custom')} hidden={tab !== 'custom'}>
                <SectionCard title="Custom Fields">
                  <CustomFieldsSection
                    recordTable="crm_products"
                    recordId={sell.crmProductId}
                    values={customValues}
                    onChange={setCustomValues}
                    onFieldsLoaded={(fields) => setHasCustomFields(fields.length > 0)}
                  />
                  {hasCustomFields && (
                    <div className="flex flex-wrap items-center gap-3 pt-4">
                      <Button size="sm" disabled={savingCustom} onClick={() => void saveCustom()}>{savingCustom && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}Save</Button>
                      {customNotice && <span role="status" className="text-xs text-muted-foreground">{customNotice}</span>}
                    </div>
                  )}
                </SectionCard>
              </div>
            )}
          </>
        )}
      </DetailPage>

      {record && record.kind !== 'product' && (
        <ProductFormDrawer
          open={drawer}
          onOpenChange={setDrawer}
          mode="edit"
          recordId={record.id}
          onSaved={() => { say('success', 'Saved.'); refresh() }}
        />
      )}
      {confirmDialog}
    </>
  )
}
