'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { Lead } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConverted: (message: string) => void
  lead: Lead
}

/**
 * Convert Lead -> Organization + Contact.
 *
 * Mirrors the legacy CRM's own UI choice set (confirmed from research): a
 * checkbox per target (Organization pre-checked when the lead has a
 * Company), a required Assigned-To, and NO explicit "link to existing
 * Organization" control — the backend silently reuses an exact-name match
 * if one exists, exactly like the legacy system.
 */
export function ConvertLeadDialog({ isOpen, onClose, onConverted, lead }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)

  const [createOrganization, setCreateOrganization] = useState(!!lead.company)
  const [createContact, setCreateContact] = useState(true)
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!createOrganization && !createContact) {
      setError('Select at least one of Organization or Contact to create.')
      return
    }
    if (!assignedTo) {
      setError('Assigned To is required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await crmService.convertLead(context, lead.id, { createOrganization, createContact, assignedTo })
      onConverted(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to convert this lead.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Convert Lead</DialogTitle>
          <DialogDescription>
            Create real records from {lead.firstName ? `${lead.firstName} ` : ''}{lead.lastName}. The lead stays on record, marked converted.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="convert-org" className="cursor-pointer">Create Organization</Label>
              {!lead.company && <p className="text-xs text-muted-foreground">This lead has no Company name.</p>}
            </div>
            <Switch id="convert-org" checked={createOrganization} onChange={(e) => setCreateOrganization(e.target.checked)} disabled={!lead.company} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="convert-contact" className="cursor-pointer">Create Contact</Label>
            <Switch id="convert-contact" checked={createContact} onChange={(e) => setCreateContact(e.target.checked)} />
          </div>

          <div className="space-y-1.5">
            <Label>Assigned To *</Label>
            <SearchableSelect
              value={assignedTo}
              onChange={setAssignedTo}
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="Choose an employee…"
            />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? 'Converting…' : 'Convert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
