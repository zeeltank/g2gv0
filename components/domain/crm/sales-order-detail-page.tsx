'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Calendar, DollarSign, FileCheck2, Loader2, MapPin, Pencil, Receipt, Truck, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { KPICard } from '@/components/shared/business/kpi-card'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { EmptyState } from '@/components/ui/empty-state'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type {
  CrmPicklistValue, CrmProduct, CrmSalesOrder, CrmSalesOrderLineItemInput,
  CrmSalesOrderStatusHistoryEntry, CrmTaxRate,
} from '@/types/crm'
import { CreateSalesOrderModal } from './create-sales-order-modal'
import { SalesOrderLineItemTable } from './sales-order-line-item-table'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  salesOrder: CrmSalesOrder
  onSaved: () => void
  onBack: () => void
  soStages: CrmPicklistValue[]
  /** Wired by the page wrapper once an Invoices service method exists - this component never navigates on its own. */
  onCreateInvoice?: () => void
}

type Tab = 'details' | 'line-items' | 'history' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'line-items', label: 'Line Items' },
  { id: 'history', label: 'Stage History' },
]

/** Stages a Sales Order should not be invoiced from - still being drafted, or no longer live. */
const NOT_INVOICEABLE_STAGES = new Set(['draft', 'cancelled'])

