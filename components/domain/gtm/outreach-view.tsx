'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  OUTREACH_STATUSES, gtmService, outreachService,
  type GtmAccount, type GtmContact, type OutreachAttempt, type OutreachEventType, type OutreachMessage, type OutreachReadiness, type Suppression,
} from '@/services/gtm/gtm'
import { GtmPageHeader, errMsg, fmtDate, useGtmReady } from './gtm-shared'

const TEXTAREA = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm'
const label = (s: string) => s.replace(/_/g, ' ')
const SUPPRESSIONS_TAB = '__suppressions'
const EDITABLE = ['draft', 'rejected', 'pending_approval', 'approved', 'failed']

/** A datetime-local value (browser time) as 'YYYY-MM-DD HH:mm:ss' in UTC, the way the rest of GTM reads server dates. */
function toServerTime(local: string): string | undefined {
  if (!local) return undefined
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * Outreach. Every email passes through four separate steps - written, submitted, approved by a
 * person, sent - and the server re-checks everything at send time. The panel at the top says
 * plainly whether sending is possible and, if not, exactly why. Editing the text of an approved
 * message withdraws its approval and send time.
 */
export function OutreachView() {
  const ready = useGtmReady()
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<OutreachMessage[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [readiness, setReadiness] = useState<OutreachReadiness | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [probing, setProbing] = useState(false)
  const [creating, setCreating] = useState(false)
  const onSuppressions = status === SUPPRESSIONS_TAB

  const load = useCallback(async () => {
    try {
      const [l, r] = await Promise.all([outreachService.list(status === SUPPRESSIONS_TAB ? '' : status), outreachService.readiness()])
      setItems(l.data.items)
      setCounts(l.data.counts)
      setReadiness((prev) => ({ ...r.data, smtp: prev?.smtp ?? null }))
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load outreach'))
    }
  }, [status])

  useEffect(() => { if (ready) queueMicrotask(() => void load()) }, [ready, load])

  const probe = async () => {
    setProbing(true)
    try {
      setReadiness((await outreachService.readiness(true)).data)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setProbing(false)
    }
  }

  const open = items?.find((m) => m.id === openId) ?? null

  return (
    <div className="p-6">
      <GtmPageHeader
        title="Outreach"
        description="Emails to your contacts. Nothing is sent without a person approving that exact text, and every email carries a one-click unsubscribe link."
        actions={<Button onClick={() => setCreating(true)}><Plus className="mr-1 size-4" />New message</Button>}
      />

      {readiness && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${readiness.can_send ? 'border-border' : 'border-amber-300 bg-amber-50/50'}`}>
          <div className="flex flex-wrap items-center gap-2">
            {readiness.can_send ? <CheckCircle2 className="size-4 text-green-600" /> : <AlertTriangle className="size-4 text-amber-600" />}
            <span className="font-medium">{readiness.can_send ? 'Sending is enabled' : 'Sending is not enabled'}</span>
            <span className="text-muted-foreground">from {readiness.from_name ? `${readiness.from_name} <${readiness.from}>` : readiness.from} via {readiness.mailer}{readiness.host ? ` (${readiness.host})` : ''} · {readiness.sent_today} of {readiness.daily_cap} sent today</span>
            <Button size="sm" variant="outline" className="ml-auto" disabled={probing} onClick={probe}>
              {probing ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <ShieldCheck className="mr-1 size-3.5" />}Test mail connection
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <ReadyChip ok={readiness.platform_gate_allows} text="Platform mail gate" />
            <ReadyChip ok={readiness.gtm_sending_enabled} text="GTM sending switch" />
            <ReadyChip ok={readiness.unsubscribe_link_ok} text="Unsubscribe link reachable" />
            <ReadyChip ok={readiness.scheduler_enabled === true} text={readiness.scheduler_enabled ? 'Scheduler on: scheduled messages send themselves' : 'Scheduler off: scheduled messages wait for a person'} />
            {readiness.require_second_approver && <Badge variant="outline">A second administrator must approve what you write</Badge>}
          </div>
          {readiness.smtp && <p className={`mt-1 text-xs ${readiness.smtp.ok ? 'text-green-700' : 'text-destructive'}`}>{readiness.smtp.ok ? 'The mail server accepted the connection and login. Nothing was sent.' : `Mail connection failed: ${readiness.smtp.error}`}</p>}
          {readiness.blockers.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">{readiness.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
          {readiness.unsubscribe_problem && !readiness.blockers.includes(readiness.unsubscribe_problem) && <p className="mt-1 text-xs text-muted-foreground">Unsubscribe link: {readiness.unsubscribe_problem}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Replies and bounces are recorded by an inbound mail webhook signed by your mail provider, or by hand from a sent message below. The server does not report whether the webhook is configured.</p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {['', ...OUTREACH_STATUSES, SUPPRESSIONS_TAB].map((s) => (
          <button key={s || 'all'} onClick={() => setStatus(s)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${status === s ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}>
            {s === SUPPRESSIONS_TAB ? 'Suppression list' : s ? label(s) : 'All'}{s && s !== SUPPRESSIONS_TAB && counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {onSuppressions ? <SuppressionsTab /> : error ? <ErrorState title="Could not load outreach" description={error} retry={load} /> : !items ? <Skeleton className="h-40" /> : items.length === 0 ? (
        <EmptyState title="No messages" description="Write a message, or run the Outreach Agent on an account and save its draft, then submit it for approval." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">To</th><th className="p-3">Subject</th><th className="p-3">Status</th><th className="p-3">Sequence</th><th className="p-3">When</th></tr></thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={() => setOpenId(m.id)}>
                  <td className="p-3"><div className="font-medium">{m.contact_name}</div><div className="text-xs text-muted-foreground">{m.account_name}{m.contact_email ? ` · ${m.contact_email}` : ''}</div></td>
                  <td className="p-3">{m.subject}</td>
                  <td className="p-3"><Badge variant={m.status === 'sent' ? 'default' : 'outline'}>{label(m.status)}</Badge>{m.status === 'approved' && m.scheduled_for && <div className="mt-1 text-xs text-muted-foreground">scheduled {fmtDate(m.scheduled_for, true)}</div>}</td>
                  <td className="p-3">{m.sequence_key ? `step ${m.step}${m.due_at ? ` · due ${fmtDate(m.due_at)}` : ''}` : '—'}</td>
                  <td className="p-3">{fmtDate(m.sent_at ?? m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MessageDialog key={open ? `m-${open.id}` : 'none'} message={open} sendReady={readiness?.can_send ?? false} onClose={() => setOpenId(null)} onChanged={load} />
      <NewMessageDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setStatus(''); void load(); setOpenId(id) }} />
    </div>
  )
}

function ReadyChip({ ok, text }: { ok: boolean; text: string }) {
  return <span className={`rounded-full border px-2 py-0.5 ${ok ? 'border-border text-muted-foreground' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>{ok ? '✓' : '!'} {text}</span>
}

function SuppressionsTab() {
  const [q, setQ] = useState('')
  const [data, setData] = useState<{ items: Suppression[]; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<{ kind: 'email' | 'domain'; value: string; note: string }>({ kind: 'email', value: '', note: '' })

  const load = useCallback(async () => {
    try {
      setData((await outreachService.suppressions(q.trim() || undefined)).data)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load the suppression list'))
    }
  }, [q])
  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const act = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      after?.()
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="mb-3 max-w-3xl text-sm text-muted-foreground">Addresses and domains that must never be emailed. Unsubscribes, hard bounces and complaints are added automatically and cannot be removed; only entries added by hand can.</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className={SELECT} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'email' | 'domain' })}><option value="email">Email address</option><option value="domain">Domain</option></select>
        <Input className="w-64" placeholder={form.kind === 'email' ? 'name@example.com' : 'example.com'} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        <Input className="w-56" placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <Button disabled={busy || !form.value.trim()} onClick={() => act(() => outreachService.addSuppression({ kind: form.kind, value: form.value.trim(), note: form.note.trim() || undefined }), () => setForm({ ...form, value: '', note: '' }))}>Add</Button>
        <Input className="ml-auto w-56" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      {!data ? (error ? null : <Skeleton className="h-32" />) : data.items.length === 0 ? (
        <EmptyState title="Nothing suppressed" description="No address or domain is on the suppression list." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Value</th><th className="p-3">Type</th><th className="p-3">Reason</th><th className="p-3">Note</th><th className="p-3">Added</th><th className="p-3" /></tr></thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3 font-medium">{s.value}</td><td className="p-3">{s.kind}</td><td className="p-3"><Badge variant="outline">{label(s.reason)}</Badge></td>
                  <td className="p-3">{s.note || '—'}</td><td className="p-3">{fmtDate(s.created_at)}</td>
                  <td className="p-3 text-right">
                    {s.reason === 'manual'
                      ? <button className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${s.value}`} disabled={busy} onClick={() => { if (window.confirm(`Remove ${s.value} from the suppression list? It can be emailed again.`)) void act(() => outreachService.removeSuppression(s.id)) }}><Trash2 className="size-4" /></button>
                      : <span className="text-xs text-muted-foreground" title="Added because of a real event; it cannot be removed">locked</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border p-2 text-xs text-muted-foreground">{data.total} entr{data.total === 1 ? 'y' : 'ies'}{data.total > data.items.length ? `, showing the latest ${data.items.length}` : ''}</p>
        </div>
      )}
    </div>
  )
}

function NewMessageDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [accounts, setAccounts] = useState<GtmAccount[]>([])
  const [contacts, setContacts] = useState<GtmContact[]>([])
  const [f, setF] = useState({ account_id: '', contact_id: '', subject: '', body: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    void gtmService.listAccounts({}).then((r) => setAccounts(r.data.items)).catch(() => setAccounts([]))
  }, [open])
  useEffect(() => {
    if (!f.account_id) { queueMicrotask(() => setContacts([])); return }
    void gtmService.getAccount(Number(f.account_id)).then((r) => setContacts(r.data.contacts)).catch(() => setContacts([]))
  }, [f.account_id])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await outreachService.create({ contact_id: Number(f.contact_id), subject: f.subject.trim(), body: f.body })
      setF({ account_id: '', contact_id: '', subject: '', body: '' })
      onCreated(res.data.message.id)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>New message</DialogTitle><DialogDescription>Saved as a draft. It still has to be submitted and approved before anything is sent.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select className={SELECT} value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value, contact_id: '' })}>
              <option value="">Account *</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select className={SELECT} value={f.contact_id} disabled={!f.account_id} onChange={(e) => setF({ ...f, contact_id: e.target.value })}>
              <option value="">{f.account_id && contacts.length === 0 ? 'No contacts - add one first' : 'Contact *'}</option>
              {contacts.map((c) => <option key={c.id} value={c.id} disabled={c.status !== 'active'}>{c.full_name}{c.status !== 'active' ? ` (${label(c.status)})` : ''}</option>)}
            </select>
          </div>
          <Input placeholder="Subject *" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
          <textarea className={TEXTAREA} rows={9} placeholder="Message (at least 20 characters). An unsubscribe link is added when it is sent." value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={saving || !f.contact_id || !f.subject.trim() || f.body.trim().length < 20} onClick={save}>{saving ? 'Saving…' : 'Save draft'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MessageDialog({ message: m, sendReady, onClose, onChanged }: { message: OutreachMessage | null; sendReady: boolean; onClose: () => void; onChanged: () => void }) {
  const [subject, setSubject] = useState(m?.subject ?? '')
  const [body, setBody] = useState(m?.body ?? '')
  const [sendAt, setSendAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<OutreachAttempt[] | null>(null)

  const messageId = m?.id ?? null
  const loadAttempts = useCallback(async () => {
    if (messageId === null) return
    try {
      setAttempts((await outreachService.attempts(messageId)).data.attempts)
    } catch {
      setAttempts([])
    }
  }, [messageId])
  useEffect(() => { queueMicrotask(() => void loadAttempts()) }, [loadAttempts, m?.status, m?.attempts])

  const run = async (fn: () => Promise<unknown>, closeAfter = false) => {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await fn()
      onChanged()
      if (closeAfter) onClose()
    } catch (e) {
      setError(errMsg(e))
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const editable = !!m && EDITABLE.includes(m.status)
  const dirty = m ? subject !== m.subject || body !== m.body : false
  const withdraws = m?.status === 'approved' || m?.status === 'pending_approval' || m?.status === 'failed'

  return (
    <Dialog open={m !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{m?.subject ?? 'Message'}</DialogTitle>
          <DialogDescription>{m ? `To ${m.contact_name}${m.contact_email ? ` <${m.contact_email}>` : ' (no email address)'} · ${m.account_name} · ${label(m.status)}` : ''}</DialogDescription>
        </DialogHeader>
        {m && (
          <div className="space-y-4">
            {m.contact_status && m.contact_status !== 'active' && <p className="rounded bg-amber-50 p-2 text-sm text-amber-900">This contact is marked &lsquo;{label(m.contact_status)}&rsquo;, so nothing can be sent to them.</p>}
            {m.decision_note && <p className="text-sm text-muted-foreground">Note: {m.decision_note}</p>}
            {m.error && <p className="rounded bg-red-50 p-2 text-sm text-destructive">Last send failed: {m.error}{m.next_attempt_at ? ` · retry planned ${fmtDate(m.next_attempt_at, true)}` : ''}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {info && <p className="text-sm text-green-700">{info}</p>}
            {m.status === 'approved' && (
              <p className="rounded-md border border-border bg-muted/20 p-2 text-sm">
                {m.scheduled_for ? <>Scheduled to send {fmtDate(m.scheduled_for, true)}. </> : <>Approved, not scheduled: only a person can send it. </>}
                {m.approved_at && <span className="text-muted-foreground">Approved {fmtDate(m.approved_at, true)}.</span>}
              </p>
            )}

            {editable ? (
              <div className="space-y-2">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                <textarea className={TEXTAREA} rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
                {m.status === 'rejected' && <p className="text-xs text-muted-foreground">Saving an edit returns it to draft.</p>}
                {withdraws && <p className="text-xs text-amber-700">Changing the subject or text withdraws {m.status === 'approved' ? 'the approval and any send time' : 'its place in the approval queue'}: the message goes back to draft and must be submitted and approved again. Saving without a change does nothing.</p>}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm"><p className="font-medium">Subject: {m.subject}</p><p className="mt-2 whitespace-pre-wrap">{m.body}</p><p className="mt-3 text-xs text-muted-foreground">An unsubscribe link is added to the end of every email when it is sent.</p></div>
            )}

            {m.status === 'pending_approval' && (
              <div>
                <label className="text-xs text-muted-foreground">Optional: let the scheduler send it at (up to 90 days ahead)</label>
                <Input type="datetime-local" className="mt-1 w-64" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {editable && <Button size="sm" variant="outline" disabled={busy || !dirty || body.trim().length < 20 || !subject.trim()} onClick={() => run(() => outreachService.update(m.id, { subject, body }))}>Save changes</Button>}
              {m.status === 'draft' && <Button size="sm" disabled={busy || dirty} title={dirty ? 'Save your changes first' : undefined} onClick={() => run(() => outreachService.submit(m.id))}>Submit for approval</Button>}
              {m.status === 'pending_approval' && (
                <>
                  <Button size="sm" disabled={busy || dirty} onClick={() => { if (window.confirm(`Approve this exact text to be emailed to ${m.contact_name}?${sendAt ? `\n\nIt will be scheduled for ${new Date(sendAt).toLocaleString()}.` : ''}\n\nSubject: ${m.subject}\n\n${m.body}`)) void run(() => outreachService.approve(m.id, undefined, toServerTime(sendAt))) }}>{sendAt ? 'Approve and schedule' : 'Approve'}</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => { const n = window.prompt('Why is this being rejected?'); if (n && n.trim().length >= 3) void run(() => outreachService.reject(m.id, n.trim())) }}>Reject</Button>
                </>
              )}
              {m.status === 'approved' && m.scheduled_for && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => outreachService.unschedule(m.id))}>Unschedule</Button>}
              {(m.status === 'approved' || m.status === 'failed') && (
                <Button size="sm" disabled={busy || !sendReady} title={sendReady ? undefined : 'Sending is not enabled - see the panel above'}
                  onClick={() => { if (window.confirm(`Send this email to ${m.contact_name} <${m.contact_email}> now? This cannot be undone.`)) void run(() => outreachService.send(m.id)) }}>
                  {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}{m.status === 'failed' ? 'Retry send' : 'Send now'}
                </Button>
              )}
              {!['sent', 'sending', 'cancelled'].includes(m.status) && <Button size="sm" variant="outline" className="ml-auto text-destructive" disabled={busy} onClick={() => run(() => outreachService.cancel(m.id), true)}>Cancel message</Button>}
            </div>
            {m.status === 'approved' && !sendReady && <p className="text-xs text-muted-foreground">Approved, but sending is switched off, so it is waiting. See the panel at the top for what to change.</p>}
            {m.sent_at && <p className="text-xs text-muted-foreground">Sent {fmtDate(m.sent_at, true)}.</p>}

            {m.sequence_key && <SequencePanel sequenceKey={m.sequence_key} busy={busy} run={run} />}
            {m.status === 'sent' && <OutcomePanel message={m} busy={busy} run={run} onDone={setInfo} />}

            <section>
              <h3 className="mb-1 text-sm font-semibold">Send attempts</h3>
              {!attempts ? <Skeleton className="h-8" /> : attempts.length === 0 ? <p className="text-xs text-muted-foreground">No send has been attempted.</p> : (
                <ul className="space-y-1 text-xs">
                  {attempts.map((a) => (
                    <li key={a.id} className="flex flex-wrap gap-2 border-b border-border py-1">
                      <span className="w-28 shrink-0 text-muted-foreground">{fmtDate(a.created_at, true)}</span>
                      <Badge variant="outline">#{a.attempt} {a.outcome}</Badge>
                      {a.code && <span className="text-muted-foreground">{a.code}</span>}
                      <span>{a.detail}</span>
                      <span className="text-muted-foreground">{a.scheduled ? 'by the scheduler' : 'by a person'}</span>
                    </li>
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

/** Whole-sequence actions: the server applies each to every step, still checking each step individually. */
function SequencePanel({ sequenceKey, busy, run }: { sequenceKey: string; busy: boolean; run: (fn: () => Promise<unknown>, closeAfter?: boolean) => Promise<void> }) {
  const [schedule, setSchedule] = useState(false)
  const [startAt, setStartAt] = useState('')
  return (
    <section className="rounded-md border border-border p-3">
      <h3 className="mb-1 text-sm font-semibold">This message is part of a sequence</h3>
      <p className="mb-2 text-xs text-muted-foreground">These act on every step. Approving a sequence approves each step&apos;s exact text; every step is still checked again when it is sent.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => outreachService.sequenceSubmit(sequenceKey))}>Submit all drafts</Button>
        <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />Schedule steps</label>
        {schedule && <Input type="datetime-local" className="w-56" title="First step sends at (blank = now); later steps keep their spacing" value={startAt} onChange={(e) => setStartAt(e.target.value)} />}
        <Button size="sm" disabled={busy} onClick={() => { if (window.confirm('Approve every submitted step of this sequence? Each exact text becomes eligible to be emailed.')) void run(() => outreachService.sequenceApprove(sequenceKey, { schedule: schedule || undefined, start_at: schedule ? toServerTime(startAt) : undefined })) }}>Approve all steps</Button>
        <Button size="sm" variant="outline" className="ml-auto text-destructive" disabled={busy} onClick={() => { if (window.confirm('Cancel every unsent step of this sequence?')) void run(() => outreachService.sequenceCancel(sequenceKey)) }}>Cancel sequence</Button>
      </div>
    </section>
  )
}

/** Record what happened to a sent email. This changes the contact's status (a bounce or complaint blocks further email). */
function OutcomePanel({ message: m, busy, run, onDone }: { message: OutreachMessage; busy: boolean; run: (fn: () => Promise<unknown>, closeAfter?: boolean) => Promise<void>; onDone: (s: string) => void }) {
  const [type, setType] = useState<OutreachEventType>('reply')
  const [bounce, setBounce] = useState<'hard' | 'soft'>('hard')
  const [reason, setReason] = useState('')
  return (
    <section className="rounded-md border border-border p-3">
      <h3 className="mb-1 text-sm font-semibold">Record an outcome</h3>
      <p className="mb-2 text-xs text-muted-foreground">Use this when a reply or bounce arrives outside the inbound mail webhook. A hard bounce or complaint also stops all further email to this contact.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select className={SELECT} value={type} onChange={(e) => setType(e.target.value as OutreachEventType)}><option value="reply">Reply received</option><option value="bounce">Bounce</option><option value="complaint">Spam complaint</option></select>
        {type === 'bounce' && <select className={SELECT} value={bounce} onChange={(e) => setBounce(e.target.value as 'hard' | 'soft')}><option value="hard">Hard</option><option value="soft">Soft</option></select>}
        <Input className="w-56" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => {
          const r = await outreachService.recordEvent(m.contact_id, { type, bounce_type: type === 'bounce' ? bounce : undefined, reason: reason.trim() || undefined })
          onDone(`Recorded: ${r.data.status}${r.data.detail ? ` - ${r.data.detail}` : ''}`)
        })}>Record</Button>
      </div>
    </section>
  )
}
