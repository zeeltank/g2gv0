'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmVendor, CrmVendorPayload } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  vendor: CrmVendor | null
}

const EMPTY: CrmVendorPayload = {
  name: '', phone: '', email: '', website: '', glAccount: '', category: '',
  street: '', city: '', state: '', country: '', postalCode: '', poBox: '',
  description: '', isActive: true, assignedTo: '',
}

export function CreateVendorModal({ isOpen, onClose, onSaved, vendor }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)

  const [seededFrom, setSeededFrom] = useState<CrmVendor | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmVendorPayload>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== vendor) {
    setSeededFrom(vendor)
    setForm(vendor
      ? {
          name: vendor.name, phone: vendor.phone ?? '', email: vendor.email ?? '', website: vendor.website ?? '',
          glAccount: vendor.glAccount ?? '', category: vendor.category ?? '', street: vendor.street ?? '',
          city: vendor.city ?? '', state: vendor.state ?? '', country: vendor.country ?? '',
          postalCode: vendor.postalCode ?? '', poBox: vendor.poBox ?? '', description: vendor.description ?? '',
          isActive: vendor.isActive, assignedTo: vendor.assignedTo ?? '',
        }
      : EMPTY)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmVendorPayload>(key: K, value: CrmVendorPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.name?.trim() || !form.assignedTo) {
      setError('Vendor Name and Assigned To are required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = vendor
        ? await crmService.updateVendor(context, vendor.id, form)
        : await crmService.createVendor(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that vendor.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{vendor ? 'Edit Vendor' : 'New Vendor'}</DialogTitle>
          <DialogDescription>{vendor ? 'Update this vendor’s details.' : 'A supplier you buy products or services from.'}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="vendor-name">Vendor Name *</Label>
            <Input id="vendor-name" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vendor-category">Category</Label>
              <Input id="vendor-category" value={form.category ?? ''} onChange={(e) => set('category', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-gl-account">GL Account</Label>
              <Input id="vendor-gl-account" value={form.glAccount ?? ''} onChange={(e) => set('glAccount', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vendor-phone">Phone</Label>
              <Input id="vendor-phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-email">Email</Label>
              <Input id="vendor-email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-website">Website</Label>
              <Input id="vendor-website" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <SearchableSelect
                value={form.isActive === false ? 'inactive' : 'active'}
                onChange={(v) => set('isActive', v !== 'inactive')}
                options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="vendor-street">Street</Label>
              <Input id="vendor-street" value={form.street ?? ''} onChange={(e) => set('street', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-city">City</Label>
              <Input id="vendor-city" value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-state">State</Label>
              <Input id="vendor-state" value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-country">Country</Label>
              <Input id="vendor-country" value={form.country ?? ''} onChange={(e) => set('country', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-postal-code">Postal Code</Label>
              <Input id="vendor-postal-code" value={form.postalCode ?? ''} onChange={(e) => set('postalCode', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-po-box">PO Box</Label>
              <Input id="vendor-po-box" value={form.poBox ?? ''} onChange={(e) => set('poBox', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vendor-description">Description</Label>
            <Textarea id="vendor-description" rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.name?.trim()}>
            {submitting ? 'Saving…' : vendor ? 'Save Changes' : 'Create Vendor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
