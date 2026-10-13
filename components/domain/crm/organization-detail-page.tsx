'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Briefcase, Building2, DollarSign, FileText, Globe, Loader2,
  Mail, MapPin, Pencil, Phone, Repeat, Send, Star, Target, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { CrmAuditEntry, CrmComment, CrmEmailLinkEntry, CrmLinkedDocument, CrmOpportunity, CrmPicklistValue, CrmQuote, Organization } from '@/types/crm'
import { CreateOrganizationModal } from './create-organization-modal'
import { OrganizationHierarchy } from './organization-hierarchy'
import { SendSmsDialog } from './send-sms-dialog'
import { useAssignableEmployees } from './lead-employees'
import { CommentThread } from './comment-thread'
import { CrmDocumentTab } from './crm-document-tab'
import { CrmEmailTab } from './crm-email-tab'
import { SendEmailDialog } from './send-email-dialog'
import { CrmHistoryTab } from './crm-history-tab'
import { CrmScheduleTab } from './crm-schedule-tab'
import { CrmProjectsTab, type LinkedProject } from './crm-projects-tab'

interface Props {
  organization: Organization
  onSaved: () => void
  onBack: () => void
  picklists: { accountType: CrmPicklistValue[]; industry: CrmPicklistValue[]; rating: CrmPicklistValue[] }
}

type Tab = 'details' | 'hierarchy' | 'opportunities' | 'quotes' | 'schedule' | 'comments' | 'documents' | 'emails' | 'history' | 'projects' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'hierarchy', label: 'Hierarchy' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'comments', label: 'Comments' },
  { id: 'documents', label: 'Documents' },
  { id: 'emails', label: 'Emails' },
  { id: 'history', label: 'History' },
  { id: 'projects', label: 'Projects' },
]

