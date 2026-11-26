'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useAssignableEmployees } from '@/components/domain/crm/lead-employees'
import { getLaravelContext } from '@/lib/laravel-context'
import { QUALIFY_SENTENCE, qualifyBody, qualifyProblem } from '@/lib/gtm/qualify-model'
import { classifyFunnelFailure } from '@/lib/signals/funnel'
import type { GtmContact, QualifyAsLeadResult, gtmService } from '@/services/gtm/gtm'
import { useAuth } from '@/components/auth/gtg-auth'
import { PersonChoice } from './person-choice'

interface Props {
  open: boolean
  onClose: () => void
  accountName: string
  accountId: number
  contacts: readonly GtmContact[]
  /** The server made the lead (`created`) or answered the one this person already had. */
  onQualified: (result: QualifyAsLeadResult, personName: string) => void
  service: Pick<typeof gtmService, 'qualifyAsLead'>
}

/**
 * Qualify as lead: choose WHICH person at this account the lead is for (required), who owns it (the caller unless you choose someone), and say what it does.
 * The server makes one lead that names the person, moves the account to Engaged, and answers the lead that is already there for a person who has one.
 */
export function QualifyLeadDialog({ open, onClose, accountName, accountId, contacts, onQualified, service }: Props) {
  const { user } = useAuth()
  const context = useMemo(() => getLaravelContext(user), [user])
  const employees = useAssignableEmployees(context, open)
  const me = user?.id !== undefined && user?.id !== null ? String(user.id) : null

  const [contactId, setContactId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [seeded, setSeeded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Each opening starts clean, owned by the caller.
  if (open && !seeded) {
    setSeeded(true)
    setContactId('')
    setAssignedTo(me ?? '')
    setError('')
  } else if (!open && seeded) {
    setSeeded(false)
  }

  const submit = async () => {
    const form = { contactId, assignedTo }
    const problem = qualifyProblem(form, contacts)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await service.qualifyAsLead(accountId, qualifyBody(form, me))
      onQualified(response.data, contacts.find((c) => String(c.id) === contactId)?.full_name ?? 'this person')
      onClose()
    } catch (reason) {
      setError(classifyFunnelFailure(reason).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Qualify as lead</DialogTitle>
          <DialogDescription>{QUALIFY_SENTENCE}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-foreground">Person at {accountName} *</legend>
            <PersonChoice contacts={contacts} value={contactId} onChange={setContactId} name="qualify-person" />
          </fieldset>

          <div className="space-y-1.5">
            <Label>Assigned To</Label>
            <SearchableSelect
              aria-label="Assigned To"
              value={assignedTo}
              onChange={setAssignedTo}
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="You, unless you choose someone…"
            />
          </div>

          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy}>{busy ? 'Qualifying…' : 'Qualify as lead'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
