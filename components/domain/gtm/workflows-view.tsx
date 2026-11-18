'use client'

import { useCallback, useEffect, useState } from 'react'
import { Info, Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { workflowsService, type DryRunResult, type GtmWorkflow, type WorkflowCatalog } from '@/services/gtm/workflows'
import { GtmPageHeader, errMsg, fmtDate, useGtmReady } from './gtm-shared'
import { WorkflowBuilder, pretty } from './workflows-builder'
import { ConditionTraceList, RunsPanel, fmtVal } from './workflows-runs'

type Tab = 'workflows' | 'runs' | 'approvals'
type StatusChange = { w: GtmWorkflow; to: 'active' | 'paused' | 'archived' }

const STATUS_TONE: Record<string, string> = { active: 'text-green-700 border-green-300', paused: 'text-amber-700 border-amber-300', draft: '', archived: 'text-muted-foreground' }

/**
 * Workflows: trigger -> conditions -> actions. A workflow reacts only to events recorded after it is
 * activated, runs of consequential workflows wait for an administrator, and nothing here can send email.
 */
export function WorkflowsView() {
  const ready = useGtmReady()
  const [tab, setTab] = useState<Tab>('workflows')
  const [catalog, setCatalog] = useState<WorkflowCatalog | null>(null)
  const [items, setItems] = useState<GtmWorkflow[] | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [builder, setBuilder] = useState<{ workflow: GtmWorkflow | null } | null>(null)
  const [change, setChange] = useState<StatusChange | null>(null)
  const [testing, setTesting] = useState<GtmWorkflow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [c, l, r] = await Promise.all([workflowsService.catalog(), workflowsService.list(), workflowsService.runs({ status: 'pending_approval', limit: 10 })])
      setCatalog(c.data)
      setItems(l.data.items)
      const counts = r.data.counts
      setPending(Array.isArray(counts) ? 0 : counts.pending_approval ?? 0)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load workflows'))
    }
  }, [])

  useEffect(() => { if (ready) queueMicrotask(() => void load()) }, [ready, load])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'workflows', label: 'Workflows' },
    { key: 'runs', label: 'Runs' },
    { key: 'approvals', label: pending ? `Approvals (${pending})` : 'Approvals' },
  ]

  return (
    <div className="p-6">
      <GtmPageHeader
        title="Workflows"
        description="Automate follow-up: when a trigger happens and the conditions hold, the actions run. Consequential actions wait for an administrator to approve each run."
        actions={tab === 'workflows' && catalog ? <Button onClick={() => setBuilder({ workflow: null })}><Plus className="mr-1 size-4" />New workflow</Button> : undefined}
      />

      {catalog && catalog.notes.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 font-medium"><Info className="size-4" />How workflows behave</div>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{catalog.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
      {notice && <p className="mb-4 rounded bg-green-50 p-2 text-sm text-green-800" role="status">{notice}</p>}

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}>{t.label}</button>
        ))}
      </div>

      {error ? <ErrorState title="Could not load workflows" description={error} retry={load} /> : !items || !catalog ? <Skeleton className="h-40" /> : tab === 'workflows' ? (
        items.length === 0 ? (
          <EmptyState title="No workflows yet" description="Create a draft, dry-run it against a real record, then activate it." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Workflow</th><th className="p-3">Trigger</th><th className="p-3">Status</th><th className="p-3">Runs (7 days)</th><th className="p-3">Updated</th><th className="p-3" /></tr></thead>
              <tbody>
                {items.map((w) => {
                  const runs = Array.isArray(w.runs_7d) || !w.runs_7d ? {} : w.runs_7d
                  const needsApproval = Boolean(w.requires_approval) || w.actions.some((a) => catalog.actions[a.type]?.consequential)
                  return (
                    <tr key={w.id} className="border-t border-border align-top">
                      <td className="p-3">
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-muted-foreground">{w.conditions.length} condition{w.conditions.length === 1 ? '' : 's'} - {w.actions.map((a) => catalog.actions[a.type]?.label ?? pretty(a.type)).join(' > ')}</div>
                        {needsApproval && <Badge variant="outline" className="mt-1 border-amber-400 text-[10px] text-amber-700">Approval required</Badge>}
                      </td>
                      <td className="p-3">{w.trigger_label ?? catalog.triggers[w.trigger_event]?.label ?? w.trigger_event}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={STATUS_TONE[w.status]}>{w.status}</Badge>
                        {w.status === 'active' && w.activated_at && <div className="mt-1 text-xs text-muted-foreground">since {fmtDate(w.activated_at, true)}</div>}
                      </td>
                      <td className="p-3 text-xs">{Object.keys(runs).length === 0 ? <span className="text-muted-foreground">none</span> : Object.entries(runs).map(([s, c]) => <div key={s}>{pretty(s)}: {c}</div>)}</td>
                      <td className="p-3">{fmtDate(w.updated_at)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          {(w.status === 'draft' || w.status === 'paused') && <Button size="sm" variant="outline" onClick={() => setBuilder({ workflow: w })}>Edit</Button>}
                          <Button size="sm" variant="outline" onClick={() => setTesting(w)}>Dry run</Button>
                          {(w.status === 'draft' || w.status === 'paused') && <Button size="sm" onClick={() => setChange({ w, to: 'active' })}>Activate</Button>}
                          {w.status === 'active' && <Button size="sm" variant="outline" onClick={() => setChange({ w, to: 'paused' })}>Pause</Button>}
                          <Button size="sm" variant="ghost" onClick={() => setChange({ w, to: 'archived' })}>Archive</Button>
                        </div>
                        {w.status === 'active' && <p className="mt-1 text-right text-xs text-muted-foreground">Pause to edit.</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <RunsPanel key={tab} ready={ready} pendingOnly={tab === 'approvals'} onChanged={load} />
      )}

      {builder && catalog && (
        <WorkflowBuilder key={builder.workflow?.id ?? 'new'} open workflow={builder.workflow} catalog={catalog}
          onClose={() => setBuilder(null)} onSaved={() => { setNotice(builder.workflow ? 'Workflow saved.' : 'Draft created. It does nothing until you activate it.'); void load() }} />
      )}
      <StatusDialog key={change ? `status-${change.w.id}-${change.to}` : 'status-none'} change={change} onClose={() => setChange(null)}
        onDone={(msg) => { setNotice(msg); void load() }} />
      <DryRunDialog key={`test-${testing?.id ?? 'none'}`} workflow={testing} onClose={() => setTesting(null)} />
    </div>
  )
}

function StatusDialog({ change, onClose, onDone }: { change: StatusChange | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const go = async () => {
    if (!change) return
    setBusy(true)
    setError(null)
    try {
      const r = await workflowsService.setStatus(change.w.id, change.to, change.to === 'archived')
      onDone(change.to === 'archived' ? `Archived. ${r.data.runs_cancelled} waiting run(s) cancelled.` : change.to === 'active' ? 'Activated. It now reacts to new events.' : 'Paused.')
      onClose()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const text = change?.to === 'active'
    ? 'Once active, this workflow reacts to events recorded from now on - it will not act on past history. Runs that include consequential actions still wait for administrator approval. The server re-validates the definition (for example, that campaigns it uses are still open).'
    : change?.to === 'paused' ? 'A paused workflow stops reacting to new events. You can then edit it and activate it again.'
      : 'Archiving is final. Runs that have not started (waiting for approval, queued, or waiting to retry) are cancelled.'

  return (
    <Dialog open={change !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{change?.to === 'active' ? 'Activate' : change?.to === 'paused' ? 'Pause' : 'Archive'} &ldquo;{change?.w.name}&rdquo;?</DialogTitle>
          <DialogDescription>{text}</DialogDescription>
        </DialogHeader>
        {error && <p className="rounded bg-red-50 p-2 text-sm text-destructive" role="alert">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={change?.to === 'archived' ? 'destructive' : 'default'} onClick={go} disabled={busy}>
            {busy && <Loader2 className="mr-1 size-3.5 animate-spin" />}{change?.to === 'active' ? 'Activate' : change?.to === 'paused' ? 'Pause' : 'Archive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DryRunDialog({ workflow, onClose }: { workflow: GtmWorkflow | null; onClose: () => void }) {
  const [entityId, setEntityId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DryRunResult | null>(null)

  const run = async () => {
    if (!workflow) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult((await workflowsService.test(workflow.id, Number(entityId))).data)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={workflow !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dry run: {workflow?.name}</DialogTitle>
          <DialogDescription>
            Shows what this workflow would do for one real record, with no side effects. Enter the id of the record the trigger is about ({workflow?.trigger_label ?? workflow?.trigger_event}).
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-end gap-2">
          <label className="flex-1 text-sm">Record id
            <Input type="number" min={1} value={entityId} onChange={(e) => setEntityId(e.target.value)} />
          </label>
          <Button onClick={run} disabled={busy || !entityId.trim()}>{busy && <Loader2 className="mr-1 size-3.5 animate-spin" />}Run test</Button>
        </div>
        {error && <p className="rounded bg-red-50 p-2 text-sm text-destructive" role="alert">{error}</p>}
        {result && (
          <div className="space-y-4">
            <p className={`rounded p-2 text-sm font-medium ${result.would_run ? 'bg-green-50 text-green-800' : 'bg-muted text-muted-foreground'}`}>
              {result.would_run ? 'This record matches: the workflow would run.' : 'This record does not match: no run would be created.'}
              {result.would_run && result.needs_approval && ' The run would wait for administrator approval before executing.'}
            </p>
            <section><h3 className="mb-1 text-sm font-medium">Conditions</h3><ConditionTraceList trace={result.conditions} /></section>
            <section>
              <h3 className="mb-1 text-sm font-medium">Actions (placeholders filled from this record)</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {result.actions.map((a, i) => (
                  <li key={i}>
                    <span className="font-medium">{a.label}</span>{a.consequential && <Badge variant="outline" className="ml-2 border-amber-400 text-[10px] text-amber-700">consequential</Badge>}
                    <pre className="mt-0.5 whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs">{JSON.stringify(a.params, null, 2)}</pre>
                  </li>
                ))}
              </ol>
            </section>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Facts read from the record ({Object.keys(result.facts).length})</summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                {Object.entries(result.facts).map(([k, v]) => <div key={k} className="contents"><dt className="font-mono text-muted-foreground">{k}</dt><dd>{fmtVal(v)}</dd></div>)}
              </dl>
            </details>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
