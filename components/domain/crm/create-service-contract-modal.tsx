'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmPicklistValue, CrmServiceContract, CrmServiceContractPayload } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'
import { useOrganizationOptions } from './organization-options'
import { useContactOptions } from './contact-options'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  serviceContract: CrmServiceContract | null
  picklists: {
    contractStatus: CrmPicklistValue[]
    contractType: CrmPicklistValue[]
    priority: CrmPicklistValue[]
    trackingUnit: CrmPicklistValue[]
  }
}

const emptyForm = (contractStatuses: CrmPicklistValue[]): CrmServiceContractPayload => ({
  subject: '', organizationId: null, contactId: null,
  startDate: '', endDate: '', dueDate: '',
  trackingUnit: '', totalUnits: null,
  contractStatus: contractStatuses.find((s) => s.isDefault)?.value ?? contractStatuses[0]?.value ?? 'In Planning',
  contractType: '', priority: '', assignedTo: '',
})

export function CreateServiceContractModal({ isOpen, onClose, onSaved, serviceContract, picklists }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const organizations = useOrganizationOptions(context, isOpen)
  const contacts = useContactOptions(context, isOpen)

  const [seededFrom, setSeededFrom] = useState<CrmServiceContract | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmServiceContractPayload>(emptyForm(picklists.contractStatus))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== serviceContract) {
    setSeededFrom(serviceContract)
    setForm(serviceContract
      ? {
          subject: serviceContract.subject, organizationId: serviceContract.organizationId, contactId: serviceContract.contactId,
          startDate: serviceContract.startDate ?? '', endDate: serviceContract.endDate ?? '', dueDate: serviceContract.dueDate ?? '',
          trackingUnit: serviceContract.trackingUnit ?? '', totalUnits: serviceContract.totalUnits,
          contractStatus: serviceContract.contractStatus ?? '', contractType: serviceContract.contractType ?? '',
          priority: serviceContract.priority ?? '', assignedTo: serviceContract.assignedTo ?? '',
        }
      : emptyForm(picklists.contractStatus))
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmServiceContractPayload>(key: K, value: CrmServiceContractPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  /**
   * Editing an existing contract whose trackingUnit differs from what is
   * already stored - and which already has recorded usage - would otherwise
   * round-trip into the backend's own immutability guard as a 422 on Save.
   * Disabling the field here instead of just catching that error after the
   * fact keeps the user from making an edit that was never going to stick.
   */
  const trackingUnitLocked = !!serviceContract && (serviceContract.usedUnits ?? 0) > 0

  const submit = async () => {
    if (!form.subject?.trim()) {
      setError('Subject is required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = serviceContract
        ? await crmService.updateServiceContract(context, serviceContract.id, form)
        : await crmService.createServiceContract(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that service contract.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{serviceContract ? 'Edit Service Contract' : 'New Service Contract'}</DialogTitle>
          <DialogDescription>
            {serviceContract ? 'Update this service contract.' : 'A support-hours or incidents bucket tracked against a date range.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="sc-subject">Subject *</Label>
            <Input id="sc-subject" value={form.subject ?? ''} onChange={(e) => set('subject', e.target.value)} autoFocus />
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <SearchableSelect
                value={form.contractStatus ?? ''}
                onChange={(v) => set('contractStatus', v)}
                options={picklists.contractStatus.map((p) => ({ value: p.value, label: p.label }))}
                placeholder="Choose a status…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <SearchableSelect
                value={form.contractType ?? ''}
                onChange={(v) => set('contractType', v || null)}
                options={picklists.contractType.map((p) => ({ value: p.value, label: p.label }))}
                placeholder="No type"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <SearchableSelect
                value={form.priority ?? ''}
                onChange={(v) => set('priority', v || null)}
                options={picklists.priority.map((p) => ({ value: p.value, label: p.label }))}
                placeholder="No priority"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Tracking Unit
                {trackingUnitLocked && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(locked - usage already recorded)</span>}
              </Label>
              <SearchableSelect
                value={form.trackingUnit ?? ''}
                onChange={(v) => set('trackingUnit', v || null)}
                options={picklists.trackingUnit.map((p) => ({ value: p.value, label: p.label }))}
                placeholder="Choose a unit…"
                disabled={trackingUnitLocked}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-total-units">Total Units</Label>
              <Input
                id="sc-total-units" type="number" min={0} step="0.01"
                value={form.totalUnits ?? ''}
                onChange={(e) => set('totalUnits', e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="sc-start-date">Start Date</Label>
              <Input id="sc-start-date" type="date" value={form.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-end-date">End Date</Label>
              <Input id="sc-end-date" type="date" value={form.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-due-date">Due Date</Label>
              <Input id="sc-due-date" type="date" value={form.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Assigned To</Label>
            <SearchableSelect
              value={form.assignedTo ?? ''}
              onChange={(v) => set('assignedTo', v || null)}
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="Choose an employee…"
            />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.subject?.trim()}>
            {submitting ? 'Saving…' : serviceContract ? 'Save Changes' : 'Create Service Contract'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
