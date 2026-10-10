'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { useQuotePdfDownload } from '@/hooks/use-quote-pdf-download'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { CrmProduct, CrmPicklistValue, CrmQuote, CrmQuoteLineItemInput, CrmTaxRate } from '@/types/crm'
import { CreateQuoteModal } from './create-quote-modal'
import { QuoteLineItemTable } from './quote-line-item-table'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  quote: CrmQuote
  onSaved: () => void
  onBack: () => void
  quoteStages: CrmPicklistValue[]
}

type Tab = 'details' | 'line-items' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'line-items', label: 'Line Items' },
]

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value ?? '—'}</p>
    </div>
  )
}

function money(currency: string | null, n: number): string {
  return `${currency ?? ''} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()
}

export function QuoteDetailPage({ quote, onSaved, onBack, quoteStages }: Props) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)
  const pdfDownload = useQuotePdfDownload()

  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [lineItems, setLineItems] = useState<CrmQuoteLineItemInput[]>([])
  const [lineItemsLoading, setLineItemsLoading] = useState(true)
  const [savingLineItems, setSavingLineItems] = useState(false)
  const [products, setProducts] = useState<CrmProduct[]>([])
  const [taxRates, setTaxRates] = useState<CrmTaxRate[]>([])

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const tabs = hasCustomFields ? [...BASE_TABS, { id: 'custom' as const, label: 'Custom Fields' }] : BASE_TABS

  const loadLineItems = useCallback(async () => {
    setLineItemsLoading(true)
    try {
      const response = await crmService.getQuoteLineItems(context, quote.id)
      setLineItems(response.data.map((row) => ({
        productId: row.productId, description: row.description, quantity: row.quantity, unitPrice: row.unitPrice,
        discountPercent: row.discountPercent, discountAmount: row.discountAmount, taxRateId: row.taxRateId, sequenceNo: row.sequenceNo,
      })))
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setLineItemsLoading(false)
    }
  }, [context, quote.id])

  useEffect(() => {
    queueMicrotask(() => { void loadLineItems() })
  }, [loadLineItems])

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
      const response = await crmService.saveQuoteLineItems(context, quote.id, lineItems)
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
      await saveCustomFieldValues('crm_quotes', Number(quote.id), customValues)
      setCustomNotice('Saved.')
    } catch (cause: unknown) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally {
      setSavingCustom(false)
    }
  }

  const assignedToName = employees.find((e) => e.id === quote.assignedTo)?.name ?? null
  const hasShipping = quote.shippingStreet || quote.shippingCity || quote.shippingCountry

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
            Back to Quotes
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{quote.subject}</h1>
            <p className="text-sm text-muted-foreground">{quote.quoteStage || 'Quote'} · {quote.quoteNo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={pdfDownload.busy} onClick={() => void pdfDownload.download(quote.id, quote.quoteNo)}>
            {pdfDownload.busy ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : <Download className="mr-1.5 size-4" aria-hidden="true" />}
            Download PDF
          </Button>
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 size-4" aria-hidden="true" />
            Edit
          </Button>
        </div>
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {pdfDownload.error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{pdfDownload.error}</div>}

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
        <div className="space-y-6 rounded-lg border border-border p-4">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Quote Details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">Organization</p>
                {quote.organizationId ? (
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => router.push(resolveAccessLink('/module/crm/marketing/organizations') + `/${quote.organizationId}`)}
                  >
                    {quote.organizationName}
                  </button>
                ) : (
                  <p className="text-sm text-foreground">—</p>
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">Contact</p>
                {quote.contactId ? (
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => router.push(resolveAccessLink('/module/crm/marketing/contacts') + `/${quote.contactId}`)}
                  >
                    {quote.contactName}
                  </button>
                ) : (
                  <p className="text-sm text-foreground">—</p>
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">Opportunity</p>
                {quote.opportunityId ? (
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => router.push(resolveAccessLink('/module/crm/sales/opportunities') + `/${quote.opportunityId}`)}
                  >
                    {quote.opportunityName}
                  </button>
                ) : (
                  <p className="text-sm text-foreground">—</p>
                )}
              </div>
              <Field label="Valid Till" value={quote.validTill} />
              <Field label="Currency" value={quote.currency} />
              <Field label="Assigned To" value={assignedToName} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Totals</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Field label="Subtotal" value={money(quote.currency, quote.subtotal)} />
              <Field label="Discount" value={quote.discountAmount > 0 ? `-${money(quote.currency, quote.discountAmount)}` : '—'} />
              <Field label="Tax" value={quote.taxTotal > 0 ? money(quote.currency, quote.taxTotal) : '—'} />
              <Field label="Shipping" value={quote.shippingHandlingAmount > 0 ? money(quote.currency, quote.shippingHandlingAmount) : '—'} />
              <Field label="Adjustment" value={quote.adjustment !== 0 ? money(quote.currency, quote.adjustment) : '—'} />
              <Field label="Total" value={money(quote.currency, quote.total)} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Billing Address</h2>
              <p className="text-sm text-foreground">
                {[quote.billingStreet, quote.billingCity, quote.billingState, quote.billingCode, quote.billingCountry].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Shipping Address</h2>
              <p className="text-sm text-foreground">
                {hasShipping
                  ? [quote.shippingStreet, quote.shippingCity, quote.shippingState, quote.shippingCode, quote.shippingCountry].filter(Boolean).join(', ')
                  : 'Same as billing'}
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Terms &amp; Conditions</h2>
            <p className="whitespace-pre-wrap text-sm text-foreground">{quote.termsConditions || '—'}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Description</h2>
            <p className="whitespace-pre-wrap text-sm text-foreground">{quote.description || '—'}</p>
          </section>
        </div>
      )}

      {tab === 'line-items' && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          {lineItemsLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading line items…
            </div>
          ) : (
            <>
              <QuoteLineItemTable lineItems={lineItems} onChange={setLineItems} products={products} taxRates={taxRates} currency={quote.currency} />
              <div className="flex items-center gap-3 pt-2">
                <Button disabled={savingLineItems} onClick={() => void saveLineItems()}>
                  {savingLineItems && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
                  Save Line Items
                </Button>
                <p className="text-xs text-muted-foreground">Totals shown while editing are a preview - the server recomputes everything on save.</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? 'space-y-4 rounded-lg border border-border p-4' : 'hidden'}>
        <CustomFieldsSection
          recordTable="crm_quotes"
          recordId={Number(quote.id)}
          values={customValues}
          onChange={setCustomValues}
          onFieldsLoaded={(fields) => setHasCustomFields(fields.length > 0)}
        />
        {hasCustomFields && (
          <div className="flex items-center gap-3 pt-2">
            <Button size="sm" disabled={savingCustom} onClick={() => void saveCustomFields()}>
              {savingCustom && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
              Save
            </Button>
            {customNotice && <span className="text-xs text-muted-foreground">{customNotice}</span>}
          </div>
        )}
      </div>

      <CreateQuoteModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        quote={quote}
        quoteStages={quoteStages}
      />
    </div>
  )
}
