'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2, TrendingUp, UserPlus } from 'lucide-react'
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
  const [linkExisting, setLinkExisting] = useState(false)
  const [existingContactId, setExistingContactId] = useState('')
  const [contacts, setContacts] = useState<Array<{ id: string; label: string }>>([])
  const [createOpportunity, setCreateOpportunity] = useState(false)
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !linkExisting || !isLaravelContextReady(context)) return
    crmService.getContacts(context, { perPage: 100, sortBy: 'last_name', sortDir: 'asc' })
      .then((response) => setContacts(response.data.items.map((c) => ({ id: c.id, label: `${c.firstName ?? ''} ${c.lastName}`.trim() }))))
      .catch(() => { /* the picker still renders empty */ })
  }, [isOpen, linkExisting, context])

  const submit = async () => {
    if (!createOrganization && !createContact) {
      setError('Select at least one of Organization or Contact to create.')
      return
    }
    if (createContact && linkExisting && !existingContactId) {
      setError('Choose which existing Contact to attach to.')
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
      const response = await crmService.convertLead(context, lead.id, {
        createOrganization, createContact, assignedTo, createOpportunity,
        ...(createContact && linkExisting ? { existingContactId } : {}),
      })
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

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="convert-org" className="cursor-pointer">Create Organization</Label>
                <Switch id="convert-org" checked={createOrganization} onChange={(e) => setCreateOrganization(e.target.checked)} disabled={!lead.company} />
              </div>
              {!lead.company && <p className="mt-0.5 text-xs text-muted-foreground">This lead has no Company name.</p>}
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserPlus className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="convert-contact" className="cursor-pointer">Create Contact</Label>
                  <Switch id="convert-contact" checked={createContact} onChange={(e) => setCreateContact(e.target.checked)} />
                </div>
              </div>
            </div>
            {createContact && (
              <div className="mt-3 space-y-2 rounded-md bg-muted/50 p-2.5 pl-[3.25rem]">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="convert-link-existing" className="cursor-pointer text-sm text-muted-foreground">Attach to an existing Contact instead</Label>
                  <Switch id="convert-link-existing" checked={linkExisting} onChange={(e) => setLinkExisting(e.target.checked)} />
                </div>
                {linkExisting && (
                  <SearchableSelect
                    value={existingContactId}
                    onChange={setExistingContactId}
                    options={contacts.map((c) => ({ value: c.id, label: c.label }))}
                    placeholder="Choose an existing contact…"
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="convert-opportunity" className="cursor-pointer">Create Opportunity</Label>
                <Switch id="convert-opportunity" checked={createOpportunity} onChange={(e) => setCreateOpportunity(e.target.checked)} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">Starts a pipeline deal - amount and stage are set afterward.</p>
            </div>
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
