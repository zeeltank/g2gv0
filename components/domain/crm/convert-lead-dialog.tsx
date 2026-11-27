'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Radio, RadioGroup } from '@/components/ui/radio-group'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  companyWillExist, convertPayload, convertProblem, effectiveTransfer, initialConvertForm, opportunityNameOf, TRANSFER_LABEL, transferOptions,
  type ConvertForm,
} from '@/lib/leads/convert-model'
import { conversionMessage } from '@/lib/leads/model'
import { crmService } from '@/services/crm'
import type { CrmPicklistValue, Lead } from '@/types/crm'
import { convertOptionsOf, OpportunityCard, OrganizationCard, PersonCard } from './convert-cards'
import { useAssignableEmployees } from './lead-employees'
import { ROLE_FALLBACK } from './people/person-model'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConverted: (message: string) => void
  lead: Lead
}

interface Picklists {
  industry: CrmPicklistValue[]
  role: CrmPicklistValue[]
  stage: CrmPicklistValue[]
}

const defaultStageOf = (picklists: Picklists | null): string => picklists?.stage.find((s) => s.isDefault)?.value ?? ''

/**
 * Convert Lead: ONE pop-up where the person decides what the lead becomes (S19). An organization (a new one, with its name and industry editable, or one that
 * already exists), a person (new or an existing one, optionally the company's primary contact, with a role), an opportunity (name, amount, currency, close date,
 * stage), who it is assigned to, and where the lead's comments, e-mails, documents and events move to. Nothing is created until Convert is pressed, and the
 * server does all of it in one transaction.
 */
