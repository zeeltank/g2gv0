'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Clock, History as HistoryIcon, LifeBuoy, Loader2, MessageSquare, Pencil, Send, Tag, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { CrmPicklistValue, CrmTicket, CrmTicketComment, CrmTicketStatusHistoryEntry } from '@/types/crm'
import { CreateTicketModal } from './create-ticket-modal'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  ticket: CrmTicket
  onSaved: () => void
  onBack: () => void
  ticketStatuses: CrmPicklistValue[]
  ticketPriorities: CrmPicklistValue[]
}

type Tab = 'details' | 'comments' | 'history' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'comments', label: 'Comments' },
  { id: 'history', label: 'History' },
]

function IconValue({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      {children}
    </span>
  )
}

/** A clickable cross-reference to another CRM record, or a muted dash when there isn't one - same LinkedField convention quote-detail-page.tsx already uses. */
function LinkedField({ label, href, name }: { label: string; href: string | null; name: string | null }) {
  const router = useRouter()
  return (
    <ReadField
      label={label}
      value={href
        ? <button type="button" className="text-primary hover:underline" onClick={() => router.push(href)}>{name}</button>
        : null}
    />
  )
}

export function TicketDetailPage({ ticket, onSaved, onBack, ticketStatuses, ticketPriorities }: Props) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)

  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [changingStatus, setChangingStatus] = useState(false)

  const [comments, setComments] = useState<CrmTicketComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  const [history, setHistory] = useState<CrmTicketStatusHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const tabs = hasCustomFields ? [...BASE_TABS, { id: 'custom' as const, label: 'Custom Fields' }] : BASE_TABS

  const loadComments = useCallback(async () => {
    setCommentsLoading(true)
    try {
      const response = await crmService.getTicketComments(context, ticket.id)
      setComments(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setCommentsLoading(false)
    }
  }, [context, ticket.id])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await crmService.getTicketStatusHistory(context, ticket.id)
      setHistory(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setHistoryLoading(false)
    }
  }, [context, ticket.id])

  useEffect(() => {
    queueMicrotask(() => { void loadComments(); void loadHistory() })
  }, [loadComments, loadHistory])

  const changeStatus = async (status: string) => {
    if (!isLaravelContextReady(context) || status === ticket.status) return
    setChangingStatus(true)
    setNotice('')
    try {
      const response = await crmService.changeTicketStatus(context, ticket.id, { status })
      setNotice(response.message)
      onSaved()
      void loadHistory()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to change this ticket’s status.')
    } finally {
      setChangingStatus(false)
    }
  }

  const postComment = async () => {
    if (!newComment.trim()) return
    setPostingComment(true)
    try {
      await crmService.addTicketComment(context, ticket.id, newComment.trim())
      setNewComment('')
      void loadComments()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to add that comment.')
    } finally {
      setPostingComment(false)
    }
  }

  const saveCustomFields = async () => {
    setSavingCustom(true)
    setCustomNotice(null)
    try {
      await saveCustomFieldValues('crm_tickets', Number(ticket.id), customValues)
      setCustomNotice('Saved.')
    } catch (cause: unknown) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally {
      setSavingCustom(false)
    }
  }

  const assignedToName = employees.find((e) => e.id === ticket.assignedTo)?.name ?? ticket.assignedToName

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Tickets" title="Back to Tickets">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <LifeBuoy className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{ticket.title}</h1>
            <p className="text-sm text-muted-foreground">{ticket.status || 'Ticket'} · {ticket.ticketNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={ticket.status ?? 'none'}
            onChange={(v) => void changeStatus(v === 'none' ? '' : v)}
            options={[{ label: '—', value: 'none' }, ...ticketStatuses.map((s) => ({ label: s.label, value: s.value }))]}
            disabled={changingStatus}
            aria-label="Change ticket status"
            className="w-40"
          />
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
          <SectionCard title="Ticket Details">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ReadField label="Status" value={ticket.status} />
              <ReadField label="Priority" value={ticket.priority} />
              <ReadField label="Severity" value={ticket.severity} />
              <ReadField label="Category" value={ticket.category && <IconValue icon={Tag}>{ticket.category}</IconValue>} />
              <LinkedField label="Organization" name={ticket.organizationName} href={ticket.organizationId ? resolveAccessLink('/module/crm/marketing/organizations') + `/${ticket.organizationId}` : null} />
              <LinkedField label="Contact" name={ticket.contactName} href={ticket.contactId ? resolveAccessLink('/module/crm/marketing/contacts') + `/${ticket.contactId}` : null} />
              <LinkedField label="Product / Service" name={ticket.productName} href={ticket.productId ? resolveAccessLink('/module/crm/sales/products') + `/${ticket.productId}` : null} />
              <LinkedField label="Asset" name={ticket.assetName} href={ticket.assetId ? resolveAccessLink('/module/crm/support/assets') + `/${ticket.assetId}` : null} />
              <LinkedField label="Service Contract" name={ticket.serviceContractNo} href={ticket.serviceContractId ? resolveAccessLink('/module/crm/support/service-contracts') + `/${ticket.serviceContractId}` : null} />
              <ReadField label="Hours" value={ticket.hours !== null ? <IconValue icon={Clock}>{ticket.hours}</IconValue> : null} />
              <ReadField label="Days" value={ticket.days !== null ? <IconValue icon={Clock}>{ticket.days}</IconValue> : null} />
              <ReadField label="Assigned To" value={assignedToName && <IconValue icon={User}>{assignedToName}</IconValue>} />
            </dl>
          </SectionCard>

          <SectionCard title="Description">
            <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.description || 'No description yet.'}</p>
          </SectionCard>

          <SectionCard title="Solution">
            <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.solution || 'Not resolved yet.'}</p>
          </SectionCard>
        </div>
      )}

      {tab === 'comments' && (
        <SectionCard title="Comments">
          <div className="space-y-4">
            <div className="space-y-2">
              <Textarea
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment…"
              />
              <div className="flex justify-end">
                <Button size="sm" disabled={postingComment || !newComment.trim()} onClick={() => void postComment()}>
                  {postingComment ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" /> : <Send className="mr-1.5 size-3.5" aria-hidden="true" />}
                  Post Comment
                </Button>
              </div>
            </div>

            {commentsLoading && (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading comments…
              </div>
            )}
            {!commentsLoading && comments.length === 0 && (
              <EmptyState icon={<MessageSquare className="size-8" aria-hidden="true" />} title="No comments yet" />
            )}
            {!commentsLoading && comments.length > 0 && (
              <div className="divide-y divide-border rounded-lg border border-border">
                {comments.map((row) => (
                  <div key={row.id} className="p-3">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{row.comment}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">{row.createdByName || 'Unknown'} · {row.createdAt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {tab === 'history' && (
        <SectionCard title="Status History">
          {historyLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading history…
            </div>
          )}
          {!historyLoading && history.length === 0 && (
            <EmptyState icon={<HistoryIcon className="size-8" aria-hidden="true" />} title="No status changes yet" />
          )}
          {!historyLoading && history.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {history.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 p-3">
                  <p className="text-sm text-foreground">
                    {row.fromStatus || 'New'} <span className="text-muted-foreground">→</span> {row.toStatus || '—'}
                  </p>
                  <p className="shrink-0 text-xs text-muted-foreground">{row.changedByName || 'Unknown'} · {row.createdAt}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <SectionCard title="Custom Fields">
          <CustomFieldsSection
            recordTable="crm_tickets"
            recordId={Number(ticket.id)}
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

      <CreateTicketModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        ticket={ticket}
        ticketStatuses={ticketStatuses}
        ticketPriorities={ticketPriorities}
      />
    </div>
  )
}
