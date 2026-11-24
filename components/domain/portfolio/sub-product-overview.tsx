'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Pencil, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/textarea'
import { SectionCard } from '@/components/shared/business/shared'
import type { LaravelContext } from '@/lib/laravel-context'
import { FIELD_ERROR_TEXT } from '@/lib/org-accounts/tones'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type { ReadinessLogEntry, TaxonomyData } from '@/services/portfolio/types'
import type { PmFullRecord } from '@/services/product-master/record-types'
import { ReadinessChip } from './portfolio-chips'

/** One labelled value; a field with nothing stored says so instead of being left out. */
export function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
  return (
    <div className="grid min-w-0 gap-0.5 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 whitespace-pre-line break-words text-sm text-foreground">{empty ? <span className="text-muted-foreground">Not recorded</span> : value}</dd>
    </div>
  )
}

const list = (v: string[] | null | undefined, words?: Record<string, string>): string | null => (v && v.length > 0 ? v.map((x) => words?.[x] ?? x).join(', ') : null)

/**
 * The Overview tab: who and what the record is (its Product, its ID, its readiness), the whole About, and the readiness confirmation, which stays the
 * administrators' action it has always been. A record with no About says so and offers to add one.
 */
export function OverviewTab({ record, taxonomy, soldTogether, productHref, canEdit, onEdit, isAdmin, context, onChanged }: {
  record: PmFullRecord
  taxonomy: TaxonomyData | null
  /** The names of the Sub-products "often sold together" names by ID. */
  soldTogether: Record<string, string>
  productHref: string | null
  canEdit: boolean
  onEdit: () => void
  isAdmin: boolean
  context: LaravelContext
  onChanged: () => void
}) {
  const offer = record.offer
  const about = offer?.about
  if (!offer || !about) {
    return (
      <EmptyState
        title="No About yet"
        description="This sub-product has no description in the Product Portfolio. Add one so signals can be matched to it."
        action={canEdit ? <Button onClick={onEdit}><Pencil className="mr-1.5 size-4" aria-hidden="true" />Add an About</Button> : undefined}
      />
    )
  }

  // The Portfolio's own rule: a sub-product is open to partners once its readiness is one the taxonomy lists as sellable (the detail dialog drew it as a badge).
  const partnerWord = taxonomy === null ? null : taxonomy.partner_sellable_readiness.includes(offer.readiness ?? '') ? 'Partners can sell it' : 'Not open to partners yet'

  return (
    <div className="space-y-4">
      <SectionCard title="Identity">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Fact label="Name" value={record.name} />
          <Fact label="Product" value={record.parent && (productHref ? <Link href={productHref} className="text-foreground underline underline-offset-2 hover:no-underline">{record.parent.name}</Link> : record.parent.name)} />
          <Fact label="ID" value={<span className="font-mono text-xs">{offer.offerId}</span>} />
          <Fact label="Readiness" value={<ReadinessChip readiness={offer.readiness} />} />
          <Fact label="Status" value={record.status === 'active' ? 'Active' : 'Archived'} />
          <Fact label="Partner network" value={partnerWord} />
        </dl>
      </SectionCard>

      <SectionCard title="About" actions={canEdit ? <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1.5 size-3.5" aria-hidden="true" />Edit</Button> : undefined}>
        <dl className="space-y-3">
          <Fact label="What it does" value={about.whatItDoes} />
          <Fact label="Features and capabilities" value={about.modulesComponents} />
          <Fact label="Customer problems solved" value={list(about.needsSolved, taxonomy?.needs)} />
          <Fact label="Target customers" value={list(about.primarySegments, taxonomy?.segments)} />
          <Fact label="Buying events" value={list(about.triggerSignals, { ...(taxonomy?.signals ?? {}), ...Object.fromEntries(Object.entries(taxonomy?.signal_families ?? {}).map(([k, f]) => [k, f.label])) })} />
          <Fact label="Benefits and proof" value={about.proofPoints} />
          <Fact label="Pricing model" value={about.pricingModel} />
          <Fact label="Typical deal size" value={about.typicalDealBand} />
          <Fact label="Deployment" value={about.deploymentModel ? (taxonomy?.deployment_models?.[about.deploymentModel] ?? about.deploymentModel) : null} />
          <Fact label="Implementation effort" value={about.implementationEffort} />
          <Fact label="Delivery owner" value={about.deliveryOwner} />
          <Fact label="Often sold together" value={list(about.oftenSoldTogether.map((id) => (soldTogether[id] ? `${soldTogether[id]} (${id})` : id)))} />
          <Fact label="Notes" value={about.notes} />
        </dl>
      </SectionCard>

      <ReadinessCard record={record} isAdmin={isAdmin} context={context} onChanged={onChanged} />
    </div>
  )
}

/** The readiness confirmation: an administrator confirms (with a note of what was verified) or removes it; every change is logged and listed here. */
function ReadinessCard({ record, isAdmin, context, onChanged }: { record: PmFullRecord; isAdmin: boolean; context: LaravelContext; onChanged: () => void }) {
  const offer = record.offer!
  const [log, setLog] = useState<ReadinessLogEntry[] | null>(null)
  const [action, setAction] = useState<'confirm' | 'remove' | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLog = useCallback(async () => {
    try { setLog((await portfolioService.getReadinessLog(context, offer.id)).data) } catch { setLog([]) }
  }, [context, offer.id])
  useEffect(() => { queueMicrotask(() => { void loadLog() }) }, [loadLog])

  const submit = async () => {
    const confirmed = action === 'confirm'
    if (confirmed && note.trim().length < 5) { setError('Say what was verified (at least 5 characters).'); return }
    setSaving(true)
    setError(null)
    try {
      await portfolioService.setReadiness(context, offer.id, confirmed, note.trim() || undefined)
      setAction(null)
      setNote('')
      void loadLog()
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the readiness.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Readiness" description="Confirming it as ready is an administrator's action. Nothing is confirmed automatically, and a confirmation never changes a match score.">
      <p className="text-sm text-foreground">
        Stage: <span className="font-medium">{offer.readiness ?? 'not set'}</span>.{' '}
        {offer.readinessConfirmed ? 'Confirmed by an administrator.' : 'No administrator has confirmed that it is ready to deliver.'}
      </p>
      <div className="mt-3">
        {isAdmin ? (
          <Button size="sm" variant={offer.readinessConfirmed ? 'outline' : 'default'} onClick={() => { setError(null); setNote(''); setAction(offer.readinessConfirmed ? 'remove' : 'confirm') }}>
            <ShieldCheck className="mr-1.5 size-3.5" aria-hidden="true" />{offer.readinessConfirmed ? 'Remove confirmation' : 'Confirm readiness'}
          </Button>
        ) : <p className="text-sm text-muted-foreground">Only an administrator can confirm readiness.</p>}
      </div>
      {log && log.length > 0 && (
        <ul aria-label="Readiness log" className="mt-3 divide-y divide-border/60 border-t border-border/60 text-sm">
          {log.map((entry) => (
            <li key={entry.id} className="py-1.5">
              <span className="font-medium text-foreground">{entry.action === 'confirmed' ? 'Confirmed' : 'Confirmation removed'}</span>{' '}
              <span className="text-muted-foreground">· {new Date(entry.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={action !== null} onOpenChange={(open) => { if (!open && !saving) setAction(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{action === 'confirm' ? 'Confirm readiness' : 'Remove confirmation'}</DialogTitle>
            <DialogDescription>
              {action === 'confirm'
                ? `You are stating that ${offer.offerId} (${record.name}) is ready to deliver. Your name and the time are recorded.`
                : `${offer.offerId} goes back to Not yet verified. The change is recorded.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="readiness-note" className="text-sm font-medium text-foreground">{action === 'confirm' ? 'What was verified? (required)' : 'Reason (optional)'}</label>
            <Textarea id="readiness-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={saving} />
            {error && <p role="alert" className={`text-xs ${FIELD_ERROR_TEXT}`}>{error}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setAction(null)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={() => void submit()} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="mr-1.5 size-3.5" aria-hidden="true" />}
              {action === 'confirm' ? 'Confirm readiness' : 'Remove confirmation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}
