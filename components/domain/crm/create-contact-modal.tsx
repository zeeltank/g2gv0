'use client'

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import { contactsService } from '@/services/crm/contacts'
import type { Contact, ContactPayload, CrmPicklistValue } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'
import { useOrganizationOptions } from './organization-options'
import { personName, ROLE_FALLBACK } from './people/person-model'

/**
 * The one Add person / Edit person dialog (S18: contacts are the people of a company). Opened from a company's People tab the company is fixed
 * (`lockedOrganization`); opened from All people it asks for the company, which is required.
 *
 * The sections are the ones of the approved mock-up: Name, Company, Reach, Role in the company, Address, Personal, Description, Other address (collapsed),
 * Custom fields (an edit of a saved person, and only when the organisation defines any: the form needs the person's id) and Ownership and preferences.
 * "Primary contact of this company" is not a field of the person: it is set and cleared through its own call after the person is saved.
 */
export interface PersonFormPicklists {
  salutation: CrmPicklistValue[]
  leadSource: CrmPicklistValue[]
  contactRole?: CrmPicklistValue[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string, saved?: Contact) => void
  contact: Contact | null
  /** Left out, the dialog reads the contacts picklists itself when it opens. */
  picklists?: PersonFormPicklists
  /** Opened from a company's page: this company is fixed and is not asked for. */
  lockedOrganization?: { id: string; name: string } | null
}

type Form = ContactPayload & { lastName: string }

const EMPTY: Form = {
  salutation: '', firstName: '', lastName: '', title: '', department: '', email: '', secondaryEmail: '',
  phone: '', mobile: '', fax: '', homePhone: '', contactRole: '', reportsToId: '', leadSource: '', doNotCall: false, emailOptOut: false,
  mailingStreet: '', mailingCity: '', mailingState: '', mailingCountry: '', mailingCode: '', mailingPoBox: '',
  otherStreet: '', otherCity: '', otherState: '', otherCountry: '', otherCode: '', otherPoBox: '',
  birthday: '', assistant: '', assistantPhone: '', linkedinUrl: '',
  description: '', assignedTo: '', organizationId: null,
}

function formFrom(contact: Contact | null, lockedId: string | null): Form {
  if (!contact) return { ...EMPTY, organizationId: lockedId }
  const text = (value: string | null | undefined) => value ?? ''
  return {
    salutation: text(contact.salutation), firstName: text(contact.firstName), lastName: contact.lastName,
    title: text(contact.title), department: text(contact.department), email: text(contact.email),
    secondaryEmail: text(contact.secondaryEmail), phone: text(contact.phone), mobile: text(contact.mobile),
    fax: text(contact.fax), homePhone: text(contact.homePhone), contactRole: text(contact.contactRole), reportsToId: text(contact.reportsToId),
    leadSource: text(contact.leadSource), doNotCall: contact.doNotCall, emailOptOut: contact.emailOptOut,
    mailingStreet: text(contact.mailingStreet), mailingCity: text(contact.mailingCity), mailingState: text(contact.mailingState),
    mailingCountry: text(contact.mailingCountry), mailingCode: text(contact.mailingCode), mailingPoBox: text(contact.mailingPoBox),
    otherStreet: text(contact.otherStreet), otherCity: text(contact.otherCity), otherState: text(contact.otherState),
    otherCountry: text(contact.otherCountry), otherCode: text(contact.otherCode), otherPoBox: text(contact.otherPoBox),
    birthday: text(contact.birthday).slice(0, 10), assistant: text(contact.assistant), assistantPhone: text(contact.assistantPhone), linkedinUrl: text(contact.linkedinUrl),
    description: text(contact.description), assignedTo: text(contact.assignedTo), organizationId: lockedId ?? contact.organizationId,
  }
}

