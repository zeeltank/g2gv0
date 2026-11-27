'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext } from '@/lib/laravel-context'
import { outreachService, type OutreachApi } from '@/services/signals/outreach'
import type { AssignBody } from '@/services/signals/outreach-types'
import { useAssignableEmployees } from '@/components/domain/crm/lead-employees'
import { FormAlert } from './outreach-form-fields'
import { errorText } from './outreach-parts'
import { useFreshKey } from './use-fresh-key'

/**
 * Choose who looks after one company or one person. The lists do it for many rows at once from the bar at the bottom; this is the same call for the single row a page is about
 * (`target` says which). The owner list is the one the CRM leads screen uses, so the same people are offered everywhere.
 */
export function AssignOwnerDialog({ open, onOpenChange, target, subject, service = outreachService, onAssigned }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: { company_ids: number[] } | { person_ids: number[] }
  /** What is being given an owner, for the sentence ("Riverdale Public School"). */
  subject: string
  service?: OutreachApi
  onAssigned: () => void
}) {
  const fresh = useFreshKey(open)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-md">
        <OwnerForm key={fresh} target={target} subject={subject} service={service} onClose={() => onOpenChange(false)} onAssigned={onAssigned} />
      </DialogContent>
    </Dialog>
  )
}

function OwnerForm({ target, subject, service, onClose, onAssigned }: { target: { company_ids: number[] } | { person_ids: number[] }; subject: string; service: OutreachApi; onClose: () => void; onAssigned: () => void }) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)
  const [owner, setOwner] = useState('')
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!owner || saving) return
    setSaving(true)
    setFailure('')
    try {
      const body: AssignBody = { ...target, assigned_to: Number(owner) }
      await service.assign(body)
      onAssigned()
      onClose()
    } catch (cause) {
      setFailure(errorText(cause, 'The owner could not be changed.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col gap-4">
      <DialogHeader className="mb-0 shrink-0">
        <DialogTitle>Change owner</DialogTitle>
        <DialogDescription>Choose who looks after {subject}.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 px-1">
        <div className="space-y-1.5">
          <Label>New owner</Label>
          <SearchableSelect value={owner} onChange={setOwner} options={employees.map((employee) => ({ value: employee.id, label: employee.name }))} placeholder="Choose a person…" aria-label="New owner" />
        </div>
        {failure && <FormAlert text={failure} />}
      </div>
      <DialogFooter className="mt-0 shrink-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || !owner}>{saving ? 'Saving…' : 'Change owner'}</Button>
      </DialogFooter>
    </form>
  )
}
