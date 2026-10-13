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
import type { CrmPicklistValue, CrmPurchaseOrder, CrmPurchaseOrderPayload } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'
import { useVendorOptions } from './vendor-options'
import { useOrganizationOptions } from './organization-options'
import { useContactOptions } from './contact-options'
import { useQuoteOptions } from './quote-options'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  purchaseOrder: CrmPurchaseOrder | null
  poStages: CrmPicklistValue[]
  /** Set only when opened from a Quote's own "Convert to Purchase Order" action - the header and every line item are copied server-side (POST /crm/purchase-orders/from-quote/{id}); Quotes have no vendor concept, so this smaller form only collects the one thing that conversion can't carry over. */
  prefillFromQuoteId?: string | null
}

const emptyForm = (poStages: CrmPicklistValue[]): CrmPurchaseOrderPayload => ({
  subject: '', vendorId: null, organizationId: null, contactId: null, quoteId: null,
  poStage: poStages.find((s) => s.isDefault)?.value ?? poStages[0]?.value ?? '',
  requisitionNo: '', trackingNo: '', dueDate: '', currency: '',
  billingStreet: '', billingCity: '', billingState: '', billingCode: '', billingCountry: '', billingPoBox: '',
  shippingStreet: '', shippingCity: '', shippingState: '', shippingCode: '', shippingCountry: '', shippingPoBox: '',
  termsConditions: '', description: '', assignedTo: '',
})

/** The short convenience form shown when converting a Quote - just the Vendor the conversion itself can't fill in. */
function ConvertFromQuoteForm({ onClose, onSaved, quoteId }: { onClose: () => void; onSaved: (message: string) => void; quoteId: string }) {
  const context = useMemo(() => getLaravelContext(), [])
  const vendors = useVendorOptions(context, true)
  const [vendorId, setVendorId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await crmService.createPurchaseOrderFromQuote(context, quoteId)
      if (vendorId) {
        await crmService.updatePurchaseOrder(context, response.data.id, { vendorId })
      }
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create this purchase order.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">The subject, addresses, terms and every line item are copied from the quote. Pick the vendor to purchase from - quotes have no vendor of their own to copy.</p>
        <div className="space-y-1.5">
          <Label>Vendor *</Label>
          <SearchableSelect
            value={vendorId}
            onChange={setVendorId}
            options={vendors.map((v) => ({ value: v.id, label: v.name }))}
            placeholder="Choose a vendor…"
          />
          <p className="text-xs text-muted-foreground">You can also set this later from the purchase order&apos;s own page.</p>
        </div>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => void submit()} disabled={submitting}>{submitting ? 'Creating…' : 'Create Purchase Order'}</Button>
      </DialogFooter>
    </>
  )
}

