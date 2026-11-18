'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  customerService, renewalService,
  type CustomerRow, type DirectoryUser, type Renewal, type RenewalBucket, type RenewalList, type RenewalStatus,
} from '@/services/gtm/customers'
import { MeasuredTag, errMsg, fmtDate, useGtmCanWrite, useGtmReady } from './gtm-shared'

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm'
const OPEN: RenewalStatus[] = ['upcoming', 'in_progress']

/** A recorded renewal amount with its own currency; never combined with another currency. */
export function fmtAmount(amount: string | number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return 'No amount'
  return `${currency ?? ''} ${Number(amount).toLocaleString('en-IN')}`.trim()
}

/** One entry per currency, never summed across currencies. */
function perCurrency(b: RenewalBucket): string {
  const parts = Object.entries(b.value_by_currency).map(([c, v]) => `${c} ${v.toLocaleString('en-IN')}`)
  return parts.length ? parts.join(' · ') : '—'
}

const BUCKETS: { key: keyof RenewalList['pipeline']; label: string; warn?: boolean }[] = [
  { key: 'overdue', label: 'Overdue', warn: true }, { key: 'due_30', label: 'Due in 30 days' }, { key: 'due_60', label: '31–60 days' },
  { key: 'due_90', label: '61–90 days' }, { key: 'later', label: 'Later' }, { key: 'open_total', label: 'All open' },
]

export function useDirectory(enabled: boolean) {
  const [users, setUsers] = useState<DirectoryUser[]>([])
  useEffect(() => {
    if (!enabled) return
    void customerService.directory().then((r) => setUsers(r.data.users)).catch(() => setUsers([]))
  }, [enabled])
  return users
}

