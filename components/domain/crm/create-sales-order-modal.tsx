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
import type { CrmPicklistValue, CrmSalesOrder, CrmSalesOrderPayload } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'
import { useOrganizationOptions } from './organization-options'
import { useContactOptions } from './contact-options'
import { useOpportunityOptions } from './opportunity-options'

export interface SalesOrderPrefill {
  organizationId?: string | null
  contactId?: string | null
  opportunityId?: string | null
  quoteId?: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  salesOrder: CrmSalesOrder | null
  prefill?: SalesOrderPrefill
  soStages: CrmPicklistValue[]
  /**
   * When set (and `salesOrder` is null), submit calls the from-quote
   * conversion endpoint instead of the plain create endpoint - the
   * lighter-weight "Create from Quote" entry point. Only `subject` is
   * editable in that mode; every other field is copied server-side from
   * the source quote, so the rest of this form stays hidden.
   */
  prefillFromQuoteId?: string | null
}

const emptyForm = (prefill: SalesOrderPrefill | undefined, soStages: CrmPicklistValue[]): CrmSalesOrderPayload => ({
  subject: '', organizationId: prefill?.organizationId ?? null, contactId: prefill?.contactId ?? null,
  opportunityId: prefill?.opportunityId ?? null, quoteId: prefill?.quoteId ?? null,
  soStage: soStages.find((s) => s.isDefault)?.value ?? soStages[0]?.value ?? '',
  dueDate: '', carrier: '', currency: '',
  billingStreet: '', billingCity: '', billingState: '', billingCode: '', billingCountry: '', billingPoBox: '',
  shippingStreet: '', shippingCity: '', shippingState: '', shippingCode: '', shippingCountry: '', shippingPoBox: '',
  termsConditions: '', description: '', assignedTo: '',
})

