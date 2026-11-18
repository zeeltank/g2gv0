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
import type { CrmPicklistValue, Organization, OrganizationPayload } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  organization: Organization | null
  /** Every other organization, for the parent picker - excludes `organization` itself when editing. */
  parentOptions?: Organization[]
  picklists: { accountType: CrmPicklistValue[]; industry: CrmPicklistValue[]; rating: CrmPicklistValue[] }
}

const EMPTY: OrganizationPayload = {
  name: '', accountType: '', industry: '', rating: '', ownership: '', annualRevenue: null,
  employees: null, phone: '', secondaryPhone: '', email: '', secondaryEmail: '', website: '', fax: '',
  emailOptOut: false, billingStreet: '', billingCity: '', billingState: '', billingCountry: '', billingCode: '', billingPoBox: '',
  description: '', assignedTo: '', parentId: null,
}

export function CreateOrganizationModal({ isOpen, onClose, onSaved, organization, parentOptions = [], picklists }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)

  const [seededFrom, setSeededFrom] = useState<Organization | null | 'unset'>('unset')
  const [form, setForm] = useState<OrganizationPayload>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== organization) {
    setSeededFrom(organization)
    setForm(organization
      ? {
          name: organization.name, accountType: organization.accountType ?? '', industry: organization.industry ?? '',
          rating: organization.rating ?? '', ownership: organization.ownership ?? '', annualRevenue: organization.annualRevenue,
          employees: organization.employees, phone: organization.phone ?? '', secondaryPhone: organization.secondaryPhone ?? '',
          email: organization.email ?? '', secondaryEmail: organization.secondaryEmail ?? '', website: organization.website ?? '',
          fax: organization.fax ?? '', emailOptOut: organization.emailOptOut,
          billingStreet: organization.billingStreet ?? '', billingCity: organization.billingCity ?? '',
          billingState: organization.billingState ?? '', billingCountry: organization.billingCountry ?? '',
          billingCode: organization.billingCode ?? '', billingPoBox: organization.billingPoBox ?? '',
          description: organization.description ?? '', assignedTo: organization.assignedTo ?? '', parentId: organization.parentId,
        }
      : EMPTY)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof OrganizationPayload>(key: K, value: OrganizationPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.name?.trim() || !form.assignedTo) {
      setError('Organization Name and Assigned To are required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = organization
        ? await crmService.updateOrganization(context, organization.id, form)
        : await crmService.createOrganization(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that organization.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{organization ? 'Edit Organization' : 'New Organization'}</DialogTitle>
          <DialogDescription>{organization ? 'Update this organization’s details.' : 'A company your leads, contacts, and campaigns belong to.'}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Organization Name *</Label>
            <Input id="org-name" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>

          {parentOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label>Member Of</Label>
              <SearchableSelect
                value={form.parentId ?? ''}
                onChange={(v) => set('parentId', v || null)}
                options={parentOptions.map((o) => ({ value: o.id, label: o.name }))}
                placeholder="No parent organization"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.accountType || 'none'}
                onChange={(v) => set('accountType', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.accountType.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select
                value={form.industry || 'none'}
                onChange={(v) => set('industry', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.industry.map((p) => ({ label: p.label, value: p.value }))]}
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
            <div className="space-y-1.5">
              <Label htmlFor="org-employees">Employees</Label>
              <Input id="org-employees" type="number" value={form.employees ?? ''} onChange={(e) => set('employees', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-phone">Primary Phone</Label>
              <Input id="org-phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-email">Primary Email</Label>
              <Input id="org-email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-website">Website</Label>
              <Input id="org-website" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-revenue">Annual Revenue</Label>
              <Input id="org-revenue" type="number" value={form.annualRevenue ?? ''} onChange={(e) => set('annualRevenue', e.target.value === '' ? null : Number(e.target.value))} />
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
              <Label htmlFor="org-billing-city">Billing City</Label>
              <Input id="org-billing-city" value={form.billingCity ?? ''} onChange={(e) => set('billingCity', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-billing-state">Billing State</Label>
              <Input id="org-billing-state" value={form.billingState ?? ''} onChange={(e) => set('billingState', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-billing-country">Billing Country</Label>
              <Input id="org-billing-country" value={form.billingCountry ?? ''} onChange={(e) => set('billingCountry', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-billing-code">Billing Postal Code</Label>
              <Input id="org-billing-code" value={form.billingCode ?? ''} onChange={(e) => set('billingCode', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-description">Description</Label>
            <Textarea id="org-description" rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.name?.trim()}>
            {submitting ? 'Saving…' : organization ? 'Save Changes' : 'Create Organization'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