/** What is sent: a value the server checks against a list or a format (the role, the person reported to, the birthday, the LinkedIn address) is null, not an empty string, when left empty. */
export function personPayload(form: Form): ContactPayload {
  const orNull = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null)
  return {
    ...form,
    lastName: form.lastName.trim(),
    contactRole: orNull(form.contactRole),
    reportsToId: orNull(form.reportsToId),
    birthday: orNull(form.birthday),
    linkedinUrl: orNull(form.linkedinUrl),
    organizationId: form.organizationId || null,
  }
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section role="group" aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function TextField({ id, label, value, onChange, type = 'text', required }: {
  id: string; label: string; value: string | null | undefined; onChange: (value: string) => void; type?: string; required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required ? ' *' : ''}</Label>
      <Input id={id} type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function AddressFields({ prefix, form, set }: {
  prefix: 'mailing' | 'other'; form: Form; set: <K extends keyof ContactPayload>(key: K, value: ContactPayload[K]) => void
}) {
  const k = (suffix: 'Street' | 'City' | 'State' | 'Code' | 'Country' | 'PoBox') => `${prefix}${suffix}` as keyof ContactPayload
  const field = (suffix: 'Street' | 'City' | 'State' | 'Code' | 'Country' | 'PoBox', label: string) => (
    <TextField
      id={`person-${prefix}-${suffix}`}
      label={label}
      value={form[k(suffix)] as string | null | undefined}
      onChange={(value) => set(k(suffix), value as never)}
    />
  )
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {field('Street', 'Street')}
      {field('City', 'City')}
      {field('State', 'State')}
      {field('Code', 'Postal code')}
      {field('Country', 'Country')}
      {field('PoBox', 'PO box')}
    </div>
  )
}

