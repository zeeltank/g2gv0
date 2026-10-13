'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, CheckCircle2, Globe, Loader2, Mail, Phone, Pencil, Plus, Trash2, Truck, User, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { KPICard } from '@/components/shared/business/kpi-card'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { CrmAuditEntry, CrmVendor, CrmVendorContact } from '@/types/crm'
import { CreateVendorModal } from './create-vendor-modal'
import { useAssignableEmployees } from './lead-employees'
import { CrmHistoryTab } from './crm-history-tab'

interface Props {
  vendor: CrmVendor
  onSaved: () => void
  onBack: () => void
}

type Tab = 'details' | 'contacts' | 'history' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'history', label: 'History' },
]

function IconValue({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      {children}
    </span>
  )
}

function AddContactDialog({ isOpen, onClose, onAdded, vendorId }: {
  isOpen: boolean; onClose: () => void; onAdded: () => void; vendorId: string
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const [contacts, setContacts] = useState<Array<{ id: string; label: string }>>([])
  const [contactId, setContactId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !isLaravelContextReady(context)) return
    crmService.getContacts(context, { perPage: 100, sortBy: 'last_name', sortDir: 'asc' })
      .then((response) => setContacts(response.data.items.map((c) => ({ id: c.id, label: `${c.firstName ?? ''} ${c.lastName}`.trim() }))))
      .catch(() => { /* the form still works with an empty picker */ })
  }, [isOpen, context])

  const submit = async () => {
    if (!contactId) return
    setSubmitting(true)
    setError('')
    try {
      await crmService.addVendorContact(context, vendorId, contactId)
      setContactId('')
      onAdded()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add this contact.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>Link an existing Contact to this vendor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Contact</Label>
          <SearchableSelect value={contactId} onChange={setContactId} options={contacts.map((c) => ({ value: c.id, label: c.label }))} placeholder="Choose a contact…" />
        </div>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !contactId}>{submitting ? 'Adding…' : 'Add'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function VendorDetailPage({ vendor, onSaved, onBack }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)

  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [contacts, setContacts] = useState<CrmVendorContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [addContactOpen, setAddContactOpen] = useState(false)

  const [history, setHistory] = useState<CrmAuditEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const tabs = hasCustomFields ? [...BASE_TABS, { id: 'custom' as const, label: 'Custom Fields' }] : BASE_TABS

  const loadContacts = useCallback(async () => {
    setContactsLoading(true)
    try {
      const response = await crmService.getVendorContacts(context, vendor.id)
      setContacts(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setContactsLoading(false)
    }
  }, [context, vendor.id])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await crmService.getVendorHistory(context, vendor.id)
      setHistory(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setHistoryLoading(false)
    }
  }, [context, vendor.id])

  useEffect(() => {
    queueMicrotask(() => { void loadContacts(); void loadHistory() })
  }, [loadContacts, loadHistory])

  const removeContact = async (rowId: string) => {
    try {
      await crmService.removeVendorContact(context, vendor.id, rowId)
      void loadContacts()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to remove that contact.')
    }
  }

  const saveCustomFields = async () => {
    setSavingCustom(true)
    setCustomNotice(null)
    try {
      await saveCustomFieldValues('crm_vendors', Number(vendor.id), customValues)
      setCustomNotice('Saved.')
    } catch (cause: unknown) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally {
      setSavingCustom(false)
    }
  }

  const assignedToName = vendor.assignedToName ?? employees.find((e) => e.id === vendor.assignedTo)?.name ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Vendors" title="Back to Vendors">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <Truck className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{vendor.name}</h1>
            <p className="text-sm text-muted-foreground">{vendor.category || 'Vendor'} · {vendor.vendorNo}</p>
          </div>
        </div>
        <Button onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 size-4" aria-hidden="true" />
          Edit
        </Button>
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KPICard
              label="Status"
              value={vendor.isActive ? 'Active' : 'Inactive'}
              icon={vendor.isActive ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <XCircle className="size-4" aria-hidden="true" />}
            />
            <KPICard label="Category" value={vendor.category || '—'} />
            <KPICard label="Linked Contacts" value={contacts.length} icon={<User className="size-4" aria-hidden="true" />} />
          </div>

          <SectionCard title="Vendor Details">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ReadField label="Phone" value={vendor.phone && <IconValue icon={Phone}>{vendor.phone}</IconValue>} />
              <ReadField label="Email" value={vendor.email && <IconValue icon={Mail}>{vendor.email}</IconValue>} />
              <ReadField label="Website" value={vendor.website && <IconValue icon={Globe}>{vendor.website}</IconValue>} />
              <ReadField label="GL Account" value={vendor.glAccount} />
              <ReadField label="Category" value={vendor.category} />
              <ReadField
                label="Status"
                value={vendor.isActive
                  ? <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="size-3.5" aria-hidden="true" />Active</span>
                  : <span className="inline-flex items-center gap-1.5 text-muted-foreground"><XCircle className="size-3.5" aria-hidden="true" />Inactive</span>}
              />
              <ReadField label="Assigned To" value={assignedToName && <IconValue icon={User}>{assignedToName}</IconValue>} />
            </dl>
          </SectionCard>

          <SectionCard title="Address">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ReadField label="Street" value={vendor.street} />
              <ReadField label="City" value={vendor.city} />
              <ReadField label="State" value={vendor.state} />
              <ReadField label="Country" value={vendor.country} />
              <ReadField label="Postal Code" value={vendor.postalCode} />
              <ReadField label="PO Box" value={vendor.poBox} />
            </dl>
          </SectionCard>

          <SectionCard title="Description">
            <p className="text-sm text-foreground">{vendor.description || '—'}</p>
          </SectionCard>
        </div>
      )}

      {tab === 'contacts' && (
        <SectionCard
          title="Linked Contacts"
          actions={(
            <Button size="sm" variant="outline" onClick={() => setAddContactOpen(true)}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Add Contact
            </Button>
          )}
        >
          {contactsLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading contacts…
            </div>
          )}
          {!contactsLoading && contacts.length === 0 && (
            <EmptyState
              icon={<User className="size-8" aria-hidden="true" />}
              title="No contacts linked yet"
              action={(
                <Button size="sm" onClick={() => setAddContactOpen(true)}>
                  <Plus className="mr-1.5 size-4" aria-hidden="true" />
                  Add Contact
                </Button>
              )}
            />
          )}
          {!contactsLoading && contacts.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {contacts.map((row) => (
                <div key={row.id} className="flex items-center gap-3 p-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <User className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                    {row.subLabel && <p className="truncate text-xs text-muted-foreground">{row.subLabel}</p>}
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => void removeContact(row.id)} aria-label={`Remove ${row.name}`}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'history' && <CrmHistoryTab entries={history} loading={historyLoading} />}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <SectionCard title="Custom Fields">
          <CustomFieldsSection
            recordTable="crm_vendors"
            recordId={Number(vendor.id)}
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

      <CreateVendorModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        vendor={vendor}
      />
      <AddContactDialog isOpen={addContactOpen} onClose={() => setAddContactOpen(false)} onAdded={loadContacts} vendorId={vendor.id} />
    </div>
  )
}
