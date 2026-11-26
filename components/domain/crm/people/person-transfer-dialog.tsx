'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext } from '@/lib/laravel-context'
import { contactsService } from '@/services/crm/contacts'
import { useAssignableEmployees } from '../lead-employees'

/** Reassigns one person to another owner. A person has no sub-records of their own to carry along, so there is no cascade choice here. */
export function PersonTransferDialog({ isOpen, onClose, onTransferred, personId }: {
  isOpen: boolean; onClose: () => void; onTransferred: (message: string) => void; personId: string
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const [assignedTo, setAssignedTo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!assignedTo) { setError('Choose who to assign this person to.'); return }
    setSubmitting(true)
    setError('')
    try {
      const response = await contactsService.transferOwnership(context, personId, assignedTo)
      onTransferred(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to transfer ownership.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Transfer ownership</DialogTitle>
          <DialogDescription>Reassign this person to a different owner.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label>New owner *</Label>
            <SearchableSelect value={assignedTo} onChange={setAssignedTo} options={employees.map((e) => ({ value: e.id, label: e.name }))} placeholder="Choose an employee…" />
          </div>
          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting}>{submitting ? 'Transferring…' : 'Transfer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
