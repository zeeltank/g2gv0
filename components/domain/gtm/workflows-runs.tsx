'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  workflowsService,
  type ConditionTrace,
  type GtmWorkflow,
  type RunDetail,
  type WorkflowRunRow,
} from '@/services/gtm/workflows'
import { errMsg, fmtDate } from './gtm-shared'

const TEXTAREA = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
const pretty = (s: string) => s.replace(/_/g, ' ')
export const fmtVal = (v: unknown): string => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))

const TONE: Record<string, string> = {
  succeeded: 'text-green-700 border-green-300',
  failed: 'text-destructive border-red-300',
  pending_approval: 'text-amber-700 border-amber-300',
  retry_wait: 'text-amber-700 border-amber-300',
  rejected: 'text-destructive border-red-300',
}
export function RunStatus({ status }: { status: string }) {
  return <Badge variant="outline" className={TONE[status]}>{pretty(status)}</Badge>
}

/** Plain-words retry / next-attempt information for a run row. */
function retryInfo(r: Pick<WorkflowRunRow, 'status' | 'attempts' | 'next_attempt_at'>): string | null {
  if (r.status === 'retry_wait') return `Attempt ${r.attempts} hit a temporary failure; next attempt ${fmtDate(r.next_attempt_at, true)}.`
  if (r.status === 'failed' && r.attempts > 0) return `Failed after ${r.attempts} attempt${r.attempts === 1 ? '' : 's'}. Retrying skips steps that already succeeded.`
  return null
}

export function ConditionTraceList({ trace }: { trace: ConditionTrace[] }) {
  if (trace.length === 0) return <p className="text-sm text-muted-foreground">No conditions, so every event matches.</p>
  return (
    <ul className="space-y-1 text-sm">
      {trace.map((c, i) => (
        <li key={i} className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={c.pass ? 'text-green-700' : 'text-destructive'}>{c.pass ? 'pass' : 'fail'}</Badge>
          <code className="text-xs">{c.field}</code> {pretty(c.op)} <code className="text-xs">{fmtVal(c.expected)}</code>
          <span className="text-muted-foreground">(actual: {fmtVal(c.actual)})</span>
        </li>
      ))}
    </ul>
  )
}

