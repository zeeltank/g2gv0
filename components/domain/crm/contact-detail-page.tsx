'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import type { Contact, CrmPicklistValue } from '@/types/crm'
import { CreateContactModal } from './create-contact-modal'

interface Props {
  contact: Contact
  onSaved: () => void
  onBack: () => void
  picklists: { salutation: CrmPicklistValue[]; leadSource: CrmPicklistValue[] }
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}

export function ContactDetailPage({ contact, onSaved, onBack, picklists }: Props) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

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
        <Button onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 size-4" aria-hidden="true" />
          Edit
        </Button>
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}

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

      <CreateContactModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        contact={contact}
        picklists={picklists}
      />
    </div>
  )
}
