'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmOpportunity, CrmOpportunityPayload, CrmPicklistValue } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'
import { useOrganizationOptions } from './organization-options'
import { useCampaignOptions } from './campaign-options'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  opportunity: CrmOpportunity | null
  /** Pre-fills the organization when opened from an Organization's own page - not yet wired anywhere, left available for that call site. */
  defaultOrganizationId?: string
  picklists: { salesStage: CrmPicklistValue[]; leadSource: CrmPicklistValue[]; potentialType: CrmPicklistValue[]; forecastCategory: CrmPicklistValue[] }
}

/**
 * A new Opportunity always starts with a real stage, never blank - the
 * kanban board buckets strictly by the picklist's own stage values (so an
 * admin can rename/reorder/recolor them from Picklist Admin and the board
 * follows), and a blank salesStage has no column to land in at all. Falls
 * back to the first stage in sort order when nothing is flagged default.
 */
const emptyForm = (defaultOrganizationId: string | undefined, salesStages: CrmPicklistValue[]): CrmOpportunityPayload => ({
  name: '', organizationId: defaultOrganizationId ?? null, campaignId: null, amount: null, currency: '',
  closingDate: '', salesStage: salesStages.find((s) => s.isDefault)?.value ?? salesStages[0]?.value ?? '',
  probability: null, leadSource: '', potentialType: '', nextStep: '',
  forecastCategory: '', description: '', assignedTo: '',
})

export function CreateOpportunityModal({ isOpen, onClose, onSaved, opportunity, defaultOrganizationId, picklists }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const organizations = useOrganizationOptions(context, isOpen)
  const campaigns = useCampaignOptions(context, isOpen)

  const [seededFrom, setSeededFrom] = useState<CrmOpportunity | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmOpportunityPayload>(emptyForm(defaultOrganizationId, picklists.salesStage))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== opportunity) {
    setSeededFrom(opportunity)
    setForm(opportunity
      ? {
          name: opportunity.name, organizationId: opportunity.organizationId, campaignId: opportunity.campaignId,
          amount: opportunity.amount, currency: opportunity.currency ?? '', closingDate: opportunity.closingDate ?? '',
          salesStage: opportunity.salesStage ?? '', probability: opportunity.probability,
          leadSource: opportunity.leadSource ?? '', potentialType: opportunity.potentialType ?? '',
          nextStep: opportunity.nextStep ?? '', forecastCategory: opportunity.forecastCategory ?? '',
          description: opportunity.description ?? '', assignedTo: opportunity.assignedTo ?? '',
        }
      : emptyForm(defaultOrganizationId, picklists.salesStage))
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmOpportunityPayload>(key: K, value: CrmOpportunityPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.name?.trim() || !form.assignedTo) {
      setError('Opportunity Name and Assigned To are required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = opportunity
        ? await crmService.updateOpportunity(context, opportunity.id, form)
        : await crmService.createOpportunity(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that opportunity.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{opportunity ? 'Edit Opportunity' : 'New Opportunity'}</DialogTitle>
          <DialogDescription>{opportunity ? 'Update this opportunity’s details.' : 'A deal you are tracking through your sales pipeline.'}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="opp-name">Opportunity Name *</Label>
            <Input id="opp-name" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus />
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
              <Label>Campaign</Label>
              <SearchableSelect
                value={form.campaignId ?? ''}
                onChange={(v) => set('campaignId', v || null)}
                options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="No campaign"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="opp-amount">Amount</Label>
              <Input id="opp-amount" type="number" value={form.amount ?? ''} onChange={(e) => set('amount', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-currency">Currency</Label>
              <Input id="opp-currency" value={form.currency ?? ''} onChange={(e) => set('currency', e.target.value)} placeholder="USD" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-probability">Probability %</Label>
              <Input id="opp-probability" type="number" min={0} max={100} value={form.probability ?? ''} onChange={(e) => set('probability', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Sales Stage</Label>
              <Select
                value={form.salesStage || 'none'}
                onChange={(v) => set('salesStage', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.salesStage.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-closing-date">Closing Date</Label>
              <Input id="opp-closing-date" type="date" value={form.closingDate ?? ''} onChange={(e) => set('closingDate', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Lead Source</Label>
              <Select
                value={form.leadSource || 'none'}
                onChange={(v) => set('leadSource', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.leadSource.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.potentialType || 'none'}
                onChange={(v) => set('potentialType', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.potentialType.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Forecast Category</Label>
              <Select
                value={form.forecastCategory || 'none'}
                onChange={(v) => set('forecastCategory', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.forecastCategory.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opp-next-step">Next Step</Label>
            <Input id="opp-next-step" value={form.nextStep ?? ''} onChange={(e) => set('nextStep', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Assigned To *</Label>
            <SearchableSelect
              value={form.assignedTo ?? ''}
              onChange={(v) => set('assignedTo', v)}
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="Choose an employee…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opp-description">Description</Label>
            <Textarea id="opp-description" rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.name?.trim()}>
            {submitting ? 'Saving…' : opportunity ? 'Save Changes' : 'Create Opportunity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
