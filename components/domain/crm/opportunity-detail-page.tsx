'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CalendarClock, DollarSign, FileCheck2, FileText, Loader2, Package, Pencil, Percent,
  Plus, Send, Sparkles, Tag, Trash2, TrendingUp, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { KPICard } from '@/components/shared/business/kpi-card'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { CrmComment, CrmEmailLinkEntry, CrmLinkedDocument, CrmOpportunity, CrmOpportunityContact, CrmOpportunityProduct, CrmOpportunityStageHistoryEntry, CrmPicklistValue, CrmQuote } from '@/types/crm'
import { CreateOpportunityModal } from './create-opportunity-modal'
import { CreateQuoteModal } from './create-quote-modal'
import { useAssignableEmployees } from './lead-employees'
import { SendSmsDialog } from './send-sms-dialog'
import { CommentThread } from './comment-thread'
import { CrmDocumentTab } from './crm-document-tab'
import { CrmEmailTab } from './crm-email-tab'
import { SendEmailDialog } from './send-email-dialog'
import { CrmScheduleTab } from './crm-schedule-tab'
import { CrmProjectsTab, type LinkedProject } from './crm-projects-tab'
import { OpportunityAiCoachTab } from './opportunity-ai-coach-tab'

interface Props {
  opportunity: CrmOpportunity
  onSaved: () => void
  onBack: () => void
  picklists: { salesStage: CrmPicklistValue[]; leadSource: CrmPicklistValue[]; potentialType: CrmPicklistValue[]; forecastCategory: CrmPicklistValue[] }
}

type Tab = 'details' | 'ai-coach' | 'contacts' | 'products' | 'quotes' | 'history' | 'schedule' | 'comments' | 'documents' | 'emails' | 'projects' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'ai-coach', label: 'AI Deal Coach & MEDDPICC' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'products', label: 'Products & Services' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'history', label: 'Stage History' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'comments', label: 'Comments' },
  { id: 'documents', label: 'Documents' },
  { id: 'emails', label: 'Emails' },
  { id: 'projects', label: 'Projects' },
]

