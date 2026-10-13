'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Building2, CalendarClock, Hash, Laptop, Loader2, Package, Pencil, Receipt, Tag, Truck, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KPICard } from '@/components/shared/business/kpi-card'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import { useAssignableEmployees } from './lead-employees'
import { getLaravelContext } from '@/lib/laravel-context'
import type { CrmAsset, CrmAuditEntry } from '@/types/crm'
import { CreateAssetModal } from './create-asset-modal'
import { CrmHistoryTab } from './crm-history-tab'

interface Props {
  asset: CrmAsset
  onSaved: () => void
  onBack: () => void
}

type Tab = 'details' | 'history' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
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

export function AssetDetailPage({ asset, onSaved, onBack }: Props) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)

  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [history, setHistory] = useState<CrmAuditEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await crmService.getAssetHistory(context, asset.id)
      setHistory(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setHistoryLoading(false)
    }
  }, [context, asset.id])

  useEffect(() => {
    queueMicrotask(() => { void loadHistory() })
  }, [loadHistory])

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const tabs = hasCustomFields ? [...BASE_TABS, { id: 'custom' as const, label: 'Custom Fields' }] : BASE_TABS

  const saveCustomFields = async () => {
    setSavingCustom(true)
    setCustomNotice(null)
    try {
      await saveCustomFieldValues('crm_assets', Number(asset.id), customValues)
      setCustomNotice('Saved.')
    } catch (cause: unknown) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally {
      setSavingCustom(false)
    }
  }

  const assignedToName = asset.assignedToName ?? employees.find((e) => e.id === asset.assignedTo)?.name ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Assets" title="Back to Assets">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <Laptop className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{asset.assetName}</h1>
            <p className="text-sm text-muted-foreground">{asset.status || 'Asset'} · {asset.assetNo}</p>
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
            <KPICard label="Status" value={asset.status || '—'} icon={<Tag className="size-4" aria-hidden="true" />} />
            <KPICard label="Product" value={asset.productName || '—'} icon={<Package className="size-4" aria-hidden="true" />} />
            <KPICard label="Organization" value={asset.organizationName || '—'} icon={<Building2 className="size-4" aria-hidden="true" />} />
          </div>

          <SectionCard title="Asset Details">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</dt>
                <dd className="text-sm font-medium text-foreground">
                  {asset.productId ? (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => router.push(resolveAccessLink('/module/crm/sales/products') + `/${asset.productId}`)}
                    >
                      {asset.productName || `#${asset.productId}`}
                    </button>
                  ) : '—'}
                </dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organization</dt>
                <dd className="text-sm font-medium text-foreground">
                  {asset.organizationId ? (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => router.push(resolveAccessLink('/module/crm/marketing/organizations') + `/${asset.organizationId}`)}
                    >
                      {asset.organizationName || `#${asset.organizationId}`}
                    </button>
                  ) : '—'}
                </dd>
              </div>
              <ReadField label="Serial Number" value={asset.serialNumber && <IconValue icon={Hash}>{asset.serialNumber}</IconValue>} />
              <ReadField label="Tag Number" value={asset.tagNumber && <IconValue icon={Tag}>{asset.tagNumber}</IconValue>} />
              <ReadField label="Status" value={asset.status} />
              <ReadField label="Date Sold" value={asset.dateSold && <IconValue icon={CalendarClock}>{asset.dateSold}</IconValue>} />
              <ReadField label="Date In Service" value={asset.dateInService && <IconValue icon={CalendarClock}>{asset.dateInService}</IconValue>} />
              <ReadField label="Assigned To" value={assignedToName && <IconValue icon={User}>{assignedToName}</IconValue>} />
            </dl>
          </SectionCard>

          <SectionCard title="Shipping & Invoice">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ReadField label="Shipping Method" value={asset.shippingMethod && <IconValue icon={Truck}>{asset.shippingMethod}</IconValue>} />
              <ReadField label="Shipping Tracking Number" value={asset.shippingTrackingNumber} />
              <div className="flex flex-col gap-1.5">
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice</dt>
                <dd className="text-sm font-medium text-foreground">
                  {asset.invoiceId ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                      onClick={() => router.push(resolveAccessLink('/module/crm/sales/invoices') + `/${asset.invoiceId}`)}
                    >
                      <Receipt className="size-3.5" aria-hidden="true" />
                      {asset.invoiceNo || `#${asset.invoiceId}`}
                    </button>
                  ) : '—'}
                </dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Description">
            <p className="text-sm text-foreground">{asset.description || '—'}</p>
          </SectionCard>
        </div>
      )}

      {tab === 'history' && <CrmHistoryTab entries={history} loading={historyLoading} />}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <SectionCard title="Custom Fields">
          <CustomFieldsSection
            recordTable="crm_assets"
            recordId={Number(asset.id)}
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

      <CreateAssetModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        asset={asset}
      />
    </div>
  )
}
