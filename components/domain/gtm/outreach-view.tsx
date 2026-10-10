'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OUTREACH_STATUSES, outreachService, type OutreachMessage, type OutreachReadiness } from '@/services/gtm/gtm'
import { GtmPageHeader, errMsg, fmtDate, useGtmReady } from './gtm-shared'

const TEXTAREA = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
const label = (s: string) => s.replace(/_/g, ' ')

/**
 * Outreach. Every email passes through four separate steps - written, submitted, approved by a
 * person, sent - and the server re-checks everything at send time. The panel at the top says
 * plainly whether sending is possible and, if not, exactly why.
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

  const load = useCallback(async () => {
    try {
      const [l, r] = await Promise.all([outreachService.list(status), outreachService.readiness()])
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
      <GtmPageHeader title="Outreach" description="Emails to your contacts. Nothing is sent without a person approving that exact text, and every email carries a one-click unsubscribe link." />

      {readiness && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${readiness.can_send ? 'border-border' : 'border-amber-300 bg-amber-50/50'}`}>
          <div className="flex flex-wrap items-center gap-2">
            {readiness.can_send ? <CheckCircle2 className="size-4 text-green-600" /> : <AlertTriangle className="size-4 text-amber-600" />}
            <span className="font-medium">{readiness.can_send ? 'Sending is enabled' : 'Sending is not enabled'}</span>
            <span className="text-muted-foreground">from {readiness.from} via {readiness.mailer}{readiness.host ? ` (${readiness.host})` : ''} · {readiness.sent_today} of {readiness.daily_cap} sent today</span>
            <Button size="sm" variant="outline" className="ml-auto" disabled={probing} onClick={probe}>
              {probing ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <ShieldCheck className="mr-1 size-3.5" />}Test mail connection
            </Button>
          </div>
          {readiness.smtp && <p className={`mt-1 text-xs ${readiness.smtp.ok ? 'text-green-700' : 'text-destructive'}`}>{readiness.smtp.ok ? 'The mail server accepted the connection and login. Nothing was sent.' : `Mail connection failed: ${readiness.smtp.error}`}</p>}
          {readiness.blockers.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">{readiness.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {['', ...OUTREACH_STATUSES].map((s) => (
          <button key={s || 'all'} onClick={() => setStatus(s)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${status === s ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}>
            {s ? label(s) : 'All'}{s && counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {error ? <ErrorState title="Could not load outreach" description={error} retry={load} /> : !items ? <Skeleton className="h-40" /> : items.length === 0 ? (
        <EmptyState title="No messages" description="Run the Outreach Agent on an account and save its draft, then submit it for approval." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">To</th><th className="p-3">Subject</th><th className="p-3">Status</th><th className="p-3">Sequence</th><th className="p-3">When</th></tr></thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={() => setOpenId(m.id)}>
                  <td className="p-3"><div className="font-medium">{m.contact_name}</div><div className="text-xs text-muted-foreground">{m.account_name}{m.contact_email ? ` · ${m.contact_email}` : ''}</div></td>
                  <td className="p-3">{m.subject}</td>
                  <td className="p-3"><Badge variant={m.status === 'sent' ? 'default' : 'outline'}>{label(m.status)}</Badge></td>
                  <td className="p-3">{m.sequence_key ? `step ${m.step}${m.due_at ? ` · due ${fmtDate(m.due_at)}` : ''}` : '—'}</td>
                  <td className="p-3">{fmtDate(m.sent_at ?? m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MessageDialog key={openId ?? 'none'} message={open} sendReady={readiness?.can_send ?? false} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  )
}

function MessageDialog({ message: m, sendReady, onClose, onChanged }: { message: OutreachMessage | null; sendReady: boolean; onClose: () => void; onChanged: () => void }) {
  const [subject, setSubject] = useState(m?.subject ?? '')
  const [body, setBody] = useState(m?.body ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>, closeAfter = false) => {
    setBusy(true)
    setError(null)
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

  const editable = m?.status === 'draft' || m?.status === 'rejected'
  const dirty = m ? subject !== m.subject || body !== m.body : false

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
            {m.error && <p className="rounded bg-red-50 p-2 text-sm text-destructive">Last send failed: {m.error}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}

            {editable ? (
              <div className="space-y-2">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                <textarea className={TEXTAREA} rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
                {m.status === 'rejected' && <p className="text-xs text-muted-foreground">Saving an edit returns it to draft.</p>}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm"><p className="font-medium">Subject: {m.subject}</p><p className="mt-2 whitespace-pre-wrap">{m.body}</p><p className="mt-3 text-xs text-muted-foreground">An unsubscribe link is added to the end of every email when it is sent.</p></div>
            )}

            <div className="flex flex-wrap gap-2">
              {editable && <Button size="sm" variant="outline" disabled={busy || !dirty || body.trim().length < 20 || !subject.trim()} onClick={() => run(() => outreachService.update(m.id, { subject, body }))}>Save changes</Button>}
              {m.status === 'draft' && <Button size="sm" disabled={busy || dirty} title={dirty ? 'Save your changes first' : undefined} onClick={() => run(() => outreachService.submit(m.id))}>Submit for approval</Button>}
              {m.status === 'pending_approval' && (
                <>
                  <Button size="sm" disabled={busy} onClick={() => { if (window.confirm(`Approve this exact text to be emailed to ${m.contact_name}?\n\nSubject: ${m.subject}\n\n${m.body}`)) void run(() => outreachService.approve(m.id)) }}>Approve</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => { const n = window.prompt('Why is this being rejected?'); if (n && n.trim().length >= 3) void run(() => outreachService.reject(m.id, n.trim())) }}>Reject</Button>
                </>
              )}
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
