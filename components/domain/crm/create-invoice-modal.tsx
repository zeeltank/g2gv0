'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmInvoice, CrmInvoicePayload, CrmPicklistValue } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'
import { useOrganizationOptions } from './organization-options'
import { useContactOptions } from './contact-options'

export interface InvoicePrefill {
  organizationId?: string | null
  contactId?: string | null
  salesOrderId?: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  invoice: CrmInvoice | null
  prefill?: InvoicePrefill
  invoiceStages: CrmPicklistValue[]
  /** When set (and `invoice` is null), submitting hits POST /crm/invoices/from-sales-order/{id} instead of a plain create - the header fields + line items are copied server-side from that Sales Order. */
  prefillFromSalesOrderId?: string | null
}

const emptyForm = (prefill: InvoicePrefill | undefined, invoiceStages: CrmPicklistValue[]): CrmInvoicePayload => ({
  subject: '', organizationId: prefill?.organizationId ?? null, contactId: prefill?.contactId ?? null,
  salesOrderId: prefill?.salesOrderId ?? null,
  invoiceStage: invoiceStages.find((s) => s.isDefault)?.value ?? '',
  invoiceDate: '', dueDate: '', currency: '',
  billingStreet: '', billingCity: '', billingState: '', billingCode: '', billingCountry: '', billingPoBox: '',
  shippingStreet: '', shippingCity: '', shippingState: '', shippingCode: '', shippingCountry: '', shippingPoBox: '',
  termsConditions: '', description: '', assignedTo: '',
})