export function ConvertLeadDialog({ isOpen, onClose, onConverted, lead }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)

  const [form, setForm] = useState<ConvertForm>(() => initialConvertForm(lead))
  const [seeded, setSeeded] = useState(false)
  const [contacts, setContacts] = useState<Array<{ id: string; label: string }>>([])
  const [picklists, setPicklists] = useState<Picklists | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Each opening starts from the lead as it is now (a failed attempt before, or a lead that was reloaded, leaves nothing behind).
  if (isOpen && !seeded) {
    setSeeded(true)
    setForm(initialConvertForm(lead, defaultStageOf(picklists)))
    setError('')
  } else if (!isOpen && seeded) {
    setSeeded(false)
  }

  const set = (patch: Partial<ConvertForm>) => setForm((current) => ({ ...current, ...patch }))

  // The drop-downs read the CRM picklists the other screens use (industry of an organization, role of a person, sales stage of an opportunity), once, when the pop-up first opens.
  const needsPicklists = isOpen && picklists === null
  useEffect(() => {
    if (!needsPicklists || !isLaravelContextReady(context)) return
    let active = true
    crmService.getPicklistValues(context)
      .then((response) => {
        if (!active) return
        const all = response.data && typeof response.data === 'object' ? response.data : {}
        const next: Picklists = { industry: all.organizations?.industry ?? [], role: all.contacts?.contact_role ?? [], stage: all.opportunities?.sales_stage ?? [] }
        setPicklists(next)
        // The stage starts where the opportunity form starts it: the picklist's own default.
        const start = defaultStageOf(next)
        if (start !== '') setForm((current) => (current.stage === '' ? { ...current, stage: start } : current))
      })
      .catch(() => { if (active) setPicklists({ industry: [], role: [], stage: [] }) })
    return () => { active = false }
  }, [needsPicklists, context])

  useEffect(() => {
    if (!isOpen || !form.linkExisting || !isLaravelContextReady(context)) return
    crmService.getContacts(context, { perPage: 100, sortBy: 'last_name', sortDir: 'asc' })
      .then((response) => setContacts(response.data.items.map((c) => ({ id: c.id, label: `${c.firstName ?? ''} ${c.lastName}`.trim() }))))
      .catch(() => { /* the picker still renders empty */ })
  }, [isOpen, form.linkExisting, context])

  const company = companyWillExist(form)
  const transfers = transferOptions(form, lead)
  const transfer = effectiveTransfer(form, lead)
  const roles = picklists && picklists.role.length > 0 ? picklists.role : ROLE_FALLBACK.map((label, i) => ({ value: label, label, sortOrder: i, isDefault: false }))
  const roleOptions = convertOptionsOf(roles, form.contactRole)
  const industryOptions = convertOptionsOf(picklists?.industry ?? [], form.industry)
  const stageOptions = convertOptionsOf(picklists?.stage ?? [], form.stage)

  const submit = async () => {
    const problem = convertProblem(form)
    if (problem) {
      setError(problem)
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await crmService.convertLead(context, lead.id, convertPayload(form, lead))
      onConverted(conversionMessage(response, { organizationExisting: form.createOrganization && form.useExistingOrganization, transferTo: transfer === 'none' ? null : transfer }))
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to convert this lead.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Convert Lead</DialogTitle>
          <DialogDescription>
            Choose what to create from {lead.firstName ? `${lead.firstName} ` : ''}{lead.lastName}. The lead stays on record, marked converted.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
          <OrganizationCard
            context={context}
            create={form.createOrganization}
            onCreate={(on) => set({ createOrganization: on })}
            note={form.createOrganization
              ? !lead.company && <p className="mt-0.5 text-xs text-muted-foreground">This lead has no company name. Type one, or use an existing organization.</p>
              : <p className="mt-0.5 text-xs text-muted-foreground">No organization is made now. It is created automatically when the opportunity is won. Switch this on to attach the lead to an organization that already exists, or to make one now.</p>}
            useExisting={form.useExistingOrganization}
            onUseExisting={(on) => set({ useExistingOrganization: on })}
            existingId={form.existingOrganizationId}
            existingName={form.existingOrganizationName}
            onChoose={(id, name) => set({ existingOrganizationId: id, existingOrganizationName: name })}
            name={form.organizationName}
            onName={(value) => set({ organizationName: value })}
            industry={form.industry}
            onIndustry={(value) => set({ industry: value })}
            industryOptions={industryOptions}
          />

          <PersonCard
            create={form.createContact}
            onCreate={(on) => set({ createContact: on })}
            note={lead.hasRealName === false && form.createContact && !form.linkExisting && (
              <p className="mt-0.5 text-xs text-muted-foreground">This lead names no person (only the company), so no new person can be made. Attach to an existing one, or switch this off.</p>
            )}
            linkExisting={form.linkExisting}
            onLinkExisting={(on) => set({ linkExisting: on })}
            existingId={form.existingContactId}
            onExistingId={(id) => set({ existingContactId: id })}
            contacts={contacts}
            showCompany={company}
            makePrimary={form.makePrimary}
            onMakePrimary={(on) => set({ makePrimary: on })}
            role={form.contactRole}
            onRole={(value) => set({ contactRole: value })}
            roleOptions={roleOptions}
          />

          <OpportunityCard
            create={form.createOpportunity}
            onCreate={(on) => set({ createOpportunity: on })}
            name={opportunityNameOf(form, lead)}
            onName={(value) => set({ opportunityName: value })}
            amount={form.amount}
            onAmount={(value) => set({ amount: value })}
            currency={form.currency}
            onCurrency={(code) => set({ currency: code })}
            closeDate={form.closeDate}
            onCloseDate={(value) => set({ closeDate: value })}
            stage={form.stage}
            onStage={(value) => set({ stage: value })}
            stageOptions={stageOptions}
          />
          <div className="space-y-1.5">
            <Label>Assigned To *</Label>
            <SearchableSelect
              aria-label="Assigned To"
              value={form.assignedTo}
              onChange={(id) => set({ assignedTo: id })}
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="Choose an employee…"
            />
          </div>

          <fieldset className="space-y-2 rounded-lg border border-border p-3" data-transfer>
            <legend className="px-1 text-sm font-medium text-foreground">Transfer related records to</legend>
            <RadioGroup value={transfer} onValueChange={(value) => set({ transferTo: value as ConvertForm['transferTo'] })} className="gap-2" aria-label="Transfer related records to">
              {transfers.map((target) => <Radio key={target} name="convert-transfer" value={target} label={TRANSFER_LABEL[target]} />)}
              <Radio name="convert-transfer" value="none" label="Do not move them" />
            </RadioGroup>
            <p className="text-xs text-muted-foreground">Moves the comments, emails, documents and scheduled events of this lead to the record you choose.</p>
          </fieldset>

          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
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