export function RenewalsTab({ customers, onChanged, version }: { customers: CustomerRow[]; onChanged: () => void; version: number }) {
  const canWrite = useGtmCanWrite()
  const ready = useGtmReady()
  const [status, setStatus] = useState('open')
  const [within, setWithin] = useState('')
  const [data, setData] = useState<RenewalList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Renewal | 'new' | null>(null)
  const [closing, setClosing] = useState<Renewal | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const users = useDirectory(ready)

  const load = useCallback(async () => {
    try {
      const q: { status?: string; within_days?: 30 | 60 | 90 } = { status: status === 'open' ? undefined : status }
      if (within) q.within_days = Number(within) as 30 | 60 | 90
      setData((await renewalService.list(q)).data)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load renewals'))
    }
  }, [status, within])

  useEffect(() => { if (ready) queueMicrotask(() => void load()) }, [ready, load, version])

  const refresh = () => { void load(); onChanged() }

  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null)
    try { await fn(); refresh() } catch (e) { setActionError(errMsg(e)) }
  }

  return (
    <div>
      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {BUCKETS.map((b) => {
            const bucket = data.pipeline[b.key]
            return (
              <div key={b.key} className={`rounded-lg border bg-card p-3 ${b.warn && bucket.count > 0 ? 'border-amber-300' : 'border-border'}`}>
                <div className="text-xs text-muted-foreground">{b.label}</div>
                <div className="text-xl font-semibold">{bucket.count}</div>
                <div className="text-xs">{perCurrency(bucket)}</div>
                {bucket.without_amount > 0 && <div className="text-xs text-muted-foreground">{bucket.without_amount} without an amount</div>}
              </div>
            )
          })}
          <div className="col-span-full flex items-center gap-2 text-xs text-muted-foreground"><MeasuredTag />Open renewals only, counted from recorded renewals. Amounts are shown per currency and never added across currencies.</div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className={SELECT} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="open">Open (upcoming + in progress)</option>
          <option value="all">All statuses</option>
          {['upcoming', 'in_progress', 'renewed', 'churned', 'cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className={SELECT} value={within} onChange={(e) => setWithin(e.target.value)} aria-label="Due within">
          <option value="">Any date</option><option value="30">Due within 30 days</option><option value="60">Due within 60 days</option><option value="90">Due within 90 days</option>
        </select>
        {canWrite && <Button size="sm" className="ml-auto" onClick={() => setEditing('new')}><Plus className="mr-1 size-3.5" />Record renewal</Button>}
      </div>
      {actionError && <p className="mb-2 text-sm text-destructive">{actionError}</p>}

      {error ? <ErrorState title="Could not load renewals" description={error} retry={load} /> : !data ? <Skeleton className="h-40" /> : data.items.length === 0 ? (
        <EmptyState title="No renewals recorded" description="Nothing is inferred: a customer with no renewal row simply has none recorded. Record a renewal against a customer account." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Renewal</th><th className="p-3">Account</th><th className="p-3">Date</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Owner</th><th className="p-3" /></tr></thead>
            <tbody>
              {data.items.map((r) => {
                const open = OPEN.includes(r.status)
                return (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="p-3 font-medium">{r.name}{r.outcome_note && <p className="text-xs font-normal text-muted-foreground">{r.outcome_note}</p>}</td>
                    <td className="p-3">{r.account_name}</td>
                    <td className="p-3">{fmtDate(r.renewal_date)}</td>
                    <td className="p-3">{fmtAmount(r.amount, r.currency)}</td>
                    <td className="p-3"><Badge variant="outline">{r.status.replace('_', ' ')}</Badge></td>
                    <td className="p-3">{users.find((u) => u.id === r.owner_user_id)?.name ?? (r.owner_user_id ? `User #${r.owner_user_id}` : '—')}</td>
                    <td className="p-3">
                      {open ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          {r.status === 'upcoming' && <Button size="sm" variant="outline" onClick={() => void act(() => renewalService.setStatus(r.id, { status: 'in_progress' }))}>Start</Button>}
                          <Button size="sm" variant="outline" onClick={() => setClosing(r)}>Close…</Button>
                          <Button size="icon" variant="ghost" aria-label="Edit renewal" onClick={() => setEditing(r)}><Pencil className="size-3.5" /></Button>
                          <Button size="icon" variant="ghost" aria-label="Remove renewal" onClick={() => { if (window.confirm(`Remove renewal "${r.name}"?`)) void act(() => renewalService.remove(r.id)) }}><Trash2 className="size-3.5" /></Button>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Closed {fmtDate(r.closed_at)}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <RenewalFormDialog target={editing} customers={customers} users={users} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />
      <CloseRenewalDialog key={closing?.id ?? 'none'} renewal={closing} onClose={() => setClosing(null)} onDone={() => { setClosing(null); refresh() }} />
    </div>
  )
}

function RenewalFormDialog({ target, customers, users, onClose, onSaved }: {
  target: Renewal | 'new' | null; customers: CustomerRow[]; users: DirectoryUser[]; onClose: () => void; onSaved: () => void
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {target !== null && <RenewalForm key={target === 'new' ? 'new' : target.id} target={target} customers={customers} users={users} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function RenewalForm({ target, customers, users, onClose, onSaved }: {
  target: Renewal | 'new'; customers: CustomerRow[]; users: DirectoryUser[]; onClose: () => void; onSaved: () => void
}) {
  const existing = target === 'new' ? null : target
  const [f, setF] = useState({
    account_id: existing ? String(existing.account_id) : '', name: existing?.name ?? '', renewal_date: existing?.renewal_date?.slice(0, 10) ?? '',
    amount: existing?.amount ?? '', currency: existing?.currency ?? '', owner_user_id: existing?.owner_user_id ? String(existing.owner_user_id) : '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    const base = {
      name: f.name.trim(), renewal_date: f.renewal_date,
      amount: f.amount !== '' ? Number(f.amount) : null, currency: f.amount !== '' ? f.currency.trim().toUpperCase() : null,
      owner_user_id: f.owner_user_id ? Number(f.owner_user_id) : null,
    }
    try {
      if (existing) await renewalService.update(existing.id, base)
      else await renewalService.create({ ...base, account_id: Number(f.account_id) })
      onSaved()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{existing ? 'Edit renewal' : 'Record renewal'}</DialogTitle>
        <DialogDescription>{existing ? 'Only open renewals can be edited, and a renewal cannot move to another account.' : 'Only customer accounts have renewals. A currency is required when an amount is set.'}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {!existing && (
          <select className={`${SELECT} w-full`} value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}>
            <option value="">{customers.length === 0 ? 'No customer accounts' : 'Customer account *'}</option>
            {customers.map((c) => <option key={c.account_id} value={c.account_id}>{c.name}</option>)}
          </select>
        )}
        <Input placeholder="Renewal name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div><label className="text-xs text-muted-foreground">Renewal date *</label><Input type="date" value={f.renewal_date} onChange={(e) => setF({ ...f, renewal_date: e.target.value })} /></div>
        <div className="flex gap-2">
          <Input type="number" min="0" placeholder="Amount (optional)" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <Input className="w-28" maxLength={3} placeholder="Currency" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} />
        </div>
        <select className={`${SELECT} w-full`} value={f.owner_user_id} onChange={(e) => setF({ ...f, owner_user_id: e.target.value })}>
          <option value="">No owner</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving || !f.name.trim() || !f.renewal_date || (!existing && !f.account_id) || (f.amount !== '' && f.currency.length !== 3)} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </>
  )
}

/** Closing is final: the outcome must be chosen and explicitly confirmed; a churn needs a reason. */
function CloseRenewalDialog({ renewal, onClose, onDone }: { renewal: Renewal | null; onClose: () => void; onDone: () => void }) {
  const [outcome, setOutcome] = useState<'renewed' | 'churned' | 'cancelled'>('renewed')
  const [note, setNote] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const submit = async () => {
    if (!renewal) return
    setBusy(true)
    setError(null)
    try {
      const res = await renewalService.setStatus(renewal.id, {
        status: outcome, confirm: true, note: note.trim() || undefined, next_renewal_date: outcome === 'renewed' && next ? next : undefined,
      })
      if (res.data.account_stage_changed_to) setInfo(`The account's stage changed to ${res.data.account_stage_changed_to}.`)
      else onDone()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={renewal !== null} onOpenChange={(o) => !o && (info ? onDone() : onClose())}>
      <DialogContent>
        <DialogHeader><DialogTitle>Close renewal</DialogTitle><DialogDescription>{renewal?.name} — this is final and cannot be undone.</DialogDescription></DialogHeader>
        {info ? (
          <div className="space-y-3"><p className="text-sm">{info}</p><div className="flex justify-end"><Button onClick={onDone}>Done</Button></div></div>
        ) : (
          <div className="space-y-3">
            <select className={`${SELECT} w-full`} value={outcome} onChange={(e) => { setOutcome(e.target.value as typeof outcome); setConfirm(false) }}>
              <option value="renewed">Renewed</option><option value="churned">Churned</option><option value="cancelled">Cancelled</option>
            </select>
            <Input placeholder={outcome === 'churned' ? 'Why did the customer churn? *' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} />
            {outcome === 'renewed' && (
              <div><label className="text-xs text-muted-foreground">Next renewal date (optional, creates the next renewal)</label><Input type="date" value={next} onChange={(e) => setNext(e.target.value)} /></div>
            )}
            {outcome === 'churned' && <p className="text-xs text-muted-foreground">If no other renewal is open for this account, its stage will change to churned.</p>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />I confirm this renewal is {outcome}.</label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={busy || !confirm || (outcome === 'churned' && !note.trim())} onClick={submit}>{busy ? 'Saving…' : 'Close renewal'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
