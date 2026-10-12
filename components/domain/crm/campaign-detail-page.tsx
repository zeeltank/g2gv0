'use client'

import { useState } from 'react'
import { ArrowLeft, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import type { Campaign, CrmPicklistValue } from '@/types/crm'
import { CAMPAIGN_STATUS_VARIANT } from './campaign-list-view'
import { CreateCampaignModal } from './create-campaign-modal'
import { CampaignTargetManager } from './campaign-target-manager'

interface Props {
  campaign: Campaign
  onSaved: () => void
  onBack: () => void
  picklists: { campaignType: CrmPicklistValue[]; campaignStatus: CrmPicklistValue[]; expectedResponse: CrmPicklistValue[] }
}

type Tab = 'details' | 'targets' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'targets', label: 'Targets' },
]

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value ?? '—'}</p>
    </div>
  )
}

export function CampaignDetailPage({ campaign, onSaved, onBack, picklists }: Props) {
  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
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
      await saveCustomFieldValues('crm_campaigns', Number(campaign.id), customValues)
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
            Back to Campaigns
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              {campaign.name}
              {campaign.campaignStatus && (
                <StatusBadge variant={CAMPAIGN_STATUS_VARIANT[campaign.campaignStatus] ?? 'default'}>
                  {campaign.campaignStatus}
                </StatusBadge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">{campaign.campaignType || 'Campaign'} · {campaign.campaignNo}</p>
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
            <h2 className="text-sm font-semibold text-foreground">Campaign Details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Type" value={campaign.campaignType} />
              <Field label="Status" value={campaign.campaignStatus} />
              <Field label="Expected Response" value={campaign.expectedResponse} />
              <Field label="Sponsor" value={campaign.sponsor} />
              <Field label="Target Audience" value={campaign.targetAudience} />
              <Field label="Target Size" value={campaign.targetSize} />
              <Field label="Num Sent" value={campaign.numSent} />
              <Field label="Closing Date" value={campaign.closingDate} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Expectations &amp; Actuals</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Expected Revenue" value={campaign.expectedRevenue} />
              <Field label="Budget Cost" value={campaign.budgetCost} />
              <Field label="Actual Cost" value={campaign.actualCost} />
              <Field label="Expected Responses" value={campaign.expectedResponseCount} />
              <Field label="Actual Responses" value={campaign.actualResponseCount} />
              <Field label="Expected Sales" value={campaign.expectedSalesCount} />
              <Field label="Actual Sales" value={campaign.actualSalesCount} />
              <Field label="Expected ROI" value={campaign.expectedRoi} />
              <Field label="Actual ROI" value={campaign.actualRoi} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Description</h2>
            <p className="text-sm text-foreground">{campaign.description || '—'}</p>
          </section>
        </div>
      )}

      {tab === 'targets' && (
        <div className="rounded-lg border border-border p-4">
          <CampaignTargetManager campaignId={campaign.id} />
        </div>
      )}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? 'space-y-4 rounded-lg border border-border p-4' : 'hidden'}>
        <CustomFieldsSection
          recordTable="crm_campaigns"
          recordId={Number(campaign.id)}
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

      <CreateCampaignModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        campaign={campaign}
        picklists={picklists}
      />
    </div>
  )
}