/** The Runs tab (every run, filterable) and the Approvals queue (pending_approval only). */
export function RunsPanel({ ready, pendingOnly, onChanged }: { ready: boolean; pendingOnly: boolean; onChanged: () => void }) {
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<WorkflowRunRow[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)

  const effective = pendingOnly ? 'pending_approval' : status
  const load = useCallback(async () => {
    try {
      const r = await workflowsService.runs({ status: effective, limit: 100 })
      setItems(r.data.items)
      setCounts(Array.isArray(r.data.counts) ? {} : r.data.counts)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load runs'))
    }
  }, [effective])

  useEffect(() => { if (ready) queueMicrotask(() => void load()) }, [ready, load])

  const changed = () => { void load(); onChanged() }

  return (
    <div>
      {pendingOnly ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50/50 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium"><ShieldAlert className="size-4 text-amber-600" />Approving executes the workflow&rsquo;s actions on the record immediately.</div>
          <p className="mt-1 text-xs text-muted-foreground">Agent actions only read and draft: an Outreach draft still needs its own person-approval before anything is sent, and no workflow can send email. Only administrators can approve or reject.</p>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
          {['', ...Object.keys(counts)].map((s) => (
            <button key={s || 'all'} onClick={() => setStatus(s)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${status === s ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}>
              {s ? pretty(s) : 'All'}{s ? ` (${counts[s]})` : ''}
            </button>
          ))}
        </div>
      )}

      {error ? <ErrorState title="Could not load runs" description={error} retry={load} /> : !items ? <Skeleton className="h-40" /> : items.length === 0 ? (
        <EmptyState
          title={pendingOnly ? 'Nothing is waiting for approval' : 'No runs'}
          description={pendingOnly ? 'Runs of workflows that need approval appear here.' : 'A run is recorded when an event matches an active workflow. Workflows only react to events recorded after they are activated.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Workflow</th><th className="p-3">Event</th><th className="p-3">Status</th><th className="p-3">Attempts</th><th className="p-3">When</th><th className="p-3" /></tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={() => setOpenId(r.id)}>
                  <td className="p-3 font-medium">{r.workflow_name ?? `Workflow ${r.workflow_id}`}<div className="text-xs font-normal text-muted-foreground">Run #{r.id}</div></td>
                  <td className="p-3">{r.event_type}<div className="text-xs text-muted-foreground">{r.entity_type ? `${pretty(r.entity_type)} #${r.entity_id}` : ''}</div></td>
                  <td className="p-3">
                    <RunStatus status={r.status} />
                    {r.status === 'retry_wait' && <div className="mt-1 text-xs text-muted-foreground">next {fmtDate(r.next_attempt_at, true)}</div>}
                    {r.error && <div className="mt-1 max-w-xs truncate text-xs text-destructive" title={r.error}>{r.error}</div>}
                  </td>
                  <td className="p-3">{r.attempts}</td>
                  <td className="p-3">{fmtDate(r.created_at, true)}</td>
                  <td className="p-3 text-right">{r.status === 'pending_approval' && <span className="text-xs font-medium text-primary">Review</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RunDialog key={openId ?? 'none'} runId={openId} onClose={() => setOpenId(null)} onChanged={changed} />
    </div>
  )
}

export function RunDialog({ runId, onClose, onChanged }: { runId: number | null; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [workflow, setWorkflow] = useState<GtmWorkflow | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (runId === null) return
    try {
      const d = (await workflowsService.run(runId)).data
      setDetail(d)
      setLoadError(null)
      if (d.run.status === 'pending_approval' && d.workflow) {
        // what approving would execute
        const w = await workflowsService.get(d.workflow.id).catch(() => null)
        setWorkflow(w?.data.workflow ?? null)
      }
    } catch (e) {
      setLoadError(errMsg(e, 'Unable to load the run'))
    }
  }, [runId])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const act = async (fn: () => Promise<{ data: { status: string } }>, label: string) => {
    setBusy(true)
    setError(null)
    try {
      const r = await fn()
      setMessage(`${label}. Run is now ${pretty(r.data.status)}.`)
      setMode(null)
      setNote('')
      onChanged()
      await load()
    } catch (e) {
      setError(errMsg(e))
      onChanged()
      await load()
    } finally {
      setBusy(false)
    }
  }

  const r = detail?.run
  const info = r ? retryInfo(r) : null
  const trace = r?.context?.trace ?? []
  const cancellable = r && ['pending_approval', 'queued', 'retry_wait'].includes(r.status)

  return (
    <Dialog open={runId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{detail?.workflow?.name ?? 'Run'} {r ? `- run #${r.id}` : ''}</DialogTitle>
          <DialogDescription>{r ? `${r.event_type}${r.entity_type ? ` on ${pretty(r.entity_type)} #${r.entity_id}` : ''} - started ${fmtDate(r.created_at, true)}` : 'Loading run'}</DialogDescription>
        </DialogHeader>

        {loadError ? <ErrorState title="Could not load the run" description={loadError} retry={load} /> : !r ? <Skeleton className="h-40" /> : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <RunStatus status={r.status} />
              <span className="text-muted-foreground">{r.attempts} attempt{r.attempts === 1 ? '' : 's'}{r.finished_at ? ` - finished ${fmtDate(r.finished_at, true)}` : ''}</span>
            </div>
            {info && <p className="rounded bg-amber-50 p-2 text-sm text-amber-900">{info}</p>}
            {r.error && <p className="flex items-start gap-2 rounded bg-red-50 p-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{r.error}</p>}
            {r.decision_note && <p className="text-sm text-muted-foreground">Decision note: {r.decision_note}</p>}
            {message && <p className="rounded bg-green-50 p-2 text-sm text-green-800">{message}</p>}
            {error && <p className="rounded bg-red-50 p-2 text-sm text-destructive" role="alert">{error}</p>}

            {r.status === 'pending_approval' && workflow && (
              <section>
                <h3 className="mb-1 text-sm font-medium">If approved, these actions run on this record</h3>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {workflow.actions.map((a, i) => <li key={i}><span className="font-medium">{pretty(a.type)}</span> <code className="text-xs text-muted-foreground">{fmtVal(a.params)}</code></li>)}
                </ol>
              </section>
            )}

            <section>
              <h3 className="mb-1 text-sm font-medium">Conditions at trigger time</h3>
              <ConditionTraceList trace={trace} />
            </section>

            <section>
              <h3 className="mb-1 text-sm font-medium">Steps</h3>
              {detail.steps.length === 0 ? <p className="text-sm text-muted-foreground">No step has executed yet.</p> : (
                <ol className="space-y-2">
                  {detail.steps.map((s) => (
                    <li key={s.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Step {s.step}: {pretty(s.action)}</span>
                        <RunStatus status={s.status} />
                        <span className="ml-auto text-xs text-muted-foreground">{fmtDate(s.finished_at ?? s.started_at, true)}</span>
                      </div>
                      {s.error && <p className="mt-1 text-xs text-destructive">{s.error}</p>}
                      {s.result !== null && s.result !== undefined && <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs">{JSON.stringify(s.result, null, 2)}</pre>}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {mode && (
              <section className={`rounded-lg border p-3 ${mode === 'approve' ? 'border-amber-300 bg-amber-50/50' : 'border-border'}`}>
                {mode === 'approve' ? (
                  <p className="mb-2 text-sm font-medium">Confirm approval: this runs the actions above on {r.entity_type ? `${pretty(r.entity_type)} #${r.entity_id}` : 'the record'} now and cannot be undone.</p>
                ) : (
                  <p className="mb-2 text-sm font-medium">Reject this run. Nothing will be executed.</p>
                )}
                <label className="block text-sm">{mode === 'reject' ? 'Reason (required)' : 'Note (optional)'}
                  <textarea className={TEXTAREA} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => { setMode(null); setNote('') }}>Back</Button>
                  {mode === 'approve'
                    ? <Button size="sm" disabled={busy} onClick={() => act(() => workflowsService.approve(r.id, note.trim()), 'Approved')}>{busy && <Loader2 className="mr-1 size-3.5 animate-spin" />}Yes, approve and run</Button>
                    : <Button size="sm" variant="destructive" disabled={busy || !note.trim()} onClick={() => act(() => workflowsService.reject(r.id, note.trim()), 'Rejected')}>{busy && <Loader2 className="mr-1 size-3.5 animate-spin" />}Reject run</Button>}
                </div>
              </section>
            )}

            {!mode && (
              <div className="flex flex-wrap justify-end gap-2">
                {r.status === 'pending_approval' && <Button variant="outline" disabled={busy} onClick={() => { setMode('reject'); setMessage(null) }}>Reject...</Button>}
                {r.status === 'pending_approval' && <Button disabled={busy} onClick={() => { setMode('approve'); setMessage(null) }}>Approve...</Button>}
                {r.status === 'failed' && <Button disabled={busy} onClick={() => act(() => workflowsService.retry(r.id), 'Retried')}>{busy && <Loader2 className="mr-1 size-3.5 animate-spin" />}Retry run</Button>}
                {cancellable && <Button variant="outline" disabled={busy} onClick={() => act(() => workflowsService.cancel(r.id), 'Cancelled')}>Cancel run</Button>}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
