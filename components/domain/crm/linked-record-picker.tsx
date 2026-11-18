'use client'

/**
 * "Link to a record" picker — a record-type dropdown plus a searchable
 * record picker for whichever type is chosen. Shared by CreateEventModal
 * and EventDetailsDrawer (both task-management, not CRM) so a calendar
 * Event can point at a CRM record, and by CrmScheduleTab to pre-fill it
 * from the record whose detail page it lives on — three call sites for
 * one control, which is why this lives in its own file rather than being
 * written once per caller.
 *
 * CRM types only, for now — the backend's own `eventRules()` whitelist
 * already covers PROJECT/WORKSTREAM/TASK/BACKLOG_ITEM too (pre-existing,
 * untouched by this phase); adding them to the dropdown below is a few
 * more entries plus their own option-fetch hook, not a reshape, whenever
 * that is wanted. Intentionally a plain string union here rather than
 * re-exporting one shared type with the backend: the frontend only ever
 * needs to render ITS OWN 5, never validate the full 9.
 */

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import { useOrganizationOptions } from './organization-options'
import { useContactOptions } from './contact-options'
import type { Lead, CrmOpportunity, CrmTicket } from '@/types/crm'

export type LinkedRecordType = 'LEAD' | 'CONTACT' | 'ORGANIZATION' | 'OPPORTUNITY' | 'TICKET'

export const LINKED_RECORD_TYPES: Array<{ value: LinkedRecordType; label: string }> = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'CONTACT', label: 'Contact' },
  { value: 'ORGANIZATION', label: 'Organization' },
  { value: 'OPPORTUNITY', label: 'Opportunity' },
  { value: 'TICKET', label: 'Ticket' },
]

/** Is this a type the picker below can actually render? Guards callers that
 *  load an EXISTING event — one may be linked to a pre-existing type (a
 *  PROJECT, say) this CRM-only picker knows nothing about, and must never
 *  silently overwrite on save just because it doesn't recognise it. */
export function isLinkedRecordType(value: string | null | undefined): value is LinkedRecordType {
  return !!value && LINKED_RECORD_TYPES.some((t) => t.value === value)
}

function useLeadOptions(context: LaravelContext, enabled: boolean): Lead[] {
  const [leads, setLeads] = useState<Lead[]>([])
  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true
    crmService.getLeads(context, { perPage: 100 })
      .then((response) => { if (active) setLeads(response.data.items) })
      .catch(() => { /* the picker still works, just empty */ })
    return () => { active = false }
  }, [context, enabled])
  return leads
}

function useOpportunityOptions(context: LaravelContext, enabled: boolean): CrmOpportunity[] {
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([])
  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true
    crmService.getOpportunities(context, { perPage: 100 })
      .then((response) => { if (active) setOpportunities(response.data.items) })
      .catch(() => { /* the picker still works, just empty */ })
    return () => { active = false }
  }, [context, enabled])
  return opportunities
}

function useTicketOptions(context: LaravelContext, enabled: boolean): CrmTicket[] {
  const [tickets, setTickets] = useState<CrmTicket[]>([])
  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true
    crmService.getTickets(context, { perPage: 100 })
      .then((response) => { if (active) setTickets(response.data.items) })
      .catch(() => { /* the picker still works, just empty */ })
    return () => { active = false }
  }, [context, enabled])
  return tickets
}

interface Props {
  context: LaravelContext
  type: LinkedRecordType | null
  id: string | null
  onChange: (type: LinkedRecordType | null, id: string | null) => void
  disabled?: boolean
  /** Shown above the picker — usually "Linking to: <record name>" when
   *  opened from a CRM record's own Schedule tab. */
  caption?: string
}

export function LinkedRecordPicker({ context, type, id, onChange, disabled, caption }: Props) {
  const leads = useLeadOptions(context, type === 'LEAD')
  const contacts = useContactOptions(context, type === 'CONTACT')
  const organizations = useOrganizationOptions(context, type === 'ORGANIZATION')
  const opportunities = useOpportunityOptions(context, type === 'OPPORTUNITY')
  const tickets = useTicketOptions(context, type === 'TICKET')

  const options = (() => {
    switch (type) {
      case 'LEAD':
        return leads.map((l) => ({ value: l.id, label: `${l.firstName ?? ''} ${l.lastName}`.trim(), hint: l.leadNo }))
      case 'CONTACT':
        return contacts.map((c) => ({ value: c.id, label: `${c.firstName ?? ''} ${c.lastName}`.trim(), hint: c.contactNo }))
      case 'ORGANIZATION':
        return organizations.map((o) => ({ value: o.id, label: o.name, hint: o.accountNo }))
      case 'OPPORTUNITY':
        return opportunities.map((o) => ({ value: o.id, label: o.name, hint: o.opportunityNo }))
      case 'TICKET':
        return tickets.map((t) => ({ value: t.id, label: t.title, hint: t.ticketNo }))
      default:
        return []
    }
  })()

  return (
    <div className="space-y-1.5">
      <Label>Link to a record</Label>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={type ?? 'none'}
          onChange={(value) => onChange(value === 'none' ? null : (value as LinkedRecordType), null)}
          options={[{ label: 'No link', value: 'none' }, ...LINKED_RECORD_TYPES]}
          disabled={disabled}
          className="sm:w-48"
        />
        {type && (
          <SearchableSelect
            value={id ?? ''}
            onChange={(value) => onChange(type, value || null)}
            options={options}
            placeholder={`Choose a ${LINKED_RECORD_TYPES.find((t) => t.value === type)?.label.toLowerCase()}…`}
            disabled={disabled}
            className="flex-1"
          />
        )}
      </div>
    </div>
  )
}
