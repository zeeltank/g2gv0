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
import type { Campaign, CampaignPayload, CrmPicklistValue } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  campaign: Campaign | null
  picklists: { campaignType: CrmPicklistValue[]; campaignStatus: CrmPicklistValue[]; expectedResponse: CrmPicklistValue[] }
}

const EMPTY: CampaignPayload = {
  name: '', campaignType: '', campaignStatus: '', expectedRevenue: null, budgetCost: null, actualCost: null,
  expectedResponse: '', numSent: null, sponsor: '', targetAudience: '', targetSize: null,
  expectedResponseCount: null, expectedSalesCount: null, actualResponseCount: null, actualSalesCount: null,
  expectedRoi: null, actualRoi: null, closingDate: '', productId: null, description: '', assignedTo: '',
}

export function CreateCampaignModal({ isOpen, onClose, onSaved, campaign, picklists }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)

  const [seededFrom, setSeededFrom] = useState<Campaign | null | 'unset'>('unset')
  const [form, setForm] = useState<CampaignPayload>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== campaign) {
    setSeededFrom(campaign)
    setForm(campaign
      ? {
          name: campaign.name, campaignType: campaign.campaignType ?? '', campaignStatus: campaign.campaignStatus ?? '',
          expectedRevenue: campaign.expectedRevenue, budgetCost: campaign.budgetCost, actualCost: campaign.actualCost,
          expectedResponse: campaign.expectedResponse ?? '', numSent: campaign.numSent, sponsor: campaign.sponsor ?? '',
          targetAudience: campaign.targetAudience ?? '', targetSize: campaign.targetSize,
          expectedResponseCount: campaign.expectedResponseCount, expectedSalesCount: campaign.expectedSalesCount,
          actualResponseCount: campaign.actualResponseCount, actualSalesCount: campaign.actualSalesCount,
          expectedRoi: campaign.expectedRoi, actualRoi: campaign.actualRoi, closingDate: campaign.closingDate ?? '',
          productId: campaign.productId, description: campaign.description ?? '', assignedTo: campaign.assignedTo ?? '',
        }
      : EMPTY)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CampaignPayload>(key: K, value: CampaignPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.name?.trim() || !form.assignedTo) {
      setError('Campaign Name and Assigned To are required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = campaign
        ? await crmService.updateCampaign(context, campaign.id, form)
        : await crmService.createCampaign(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that campaign.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{campaign ? 'Edit Campaign' : 'New Campaign'}</DialogTitle>
          <DialogDescription>{campaign ? 'Update this campaign’s details.' : 'A marketing effort you can target leads, contacts, and organizations with.'}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Campaign Name *</Label>
            <Input id="campaign-name" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.campaignType || 'none'}
                onChange={(v) => set('campaignType', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.campaignType.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.campaignStatus || 'none'}
                onChange={(v) => set('campaignStatus', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.campaignStatus.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expected Response</Label>
              <Select
                value={form.expectedResponse || 'none'}
                onChange={(v) => set('expectedResponse', v === 'none' ? '' : v)}
                options={[{ label: '—', value: 'none' }, ...picklists.expectedResponse.map((p) => ({ label: p.label, value: p.value }))]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-closing-date">Closing Date</Label>
              <Input id="campaign-closing-date" type="date" value={form.closingDate ?? ''} onChange={(e) => set('closingDate', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-sponsor">Sponsor</Label>
              <Input id="campaign-sponsor" value={form.sponsor ?? ''} onChange={(e) => set('sponsor', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-target-audience">Target Audience</Label>
              <Input id="campaign-target-audience" value={form.targetAudience ?? ''} onChange={(e) => set('targetAudience', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-target-size">Target Size</Label>
              <Input id="campaign-target-size" type="number" value={form.targetSize ?? ''} onChange={(e) => set('targetSize', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-num-sent">Num Sent</Label>
              <Input id="campaign-num-sent" type="number" value={form.numSent ?? ''} onChange={(e) => set('numSent', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-expected-revenue">Expected Revenue</Label>
              <Input id="campaign-expected-revenue" type="number" value={form.expectedRevenue ?? ''} onChange={(e) => set('expectedRevenue', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-budget-cost">Budget Cost</Label>
              <Input id="campaign-budget-cost" type="number" value={form.budgetCost ?? ''} onChange={(e) => set('budgetCost', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-actual-cost">Actual Cost</Label>
              <Input id="campaign-actual-cost" type="number" value={form.actualCost ?? ''} onChange={(e) => set('actualCost', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-expected-response-count">Expected Responses</Label>
              <Input id="campaign-expected-response-count" type="number" value={form.expectedResponseCount ?? ''} onChange={(e) => set('expectedResponseCount', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-actual-response-count">Actual Responses</Label>
              <Input id="campaign-actual-response-count" type="number" value={form.actualResponseCount ?? ''} onChange={(e) => set('actualResponseCount', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-expected-sales-count">Expected Sales</Label>
              <Input id="campaign-expected-sales-count" type="number" value={form.expectedSalesCount ?? ''} onChange={(e) => set('expectedSalesCount', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-actual-sales-count">Actual Sales</Label>
              <Input id="campaign-actual-sales-count" type="number" value={form.actualSalesCount ?? ''} onChange={(e) => set('actualSalesCount', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-expected-roi">Expected ROI</Label>
              <Input id="campaign-expected-roi" type="number" value={form.expectedRoi ?? ''} onChange={(e) => set('expectedRoi', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-actual-roi">Actual ROI</Label>
              <Input id="campaign-actual-roi" type="number" value={form.actualRoi ?? ''} onChange={(e) => set('actualRoi', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
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
            <Label htmlFor="campaign-description">Description</Label>
            <Textarea id="campaign-description" rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.name?.trim()}>
            {submitting ? 'Saving…' : campaign ? 'Save Changes' : 'Create Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