export function CreateSalesOrderModal({ isOpen, onClose, onSaved, salesOrder, prefill, soStages, prefillFromQuoteId }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const organizations = useOrganizationOptions(context, isOpen)
  const contacts = useContactOptions(context, isOpen)
  const opportunities = useOpportunityOptions(context, isOpen)

  const isFromQuote = !salesOrder && !!prefillFromQuoteId

  const [seededFrom, setSeededFrom] = useState<CrmSalesOrder | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmSalesOrderPayload>(emptyForm(prefill, soStages))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== salesOrder) {
    setSeededFrom(salesOrder)
    setForm(salesOrder
      ? {
          subject: salesOrder.subject, organizationId: salesOrder.organizationId, contactId: salesOrder.contactId,
          opportunityId: salesOrder.opportunityId, quoteId: salesOrder.quoteId, soStage: salesOrder.soStage ?? '', dueDate: salesOrder.dueDate ?? '',
          carrier: salesOrder.carrier ?? '', currency: salesOrder.currency ?? '',
          billingStreet: salesOrder.billingStreet ?? '', billingCity: salesOrder.billingCity ?? '', billingState: salesOrder.billingState ?? '',
          billingCode: salesOrder.billingCode ?? '', billingCountry: salesOrder.billingCountry ?? '', billingPoBox: salesOrder.billingPoBox ?? '',
          shippingStreet: salesOrder.shippingStreet ?? '', shippingCity: salesOrder.shippingCity ?? '', shippingState: salesOrder.shippingState ?? '',
          shippingCode: salesOrder.shippingCode ?? '', shippingCountry: salesOrder.shippingCountry ?? '', shippingPoBox: salesOrder.shippingPoBox ?? '',
          termsConditions: salesOrder.termsConditions ?? '', description: salesOrder.description ?? '', assignedTo: salesOrder.assignedTo ?? '',
        }
      : emptyForm(prefill, soStages))
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmSalesOrderPayload>(key: K, value: CrmSalesOrderPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const copyBillingToShipping = () => setForm((f) => ({
    ...f,
    shippingStreet: f.billingStreet, shippingCity: f.billingCity, shippingState: f.billingState,
    shippingCode: f.billingCode, shippingCountry: f.billingCountry, shippingPoBox: f.billingPoBox,
  }))

  const submit = async () => {
    if (!isFromQuote && (!form.subject?.trim() || !form.assignedTo || !form.organizationId)) {
      setError('Subject, Organization and Assigned To are required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = isFromQuote && prefillFromQuoteId
        ? await crmService.createSalesOrderFromQuote(context, prefillFromQuoteId, form.subject?.trim() ? form.subject : undefined)
        : salesOrder
          ? await crmService.updateSalesOrder(context, salesOrder.id, form)
          : await crmService.createSalesOrder(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that sales order.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{salesOrder ? 'Edit Sales Order' : isFromQuote ? 'Create Sales Order from Quote' : 'New Sales Order'}</DialogTitle>
          <DialogDescription>
            {salesOrder
              ? 'Update this sales order’s header details.'
              : isFromQuote
                ? 'Organization, addresses, terms and line items are copied from the source quote - only the subject is editable here.'
                : 'Line items are added after the sales order is created.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="so-subject">Subject {!isFromQuote && '*'}</Label>
            <Input id="so-subject" value={form.subject ?? ''} onChange={(e) => set('subject', e.target.value)} placeholder={isFromQuote ? 'Defaults to the quote’s own subject' : undefined} autoFocus />
          </div>

          {!isFromQuote && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Organization *</Label>
                  <SearchableSelect
                    value={form.organizationId ?? ''}
                    onChange={(v) => set('organizationId', v || null)}
                    options={organizations.map((o) => ({ value: o.id, label: o.name }))}
                    placeholder="Choose an organization…"
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
                  <Label>Opportunity</Label>
                  <SearchableSelect
                    value={form.opportunityId ?? ''}
                    onChange={(v) => set('opportunityId', v || null)}
                    options={opportunities.map((o) => ({ value: o.id, label: o.name }))}
                    placeholder="No opportunity"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Assigned To *</Label>
                  <SearchableSelect
                    value={form.assignedTo ?? ''}
                    onChange={(v) => set('assignedTo', v)}
                    options={employees.map((e) => ({ value: e.id, label: e.name }))}
                    placeholder="Choose an employee…"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <Select
                    value={form.soStage || 'none'}
                    onChange={(v) => set('soStage', v === 'none' ? '' : v)}
                    options={[{ label: '—', value: 'none' }, ...soStages.map((p) => ({ label: p.label, value: p.value }))]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="so-due-date">Due Date</Label>
                  <Input id="so-due-date" type="date" value={form.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="so-currency">Currency</Label>
                  <Input id="so-currency" value={form.currency ?? ''} onChange={(e) => set('currency', e.target.value)} placeholder="USD" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="so-carrier">Carrier</Label>
                <Input id="so-carrier" value={form.carrier ?? ''} onChange={(e) => set('carrier', e.target.value)} placeholder="e.g. FedEx, UPS" />
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
                  <Label htmlFor="so-shipping-handling">Shipping &amp; Handling</Label>
                  <Input id="so-shipping-handling" type="number" step="0.01" value={form.shippingHandlingAmount ?? ''} onChange={(e) => set('shippingHandlingAmount', e.target.value === '' ? undefined : Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="so-adjustment">Adjustment</Label>
                  <Input id="so-adjustment" type="number" step="0.01" value={form.adjustment ?? ''} onChange={(e) => set('adjustment', e.target.value === '' ? undefined : Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="so-terms">Terms &amp; Conditions</Label>
                <Textarea id="so-terms" rows={3} value={form.termsConditions ?? ''} onChange={(e) => set('termsConditions', e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="so-description">Description</Label>
                <Textarea id="so-description" rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
              </div>
            </>
          )}

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || (!isFromQuote && !form.subject?.trim())}>
            {submitting ? 'Saving…' : salesOrder ? 'Save Changes' : isFromQuote ? 'Create Sales Order' : 'Create Sales Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