function money(currency: string | null, n: number): string {
  return `${currency ?? ''} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()
}

/** A clickable cross-reference to another CRM record, or a muted dash when there isn't one - same ReadField convention quote-detail-page.tsx's own LinkedField uses. */
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

export function SalesOrderDetailPage({ salesOrder, onSaved, onBack, soStages, onCreateInvoice }: Props) {
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)

  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [lineItems, setLineItems] = useState<CrmSalesOrderLineItemInput[]>([])
  const [lineItemsLoading, setLineItemsLoading] = useState(true)
  const [savingLineItems, setSavingLineItems] = useState(false)
  const [products, setProducts] = useState<CrmProduct[]>([])
  const [taxRates, setTaxRates] = useState<CrmTaxRate[]>([])

  const [stageHistory, setStageHistory] = useState<CrmSalesOrderStatusHistoryEntry[]>([])
  const [stageHistoryLoading, setStageHistoryLoading] = useState(true)
  const [changingStage, setChangingStage] = useState(false)

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const tabs = hasCustomFields ? [...BASE_TABS, { id: 'custom' as const, label: 'Custom Fields' }] : BASE_TABS

  const loadLineItems = useCallback(async () => {
    setLineItemsLoading(true)
    try {
      const response = await crmService.getSalesOrderLineItems(context, salesOrder.id)
      setLineItems(response.data.map((row) => ({
        productId: row.productId, description: row.description, quantity: row.quantity, unitPrice: row.unitPrice,
        discountPercent: row.discountPercent, discountAmount: row.discountAmount, taxRateId: row.taxRateId, sequenceNo: row.sequenceNo,
      })))
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setLineItemsLoading(false)
    }
  }, [context, salesOrder.id])

  const loadStageHistory = useCallback(async () => {
    setStageHistoryLoading(true)
    try {
      const response = await crmService.getSalesOrderStageHistory(context, salesOrder.id)
      setStageHistory(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setStageHistoryLoading(false)
    }
  }, [context, salesOrder.id])

  useEffect(() => {
    queueMicrotask(() => { void loadLineItems(); void loadStageHistory() })
  }, [loadLineItems, loadStageHistory])

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
      const response = await crmService.saveSalesOrderLineItems(context, salesOrder.id, lineItems)
      setNotice(response.message)
      onSaved()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to save these line items.')
    } finally {
      setSavingLineItems(false)
    }
  }

  const changeStage = async (soStage: string) => {
    setChangingStage(true)
    setNotice('')
    try {
      const response = await crmService.changeSalesOrderStage(context, salesOrder.id, soStage)
      setNotice(response.message)
      onSaved()
      void loadStageHistory()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to change this sales order’s stage.')
    } finally {
      setChangingStage(false)
    }
  }

  const saveCustomFields = async () => {
    setSavingCustom(true)
    setCustomNotice(null)
    try {
      await saveCustomFieldValues('crm_sales_orders', Number(salesOrder.id), customValues)
      setCustomNotice('Saved.')
    } catch (cause: unknown) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally {
      setSavingCustom(false)
    }
  }

  const assignedToName = salesOrder.assignedToName ?? employees.find((e) => e.id === salesOrder.assignedTo)?.name ?? null
  const hasShipping = salesOrder.shippingStreet || salesOrder.shippingCity || salesOrder.shippingCountry
  const canInvoice = !NOT_INVOICEABLE_STAGES.has((salesOrder.soStage ?? '').trim().toLowerCase())

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Sales Orders" title="Back to Sales Orders">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <FileCheck2 className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{salesOrder.subject}</h1>
            <p className="text-sm text-muted-foreground">{salesOrder.soStage || 'Sales Order'} · {salesOrder.soNo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {onCreateInvoice && canInvoice && (
            <Button variant="outline" onClick={onCreateInvoice}>
              <Receipt className="mr-1.5 size-4" aria-hidden="true" />
              Create Invoice
            </Button>
          )}
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 size-4" aria-hidden="true" />
            Edit
          </Button>
        </div>
      </div>

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
            <KPICard label="Subtotal" value={money(salesOrder.currency, salesOrder.subtotal)} size="sm" />
            <KPICard label="Discount" value={salesOrder.discountAmount > 0 ? `-${money(salesOrder.currency, salesOrder.discountAmount)}` : '—'} size="sm" />
            <KPICard label="Tax" value={salesOrder.taxTotal > 0 ? money(salesOrder.currency, salesOrder.taxTotal) : '—'} size="sm" />
            <KPICard label="Shipping" value={salesOrder.shippingHandlingAmount > 0 ? money(salesOrder.currency, salesOrder.shippingHandlingAmount) : '—'} size="sm" />
            <KPICard label="Adjustment" value={salesOrder.adjustment !== 0 ? money(salesOrder.currency, salesOrder.adjustment) : '—'} size="sm" />
            <KPICard label="Total" value={money(salesOrder.currency, salesOrder.total)} size="sm" variant="primary" icon={<DollarSign className="size-4" aria-hidden="true" />} />
          </div>

          <SectionCard
            title="Sales Order Details"
            actions={(
              <div className="w-48">
                <Select
                  value={salesOrder.soStage || 'none'}
                  onChange={(v) => void changeStage(v === 'none' ? '' : v)}
                  options={[{ label: '—', value: 'none' }, ...soStages.map((p) => ({ label: p.label, value: p.value }))]}
                  disabled={changingStage}
                  aria-label="Change stage"
                />
              </div>
            )}
          >
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <LinkedField label="Organization" name={salesOrder.organizationName} href={salesOrder.organizationId ? resolveAccessLink('/module/crm/marketing/organizations') + `/${salesOrder.organizationId}` : null} />
              <LinkedField label="Contact" name={salesOrder.contactName} href={salesOrder.contactId ? resolveAccessLink('/module/crm/marketing/contacts') + `/${salesOrder.contactId}` : null} />
              <LinkedField label="Opportunity" name={salesOrder.opportunityName} href={salesOrder.opportunityId ? resolveAccessLink('/module/crm/sales/opportunities') + `/${salesOrder.opportunityId}` : null} />
              <LinkedField label="Source Quote" name={salesOrder.quoteNo} href={salesOrder.quoteId ? resolveAccessLink('/module/crm/sales/quotes') + `/${salesOrder.quoteId}` : null} />
              <ReadField label="Due Date" value={salesOrder.dueDate && <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />{salesOrder.dueDate}</span>} />
              <ReadField label="Carrier" value={salesOrder.carrier && <span className="inline-flex items-center gap-1.5"><Truck className="size-3.5 text-muted-foreground" aria-hidden="true" />{salesOrder.carrier}</span>} />
              <ReadField label="Assigned To" value={assignedToName && <span className="inline-flex items-center gap-1.5"><User className="size-3.5 text-muted-foreground" aria-hidden="true" />{assignedToName}</span>} />
            </dl>
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SectionCard title="Billing Address">
              <p className="inline-flex items-start gap-1.5 text-sm text-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {[salesOrder.billingStreet, salesOrder.billingCity, salesOrder.billingState, salesOrder.billingCode, salesOrder.billingCountry].filter(Boolean).join(', ') || 'Not set'}
              </p>
            </SectionCard>
            <SectionCard title="Shipping Address">
              <p className="inline-flex items-start gap-1.5 text-sm text-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {hasShipping
                  ? [salesOrder.shippingStreet, salesOrder.shippingCity, salesOrder.shippingState, salesOrder.shippingCode, salesOrder.shippingCountry].filter(Boolean).join(', ')
                  : 'Same as billing'}
              </p>
            </SectionCard>
          </div>

          <SectionCard title="Terms & Conditions">
            <p className="whitespace-pre-wrap text-sm text-foreground">{salesOrder.termsConditions || 'None specified.'}</p>
          </SectionCard>

          <SectionCard title="Description">
            <p className="whitespace-pre-wrap text-sm text-foreground">{salesOrder.description || 'No description yet.'}</p>
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
              <SalesOrderLineItemTable lineItems={lineItems} onChange={setLineItems} products={products} taxRates={taxRates} currency={salesOrder.currency} />
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
          {stageHistoryLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading stage history…
            </div>
          )}
          {!stageHistoryLoading && stageHistory.length === 0 && (
            <EmptyState icon={<FileCheck2 className="size-8" aria-hidden="true" />} title="No stage changes recorded yet" />
          )}
          {!stageHistoryLoading && stageHistory.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {stageHistory.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="text-foreground">
                    {entry.fromStage || 'None'} <span className="text-muted-foreground">→</span> {entry.toStage || 'None'}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{entry.createdAt}</span>
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
            recordTable="crm_sales_orders"
            recordId={Number(salesOrder.id)}
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

      <CreateSalesOrderModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        salesOrder={salesOrder}
        soStages={soStages}
      />
    </div>
  )
}
