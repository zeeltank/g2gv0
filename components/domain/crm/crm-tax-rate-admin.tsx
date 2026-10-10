'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmTaxRate } from '@/types/crm'

function AddRateForm({ onAdded }: { onAdded: () => void }) {
  const context = useMemo(() => getLaravelContext(), [])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [percentage, setPercentage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim() || percentage === '') return
    setSubmitting(true)
    setError('')
    try {
      await crmService.createTaxRate(context, { name: name.trim(), percentage: Number(percentage) })
      setName(''); setPercentage(''); setOpen(false)
      onAdded()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add this tax rate.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
        Add tax rate
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. GST)" className="h-8 w-40" />
      <Input type="number" min={0} max={100} step="0.001" value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="Percent" className="h-8 w-24" />
      <Button size="sm" disabled={submitting || !name.trim() || percentage === ''} onClick={() => void submit()}>
        {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : 'Add'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setError('') }}>Cancel</Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

function RateRow({ rate, onChanged }: { rate: CrmTaxRate; onChanged: () => void }) {
  const context = useMemo(() => getLaravelContext(), [])
  const [editingName, setEditingName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const update = async (payload: Partial<{ name: string; isDefault: boolean; isActive: boolean }>) => {
    setBusy(true)
    try {
      await crmService.updateTaxRate(context, rate.id, payload)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${rate.isActive ? '' : 'opacity-50'}`}>
      <button
        type="button"
        aria-label={`Make ${rate.name} the default rate`}
        disabled={busy}
        onClick={() => void update({ isDefault: true })}
        className={rate.isDefault ? 'text-warning' : 'text-muted-foreground/40 hover:text-muted-foreground'}
      >
        <Star className="size-4" fill={rate.isDefault ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>

      {editingName === null ? (
        <button type="button" className="min-w-0 flex-1 truncate text-left text-sm text-foreground" onClick={() => setEditingName(rate.name)}>
          {rate.name}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            className="h-7 flex-1"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && editingName.trim()) { void update({ name: editingName.trim() }); setEditingName(null) } }}
          />
          <Button size="sm" className="h-7" disabled={busy || !editingName.trim()} onClick={() => { void update({ name: editingName.trim() }); setEditingName(null) }}>Save</Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingName(null)}>Cancel</Button>
        </div>
      )}

      <span className="shrink-0 text-xs text-muted-foreground" title="The percentage is fixed once a rate is created - deactivate and add a new one instead of changing it.">
        {rate.percentage}%
      </span>

      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" checked={rate.isActive} disabled={busy} onChange={(e) => void update({ isActive: e.target.checked })} />
        Active
      </label>
    </li>
  )
}

/**
 * Tax Rates - a small admin-managed master list this app had no equivalent
 * of before the Sales migration. `percentage` is immutable once created
 * (same reasoning as a picklist value's own `value` column, and enforced
 * server-side regardless of what this screen sends) - a quote's line items
 * freeze a snapshot of whatever rate they used at save time specifically so
 * this list can keep changing without rewriting history. A rate that needs
 * a different percentage is deactivated and replaced with a new one.
 */
export function CrmTaxRateAdmin() {
  const context = useMemo(() => getLaravelContext(), [])
  const [rates, setRates] = useState<CrmTaxRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const response = await crmService.getTaxRatesAdmin(context)
      setRates(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load tax rates.')
    } finally {
      setLoading(false)
    }
  }, [context])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading tax rates…
      </div>
    )
  }

  if (error) {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Used on Products, Services, and Quote line items.</p>
        <AddRateForm onAdded={() => void load()} />
      </div>
      {rates.length === 0 && <p className="px-2 text-sm text-muted-foreground">No tax rates yet.</p>}
      <ul className="divide-y divide-border">
        {rates.map((rate) => <RateRow key={rate.id} rate={rate} onChanged={() => void load()} />)}
      </ul>
    </div>
  )
}