function IconValue({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      {children}
    </span>
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
  const [sendSmsOpen, setSendSmsOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [contacts, setContacts] = useState<CrmOpportunityContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [addContactOpen, setAddContactOpen] = useState(false)

  const [products, setProducts] = useState<CrmOpportunityProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [addProductOpen, setAddProductOpen] = useState(false)

  const [quotes, setQuotes] = useState<CrmQuote[]>([])
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [createQuoteOpen, setCreateQuoteOpen] = useState(false)
  const [quoteStages, setQuoteStages] = useState<CrmPicklistValue[]>([])

  const [stageHistory, setStageHistory] = useState<CrmOpportunityStageHistoryEntry[]>([])
  const [stageHistoryLoading, setStageHistoryLoading] = useState(true)

  const [comments, setComments] = useState<CrmComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [documents, setDocuments] = useState<CrmLinkedDocument[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [emails, setEmails] = useState<CrmEmailLinkEntry[]>([])
  const [emailsLoading, setEmailsLoading] = useState(true)
  const [composeEmailOpen, setComposeEmailOpen] = useState(false)
  const [linkedProjects, setLinkedProjects] = useState<LinkedProject[]>([])
  const [linkedProjectsLoading, setLinkedProjectsLoading] = useState(true)

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

  const loadQuotes = useCallback(async () => {
    setQuotesLoading(true)
    try {
      const response = await crmService.getQuotes(context, { opportunityId: opportunity.id, perPage: 50 })
      setQuotes(response.data.items)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setQuotesLoading(false)
    }
  }, [context, opportunity.id])

  const loadStageHistory = useCallback(async () => {
    setStageHistoryLoading(true)
    try {
      const response = await crmService.getOpportunityStageHistory(context, opportunity.id)
      setStageHistory(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setStageHistoryLoading(false)
    }
  }, [context, opportunity.id])

  const loadComments = useCallback(async () => {
    setCommentsLoading(true)
    try {
      const response = await crmService.getOpportunityComments(context, opportunity.id)
      setComments(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setCommentsLoading(false)
    }
  }, [context, opportunity.id])

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true)
    try {
      const response = await crmService.getOpportunityDocuments(context, opportunity.id)
      setDocuments(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setDocumentsLoading(false)
    }
  }, [context, opportunity.id])

  const loadEmails = useCallback(async () => {
    setEmailsLoading(true)
    try {
      const response = await crmService.getOpportunityEmails(context, opportunity.id)
      setEmails(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setEmailsLoading(false)
    }
  }, [context, opportunity.id])

  const loadLinkedProjects = useCallback(async () => {
    setLinkedProjectsLoading(true)
    try {
      const response = await crmService.getOpportunityProjects(context, opportunity.id)
      setLinkedProjects(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setLinkedProjectsLoading(false)
    }
  }, [context, opportunity.id])

  useEffect(() => {
    queueMicrotask(() => {
      void loadContacts(); void loadProducts(); void loadQuotes(); void loadStageHistory()
      void loadComments(); void loadDocuments(); void loadEmails(); void loadLinkedProjects()
    })
  }, [loadContacts, loadProducts, loadQuotes, loadStageHistory, loadComments, loadDocuments, loadEmails, loadLinkedProjects])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'quotes')
      .then((response) => setQuoteStages(response.data.quotes?.quote_stage ?? []))
      .catch(() => { /* the New Quote modal still works with an empty stage dropdown */ })
  }, [context])

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
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Opportunities" title="Back to Opportunities">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <TrendingUp className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{opportunity.name}</h1>
            <p className="text-sm text-muted-foreground">{opportunity.salesStage || 'Opportunity'} · {opportunity.opportunityNo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSendSmsOpen(true)}>
            <Send className="mr-1.5 size-4" aria-hidden="true" />
            Send SMS
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KPICard
              label="Amount"
              value={opportunity.amount !== null ? `${opportunity.currency ?? ''} ${opportunity.amount.toLocaleString()}`.trim() : '—'}
              icon={<DollarSign className="size-4" aria-hidden="true" />}
            />
            <KPICard
              label="Weighted Revenue"
              value={opportunity.weightedRevenue !== null ? `${opportunity.currency ?? ''} ${opportunity.weightedRevenue.toLocaleString()}`.trim() : '—'}
              icon={<DollarSign className="size-4" aria-hidden="true" />}
            />
            <KPICard
              label="Probability"
              value={opportunity.probability !== null ? `${opportunity.probability}%` : '—'}
              icon={<Percent className="size-4" aria-hidden="true" />}
            />
          </div>

          {opportunity.probability !== null && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Win Probability</span>
                <span className="text-sm font-semibold tabular-nums">{opportunity.probability}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${opportunity.probability >= 70 ? 'bg-green-500' : opportunity.probability >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${opportunity.probability}%` }}
                />
              </div>
              <div className="flex justify-end">
                <span className="inline-flex items-center gap-1 text-xs text-purple-500">
                  <Sparkles className="size-3" />
                  AI-assisted scoring
                </span>
              </div>
            </div>
          )}

          <SectionCard title="Opportunity Details">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organization</dt>
                <dd className="text-sm font-medium text-foreground">
                  {opportunity.organizationId ? (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => router.push(resolveAccessLink('/module/crm/marketing/organizations') + `/${opportunity.organizationId}`)}
                    >
                      {opportunity.organizationName}
                    </button>
                  ) : '—'}
                </dd>
              </div>
              <ReadField label="Campaign" value={opportunity.campaignName} />
              <ReadField label="Closing Date" value={opportunity.closingDate && <IconValue icon={CalendarClock}>{opportunity.closingDate}</IconValue>} />
              <ReadField label="Lead Source" value={opportunity.leadSource} />
              <ReadField label="Type" value={opportunity.potentialType && <IconValue icon={Tag}>{opportunity.potentialType}</IconValue>} />
              <ReadField label="Forecast Category" value={opportunity.forecastCategory} />
              <ReadField label="Next Step" value={opportunity.nextStep} />
              <ReadField label="Assigned To" value={assignedToName && <IconValue icon={User}>{assignedToName}</IconValue>} />
              {opportunity.convertedFromGtmDealId && (
                <ReadField label="Source" value={`Converted from GTM Deal #${opportunity.convertedFromGtmDealId}`} />
              )}
            </dl>
          </SectionCard>

          <SectionCard title="Description">
            <p className="text-sm text-foreground">{opportunity.description || '—'}</p>
          </SectionCard>

          {opportunity.closeReason && (
            <SectionCard title="Reason Lost">
              <p className="text-sm text-foreground">{opportunity.closeReason}</p>
            </SectionCard>
          )}
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

      {tab === 'products' && (
        <SectionCard
          title="Products & Services of Interest"
          actions={(
            <Button size="sm" variant="outline" onClick={() => setAddProductOpen(true)}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Add Product
            </Button>
          )}
        >
          {productsLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading products…
            </div>
          )}
          {!productsLoading && products.length === 0 && (
            <EmptyState
              icon={<Package className="size-8" aria-hidden="true" />}
              title="Nothing tagged yet"
              action={(
                <Button size="sm" onClick={() => setAddProductOpen(true)}>
                  <Plus className="mr-1.5 size-4" aria-hidden="true" />
                  Add Product
                </Button>
              )}
            />
          )}
          {!productsLoading && products.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {products.map((row) => (
                <div key={row.id} className="flex items-center gap-3 p-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Package className="size-4" aria-hidden="true" />
                  </div>
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
        </SectionCard>
      )}

      {tab === 'quotes' && (
        <SectionCard
          title="Quotes"
          actions={(
            <Button size="sm" variant="outline" onClick={() => setCreateQuoteOpen(true)}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              New Quote
            </Button>
          )}
        >
          {quotesLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading quotes…
            </div>
          )}
          {!quotesLoading && quotes.length === 0 && (
            <EmptyState
              icon={<FileText className="size-8" aria-hidden="true" />}
              title="No quotes yet for this opportunity"
              action={(
                <Button size="sm" onClick={() => setCreateQuoteOpen(true)}>
                  <Plus className="mr-1.5 size-4" aria-hidden="true" />
                  New Quote
                </Button>
              )}
            />
          )}
          {!quotesLoading && quotes.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {quotes.map((quote) => (
                <button
                  key={quote.id}
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                  onClick={() => router.push(resolveAccessLink('/module/crm/sales/quotes') + `/${quote.id}`)}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{quote.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">{quote.quoteStage || 'Draft'} · {quote.quoteNo}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-foreground">
                    {quote.currency} {quote.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'history' && (
        <SectionCard title="Stage History">
          {stageHistoryLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading stage history…
            </div>
          )}
          {!stageHistoryLoading && stageHistory.length === 0 && (
            <EmptyState icon={<FileCheck2 className="size-8" aria-hidden="true" />} title="No stage changes recorded yet" />
          )}
          {!stageHistoryLoading && stageHistory.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {stageHistory.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="text-foreground">
                    {entry.fromStage || 'None'} <span className="text-muted-foreground">→</span> {entry.toStage || 'None'}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{entry.createdAt}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'schedule' && (
        <CrmScheduleTab linkedType="OPPORTUNITY" linkedId={opportunity.id} recordLabel={opportunity.name} />
      )}

      {tab === 'comments' && (
        <SectionCard title="Comments">
          <CommentThread
            comments={comments}
            loading={commentsLoading}
            onAdd={async (text) => {
              await crmService.addOpportunityComment(context, opportunity.id, text)
              void loadComments()
            }}
          />
        </SectionCard>
      )}

      {tab === 'documents' && (
        <CrmDocumentTab
          documents={documents}
          loading={documentsLoading}
          onUpload={async (file) => {
            await crmService.attachOpportunityDocument(context, opportunity.id, file)
            void loadDocuments()
          }}
        />
      )}

      {tab === 'emails' && (
        <CrmEmailTab emails={emails} loading={emailsLoading} onCompose={() => setComposeEmailOpen(true)} />
      )}

      {tab === 'projects' && (
        <SectionCard title="Linked Projects" description="Task Management projects tied to this opportunity.">
          <CrmProjectsTab projects={linkedProjects} loading={linkedProjectsLoading} />
        </SectionCard>
      )}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'ai-coach' ? '' : 'hidden'}>
        <OpportunityAiCoachTab
          opportunityId={opportunity.id}
          gtmDealId={opportunity.convertedFromGtmDealId}
          opportunityName={opportunity.name}
          salesStage={opportunity.salesStage}
          amount={opportunity.amount}
          currency={opportunity.currency}
        />
      </div>

      <div className={tab === 'custom' ? '' : 'hidden'}>
        <SectionCard title="Custom Fields">
          <CustomFieldsSection
            recordTable="crm_opportunities"
            recordId={Number(opportunity.id)}
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

      <CreateOpportunityModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        opportunity={opportunity}
        picklists={picklists}
      />
      <AddContactDialog isOpen={addContactOpen} onClose={() => setAddContactOpen(false)} onAdded={loadContacts} opportunityId={opportunity.id} />
      <AddProductDialog isOpen={addProductOpen} onClose={() => setAddProductOpen(false)} onAdded={loadProducts} opportunityId={opportunity.id} />
      <SendSmsDialog
        isOpen={sendSmsOpen}
        onClose={() => setSendSmsOpen(false)}
        onSent={(message) => { setNotice(message); setSendSmsOpen(false) }}
        relatedType="opportunity"
        relatedId={opportunity.id}
      />
      <CreateQuoteModal
        isOpen={createQuoteOpen}
        onClose={() => setCreateQuoteOpen(false)}
        onSaved={(message) => { setNotice(message); setCreateQuoteOpen(false); void loadQuotes() }}
        quote={null}
        prefill={{ organizationId: opportunity.organizationId, opportunityId: opportunity.id }}
        quoteStages={quoteStages}
      />
      <SendEmailDialog
        isOpen={composeEmailOpen}
        onClose={() => setComposeEmailOpen(false)}
        onSent={(message) => { setNotice(message); setComposeEmailOpen(false); void loadEmails() }}
        linkedType="OPPORTUNITY"
        linkedId={opportunity.id}
        defaultToAddress={null}
      />
    </div>
  )
}
