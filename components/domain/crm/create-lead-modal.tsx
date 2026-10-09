'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmPicklistValue, Lead, LeadPayload } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  /** Non-null means editing this lead; null means creating a new one. */
  lead: Lead | null
  picklists: {
    leadStatus: CrmPicklistValue[]
    leadSource: CrmPicklistValue[]
    industry: CrmPicklistValue[]
    rating: CrmPicklistValue[]
  }
}

const EMPTY: LeadPayload = {
  firstName: '', lastName: '', company: '', email: '', secondaryEmail: '',
  phone: '', mobile: '', fax: '', website: '', industry: '', leadSource: '',
  leadStatus: '', rating: '', annualRevenue: null, numberOfEmp: '', emailOptOut: false,
  street: '', city: '', state: '', country: '', postalCode: '', poBox: '',
  description: '', assignedTo: '',
}

export function CreateLeadModal({ isOpen, onClose, onSaved, lead, picklists }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)

  const [seededFrom, setSeededFrom] = useState<Lead | null | 'unset'>('unset')
  const [form, setForm] = useState<LeadPayload>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Seed the form the moment this opens for a new lead/edit target, mirroring
  // create-task-modal.tsx's seed/seededFrom pattern (set-during-render, not
  // inside an effect, to dodge the cascading-render lint rule).
  if (isOpen && seededFrom !== lead) {
    setSeededFrom(lead)
    setForm(lead
      ? {
          firstName: lead.firstName ?? '', lastName: lead.lastName, company: lead.company ?? '',
          email: lead.email ?? '', secondaryEmail: lead.secondaryEmail ?? '', phone: lead.phone ?? '',
          mobile: lead.mobile ?? '', fax: lead.fax ?? '', website: lead.website ?? '',
          industry: lead.industry ?? '', leadSource: lead.leadSource ?? '', leadStatus: lead.leadStatus ?? '',
          rating: lead.rating ?? '', annualRevenue: lead.annualRevenue, numberOfEmp: lead.numberOfEmp ?? '',
          emailOptOut: lead.emailOptOut, street: lead.street ?? '', city: lead.city ?? '',
          state: lead.state ?? '', country: lead.country ?? '', postalCode: lead.postalCode ?? '',
          poBox: lead.poBox ?? '', description: lead.description ?? '', assignedTo: lead.assignedTo ?? '',
        }
      : EMPTY)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof LeadPayload>(key: K, value: LeadPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.lastName?.trim() || !form.assignedTo) {
      setError('Last Name and Assigned To are required.')
      return
    }

    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = lead
        ? await crmService.updateLead(context, lead.id, form)
        : await crmService.createLead(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that lead.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{lead ? 'Edit Lead' : 'New Lead'}</DialogTitle>
          <DialogDescription>
            {lead ? 'Update this lead’s details.' : 'A person or company showing early interest, not yet a customer.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-first-name">First Name</Label>
              <Input id="lead-first-name" value={form.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-last-name">Last Name *</Label>
              <Input id="lead-last-name" value={form.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)} autoFocus />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-company">Company</Label>
            <Input id="lead-company" value={form.company ?? ''} onChange={(e) => set('company', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Primary Email</Label>
              <Input id="lead-email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-secondary-email">Secondary Email</Label>
              <Input id="lead-secondary-email" type="email" value={form.secondaryEmail ?? ''} onChange={(e) => set('secondaryEmail', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input id="lead-phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-mobile">Mobile</Label>
              <Input id="lead-mobile" value={form.mobile ?? ''} onChange={(e) => set('mobile', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select
                value={form.industry || 'none'}
                onChange={(v) => set('industry', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.industry.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lead Source</Label>
              <Select
                value={form.leadSource || 'none'}
                onChange={(v) => set('leadSource', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.leadSource.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lead Status</Label>
              <Select
                value={form.leadStatus || 'none'}
                onChange={(v) => set('leadStatus', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.leadStatus.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rating</Label>
              <Select
                value={form.rating || 'none'}
                onChange={(v) => set('rating', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.rating.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-website">Website</Label>
              <Input id="lead-website" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-annual-revenue">Annual Revenue</Label>
              <Input
                id="lead-annual-revenue" type="number" value={form.annualRevenue ?? ''}
                onChange={(e) => set('annualRevenue', e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-city">City</Label>
              <Input id="lead-city" value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-state">State</Label>
              <Input id="lead-state" value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-country">Country</Label>
              <Input id="lead-country" value={form.country ?? ''} onChange={(e) => set('country', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-postal">Postal Code</Label>
              <Input id="lead-postal" value={form.postalCode ?? ''} onChange={(e) => set('postalCode', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-description">Description</Label>
            <Textarea id="lead-description" rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="lead-email-opt-out" className="cursor-pointer">Email Opt Out</Label>
            <Switch id="lead-email-opt-out" checked={!!form.emailOptOut} onChange={(e) => set('emailOptOut', e.target.checked)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.lastName?.trim()}>
            {submitting ? 'Saving…' : lead ? 'Save Changes' : 'Create Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
