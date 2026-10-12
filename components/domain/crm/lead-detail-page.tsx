'use client'

import { useState } from 'react'
import { ArrowLeft, Loader2, Pencil, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import type { Lead } from '@/types/crm'
import { CreateLeadModal } from './create-lead-modal'
import { ConvertLeadDialog } from './convert-lead-dialog'
import type { CrmPicklistValue } from '@/types/crm'

interface Props {
  lead: Lead
  onSaved: () => void
  onBack: () => void
  picklists: {
    leadStatus: CrmPicklistValue[]; leadSource: CrmPicklistValue[]
    industry: CrmPicklistValue[]; rating: CrmPicklistValue[]
  }
}

type Tab = 'details' | 'activity' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'activity', label: 'Activity' },
]

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}

export function LeadDetailPage({ lead, onSaved, onBack, picklists }: Props) {
  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
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
      await saveCustomFieldValues('crm_leads', Number(lead.id), customValues)
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
            Back to Leads
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              {lead.firstName ? `${lead.firstName} ` : ''}{lead.lastName}
              {lead.converted && <StatusBadge variant="success">Converted</StatusBadge>}
            </h1>
            <p className="text-sm text-muted-foreground">{lead.company || 'No company'} · {lead.leadNo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!lead.converted && (
            <Button variant="outline" onClick={() => setConvertOpen(true)}>
              <Repeat className="mr-1.5 size-4" aria-hidden="true" />
              Convert
            </Button>
          )}
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 size-4" aria-hidden="true" />
            Edit
          </Button>
        </div>
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}

      {lead.converted && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          This lead was converted
          {lead.convertedOrganizationId ? ' to an Organization' : ''}
          {lead.convertedOrganizationId && lead.convertedContactId ? ' and' : ''}
          {lead.convertedContactId ? ' a Contact' : ''}.
        </div>
      )}

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="space-y-6 rounded-lg border border-border p-4">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Lead Information</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Salutation" value={lead.salutation} />
              <Field label="Email" value={lead.email} />
              <Field label="Secondary Email" value={lead.secondaryEmail} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Mobile" value={lead.mobile} />
              <Field label="Fax" value={lead.fax} />
              <Field label="Website" value={lead.website} />
              <Field label="Industry" value={lead.industry} />
              <Field label="Lead Source" value={lead.leadSource} />
              <Field label="Lead Status" value={lead.leadStatus} />
              <Field label="Rating" value={lead.rating} />
              <Field label="Annual Revenue" value={lead.annualRevenue != null ? String(lead.annualRevenue) : null} />
              <Field label="Number of Employees" value={lead.numberOfEmp} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Address</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Street" value={lead.street} />
              <Field label="City" value={lead.city} />
              <Field label="State" value={lead.state} />
              <Field label="Country" value={lead.country} />
              <Field label="Postal Code" value={lead.postalCode} />
              <Field label="PO Box" value={lead.poBox} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Description</h2>
            <p className="text-sm text-foreground">{lead.description || '—'}</p>
          </section>
        </div>
      )}

      {tab === 'activity' && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Activity history isn’t built yet.
        </div>
      )}

      {/*
        Always mounted (hidden, not unmounted, when another tab is active) -
        same reasoning as the Employee record / Leave request precedents this
        is copied from: this is what populates hasCustomFields, which decides
        whether the "Custom Fields" tab button appears at all, so it has to
        run before that tab can be clicked.
      */}
      <div className={tab === 'custom' ? 'space-y-4 rounded-lg border border-border p-4' : 'hidden'}>
        <CustomFieldsSection
          recordTable="crm_leads"
          recordId={Number(lead.id)}
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

      <CreateLeadModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        lead={lead}
        picklists={picklists}
      />
      <ConvertLeadDialog
        isOpen={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConverted={(message) => { setNotice(message); setConvertOpen(false); onSaved() }}
        lead={lead}
      />
    </div>
  )
}
