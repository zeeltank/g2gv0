'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Field } from '@/components/shared/scaffolds'
import { convertOptionsOf, OpportunityCard, OrganizationCard, PersonCard } from '@/components/domain/crm/convert-cards'
import { useAssignableEmployees } from '@/components/domain/crm/lead-employees'
import { ROLE_FALLBACK } from '@/components/domain/crm/people/person-model'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  initialSignalConvertForm, personHasCompany, signalConvertPayload, signalConvertProblem, signalOpportunityNameOf, type SignalConvertForm, type SignalSource,
} from '@/lib/signals/convert-signal-model'
import { classifyFunnelFailure } from '@/lib/signals/funnel'
import { crmService } from '@/services/crm'
import type { SignalFunnelApi } from '@/services/signal-review/signal-funnel-service'
import type { SignalConvertResponse } from '@/services/signal-review/signal-types'
import type { CrmPicklistValue } from '@/types/crm'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** The server made the opportunity (`created`) or answered the one this signal already had. */
  onConverted: (result: SignalConvertResponse['data']) => void
  signal: SignalSource & { id: number; likely_stakeholder?: string | null }
  service: Pick<SignalFunnelApi, 'convertToOpportunity'>
}

interface Picklists {
  industry: CrmPicklistValue[]
  role: CrmPicklistValue[]
  stage: CrmPicklistValue[]
}

const defaultStageOf = (picklists: Picklists | null): string => picklists?.stage.find((s) => s.isDefault)?.value ?? ''

/**
 * Convert to opportunity: a signal becomes an Organization, an optional Person and an Opportunity in ONE pop-up, built from the same three cards as Convert Lead.
 * The organization starts as the signal's company (name and industry), the person is optional ("Add a person"), and the signal's own stakeholder text is only a
 * suggestion shown under it. Nothing is created until Convert is pressed, and the server does all of it in one transaction.
 */
export function ConvertSignalDialog({ isOpen, onClose, onConverted, signal, service }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)

  const [form, setForm] = useState<SignalConvertForm>(() => initialSignalConvertForm(signal))
  const [seeded, setSeeded] = useState(false)
  const [contacts, setContacts] = useState<Array<{ id: string; label: string }>>([])
  const [picklists, setPicklists] = useState<Picklists | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Each opening starts from the signal as it is now (a failed attempt before leaves nothing behind).
  if (isOpen && !seeded) {
    setSeeded(true)
    setForm(initialSignalConvertForm(signal, defaultStageOf(picklists)))
    setError('')
  } else if (!isOpen && seeded) {
    setSeeded(false)
  }

  const set = (patch: Partial<SignalConvertForm>) => setForm((current) => ({ ...current, ...patch }))

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
        const start = defaultStageOf(next)
        if (start !== '') setForm((current) => (current.stage === '' ? { ...current, stage: start } : current))
      })
      .catch(() => { if (active) setPicklists({ industry: [], role: [], stage: [] }) })
    return () => { active = false }
  }, [needsPicklists, context])

  useEffect(() => {
    if (!isOpen || !form.addPerson || !form.linkExisting || !isLaravelContextReady(context)) return
    crmService.getContacts(context, { perPage: 100, sortBy: 'last_name', sortDir: 'asc' })
      .then((response) => setContacts(response.data.items.map((c) => ({ id: c.id, label: `${c.firstName ?? ''} ${c.lastName}`.trim() }))))
      .catch(() => { /* the picker still renders empty */ })
  }, [isOpen, form.addPerson, form.linkExisting, context])

  const roles = picklists && picklists.role.length > 0 ? picklists.role : ROLE_FALLBACK.map((label, i) => ({ value: label, label, sortOrder: i, isDefault: false }))
  const roleOptions = convertOptionsOf(roles, form.contactRole)
  const industryOptions = convertOptionsOf(picklists?.industry ?? [], form.industry)
  const stageOptions = convertOptionsOf(picklists?.stage ?? [], form.stage)
  const suggestion = typeof signal.likely_stakeholder === 'string' ? signal.likely_stakeholder.trim() : ''

  const submit = async () => {
    const problem = signalConvertProblem(form)
    if (problem) {
      setError(problem)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await service.convertToOpportunity(signal.id, signalConvertPayload(form, signal))
      onConverted(response.data)
      onClose()
    } catch (reason) {
      setError(classifyFunnelFailure(reason).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Convert to opportunity</DialogTitle>
          <DialogDescription>Choose what to create from this signal{signal.company_name ? ` about ${signal.company_name}` : ''}. The signal stays on record and says what it became.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
          <OrganizationCard
            context={context}
            required
            create
            onCreate={() => undefined}
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
            create={form.addPerson}
            onCreate={(on) => set({ addPerson: on })}
            createLabel="Add a person (optional)"
            note={suggestion !== '' && !form.addPerson && <p className="mt-0.5 text-xs text-muted-foreground">The signal suggests: {suggestion}</p>}
            linkExisting={form.linkExisting}
            onLinkExisting={(on) => set({ linkExisting: on })}
            existingId={form.existingContactId}
            onExistingId={(id) => set({ existingContactId: id })}
            contacts={contacts}
            newPerson={(
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-new-person>
                <Field label="First name">{(c) => <Input {...c} name="convert-person-first" value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} autoComplete="off" />}</Field>
                <Field label="Last name" required>{(c) => <Input {...c} name="convert-person-last" value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} autoComplete="off" />}</Field>
                <Field label="Email">{(c) => <Input {...c} name="convert-person-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} autoComplete="off" />}</Field>
                <Field label="Phone">{(c) => <Input {...c} name="convert-person-phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} autoComplete="off" />}</Field>
                <div className="sm:col-span-2"><Field label="Title">{(c) => <Input {...c} name="convert-person-title" value={form.title} onChange={(e) => set({ title: e.target.value })} autoComplete="off" />}</Field></div>
              </div>
            )}
            showCompany={personHasCompany(form)}
            makePrimary={form.makePrimary}
            onMakePrimary={(on) => set({ makePrimary: on })}
            role={form.contactRole}
            onRole={(value) => set({ contactRole: value })}
            roleOptions={roleOptions}
          />

          <OpportunityCard
            required
            create
            onCreate={() => undefined}
            name={signalOpportunityNameOf(form, signal)}
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
            <Label>Assigned To</Label>
            <SearchableSelect
              aria-label="Assigned To"
              value={form.assignedTo}
              onChange={(id) => set({ assignedTo: id })}
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="You, unless you choose someone…"
            />
          </div>

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
