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
import type { CrmPicklistValue, CrmQuote, CrmQuotePayload } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'
import { useOrganizationOptions } from './organization-options'
import { useContactOptions } from './contact-options'
import { useOpportunityOptions } from './opportunity-options'

export interface QuotePrefill {
  organizationId?: string | null
  contactId?: string | null
  opportunityId?: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  quote: CrmQuote | null
  prefill?: QuotePrefill
  quoteStages: CrmPicklistValue[]
}

const emptyForm = (prefill: QuotePrefill | undefined, quoteStages: CrmPicklistValue[]): CrmQuotePayload => ({
  subject: '', organizationId: prefill?.organizationId ?? null, contactId: prefill?.contactId ?? null,
  opportunityId: prefill?.opportunityId ?? null,
  quoteStage: quoteStages.find((s) => s.isDefault)?.value ?? quoteStages[0]?.value ?? '',
  validTill: '', currency: '',
  billingStreet: '', billingCity: '', billingState: '', billingCode: '', billingCountry: '', billingPoBox: '',
  shippingStreet: '', shippingCity: '', shippingState: '', shippingCode: '', shippingCountry: '', shippingPoBox: '',
  termsConditions: '', description: '', assignedTo: '',
})

export function CreateQuoteModal({ isOpen, onClose, onSaved, quote, prefill, quoteStages }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const organizations = useOrganizationOptions(context, isOpen)
  const contacts = useContactOptions(context, isOpen)
  const opportunities = useOpportunityOptions(context, isOpen)

  const [seededFrom, setSeededFrom] = useState<CrmQuote | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmQuotePayload>(emptyForm(prefill, quoteStages))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== quote) {
    setSeededFrom(quote)
    setForm(quote
      ? {
          subject: quote.subject, organizationId: quote.organizationId, contactId: quote.contactId,
          opportunityId: quote.opportunityId, quoteStage: quote.quoteStage ?? '', validTill: quote.validTill ?? '',
          currency: quote.currency ?? '',
          billingStreet: quote.billingStreet ?? '', billingCity: quote.billingCity ?? '', billingState: quote.billingState ?? '',
          billingCode: quote.billingCode ?? '', billingCountry: quote.billingCountry ?? '', billingPoBox: quote.billingPoBox ?? '',
          shippingStreet: quote.shippingStreet ?? '', shippingCity: quote.shippingCity ?? '', shippingState: quote.shippingState ?? '',
          shippingCode: quote.shippingCode ?? '', shippingCountry: quote.shippingCountry ?? '', shippingPoBox: quote.shippingPoBox ?? '',
          termsConditions: quote.termsConditions ?? '', description: quote.description ?? '', assignedTo: quote.assignedTo ?? '',
        }
      : emptyForm(prefill, quoteStages))
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmQuotePayload>(key: K, value: CrmQuotePayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const copyBillingToShipping = () => setForm((f) => ({
    ...f,
    shippingStreet: f.billingStreet, shippingCity: f.billingCity, shippingState: f.billingState,
    shippingCode: f.billingCode, shippingCountry: f.billingCountry, shippingPoBox: f.billingPoBox,
  }))

  const submit = async () => {
    if (!form.subject?.trim() || !form.assignedTo) {
      setError('Subject and Assigned To are required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = quote
        ? await crmService.updateQuote(context, quote.id, form)
        : await crmService.createQuote(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that quote.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{quote ? 'Edit Quote' : 'New Quote'}</DialogTitle>
          <DialogDescription>{quote ? 'Update this quote’s header details.' : 'Line items are added after the quote is created.'}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="quote-subject">Subject *</Label>
            <Input id="quote-subject" value={form.subject ?? ''} onChange={(e) => set('subject', e.target.value)} autoFocus />
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
                value={form.quoteStage || 'none'}
                onChange={(v) => set('quoteStage', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...quoteStages.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-valid-till">Valid Till</Label>
              <Input id="quote-valid-till" type="date" value={form.validTill ?? ''} onChange={(e) => set('validTill', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-currency">Currency</Label>
              <Input id="quote-currency" value={form.currency ?? ''} onChange={(e) => set('currency', e.target.value)} placeholder="USD" />
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
              <Label htmlFor="quote-shipping-handling">Shipping &amp; Handling</Label>
              <Input id="quote-shipping-handling" type="number" step="0.01" value={form.shippingHandlingAmount ?? ''} onChange={(e) => set('shippingHandlingAmount', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-adjustment">Adjustment</Label>
              <Input id="quote-adjustment" type="number" step="0.01" value={form.adjustment ?? ''} onChange={(e) => set('adjustment', e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quote-terms">Terms &amp; Conditions</Label>
            <Textarea id="quote-terms" rows={3} value={form.termsConditions ?? ''} onChange={(e) => set('termsConditions', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quote-description">Description</Label>
            <Textarea id="quote-description" rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.subject?.trim()}>
            {submitting ? 'Saving…' : quote ? 'Save Changes' : 'Create Quote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
