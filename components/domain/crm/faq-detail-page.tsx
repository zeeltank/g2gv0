'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, HelpCircle, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { getLaravelContext } from '@/lib/laravel-context'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { crmService } from '@/services/crm'
import type { CrmAuditEntry, CrmFaq, CrmPicklistValue } from '@/types/crm'
import { CreateFaqModal } from './create-faq-modal'
import { CrmHistoryTab } from './crm-history-tab'

interface Props {
  faq: CrmFaq
  onSaved: () => void
  onBack: () => void
  categories: CrmPicklistValue[]
  statuses: CrmPicklistValue[]
}

/** Draft = muted/secondary, Published = success, Obsolete = destructive - same StatusBadge variant set the list view uses. */
const STATUS_VARIANT: Record<string, 'inactive' | 'active' | 'error'> = {
  Draft: 'inactive', Published: 'active', Obsolete: 'error',
}

type Tab = 'details' | 'history' | 'custom'
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'history', label: 'History' },
]

export function FaqDetailPage({ faq, onSaved, onBack, categories, statuses }: Props) {
  const [tab, setTab] = useState<Tab>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const context = useMemo(() => getLaravelContext(), [])
  const [history, setHistory] = useState<CrmAuditEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await crmService.getFaqHistory(context, faq.id)
      setHistory(response.data)
    } catch {
      /* the tab still renders, just empty */
    } finally {
      setHistoryLoading(false)
    }
  }, [context, faq.id])

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
      await saveCustomFieldValues('crm_faqs', Number(faq.id), customValues)
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
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to FAQ" title="Back to FAQ">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <HelpCircle className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground">{faq.question}</h1>
            <p className="text-sm text-muted-foreground">{faq.category || 'FAQ'} · {faq.faqNo}</p>
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
          <SectionCard title="FAQ Details">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ReadField label="Category" value={faq.category} />
              <ReadField
                label="Status"
                value={faq.status && <StatusBadge variant={STATUS_VARIANT[faq.status] ?? 'default'}>{faq.status}</StatusBadge>}
              />
              <ReadField label="Product / Service" value={faq.productName} />
            </dl>
          </SectionCard>

          <SectionCard title="Question">
            <p className="whitespace-pre-wrap text-base font-medium text-foreground">{faq.question}</p>
          </SectionCard>

          <SectionCard title="Answer">
            <p className="whitespace-pre-wrap text-sm text-foreground">{faq.answer || '—'}</p>
          </SectionCard>
        </div>
      )}

      {tab === 'history' && <CrmHistoryTab entries={history} loading={historyLoading} />}

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can populate hasCustomFields before that tab is even clickable. */}
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <SectionCard title="Custom Fields">
          <CustomFieldsSection
            recordTable="crm_faqs"
            recordId={Number(faq.id)}
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

      <CreateFaqModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        faq={faq}
        categories={categories}
        statuses={statuses}
      />
    </div>
  )
}
