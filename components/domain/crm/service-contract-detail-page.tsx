'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarClock, FileSignature, Gauge, Loader2, Pencil, Ruler, Tag, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KPICard } from '@/components/shared/business/kpi-card'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { CrmAuditEntry, CrmPicklistValue, CrmServiceContract } from '@/types/crm'
import { CreateServiceContractModal } from './create-service-contract-modal'
import { CrmHistoryTab } from './crm-history-tab'

interface Props {
  serviceContract: CrmServiceContract
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

export function ServiceContractDetailPage({ serviceContract, onSaved, onBack }: Props) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [picklists, setPicklists] = useState<{
    contractStatus: CrmPicklistValue[]; contractType: CrmPicklistValue[]; priority: CrmPicklistValue[]; trackingUnit: CrmPicklistValue[]
  }>({ contractStatus: [], contractType: [], priority: [], trackingUnit: [] })

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const [history, setHistory] = useState<CrmAuditEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const tabs = hasCustomFields ? [...BASE_TABS, { id: 'custom' as const, label: 'Custom Fields' }] : BASE_TABS

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await crmService.getServiceContractHistory(context, serviceContract.id)
      setHistory(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setHistoryLoading(false)
    }
  }, [context, serviceContract.id])

  useEffect(() => {
    queueMicrotask(() => { void loadHistory() })
  }, [loadHistory])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'service_contracts')
      .then((response) => {
        const fields = response.data.service_contracts ?? {}
        setPicklists({
          contractStatus: fields.contract_status ?? [],
          contractType: fields.contract_type ?? [],
          priority: fields.priority ?? [],
          trackingUnit: fields.tracking_unit ?? [],
        })
      })
      .catch(() => { /* the Edit modal still works with empty dropdowns */ })
  }, [context])

  const saveCustomFields = async () => {
    setSavingCustom(true)
    setCustomNotice(null)
    try {
      await saveCustomFieldValues('crm_service_contracts', Number(serviceContract.id), customValues)
      setCustomNotice('Saved.')
    } catch (cause: unknown) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally {
      setSavingCustom(false)
    }
  }

  const totalUnits = serviceContract.totalUnits
  const usedUnits = serviceContract.usedUnits
  const progress = serviceContract.progress

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Service Contracts" title="Back to Service Contracts">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <FileSignature className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{serviceContract.subject}</h1>
            <p className="text-sm text-muted-foreground">{serviceContract.contractStatus || 'Service Contract'} · {serviceContract.contractNo}</p>
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
            <KPICard
              label="Total Units"
              value={totalUnits !== null ? totalUnits.toLocaleString() : '—'}
              icon={<Ruler className="size-4" aria-hidden="true" />}
            />
            <KPICard
              label="Used Units"
              value={usedUnits !== null ? usedUnits.toLocaleString() : '—'}
              icon={<Gauge className="size-4" aria-hidden="true" />}
            />
            <KPICard
              label="Progress"
              value={progress !== null ? `${Math.round(progress)}%` : '—'}
              icon={<Gauge className="size-4" aria-hidden="true" />}
            />
          </div>

          <SectionCard title="Contract Details">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organization</dt>
                <dd className="text-sm font-medium text-foreground">
                  {serviceContract.organizationId ? (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => router.push(resolveAccessLink('/module/crm/marketing/organizations') + `/${serviceContract.organizationId}`)}
                    >
                      {serviceContract.organizationName}
                    </button>
                  ) : '—'}
                </dd>
              </div>
              <ReadField label="Contact" value={serviceContract.contactName} />
              <ReadField label="Start Date" value={serviceContract.startDate && <IconValue icon={CalendarClock}>{serviceContract.startDate}</IconValue>} />
              <ReadField label="End Date" value={serviceContract.endDate && <IconValue icon={CalendarClock}>{serviceContract.endDate}</IconValue>} />
              <ReadField label="Due Date" value={serviceContract.dueDate && <IconValue icon={CalendarClock}>{serviceContract.dueDate}</IconValue>} />
              <ReadField label="Tracking Unit" value={serviceContract.trackingUnit} />
              <ReadField label="Status" value={serviceContract.contractStatus} />
              <ReadField label="Type" value={serviceContract.contractType && <IconValue icon={Tag}>{serviceContract.contractType}</IconValue>} />
              <ReadField label="Priority" value={serviceContract.priority} />
              <ReadField label="Assigned To" value={serviceContract.assignedToName && <IconValue icon={User}>{serviceContract.assignedToName}</IconValue>} />
            </dl>
          </SectionCard>
        </div>
      )}

      {tab === 'history' && <CrmHistoryTab entries={history} loading={historyLoading} />}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <SectionCard title="Custom Fields">
          <CustomFieldsSection
            recordTable="crm_service_contracts"
            recordId={Number(serviceContract.id)}
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

      <CreateServiceContractModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        serviceContract={serviceContract}
        picklists={picklists}
      />
    </div>
  )
}
