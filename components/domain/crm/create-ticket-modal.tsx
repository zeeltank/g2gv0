'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmPicklistValue, CrmProduct, CrmTicket, CrmTicketPayload } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'
import { useOrganizationOptions } from './organization-options'
import { useContactOptions } from './contact-options'
import { useAssetOptions, useServiceContractOptions } from './ticket-options'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  ticket: CrmTicket | null
  ticketStatuses: CrmPicklistValue[]
  ticketPriorities: CrmPicklistValue[]
  ticketSeverities?: CrmPicklistValue[]
  ticketCategories?: CrmPicklistValue[]
}

const emptyForm = (ticketStatuses: CrmPicklistValue[]): CrmTicketPayload => ({
  title: '', organizationId: null, contactId: null, productId: null, assetId: null, serviceContractId: null,
  status: ticketStatuses.find((s) => s.isDefault)?.value ?? 'Open',
  priority: '', severity: '', category: '', description: '', solution: '',
  hours: null, days: null, assignedTo: '',
})

export function CreateTicketModal({ isOpen, onClose, onSaved, ticket, ticketStatuses, ticketPriorities, ticketSeverities = [], ticketCategories = [] }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const organizations = useOrganizationOptions(context, isOpen)
  const contacts = useContactOptions(context, isOpen)
  const assets = useAssetOptions(context, isOpen)
  const serviceContracts = useServiceContractOptions(context, isOpen)

  const [products, setProducts] = useState<CrmProduct[]>([])

  useEffect(() => {
    if (!isOpen || !isLaravelContextReady(context)) return
    Promise.all([
      crmService.getProducts(context, 'product', { perPage: 200, sortBy: 'name', sortDir: 'asc' }),
      crmService.getProducts(context, 'service', { perPage: 200, sortBy: 'name', sortDir: 'asc' }),
    ])
      .then(([productsRes, servicesRes]) => setProducts([...productsRes.data.items, ...servicesRes.data.items]))
      .catch(() => { /* the form still works with an empty picker */ })
  }, [isOpen, context])

  const [seededFrom, setSeededFrom] = useState<CrmTicket | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmTicketPayload>(emptyForm(ticketStatuses))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== ticket) {
    setSeededFrom(ticket)
    setForm(ticket
      ? {
          title: ticket.title, organizationId: ticket.organizationId, contactId: ticket.contactId,
          productId: ticket.productId, assetId: ticket.assetId, serviceContractId: ticket.serviceContractId,
          status: ticket.status ?? '', priority: ticket.priority ?? '', severity: ticket.severity ?? '', category: ticket.category ?? '',
          description: ticket.description ?? '', solution: ticket.solution ?? '',
          hours: ticket.hours, days: ticket.days, assignedTo: ticket.assignedTo ?? '',
        }
      : emptyForm(ticketStatuses))
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmTicketPayload>(key: K, value: CrmTicketPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.title?.trim()) {
      setError('Title is required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = ticket
        ? await crmService.updateTicket(context, ticket.id, form)
        : await crmService.createTicket(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{ticket ? 'Edit Ticket' : 'New Ticket'}</DialogTitle>
          <DialogDescription>{ticket ? 'Update this ticket.' : 'Raise a new support ticket against an organization, asset, or service contract.'}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="ticket-title">Title *</Label>
            <Input id="ticket-title" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} autoFocus />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <SearchableSelect
                value={form.organizationId ?? ''}
                onChange={(v) => set('organizationId', v || null)}
                options={organizations.map((o) => ({ value: o.id, label: o.name }))}
                placeholder="No organization"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <SearchableSelect
                value={form.contactId ?? ''}
                onChange={(v) => set('contactId', v || null)}
                options={contacts.map((c) => ({ value: c.id, label: `${c.firstName ?? ''} ${c.lastName}`.trim() }))}
                placeholder="No contact"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Product / Service</Label>
              <SearchableSelect
                value={form.productId ?? ''}
                onChange={(v) => set('productId', v || null)}
                options={products.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="None"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Asset</Label>
              <SearchableSelect
                value={form.assetId ?? ''}
                onChange={(v) => set('assetId', v || null)}
                options={assets.map((a) => ({ value: a.id, label: a.assetName }))}
                placeholder="None"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Service Contract</Label>
              <SearchableSelect
                value={form.serviceContractId ?? ''}
                onChange={(v) => set('serviceContractId', v || null)}
                options={serviceContracts.map((c) => ({ value: c.id, label: c.contractNo ? `${c.contractNo} - ${c.subject}` : c.subject }))}
                placeholder="None"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <SearchableSelect
                value={form.assignedTo ?? ''}
                onChange={(v) => set('assignedTo', v)}
                options={employees.map((e) => ({ value: e.id, label: e.name }))}
                placeholder="Choose an employee…"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status || 'none'}
                onChange={(v) => set('status', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...ticketStatuses.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority || 'none'}
                onChange={(v) => set('priority', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...ticketPriorities.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select
                value={form.severity || 'none'}
                onChange={(v) => set('severity', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...ticketSeverities.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category || 'none'}
                onChange={(v) => set('category', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...ticketCategories.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ticket-hours">Hours</Label>
              <Input id="ticket-hours" type="number" min={0} step="0.25" value={form.hours ?? ''} onChange={(e) => set('hours', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-days">Days</Label>
              <Input id="ticket-days" type="number" min={0} step="0.25" value={form.days ?? ''} onChange={(e) => set('days', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea id="ticket-description" rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-solution">Solution</Label>
            <Textarea id="ticket-solution" rows={3} value={form.solution ?? ''} onChange={(e) => set('solution', e.target.value)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.title?.trim()}>
            {submitting ? 'Saving…' : ticket ? 'Save Changes' : 'Create Ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
