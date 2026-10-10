'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Pencil, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { CrmPicklistValue, Organization } from '@/types/crm'
import { CreateOrganizationModal } from './create-organization-modal'
import { OrganizationHierarchy } from './organization-hierarchy'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  organization: Organization
  onSaved: () => void
  onBack: () => void
  picklists: { accountType: CrmPicklistValue[]; industry: CrmPicklistValue[]; rating: CrmPicklistValue[] }
}

type Tab = 'details' | 'hierarchy' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'hierarchy', label: 'Hierarchy' },
]

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value ?? '—'}</p>
    </div>
  )
}

function TransferOwnershipDialog({ isOpen, onClose, onTransferred, organizationId }: {
  isOpen: boolean; onClose: () => void; onTransferred: (message: string) => void; organizationId: string
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const [assignedTo, setAssignedTo] = useState('')
  const [cascade, setCascade] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!assignedTo) { setError('Choose who to assign this organization to.'); return }
    setSubmitting(true)
    setError('')
    try {
      const response = await crmService.transferOrganizationOwnership(context, organizationId, assignedTo, cascade)
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
          <DialogDescription>Reassign this organization to a different owner.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label>New Owner *</Label>
            <SearchableSelect value={assignedTo} onChange={setAssignedTo} options={employees.map((e) => ({ value: e.id, label: e.name }))} placeholder="Choose an employee…" />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="cascade-contacts" className="cursor-pointer">Also transfer this organization’s contacts</Label>
            <Switch id="cascade-contacts" checked={cascade} onChange={(e) => setCascade(e.target.checked)} />
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

export function OrganizationDetailPage({ organization, onSaved, onBack, picklists }: Props) {
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
      await saveCustomFieldValues('crm_organizations', Number(organization.id), customValues)
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
            Back to Organizations
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{organization.name}</h1>
            <p className="text-sm text-muted-foreground">{organization.accountType || 'Organization'} · {organization.accountNo}</p>
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
            <h2 className="text-sm font-semibold text-foreground">Organization Details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Type" value={organization.accountType} />
              <Field label="Industry" value={organization.industry} />
              <Field label="Rating" value={organization.rating} />
              <Field label="Ownership" value={organization.ownership} />
              <Field label="Employees" value={organization.employees} />
              <Field label="Annual Revenue" value={organization.annualRevenue} />
              <Field label="Phone" value={organization.phone} />
              <Field label="Secondary Phone" value={organization.secondaryPhone} />
              <Field label="Email" value={organization.email} />
              <Field label="Secondary Email" value={organization.secondaryEmail} />
              <Field label="Website" value={organization.website} />
              <Field label="Fax" value={organization.fax} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Billing Address</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Street" value={organization.billingStreet} />
              <Field label="City" value={organization.billingCity} />
              <Field label="State" value={organization.billingState} />
              <Field label="Country" value={organization.billingCountry} />
              <Field label="Postal Code" value={organization.billingCode} />
              <Field label="PO Box" value={organization.billingPoBox} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Description</h2>
            <p className="text-sm text-foreground">{organization.description || '—'}</p>
          </section>
        </div>
      )}

      {tab === 'hierarchy' && (
        <div className="rounded-lg border border-border p-4">
          <OrganizationHierarchy organizationId={organization.id} />
        </div>
      )}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? 'space-y-4 rounded-lg border border-border p-4' : 'hidden'}>
        <CustomFieldsSection
          recordTable="crm_organizations"
          recordId={Number(organization.id)}
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

      <CreateOrganizationModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        organization={organization}
        picklists={picklists}
      />
      <TransferOwnershipDialog
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        onTransferred={(message) => { setNotice(message); setTransferOpen(false); onSaved() }}
        organizationId={organization.id}
      />
    </div>
  )
}