export function CreateInvoiceModal({ isOpen, onClose, onSaved, invoice, prefill, invoiceStages, prefillFromSalesOrderId }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const organizations = useOrganizationOptions(context, isOpen)
  const contacts = useContactOptions(context, isOpen)

  const [seededFrom, setSeededFrom] = useState<CrmInvoice | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmInvoicePayload>(emptyForm(prefill, invoiceStages))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== invoice) {
    setSeededFrom(invoice)
    setForm(invoice
      ? {
          subject: invoice.subject, organizationId: invoice.organizationId, contactId: invoice.contactId,
          salesOrderId: invoice.salesOrderId, invoiceStage: invoice.invoiceStage ?? '', invoiceDate: invoice.invoiceDate ?? '',
          dueDate: invoice.dueDate ?? '', currency: invoice.currency ?? '',
          billingStreet: invoice.billingStreet ?? '', billingCity: invoice.billingCity ?? '', billingState: invoice.billingState ?? '',
          billingCode: invoice.billingCode ?? '', billingCountry: invoice.billingCountry ?? '', billingPoBox: invoice.billingPoBox ?? '',
          shippingStreet: invoice.shippingStreet ?? '', shippingCity: invoice.shippingCity ?? '', shippingState: invoice.shippingState ?? '',
          shippingCode: invoice.shippingCode ?? '', shippingCountry: invoice.shippingCountry ?? '', shippingPoBox: invoice.shippingPoBox ?? '',
          termsConditions: invoice.termsConditions ?? '', description: invoice.description ?? '', assignedTo: invoice.assignedTo ?? '',
        }
      : emptyForm(prefill, invoiceStages))
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmInvoicePayload>(key: K, value: CrmInvoicePayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const copyBillingToShipping = () => setForm((f) => ({
    ...f,
    shippingStreet: f.billingStreet, shippingCity: f.billingCity, shippingState: f.billingState,
    shippingCode: f.billingCode, shippingCountry: f.billingCountry, shippingPoBox: f.billingPoBox,
  }))

  const submit = async () => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    if (!invoice && prefillFromSalesOrderId) {
      // Header + line items are copied server-side from the Sales Order - no local form fields to validate here.
      setSubmitting(true)
      setError('')
      try {
        const response = await crmService.createInvoiceFromSalesOrder(context, prefillFromSalesOrderId)
        onSaved(response.message)
        onClose()
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to create this invoice from the sales order.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!form.subject?.trim() || !form.assignedTo) {
      setError('Subject and Assigned To are required.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = invoice
        ? await crmService.updateInvoice(context, invoice.id, form)
        : await crmService.createInvoice(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that invoice.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{invoice ? 'Edit Invoice' : prefillFromSalesOrderId ? 'Create Invoice From Sales Order' : 'New Invoice'}</DialogTitle>
          <DialogDescription>
            {invoice
              ? 'Update this invoice’s header details.'
              : prefillFromSalesOrderId
                ? 'Copies the sales order’s addresses, terms, and line items onto a new invoice.'
                : 'Line items are added after the invoice is created.'}
          </DialogDescription>
        </DialogHeader>

        {prefillFromSalesOrderId && !invoice ? (
          <>
            {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
            <DialogFooter className="shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => void submit()} disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Invoice'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1">
              <div className="space-y-1.5">
                <Label htmlFor="invoice-subject">Subject *</Label>
                <Input id="invoice-subject" value={form.subject ?? ''} onChange={(e) => set('subject', e.target.value)} autoFocus />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Organization</Label>
                  <SearchableSelect
                    value={form.organizationId ?? ''}
                    onChange={(v) => set('organizationId', v || null)}
                    options={organizations.map((o) => ({ value: o.id, label: o.name }))}
                    placeholder="No organization"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact</Label>
                  <SearchableSelect
                    value={form.contactId ?? ''}
                    onChange={(v) => set('contactId', v || null)}
                    options={contacts.map((c) => ({ value: c.id, label: `${c.firstName ?? ''} ${c.lastName}`.trim() }))}
                    placeholder="No contact"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Assigned To *</Label>
                  <SearchableSelect
                    value={form.assignedTo ?? ''}
                    onChange={(v) => set('assignedTo', v)}
                    options={employees.map((e) => ({ value: e.id, label: e.name }))}
                    placeholder="Choose an employee…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <Select
                    value={form.invoiceStage || 'none'}
                    onChange={(v) => set('invoiceStage', v === 'none' ? '' : v)}
                    options={[{ label: '—', value: 'none' }, ...invoiceStages.map((p) => ({ label: p.label, value: p.value }))]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="invoice-date">Invoice Date</Label>
                  <Input id="invoice-date" type="date" value={form.invoiceDate ?? ''} onChange={(e) => set('invoiceDate', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invoice-due-date">Due Date</Label>
                  <Input id="invoice-due-date" type="date" value={form.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invoice-currency">Currency</Label>
                  <Input id="invoice-currency" value={form.currency ?? ''} onChange={(e) => set('currency', e.target.value)} placeholder="USD" />
                </div>
              </div>

              <section className="space-y-2 rounded-lg border border-border p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing Address</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input value={form.billingStreet ?? ''} onChange={(e) => set('billingStreet', e.target.value)} placeholder="Street" className="sm:col-span-2" />
                  <Input value={form.billingCity ?? ''} onChange={(e) => set('billingCity', e.target.value)} placeholder="City" />
                  <Input value={form.billingState ?? ''} onChange={(e) => set('billingState', e.target.value)} placeholder="State" />
                  <Input value={form.billingCode ?? ''} onChange={(e) => set('billingCode', e.target.value)} placeholder="Postal Code" />
                  <Input value={form.billingCountry ?? ''} onChange={(e) => set('billingCountry', e.target.value)} placeholder="Country" />
                  <Input value={form.billingPoBox ?? ''} onChange={(e) => set('billingPoBox', e.target.value)} placeholder="P.O. Box" className="sm:col-span-2" />
                </div>
              </section>

              <section className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shipping Address</h3>
                  <Button type="button" variant="ghost" size="sm" onClick={copyBillingToShipping}>Same as billing</Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input value={form.shippingStreet ?? ''} onChange={(e) => set('shippingStreet', e.target.value)} placeholder="Street" className="sm:col-span-2" />
                  <Input value={form.shippingCity ?? ''} onChange={(e) => set('shippingCity', e.target.value)} placeholder="City" />
                  <Input value={form.shippingState ?? ''} onChange={(e) => set('shippingState', e.target.value)} placeholder="State" />
                  <Input value={form.shippingCode ?? ''} onChange={(e) => set('shippingCode', e.target.value)} placeholder="Postal Code" />
                  <Input value={form.shippingCountry ?? ''} onChange={(e) => set('shippingCountry', e.target.value)} placeholder="Country" />
                  <Input value={form.shippingPoBox ?? ''} onChange={(e) => set('shippingPoBox', e.target.value)} placeholder="P.O. Box" className="sm:col-span-2" />
                </div>
              </section>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invoice-shipping-handling">Shipping &amp; Handling</Label>
                  <Input id="invoice-shipping-handling" type="number" step="0.01" value={form.shippingHandlingAmount ?? ''} onChange={(e) => set('shippingHandlingAmount', e.target.value === '' ? undefined : Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invoice-adjustment">Adjustment</Label>
                  <Input id="invoice-adjustment" type="number" step="0.01" value={form.adjustment ?? ''} onChange={(e) => set('adjustment', e.target.value === '' ? undefined : Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invoice-terms">Terms &amp; Conditions</Label>
                <Textarea id="invoice-terms" rows={3} value={form.termsConditions ?? ''} onChange={(e) => set('termsConditions', e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invoice-description">Description</Label>
                <Textarea id="invoice-description" rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
              </div>

              {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter className="shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => void submit()} disabled={submitting || !form.subject?.trim()}>
                {submitting ? 'Saving…' : invoice ? 'Save Changes' : 'Create Invoice'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
