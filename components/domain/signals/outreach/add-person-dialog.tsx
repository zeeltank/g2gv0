'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext } from '@/lib/laravel-context'
import { personFormErrors } from '@/lib/signals/outreach-model'
import { outreachService, type OutreachApi } from '@/services/signals/outreach'
import type { NewPersonBody, OutreachPerson, UpdatePersonBody } from '@/services/signals/outreach-types'
import { useAssignableEmployees } from '@/components/domain/crm/lead-employees'
import { CompanyPicker, type PickedCompany } from './company-picker'
import { FormAlert, TextField } from './outreach-form-fields'
import { errorText, fieldErrors } from './outreach-parts'
import { useFreshKey } from './use-fresh-key'

type Field = 'full_name' | 'designation' | 'department' | 'contact_role' | 'email' | 'secondary_email' | 'phone' | 'mobile' | 'linkedin_url' | 'description'

const TEXT_FIELDS: readonly Field[] = ['full_name', 'designation', 'department', 'contact_role', 'email', 'secondary_email', 'phone', 'mobile', 'linkedin_url', 'description']

type Form = Record<Field, string> & { primary: boolean; assignedTo: string }

const blank = (person: OutreachPerson | null): Form => ({
  full_name: person?.full_name ?? '', designation: person?.designation ?? '', department: person?.department ?? '', contact_role: person?.contact_role ?? '', email: person?.email ?? '',
  secondary_email: person?.secondary_email ?? '', phone: person?.phone ?? '', mobile: person?.mobile ?? '', linkedin_url: person?.linkedin_url ?? '', description: person?.description ?? '',
  primary: person?.is_primary ?? false, assignedTo: person?.assigned_to ? String(person.assigned_to) : '',
})

/** Only what was filled in is sent for a new person; for an edit, only what changed (the same reasoning as the company form). */
function bodyOf(form: Form, person: OutreachPerson | null): Record<string, string | number | boolean | null> {
  const body: Record<string, string | number | boolean | null> = {}
  for (const field of TEXT_FIELDS) {
    const text = form[field].trim()
    if (person ? text !== (person[field] ?? '') : text !== '') body[field] = text
  }
  if (person ? form.primary !== person.is_primary : form.primary) body.is_primary = form.primary
  const owner = form.assignedTo ? Number(form.assignedTo) : null
  if (person ? owner !== person.assigned_to : owner !== null) body.assigned_to = owner

  return body
}

/**
 * Add a person to a company by hand, or (with `person`) correct one. `company` fixes the company (the company page, where the company is the page); without it the form asks for
 * the company. A person the web search found can be corrected too, but still counts as "Found on a public page": the source stays what it was. The form checks the same rules
 * as the server (`personFormErrors`: a company, and a name, email, phone or LinkedIn address) and shows each sentence under its box.
 */
export function AddPersonDialog({ open, onOpenChange, service = outreachService, company = null, person = null, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  service?: OutreachApi
  /** The company the person is added to; null asks for one. Ignored when editing (a person stays at their company). */
  company?: PickedCompany | null
  /** The person being edited; null adds a new one. */
  person?: OutreachPerson | null
  onSaved: (person: OutreachPerson) => void
}) {
  const fresh = useFreshKey(open)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <PersonForm key={fresh} service={service} company={company} person={person} onClose={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}

function PersonForm({ service, company, person, onClose, onSaved }: {
  service: OutreachApi
  company: PickedCompany | null
  person: OutreachPerson | null
  onClose: () => void
  onSaved: (person: OutreachPerson) => void
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)
  const editing = person !== null
  const [form, setForm] = useState<Form>(() => blank(person))
  const [picked, setPicked] = useState<PickedCompany | null>(person ? { id: person.company_id, name: person.company_name } : company)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refused, setRefused] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState('')

  const set = (key: Field) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setRefused((current) => { const { [key]: _gone, ...rest } = current; return rest })
  }

  const checks = personFormErrors({ company_id: picked?.id ?? 0, full_name: form.full_name, email: form.email, secondary_email: form.secondary_email, phone: form.phone, mobile: form.mobile, linkedin_url: form.linkedin_url })
  const shown = (key: string) => (attempted ? (checks as Record<string, string | undefined>)[key] : undefined) ?? refused[key]
  const changes = bodyOf(form, person)
  const unchanged = editing && Object.keys(changes).length === 0

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setAttempted(true)
    if (Object.keys(checks).length > 0 || unchanged || saving || !picked) return
    setSaving(true)
    setFailure('')
    try {
      const response = person
        ? await service.updatePerson(person.id, changes as UpdatePersonBody)
        : await service.addPerson({ ...changes, company_id: picked.id } as unknown as NewPersonBody)
      onSaved(response.data)
      onClose()
    } catch (cause) {
      const fields = fieldErrors(cause)
      setRefused(fields)
      setFailure(Object.keys(fields).length > 0 ? '' : errorText(cause, 'The person could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col gap-4" noValidate>
      <DialogHeader className="mb-0 shrink-0">
        <DialogTitle>{editing ? 'Edit person' : 'Add a person'}</DialogTitle>
        <DialogDescription>
          {editing ? 'Correct the details of this person.' : 'Add someone you know at a company. Give a name, an email address or a phone number, so there is a way to reach them.'}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
        {editing || company ? (
          <div className="space-y-1.5">
            <Label>Company</Label>
            <p data-person-company className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground">{picked?.name}</p>
          </div>
        ) : (
          <CompanyPicker service={service} value={picked} onChange={setPicked} error={shown('company_id')} />
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Name" value={form.full_name} onChange={set('full_name')} error={shown('full_name')} autoFocus />
          <TextField label="Job title" value={form.designation} onChange={set('designation')} error={shown('designation')} placeholder="Principal" />
          <TextField label="Email" value={form.email} onChange={set('email')} error={shown('email')} type="email" />
          <TextField label="Phone" value={form.phone} onChange={set('phone')} error={shown('phone')} type="tel" />
          <TextField label="Mobile" value={form.mobile} onChange={set('mobile')} error={shown('mobile')} type="tel" />
          <TextField label="Second email" value={form.secondary_email} onChange={set('secondary_email')} error={shown('secondary_email')} type="email" />
          <TextField label="Department" value={form.department} onChange={set('department')} error={shown('department')} />
          <TextField label="Role in the company" value={form.contact_role} onChange={set('contact_role')} error={shown('contact_role')} placeholder="Decision maker" />
          <TextField label="LinkedIn address" value={form.linkedin_url} onChange={set('linkedin_url')} error={shown('linkedin_url')} type="url" />
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <SearchableSelect
              value={form.assignedTo}
              onChange={(value) => setForm((current) => ({ ...current, assignedTo: value }))}
              options={employees.map((employee) => ({ value: employee.id, label: employee.name }))}
              placeholder="Choose who looks after them…"
              aria-label="Owner"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={form.primary} onChange={(event) => setForm((current) => ({ ...current, primary: event.target.checked }))} />
          The main person to contact at this company
        </label>

        <TextField label="Notes" value={form.description} onChange={set('description')} error={shown('description')} multiline />
        {failure && <FormAlert text={failure} />}
      </div>

      <DialogFooter className="mt-0 shrink-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || unchanged}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add person'}</Button>
      </DialogFooter>
    </form>
  )
}
