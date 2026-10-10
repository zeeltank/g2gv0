'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Pencil, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { getLaravelContext } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { Contact, CrmPicklistValue } from '@/types/crm'
import { CreateContactModal } from './create-contact-modal'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  contact: Contact
  onSaved: () => void
  onBack: () => void
  picklists: { salutation: CrmPicklistValue[]; leadSource: CrmPicklistValue[] }
}

type Tab = 'details' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
]

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}

/** Same single-record transfer pattern as Organizations' own dialog - no cascade option here, Contacts have no sub-records of their own to cascade to. */
function TransferOwnershipDialog({ isOpen, onClose, onTransferred, contactId }: {
  isOpen: boolean; onClose: () => void; onTransferred: (message: string) => void; contactId: string
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const [assignedTo, setAssignedTo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!assignedTo) { setError('Choose who to assign this contact to.'); return }
    setSubmitting(true)
    setError('')
    try {
      const response = await crmService.transferContactOwnership(context, contactId, assignedTo)
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
          <DialogTitle>Transfer Ownership</DialogTitle>
          <DialogDescription>Reassign this contact to a different owner.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label>New Owner *</Label>
            <SearchableSelect value={assignedTo} onChange={setAssignedTo} options={employees.map((e) => ({ value: e.id, label: e.name }))} placeholder="Choose an employee…" />
          </div>
          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting}>{submitting ? 'Transferring…' : 'Transfer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ContactDetailPage({ contact, onSaved, onBack, picklists }: Props) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const tabs = hasCustomFields ? [...BASE_TABS, { id: 'custom' as const, label: 'Custom Fields' }] : BASE_TABS

  const saveCustomFields = async () => {
    setSavingCustom(true)
    setCustomNotice(null)
    try {
      await saveCustomFieldValues('crm_contacts', Number(contact.id), customValues)
      setCustomNotice('Saved.')
    } catch (cause: unknown) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally {
      setSavingCustom(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
            Back to Contacts
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {contact.salutation ? `${contact.salutation} ` : ''}{contact.firstName ? `${contact.firstName} ` : ''}{contact.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {contact.title ? `${contact.title} · ` : ''}
              {contact.organizationId ? (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => router.push(resolveAccessLink('/module/crm/marketing/organizations') + `/${contact.organizationId}`)}
                >
                  {contact.organizationName}
                </button>
              ) : 'No organization'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTransferOpen(true)}>
            <Repeat className="mr-1.5 size-4" aria-hidden="true" />
            Transfer Ownership
          </Button>
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 size-4" aria-hidden="true" />
            Edit
          </Button>
        </div>
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
      <div className="space-y-6 rounded-lg border border-border p-4">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Contact Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Department" value={contact.department} />
            <Field label="Email" value={contact.email} />
            <Field label="Secondary Email" value={contact.secondaryEmail} />
            <Field label="Phone" value={contact.phone} />
            <Field label="Mobile" value={contact.mobile} />
            <Field label="Fax" value={contact.fax} />
            <Field label="Home Phone" value={contact.homePhone} />
            <Field label="Lead Source" value={contact.leadSource} />
            <Field label="Do Not Call" value={contact.doNotCall ? 'Yes' : 'No'} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Mailing Address</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Street" value={contact.mailingStreet} />
            <Field label="City" value={contact.mailingCity} />
            <Field label="State" value={contact.mailingState} />
            <Field label="Country" value={contact.mailingCountry} />
            <Field label="Postal Code" value={contact.mailingCode} />
            <Field label="PO Box" value={contact.mailingPoBox} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Description</h2>
          <p className="text-sm text-foreground">{contact.description || '—'}</p>
        </section>
      </div>
      )}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? 'space-y-4 rounded-lg border border-border p-4' : 'hidden'}>
        <CustomFieldsSection
          recordTable="crm_contacts"
          recordId={Number(contact.id)}
          values={customValues}
          onChange={setCustomValues}
          onFieldsLoaded={(fields) => setHasCustomFields(fields.length > 0)}
        />
        {hasCustomFields && (
          <div className="flex items-center gap-3 pt-2">
            <Button size="sm" disabled={savingCustom} onClick={() => void saveCustomFields()}>
              {savingCustom && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
              Save
            </Button>
            {customNotice && <span className="text-xs text-muted-foreground">{customNotice}</span>}
          </div>
        )}
      </div>

      <CreateContactModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        contact={contact}
        picklists={picklists}
      />
      <TransferOwnershipDialog
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        onTransferred={(message) => { setNotice(message); setTransferOpen(false); onSaved() }}
        contactId={contact.id}
      />
    </div>
  )
}