export function CreateContactModal({ isOpen, onClose, onSaved, contact, picklists, lockedOrganization = null }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const organizations = useOrganizationOptions(context, isOpen && !lockedOrganization)
  const lockedId = lockedOrganization?.id ?? null

  const [seededFrom, setSeededFrom] = useState<Contact | null | 'unset'>('unset')
  const [form, setForm] = useState<Form>(EMPTY)
  const [primary, setPrimary] = useState(false)
  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [ownPicklists, setOwnPicklists] = useState<PersonFormPicklists | null>(null)
  const [peers, setPeers] = useState<{ organizationId: string; items: Contact[] } | null>(null)

  if (isOpen && seededFrom !== contact) {
    setSeededFrom(contact)
    setForm(formFrom(contact, lockedId))
    setPrimary(Boolean(contact?.isPrimary))
    setCustomValues({})
    setHasCustomFields(false)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const needsOwnPicklists = isOpen && !(picklists && picklists.contactRole)
  useEffect(() => {
    if (!needsOwnPicklists || ownPicklists || !isLaravelContextReady(context)) return
    let active = true
    crmService.getPicklistValues(context, 'contacts')
      .then((response) => {
        if (!active) return
        const c = response.data.contacts ?? {}
        setOwnPicklists({ salutation: c.salutation ?? [], leadSource: c.lead_source ?? [], contactRole: c.contact_role ?? [] })
      })
      .catch(() => { /* the form still works with empty drop-downs and the built-in roles */ })
    return () => { active = false }
  }, [needsOwnPicklists, ownPicklists, context])

  const organizationId = form.organizationId ?? ''
  useEffect(() => {
    if (!isOpen || !organizationId || !isLaravelContextReady(context)) return
    let active = true
    contactsService.list(context, { organizationId, perPage: 100, sortBy: 'last_name', sortDir: 'asc' })
      .then((response) => { if (active) setPeers({ organizationId, items: response.data.items }) })
      .catch(() => { /* Reports to stays on "Nobody" */ })
    return () => { active = false }
  }, [isOpen, organizationId, context])

  const salutations = (picklists?.salutation?.length ? picklists.salutation : ownPicklists?.salutation) ?? []
  const leadSources = (picklists?.leadSource?.length ? picklists.leadSource : ownPicklists?.leadSource) ?? []
  const roleValues = (picklists?.contactRole?.length ? picklists.contactRole : ownPicklists?.contactRole) ?? []
  const roleOptions = roleValues.length > 0
    ? roleValues.map((p) => ({ label: p.label, value: p.value }))
    : ROLE_FALLBACK.map((label) => ({ label, value: label }))
  // A role the person already holds that the list no longer carries stays selectable, so an edit does not silently change it.
  if (form.contactRole && !roleOptions.some((o) => o.value === form.contactRole)) roleOptions.push({ label: String(form.contactRole), value: String(form.contactRole) })

  const peerOptions = (peers && peers.organizationId === organizationId ? peers.items : [])
    .filter((p) => p.id !== contact?.id)
    .map((p) => ({ label: personName(p) || `Person #${p.id}`, value: p.id }))
  if (form.reportsToId && !peerOptions.some((o) => o.value === form.reportsToId)) peerOptions.push({ label: contact?.reportsToName || `Person #${form.reportsToId}`, value: String(form.reportsToId) })

  const set = <K extends keyof ContactPayload>(key: K, value: ContactPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const companyOptions = organizations.map((o) => ({ value: o.id, label: o.name }))
  if (contact?.organizationId && !companyOptions.some((o) => o.value === contact.organizationId)) companyOptions.push({ value: contact.organizationId, label: contact.organizationName || `Company #${contact.organizationId}` })

  // Required for a new person, and for the edit of one who has a company; the edit of a person without one may leave it empty.
  const companyRequired = !contact || Boolean(contact.organizationId)
  const missingCompany = companyRequired && !form.organizationId

  const submit = async () => {
    if (!form.lastName?.trim() || !form.assignedTo) {
      setError('Last name and Assigned to are required.')
      return
    }
    if (missingCompany) {
      setError('Choose a company from the list.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const body = personPayload(form)
      const response = contact
        ? await contactsService.update(context, contact.id, body)
        : await contactsService.create(context, body)
      const saved = response.data
      let message = response.message
      const companyChanged = Boolean(contact) && (contact?.organizationId ?? null) !== (body.organizationId ?? null)
      try {
        if (saved?.id && body.organizationId) {
          const wasPrimary = Boolean(contact?.isPrimary) && !companyChanged
          if (primary && !wasPrimary) await contactsService.setPrimary(context, saved.id)
          else if (!primary && wasPrimary) await contactsService.clearPrimary(context, saved.id)
        }
        if (saved?.id && hasCustomFields) await saveCustomFieldValues('crm_contacts', Number(saved.id), customValues)
      } catch (reason) {
        message = `${message} But one more step failed: ${reason instanceof Error ? reason.message : describePlatformError(reason, 'it could not be saved')}`
      }
      onSaved(message, saved)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that person.')
    } finally {
      setSubmitting(false)
    }
  }

  const companyName = lockedOrganization?.name ?? organizations.find((o) => o.id === form.organizationId)?.name ?? contact?.organizationName ?? null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{contact ? 'Edit person' : 'Add person'}</DialogTitle>
          <DialogDescription>
            {lockedOrganization
              ? <>Company: <strong>{lockedOrganization.name}</strong> (fixed here)</>
              : contact ? 'Update this person’s details.' : 'A person who works at a company you deal with.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1">
          <Group title="Name">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr_1fr]">
              <div className="space-y-1.5">
                <Label>Salutation</Label>
                <Select
                  aria-label="Salutation"
                  value={form.salutation || 'none'}
                  onChange={(v) => set('salutation', v === 'none' ? '' : v)}
                  options={[{ label: '—', value: 'none' }, ...salutations.map((p) => ({ label: p.label, value: p.value }))]}
                />
              </div>
              <TextField id="person-first-name" label="First name" value={form.firstName} onChange={(v) => set('firstName', v)} />
              <div className="space-y-1.5">
                <Label htmlFor="person-last-name">Last name *</Label>
                <Input id="person-last-name" value={form.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)} autoFocus />
              </div>
            </div>
          </Group>

          <Group title="Company">
            {lockedOrganization ? (
              <p data-locked-company className="text-sm text-foreground">{lockedOrganization.name}</p>
            ) : (
              <div className="space-y-1.5">
                <Label>Company{companyRequired ? ' *' : ''}</Label>
                <SearchableSelect
                  aria-label="Company"
                  value={form.organizationId ?? ''}
                  onChange={(v) => { set('organizationId', v || null); if (!v) setPrimary(false); set('reportsToId', '') }}
                  options={companyOptions}
                  placeholder={companyRequired ? 'Choose a company…' : 'No company'}
                />
              </div>
            )}
          </Group>

          <Group title="Reach">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField id="person-email" label="Email" type="email" value={form.email} onChange={(v) => set('email', v)} />
              <TextField id="person-secondary-email" label="Second email" type="email" value={form.secondaryEmail} onChange={(v) => set('secondaryEmail', v)} />
              <TextField id="person-phone" label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
              <TextField id="person-mobile" label="Mobile" value={form.mobile} onChange={(v) => set('mobile', v)} />
              <TextField id="person-fax" label="Fax" value={form.fax} onChange={(v) => set('fax', v)} />
              <TextField id="person-home-phone" label="Home phone" value={form.homePhone} onChange={(v) => set('homePhone', v)} />
            </div>
          </Group>

          <Group title="Role in the company">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField id="person-title" label="Title" value={form.title} onChange={(v) => set('title', v)} />
              <TextField id="person-department" label="Department" value={form.department} onChange={(v) => set('department', v)} />
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  aria-label="Role"
                  value={form.contactRole || 'none'}
                  onChange={(v) => set('contactRole', v === 'none' ? '' : v)}
                  options={[{ label: '—', value: 'none' }, ...roleOptions]}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reports to</Label>
                <Select
                  aria-label="Reports to"
                  value={form.reportsToId || 'none'}
                  onChange={(v) => set('reportsToId', v === 'none' ? '' : v)}
                  options={[{ label: 'Nobody', value: 'none' }, ...peerOptions]}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <Label htmlFor="person-primary" className="cursor-pointer">Primary contact of this company</Label>
                {!form.organizationId && <p className="text-xs text-muted-foreground">A person needs a company before it can be the primary contact.</p>}
                {form.organizationId && companyName && <p className="text-xs text-muted-foreground">Only one person at {companyName} is primary; this replaces the current one.</p>}
              </div>
              <Switch id="person-primary" checked={primary && Boolean(form.organizationId)} disabled={!form.organizationId} onChange={(e) => setPrimary(e.target.checked)} />
            </div>
          </Group>

          <Group title="Address">
            <AddressFields prefix="mailing" form={form} set={set} />
          </Group>

          <Group title="Personal">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField id="person-birthday" label="Birthday" type="date" value={form.birthday} onChange={(v) => set('birthday', v)} />
              <TextField id="person-assistant" label="Assistant" value={form.assistant} onChange={(v) => set('assistant', v)} />
              <TextField id="person-assistant-phone" label="Assistant phone" value={form.assistantPhone} onChange={(v) => set('assistantPhone', v)} />
              <TextField id="person-linkedin" label="LinkedIn" value={form.linkedinUrl} onChange={(v) => set('linkedinUrl', v)} />
            </div>
          </Group>

          <Group title="Description">
            <div className="space-y-1.5">
              <Label htmlFor="person-description">Notes about this person</Label>
              <Textarea id="person-description" rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Anything the team should know" />
            </div>
          </Group>

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Other address (optional)</summary>
            <div className="mt-3"><AddressFields prefix="other" form={form} set={set} /></div>
          </details>

          {/* Always mounted (hidden until the organisation turns out to define fields). Record 0 means a person that is not saved yet: the definitions load, and the values are saved with the new person's id after the create. */}
          {(
            <div className={hasCustomFields ? '' : 'hidden'}>
              <Group title="Custom fields">
                <CustomFieldsSection
                  recordTable="crm_contacts"
                  recordId={contact ? Number(contact.id) : 0}
                  allowNew={!contact}
                  values={customValues}
                  onChange={setCustomValues}
                  onFieldsLoaded={(fields) => setHasCustomFields(fields.length > 0)}
                />
              </Group>
            </div>
          )}

          <Group title="Ownership and preferences">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Assigned to *</Label>
                <SearchableSelect
                  aria-label="Assigned to"
                  value={form.assignedTo ?? ''}
                  onChange={(v) => set('assignedTo', v)}
                  options={employees.map((e) => ({ value: e.id, label: e.name }))}
                  placeholder="Choose an employee…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Lead source</Label>
                <Select
                  aria-label="Lead source"
                  value={form.leadSource || 'none'}
                  onChange={(v) => set('leadSource', v === 'none' ? '' : v)}
                  options={[{ label: '—', value: 'none' }, ...leadSources.map((p) => ({ label: p.label, value: p.value }))]}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="person-do-not-call" className="cursor-pointer">Do not call</Label>
                <Switch id="person-do-not-call" checked={!!form.doNotCall} onChange={(e) => set('doNotCall', e.target.checked)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="person-email-opt-out" className="cursor-pointer">Email opt-out</Label>
                <Switch id="person-email-opt-out" checked={!!form.emailOptOut} onChange={(e) => set('emailOptOut', e.target.checked)} />
              </div>
            </div>
          </Group>

          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.lastName?.trim()}>
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
            {submitting ? 'Saving…' : 'Save person'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
