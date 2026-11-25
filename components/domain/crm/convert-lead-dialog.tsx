'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Building2, TrendingUp, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Radio, RadioGroup } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Field, NativeSelect } from '@/components/shared/scaffolds'
import { CurrencySelect } from '@/components/domain/portfolio/currency-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  companyWillExist, convertPayload, convertProblem, effectiveTransfer, initialConvertForm, opportunityNameOf, TRANSFER_LABEL, transferOptions,
  type ConvertForm,
} from '@/lib/leads/convert-model'
import { conversionMessage } from '@/lib/leads/model'
import { crmService } from '@/services/crm'
import type { CrmPicklistValue, Lead } from '@/types/crm'
import { ConvertOrganizationPicker } from './convert-organization-picker'
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

/** A native drop-down's options: the picklist, and the value already held when the list no longer has it (so it is shown, not lost). */
function optionsOf(values: CrmPicklistValue[], held: string): Array<{ value: string; label: string }> {
  const options = values.map((p) => ({ value: p.value, label: p.label }))
  if (held !== '' && !options.some((o) => o.value === held)) options.push({ value: held, label: held })
  return options
}

/** One of the three cards: an icon, a title with its switch, and, when the switch is on, the choices that follow it, tinted and lined up under the title. */
function Card({ icon, children, details, detailsKey, columns = false }: { icon: ReactNode; children: ReactNode; details?: ReactNode; detailsKey: string; columns?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {details && (
        <div data-details={detailsKey} className={columns ? 'mt-3 grid grid-cols-1 gap-3 rounded-md bg-muted/50 p-2.5 sm:ml-[3.25rem] sm:grid-cols-2' : 'mt-3 space-y-3 rounded-md bg-muted/50 p-2.5 sm:ml-[3.25rem]'}>
          {details}
        </div>
      )}
    </div>
  )
}

function SwitchRow({ id, label, checked, onChange, muted = false }: { id: string; label: string; checked: boolean; onChange: (on: boolean) => void; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className={muted ? 'cursor-pointer text-sm text-muted-foreground' : 'cursor-pointer'}>{label}</Label>
      <Switch id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  )
}

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
  const roleOptions = optionsOf(roles, form.contactRole)
  const industryOptions = optionsOf(picklists?.industry ?? [], form.industry)
  const stageOptions = optionsOf(picklists?.stage ?? [], form.stage)

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
          <Card
            detailsKey="organization"
            icon={<Building2 className="size-4" aria-hidden="true" />}
            details={form.createOrganization && (
              <>
                <SwitchRow id="convert-org-existing" label="Use an existing organization instead" muted checked={form.useExistingOrganization} onChange={(on) => set({ useExistingOrganization: on })} />
                {form.useExistingOrganization ? (
                  <ConvertOrganizationPicker
                    context={context}
                    chosenId={form.existingOrganizationId}
                    chosenName={form.existingOrganizationName}
                    onChoose={(id, name) => set({ existingOrganizationId: id, existingOrganizationName: name })}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Organization name" required>
                      {(c) => <Input {...c} name="convert-org-name" value={form.organizationName} onChange={(e) => set({ organizationName: e.target.value })} autoComplete="off" />}
                    </Field>
                    <Field label="Industry">
                      {(c) => (
                        <NativeSelect {...c} name="convert-org-industry" value={form.industry} onChange={(e) => set({ industry: e.target.value })}>
                          <option value="">—</option>
                          {industryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </NativeSelect>
                      )}
                    </Field>
                  </div>
                )}
              </>
            )}
          >
            <SwitchRow id="convert-org" label="Create organization" checked={form.createOrganization} onChange={(on) => set({ createOrganization: on })} />
            {!lead.company && <p className="mt-0.5 text-xs text-muted-foreground">This lead has no company name. Type one, or use an existing organization.</p>}
          </Card>

          <Card
            detailsKey="person"
            icon={<UserPlus className="size-4" aria-hidden="true" />}
            details={form.createContact && (
              <>
                <SwitchRow id="convert-link-existing" label="Attach to an existing person instead" muted checked={form.linkExisting} onChange={(on) => set({ linkExisting: on })} />
                {form.linkExisting && (
                  <SearchableSelect
                    aria-label="Existing person"
                    value={form.existingContactId}
                    onChange={(id) => set({ existingContactId: id })}
                    options={contacts.map((c) => ({ value: c.id, label: c.label }))}
                    placeholder="Choose an existing contact…"
                  />
                )}
                {company && (
                  <div className="space-y-3 border-t border-border pt-3" data-person-company>
                    <SwitchRow id="convert-primary" label="Primary contact of this company" checked={form.makePrimary} onChange={(on) => set({ makePrimary: on })} />
                    <Field label="Role" hint={form.linkExisting ? 'For an existing person, this applies only if they already work at this company.' : undefined}>
                      {(c) => (
                        <NativeSelect {...c} name="convert-role" value={form.contactRole} onChange={(e) => set({ contactRole: e.target.value })}>
                          <option value="">—</option>
                          {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </NativeSelect>
                      )}
                    </Field>
                  </div>
                )}
              </>
            )}
          >
            <SwitchRow id="convert-contact" label="Create person" checked={form.createContact} onChange={(on) => set({ createContact: on })} />
            {lead.hasRealName === false && form.createContact && !form.linkExisting && (
              <p className="mt-0.5 text-xs text-muted-foreground">This lead names no person (only the company), so no new person can be made. Attach to an existing one, or switch this off.</p>
            )}
          </Card>

          <Card
            detailsKey="opportunity"
            columns
            icon={<TrendingUp className="size-4" aria-hidden="true" />}
            details={form.createOpportunity && (
              <>
                <div className="sm:col-span-2">
                  <Field label="Opportunity name">
                    {(c) => <Input {...c} name="convert-opp-name" value={opportunityNameOf(form, lead)} onChange={(e) => set({ opportunityName: e.target.value })} autoComplete="off" />}
                  </Field>
                </div>
                <Field label="Amount">
                  {(c) => <Input {...c} name="convert-opp-amount" type="number" inputMode="decimal" min={0} step="any" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />}
                </Field>
                <Field label="Currency" hint="Your organization's default is used when you choose none.">
                  {(c) => <CurrencySelect {...c} value={form.currency} onChange={(code) => set({ currency: code })} />}
                </Field>
                <Field label="Expected close date">
                  {(c) => <Input {...c} name="convert-opp-close" type="date" value={form.closeDate} onChange={(e) => set({ closeDate: e.target.value })} />}
                </Field>
                <Field label="Stage">
                  {(c) => (
                    <NativeSelect {...c} name="convert-opp-stage" value={form.stage} onChange={(e) => set({ stage: e.target.value })}>
                      <option value="">—</option>
                      {stageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </NativeSelect>
                  )}
                </Field>
              </>
            )}
          >
            <SwitchRow id="convert-opportunity" label="Create opportunity" checked={form.createOpportunity} onChange={(on) => set({ createOpportunity: on })} />
            {!form.createOpportunity && <p className="mt-0.5 text-xs text-muted-foreground">Starts a pipeline deal.</p>}
          </Card>

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
