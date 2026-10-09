'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2, Plus, Search, Trash2, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  ACCOUNT_STAGES, ACTIVITY_TYPES, CONTACT_ROLES, gtmService,
  type AccountDetail, type GtmAccount, type GtmCandidate,
} from '@/services/gtm/gtm'
import { GtmPageHeader, errMsg, fmtDate, useGtmReady } from './gtm-shared'

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

type Tab = 'accounts' | 'research'

/**
 * Prospecting. Accounts are the working list; "From research" is every company the tenant's
 * own signal research found that has not been promoted yet, with its strongest live signal
 * and the source it came from. Nothing on this page is generated or seeded.
 */
export function ProspectingView() {
  const ready = useGtmReady()
  const [tab, setTab] = useState<Tab>('accounts')
  const [openId, setOpenId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const bump = () => setRefresh((n) => n + 1)

  return (
    <div className="p-6">
      <GtmPageHeader
        title="Prospecting"
        description="Your working list of target accounts, the people at them, and the buying signals your research found."
        actions={<Button onClick={() => setAdding(true)}><Plus className="mr-1 size-4" />Add account</Button>}
      />
      <div className="mb-4 flex gap-1 border-b border-border">
        {([['accounts', 'Target accounts'], ['research', 'From research']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >{label}</button>
        ))}
      </div>

      {ready && tab === 'accounts' && <AccountsTab refresh={refresh} onOpen={setOpenId} />}
      {ready && tab === 'research' && <ResearchTab refresh={refresh} onPromoted={(id) => { bump(); setOpenId(id) }} />}

      <AddAccountDialog open={adding} onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); bump(); setOpenId(id) }} />
      <AccountDialog key={openId ?? "none"} id={openId} onClose={() => setOpenId(null)} onChanged={bump} />
    </div>
  )
}

