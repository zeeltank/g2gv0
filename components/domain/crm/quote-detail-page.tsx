'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Building2, Calendar, DollarSign, Download, FileText,
  Loader2, MapPin, Pencil, Target, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KPICard } from '@/components/shared/business/kpi-card'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { useQuotePdfDownload } from '@/hooks/use-quote-pdf-download'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { CrmPriceBookItem, CrmProduct, CrmPicklistValue, CrmQuote, CrmQuoteLineItemInput, CrmTaxRate } from '@/types/crm'
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

function money(currency: string | null, n: number): string {
  return `${currency ?? ''} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()
}

/** A clickable cross-reference to another CRM record, or a muted dash when there isn't one - the ReadField convention this page's linked fields (Organization/Contact/Opportunity/Price Book) all share. */
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

export function QuoteDetailPage({ quote, onSaved, onBack, quoteStages }: Props) {
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
  const [priceBookItems, setPriceBookItems] = useState<CrmPriceBookItem[]>([])

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

  useEffect(() => {
    if (!isLaravelContextReady(context) || !quote.priceBookId) { queueMicrotask(() => setPriceBookItems([])); return }
    crmService.getPriceBookItems(context, quote.priceBookId)
      .then((response) => setPriceBookItems(response.data))
      .catch(() => { /* a newly-added line item just falls back to each product's base price */ })
  }, [context, quote.priceBookId])

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
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Quotes" title="Back to Quotes">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <FileText className="size-5" aria-hidden="true" />
          </div>
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
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KPICard label="Subtotal" value={money(quote.currency, quote.subtotal)} size="sm" />
            <KPICard label="Discount" value={quote.discountAmount > 0 ? `-${money(quote.currency, quote.discountAmount)}` : '—'} size="sm" />
            <KPICard label="Tax" value={quote.taxTotal > 0 ? money(quote.currency, quote.taxTotal) : '—'} size="sm" />
            <KPICard label="Shipping" value={quote.shippingHandlingAmount > 0 ? money(quote.currency, quote.shippingHandlingAmount) : '—'} size="sm" />
            <KPICard label="Adjustment" value={quote.adjustment !== 0 ? money(quote.currency, quote.adjustment) : '—'} size="sm" />
            <KPICard label="Total" value={money(quote.currency, quote.total)} size="sm" variant="primary" icon={<DollarSign className="size-4" aria-hidden="true" />} />
          </div>

          <SectionCard title="Quote Details">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <LinkedField label="Organization" name={quote.organizationName} href={quote.organizationId ? resolveAccessLink('/module/crm/marketing/organizations') + `/${quote.organizationId}` : null} />
              <LinkedField label="Contact" name={quote.contactName} href={quote.contactId ? resolveAccessLink('/module/crm/marketing/contacts') + `/${quote.contactId}` : null} />
              <LinkedField label="Opportunity" name={quote.opportunityName} href={quote.opportunityId ? resolveAccessLink('/module/crm/sales/opportunities') + `/${quote.opportunityId}` : null} />
              <LinkedField label="Price Book" name={quote.priceBookName} href={quote.priceBookId ? resolveAccessLink('/module/crm/sales/price-books') + `/${quote.priceBookId}` : null} />
              <ReadField label="Valid Till" value={quote.validTill && <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />{quote.validTill}</span>} />
              <ReadField label="Assigned To" value={assignedToName && <span className="inline-flex items-center gap-1.5"><User className="size-3.5 text-muted-foreground" aria-hidden="true" />{assignedToName}</span>} />
            </dl>
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SectionCard title="Billing Address">
              <p className="inline-flex items-start gap-1.5 text-sm text-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {[quote.billingStreet, quote.billingCity, quote.billingState, quote.billingCode, quote.billingCountry].filter(Boolean).join(', ') || 'Not set'}
              </p>
            </SectionCard>
            <SectionCard title="Shipping Address">
              <p className="inline-flex items-start gap-1.5 text-sm text-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {hasShipping
                  ? [quote.shippingStreet, quote.shippingCity, quote.shippingState, quote.shippingCode, quote.shippingCountry].filter(Boolean).join(', ')
                  : 'Same as billing'}
              </p>
            </SectionCard>
          </div>

          <SectionCard title="Terms & Conditions">
            <p className="whitespace-pre-wrap text-sm text-foreground">{quote.termsConditions || 'None specified.'}</p>
          </SectionCard>

          <SectionCard title="Description">
            <p className="whitespace-pre-wrap text-sm text-foreground">{quote.description || 'No description yet.'}</p>
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
              <QuoteLineItemTable lineItems={lineItems} onChange={setLineItems} products={products} taxRates={taxRates} currency={quote.currency} priceBookItems={priceBookItems} />
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

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <SectionCard title="Custom Fields">
          <CustomFieldsSection
            recordTable="crm_quotes"
            recordId={Number(quote.id)}
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
