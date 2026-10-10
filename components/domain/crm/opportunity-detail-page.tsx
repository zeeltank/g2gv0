'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { CrmOpportunity, CrmOpportunityContact, CrmOpportunityProduct, CrmPicklistValue } from '@/types/crm'
import { CreateOpportunityModal } from './create-opportunity-modal'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  opportunity: CrmOpportunity
  onSaved: () => void
  onBack: () => void
  picklists: { salesStage: CrmPicklistValue[]; leadSource: CrmPicklistValue[]; potentialType: CrmPicklistValue[]; forecastCategory: CrmPicklistValue[] }
}

type Tab = 'details' | 'contacts' | 'products' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'products', label: 'Products & Services' },
]

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value ?? '—'}</p>
    </div>
  )
}

function AddContactDialog({ isOpen, onClose, onAdded, opportunityId }: {
  isOpen: boolean; onClose: () => void; onAdded: () => void; opportunityId: string
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
      await crmService.addOpportunityContact(context, opportunityId, contactId)
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
          <DialogDescription>Link an existing Contact to this opportunity.</DialogDescription>
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

function AddProductDialog({ isOpen, onClose, onAdded, opportunityId }: {
  isOpen: boolean; onClose: () => void; onAdded: () => void; opportunityId: string
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const [products, setProducts] = useState<Array<{ id: string; label: string }>>([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !isLaravelContextReady(context)) return
    Promise.all([
      crmService.getProducts(context, 'product', { perPage: 100, sortBy: 'name', sortDir: 'asc' }),
      crmService.getProducts(context, 'service', { perPage: 100, sortBy: 'name', sortDir: 'asc' }),
    ])
      .then(([products, services]) => setProducts([...products.data.items, ...services.data.items].map((p) => ({ id: p.id, label: p.name }))))
      .catch(() => { /* the form still works with an empty picker */ })
  }, [isOpen, context])

  const submit = async () => {
    if (!productId) return
    setSubmitting(true)
    setError('')
    try {
      await crmService.addOpportunityProduct(context, opportunityId, productId, Number(quantity) || 1)
      setProductId('')
      setQuantity('1')
      onAdded()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add this product.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Product / Service</DialogTitle>
          <DialogDescription>Tag a Product or Service this opportunity is interested in - no pricing here, that&apos;s what a Quote is for.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product / Service</Label>
            <SearchableSelect value={productId} onChange={setProductId} options={products.map((p) => ({ value: p.id, label: p.label }))} placeholder="Choose one…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-prod-qty">Quantity</Label>
            <Input id="add-prod-qty" type="number" min={0.01} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        </div>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !productId}>{submitting ? 'Adding…' : 'Add'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function OpportunityDetailPage({ opportunity, onSaved, onBack, picklists }: Props) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)

  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [contacts, setContacts] = useState<CrmOpportunityContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [addContactOpen, setAddContactOpen] = useState(false)

  const [products, setProducts] = useState<CrmOpportunityProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [addProductOpen, setAddProductOpen] = useState(false)

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const tabs = hasCustomFields ? [...BASE_TABS, { id: 'custom' as const, label: 'Custom Fields' }] : BASE_TABS

  const loadContacts = useCallback(async () => {
    setContactsLoading(true)
    try {
      const response = await crmService.getOpportunityContacts(context, opportunity.id)
      setContacts(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setContactsLoading(false)
    }
  }, [context, opportunity.id])

  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    try {
      const response = await crmService.getOpportunityProducts(context, opportunity.id)
      setProducts(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setProductsLoading(false)
    }
  }, [context, opportunity.id])

  useEffect(() => {
    queueMicrotask(() => { void loadContacts(); void loadProducts() })
  }, [loadContacts, loadProducts])

  const removeContact = async (rowId: string) => {
    try {
      await crmService.removeOpportunityContact(context, opportunity.id, rowId)
      void loadContacts()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to remove that contact.')
    }
  }

  const removeProduct = async (rowId: string) => {
    try {
      await crmService.removeOpportunityProduct(context, opportunity.id, rowId)
      void loadProducts()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to remove that product.')
    }
  }

  const saveCustomFields = async () => {
    setSavingCustom(true)
    setCustomNotice(null)
    try {
      await saveCustomFieldValues('crm_opportunities', Number(opportunity.id), customValues)
      setCustomNotice('Saved.')
    } catch (cause: unknown) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally {
      setSavingCustom(false)
    }
  }

  const assignedToName = employees.find((e) => e.id === opportunity.assignedTo)?.name ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
            Back to Opportunities
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{opportunity.name}</h1>
            <p className="text-sm text-muted-foreground">{opportunity.salesStage || 'Opportunity'} · {opportunity.opportunityNo}</p>
          </div>
        </div>
        <div className="flex gap-2">
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
            <h2 className="text-sm font-semibold text-foreground">Opportunity Details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">Organization</p>
                {opportunity.organizationId ? (
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => router.push(resolveAccessLink('/module/crm/marketing/organizations') + `/${opportunity.organizationId}`)}
                  >
                    {opportunity.organizationName}
                  </button>
                ) : (
                  <p className="text-sm text-foreground">—</p>
                )}
              </div>
              <Field label="Campaign" value={opportunity.campaignName} />
              <Field label="Amount" value={opportunity.amount !== null ? `${opportunity.currency ?? ''} ${opportunity.amount.toLocaleString()}`.trim() : null} />
              <Field label="Weighted Revenue" value={opportunity.weightedRevenue !== null ? `${opportunity.currency ?? ''} ${opportunity.weightedRevenue.toLocaleString()}`.trim() : null} />
              <Field label="Probability" value={opportunity.probability !== null ? `${opportunity.probability}%` : null} />
              <Field label="Closing Date" value={opportunity.closingDate} />
              <Field label="Lead Source" value={opportunity.leadSource} />
              <Field label="Type" value={opportunity.potentialType} />
              <Field label="Forecast Category" value={opportunity.forecastCategory} />
              <Field label="Next Step" value={opportunity.nextStep} />
              <Field label="Assigned To" value={assignedToName} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Description</h2>
            <p className="text-sm text-foreground">{opportunity.description || '—'}</p>
          </section>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Linked Contacts</h2>
            <Button size="sm" variant="outline" onClick={() => setAddContactOpen(true)}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Add Contact
            </Button>
          </div>
          {contactsLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading contacts…
            </div>
          )}
          {!contactsLoading && contacts.length === 0 && <p className="py-6 text-sm text-muted-foreground">No contacts linked yet.</p>}
          {!contactsLoading && contacts.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {contacts.map((row) => (
                <div key={row.id} className="flex items-center gap-3 p-3">
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
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Products & Services of Interest</h2>
            <Button size="sm" variant="outline" onClick={() => setAddProductOpen(true)}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Add Product
            </Button>
          </div>
          {productsLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading products…
            </div>
          )}
          {!productsLoading && products.length === 0 && <p className="py-6 text-sm text-muted-foreground">Nothing tagged yet.</p>}
          {!productsLoading && products.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {products.map((row) => (
                <div key={row.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.itemType === 'service' ? 'Service' : 'Product'} · Qty {row.quantity}</p>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => void removeProduct(row.id)} aria-label={`Remove ${row.name}`}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? 'space-y-4 rounded-lg border border-border p-4' : 'hidden'}>
        <CustomFieldsSection
          recordTable="crm_opportunities"
          recordId={Number(opportunity.id)}
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

      <CreateOpportunityModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        opportunity={opportunity}
        picklists={picklists}
      />
      <AddContactDialog isOpen={addContactOpen} onClose={() => setAddContactOpen(false)} onAdded={loadContacts} opportunityId={opportunity.id} />
      <AddProductDialog isOpen={addProductOpen} onClose={() => setAddProductOpen(false)} onAdded={loadProducts} opportunityId={opportunity.id} />
    </div>
  )
}