export function CreatePurchaseOrderModal({ isOpen, onClose, onSaved, purchaseOrder, poStages, prefillFromQuoteId }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const vendors = useVendorOptions(context, isOpen)
  const organizations = useOrganizationOptions(context, isOpen)
  const contacts = useContactOptions(context, isOpen)
  const quotes = useQuoteOptions(context, isOpen)

  const [seededFrom, setSeededFrom] = useState<CrmPurchaseOrder | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmPurchaseOrderPayload>(emptyForm(poStages))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== purchaseOrder) {
    setSeededFrom(purchaseOrder)
    setForm(purchaseOrder
      ? {
          subject: purchaseOrder.subject, vendorId: purchaseOrder.vendorId, organizationId: purchaseOrder.organizationId,
          contactId: purchaseOrder.contactId, quoteId: purchaseOrder.quoteId, poStage: purchaseOrder.poStage ?? '',
          requisitionNo: purchaseOrder.requisitionNo ?? '', trackingNo: purchaseOrder.trackingNo ?? '', dueDate: purchaseOrder.dueDate ?? '',
          currency: purchaseOrder.currency ?? '',
          billingStreet: purchaseOrder.billingStreet ?? '', billingCity: purchaseOrder.billingCity ?? '', billingState: purchaseOrder.billingState ?? '',
          billingCode: purchaseOrder.billingCode ?? '', billingCountry: purchaseOrder.billingCountry ?? '', billingPoBox: purchaseOrder.billingPoBox ?? '',
          shippingStreet: purchaseOrder.shippingStreet ?? '', shippingCity: purchaseOrder.shippingCity ?? '', shippingState: purchaseOrder.shippingState ?? '',
          shippingCode: purchaseOrder.shippingCode ?? '', shippingCountry: purchaseOrder.shippingCountry ?? '', shippingPoBox: purchaseOrder.shippingPoBox ?? '',
          termsConditions: purchaseOrder.termsConditions ?? '', description: purchaseOrder.description ?? '', assignedTo: purchaseOrder.assignedTo ?? '',
        }
      : emptyForm(poStages))
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmPurchaseOrderPayload>(key: K, value: CrmPurchaseOrderPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const copyBillingToShipping = () => setForm((f) => ({
    ...f,
    shippingStreet: f.billingStreet, shippingCity: f.billingCity, shippingState: f.billingState,
    shippingCode: f.billingCode, shippingCountry: f.billingCountry, shippingPoBox: f.billingPoBox,
  }))

  const submit = async () => {
    if (!form.subject?.trim() || !form.vendorId || !form.assignedTo) {
      setError('Subject, Vendor and Assigned To are required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = purchaseOrder
        ? await crmService.updatePurchaseOrder(context, purchaseOrder.id, form)
        : await crmService.createPurchaseOrder(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that purchase order.')
    } finally {
      setSubmitting(false)
    }
  }

  const isConvertingFromQuote = !purchaseOrder && !!prefillFromQuoteId

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{purchaseOrder ? 'Edit Purchase Order' : isConvertingFromQuote ? 'Create Purchase Order from Quote' : 'New Purchase Order'}</DialogTitle>
          <DialogDescription>
            {purchaseOrder ? 'Update this purchase order’s header details.' : isConvertingFromQuote ? 'The quote’s header and line items are copied over.' : 'Line items are added after the purchase order is created.'}
          </DialogDescription>
        </DialogHeader>

        {isConvertingFromQuote && prefillFromQuoteId
          ? <ConvertFromQuoteForm onClose={onClose} onSaved={onSaved} quoteId={prefillFromQuoteId} />
          : (
            <>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1">
                <div className="space-y-1.5">
                  <Label htmlFor="po-subject">Subject *</Label>
                  <Input id="po-subject" value={form.subject ?? ''} onChange={(e) => set('subject', e.target.value)} autoFocus />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Vendor *</Label>
                    <SearchableSelect
                      value={form.vendorId ?? ''}
                      onChange={(v) => set('vendorId', v || null)}
                      options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                      placeholder="Choose a vendor…"
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

                <div className="space-y-1.5">
                  <Label>Quote</Label>
                  <SearchableSelect
                    value={form.quoteId ?? ''}
                    onChange={(v) => set('quoteId', v || null)}
                    options={quotes.map((q) => ({ value: q.id, label: `${q.quoteNo ?? ''} ${q.subject}`.trim() }))}
                    placeholder="No quote"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Stage</Label>
                    <Select
                      value={form.poStage || 'none'}
                      onChange={(v) => set('poStage', v === 'none' ? '' : v)}
                      options={[{ label: '—', value: 'none' }, ...poStages.map((p) => ({ label: p.label, value: p.value }))]}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="po-due-date">Due Date</Label>
                    <Input id="po-due-date" type="date" value={form.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="po-currency">Currency</Label>
                    <Input id="po-currency" value={form.currency ?? ''} onChange={(e) => set('currency', e.target.value)} placeholder="USD" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="po-requisition-no">Requisition No.</Label>
                    <Input id="po-requisition-no" value={form.requisitionNo ?? ''} onChange={(e) => set('requisitionNo', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="po-tracking-no">Tracking No.</Label>
                    <Input id="po-tracking-no" value={form.trackingNo ?? ''} onChange={(e) => set('trackingNo', e.target.value)} />
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
                    <Label htmlFor="po-shipping-handling">Shipping &amp; Handling</Label>
                    <Input id="po-shipping-handling" type="number" step="0.01" value={form.shippingHandlingAmount ?? ''} onChange={(e) => set('shippingHandlingAmount', e.target.value === '' ? undefined : Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="po-adjustment">Adjustment</Label>
                    <Input id="po-adjustment" type="number" step="0.01" value={form.adjustment ?? ''} onChange={(e) => set('adjustment', e.target.value === '' ? undefined : Number(e.target.value))} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="po-terms">Terms &amp; Conditions</Label>
                  <Textarea id="po-terms" rows={3} value={form.termsConditions ?? ''} onChange={(e) => set('termsConditions', e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="po-description">Description</Label>
                  <Textarea id="po-description" rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
                </div>

                {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
              </div>

              <DialogFooter className="shrink-0">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={() => void submit()} disabled={submitting || !form.subject?.trim() || !form.vendorId}>
                  {submitting ? 'Saving…' : purchaseOrder ? 'Save Changes' : 'Create Purchase Order'}
                </Button>
              </DialogFooter>
            </>
          )}
      </DialogContent>
    </Dialog>
  )
}
