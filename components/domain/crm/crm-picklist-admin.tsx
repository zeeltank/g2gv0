'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmModule, CrmPicklistAdminRow } from '@/types/crm'

const MODULE_LABEL: Record<CrmModule, string> = {
  leads: 'Leads', contacts: 'Contacts', organizations: 'Organizations', campaigns: 'Campaigns',
}

const FIELD_KEY_LABEL: Record<string, string> = {
  lead_status: 'Lead Status', lead_source: 'Lead Source', rating: 'Rating', salutation: 'Salutation',
  industry: 'Industry', account_type: 'Account Type', campaign_type: 'Campaign Type',
  campaign_status: 'Campaign Status', expected_response: 'Expected Response',
}

function AddValueForm({ module, fieldKey, onAdded }: { module: CrmModule; fieldKey: string; onAdded: () => void }) {
  const context = useMemo(() => getLaravelContext(), [])
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!value.trim() || !label.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await crmService.createPicklistValue(context, { module, fieldKey, value: value.trim(), label: label.trim() })
      setValue(''); setLabel(''); setOpen(false)
      onAdded()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add this value.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
        Add value
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Stored value…" className="h-8 w-40" />
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Display label…" className="h-8 w-40" />
      <Button size="sm" disabled={submitting || !value.trim() || !label.trim()} onClick={() => void submit()}>
        {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : 'Add'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setError('') }}>Cancel</Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

function ValueRow({ row, onChanged }: { row: CrmPicklistAdminRow; onChanged: () => void }) {
  const context = useMemo(() => getLaravelContext(), [])
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const update = async (payload: Partial<{ label: string; isDefault: boolean; status: boolean }>) => {
    setBusy(true)
    try {
      await crmService.updatePicklistValue(context, row.id, payload)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${row.status ? '' : 'opacity-50'}`}>
      <button
        type="button"
        aria-label={`Make ${row.label} the default`}
        disabled={busy}
        onClick={() => void update({ isDefault: true })}
        className={row.isDefault ? 'text-warning' : 'text-muted-foreground/40 hover:text-muted-foreground'}
      >
        <Star className="size-4" fill={row.isDefault ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>

      {editingLabel === null ? (
        <button type="button" className="min-w-0 flex-1 truncate text-left text-sm text-foreground" onClick={() => setEditingLabel(row.label)}>
          {row.label}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            value={editingLabel}
            onChange={(e) => setEditingLabel(e.target.value)}
            className="h-7 flex-1"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && editingLabel.trim()) { void update({ label: editingLabel.trim() }); setEditingLabel(null) } }}
          />
          <Button size="sm" className="h-7" disabled={busy || !editingLabel.trim()} onClick={() => { void update({ label: editingLabel.trim() }); setEditingLabel(null) }}>Save</Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingLabel(null)}>Cancel</Button>
        </div>
      )}

      <span className="shrink-0 text-xs text-muted-foreground">{row.value}</span>

      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" checked={row.status} disabled={busy} onChange={(e) => void update({ status: e.target.checked })} />
        Active
      </label>
    </li>
  )
}

/**
 * Picklist Values - add/relabel/reorder-by-drag-free/deactivate the stock
 * dropdown values (Lead Status, Lead Source, Industry, etc.), the "stock-
 * picklist runtime editing" the plan's own Built checklist promised but
 * CrmPicklistController never actually implemented (index() was read-only
 * until this phase). `value` is immutable once created - only `label`,
 * `isDefault` and `status` (active/inactive) can change, same reasoning as
 * the Custom Fields engine beside it: existing records already store the
 * exact value string, so renaming it would orphan them.
 */
export function CrmPicklistAdmin() {
  const context = useMemo(() => getLaravelContext(), [])
  const [fieldKeys, setFieldKeys] = useState<Record<string, string[]>>({})
  const [rows, setRows] = useState<CrmPicklistAdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const response = await crmService.getPicklistAdmin(context)
      setFieldKeys(response.data.fieldKeys)
      setRows(response.data.rows)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load picklist values.')
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
        Loading picklist values…
      </div>
    )
  }

  if (error) {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
  }

  return (
    <div className="space-y-6">
      {(Object.keys(fieldKeys) as CrmModule[]).map((module) => (
        <section key={module} className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">{MODULE_LABEL[module] ?? module}</h2>
          {fieldKeys[module].map((fieldKey) => {
            const groupRows = rows
              .filter((row) => row.module === module && row.fieldKey === fieldKey)
              .sort((a, b) => a.sortOrder - b.sortOrder)

            return (
              <div key={fieldKey} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{FIELD_KEY_LABEL[fieldKey] ?? fieldKey}</Badge>
                  <AddValueForm module={module} fieldKey={fieldKey} onAdded={() => void load()} />
                </div>
                {groupRows.length === 0 && <p className="px-2 text-sm text-muted-foreground">No values yet.</p>}
                <ul className="divide-y divide-border">
                  {groupRows.map((row) => <ValueRow key={row.id} row={row} onChanged={() => void load()} />)}
                </ul>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
