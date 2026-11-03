'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { productMasterService } from '@/services/product-master/product-master-service'
import type { PmKind, PmMeta, PmOption, PmRecord, PmUsage } from '@/services/product-master/types'
import { extraTabs, lineRecordHref } from './product-lines-model'
import { ProductMasterForm, type FormTarget, type ProductMasterWriter } from './product-master-form'
import { productChoices } from './product-master-model'
import { ProductSignalsIcpTab } from './product-signals-icp-tab'
import { ProductUsageTab } from './product-usage-tab'

/** The part of the Product Master API these panels read and write through; the real one by default, a stand-in in a test. */
export type ProductPanelApi = Pick<typeof productMasterService, 'get' | 'usage' | 'meta' | 'options'> & ProductMasterWriter

/** Where the panels link to; the page that renders them works these out from the menu. */
export interface ProductPanelHrefs {
  products: string
  priceBooks: string
}

const message = (cause: unknown, fallback: string) => (cause instanceof Error && cause.message ? cause.message : fallback)

/**
 * The "Signals & ICP" tab of a catalogue item's page, which loads what it shows when the tab is opened: the sub-product's record (its product line, ID,
 * readiness and About text) and its usage (the Signals found and the ICP's state). "Edit sub-product details" opens the sub-product's own form without its
 * "Sell in CRM" section, because the item's price, SKU and tax rate already have the page's Edit button.
 *
 * `onChanged` is given the saved record after a save, so the page can follow a rename (renaming the sub-product renames its catalogue item too).
 */
export function ProductSignalsIcpPanel({ masterId, hrefs, onChanged, service = productMasterService }: {
  masterId: number
  hrefs: ProductPanelHrefs
  onChanged?: (saved: PmRecord) => void
  service?: ProductPanelApi
}) {
  const [record, setRecord] = useState<PmRecord | null>(null)
  const [recordError, setRecordError] = useState('')
  const [usage, setUsage] = useState<PmUsage | null>(null)
  const [usageError, setUsageError] = useState('')
  const [meta, setMeta] = useState<PmMeta | null>(null)
  const [options, setOptions] = useState<PmOption[]>([])
  const [notice, setNotice] = useState('')
  const [drawer, setDrawer] = useState<{ open: boolean; target: FormTarget | null }>({ open: false, target: null })

  // Only the newest read may change what is shown (a page opened on another item must not be overwritten by the first one's late answer).
  const latest = useRef(0)
  const load = useCallback(async () => {
    if (!isLaravelContextReady(getLaravelContext())) {
      setRecordError('Your ERP session is unavailable. Please sign in again.')
      return
    }
    const mine = ++latest.current
    setRecordError('')
    setUsageError('')
    const [recordResult, usageResult, metaResult, optionsResult] = await Promise.allSettled([service.get(masterId), service.usage(masterId), service.meta(), service.options()])
    if (mine !== latest.current) return
    if (recordResult.status === 'fulfilled') setRecord(recordResult.value.data)
    else setRecordError(message(recordResult.reason, 'Unable to load the sub-product details.'))
    if (usageResult.status === 'fulfilled') setUsage(usageResult.value.data)
    else setUsageError(message(usageResult.reason, 'Unable to load the signals and the ICP.'))
    if (metaResult.status === 'fulfilled') setMeta(metaResult.value.data)
    if (optionsResult.status === 'fulfilled') setOptions(optionsResult.value.data)
  }, [service, masterId])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const lineHref = (id: number) => lineRecordHref(hrefs.products, id)
  const canEdit = Boolean(record && record.kind === 'sub_product' && !record.shared && meta?.can.editSubProduct)

  if (recordError) return <p role="alert" className="text-sm text-destructive">{recordError}</p>
  if (!record) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      {notice && <div role="status" className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      <ProductSignalsIcpTab
        record={record}
        usage={usage}
        usageError={usageError}
        withOffer
        lineHref={lineHref}
        onEdit={canEdit ? () => setDrawer({ open: true, target: { mode: 'edit', record } }) : undefined}
      />
      <ProductMasterForm
        open={drawer.open}
        target={drawer.target}
        meta={meta}
        products={productChoices(options)}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        showSell={false}
        service={service}
        onSaved={(saved, text) => {
          setDrawer((d) => ({ ...d, open: false }))
          setRecord(saved)
          setNotice(text)
          void load()
          onChanged?.(saved)
        }}
      />
    </div>
  )
}

/**
 * The body of one of the extra tabs of a catalogue item's page, or nothing. It shows a tab only while that tab is the open one AND the item has the tab
 * (see extraTabs), so a stale tab id can never open a panel for an item that has no record behind it, and the panel reads its data only when it is opened.
 */
export function ProductExtraPanel({ tab, masterId, masterKind, hrefs, onRenamed, service }: {
  tab: string
  masterId: number | null | undefined
  masterKind: PmKind | null | undefined
  hrefs: ProductPanelHrefs
  /** Told the new name after the sub-product's details are saved from the Signals & ICP tab. */
  onRenamed?: (name: string) => void
  service?: ProductPanelApi
}) {
  if (masterId === null || masterId === undefined) return null
  const tabs = extraTabs(masterKind)
  if (tab === 'signals' && tabs.includes('signals')) {
    return <ProductSignalsIcpPanel masterId={masterId} hrefs={hrefs} onChanged={(saved) => onRenamed?.(saved.name)} service={service} />
  }
  if (tab === 'usage' && tabs.includes('usage')) {
    return <ProductUsagePanel masterId={masterId} kind={masterKind ?? 'item'} hrefs={hrefs} service={service} />
  }
  return null
}

/** The "Usage" tab of a catalogue item's page: signals, quotes and price books, read when the tab is opened. */
export function ProductUsagePanel({ masterId, kind, hrefs, service = productMasterService }: {
  masterId: number
  kind: PmKind
  hrefs: ProductPanelHrefs
  service?: Pick<ProductPanelApi, 'usage'>
}) {
  const [usage, setUsage] = useState<PmUsage | null>(null)
  const [error, setError] = useState('')

  const latest = useRef(0)
  const load = useCallback(async () => {
    if (!isLaravelContextReady(getLaravelContext())) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }
    const mine = ++latest.current
    setError('')
    try {
      const response = await service.usage(masterId)
      if (mine === latest.current) setUsage(response.data)
    } catch (cause) {
      if (mine === latest.current) setError(message(cause, 'Unable to load how this is used.'))
    }
  }, [service, masterId])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  // A catalogue item's own page is only ever opened for an item that is in the catalogue.
  return <ProductUsageTab usage={usage} error={error} inCatalogue kind={kind} priceBooksHref={hrefs.priceBooks} />
}
