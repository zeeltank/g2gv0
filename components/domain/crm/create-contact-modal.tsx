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
import type { Contact, ContactPayload, CrmPicklistValue } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'
import { useOrganizationOptions } from './organization-options'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  contact: Contact | null
  picklists: { salutation: CrmPicklistValue[]; leadSource: CrmPicklistValue[] }
}

const EMPTY: ContactPayload = {
  salutation: '', firstName: '', lastName: '', title: '', department: '', email: '', secondaryEmail: '',
  phone: '', mobile: '', fax: '', leadSource: '', doNotCall: false, emailOptOut: false,
  mailingStreet: '', mailingCity: '', mailingState: '', mailingCountry: '', mailingCode: '', mailingPoBox: '',
  description: '', assignedTo: '', organizationId: null,
}

export function CreateContactModal({ isOpen, onClose, onSaved, contact, picklists }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const organizations = useOrganizationOptions(context, isOpen)

  const [seededFrom, setSeededFrom] = useState<Contact | null | 'unset'>('unset')
  const [form, setForm] = useState<ContactPayload>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== contact) {
    setSeededFrom(contact)
    setForm(contact
      ? {
          salutation: contact.salutation ?? '', firstName: contact.firstName ?? '', lastName: contact.lastName,
          title: contact.title ?? '', department: contact.department ?? '', email: contact.email ?? '',
          secondaryEmail: contact.secondaryEmail ?? '', phone: contact.phone ?? '', mobile: contact.mobile ?? '',
          fax: contact.fax ?? '', leadSource: contact.leadSource ?? '', doNotCall: contact.doNotCall, emailOptOut: contact.emailOptOut,
          mailingStreet: contact.mailingStreet ?? '', mailingCity: contact.mailingCity ?? '', mailingState: contact.mailingState ?? '',
          mailingCountry: contact.mailingCountry ?? '', mailingCode: contact.mailingCode ?? '', mailingPoBox: contact.mailingPoBox ?? '',
          description: contact.description ?? '', assignedTo: contact.assignedTo ?? '', organizationId: contact.organizationId,
        }
      : EMPTY)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof ContactPayload>(key: K, value: ContactPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

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
      const response = contact
        ? await crmService.updateContact(context, contact.id, form)
        : await crmService.createContact(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that contact.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{contact ? 'Edit Contact' : 'New Contact'}</DialogTitle>
          <DialogDescription>{contact ? 'Update this contact’s details.' : 'A person at an organization you work with.'}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr_1fr]">
            <div className="space-y-1.5">
              <Label>Salutation</Label>
              <Select
                value={form.salutation || 'none'}
                onChange={(v) => set('salutation', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.salutation.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-first-name">First Name</Label>
              <Input id="contact-first-name" value={form.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-last-name">Last Name *</Label>
              <Input id="contact-last-name" value={form.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)} autoFocus />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Organization</Label>
            <SearchableSelect
              value={form.organizationId ?? ''}
              onChange={(v) => set('organizationId', v || null)}
              options={organizations.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="No organization"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-title">Title</Label>
              <Input id="contact-title" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-department">Department</Label>
              <Input id="contact-department" value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Primary Email</Label>
              <Input id="contact-email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-secondary-email">Secondary Email</Label>
              <Input id="contact-secondary-email" type="email" value={form.secondaryEmail ?? ''} onChange={(e) => set('secondaryEmail', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input id="contact-phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-mobile">Mobile</Label>
              <Input id="contact-mobile" value={form.mobile ?? ''} onChange={(e) => set('mobile', e.target.value)} />
            </div>
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
              <Label htmlFor="contact-city">Mailing City</Label>
              <Input id="contact-city" value={form.mailingCity ?? ''} onChange={(e) => set('mailingCity', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-state">Mailing State</Label>
              <Input id="contact-state" value={form.mailingState ?? ''} onChange={(e) => set('mailingState', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-description">Description</Label>
            <Textarea id="contact-description" rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="contact-do-not-call" className="cursor-pointer">Do Not Call</Label>
            <Switch id="contact-do-not-call" checked={!!form.doNotCall} onChange={(e) => set('doNotCall', e.target.checked)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.lastName?.trim()}>
            {submitting ? 'Saving…' : contact ? 'Save Changes' : 'Create Contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
