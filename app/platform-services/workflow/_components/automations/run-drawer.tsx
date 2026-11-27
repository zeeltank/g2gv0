'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { RecordDrawer } from '@/components/shared/scaffolds/record-drawer'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { actionPhrase } from '@/lib/workflows/catalog'
import { workflowErrorMessage } from '@/lib/workflows/messages'
import {
  approveQuestion, canCancel, canDecide, canRetry, cancelQuestion, decisionNotice, describeStep, rejectQuestion, runReason, runSubject,
} from '@/lib/workflows/runs'
import { runStatusChip } from '@/lib/workflows/status'
import { absoluteDate, relativeTime } from '@/lib/workflows/time'
import { checkLine } from '@/lib/workflows/try-it'
import { CHIP_BASE, chipClass, NOTE_TONE } from '@/lib/workflows/tones'
import { workflowsService, type GtmWorkflow, type RunDetail, type WorkflowCatalog } from '@/services/gtm/workflows'
import { cn } from '@/lib/utils'
import { AutoField } from './auto-field'

/**
 * One run, in a drawer: what it was about, what happened and why in plain words, the conditions it checked, and the steps it took. An administrator can
 * approve or reject a run that waits (every decision asks first), retry one that failed, and cancel one that has not started, where the engine allows it.
 */
export function RunDrawer({ runId, catalog, workflows, canWrite, startRejecting, onClose, onChanged }: {
  runId: number
  catalog: WorkflowCatalog
  /** The automations of the organisation, to say what approving would do. */
  workflows: readonly GtmWorkflow[]
  canWrite: boolean
  /** Open on the reason box, because the person pressed Reject. */
  startRejecting: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [now, setNow] = useState<Date>(() => new Date(0))
  const { confirm, confirmDialog } = useConfirm()
  const reasonRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    try {
      setDetail((await workflowsService.run(runId)).data)
      setNow(new Date())
      setLoadError(null)
    } catch (e) {
      setLoadError(workflowErrorMessage(e, 'The run could not be loaded. Check your connection and try again.', catalog))
    }
  }, [runId, catalog])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])
  useEffect(() => { if (startRejecting && detail && canDecide(detail.run.status)) reasonRef.current?.focus() }, [startRejecting, detail])

  const run = detail?.run
  const workflow = workflows.find((w) => w.id === run?.workflow_id)
  const phrases = workflow ? workflow.actions.map((a) => actionPhrase(catalog, a.type)) : []
  const reasonText = run ? runReason(run, catalog, now) : null

  const act = async (kind: 'approve' | 'reject' | 'retry' | 'cancel') => {
    if (!run) return
    const asked = kind === 'approve' ? approveQuestion(run, phrases)
      : kind === 'reject' ? rejectQuestion(run)
        : kind === 'cancel' ? cancelQuestion(run)
          : null
    if (asked && !(await confirm({ ...asked, tone: kind === 'approve' ? 'default' : 'destructive' }))) return
    setBusy(true)
    setNotice(null)
    try {
      const r = kind === 'approve' ? await workflowsService.approve(run.id, reason.trim())
        : kind === 'reject' ? await workflowsService.reject(run.id, reason.trim())
          : kind === 'retry' ? await workflowsService.retry(run.id)
            : await workflowsService.cancel(run.id)
      setNotice({ tone: 'success', text: decisionNotice(kind, r.data.status) })
      setReason('')
      onChanged()
    } catch (e) {
      setNotice({ tone: 'error', text: workflowErrorMessage(e, 'That did not work. Check your connection and try again.', catalog) })
      onChanged()
    } finally {
      setBusy(false)
      await load()
    }
  }

  const chip = run ? runStatusChip(run.status) : null
  const trigger = detail?.workflow?.trigger_event ?? ''
  const trace = run?.context?.trace ?? []
  const deciding = run ? canWrite && canDecide(run.status) : false

  return (
    <>
      <RecordDrawer
        open
        onClose={onClose}
        title={detail?.workflow?.name ?? run?.workflow_name ?? 'Run'}
        description={run ? `${runSubject(run)}, started ${relativeTime(run.created_at, now)} (${absoluteDate(run.created_at)})` : 'Loading the run…'}
        busy={busy}
        width="lg"
        footer={(requestClose) => (
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Close</Button>
            {run && canWrite && canCancel(run.status) && <Button type="button" variant="outline" onClick={() => void act('cancel')} disabled={busy}>Cancel run</Button>}
            {run && canWrite && canRetry(run.status) && <Button type="button" onClick={() => void act('retry')} disabled={busy}>Retry</Button>}
            {deciding && <Button type="button" variant="outline" onClick={() => void act('reject')} disabled={busy || reason.trim() === ''}>Reject</Button>}
            {deciding && <Button type="button" onClick={() => void act('approve')} disabled={busy}>Approve</Button>}
          </div>
        )}
      >
        {loadError && <ErrorState title="The run could not be loaded" description={loadError} retry={() => void load()} />}
        {!loadError && !run && <div role="status" aria-label="Loading the run" className="space-y-3"><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-24 rounded-lg" /></div>}

        {run && chip && (
          <div className="space-y-5">
            {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Working…</p>}
            {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={cn('break-words rounded-lg border px-3 py-2 text-sm', NOTE_TONE[notice.tone])}>{notice.text}</p>}

            <div className="space-y-2">
              <span className={`${CHIP_BASE} ${chipClass(chip.tone)}`}>{chip.word}</span>
              {reasonText && <p className="break-words text-sm text-foreground">{reasonText}</p>}
            </div>

            {run.status === 'pending_approval' && phrases.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">If you approve it</h3>
                <p className="break-words text-sm text-muted-foreground">It will {phrases.join(', then ')} on {runSubject(run)}, now.</p>
              </section>
            )}

            {deciding && (
              <AutoField label="Why are you rejecting it?" hint="Needed to reject. Approving does not need a reason.">
                {(control) => <Textarea {...control} ref={reasonRef} name="reason" rows={2} maxLength={500} autoComplete="off" value={reason} onChange={(e) => setReason(e.target.value)} />}
              </AutoField>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">What it checked</h3>
              {trace.length === 0
                ? <p className="text-sm text-muted-foreground">It had no conditions, so every event counted.</p>
                : <ul className="space-y-1">{trace.map((t, i) => <li key={i} className="break-words text-sm text-foreground">{checkLine(t, catalog, trigger).text}</li>)}</ul>}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">What it did</h3>
              {detail.steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No step has run yet.</p>
              ) : (
                <ol className="space-y-2">
                  {detail.steps.map((s) => {
                    const step = describeStep(s, catalog, now)
                    const stepChip = runStatusChip(step.status)
                    return (
                      <li key={step.id} className="space-y-1.5 rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="min-w-0 break-words text-sm font-medium text-foreground">{step.title}</p>
                          <span className={`${CHIP_BASE} ${chipClass(stepChip.tone)}`}>{stepChip.word}</span>
                        </div>
                        {step.when && <p className="text-xs text-muted-foreground">{step.when}</p>}
                        {step.error && <p className="break-words text-sm text-foreground">{step.error}</p>}
                        {step.details.length > 0 && (
                          <dl className="grid grid-cols-1 gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[auto_1fr]">
                            {step.details.map((d) => (
                              <div key={d.label} className="contents">
                                <dt className="text-muted-foreground">{d.label}</dt>
                                <dd className="break-words text-foreground">{d.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          </div>
        )}
      </RecordDrawer>
      {confirmDialog}
    </>
  )
}
