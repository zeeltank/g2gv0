'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, ArrowLeft, Calendar, DollarSign, Download, FileText, Loader2, MapPin, Pencil, User, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { KPICard } from '@/components/shared/business/kpi-card'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { useInvoicePdfDownload } from '@/hooks/use-invoice-pdf-download'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type {
  CrmEmailLinkEntry, CrmInvoice, CrmInvoiceLineItemInput, CrmInvoicePaymentEntry, CrmInvoiceStatusHistoryEntry,
  CrmPicklistValue, CrmProduct, CrmTaxRate,
} from '@/types/crm'
import { CreateInvoiceModal } from './create-invoice-modal'
import { CrmEmailTab } from './crm-email-tab'
import { QuoteLineItemTable } from './quote-line-item-table'
import { RecordInvoicePaymentDialog } from './record-invoice-payment-dialog'
import { SendEmailDialog } from './send-email-dialog'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  invoice: CrmInvoice
  onSaved: () => void
  onBack: () => void
  invoiceStages: CrmPicklistValue[]
}

type Tab = 'details' | 'line-items' | 'payments' | 'history' | 'emails' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'line-items', label: 'Line Items' },
  { id: 'payments', label: 'Payments' },
  { id: 'history', label: 'Stage History' },
  { id: 'emails', label: 'Emails' },
]

function paymentStatusVariant(status: CrmInvoice['paymentStatus']): 'success' | 'warning' | 'default' {
  switch (status) {
    case 'Paid': return 'success'
    case 'Partially Paid': return 'warning'
    default: return 'default'
  }
}

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