function AccountsTab({ refresh, onOpen }: { refresh: number; onOpen: (id: number) => void }) {
  const [q, setQ] = useState('')
  const [stage, setStage] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ items: GtmAccount[]; total: number; per_page: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData((await gtmService.listAccounts({ q, stage, page })).data)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load accounts'))
    } finally {
      setLoading(false)
    }
  }, [q, stage, page])

  useEffect(() => { queueMicrotask(() => void load()) }, [load, refresh])

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input className="w-64 pl-8" placeholder="Search name, domain, industry" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} />
        </div>
        <select className={SELECT} value={stage} onChange={(e) => { setPage(1); setStage(e.target.value) }}>
          <option value="">All stages</option>
          {ACCOUNT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && !data ? <Skeleton className="h-40" /> : error ? (
        <ErrorState title="Could not load accounts" description={error} retry={load} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title={q || stage ? 'No accounts match' : 'No accounts yet'} description={q || stage ? 'Try clearing the filters.' : 'Add an account, or promote a company from the "From research" tab.'} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr><th className="p-3">Account</th><th className="p-3">Stage</th><th className="p-3">Contacts</th><th className="p-3">Signals</th><th className="p-3">ICP fit</th><th className="p-3">Last activity</th></tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id} className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={() => onOpen(a.id)}>
                    <td className="p-3"><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{[a.industry, a.location].filter(Boolean).join(' · ') || a.domain || '—'}</div></td>
                    <td className="p-3"><Badge variant="outline">{a.stage}</Badge></td>
                    <td className="p-3">{a.contacts_count ?? 0}</td>
                    <td className="p-3">{a.signals_count ?? 0}</td>
                    <td className="p-3">{a.icp_fit_score === null ? <span className="text-muted-foreground">Not scored</span> : <span title="AI estimate">{a.icp_fit_score} <span className="text-[10px] text-amber-600">est.</span></span>}</td>
                    <td className="p-3">{fmtDate(a.last_activity_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{data.total} account(s)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page * data.per_page >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ResearchTab({ refresh, onPromoted }: { refresh: number; onPromoted: (accountId: number) => void }) {
  const [items, setItems] = useState<GtmCandidate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      setItems((await gtmService.candidates()).data.items)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load researched companies'))
    }
  }, [])
  useEffect(() => { queueMicrotask(() => void load()) }, [load, refresh])

  const promote = async (c: GtmCandidate) => {
    setBusy(c.id)
    try {
      const res = await gtmService.promoteCompany(c.id)
      onPromoted(res.data.account.id)
    } catch (e) {
      setError(errMsg(e, 'Could not add this company'))
    } finally {
      setBusy(null)
    }
  }

  if (error) return <ErrorState title="Could not load" description={error} retry={load} />
  if (!items) return <Skeleton className="h-40" />
  if (items.length === 0) {
    return <EmptyState title="Nothing waiting" description="Every researched company is already an account. New companies appear here after the next signal research run." />
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((c) => (
        <div key={c.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">{[c.industry, c.location].filter(Boolean).join(' · ') || 'No industry or location recorded'}</div>
            </div>
            <Button size="sm" disabled={busy === c.id} onClick={() => promote(c)}>
              {busy === c.id ? <Loader2 className="size-4 animate-spin" /> : 'Add as account'}
            </Button>
          </div>
          {c.top_signal ? (
            <div className="mt-3 rounded-md bg-muted/40 p-2 text-sm">
              <div className="mb-1 flex items-center gap-2"><Badge variant="outline">{c.top_signal.priority}</Badge><span className="text-xs text-muted-foreground">{c.signals_count} signal(s)</span></div>
              <p>{c.top_signal.title}</p>
              {c.top_signal.source_url && (
                <a href={c.top_signal.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary">Source <ExternalLink className="size-3" /></a>
              )}
            </div>
          ) : <p className="mt-3 text-xs text-muted-foreground">No live signals recorded.</p>}
        </div>
      ))}
    </div>
  )
}

function AddAccountDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [form, setForm] = useState({ name: '', domain: '', industry: '', location: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await gtmService.createAccount({
        name: form.name.trim(), domain: form.domain.trim() || null,
        industry: form.industry.trim() || null, location: form.location.trim() || null,
      })
      setForm({ name: '', domain: '', industry: '', location: '' })
      onCreated(res.data.account.id)
    } catch (e) {
      setError(errMsg(e, 'Could not create the account'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add account</DialogTitle><DialogDescription>A company you want to sell to.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Company name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Website or domain" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
          <Input placeholder="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={saving || form.name.trim() === ''} onClick={save}>{saving ? 'Saving…' : 'Create'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AccountDialog({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<AccountDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contact, setContact] = useState({ full_name: '', title: '', email: '', role_in_deal: '' })
  const [note, setNote] = useState({ type: 'note', subject: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (id === null) return
    try {
      setDetail((await gtmService.getAccount(id)).data)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load the account'))
    }
  }, [id])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      after?.()
      await load()
      onChanged()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const a = detail?.account

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{a?.name ?? 'Account'}</DialogTitle>
          <DialogDescription>{a ? [a.industry, a.location, a.domain].filter(Boolean).join(' · ') || 'No details recorded' : 'Loading…'}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!detail ? (error ? null : <Skeleton className="h-40" />) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Stage</span>
              <select className={SELECT} value={detail.account.stage} disabled={busy}
                onChange={(e) => run(() => gtmService.updateAccount(detail.account.id, { stage: e.target.value as GtmAccount['stage'] }))}>
                {ACCOUNT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <Badge variant="outline">source: {detail.account.source}</Badge>
              <Button size="sm" variant="outline" className="ml-auto text-destructive" disabled={busy}
                onClick={() => { if (window.confirm(`Remove ${detail.account.name} from your accounts?`)) void run(() => gtmService.deleteAccount(detail.account.id), onClose) }}>
                <Trash2 className="mr-1 size-3.5" />Remove
              </Button>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Buying signals ({detail.signals.length})</h3>
              {detail.signals.length === 0 ? <p className="text-sm text-muted-foreground">No signals linked to this account.</p> : (
                <ul className="space-y-2">
                  {detail.signals.map((s) => (
                    <li key={s.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="mb-1 flex items-center gap-2"><Badge variant="outline">{s.priority}</Badge>{s.signal_kind && <Badge variant="outline">{s.signal_kind}</Badge>}<span className="text-xs text-muted-foreground">{fmtDate(s.event_date)}</span></div>
                      <p className="font-medium">{s.title}</p>
                      {s.why_indicates_need && <p className="mt-1 text-muted-foreground">{s.why_indicates_need}</p>}
                      {s.sources.slice(0, 3).map((src) => (
                        <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer" className="mt-1 mr-3 inline-flex items-center gap-1 text-xs text-primary">{src.title || new URL(src.url).hostname}<ExternalLink className="size-3" /></a>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Contacts ({detail.contacts.length})</h3>
              {detail.contacts.length === 0 && <p className="mb-2 text-sm text-muted-foreground">No contacts yet. G2G does not invent people — add the ones you have found.</p>}
              <ul className="mb-3 space-y-1">
                {detail.contacts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span><strong>{c.full_name}</strong>{c.title ? ` — ${c.title}` : ''}{c.email ? ` · ${c.email}` : ''}{c.role_in_deal ? ` · ${c.role_in_deal.replace('_', ' ')}` : ''}</span>
                    <button className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${c.full_name}`} disabled={busy} onClick={() => run(() => gtmService.deleteContact(c.id))}><Trash2 className="size-4" /></button>
                  </li>
                ))}
              </ul>
              <div className="grid gap-2 md:grid-cols-5">
                <Input placeholder="Full name *" value={contact.full_name} onChange={(e) => setContact({ ...contact, full_name: e.target.value })} />
                <Input placeholder="Title" value={contact.title} onChange={(e) => setContact({ ...contact, title: e.target.value })} />
                <Input placeholder="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                <select className={SELECT} value={contact.role_in_deal} onChange={(e) => setContact({ ...contact, role_in_deal: e.target.value })}>
                  <option value="">Role…</option>
                  {CONTACT_ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
                <Button disabled={busy || contact.full_name.trim() === ''} onClick={() => run(
                  () => gtmService.addContact(detail.account.id, {
                    full_name: contact.full_name.trim(), title: contact.title || null, email: contact.email || null,
                    role_in_deal: (contact.role_in_deal || null) as never,
                  }),
                  () => setContact({ full_name: '', title: '', email: '', role_in_deal: '' }),
                )}><UserPlus className="mr-1 size-4" />Add</Button>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Activity</h3>
              <div className="mb-3 flex gap-2">
                <select className={SELECT} value={note.type} onChange={(e) => setNote({ ...note, type: e.target.value })}>
                  {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <Input placeholder="What happened?" value={note.subject} onChange={(e) => setNote({ ...note, subject: e.target.value })} />
                <Button disabled={busy || note.subject.trim() === ''} onClick={() => run(
                  () => gtmService.logActivity(detail.account.id, { type: note.type, subject: note.subject.trim() }),
                  () => setNote({ ...note, subject: '' }),
                )}>Log</Button>
              </div>
              {detail.activities.length === 0 ? <p className="text-sm text-muted-foreground">Nothing logged yet.</p> : (
                <ul className="space-y-1 text-sm">
                  {detail.activities.map((x) => (
                    <li key={x.id} className="flex gap-3 border-b border-border py-1.5"><span className="w-28 shrink-0 text-xs text-muted-foreground">{fmtDate(x.occurred_at, true)}</span><Badge variant="outline">{x.type}</Badge><span>{x.subject}</span></li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
