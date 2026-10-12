'use client'

import { useState } from 'react'
import {
  ArrowLeft, Building2, CalendarClock, CheckCircle2, Globe, Loader2,
  Mail, MapPin, Pencil, Phone, Repeat, Star, Tag, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
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

function IconValue({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      {children}
    </span>
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

  // Three independent targets a conversion may have created - named in the
  // order the Convert dialog itself lists them (Organization, Contact, Opportunity).
  const convertedTargets = [
    lead.convertedOrganizationId && 'an Organization',
    lead.convertedContactId && 'a Contact',
    lead.convertedOpportunityId && 'an Opportunity',
  ].filter((t): t is string => !!t)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Leads" title="Back to Leads">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-sm font-semibold text-primary">
            {(lead.firstName?.[0] ?? lead.lastName[0] ?? '?').toUpperCase()}
          </div>
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

      {lead.converted && convertedTargets.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          This lead was converted to {convertedTargets.join(' and ')}.
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
        <div className="space-y-4">
          <SectionCard title="Lead Information">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ReadField label="Salutation" value={lead.salutation} />
              <ReadField label="Designation" value={lead.designation} />
              <ReadField label="Email" value={lead.email && <IconValue icon={Mail}>{lead.email}</IconValue>} />
              <ReadField label="Secondary Email" value={lead.secondaryEmail && <IconValue icon={Mail}>{lead.secondaryEmail}</IconValue>} />
              <ReadField label="Phone" value={lead.phone && <IconValue icon={Phone}>{lead.phone}</IconValue>} />
              <ReadField label="Mobile" value={lead.mobile && <IconValue icon={Phone}>{lead.mobile}</IconValue>} />
              <ReadField label="Fax" value={lead.fax} />
              <ReadField label="Website" value={lead.website && <IconValue icon={Globe}>{lead.website}</IconValue>} />
              <ReadField label="Industry" value={lead.industry && <IconValue icon={Building2}>{lead.industry}</IconValue>} />
              <ReadField label="Lead Source" value={lead.leadSource} />
              <ReadField label="Lead Status" value={lead.leadStatus} />
              <ReadField label="Rating" value={lead.rating && <IconValue icon={Star}>{lead.rating}</IconValue>} />
              <ReadField label="Annual Revenue" value={lead.annualRevenue != null ? String(lead.annualRevenue) : null} />
              <ReadField label="Number of Employees" value={lead.numberOfEmp && <IconValue icon={Users}>{lead.numberOfEmp}</IconValue>} />
            </dl>
          </SectionCard>

          <SectionCard title="Address">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ReadField label="Street" value={lead.street && <IconValue icon={MapPin}>{lead.street}</IconValue>} />
              <ReadField label="City" value={lead.city} />
              <ReadField label="State" value={lead.state} />
              <ReadField label="Country" value={lead.country} />
              <ReadField label="Postal Code" value={lead.postalCode} />
              <ReadField label="PO Box" value={lead.poBox} />
            </dl>
          </SectionCard>

          <SectionCard title="Description">
            <p className="text-sm text-foreground">{lead.description || 'No description yet.'}</p>
          </SectionCard>
        </div>
      )}

      {tab === 'activity' && (
        <EmptyState icon={<CalendarClock className="size-8" aria-hidden="true" />} title="Activity history isn't built yet" />
      )}

      {/*
        Always mounted (hidden, not unmounted, when another tab is active) -
        same reasoning as the Employee record / Leave request precedents this
        is copied from: this is what populates hasCustomFields, which decides
        whether the "Custom Fields" tab button appears at all, so it has to
        run before that tab can be clicked.
      */}
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <SectionCard title="Custom Fields">
          <CustomFieldsSection
            recordTable="crm_leads"
            recordId={Number(lead.id)}
            values={customValues}
            onChange={setCustomValues}
            onFieldsLoaded={(fields) => setHasCustomFields(fields.length > 0)}
          />
          {hasCustomFields && (
            <div className="flex items-center gap-3 pt-4">
              <Button size="sm" disabled={savingCustom} onClick={() => void saveCustomFields()}>
                {savingCustom && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
                Save
              </Button>
              {customNotice && <span className="text-xs text-muted-foreground">{customNotice}</span>}
            </div>
          )}
        </SectionCard>
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