export function InvoiceDetailPage({ invoice, onSaved, onBack, invoiceStages }: Props) {
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)
  const pdfDownload = useInvoicePdfDownload()

  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [lineItems, setLineItems] = useState<CrmInvoiceLineItemInput[]>([])
  const [lineItemsLoading, setLineItemsLoading] = useState(true)
  const [savingLineItems, setSavingLineItems] = useState(false)
  const [products, setProducts] = useState<CrmProduct[]>([])
  const [taxRates, setTaxRates] = useState<CrmTaxRate[]>([])

  const [stageHistory, setStageHistory] = useState<CrmInvoiceStatusHistoryEntry[]>([])
  const [stageHistoryLoading, setStageHistoryLoading] = useState(true)
  const [changingStage, setChangingStage] = useState(false)

  const [payments, setPayments] = useState<CrmInvoicePaymentEntry[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)

  const [emails, setEmails] = useState<CrmEmailLinkEntry[]>([])
  const [emailsLoading, setEmailsLoading] = useState(true)
  const [composeEmailOpen, setComposeEmailOpen] = useState(false)

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const tabs = hasCustomFields ? [...BASE_TABS, { id: 'custom' as const, label: 'Custom Fields' }] : BASE_TABS

  const loadLineItems = useCallback(async () => {
    setLineItemsLoading(true)
    try {
      const response = await crmService.getInvoiceLineItems(context, invoice.id)
      setLineItems(response.data.map((row) => ({
        productId: row.productId, description: row.description, quantity: row.quantity, unitPrice: row.unitPrice,
        discountPercent: row.discountPercent, discountAmount: row.discountAmount, taxRateId: row.taxRateId, sequenceNo: row.sequenceNo,
      })))
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setLineItemsLoading(false)
    }
  }, [context, invoice.id])

  const loadStageHistory = useCallback(async () => {
    setStageHistoryLoading(true)
    try {
      const response = await crmService.getInvoiceStageHistory(context, invoice.id)
      setStageHistory(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setStageHistoryLoading(false)
    }
  }, [context, invoice.id])

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true)
    try {
      const response = await crmService.getInvoicePayments(context, invoice.id)
      setPayments(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setPaymentsLoading(false)
    }
  }, [context, invoice.id])

  const loadEmails = useCallback(async () => {
    setEmailsLoading(true)
    try {
      const response = await crmService.getInvoiceEmails(context, invoice.id)
      setEmails(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setEmailsLoading(false)
    }
  }, [context, invoice.id])

  useEffect(() => {
    queueMicrotask(() => { void loadLineItems(); void loadStageHistory(); void loadPayments(); void loadEmails() })
  }, [loadLineItems, loadStageHistory, loadPayments, loadEmails])

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
      const response = await crmService.saveInvoiceLineItems(context, invoice.id, lineItems)
      setNotice(response.message)
      onSaved()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to save these line items.')
    } finally {
      setSavingLineItems(false)
    }
  }

  const changeStage = async (invoiceStage: string) => {
    setChangingStage(true)
    setNotice('')
    try {
      const response = await crmService.changeInvoiceStage(context, invoice.id, { invoiceStage })
      setNotice(response.message)
      onSaved()
      void loadStageHistory()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to change this invoice’s stage.')
    } finally {
      setChangingStage(false)
    }
  }

  const saveCustomFields = async () => {
    setSavingCustom(true)
    setCustomNotice(null)
    try {
      await saveCustomFieldValues('crm_invoices', Number(invoice.id), customValues)
      setCustomNotice('Saved.')
    } catch (cause: unknown) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally {
      setSavingCustom(false)
    }
  }

  const assignedToName = invoice.assignedToName ?? employees.find((e) => e.id === invoice.assignedTo)?.name ?? null
  const hasShipping = invoice.shippingStreet || invoice.shippingCity || invoice.shippingCountry

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Invoices" title="Back to Invoices">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <FileText className="size-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{invoice.subject}</h1>
              <StatusBadge variant={paymentStatusVariant(invoice.paymentStatus)}>{invoice.paymentStatus}</StatusBadge>
              {invoice.isOverdue && (
                <StatusBadge variant="error">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  Overdue
                </StatusBadge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{invoice.invoiceStage || 'Invoice'} · {invoice.invoiceNo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={pdfDownload.busy} onClick={() => void pdfDownload.download(invoice.id, invoice.invoiceNo)}>
            {pdfDownload.busy ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : <Download className="mr-1.5 size-4" aria-hidden="true" />}
            Download PDF
          </Button>
          <Button variant="outline" onClick={() => setComposeEmailOpen(true)}>
            Email Customer
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <KPICard label="Subtotal" value={money(invoice.currency, invoice.subtotal)} size="sm" />
            <KPICard label="Discount" value={invoice.discountAmount > 0 ? `-${money(invoice.currency, invoice.discountAmount)}` : '—'} size="sm" />
            <KPICard label="Tax" value={invoice.taxTotal > 0 ? money(invoice.currency, invoice.taxTotal) : '—'} size="sm" />
            <KPICard label="Shipping" value={invoice.shippingHandlingAmount > 0 ? money(invoice.currency, invoice.shippingHandlingAmount) : '—'} size="sm" />
            <KPICard label="Adjustment" value={invoice.adjustment !== 0 ? money(invoice.currency, invoice.adjustment) : '—'} size="sm" />
            <KPICard label="Total" value={money(invoice.currency, invoice.total)} size="sm" variant="primary" icon={<DollarSign className="size-4" aria-hidden="true" />} />
            <KPICard label="Paid" value={invoice.amountPaid > 0 ? money(invoice.currency, invoice.amountPaid) : '—'} size="sm" />
            <KPICard
              label="Balance Due"
              value={money(invoice.currency, invoice.balanceDue)}
              size="sm"
              variant={invoice.balanceDue > 0 ? (invoice.isOverdue ? 'danger' : 'warning') : 'success'}
              icon={<Wallet className="size-4" aria-hidden="true" />}
            />
          </div>

          <SectionCard
            title="Invoice Details"
            actions={(
              <div className="w-48">
                <Select
                  value={invoice.invoiceStage || 'none'}
                  onChange={(v) => void changeStage(v === 'none' ? '' : v)}
                  options={[{ label: '—', value: 'none' }, ...invoiceStages.map((p) => ({ label: p.label, value: p.value }))]}
                  disabled={changingStage}
                  aria-label="Change stage"
                />
              </div>
            )}
          >
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <LinkedField label="Organization" name={invoice.organizationName} href={invoice.organizationId ? resolveAccessLink('/module/crm/marketing/organizations') + `/${invoice.organizationId}` : null} />
              <LinkedField label="Contact" name={invoice.contactName} href={invoice.contactId ? resolveAccessLink('/module/crm/marketing/contacts') + `/${invoice.contactId}` : null} />
              <LinkedField label="Sales Order" name={invoice.salesOrderNo} href={invoice.salesOrderId ? resolveAccessLink('/module/crm/sales/sales-orders') + `/${invoice.salesOrderId}` : null} />
              <ReadField label="Invoice Date" value={invoice.invoiceDate && <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />{invoice.invoiceDate}</span>} />
              <ReadField label="Due Date" value={invoice.dueDate && <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />{invoice.dueDate}</span>} />
              <ReadField label="Assigned To" value={assignedToName && <span className="inline-flex items-center gap-1.5"><User className="size-3.5 text-muted-foreground" aria-hidden="true" />{assignedToName}</span>} />
            </dl>
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SectionCard title="Billing Address">
              <p className="inline-flex items-start gap-1.5 text-sm text-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {[invoice.billingStreet, invoice.billingCity, invoice.billingState, invoice.billingCode, invoice.billingCountry].filter(Boolean).join(', ') || 'Not set'}
              </p>
            </SectionCard>
            <SectionCard title="Shipping Address">
              <p className="inline-flex items-start gap-1.5 text-sm text-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {hasShipping
                  ? [invoice.shippingStreet, invoice.shippingCity, invoice.shippingState, invoice.shippingCode, invoice.shippingCountry].filter(Boolean).join(', ')
                  : 'Same as billing'}
              </p>
            </SectionCard>
          </div>

          <SectionCard title="Terms & Conditions">
            <p className="whitespace-pre-wrap text-sm text-foreground">{invoice.termsConditions || 'None specified.'}</p>
          </SectionCard>

          <SectionCard title="Description">
            <p className="whitespace-pre-wrap text-sm text-foreground">{invoice.description || 'No description yet.'}</p>
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
              <QuoteLineItemTable lineItems={lineItems} onChange={setLineItems} products={products} taxRates={taxRates} currency={invoice.currency} priceBookItems={[]} />
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
            <EmptyState icon={<FileText className="size-8" aria-hidden="true" />} title="No stage changes recorded yet" />
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

      {tab === 'payments' && (
        <SectionCard
          title="Payments"
          description="A manual ledger of what was actually collected against this invoice - not a payment gateway."
          actions={(
            <Button size="sm" onClick={() => setRecordPaymentOpen(true)}>
              <Wallet className="mr-1.5 size-4" aria-hidden="true" />
              Record Payment
            </Button>
          )}
        >
          {paymentsLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading payments…
            </div>
          )}
          {!paymentsLoading && payments.length === 0 && (
            <EmptyState
              icon={<Wallet className="size-8" aria-hidden="true" />}
              title="No payments recorded yet"
              description={`Balance due: ${money(invoice.currency, invoice.balanceDue)}`}
              action={(
                <Button size="sm" onClick={() => setRecordPaymentOpen(true)}>
                  <Wallet className="mr-1.5 size-4" aria-hidden="true" />
                  Record Payment
                </Button>
              )}
            />
          )}
          {!paymentsLoading && payments.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {payments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{money(invoice.currency, p.amount)}{p.method ? ` · ${p.method}` : ''}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.reference ? `Ref: ${p.reference} · ` : ''}{p.createdByName || 'Unknown'} · {p.paidOn || p.createdAt}
                    </p>
                    {p.note && <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'emails' && (
        <CrmEmailTab emails={emails} loading={emailsLoading} onCompose={() => setComposeEmailOpen(true)} />
      )}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <SectionCard title="Custom Fields">
          <CustomFieldsSection
            recordTable="crm_invoices"
            recordId={Number(invoice.id)}
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

      <CreateInvoiceModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        invoice={invoice}
        invoiceStages={invoiceStages}
      />
      <RecordInvoicePaymentDialog
        isOpen={recordPaymentOpen}
        onClose={() => setRecordPaymentOpen(false)}
        onRecorded={(message) => { setNotice(message); setRecordPaymentOpen(false); void loadPayments(); onSaved() }}
        invoiceId={invoice.id}
        currency={invoice.currency}
        balanceDue={invoice.balanceDue}
      />
      <SendEmailDialog
        isOpen={composeEmailOpen}
        onClose={() => setComposeEmailOpen(false)}
        onSent={(message) => { setNotice(message); setComposeEmailOpen(false); void loadEmails() }}
        linkedType="INVOICE"
        linkedId={invoice.id}
      />
    </div>
  )
}
