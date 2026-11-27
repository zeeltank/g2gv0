'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext } from '@/lib/laravel-context'
import { companyFormErrors } from '@/lib/signals/outreach-model'
import { outreachService, type OutreachApi } from '@/services/signals/outreach'
import type { NewCompanyBody, OutreachCompany, UpdateCompanyBody } from '@/services/signals/outreach-types'
import { useAssignableEmployees } from '@/components/domain/crm/lead-employees'
import { FormAlert, TextField } from './outreach-form-fields'
import { errorText, fieldErrors } from './outreach-parts'
import { useFreshKey } from './use-fresh-key'

type Field = 'name' | 'website' | 'industry' | 'type' | 'location' | 'state' | 'phone' | 'email' | 'description'

const TEXT_FIELDS: readonly Field[] = ['name', 'website', 'industry', 'type', 'location', 'state', 'phone', 'email', 'description']

type Form = Record<Field, string> & { assignedTo: string }

const blank = (company: OutreachCompany | null): Form => ({
  name: company?.name ?? '', website: company?.website ?? '', industry: company?.industry ?? '', type: company?.type ?? '', location: company?.location ?? '', state: company?.state ?? '',
  phone: company?.phone ?? '', email: company?.email ?? '', description: company?.description ?? '', assignedTo: company?.assigned_to ? String(company.assigned_to) : '',
})

/**
 * What goes to the server. A new company sends only the boxes that were filled in (an empty box is "nothing", not an empty word); a company being edited sends only what was
 * changed, so saving never overwrites a detail someone else filled in meanwhile with the old text this form was opened on.
 */
function bodyOf(form: Form, company: OutreachCompany | null): NewCompanyBody | UpdateCompanyBody {
  const body: Record<string, string | number | null> = {}
  for (const field of TEXT_FIELDS) {
    const text = form[field].trim()
    if (company ? text !== (company[field] ?? '') : text !== '') body[field] = text
  }
  const owner = form.assignedTo ? Number(form.assignedTo) : null
  if (company ? owner !== company.assigned_to : owner !== null) body.assigned_to = owner

  return body as unknown as NewCompanyBody | UpdateCompanyBody
}

/**
 * Add a company by hand, or (with `company`) correct one that was added by hand. A company the signals found is not edited here: the details came from the web page and the
 * signal still points at them. The form checks the same rules the server does (`companyFormErrors`) and shows each sentence under its box; whatever the server still refuses
 * is shown under the box it names, or at the top when it names none.
 */
export function AddCompanyDialog({ open, onOpenChange, service = outreachService, company = null, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  service?: OutreachApi
  /** The company being edited; null adds a new one. */
  company?: OutreachCompany | null
  onSaved: (company: OutreachCompany) => void
}) {
  const fresh = useFreshKey(open)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <CompanyForm key={fresh} service={service} company={company} onClose={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}

function CompanyForm({ service, company, onClose, onSaved }: { service: OutreachApi; company: OutreachCompany | null; onClose: () => void; onSaved: (company: OutreachCompany) => void }) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)
  const [form, setForm] = useState<Form>(() => blank(company))
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refused, setRefused] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState('')

  const set = (key: keyof Form) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setRefused((current) => { const { [key]: _gone, ...rest } = current; return rest })
  }

  const checks = companyFormErrors({ name: form.name, email: form.email, phone: form.phone })
  const shown = (key: Field) => (attempted ? checks[key] : undefined) ?? refused[key]
  const editing = company !== null
  const changes = bodyOf(form, company)
  const unchanged = editing && Object.keys(changes).length === 0

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setAttempted(true)
    if (Object.keys(checks).length > 0 || unchanged || saving) return
    setSaving(true)
    setFailure('')
    try {
      const response = company ? await service.updateCompany(company.id, changes as UpdateCompanyBody) : await service.addCompany(changes as NewCompanyBody)
      onSaved(response.data)
      onClose()
    } catch (cause) {
      const fields = fieldErrors(cause)
      setRefused(fields)
      setFailure(Object.keys(fields).length > 0 ? '' : errorText(cause, 'The company could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col gap-4" noValidate>
      <DialogHeader className="mb-0 shrink-0">
        <DialogTitle>{editing ? 'Edit company' : 'Add a company'}</DialogTitle>
        <DialogDescription>
          {editing ? 'Correct the details of this company.' : 'Add a company you know about. It appears in the list with the others, marked “Added by hand”.'}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
        <TextField label="Company name" value={form.name} onChange={set('name')} error={shown('name')} required autoFocus />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Website" value={form.website} onChange={set('website')} error={shown('website')} placeholder="example.com" />
          <TextField label="Industry" value={form.industry} onChange={set('industry')} error={shown('industry')} placeholder="Education" />
          <TextField label="Type" value={form.type} onChange={set('type')} error={shown('type')} placeholder="School" />
          <TextField label="Location" value={form.location} onChange={set('location')} error={shown('location')} placeholder="Ahmedabad" />
          <TextField label="State" value={form.state} onChange={set('state')} error={shown('state')} />
          <TextField label="Phone" value={form.phone} onChange={set('phone')} error={shown('phone')} type="tel" />
          <TextField label="Email" value={form.email} onChange={set('email')} error={shown('email')} type="email" />
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <SearchableSelect
              value={form.assignedTo}
              onChange={(value) => setForm((current) => ({ ...current, assignedTo: value }))}
              options={employees.map((employee) => ({ value: employee.id, label: employee.name }))}
              placeholder="Choose who looks after it…"
              aria-label="Owner"
            />
          </div>
        </div>
        <TextField label="Notes" value={form.description} onChange={set('description')} error={shown('description')} multiline />
        {failure && <FormAlert text={failure} />}
      </div>

      <DialogFooter className="mt-0 shrink-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || unchanged}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add company'}</Button>
      </DialogFooter>
    </form>
  )
}
