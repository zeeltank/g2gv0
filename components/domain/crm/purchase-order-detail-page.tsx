'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Calendar, DollarSign, History, Loader2, MapPin, Pencil, Truck, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KPICard } from '@/components/shared/business/kpi-card'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { EmptyState } from '@/components/ui/empty-state'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { CrmPicklistValue, CrmProduct, CrmPurchaseOrder, CrmPurchaseOrderLineItemInput, CrmPurchaseOrderStatusHistoryEntry, CrmTaxRate } from '@/types/crm'
import { CreatePurchaseOrderModal } from './create-purchase-order-modal'
import { PurchaseOrderLineItemTable } from './purchase-order-line-item-table'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  purchaseOrder: CrmPurchaseOrder
  onSaved: () => void
  onBack: () => void
  poStages: CrmPicklistValue[]
}

type Tab = 'details' | 'line-items' | 'history' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'line-items', label: 'Line Items' },
  { id: 'history', label: 'Stage History' },
]

function money(currency: string | null, n: number): string {
  return `${currency ?? ''} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()
}

/** A clickable cross-reference to another CRM record, or a muted dash when there isn't one - same convention QuoteDetailPage's own LinkedField uses. */
function LinkedField({ label, href, name }: { label: string; href: string | null; name: string | null }) {
  const router = useRouter()
  return (
    <ReadField
      label={label}
      value={href
        ? <button type="button" className="text-primary hover:underline" onClick={() => router.push(href)}>{name}</button>
        : null}
    />
  )
}

export function PurchaseOrderDetailPage({ purchaseOrder, onSaved, onBack, poStages }: Props) {
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)

  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [lineItems, setLineItems] = useState<CrmPurchaseOrderLineItemInput[]>([])
  const [lineItemsLoading, setLineItemsLoading] = useState(true)
  const [savingLineItems, setSavingLineItems] = useState(false)
  const [products, setProducts] = useState<CrmProduct[]>([])
  const [taxRates, setTaxRates] = useState<CrmTaxRate[]>([])

  const [history, setHistory] = useState<CrmPurchaseOrderStatusHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const tabs = hasCustomFields ? [...BASE_TABS, { id: 'custom' as const, label: 'Custom Fields' }] : BASE_TABS

  const loadLineItems = useCallback(async () => {
    setLineItemsLoading(true)
    try {
      const response = await crmService.getPurchaseOrderLineItems(context, purchaseOrder.id)
      setLineItems(response.data.map((row) => ({
        productId: row.productId, description: row.description, quantity: row.quantity, unitPrice: row.unitPrice,
        discountPercent: row.discountPercent, discountAmount: row.discountAmount, taxRateId: row.taxRateId, sequenceNo: row.sequenceNo,
      })))
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setLineItemsLoading(false)
    }
  }, [context, purchaseOrder.id])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await crmService.getPurchaseOrderStageHistory(context, purchaseOrder.id)
      setHistory(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setHistoryLoading(false)
    }
  }, [context, purchaseOrder.id])

  useEffect(() => {
    queueMicrotask(() => { void loadLineItems() })
  }, [loadLineItems])

  useEffect(() => {
    queueMicrotask(() => { void loadHistory() })
  }, [loadHistory])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    Promise.all([
      crmService.getProducts(context, 'product', { perPage: 200, sortBy: 'name', sortDir: 'asc' }),
      crmService.getProducts(context, 'service', { perPage: 200, sortBy: 'name', sortDir: 'asc' }),
      crmService.getTaxRates(context),
    ])
      .then(([productsRes, servicesRes, taxRatesRes]) => {
        setProducts([...productsRes.data.items, ...servicesRes.data.items])
        setTaxRates(taxRatesRes.data)
      })
      .catch(() => { /* the line-item builder still works with empty pickers */ })
  }, [context])

  const saveLineItems = async () => {
    setSavingLineItems(true)
    setNotice('')
    try {
      const response = await crmService.savePurchaseOrderLineItems(context, purchaseOrder.id, lineItems)
      setNotice(response.message)
      onSaved()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to save these line items.')
    } finally {
      setSavingLineItems(false)
    }
  }

  const saveCustomFields = async () => {
    setSavingCustom(true)
    setCustomNotice(null)
    try {
      await saveCustomFieldValues('crm_purchase_orders', Number(purchaseOrder.id), customValues)
      setCustomNotice('Saved.')
    } catch (cause: unknown) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally {
      setSavingCustom(false)
    }
  }

  const changeStage = async (poStage: string) => {
    setNotice('')
    try {
      const response = await crmService.changePurchaseOrderStage(context, purchaseOrder.id, { poStage })
      setNotice(response.message)
      onSaved()
      void loadHistory()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to change the stage.')
    }
  }

  const assignedToName = employees.find((e) => e.id === purchaseOrder.assignedTo)?.name ?? null
  const hasShipping = purchaseOrder.shippingStreet || purchaseOrder.shippingCity || purchaseOrder.shippingCountry

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Purchase Orders" title="Back to Purchase Orders">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <Truck className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{purchaseOrder.subject}</h1>
            <p className="text-sm text-muted-foreground">{purchaseOrder.poStage || 'Purchase Order'} · {purchaseOrder.poNo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 size-4" aria-hidden="true" />
            Edit
          </Button>
        </div>
      </div>

      {!purchaseOrder.vendorId && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          This purchase order has no vendor set yet - click Edit to choose one before sending it out.
        </div>
      )}

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KPICard label="Subtotal" value={money(purchaseOrder.currency, purchaseOrder.subtotal)} size="sm" />
            <KPICard label="Discount" value={purchaseOrder.discountAmount > 0 ? `-${money(purchaseOrder.currency, purchaseOrder.discountAmount)}` : '—'} size="sm" />
            <KPICard label="Tax" value={purchaseOrder.taxTotal > 0 ? money(purchaseOrder.currency, purchaseOrder.taxTotal) : '—'} size="sm" />
            <KPICard label="Shipping" value={purchaseOrder.shippingHandlingAmount > 0 ? money(purchaseOrder.currency, purchaseOrder.shippingHandlingAmount) : '—'} size="sm" />
            <KPICard label="Adjustment" value={purchaseOrder.adjustment !== 0 ? money(purchaseOrder.currency, purchaseOrder.adjustment) : '—'} size="sm" />
            <KPICard label="Total" value={money(purchaseOrder.currency, purchaseOrder.total)} size="sm" variant="primary" icon={<DollarSign className="size-4" aria-hidden="true" />} />
          </div>

          <SectionCard title="Purchase Order Details">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ReadField
                label="Vendor"
                value={purchaseOrder.vendorId
                  ? <span className="inline-flex items-center gap-1.5 font-semibold"><Truck className="size-3.5 text-muted-foreground" aria-hidden="true" />{purchaseOrder.vendorName}</span>
                  : <span className="text-warning">Not set</span>}
              />
              <LinkedField label="Organization" name={purchaseOrder.organizationName} href={purchaseOrder.organizationId ? resolveAccessLink('/module/crm/marketing/organizations') + `/${purchaseOrder.organizationId}` : null} />
              <LinkedField label="Quote" name={purchaseOrder.quoteNo} href={purchaseOrder.quoteId ? resolveAccessLink('/module/crm/sales/quotes') + `/${purchaseOrder.quoteId}` : null} />
              <ReadField
                label="Stage"
                value={(
                  <select
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                    value={purchaseOrder.poStage ?? ''}
                    onChange={(e) => void changeStage(e.target.value)}
                  >
                    <option value="">—</option>
                    {poStages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                )}
              />
              <ReadField label="Due Date" value={purchaseOrder.dueDate && <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />{purchaseOrder.dueDate}</span>} />
              <ReadField label="Requisition No." value={purchaseOrder.requisitionNo} />
              <ReadField label="Tracking No." value={purchaseOrder.trackingNo} />
              <ReadField label="Assigned To" value={assignedToName && <span className="inline-flex items-center gap-1.5"><User className="size-3.5 text-muted-foreground" aria-hidden="true" />{assignedToName}</span>} />
            </dl>
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SectionCard title="Billing Address">
              <p className="inline-flex items-start gap-1.5 text-sm text-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {[purchaseOrder.billingStreet, purchaseOrder.billingCity, purchaseOrder.billingState, purchaseOrder.billingCode, purchaseOrder.billingCountry].filter(Boolean).join(', ') || 'Not set'}
              </p>
            </SectionCard>
            <SectionCard title="Shipping Address">
              <p className="inline-flex items-start gap-1.5 text-sm text-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {hasShipping
                  ? [purchaseOrder.shippingStreet, purchaseOrder.shippingCity, purchaseOrder.shippingState, purchaseOrder.shippingCode, purchaseOrder.shippingCountry].filter(Boolean).join(', ')
                  : 'Same as billing'}
              </p>
            </SectionCard>
          </div>

          <SectionCard title="Terms & Conditions">
            <p className="whitespace-pre-wrap text-sm text-foreground">{purchaseOrder.termsConditions || 'None specified.'}</p>
          </SectionCard>

          <SectionCard title="Description">
            <p className="whitespace-pre-wrap text-sm text-foreground">{purchaseOrder.description || 'No description yet.'}</p>
          </SectionCard>
        </div>
      )}

      {tab === 'line-items' && (
        <SectionCard>
          {lineItemsLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading line items…
            </div>
          ) : (
            <div className="space-y-3">
              <PurchaseOrderLineItemTable lineItems={lineItems} onChange={setLineItems} products={products} taxRates={taxRates} currency={purchaseOrder.currency} />
              <div className="flex items-center gap-3 pt-2">
                <Button disabled={savingLineItems} onClick={() => void saveLineItems()}>
                  {savingLineItems && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
                  Save Line Items
                </Button>
                <p className="text-xs text-muted-foreground">Totals shown while editing are a preview - the server recomputes everything on save.</p>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'history' && (
        <SectionCard title="Stage History">
          {historyLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading history…
            </div>
          )}
          {!historyLoading && history.length === 0 && (
            <EmptyState
              icon={<History className="size-8" aria-hidden="true" />}
              title="No stage changes yet"
              description="Changing this purchase order's stage will record it here."
            />
          )}
          {!historyLoading && history.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{entry.fromStage || 'None'} → {entry.toStage || 'None'}</p>
                    <p className="text-xs text-muted-foreground">{entry.createdAt}</p>
                  </div>
                  <p className="font-medium text-foreground">{entry.total !== null ? money(purchaseOrder.currency, entry.total) : '—'}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <SectionCard title="Custom Fields">
          <CustomFieldsSection
            recordTable="crm_purchase_orders"
            recordId={Number(purchaseOrder.id)}
            values={customValues}
            onChange={setCustomValues}
            onFieldsLoaded={(fields) => setHasCustomFields(fields.length > 0)}
          />
          {hasCustomFields && (
            <div className="flex items-center gap-3 pt-4">
              <Button size="sm" disabled={savingCustom} onClick={() => void saveCustomFields()}>
                {savingCustom && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
                Save
              </Button>
              {customNotice && <span className="text-xs text-muted-foreground">{customNotice}</span>}
            </div>
          )}
        </SectionCard>
      </div>

      <CreatePurchaseOrderModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        purchaseOrder={purchaseOrder}
        poStages={poStages}
      />
    </div>
  )
}