function IconValue({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      {children}
    </span>
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
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [sendSmsOpen, setSendSmsOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([])
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true)
  const [quotes, setQuotes] = useState<CrmQuote[]>([])
  const [quotesLoading, setQuotesLoading] = useState(true)

  const [comments, setComments] = useState<CrmComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [documents, setDocuments] = useState<CrmLinkedDocument[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [emails, setEmails] = useState<CrmEmailLinkEntry[]>([])
  const [emailsLoading, setEmailsLoading] = useState(true)
  const [composeEmailOpen, setComposeEmailOpen] = useState(false)
  const [history, setHistory] = useState<CrmAuditEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [linkedProjects, setLinkedProjects] = useState<LinkedProject[]>([])
  const [linkedProjectsLoading, setLinkedProjectsLoading] = useState(true)

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const tabs = hasCustomFields ? [...BASE_TABS, { id: 'custom' as const, label: 'Custom Fields' }] : BASE_TABS

  const loadOpportunities = useCallback(async () => {
    setOpportunitiesLoading(true)
    try {
      const response = await crmService.getOpportunities(context, { organizationId: organization.id, perPage: 50 })
      setOpportunities(response.data.items)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setOpportunitiesLoading(false)
    }
  }, [context, organization.id])

  const loadQuotes = useCallback(async () => {
    setQuotesLoading(true)
    try {
      const response = await crmService.getQuotes(context, { organizationId: organization.id, perPage: 50 })
      setQuotes(response.data.items)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setQuotesLoading(false)
    }
  }, [context, organization.id])

  const loadComments = useCallback(async () => {
    setCommentsLoading(true)
    try {
      const response = await crmService.getOrganizationComments(context, organization.id)
      setComments(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setCommentsLoading(false)
    }
  }, [context, organization.id])

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true)
    try {
      const response = await crmService.getOrganizationDocuments(context, organization.id)
      setDocuments(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setDocumentsLoading(false)
    }
  }, [context, organization.id])

  const loadEmails = useCallback(async () => {
    setEmailsLoading(true)
    try {
      const response = await crmService.getOrganizationEmails(context, organization.id)
      setEmails(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setEmailsLoading(false)
    }
  }, [context, organization.id])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await crmService.getOrganizationHistory(context, organization.id)
      setHistory(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setHistoryLoading(false)
    }
  }, [context, organization.id])

  const loadLinkedProjects = useCallback(async () => {
    setLinkedProjectsLoading(true)
    try {
      const response = await crmService.getOrganizationProjects(context, organization.id)
      setLinkedProjects(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setLinkedProjectsLoading(false)
    }
  }, [context, organization.id])

  useEffect(() => {
    queueMicrotask(() => {
      void loadOpportunities(); void loadQuotes(); void loadComments()
      void loadDocuments(); void loadEmails(); void loadHistory(); void loadLinkedProjects()
    })
  }, [loadOpportunities, loadQuotes, loadComments, loadDocuments, loadEmails, loadHistory, loadLinkedProjects])

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
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Organizations" title="Back to Organizations">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <Building2 className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{organization.name}</h1>
            <p className="text-sm text-muted-foreground">{organization.accountType || 'Organization'} · {organization.accountNo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {organization.phone && (
            <Button variant="outline" onClick={() => setSendSmsOpen(true)}>
              <Send className="mr-1.5 size-4" aria-hidden="true" />
              Send SMS
            </Button>
          )}
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
        <div className="space-y-4">
          <SectionCard title="Organization Details">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ReadField label="Type" value={organization.accountType} />
              <ReadField label="Industry" value={organization.industry && <IconValue icon={Briefcase}>{organization.industry}</IconValue>} />
              <ReadField label="Rating" value={organization.rating && <IconValue icon={Star}>{organization.rating}</IconValue>} />
              <ReadField label="Ownership" value={organization.ownership} />
              <ReadField label="Employees" value={organization.employees && <IconValue icon={Users}>{organization.employees}</IconValue>} />
              <ReadField label="Annual Revenue" value={organization.annualRevenue && <IconValue icon={DollarSign}>{organization.annualRevenue}</IconValue>} />
              <ReadField label="Phone" value={organization.phone && <IconValue icon={Phone}>{organization.phone}</IconValue>} />
              <ReadField label="Secondary Phone" value={organization.secondaryPhone && <IconValue icon={Phone}>{organization.secondaryPhone}</IconValue>} />
              <ReadField label="Email" value={organization.email && <IconValue icon={Mail}>{organization.email}</IconValue>} />
              <ReadField label="Secondary Email" value={organization.secondaryEmail && <IconValue icon={Mail}>{organization.secondaryEmail}</IconValue>} />
              <ReadField label="Website" value={organization.website && <IconValue icon={Globe}>{organization.website}</IconValue>} />
              <ReadField label="Fax" value={organization.fax} />
            </dl>
          </SectionCard>

          <SectionCard title="Billing Address">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ReadField label="Street" value={organization.billingStreet && <IconValue icon={MapPin}>{organization.billingStreet}</IconValue>} />
              <ReadField label="City" value={organization.billingCity} />
              <ReadField label="State" value={organization.billingState} />
              <ReadField label="Country" value={organization.billingCountry} />
              <ReadField label="Postal Code" value={organization.billingCode} />
              <ReadField label="PO Box" value={organization.billingPoBox} />
            </dl>
          </SectionCard>

          <SectionCard title="Description">
            <p className="text-sm text-foreground">{organization.description || '—'}</p>
          </SectionCard>
        </div>
      )}

      {tab === 'hierarchy' && (
        <SectionCard title="Organization Hierarchy">
          <OrganizationHierarchy organizationId={organization.id} />
        </SectionCard>
      )}

      {tab === 'opportunities' && (
        <SectionCard title="Opportunities">
          {opportunitiesLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading opportunities…
            </div>
          )}
          {!opportunitiesLoading && opportunities.length === 0 && (
            <EmptyState icon={<Target className="size-8" aria-hidden="true" />} title="No opportunities yet" description="Deals linked to this organization will show up here." />
          )}
          {!opportunitiesLoading && opportunities.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {opportunities.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                  onClick={() => router.push(resolveAccessLink('/module/crm/sales/opportunities') + `/${row.id}`)}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Target className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.salesStage || 'Opportunity'} · {row.opportunityNo}</p>
                  </div>
                  {row.amount !== null && (
                    <p className="shrink-0 text-sm font-semibold text-foreground">{row.currency ?? ''} {row.amount.toLocaleString()}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'quotes' && (
        <SectionCard title="Quotes">
          {quotesLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading quotes…
            </div>
          )}
          {!quotesLoading && quotes.length === 0 && (
            <EmptyState icon={<FileText className="size-8" aria-hidden="true" />} title="No quotes yet" description="Quotes linked to this organization will show up here." />
          )}
          {!quotesLoading && quotes.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {quotes.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                  onClick={() => router.push(resolveAccessLink('/module/crm/sales/quotes') + `/${row.id}`)}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{row.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.quoteStage || 'Draft'} · {row.quoteNo}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-foreground">
                    {row.currency ?? ''} {row.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'schedule' && (
        <CrmScheduleTab linkedType="ORGANIZATION" linkedId={organization.id} recordLabel={organization.name} />
      )}

      {tab === 'comments' && (
        <SectionCard title="Comments">
          <CommentThread
            comments={comments}
            loading={commentsLoading}
            onAdd={async (text) => {
              await crmService.addOrganizationComment(context, organization.id, text)
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
            await crmService.attachOrganizationDocument(context, organization.id, file)
            void loadDocuments()
          }}
        />
      )}

      {tab === 'emails' && (
        <CrmEmailTab emails={emails} loading={emailsLoading} onCompose={() => setComposeEmailOpen(true)} />
      )}

      {tab === 'history' && <CrmHistoryTab entries={history} loading={historyLoading} />}

      {tab === 'projects' && (
        <SectionCard title="Linked Projects" description="Task Management projects tied to this organization.">
          <CrmProjectsTab projects={linkedProjects} loading={linkedProjectsLoading} />
        </SectionCard>
      )}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <SectionCard title="Custom Fields">
          <CustomFieldsSection
            recordTable="crm_organizations"
            recordId={Number(organization.id)}
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
      <SendSmsDialog
        isOpen={sendSmsOpen}
        onClose={() => setSendSmsOpen(false)}
        onSent={(message) => { setNotice(message); setSendSmsOpen(false) }}
        defaultToNumber={organization.phone}
        relatedType="organization"
        relatedId={organization.id}
      />
      <SendEmailDialog
        isOpen={composeEmailOpen}
        onClose={() => setComposeEmailOpen(false)}
        onSent={(message) => { setNotice(message); setComposeEmailOpen(false); void loadEmails() }}
        linkedType="ORGANIZATION"
        linkedId={organization.id}
        defaultToAddress={organization.email}
      />
    </div>
  )
}
